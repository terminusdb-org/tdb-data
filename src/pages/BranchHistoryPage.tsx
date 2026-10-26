import React, { useState, useCallback, useMemo } from "react";
import { normalizeDocId } from "@/utils/validation";
import { useNavigate, useSearchParams, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAppSelector, useAppDispatch, appendExtraCommits, selectLogPagination } from "@/store";
import { config } from "@/config";
import { useRouteParams, PageShell, PageHeader, btnSecondary } from "@/components";
import { useCommitChanges } from "@/hooks/useCommitChanges";
import { useGetLogQuery, streamLog, type LogCommit } from "@/store/api/logApi";

function formatTimestamp(ts: string): string {
  const num = Number(ts);
  if (!Number.isNaN(num) && num > 0) {
    const date = new Date(num * 1000);
    return date.toLocaleString();
  }
  return ts;
}

const INITIAL_COUNT = 100;
const LOAD_MORE_COUNT = 100;

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

  // Initial page load via RTK Query (auto-fetches when logPath changes).
  // Fetch INITIAL_COUNT + 1: the extra commit is a probe — its presence
  // means more remain; it is never rendered.
  const { data: initialData, isLoading: initialLoading, error: initialError } = useGetLogQuery(
    { path: logPath ?? "", start: 0, count: INITIAL_COUNT + 1 },
    { skip: !logPath },
  );

  const dispatch = useAppDispatch();
  const credentials = useAppSelector((state) => state.auth.credentials);
  const pagination = useAppSelector((state) => logPath ? selectLogPagination(state, logPath) : { extraCommits: [], fetched: 0, loadedAll: false });
  const extraCommits = pagination.extraCommits;
  const loadedAll = pagination.loadedAll;
  const [loadingMore, setLoadingMore] = useState(false);
  const [expandedCommits, setExpandedCommits] = useState<Set<string>>(new Set());

  const { changesCache, loadingIds, fetchChanges } = useCommitChanges(org, team);

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
      // start must count raw fetched commits (incl. dropped +1 probes),
      // not just the displayed ones.
      const start = (initialData?.commits.length ?? 0) + pagination.fetched;
      setLoadingMore(true);
      try {
        const result = await streamLog(
          config.apiUrl,
          logPath,
          start,
          count === -1 ? -1 : count + 1,
          credentials,
          undefined,
        );
        const hasMore = count !== -1 && result.commits.length > count;
        const visible = count === -1 ? result.commits : result.commits.slice(0, count);
        dispatch(appendExtraCommits({ logPath, commits: visible, fetched: result.commits.length, loadedAll: !hasMore }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("Failed to load more commits:", msg);
      } finally {
        setLoadingMore(false);
      }
    },
    [logPath, initialData, pagination.fetched, dispatch, credentials],
  );

  const handleLoadMore = () => {
    void loadMore(LOAD_MORE_COUNT);
  };

  const handleLoadAll = () => {
    void loadMore(-1);
  };

  // Live commit stream from Redux — new commits are prepended by the stream
  const liveCommits = useAppSelector((state) => state.commitStream.history);

  // Merge: prepend live commits that aren't already in the log results.
  // The initial fetch's (count+1)th probe commit is sliced off — it only
  // signals that more pages exist.
  const allCommits = useMemo(() => {
    const base = [...(initialData?.commits.slice(0, INITIAL_COUNT) ?? []), ...extraCommits];
    return base;
  }, [initialData, extraCommits]);

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
  const isStreaming = initialData != null && initialData.commits.length === 0 && (initialData?.hasMore ?? false);
  const loading = initialLoading || isStreaming || loadingMore;
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
              {currentCommitId && <span className="ml-2 text-amber-600">— {t("branchHistory.viewingCommit", { id: currentCommitId.slice(0, 12) })}</span>}
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
                        {entry.timestamp && <span>{formatTimestamp(entry.timestamp)}</span>}
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
