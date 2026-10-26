import React, { useState, useCallback, useMemo, useEffect } from "react";
import { normalizeDocId } from "@/utils/validation";
import { useNavigate, useSearchParams, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAppSelector, useAppDispatch, appendExtraCommits, prependNewerCommits, clearLogPagination, selectLogPagination } from "@/store";
import { config } from "@/config";
import { useRouteParams, PageShell, PageHeader, btnSecondary } from "@/components";
import { useCommitChanges } from "@/hooks/useCommitChanges";
import { useGetLogQuery, streamLog, type LogCommit } from "@/store/api/logApi";
import { formatTimestampNanos } from "@/utils/datetime";

const INITIAL_COUNT = 100;
const LOAD_MORE_COUNT = 100;
const LOAD_NEWER_COUNT = 10;

export const BranchHistoryPage: React.FC = () => {
  const { t } = useTranslation();
  const routeParams = useRouteParams();
  const navigate = useNavigate();
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

  const logPath = org && team ? `${org}/${team}/local/branch/${branchName}` : null;

  // Window anchor: `startDateTime` jumps the window mid-history server-side;
  // `windowStart` is the resolved absolute offset (0 = head) echoed back via
  // the TerminusDB-Log-Start header.
  const [anchorIso, setAnchorIso] = useState<string | null>(null);
  const [windowStart, setWindowStart] = useState(0);
  const [dateValue, setDateValue] = useState("");

  // Initial page load via RTK Query (auto-fetches when logPath changes).
  // Fetch INITIAL_COUNT + 1: the extra commit is a probe — its presence
  // means more remain; it is never rendered. `start` and `startDateTime`
  // are mutually exclusive server-side, so only one is ever sent.
  const { data: initialData, isLoading: initialLoading, error: initialError } = useGetLogQuery(
    anchorIso
      ? { path: logPath ?? "", count: INITIAL_COUNT + 1, startDateTime: anchorIso }
      : { path: logPath ?? "", start: 0, count: INITIAL_COUNT + 1 },
    { skip: !logPath },
  );

  // Adopt the resolved offset once the stream finishes — it is where the
  // window's top commit actually sits in newest-to-oldest order.
  useEffect(() => {
    if (initialData?.resolvedStart != null) {
      setWindowStart(initialData.resolvedStart);
    }
  }, [initialData?.resolvedStart]);

  const dispatch = useAppDispatch();
  const credentials = useAppSelector((state) => state.auth.credentials);
  const rawPagination = useAppSelector((state) => logPath ? selectLogPagination(state, logPath) : null);
  // The stored window may belong to a different start offset than the one
  // currently queried (e.g. right after a date jump before the first append).
  const pagination = rawPagination && rawPagination.start === windowStart
    ? rawPagination
    : { start: windowStart, extraCommits: [], newerCommits: [], fetched: 0, loadedAll: false };
  const extraCommits = pagination.extraCommits;
  const newerCommits = pagination.newerCommits;
  const loadedAll = pagination.loadedAll;
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingNewer, setLoadingNewer] = useState(false);
  const [expandedCommits, setExpandedCommits] = useState<Set<string>>(new Set());

  const { changesCache, loadingIds, fetchChanges } = useCommitChanges(org, team);

  // Live commit stream from Redux — new commits are prepended by the stream.
  // Each live commit shifts every existing commit's offset from head by one.
  const liveCommits = useAppSelector((state) => state.commitStream.history);
  const liveLen = liveCommits.length;

  const toggleExpand = useCallback(
    (commitId: string) => {
      setExpandedCommits((prev) => {
        const next = new Set(prev);
        if (next.has(commitId)) {
          next.delete(commitId);
        } else {
          next.add(commitId);
          void fetchChanges(commitId);
        }
        return next;
      });
    },
    [fetchChanges],
  );

  const loadMore = useCallback(
    async (count: number) => {
      if (!logPath) return;
      // Absolute offset: anchor + live shift + raw fetched below the anchor
      // (incl. the dropped +1 probe), not just the displayed ones.
      const start = windowStart + liveLen + (initialData?.commits.length ?? 0) + pagination.fetched;
      setLoadingMore(true);
      try {
        const result = await streamLog(
          config.apiUrl,
          logPath,
          { start, count: count === -1 ? -1 : count + 1 },
          credentials,
          undefined,
        );
        const hasMore = count !== -1 && result.commits.length > count;
        const visible = count === -1 ? result.commits : result.commits.slice(0, count);
        dispatch(appendExtraCommits({ logPath, start: windowStart, commits: visible, fetched: result.commits.length, loadedAll: !hasMore }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("Failed to load more commits:", msg);
      } finally {
        setLoadingMore(false);
      }
    },
    [logPath, windowStart, liveLen, initialData, pagination.fetched, dispatch, credentials],
  );

  const handleLoadMore = () => {
    void loadMore(LOAD_MORE_COUNT);
  };

  const handleLoadAll = () => {
    void loadMore(-1);
  };

  // Extend the window upward: fetch the commits sitting between the live/
  // previously-prepended edge and the window's top, newest first.
  const loadNewer = useCallback(
    async () => {
      if (!logPath) return;
      const topOffset = windowStart + liveLen - newerCommits.length;
      const count = Math.min(LOAD_NEWER_COUNT, topOffset);
      if (count <= 0) return;
      setLoadingNewer(true);
      try {
        const result = await streamLog(
          config.apiUrl,
          logPath,
          { start: topOffset - count, count },
          credentials,
          undefined,
        );
        dispatch(prependNewerCommits({ logPath, start: windowStart, commits: result.commits }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("Failed to load newer commits:", msg);
      } finally {
        setLoadingNewer(false);
      }
    },
    [logPath, windowStart, liveLen, newerCommits.length, dispatch, credentials],
  );

  const handleDateJump = () => {
    if (!logPath || !dateValue) return;
    const iso = new Date(dateValue).toISOString();
    if (logPath) dispatch(clearLogPagination(logPath));
    setWindowStart(0);
    setAnchorIso(iso);
  };

  const handleBackToHead = () => {
    if (logPath) dispatch(clearLogPagination(logPath));
    setWindowStart(0);
    setDateValue("");
    setAnchorIso(null);
  };

  // Merge: live stream commits first, then any newer-than-anchor commits
  // loaded via "Load newer", then the window (initial + extra pages).
  // Live commits already rendered above are dropped from newerCommits;
  // the initial fetch's (count+1)th probe commit is sliced off — it only
  // signals that more pages exist.
  const allCommits = useMemo(() => {
    const liveIds = new Set(liveCommits.map((c) => c.id));
    const newer = newerCommits.filter((c) => !liveIds.has(c.identifier));
    return [...newer, ...(initialData?.commits.slice(0, INITIAL_COUNT) ?? []), ...extraCommits];
  }, [initialData, extraCommits, newerCommits, liveCommits]);

  const mergedCommits = useMemo(() => {
    const logIds = new Set(allCommits.map((c) => c.identifier));
    const newLive = liveCommits.filter((c) => !logIds.has(c.id));
    const liveMapped: LogCommit[] = newLive.map((c) => ({
      identifier: c.id,
      timestamp: c.timestamp,
      author: c.author,
      message: c.message,
      added_count: c.added_count,
      changed_count: c.changed_count,
      deleted_count: c.deleted_count,
    }));
    return [...liveMapped, ...allCommits];
  }, [allCommits, liveCommits]);

  const initialHasMore = (initialData?.commits.length ?? 0) > INITIAL_COUNT;
  const moreAvailable = extraCommits.length === 0 ? initialHasMore : !loadedAll;
  // Commits newer than the window's current top exist whenever the resolved
  // offset (shifted by live arrivals) still exceeds what we've prepended.
  const newerAvailable = windowStart + liveLen - newerCommits.length > 0;
  const isStreaming = initialData != null && initialData.commits.length === 0 && (initialData?.hasMore ?? false);
  const loading = initialLoading || isStreaming || loadingMore || loadingNewer;
  const error = initialError
    ? (initialError instanceof Error ? initialError.message : "Failed to load commit history")
    : null;

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
            <h1 className="text-lg font-semibold text-gray-900">{t("branchHistory.title")}</h1>
            <p className="text-sm text-gray-500">
              {org}/{team} — {t("branchHistory.branch")} {branchName}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="datetime-local"
              step={0.001}
              value={dateValue}
              onChange={(e) => setDateValue(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-700 focus:border-dfrntBlue-500 focus:outline-none"
              aria-label={t("branchHistory.jumpToDate")}
            />
            <button
              type="button"
              onClick={handleDateJump}
              disabled={!dateValue}
              className={btnSecondary}
            >
              {t("branchHistory.jumpToDate")}
            </button>
            {anchorIso && (
              <button
                type="button"
                onClick={handleBackToHead}
                className={btnSecondary}
              >
                {t("branchHistory.backToHead")}
              </button>
            )}
          </div>
          {currentCommitId && (
            <button
              type="button"
              onClick={navigateToBranchHistory}
              className={btnSecondary}
              title={t("branchHistory.backToBranch", { branch: branchName })}
            >
              {t("branchHistory.backToBranchButton")}
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
          <p className="text-sm text-gray-400">{t("branchHistory.loadingCommits")}</p>
        ) : mergedCommits.length === 0 && !error ? (
          <p className="text-sm text-gray-400">{t("branchHistory.noCommitsFound")}</p>
        ) : (
          <>
            <div className="mb-3 text-xs text-gray-500">
              {t("branchHistory.showingCommits", { count: mergedCommits.length })}
              {anchorIso && <span className="ml-2 text-dfrntBlue-600">— {t("branchHistory.anchoredAt", { date: new Date(anchorIso).toLocaleString() })}</span>}
              {currentCommitId && <span className="ml-2 text-amber-600">— {t("branchHistory.viewingCommit", { id: currentCommitId.slice(0, 12) })}</span>}
            </div>

            {/* Load newer — shown while commits exist above the window's top */}
            {newerAvailable && (
              <div className="mb-4 flex items-center gap-3 border-b border-gray-200 pb-4">
                <button
                  type="button"
                  onClick={() => void loadNewer()}
                  disabled={loading}
                  className={btnSecondary}
                >
                  {loadingNewer ? t("common.loading") : t("branchHistory.loadNewer", { count: Math.min(LOAD_NEWER_COUNT, windowStart + liveLen - newerCommits.length) })}
                </button>
              </div>
            )}

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
                          onClick={() => toggleExpand(entry.identifier)}
                          className="flex h-5 w-5 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                          aria-label={expandedCommits.has(entry.identifier) ? "Collapse" : "Expand"}
                        >
                          <svg
                            className={`h-3 w-3 transition-transform ${expandedCommits.has(entry.identifier) ? "rotate-90" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            strokeWidth={2}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => navigateToCommit(entry.identifier)}
                          className={`rounded px-1.5 py-0.5 text-xs font-mono ${
                            isCurrent
                              ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                              : "bg-gray-100 text-gray-700 hover:bg-dfrntBlue-50 hover:text-dfrntBlue-700"
                          }`}
                          title={t("branchHistory.viewDataAtCommit", { id: entry.identifier.slice(0, 12) })}
                        >
                          {entry.identifier.slice(0, 12)}
                        </button>
                        <span className="text-sm font-medium text-gray-900">
                          {entry.message || t("branchHistory.noMessage")}
                        </span>
                        {isCurrent && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                            {t("branchHistory.viewing")}
                          </span>
                        )}
                        {isLatest && !isCurrent && (
                          <button
                            type="button"
                            onClick={navigateToBranch}
                            className="rounded-full bg-dfrntBlue-100 px-2 py-0.5 text-xs font-medium text-dfrntBlue-700 hover:bg-dfrntBlue-200"
                            title={t("branchHistory.goToBranchHead", { branch: branchName })}
                          >
                            {t("branchHistory.latest")}
                          </button>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                        <span className="font-medium text-gray-600">{entry.author}</span>
                        {entry.timestamp && <span className="tabular-nums">{formatTimestampNanos(entry.timestamp)}</span>}
                        {(entry.added_count != null || entry.changed_count != null || entry.deleted_count != null) && (
                          <span className="flex items-center gap-1.5">
                            {entry.added_count != null && entry.added_count > 0 && (
                              <span className="font-medium text-green-700">+{entry.added_count}</span>
                            )}
                            {entry.changed_count != null && entry.changed_count > 0 && (
                              <span className="font-medium text-amber-700">{entry.changed_count} changed</span>
                            )}
                            {entry.deleted_count != null && entry.deleted_count > 0 && (
                              <span className="font-medium text-red-700">-{entry.deleted_count}</span>
                            )}
                          </span>
                        )}
                      </div>
                      {expandedCommits.has(entry.identifier) && (
                        <CommitChangesPanel
                          commitId={entry.identifier}
                          parentCommitId={entry.parent?.replace("ValidCommit/", "")}
                          org={org}
                          team={team}
                          changes={changesCache[entry.identifier]}
                          loading={loadingIds.has(entry.identifier)}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Load more / Load all — hidden when every commit is loaded */}
            {moreAvailable && (
              <div className="mt-4 flex items-center gap-3 border-t border-gray-200 pt-4">
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={loading}
                  className={btnSecondary}
                >
                  {loading ? t("common.loading") : t("branchHistory.loadMore", { count: LOAD_MORE_COUNT })}
                </button>
                <button
                  type="button"
                  onClick={handleLoadAll}
                  disabled={loading}
                  className={btnSecondary}
                >
                  {loading ? t("common.loading") : t("branchHistory.loadAll")}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </PageShell>
  );
};

function shortenId(id: string): string {
  const parts = id.split("/");
  if (parts.length >= 2) {
    return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
  }
  return id;
}

const CommitChangesPanel: React.FC<{
  commitId: string;
  parentCommitId?: string;
  org: string;
  team: string;
  changes?: { added: readonly string[]; changed: readonly string[]; deleted: readonly string[] };
  loading: boolean;
}> = ({ commitId, parentCommitId, org, team, changes, loading }) => {
  const navigate = useNavigate();

  const goToDoc = (docId: string, useParent: boolean = false) => {
    const targetCommit = useParent && parentCommitId ? parentCommitId : commitId;
    const fullId = docId.startsWith("terminusdb:///") ? docId.replace("terminusdb:///data/", "") : docId;
    navigate(`/${org}/${team}/local/commit/${targetCommit}/documents?edit=${normalizeDocId(fullId)}`);
  };

  if (loading) {
    return (
      <div className="mt-2 ml-2 text-xs text-gray-400">
        Loading changes…
      </div>
    );
  }
  if (!changes) {
    return null;
  }
  const hasAny = changes.added.length > 0 || changes.changed.length > 0 || changes.deleted.length > 0;
  if (!hasAny) {
    return (
      <div className="mt-2 ml-2 text-xs text-gray-400">
        No document changes in this commit.
      </div>
    );
  }
  return (
    <div className="mt-2 ml-2 space-y-1 text-xs">
      {changes.added.length > 0 && (
        <div>
          <span className="font-medium text-green-700">Added ({changes.added.length})</span>
          <ul className="ml-4 list-disc text-gray-600">
            {changes.added.map((id) => (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => goToDoc(id)}
                  className="font-mono text-dfrntBlue-600 hover:underline"
                >
                  {shortenId(id)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {changes.changed.length > 0 && (
        <div>
          <span className="font-medium text-amber-700">Changed ({changes.changed.length})</span>
          <ul className="ml-4 list-disc text-gray-600">
            {changes.changed.map((id) => (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => goToDoc(id)}
                  className="font-mono text-dfrntBlue-600 hover:underline"
                >
                  {shortenId(id)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {changes.deleted.length > 0 && (
        <div>
          <span className="font-medium text-red-700">Deleted ({changes.deleted.length})</span>
          <ul className="ml-4 list-disc text-gray-600">
            {changes.deleted.map((id) => (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => goToDoc(id, true)}
                  className="font-mono text-dfrntBlue-600 hover:underline"
                  title="View at previous commit (document was deleted in this commit)"
                >
                  {shortenId(id)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
