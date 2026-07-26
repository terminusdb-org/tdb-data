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
}

export interface GetLogResult {
  commits: LogCommit[];
  hasMore: boolean;
}

export async function streamLog(
  baseUrl: string,
  path: string,
  start: number,
  count: number,
  credentials: string | null,
  signal: AbortSignal | undefined,
  onCommit?: (commit: LogCommit) => void,
): Promise<GetLogResult> {
  const url = `${baseUrl}/api/log/${path}?start=${start}&count=${count}&stream=true&with_counts=true`;
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

  const reachedEnd = count >= 0 && commits.length < count;
  return { commits, hasMore: !reachedEnd };
}

export const logApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getLog: builder.query<GetLogResult, GetLogParams>({
      queryFn: (params, api) => {
        const state = api.getState() as { auth: { credentials: string | null } };
        const credentials = state.auth.credentials;
        const start = params.start ?? 0;
        const count = params.count ?? 100;
        const cacheKey = JSON.stringify(params);

        // If a stream is already running for these params, don't start another.
        // The existing stream's updateQueryData calls will keep the cache updated.
        if (!activeStreams.has(cacheKey)) {
          activeStreams.add(cacheKey);
          streamLog(
            config.apiUrl,
            params.path,
            start,
            count,
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
