import { useEffect, useRef, useCallback } from "react";
import {
  useAppDispatch,
  useAppSelector,
  setConnectionStatus,
  setCommitStreamError,
  addCommitEntry,
  clearCommitHistory,
  type CommitEntry,
} from "@/store";
import { config } from "@/config";

interface UseCommitStreamOptions {
  org: string;
  team: string;
  branch: string;
  enabled?: boolean;
}

export function useCommitStream({ org, team, branch, enabled = true }: UseCommitStreamOptions) {
  const dispatch = useAppDispatch();
  const abortRef = useRef<AbortController | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const credentials = useAppSelector((state) => state.auth.credentials);

  const connect = useCallback(() => {
    if (!enabled || !org || !team || !branch) return;

    const controller = new AbortController();
    abortRef.current = controller;

    dispatch(setConnectionStatus("connecting"));
    dispatch(setCommitStreamError(null));

    const baseUrl = config.apiUrl;
    const url = `${baseUrl}/api/v1/ext/commits/${org}/${team}/local/branch/${branch}?timeout=false`;
    const headers: Record<string, string> = {
      Accept: "application/x-ndjson",
    };
    if (credentials) {
      headers.Authorization = `Basic ${credentials}`;
    }

    fetch(url, { headers, signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        if (!response.body) {
          throw new Error("No response body");
        }
        dispatch(setConnectionStatus("connected"));

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
              const toStrArray = (v: unknown): string[] => Array.isArray(v) ? v.map(String) : [];
              const entry: CommitEntry = {
                id: String(commit?.identifier ?? obj.id ?? ""),
                author: String(commit?.author ?? obj.author ?? ""),
                message: String(commit?.message ?? obj.message ?? ""),
                timestamp: String(commit?.timestamp ?? obj.timestamp ?? ""),
                user: commit?.user ? String(commit.user) : undefined,
                changes: changesRaw ? {
                  added: toStrArray(changesRaw.added),
                  changed: toStrArray(changesRaw.changed),
                  deleted: toStrArray(changesRaw.deleted),
                } : undefined,
              };
              if (entry.id) {
                dispatch(addCommitEntry(entry));
              }
            } catch {
              // skip malformed lines
            }
          }
        }
        // Stream ended (server timeout or closed) — auto-reconnect to keep live
        if (!controller.signal.aborted) {
          dispatch(setConnectionStatus("connecting"));
          reconnectTimerRef.current = setTimeout(() => connect(), 2000);
        } else {
          dispatch(setConnectionStatus("disconnected"));
        }
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const msg = err instanceof Error ? err.message : String(err);
        dispatch(setConnectionStatus("error"));
        dispatch(setCommitStreamError(msg));
        // Auto-reconnect after 5 seconds
        reconnectTimerRef.current = setTimeout(() => connect(), 5000);
      });
  }, [enabled, org, team, branch, credentials, dispatch]);

  useEffect(() => {
    connect();
    return () => {
      abortRef.current?.abort();
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
  }, [connect]);

  const disconnect = useCallback(() => {
    abortRef.current?.abort();
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }
    dispatch(setConnectionStatus("disconnected"));
  }, [dispatch]);

  const clearHistory = useCallback(() => {
    dispatch(clearCommitHistory());
  }, [dispatch]);

  return { connect, disconnect, clearHistory };
}
