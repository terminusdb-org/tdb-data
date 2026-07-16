import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams, useParams } from "react-router-dom";
import { useAppSelector } from "@/store";
import { useRouteParams, PageShell, PageHeader, btnSecondary } from "@/components";
import { config } from "@/config";

interface LogCommit {
  readonly identifier: string;
  readonly timestamp: string;
  readonly author: string;
  readonly message: string;
}

function formatTimestamp(ts: string): string {
  const num = Number(ts);
  if (!Number.isNaN(num) && num > 0) {
    const date = new Date(num * 1000);
    return date.toLocaleString();
  }
  return ts;
}

const INITIAL_COUNT = 1000;
const LOAD_MORE_COUNT = 1000;

export const BranchHistoryPage: React.FC = () => {
  const routeParams = useRouteParams();
  const navigate = useNavigate();
  const credentials = useAppSelector((state) => state.auth.credentials);
  const [searchParams] = useSearchParams();
  const urlParams = useParams();

  // The branch we're showing history for. When on a branch URL, it's the branch
  // name. When on a commit URL, it comes from the `from-branch` query param.
  const org = routeParams?.org ?? "";
  const team = routeParams?.team ?? "";
  const branchName = routeParams?.refType === "branch"
    ? routeParams.refName
    : (searchParams.get("from-branch") ?? "main");
  const currentCommitId = urlParams.commitId ?? null;

  const [commits, setCommits] = useState<LogCommit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadedAll, setLoadedAll] = useState(false);
  const [currentCount, setCurrentCount] = useState(INITIAL_COUNT);

  // Always fetch log from the branch, not from the commit descriptor.
  // The commit history is the same regardless of which commit we're viewing.
  const buildLogPath = useCallback(() => {
    if (!org || !team) return null;
    return `${org}/${team}/local/branch/${branchName}`;
  }, [org, team, branchName]);

  const fetchCommits = useCallback(async (count: number, isInitialLoad: boolean = true) => {
    const logPath = buildLogPath();
    if (!logPath) return;

    setLoading(true);
    if (isInitialLoad) {
      setCommits([]);
      setError(null);
    }
    try {
      const url = `${config.apiUrl}/api/log/${logPath}?start=0&count=${count}&stream=true`;
      const headers: Record<string, string> = {
        Accept: "application/x-ndjson",
      };
      if (credentials) {
        headers.Authorization = `Basic ${credentials}`;
      }
      const res = await fetch(url, { headers });
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
      const collected: LogCommit[] = [];
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
            const obj = JSON.parse(trimmed) as LogCommit;
            if (obj.identifier) {
              collected.push(obj);
            }
          } catch {
            // skip malformed lines
          }
        }
        // Update state incrementally as commits arrive
        setCommits([...collected]);
      }
      // Process any remaining buffered data
      if (buffer.trim()) {
        try {
          const obj = JSON.parse(buffer.trim()) as LogCommit;
          if (obj.identifier) {
            collected.push(obj);
            setCommits([...collected]);
          }
        } catch {
          // skip
        }
      }
      setHasMore(collected.length >= count);
      setLoadedAll(collected.length < count);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [buildLogPath, credentials]);

  // Only refetch when org/team/branchName changes — NOT when commitId changes.
  // The history is always the branch history; switching commits just changes
  // which one is highlighted.
  useEffect(() => {
    setCommits([]);
    setHasMore(false);
    setLoadedAll(false);
    setCurrentCount(INITIAL_COUNT);
    fetchCommits(INITIAL_COUNT);
  }, [fetchCommits, org, team, branchName]);

  const handleLoadMore = () => {
    const nextCount = currentCount + LOAD_MORE_COUNT;
    setCurrentCount(nextCount);
    fetchCommits(nextCount, false);
  };

  const handleLoadAll = () => {
    // count=-1 means all in the API
    fetchCommits(-1, false);
  };

  // Live commit stream from Redux — new commits are prepended by the stream
  const liveCommits = useAppSelector((state) => state.commitStream.history);

  // Merge: prepend live commits that aren't already in the log results
  const mergedCommits = useMemo(() => {
    const logIds = new Set(commits.map((c) => c.identifier));
    const newLive = liveCommits.filter((c) => !logIds.has(c.id));
    const liveMapped: LogCommit[] = newLive.map((c) => ({
      identifier: c.id,
      timestamp: c.timestamp,
      author: c.author,
      message: c.message,
    }));
    return [...liveMapped, ...commits];
  }, [commits, liveCommits]);

  // Navigate to a commit while staying on the history page.
  // Include from-branch so the history page knows which branch to show.
  const navigateToCommit = (commitId: string) => {
    if (!routeParams) return;
    navigate(`/${routeParams.org}/${routeParams.team}/local/commit/${commitId}/history?from-branch=${branchName}`);
  };

  // Navigate back to the branch (head).
  const navigateToBranch = () => {
    if (!routeParams) return;
    navigate(`/${routeParams.org}/${routeParams.team}/local/branch/${branchName}`);
  };

  // Navigate to the branch history (head history).
  const navigateToBranchHistory = () => {
    if (!routeParams) return;
    navigate(`/${routeParams.org}/${routeParams.team}/local/branch/${branchName}/history`);
  };

  return (
    <PageShell>
      <PageHeader>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Commit History</h1>
            <p className="text-sm text-gray-500">
              {org}/{team} — branch {branchName}
            </p>
          </div>
          {currentCommitId && (
            <button
              type="button"
              onClick={navigateToBranchHistory}
              className={btnSecondary}
              title={`Back to branch ${branchName} history`}
            >
              Back to branch
            </button>
          )}
        </div>
      </PageHeader>
      <div className="px-6 py-4">
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {loading && mergedCommits.length === 0 ? (
          <p className="text-sm text-gray-400">Loading commits…</p>
        ) : mergedCommits.length === 0 && !error ? (
          <p className="text-sm text-gray-400">No commits found.</p>
        ) : (
          <>
            <div className="mb-3 text-xs text-gray-500">
              Showing {mergedCommits.length} commit{mergedCommits.length !== 1 ? "s" : ""} (newest first)
              {currentCommitId && <span className="ml-2 text-amber-600">— viewing commit {currentCommitId.slice(0, 12)}</span>}
            </div>
            <div className="space-y-0">
              {mergedCommits.map((entry, idx) => {
                const isLatest = idx === 0;
                const isCurrent = currentCommitId === entry.identifier;
                return (
                  <div key={entry.identifier} className="relative flex gap-4 pb-6">
                    {/* Timeline line and dot */}
                    <div className="flex flex-col items-center">
                      <div
                        className={`mt-1 h-3 w-3 rounded-full border-2 ${
                          isCurrent ? "border-amber-500 bg-amber-100" : isLatest ? "border-dfrntBlue-500 bg-dfrntBlue-100" : "border-gray-300 bg-white"
                        }`}
                      />
                      {idx < mergedCommits.length - 1 && (
                        <div className="mt-1 w-0.5 flex-1 bg-gray-200" />
                      )}
                    </div>

                    {/* Commit content */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => navigateToCommit(entry.identifier)}
                          className={`rounded px-1.5 py-0.5 text-xs font-mono ${
                            isCurrent
                              ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                              : "bg-gray-100 text-gray-700 hover:bg-dfrntBlue-50 hover:text-dfrntBlue-700"
                          }`}
                          title={`View data at commit ${entry.identifier.slice(0, 12)}`}
                        >
                          {entry.identifier.slice(0, 12)}
                        </button>
                        <span className="text-sm font-medium text-gray-900">
                          {entry.message || "(no message)"}
                        </span>
                        {isCurrent && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                            viewing
                          </span>
                        )}
                        {isLatest && !isCurrent && (
                          <button
                            type="button"
                            onClick={navigateToBranch}
                            className="rounded-full bg-dfrntBlue-100 px-2 py-0.5 text-xs font-medium text-dfrntBlue-700 hover:bg-dfrntBlue-200"
                            title={`Go to branch ${branchName} head`}
                          >
                            latest
                          </button>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                        <span className="font-medium text-gray-600">{entry.author}</span>
                        {entry.timestamp && <span>{formatTimestamp(entry.timestamp)}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Load more / Load all */}
            {!loadedAll && (
              <div className="mt-4 flex items-center gap-3 border-t border-gray-200 pt-4">
                {hasMore && (
                  <button
                    type="button"
                    onClick={handleLoadMore}
                    disabled={loading}
                    className={btnSecondary}
                  >
                    {loading ? "Loading…" : `Load ${LOAD_MORE_COUNT} more`}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleLoadAll}
                  disabled={loading}
                  className={btnSecondary}
                >
                  {loading ? "Loading…" : "Load all"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </PageShell>
  );
};
