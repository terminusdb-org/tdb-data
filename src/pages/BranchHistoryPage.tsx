import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { normalizeDocId } from "@/utils/validation";
import { useNavigate, useSearchParams, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAppSelector, useAppDispatch, appendExtraCommits, prependNewerCommits, clearLogPagination, selectLogPagination } from "@/store";
import { config } from "@/config";
import { useRouteParams, PageShell, PageHeader, btnSecondary } from "@/components";
import { useCommitChanges } from "@/hooks/useCommitChanges";
import { useGetLogQuery, streamLog, type LogCommit } from "@/store/api/logApi";
import { epochDecimalToIso, formatTimestampNanos, isoToLocalInput } from "@/utils/datetime";
import * as Slider from "@radix-ui/react-slider";

const INITIAL_COUNT = 100;
const LOAD_MORE_COUNT = 100;
const LOAD_NEWER_COUNT = 10;
const NEWER_POLL_MS = 15000;
const VIEW_COUNT = 50;

export const BranchHistoryPage: React.FC = () => {
  const { t } = useTranslation();
  const routeParams = useRouteParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
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

  // Window bounds live in the URL: `to` anchors the newest edge
  // (startDateTime) and `from` bounds the oldest edge (endDateTime). Every
  // navigational change writes the view configuration to the URL so it is
  // shareable and survives back/forward navigation.
  const anchorIso = searchParams.get("to");
  const endIso = searchParams.get("from");
  const [windowStart, setWindowStart] = useState(0);
  const [rangeError, setRangeError] = useState<string | null>(null);
  // Which window edge label is being edited in place, and its raw input.
  const [editEdge, setEditEdge] = useState<"oldest" | "newest" | null>(null);
  const [editValue, setEditValue] = useState("");

  // Initial page load via RTK Query (auto-fetches when logPath changes).
  // Fetch INITIAL_COUNT + 1: the extra commit is a probe — its presence
  // means more remain; it is never rendered. `start` and `startDateTime`
  // are mutually exclusive server-side, so only one is ever sent; the
  // endDateTime bottom bound combines with either.
  const { data: initialData, isLoading: initialLoading, error: initialError } = useGetLogQuery(
    anchorIso
      ? { path: logPath ?? "", count: INITIAL_COUNT + 1, startDateTime: anchorIso, endDateTime: endIso ?? undefined }
      : { path: logPath ?? "", start: 0, count: INITIAL_COUNT + 1, endDateTime: endIso ?? undefined },
    { skip: !logPath },
  );

  // Adopt the resolved offset once the stream finishes — it is where the
  // window's top commit actually sits in newest-to-oldest order.
  useEffect(() => {
    if (initialData?.resolvedStart != null) {
      setWindowStart(initialData.resolvedStart);
    }
  }, [initialData?.resolvedStart]);

  // A new window (branch or bounds change) resets paging state; the initial
  // mount keeps any stored pagination for this path.
  const dispatch = useAppDispatch();
  const boundsKey = `${logPath}|${anchorIso ?? ""}|${endIso ?? ""}`;
  const lastBoundsRef = useRef(boundsKey);
  useEffect(() => {
    if (lastBoundsRef.current === boundsKey) return;
    lastBoundsRef.current = boundsKey;
    if (logPath) dispatch(clearLogPagination(logPath));
    setWindowStart(0);
    setPollNewer(null);
  }, [boundsKey, logPath, dispatch]);

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
  const liveCommits = useAppSelector((state) => state.commitStream.history);
  // Commits newer than the window's top as last reported by the head poll,
  // plus the live-above-top count at that moment. The SSE stream can miss
  // or lag; polling head makes "Load newer" appear even when the stream is
  // quiet.
  const [pollNewer, setPollNewer] = useState<{ count: number; liveAtPoll: number } | null>(null);
  const liveAboveTopRef = useRef(0);
  const windowTopId = initialData?.commits[0]?.identifier;

  // Poll head for new commits — catches commits the SSE stream missed. The
  // count is how many head commits sit above the window's top commit.
  useEffect(() => {
    if (!logPath || !windowTopId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const result = await streamLog(
          config.apiUrl,
          logPath,
          { start: 0, count: LOAD_NEWER_COUNT },
          credentials,
          undefined,
        );
        if (!cancelled && result.commits.length > 0) {
          const idx = result.commits.findIndex((c) => c.identifier === windowTopId);
          setPollNewer({
            count: idx < 0 ? result.commits.length : idx,
            liveAtPoll: liveAboveTopRef.current,
          });
        }
      } catch {
        // Poll failures are silent — the stream and manual loads still work.
      }
    };
    void poll();
    const timer = setInterval(() => void poll(), NEWER_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [logPath, windowTopId, credentials]);

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

  // Offset bookkeeping. A commit "above the window top" is one the server
  // counts between head and the window's first commit — reported by the
  // live stream or by the head poll, minus ids already inside the window
  // (SSE replays the head commit on connect, which must not inflate the
  // count — the "Load 1 newer" phantom).
  const windowIds = useMemo(
    () => new Set([...(initialData?.commits ?? []), ...extraCommits].map((c) => c.identifier)),
    [initialData, extraCommits],
  );
  const liveIds = useMemo(() => new Set(liveCommits.map((c) => c.id)), [liveCommits]);
  const liveAboveTop = useMemo(
    () => liveCommits.filter((c) => !windowIds.has(c.id)).length,
    [liveCommits, windowIds],
  );
  useEffect(() => {
    liveAboveTopRef.current = liveAboveTop;
  }, [liveAboveTop]);
  // Commits above the window top now. The poll reports the true count at
  // poll time; live arrivals since then add to it. Before the first poll,
  // the resolved anchor offset shifted by live arrivals approximates it.
  const topAbs = pollNewer == null
    ? windowStart + liveAboveTop
    : pollNewer.count + Math.max(0, liveAboveTop - pollNewer.liveAtPoll);
  // Above-top commits not yet fetched: fetched ones are the newer pages plus
  // every live commit rendered above the window — subtracted from the
  // above-top total.
  const unfetchedNewer = Math.max(0, topAbs - liveAboveTop - newerCommits.length);

  const loadMore = useCallback(
    async (count: number) => {
      if (!logPath) return;
      // Absolute offset: anchor + live/poll shift + raw fetched below the
      // anchor (incl. the dropped +1 probe), not just the displayed ones.
      const start = topAbs + (initialData?.commits.length ?? 0) + pagination.fetched;
      setLoadingMore(true);
      try {
        const result = await streamLog(
          config.apiUrl,
          logPath,
          { start, count: count === -1 ? -1 : count + 1, endDateTime: endIso ?? undefined },
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
    [logPath, topAbs, endIso, initialData, pagination.fetched, dispatch, credentials],
  );

  const handleLoadMore = () => {
    void loadMore(LOAD_MORE_COUNT);
  };

  const handleLoadAll = () => {
    void loadMore(-1);
  };

  // Extend the window upward: fetch the commits sitting between the live/
  // previously-prepended edge and the window's top, newest first. The
  // unfetched band's bottom edge is at topAbs - newerCommits.length.
  const loadNewer = useCallback(
    async () => {
      if (!logPath) return;
      const bottom = topAbs - newerCommits.length;
      const count = Math.min(LOAD_NEWER_COUNT, unfetchedNewer);
      if (count <= 0) return;
      setLoadingNewer(true);
      try {
        const result = await streamLog(
          config.apiUrl,
          logPath,
          { start: bottom - count, count, endDateTime: endIso ?? undefined },
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
    [logPath, topAbs, endIso, newerCommits.length, unfetchedNewer, dispatch, credentials],
  );

  // Write the range bounds to the URL — every navigational change carries
  // the view configuration. `to` anchors the newest edge (startDateTime),
  // `from` bounds the oldest edge (endDateTime); unrelated params like
  // from-branch are preserved.
  const writeBounds = useCallback(
    (from: string | null, to: string | null) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (from) next.set("from", from); else next.delete("from");
        if (to) next.set("to", to); else next.delete("to");
        next.delete("w");
        next.delete("n");
        next.delete("wl");
        next.delete("wr");
        return next;
      });
    },
    [setSearchParams],
  );

  const clearRange = () => {
    setRangeError(null);
    writeBounds(null, null);
  };

  // Clicking a commit's date anchors the window's newest edge there.
  const jumpToTimestamp = (ts: string) => {
    const iso = epochDecimalToIso(ts);
    if (iso) writeBounds(endIso, iso);
  };

  // Merge: live stream commits first, then any newer-than-anchor commits
  // loaded via "Load newer", then the window (initial + extra pages).
  // Live commits already rendered above are dropped from newerCommits;
  // the initial fetch's (count+1)th probe commit is sliced off — it only
  // signals that more pages exist.
  const allCommits = useMemo(() => {
    const newer = newerCommits.filter((c) => !liveIds.has(c.identifier));
    return [...newer, ...(initialData?.commits.slice(0, INITIAL_COUNT) ?? []), ...extraCommits];
  }, [initialData, extraCommits, newerCommits, liveIds]);

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

  // Viewport window: the list renders only the slice [viewTop, viewTop +
  // viewCount) of the loaded commits. `w` carries the position and `n` the
  // size; both live in the URL so drags and pans are navigable state.
  // Overview axis: a linear time span over the loaded range — left is the
  // oldest loaded commit, right the newest. Each commit is a thin band at
  // its relative time position; band opacity encodes how many documents the
  // commit touched (log scale).
  const SLIDER_RES = 10000;
  const timeAxis = useMemo(() => {
    if (mergedCommits.length === 0) return null;
    const t1 = Number(mergedCommits[0].timestamp);
    const t0 = Number(mergedCommits[mergedCommits.length - 1].timestamp);
    const span = Math.max(t1 - t0, 1e-9);
    const docCount = (c: LogCommit) => (c.added_count ?? 0) + (c.changed_count ?? 0) + (c.deleted_count ?? 0);
    // Opacity: 1 document → 0.30, 10k documents → 1.0 (capped), log between.
    const alphaOf = (c: LogCommit) =>
      0.3 + (0.7 * Math.log10(Math.min(Math.max(docCount(c), 1), 10000))) / 4;
    return {
      t0,
      span,
      bands: mergedCommits.map((c) => ({
        pos: (Number(c.timestamp) - t0) / span,
        alpha: alphaOf(c),
      })),
    };
  }, [mergedCommits]);
  const timeOfPos = (v: number) => (timeAxis ? timeAxis.t0 + (v / SLIDER_RES) * timeAxis.span : 0);
  const posOfTime = (ts: number) => (timeAxis ? Math.round(((ts - timeAxis.t0) / timeAxis.span) * SLIDER_RES) : 0);
  const axisLo = timeAxis?.t0 ?? 0;
  const axisHi = timeAxis ? timeAxis.t0 + timeAxis.span : 0;

  // Viewport window: two free positions on the time axis — thumbs rest
  // anywhere, not on commit bands. `wl`/`wr` carry the oldest/newest edge
  // in decimal epoch seconds; the list shows loaded commits between them.
  // Defaults put the newest edge at the axis end and the oldest edge on the
  // VIEW_COUNT-th commit — the same 50-wide view as before.
  const defWr = axisHi;
  const defWl = mergedCommits.length
    ? Number(mergedCommits[Math.min(VIEW_COUNT - 1, mergedCommits.length - 1)].timestamp)
    : 0;
  const wlParam = Number(searchParams.get("wl"));
  const wrParam = Number(searchParams.get("wr"));
  const wlTs = wlParam > 0 ? wlParam : defWl;
  const wrTs = wrParam > 0 ? wrParam : defWr;
  // Thumb drags preview locally and commit to the URL on release — pushing
  // per-pointermove would flood the history stack.
  const [dragEdges, setDragEdges] = useState<{ wl: number; wr: number } | null>(null);
  const effWl = dragEdges?.wl ?? wlTs;
  const effWr = dragEdges?.wr ?? wrTs;
  const visibleCommits = mergedCommits.filter((c) => {
    const ts = Number(c.timestamp);
    return ts >= effWl && ts <= effWr;
  });

  const writeWindow = useCallback(
    (wl: number, wr: number) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete("w");
        next.delete("n");
        // Within half a slider tick of the default, drop the param — position
        // quantization shifts below that are representational noise.
        const tick = (timeAxis?.span ?? 0) / SLIDER_RES / 2;
        if (Math.abs(wl - defWl) > tick) next.set("wl", String(wl)); else next.delete("wl");
        if (Math.abs(wr - defWr) > tick) next.set("wr", String(wr)); else next.delete("wr");
        return next;
      });
    },
    [defWl, defWr, setSearchParams],
  );

  // Pan by one window width, clamped to the loaded axis.
  const panWindow = (newer: boolean) => {
    const w = effWr - effWl;
    const shift = Math.min(w, newer ? axisHi - effWr : effWl - axisLo);
    writeWindow(effWl + (newer ? shift : -shift), effWr + (newer ? shift : -shift));
  };

  // Edge label: local date/time lines plus the fraction (dropping a zero or
  // absent fraction — shown only where relevant).
  const edgeLabelParts = (ts: number) => {
    const d = new Date(ts * 1000);
    const p = (n: number) => String(n).padStart(2, "0");
    // Edge positions are continuous — shortest-repr digits, capped at
    // nanosecond precision, with trailing zeros stripped.
    const frac = (String(ts).split(".")[1] ?? "").slice(0, 9).replace(/0+$/, "");
    return {
      date: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`,
      time: `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`,
      frac: frac ? `.${frac}` : null,
    };
  };

  // Commit an edited edge label: inside the loaded range the edge moves to
  // that exact time (wl/wr); outside it becomes a fetch bound so the server
  // loads that edge. Order violations surface, never silently apply.
  const commitEdgeEdit = () => {
    const edge = editEdge;
    setEditEdge(null);
    if (!edge) return;
    const ms = Date.parse(editValue);
    if (Number.isNaN(ms)) {
      setRangeError(t("branchHistory.invalidDate"));
      return;
    }
    setRangeError(null);
    const ts = ms / 1000;
    const iso = new Date(ms).toISOString();
    if (timeAxis && ts >= axisLo && ts <= axisHi) {
      if (edge === "newest") {
        if (ts <= effWl) {
          setRangeError(t("branchHistory.rangeOrderError"));
          return;
        }
        writeWindow(effWl, ts);
      } else {
        if (ts >= effWr) {
          setRangeError(t("branchHistory.rangeOrderError"));
          return;
        }
        writeWindow(ts, effWr);
      }
      return;
    }
    if (edge === "newest") {
      if (endIso && endIso > iso) {
        setRangeError(t("branchHistory.rangeOrderError"));
        return;
      }
      writeBounds(endIso, iso);
    } else {
      if (anchorIso && iso > anchorIso) {
        setRangeError(t("branchHistory.rangeOrderError"));
        return;
      }
      writeBounds(iso, anchorIso);
    }
  };

  const initialHasMore = (initialData?.commits.length ?? 0) > INITIAL_COUNT;
  const moreAvailable = extraCommits.length === 0 ? initialHasMore : !loadedAll;
  // "Load newer" only while commits above the window top remain unfetched —
  // live-stream commits are already rendered, so they don't count.
  const newerAvailable = unfetchedNewer > 0;
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
          <div className="flex flex-wrap items-end gap-2">
            {(anchorIso || endIso) && (
              <button
                type="button"
                onClick={clearRange}
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
              {t("branchHistory.showingCommits", { count: `${visibleCommits.length}/${mergedCommits.length}` })}
              {endIso && <span className="ml-2 text-dfrntBlue-600">— {t("branchHistory.fromDate", { date: new Date(endIso).toLocaleString() })}</span>}
              {anchorIso && <span className="ml-2 text-dfrntBlue-600">— {t("branchHistory.untilDate", { date: new Date(anchorIso).toLocaleString() })}</span>}
              {currentCommitId && <span className="ml-2 text-amber-600">— {t("branchHistory.viewingCommit", { id: currentCommitId.slice(0, 12) })}</span>}
            </div>

            {/* Navigable time window: overview of the loaded range. Left is
                newest, right is oldest; the highlighted span is the slice the
                list shows. Pagination controls are navigation next to it. */}
            {mergedCommits.length > 0 && (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                {newerAvailable && (
                  <button
                    type="button"
                    onClick={() => void loadNewer()}
                    disabled={loading}
                    className={btnSecondary}
                  >
                    {loadingNewer ? t("common.loading") : t("branchHistory.loadNewer", { count: Math.min(LOAD_NEWER_COUNT, unfetchedNewer) })}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => panWindow(false)}
                  disabled={effWl <= axisLo}
                  className={btnSecondary}
                  title={t("branchHistory.panOlder")}
                >
                  ‹
                </button>
                <div className="min-w-32 flex-1 pt-11">
                  <div className="relative">
                    {/* Edge labels float above their thumbs — stacked
                        date/time/fraction keeps them narrow; click edits the
                        edge in place. */}
                    {(["oldest", "newest"] as const).map((edge) => {
                      if (!timeAxis) return null;
                      const edgeTs = edge === "oldest" ? effWl : effWr;
                      const pos = ((edgeTs - timeAxis.t0) / timeAxis.span) * 100;
                      const parts = edgeLabelParts(edgeTs);
                      return (
                        <div
                          key={edge}
                          className="absolute -top-11 z-10"
                          style={{ left: `${pos}%`, transform: pos > 55 ? "translateX(-100%)" : undefined }}
                        >
                          {editEdge === edge ? (
                            <input
                              autoFocus
                              type="datetime-local"
                              step={0.001}
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={commitEdgeEdit}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") commitEdgeEdit();
                                if (e.key === "Escape") setEditEdge(null);
                              }}
                              className="w-40 rounded border border-dfrntBlue-300 px-1 py-0.5 text-[10px] text-gray-700 focus:outline-none"
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setEditEdge(edge);
                                setEditValue(isoToLocalInput(new Date(edgeTs * 1000).toISOString()));
                              }}
                              className="block text-left text-[9px] leading-tight text-gray-500 hover:text-dfrntBlue-700"
                              title={t("branchHistory.editEdge")}
                            >
                              <span className="block whitespace-nowrap">{parts.date}</span>
                              <span className="block whitespace-nowrap tabular-nums">{parts.time}</span>
                              {parts.frac && (
                                <span className="block whitespace-nowrap tabular-nums text-gray-400">{parts.frac}</span>
                              )}
                            </button>
                          )}
                        </div>
                      );
                    })}
                    <Slider.Root
                    className="relative flex h-5 touch-none select-none items-center"
                    min={0}
                    max={SLIDER_RES}
                    step={1}
                    minStepsBetweenThumbs={1}
                    value={[posOfTime(effWl), posOfTime(effWr)]}
                    onValueChange={([lo, hi]) =>
                      setDragEdges({ wl: timeOfPos(lo), wr: timeOfPos(hi) })
                    }
                    onValueCommit={([lo, hi]) => {
                      setDragEdges(null);
                      writeWindow(timeOfPos(lo), timeOfPos(hi));
                    }}
                  >
                    <Slider.Track className="relative h-full grow overflow-hidden rounded border border-gray-200 bg-gray-100">
                      <Slider.Range className="absolute h-full bg-dfrntBlue-300/30" />
                      {timeAxis?.bands.map((band, i) => {
                        const ts = Number(mergedCommits[i].timestamp);
                        const inWindow = ts >= effWl && ts <= effWr;
                        return (
                          <div
                            key={mergedCommits[i].identifier}
                            className={`absolute top-0 bottom-0 w-0.5 ${inWindow ? "bg-dfrntBlue-500" : "bg-gray-400"}`}
                            style={{ left: `${band.pos * 100}%`, opacity: band.alpha }}
                          />
                        );
                      })}
                    </Slider.Track>
                    <Slider.Thumb
                      className="block h-5 w-1.5 cursor-ew-resize rounded-sm bg-dfrntBlue-600 hover:bg-dfrntBlue-700 focus:outline-none focus:ring-2 focus:ring-dfrntBlue-400"
                      aria-label={t("branchHistory.windowOldest")}
                    />
                    <Slider.Thumb
                      className="block h-5 w-1.5 cursor-ew-resize rounded-sm bg-dfrntBlue-600 hover:bg-dfrntBlue-700 focus:outline-none focus:ring-2 focus:ring-dfrntBlue-400"
                      aria-label={t("branchHistory.windowNewest")}
                    />
                    </Slider.Root>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2 text-[10px] text-gray-400">
                    <span className="tabular-nums">{mergedCommits[mergedCommits.length - 1] ? formatTimestampNanos(mergedCommits[mergedCommits.length - 1].timestamp) : ""}</span>
                    <span>{t("branchHistory.windowCount", { count: visibleCommits.length, total: mergedCommits.length })}</span>
                    <span className="tabular-nums">{mergedCommits[0] ? formatTimestampNanos(mergedCommits[0].timestamp) : ""}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => panWindow(true)}
                  disabled={effWr >= axisHi}
                  className={btnSecondary}
                  title={t("branchHistory.panNewer")}
                >
                  ›
                </button>
                {rangeError && <span className="text-xs text-red-600">{rangeError}</span>}
                {moreAvailable && (
                  <>
                    <button
                      type="button"
                      onClick={handleLoadMore}
                      disabled={loading}
                      className={btnSecondary}
                    >
                      {loadingMore ? t("common.loading") : t("branchHistory.loadMore", { count: LOAD_MORE_COUNT })}
                    </button>
                    <button
                      type="button"
                      onClick={handleLoadAll}
                      disabled={loading}
                      className={btnSecondary}
                    >
                      {loading ? t("common.loading") : t("branchHistory.loadAll")}
                    </button>
                  </>
                )}
              </div>
            )}

            <div className="space-y-0">
              {visibleCommits.map((entry, idx) => {
                const isLatest = entry.identifier === mergedCommits[0]?.identifier;
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
                      {idx < visibleCommits.length - 1 && (
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
                        {entry.timestamp && (
                          <button
                            type="button"
                            onClick={() => jumpToTimestamp(entry.timestamp)}
                            className="tabular-nums hover:text-dfrntBlue-700 hover:underline"
                            title={t("branchHistory.jumpToThisDate")}
                          >
                            {formatTimestampNanos(entry.timestamp)}
                          </button>
                        )}
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

            {/* Below-the-window hint when the viewport doesn't reach the
                loaded tail — pan or widen via the window controls above. */}
            {mergedCommits.some((c) => Number(c.timestamp) < effWl) && (
              <div className="mt-4 border-t border-gray-200 pt-3 text-xs text-gray-400">
                {t("branchHistory.belowWindow", { count: mergedCommits.filter((c) => Number(c.timestamp) < effWl).length })}
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
