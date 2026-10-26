import { baseApi } from "../baseApi";
import { config } from "@/config";

const activeStreams = new Set<string>();

export interface LogCommit {
  readonly identifier: string;
  readonly timestamp: string;
  readonly author: string;
  readonly message: string;
  readonly parent?: string;
  readonly added_count?: number;
  readonly changed_count?: number;
  readonly deleted_count?: number;
}

export interface GetLogParams {
  readonly path: string;
  readonly start?: number;
  readonly count?: number;
  readonly startDateTime?: string;
  readonly endDateTime?: string;
}

export interface StreamLogOptions {
  readonly start?: number;
  readonly count?: number;
  readonly startDateTime?: string;
  readonly endDateTime?: string;
}

export interface GetLogResult {
  commits: LogCommit[];
  hasMore: boolean;
  // Absolute offset (from the branch head, newest first) of the first emitted
  // commit, echoed by the server's TerminusDB-Log-Start header. Lets callers
  // keep paging with plain `start` after anchoring a window by datetime.
  resolvedStart?: number;
}

export async function streamLog(
  baseUrl: string,
  path: string,
  options: StreamLogOptions,
  credentials: string | null,
  signal: AbortSignal | undefined,
  onCommit?: (commit: LogCommit) => void,
): Promise<GetLogResult> {
  const params = new URLSearchParams();
  // start, startDateTime and endDateTime are mutually exclusive server-side.
  if (options.startDateTime) {
    params.set("startDateTime", options.startDateTime);
  } else if (options.endDateTime) {
    params.set("endDateTime", options.endDateTime);
  } else {
    params.set("start", String(options.start ?? 0));
  }
  if (options.count != null) {
    params.set("count", String(options.count));
  }
  params.set("stream", "true");
  params.set("with_counts", "true");
  const url = `${baseUrl}/api/log/${path}?${params.toString()}`;
  const headers: Record<string, string> = {
    Accept: "application/x-ndjson",
  };
  if (credentials) {
    headers.Authorization = `Basic ${credentials}`;
  }

  const res = await fetch(url, { headers, signal });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body}`);
  }
  if (!res.body) {
    throw new Error("No response body");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const commits: LogCommit[] = [];
  const processLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      const obj = JSON.parse(trimmed) as LogCommit;
      if (obj.identifier) {
        commits.push(obj);
        onCommit?.(obj);
      }
    } catch {
      // skip malformed lines
    }
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        processLine(line);
      }
    }
    if (buffer.trim()) {
      processLine(buffer);
    }
  } finally {
    reader.cancel().catch(() => {});
  }

  const count = options.count ?? -1;
  const reachedEnd = count >= 0 && commits.length < count;
  const headerStart = res.headers.get("TerminusDB-Log-Start");
  const resolvedStart = headerStart != null && headerStart !== ""
    ? Number(headerStart)
    : options.start;
  return { commits, hasMore: !reachedEnd, resolvedStart };
}

export const logApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getLog: builder.query<GetLogResult, GetLogParams>({
      queryFn: (params, api) => {
        const state = api.getState() as { auth: { credentials: string | null } };
        const credentials = state.auth.credentials;
        const cacheKey = JSON.stringify(params);

        // If a stream is already running for these params, don't start another.
        // The existing stream's updateQueryData calls will keep the cache updated.
        if (!activeStreams.has(cacheKey)) {
          activeStreams.add(cacheKey);
          streamLog(
            config.apiUrl,
            params.path,
            {
              start: params.start ?? 0,
              count: params.count ?? 100,
              startDateTime: params.startDateTime,
              endDateTime: params.endDateTime,
            },
            credentials,
            api.signal,
            (commit) => {
              api.dispatch(
                logApi.util.updateQueryData("getLog", params, (draft) => {
                  draft.commits.push(commit);
                }),
              );
            },
          ).then(
            (final) => {
              activeStreams.delete(cacheKey);
              api.dispatch(
                logApi.util.updateQueryData("getLog", params, (draft) => {
                  draft.commits = final.commits;
                  draft.hasMore = final.hasMore;
                  draft.resolvedStart = final.resolvedStart;
                }),
              );
            },
          ).catch((error) => {
            activeStreams.delete(cacheKey);
            if (error instanceof DOMException && error.name === "AbortError") return;
            api.dispatch(
              logApi.util.updateQueryData("getLog", params, (draft) => {
                draft.hasMore = false;
              }),
            );
            console.error("Stream log error:", error);
          });
        }

        // Return initial empty data immediately so the cache entry exists
        // and the UI can render incrementally as commits arrive.
        return { data: { commits: [], hasMore: true } };
      },
      providesTags: ["Database"],
    }),
  }),
});

export const { useGetLogQuery, useLazyGetLogQuery } = logApi;
