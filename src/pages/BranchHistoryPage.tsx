import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { normalizeDocId } from "@/utils/validation";
import { useNavigate, useSearchParams, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAppSelector, useAppDispatch, appendExtraCommits, prependNewerCommits, clearLogPagination, selectLogPagination } from "@/store";
import { config } from "@/config";
import { useRouteParams, PageShell, PageHeader, btnSecondary } from "@/components";
import { useCommitChanges } from "@/hooks/useCommitChanges";
import { useGetLogQuery, streamLog, type LogCommit } from "@/store/api/logApi";
import { epochDecimalToIso, formatTimestampNanos, isoToEpochDecimal, isoToLocalInput } from "@/utils/datetime";
import * as Slider from "@radix-ui/react-slider";

const INITIAL_COUNT = 100;
const LOAD_MORE_COUNT = 100;
const LOAD_NEWER_COUNT = 10;
const NEWER_POLL_MS = 15000;
const VIEW_COUNT = 50;

// Shared small icon button — a visible affordance: border + shadow at
// rest, colour shift on hover, ring on focus.
const iconBtn =
  "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-400 shadow-sm transition-colors hover:border-dfrntBlue-300 hover:bg-dfrntBlue-50 hover:text-dfrntBlue-700 focus:outline-none focus:ring-2 focus:ring-dfrntBlue-400 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-gray-200 disabled:hover:bg-white disabled:hover:text-gray-400";

