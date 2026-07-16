import { createListenerMiddleware } from "@reduxjs/toolkit";
import {
  startCommitStream,
  stopCommitStream,
  setConnectionStatus,
  setCommitStreamError,
  addCommitEntry,
  clearCommitHistory,
  type CommitEntry,
} from "./commitStreamSlice";
import { config } from "@/config";
import { selectAuthCredentials } from "./authSlice";
import type { RootState } from "./store";

interface StreamParams {
  org: string;
  team: string;
  branch: string;
}

let currentGeneration = 0;
let abortController: AbortController | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let lastCommitId: string | null = null;
let activeParams: StreamParams | null = null;

function cleanup() {
  currentGeneration++;
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  lastCommitId = null;
  activeParams = null;
}

function getCredentials(getState: () => RootState): string | null {
  return selectAuthCredentials(getState());
}

async function connectStream(
  api: { dispatch: (action: unknown) => void; getState: () => unknown },
  params: StreamParams,
) {
  const { org, team, branch } = params;
  if (!org || !team || !branch) return;

  const myGeneration = currentGeneration;
  const controller = new AbortController();
  abortController = controller;
  activeParams = params;

  api.dispatch(setConnectionStatus("connecting"));
  api.dispatch(setCommitStreamError(null));

  const baseUrl = config.apiUrl;
  const sinceParam = lastCommitId
    ? `&since=${encodeURIComponent(lastCommitId)}`
    : "";
  const url = `${baseUrl}/api/v1/ext/commits/${org}/${team}/local/branch/${branch}?timeout=false${sinceParam}`;

  const credentials = getCredentials(api.getState as () => RootState);
  const headers: Record<string, string> = {
    Accept: "application/x-ndjson",
  };
  if (credentials) {
    headers.Authorization = `Basic ${credentials}`;
  }

  try {
    const response = await fetch(url, { headers, signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    if (!response.body) {
      throw new Error("No response body");
    }
    api.dispatch(setConnectionStatus("connected"));

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const obj = JSON.parse(trimmed) as Record<string, unknown>;
          const commit = obj.commit as Record<string, unknown> | undefined;
          const changesRaw = obj.changes as Record<string, unknown> | undefined;
          const toStrArray = (v: unknown): string[] =>
            Array.isArray(v) ? v.map(String) : [];
          const entry: CommitEntry = {
            id: String(commit?.identifier ?? obj.id ?? ""),
            author: String(commit?.author ?? obj.author ?? ""),
            message: String(commit?.message ?? obj.message ?? ""),
            timestamp: String(commit?.timestamp ?? obj.timestamp ?? ""),
            user: commit?.user ? String(commit.user) : undefined,
            changes: changesRaw
              ? {
                  added: toStrArray(changesRaw.added),
                  changed: toStrArray(changesRaw.changed),
                  deleted: toStrArray(changesRaw.deleted),
                }
              : undefined,
          };
          if (entry.id) {
            lastCommitId = entry.id;
            api.dispatch(addCommitEntry(entry));
          }
        } catch {
          // skip malformed lines
        }
      }
    }

    // Stream ended normally — reconnect only if still the current generation
    if (myGeneration !== currentGeneration) return;
    api.dispatch(setConnectionStatus("connecting"));
    reconnectTimer = setTimeout(
      () => connectStream(api, params),
      2000,
    );
  } catch (err: unknown) {
    if (controller.signal.aborted) return;
    if (myGeneration !== currentGeneration) return;
    const msg = err instanceof Error ? err.message : String(err);
    api.dispatch(setConnectionStatus("error"));
    api.dispatch(setCommitStreamError(msg));
    reconnectTimer = setTimeout(
      () => connectStream(api, params),
      5000,
    );
  }
}

export const commitStreamListenerMiddleware =
  createListenerMiddleware();

commitStreamListenerMiddleware.startListening({
  actionCreator: startCommitStream,
  effect: async (action, listenerApi) => {
    const { org, team, branch } = action.payload;
    if (
      activeParams &&
      activeParams.org === org &&
      activeParams.team === team &&
      activeParams.branch === branch
    ) {
      return;
    }
    cleanup();
    listenerApi.dispatch(clearCommitHistory());
    await connectStream(listenerApi, action.payload);
  },
});

commitStreamListenerMiddleware.startListening({
  actionCreator: stopCommitStream,
  effect: async (_action, listenerApi) => {
    cleanup();
    listenerApi.dispatch(setConnectionStatus("disconnected"));
  },
});