const svgIcon = "h-3.5 w-3.5";
const svgProps = {
  "aria-hidden": true,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

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
  // Which label is being edited in place — window edges or the axis'
  // loaded-range endpoints — and its raw input.
  const [editEdge, setEditEdge] = useState<"oldest" | "newest" | "axisLo" | "axisHi" | null>(null);
  const [editValue, setEditValue] = useState("");

  // Initial page load via RTK Query (auto-fetches when logPath changes).
  // Fetch INITIAL_COUNT + 1: the extra commit is a probe — its presence
  // means more remain; it is never rendered. `start` and `startDateTime`
  // are mutually exclusive server-side, so only one is ever sent; the
  // endDateTime bottom bound combines with either. refetchCountRef asks
  // for a bigger first page when a bounds reset must keep every row
  // already loaded — consumed once by the bounds-change effect.
  const refetchCountRef = useRef<number | null>(null);
  const { data: initialData, isLoading: initialLoading, error: initialError } = useGetLogQuery(
    anchorIso
      ? { path: logPath ?? "", count: (refetchCountRef.current ?? INITIAL_COUNT) + 1, startDateTime: anchorIso, endDateTime: endIso ?? undefined, withCounts: false }
      : { path: logPath ?? "", start: 0, count: (refetchCountRef.current ?? INITIAL_COUNT) + 1, endDateTime: endIso ?? undefined, withCounts: false },
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
    refetchCountRef.current = null;
    if (logPath) dispatch(clearLogPagination(logPath));
    setWindowStart(0);
    setPollNewer(null);
    setEnrichedById({});
  }, [boundsKey, logPath, dispatch]);

  const credentials = useAppSelector((state) => state.auth.credentials);
  const rawPagination = useAppSelector((state) => logPath ? selectLogPagination(state, logPath) : null);
  // The stored window may belong to a different start offset than the one
  // currently queried (e.g. right after a date jump before the first append).
  const pagination = rawPagination?.start === windowStart
    ? rawPagination
    : { start: windowStart, extraCommits: [], newerCommits: [], fetched: 0, loadedAll: false };
  const extraCommits = pagination.extraCommits;
  const newerCommits = pagination.newerCommits;
  const loadedAll = pagination.loadedAll;
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingNewer, setLoadingNewer] = useState(false);
  const [expandedCommits, setExpandedCommits] = useState<Set<string>>(new Set());
  // Enriched rows (with diff counts) keyed by commit id — streamed lazily
  // for the windowed span only; each row replaces its light twin in place.
  const [enrichedById, setEnrichedById] = useState<Record<string, LogCommit>>({});
  // Index into mergedCommits of the band under the pointer (proximity —
  // bands stay pointer-events-none so the range drag still works).
  const [hoverBand, setHoverBand] = useState<number | null>(null);
  const trackRef = useRef<HTMLSpanElement>(null);

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
          { start: 0, count: LOAD_NEWER_COUNT, withCounts: false },
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
          { start, count: count === -1 ? -1 : count + 1, endDateTime: endIso ?? undefined, withCounts: false },
          credentials,
          undefined,
        );
        const hasMore = count !== -1 && result.commits.length > count;
        const visible = count === -1 ? result.commits : result.commits.slice(0, count);
        dispatch(appendExtraCommits({ logPath, start: windowStart, commits: visible, fetched: result.commits.length, loadedAll: !hasMore }));
        if (endIso || anchorIso) {
          // Loading rows should widen the view to cover them — drop the
          // fetch bounds so the axis follows the loaded extent. The
          // bounds change refetches and clears paging, so size the first
          // page to keep every row loaded so far (plus the above-top
          // band that becomes reachable once `to` is gone).
          refetchCountRef.current =
            (initialData?.commits.length ?? 0) + pagination.fetched + result.commits.length + topAbs;
          setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.delete("from");
            next.delete("to");
            return next;
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("Failed to load more commits:", msg);
      } finally {
        setLoadingMore(false);
      }
    },
    [logPath, topAbs, endIso, anchorIso, initialData, pagination.fetched, dispatch, credentials, setSearchParams],
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
          { start: bottom - count, count, endDateTime: endIso ?? undefined, withCounts: false },
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

  // Drop commits outside the active fetch bounds — live-stream and stale
  // "newer" pages hold commits above `to` / below `from` from an earlier
  // window; without this they re-enter the list after a range change.
  // The epsilon covers double-representation drift between the ISO bound
  // and the commit's decimal timestamp.
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
    const hi = anchorIso ? isoToEpochDecimal(anchorIso) : null;
    const lo = endIso ? isoToEpochDecimal(endIso) : null;
    return [...liveMapped, ...allCommits]
      .filter((c) => {
        const ts = Number(c.timestamp);
        return (hi == null || ts <= hi + 1e-6) && (lo == null || ts >= lo - 1e-6);
      })
      .map((c) => enrichedById[c.identifier] ?? c);
  }, [allCommits, liveCommits, enrichedById, anchorIso, endIso]);

  // Viewport window: the list renders only the slice [viewTop, viewTop +
  // viewCount) of the loaded commits. `w` carries the position and `n` the
  // size; both live in the URL so drags and pans are navigable state.
  // Overview axis: a linear time span over the loaded range — left is the
  // oldest loaded commit, right the newest. Each commit is a thin band at
  // its relative time position; band opacity encodes how many documents the
  // commit touched (log scale).
  const SLIDER_RES = 10000;
  // Minimum displayed axis span (s): a lone commit keeps a visible area
  // around it instead of the axis collapsing onto the item.
  const MIN_AXIS_SPAN = 1e-3;
  // Explicit `from`/`to` bounds are authoritative for the axis: zoom-out
  // keeps expanding the bar even past the loaded commit extent, into
  // time that may hold no (or not-yet-loaded) commits.
  const boundLo = endIso ? isoToEpochDecimal(endIso) : null;
  const boundHi = anchorIso ? isoToEpochDecimal(anchorIso) : null;
  const timeAxis = useMemo(() => {
    const commitHi = mergedCommits.length ? Number(mergedCommits[0].timestamp) : null;
    const commitLo = mergedCommits.length ? Number(mergedCommits.at(-1)!.timestamp) : null;
    const rawHi = boundHi ?? commitHi;
    const rawLo = boundLo ?? commitLo;
    if (rawHi == null || rawLo == null) return null;
    const t1 = Math.max(rawHi, commitHi ?? rawHi);
    const rawT0 = Math.min(rawLo, commitLo ?? rawLo);
    const rawSpan = t1 - rawT0;
    const span = Math.max(rawSpan, MIN_AXIS_SPAN);
    const t0 = rawSpan >= MIN_AXIS_SPAN ? rawT0 : rawT0 - (MIN_AXIS_SPAN - rawSpan) / 2;
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
  }, [mergedCommits, boundLo, boundHi]);
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
  const defWl = boundLo ?? (mergedCommits.length
    ? Number(mergedCommits[Math.min(VIEW_COUNT - 1, mergedCommits.length - 1)].timestamp)
    : axisLo);
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

  // Zoom in: the loaded endpoints become the slider edges — fetch bounds
  // set to the window's times and the window resets to cover them. Bounds
  // go through epochDecimalToIso: Date.toISOString truncates to
  // milliseconds, which collapses small selections into a degenerate span.
  const zoomIn = () => {
    const loIso = epochDecimalToIso(effWl);
    const hiIso = epochDecimalToIso(effWr);
    if (!loIso || !hiIso) return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("from", loIso);
      next.set("to", hiIso);
      next.delete("w");
      next.delete("n");
      next.delete("wl");
      next.delete("wr");
      return next;
    });
  };

  // Zoom out on one side: that fetch bound extends by half the loaded
  // span. wl/wr persist, so the selection keeps its duration and position.
  const zoomOutSide = (older: boolean) => {
    const half = (axisHi - axisLo) / 2;
    const bound = epochDecimalToIso((older ? axisLo : axisHi) + (older ? -1 : 1) * half);
    if (!bound) return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set(older ? "from" : "to", bound);
      next.delete("w");
      next.delete("n");
      return next;
    });
  };

  // Pan the selected span by dragging the range itself — previewed during
  // the drag, written to wl/wr on release.
  const rangeDragRef = useRef<{ x: number; wl: number; wr: number } | null>(null);
  const onRangePointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (!timeAxis) return;
    e.preventDefault();
    e.stopPropagation();
    const track = e.currentTarget.parentElement;
    if (!track) return;
    rangeDragRef.current = { x: e.clientX, wl: effWl, wr: effWr };
    const shiftOf = (d: { x: number; wl: number; wr: number }, clientX: number) => {
      const dt = ((clientX - d.x) / track.getBoundingClientRect().width) * timeAxis.span;
      return Math.max(axisLo - d.wl, Math.min(axisHi - d.wr, dt));
    };
    const onMove = (ev: PointerEvent) => {
      const d = rangeDragRef.current;
      if (!d) return;
      const shift = shiftOf(d, ev.clientX);
      setDragEdges({ wl: d.wl + shift, wr: d.wr + shift });
    };
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const d = rangeDragRef.current;
      rangeDragRef.current = null;
      setDragEdges(null);
      if (!d) return;
      const shift = shiftOf(d, ev.clientX);
      writeWindow(d.wl + shift, d.wr + shift);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  // Enrich only the commits inside the window: diff counts are the
  // expensive field, so the rest of the log streams light. Each enriched
  // row replaces its light twin as it arrives (2ms pad on each bound keeps
  // edge commits inside the span).
  useEffect(() => {
    if (!logPath || !timeAxis) return;
    const ctrl = new AbortController();
    void streamLog(
      config.apiUrl,
      logPath,
      {
        startDateTime: epochDecimalToIso(wrTs + 0.002) ?? undefined,
        endDateTime: epochDecimalToIso(wlTs - 0.002) ?? undefined,
        count: -1,
        withCounts: true,
      },
      credentials,
      ctrl.signal,
      (commit) =>
        setEnrichedById((prev) =>
          prev[commit.identifier] ? prev : { ...prev, [commit.identifier]: commit },
        ),
    ).catch((err) => {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        console.error("Window enrichment stream error:", err);
      }
    });
    return () => ctrl.abort();
    // Axis endpoints (not the memo object) — enrichment merges keep the
    // same endpoints, so this doesn't refire on every streamed row.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logPath, wlTs, wrTs, credentials, axisLo, axisHi]);

  // Edge label: local date/time lines plus the fraction (dropping a zero or
  // absent fraction — shown only where relevant).
  const edgeLabelParts = (ts: number) => {
    const d = new Date(ts * 1000);
    const p = (n: number) => String(n).padStart(2, "0");
    // Edge positions are continuous — shortest-repr digits, capped at
    // nanosecond precision, with trailing zeros stripped.
    const fracStr = (String(ts).split(".")[1] ?? "").slice(0, 9);
    let fracEnd = fracStr.length;
    while (fracEnd > 0 && fracStr.charAt(fracEnd - 1) === "0") fracEnd--;
    const frac = fracStr.slice(0, fracEnd);
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
    if (edge === "axisLo" || edge === "axisHi") {
      // Endpoint edits always retarget the corresponding fetch bound.
      if (edge === "axisHi") {
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
      return;
    }
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
  const isStreaming = initialData?.commits.length === 0 && (initialData?.hasMore ?? false);
  const loading = initialLoading || isStreaming || loadingMore || loadingNewer;
  let error: string | null = null;
  if (initialError) {
    error = initialError instanceof Error ? initialError.message : "Failed to load commit history";
  }
  const paneEmpty = mergedCommits.length === 0 && !error;
  const paneLoading = loading && mergedCommits.length === 0;
  const paneNoCommits = !paneLoading && paneEmpty && !timeAxis;
  const paneBody = !paneLoading && !paneNoCommits;

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

        {paneLoading && (
          <p className="text-sm text-gray-400">{t("branchHistory.loadingCommits")}</p>
        )}
        {paneNoCommits && (
          <p className="text-sm text-gray-400">{t("branchHistory.noCommitsFound")}</p>
        )}
        {paneBody && (
          <>
            {mergedCommits.length === 0 && !error && (
              <p className="mb-3 text-sm text-gray-400">{t("branchHistory.noCommitsFound")}</p>
            )}
            <div className="mb-3 text-xs text-gray-500">
              {t("branchHistory.showingCommits", { count: `${visibleCommits.length}/${mergedCommits.length}` })}
              {endIso && <span className="ml-2 text-dfrntBlue-600">— {t("branchHistory.fromDate", { date: new Date(endIso).toLocaleString() })}</span>}
              {anchorIso && <span className="ml-2 text-dfrntBlue-600">— {t("branchHistory.untilDate", { date: new Date(anchorIso).toLocaleString() })}</span>}
              {currentCommitId && <span className="ml-2 text-amber-600">— {t("branchHistory.viewingCommit", { id: currentCommitId.slice(0, 12) })}</span>}
            </div>

            {/* Navigable time window: overview of the loaded range. Left is
                oldest, right is newest; the highlighted span is the slice the
                list shows. Pagination controls are navigation next to it. */}
            {timeAxis && (
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
                  className={iconBtn}
                  title={t("branchHistory.panOlder")}
                >
                  <svg {...svgProps} className={svgIcon}><path d="M10 3L5 8l5 5" /></svg>
                </button>
                <div className="min-w-32 flex-1 px-4 pt-11">
                  <div className="relative">
                    {/* Edge labels float above their thumbs — stacked
                        date/time/fraction keeps them narrow; click edits the
                        edge in place. */}
                    {(["oldest", "newest"] as const).map((edge) => {
                      if (!timeAxis) return null;
                      const edgeTs = edge === "oldest" ? effWl : effWr;
                      const pos = ((edgeTs - timeAxis.t0) / timeAxis.span) * 100;
                      const parts = edgeLabelParts(edgeTs);
                      let posTransform = "translateX(-50%)";
                      if (pos <= 12) {
                        posTransform = "translateX(0)";
                      } else if (pos >= 88) {
                        posTransform = "translateX(-100%)";
                      }
                      return (
                        <div
                          key={edge}
                          className="absolute -top-11 z-10"
                          style={{ left: `${pos}%`, transform: posTransform }}
                        >
                          {editEdge === edge ? (
                            <input
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
                              className="block rounded-md border border-gray-200 bg-white/95 px-1.5 py-0.5 text-left text-[9px] leading-tight text-gray-500 shadow-sm transition-colors hover:border-dfrntBlue-300 hover:text-dfrntBlue-700"
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
                    className="relative flex h-6 touch-none select-none items-center"
                    min={0}
                    max={SLIDER_RES}
                    step={1}
                    minStepsBetweenThumbs={1}
                    onMouseMove={(e) => {
                      const rect = trackRef.current?.getBoundingClientRect();
                      if (!rect || !timeAxis) return;
                      const frac = (e.clientX - rect.left) / rect.width;
                      let best = -1;
                      let bestDist = 10 / rect.width;
                      timeAxis.bands.forEach((band, i) => {
                        const d = Math.abs(band.pos - frac);
                        if (d < bestDist) {
                          bestDist = d;
                          best = i;
                        }
                      });
                      setHoverBand(best);
                    }}
                    onMouseLeave={() => setHoverBand(null)}
                    value={[posOfTime(effWl), posOfTime(effWr)]}
                    onValueChange={([lo, hi]) =>
                      setDragEdges({ wl: timeOfPos(lo), wr: timeOfPos(hi) })
                    }
                    onValueCommit={([lo, hi]) => {
                      setDragEdges(null);
                      writeWindow(timeOfPos(lo), timeOfPos(hi));
                    }}
                  >
                    <Slider.Track ref={trackRef} className="relative h-5 grow overflow-hidden rounded-md bg-gray-50 ring-1 ring-inset ring-gray-200">
                      <Slider.Range
                        className="absolute h-full cursor-grab touch-none bg-dfrntBlue-500/10 ring-1 ring-inset ring-dfrntBlue-400/50 active:cursor-grabbing"
                        onPointerDown={onRangePointerDown}
                      />
                      {timeAxis?.bands.map((band, i) => {
                        const ts = Number(mergedCommits[i].timestamp);
                        const inWindow = ts >= effWl && ts <= effWr;
                        return (
                          <div
                            key={mergedCommits[i].identifier}
                            className={`pointer-events-none absolute top-1 bottom-1 w-1 rounded-full ${inWindow ? "bg-dfrntBlue-600" : "bg-gray-300"}`}
                            style={{ left: `${band.pos * 100}%`, marginLeft: -2, opacity: band.alpha * 0.5 }}
                          />
                        );
                      })}
                    </Slider.Track>
                    <Slider.Thumb
                      className="group relative block h-6 w-5 cursor-ew-resize focus:outline-none"
                      aria-label={t("branchHistory.windowOldest")}
                    >
                      <span className="absolute left-1/2 top-1/2 h-3 w-px -translate-x-1/2 -translate-y-1/2 bg-dfrntBlue-600" />
                      <span className="absolute right-1/2 top-1/2 mr-0.5 flex h-5 w-3.5 -translate-y-1/2 items-center justify-center gap-[3px] rounded-md border border-gray-300 bg-white shadow-sm transition-colors group-hover:border-dfrntBlue-400 group-hover:bg-dfrntBlue-50 group-focus:border-dfrntBlue-500 group-focus:ring-2 group-focus:ring-dfrntBlue-400">
                        <span className="h-2.5 w-px bg-gray-400 transition-colors group-hover:bg-dfrntBlue-500" />
                        <span className="h-2.5 w-px bg-gray-400 transition-colors group-hover:bg-dfrntBlue-500" />
                      </span>
                    </Slider.Thumb>
                    <Slider.Thumb
                      className="group relative block h-6 w-5 cursor-ew-resize focus:outline-none"
                      aria-label={t("branchHistory.windowNewest")}
                    >
                      <span className="absolute left-1/2 top-1/2 h-3 w-px -translate-x-1/2 -translate-y-1/2 bg-dfrntBlue-600" />
                      <span className="absolute left-1/2 top-1/2 ml-0.5 flex h-5 w-3.5 -translate-y-1/2 items-center justify-center gap-[3px] rounded-md border border-gray-300 bg-white shadow-sm transition-colors group-hover:border-dfrntBlue-400 group-hover:bg-dfrntBlue-50 group-focus:border-dfrntBlue-500 group-focus:ring-2 group-focus:ring-dfrntBlue-400">
                        <span className="h-2.5 w-px bg-gray-400 transition-colors group-hover:bg-dfrntBlue-500" />
                        <span className="h-2.5 w-px bg-gray-400 transition-colors group-hover:bg-dfrntBlue-500" />
                      </span>
                    </Slider.Thumb>
                    </Slider.Root>
                    {/* Commit popup on band hover: message, id, time.
                        Clamped so it stays inside the bar's width. */}
                    {hoverBand != null && timeAxis && mergedCommits[hoverBand] && (
                      <div
                        className="pointer-events-none absolute -top-1 z-20 -translate-y-full"
                        style={{ left: `${timeAxis.bands[hoverBand].pos * 100}%` }}
                      >
                        <div
                          className="whitespace-nowrap rounded-md border border-gray-200 bg-white px-2 py-1 text-[10px] leading-snug shadow-md"
                          style={{
                            transform: `translateX(${timeAxis.bands[hoverBand].pos < 0.15 ? 0 : timeAxis.bands[hoverBand].pos > 0.85 ? -100 : -50}%)`,
                          }}
                        >
                          <div className="font-medium text-gray-800">
                            {mergedCommits[hoverBand].message || t("branchHistory.noMessage")}
                          </div>
                          <div className="font-mono text-gray-500">{mergedCommits[hoverBand].identifier.slice(0, 12)}</div>
                          <div className="tabular-nums text-gray-500">{formatTimestampNanos(mergedCommits[hoverBand].timestamp)}</div>
                        </div>
                      </div>
                    )}
                    {/* Zoom in, centred on the selection: refetches so the
                        loaded endpoints become the slider edges. Zooming out
                        lives beside the endpoint labels — one icon per side. */}
                    {timeAxis && (
                      <button
                        type="button"
                        onClick={zoomIn}
                        className="absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-gray-200 bg-white p-1 text-gray-500 shadow-sm transition-colors hover:border-dfrntBlue-300 hover:text-dfrntBlue-700 hover:shadow"
                        style={{ left: `${((posOfTime(effWl) + posOfTime(effWr)) / 2 / SLIDER_RES) * 100}%` }}
                        title={t("branchHistory.zoomIn")}
                      >
                        <svg {...svgProps} className={svgIcon}>
                          <circle cx="7" cy="7" r="4.5" />
                          <path d="M10.5 10.5L14 14" />
                          <path d="M5.5 7h3M7 5.5v3" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[10px] text-gray-400">
                    {/* Zoom-out extends that side's fetch bound by half the
                        loaded span; the endpoint label next to it edits the
                        bound directly. */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => zoomOutSide(true)}
                        className={`${iconBtn} ${!endIso && !moreAvailable ? "opacity-40" : ""}`}
                        title={t(!endIso && !moreAvailable ? "branchHistory.atLogStart" : "branchHistory.zoomOutOlder")}
                      >
                        <svg {...svgProps} className={svgIcon}>
                          <path d="M13 3v10" />
                          <path d="M9.5 8H3" />
                          <path d="M5.5 5.5L3 8l2.5 2.5" />
                        </svg>
                      </button>
                    {editEdge === "axisLo" ? (
                      <input
                        type="datetime-local"
                        step={0.001}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={commitEdgeEdit}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitEdgeEdit();
                          if (e.key === "Escape") setEditEdge(null);
                        }}
                        className="w-36 rounded border border-dfrntBlue-300 px-1 text-[10px] text-gray-700 focus:outline-none"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditEdge("axisLo");
                          setEditValue(isoToLocalInput(new Date(axisLo * 1000).toISOString()));
                        }}
                        className="min-w-0 max-w-full rounded px-1 py-0.5 text-left tabular-nums transition-colors hover:bg-gray-100 hover:text-dfrntBlue-700"
                        title={t("branchHistory.editEdge")}
                      >
                        {formatTimestampNanos(axisLo)}
                      </button>
                    )}
                    </div>
                    <span className="text-gray-400">{t("branchHistory.windowCount", { count: visibleCommits.length, total: mergedCommits.length })}</span>
                    <div className="flex items-center gap-1">
                    {editEdge === "axisHi" ? (
                      <input
                        type="datetime-local"
                        step={0.001}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={commitEdgeEdit}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitEdgeEdit();
                          if (e.key === "Escape") setEditEdge(null);
                        }}
                        className="w-36 rounded border border-dfrntBlue-300 px-1 text-[10px] text-gray-700 focus:outline-none"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditEdge("axisHi");
                          setEditValue(isoToLocalInput(new Date(axisHi * 1000).toISOString()));
                        }}
                        className="min-w-0 max-w-full rounded px-1 py-0.5 text-right tabular-nums transition-colors hover:bg-gray-100 hover:text-dfrntBlue-700"
                        title={t("branchHistory.editEdge")}
                      >
                        {formatTimestampNanos(axisHi)}
                      </button>
                    )}
                      <button
                        type="button"
                        onClick={() => zoomOutSide(false)}
                        className={`${iconBtn} ${!anchorIso && unfetchedNewer === 0 ? "opacity-40" : ""}`}
                        title={t(!anchorIso && unfetchedNewer === 0 ? "branchHistory.atLogEnd" : "branchHistory.zoomOutNewer")}
                      >
                        <svg {...svgProps} className={svgIcon}>
                          <path d="M3 3v10" />
                          <path d="M6.5 8H13" />
                          <path d="M10.5 5.5L13 8l-2.5 2.5" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => panWindow(true)}
                  disabled={effWr >= axisHi}
                  className={iconBtn}
                  title={t("branchHistory.panNewer")}
                >
                  <svg {...svgProps} className={svgIcon}><path d="M6 3l5 5-5 5" /></svg>
                </button>
                {rangeError && <span className="text-xs text-red-600">{rangeError}</span>}
                {moreAvailable && (
                  <div className="ml-auto flex gap-2">
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
                  </div>
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
                            aria-hidden="true"
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
    return `${parts.at(-2)}/${parts.at(-1)}`;
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
