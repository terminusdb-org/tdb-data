import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSuggestQuery, useSearchQuery } from "@/store";
import { buildApiPath, type RouteParams } from "@/utils/routes";
import type { SuggestResponse, SearchHit } from "@/types/terminusdb";
import { SearchResultCard } from "./SearchResultCard";
import { SearchFilters, type SearchFiltersState } from "./SearchFilters";
import { SearchHistory, getSearchHistory, addToSearchHistory, clearSearchHistory } from "./SearchHistory";

function defaultFilters(): SearchFiltersState {
  return {
    types: new Set(),
    maxDistance: 1.0,
    sort: "match",
    count: 25,
  };
}

export const SearchBar: React.FC = () => {
  const { t } = useTranslation();
  const params = useParams();
  const navigate = useNavigate();
  const [urlSearchParams, setUrlSearchParams] = useSearchParams();
  const urlQuery = urlSearchParams.get("q") ?? "";
  const [query, setQuery] = useState(urlQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(urlQuery);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [history, setHistory] = useState<string[]>([]);
  const [filters, setFilters] = useState<SearchFiltersState>(defaultFilters);
  const [visibleCount, setVisibleCount] = useState(25);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const searchTriggered = urlQuery.length > 0;

  const org = params.org;
  const team = params.team;
  const branch = params.branch;
  const commitId = params.commitId;

  const refType = branch ? "branch" : commitId ? "commit" : null;
  const refName = branch ?? commitId ?? null;

  const routeParams: RouteParams | null = useMemo(() =>
    org && team && refType && refName ? { org, team, refType, refName } : null,
    [org, team, refType, refName]
  );

  useEffect(() => {
    setHistory(getSearchHistory());
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    setQuery(urlQuery);
    setDebouncedQuery(urlQuery);
  }, [urlQuery]);

  useEffect(() => {
    const typeParam = urlSearchParams.get("type");
    const maxDist = urlSearchParams.get("maxDistance");
    const sort = urlSearchParams.get("sort");
    const count = urlSearchParams.get("count");
    setFilters({
      types: typeParam ? new Set(typeParam.split(",")) : new Set(),
      maxDistance: maxDist ? Number(maxDist) : 1.0,
      sort: sort === "id" ? "id" : "match",
      count: count ? Number(count) : 25,
    });
    setVisibleCount(count ? Number(count) : 25);
  }, [urlSearchParams]);

  const suggestPath = routeParams ? buildApiPath(routeParams, "suggest") : "";
  const searchPath = routeParams ? buildApiPath(routeParams, "search") : "";
  const similarPath = routeParams ? buildApiPath(routeParams, "similar") : "";
  const docPath = routeParams ? buildApiPath(routeParams, "document") : "";

  const { data: suggestData, isFetching: suggestFetching, error: suggestErr } = useSuggestQuery(
    { path: suggestPath, query: debouncedQuery, count: 10 },
    { skip: !routeParams || debouncedQuery.length < 2 }
  );

  const { data: searchResults, isFetching: isSearching, error: searchErr } = useSearchQuery(
    { path: searchPath, query: urlQuery, count: 100, snippet: true },
    { skip: !routeParams || !searchTriggered }
  );

  const suggest: SuggestResponse | undefined = suggestData;
  const completions = useMemo(() => suggest?.completions ?? [], [suggest]);
  const hits = useMemo(() => suggest?.hits ?? [], [suggest]);
  const totalApprox = suggest?.total_approx ?? 0;

  const allItems = useMemo(() => [
    { type: "search" as const, value: debouncedQuery, id: debouncedQuery },
    ...completions.map((c) => ({ type: "completion" as const, value: c, id: c })),
    ...hits.map((h) => ({ type: "hit" as const, value: h.id, id: h.id, distance: h.distance })),
  ], [debouncedQuery, completions, hits]);

  useEffect(() => {
    setActiveIndex(-1);
  }, [debouncedQuery]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const doSearch = useCallback((q: string) => {
    if (!routeParams || !q.trim()) return;
    setShowDropdown(false);
    addToSearchHistory(q.trim());
    setHistory(getSearchHistory());
    const sp = new URLSearchParams();
    sp.set("q", q.trim());
    setUrlSearchParams(sp, { replace: false });
  }, [routeParams, setUrlSearchParams]);

  const navigateToDoc = useCallback((docId: string) => {
    if (org && team && refType && refName) {
      navigate(`/${org}/${team}/local/${refType}/${refName}/documents?edit=${encodeURIComponent(docId)}`);
    }
  }, [org, team, refType, refName, navigate]);

  const handleSelect = (item: { type: string; value: string; id: string }) => {
    if (item.type === "search" || item.type === "completion") {
      doSearch(item.value);
    } else {
      setShowDropdown(false);
      navigateToDoc(item.id);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && activeIndex < 0) {
      e.preventDefault();
      doSearch(query);
      return;
    }
    if (!showDropdown || allItems.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, allItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      handleSelect(allItems[activeIndex]);
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  const handleClearInput = () => {
    setQuery("");
    setShowDropdown(false);
    setUrlSearchParams({}, { replace: false });
  };

  const handleClearHistory = () => {
    clearSearchHistory();
    setHistory([]);
  };

  const allResults: SearchHit[] = useMemo(() => searchResults ?? [], [searchResults]);
  const availableTypes = useMemo(() => {
    const set = new Set<string>();
    allResults.forEach((h) => {
      const t = h.doc_type;
      if (t) set.add(t);
    });
    return Array.from(set);
  }, [allResults]);

  const filteredResults = useMemo(() => {
    let r = allResults.filter((h) => h.distance <= filters.maxDistance);
    if (filters.types.size > 0) {
      r = r.filter((h) => {
        const t = h.doc_type;
        return t && !filters.types.has(t);
      });
    }
    if (filters.sort === "id") {
      r = [...r].sort((a, b) => a.id.localeCompare(b.id));
    } else {
      r = [...r].sort((a, b) => a.distance - b.distance);
    }
    return r;
  }, [allResults, filters]);

  const visibleResults = filteredResults.slice(0, visibleCount);
  const hasMore = visibleCount < filteredResults.length;

  const updateFiltersUrl = useCallback((next: SearchFiltersState) => {
    setFilters(next);
    const sp = new URLSearchParams(urlSearchParams);
    if (next.types.size > 0) {
      sp.set("type", Array.from(next.types).join(","));
    } else {
      sp.delete("type");
    }
    if (next.maxDistance < 1.0) {
      sp.set("maxDistance", String(next.maxDistance));
    } else {
      sp.delete("maxDistance");
    }
    if (next.sort !== "match") {
      sp.set("sort", next.sort);
    } else {
      sp.delete("sort");
    }
    if (next.count !== 25) {
      sp.set("count", String(next.count));
    } else {
      sp.delete("count");
    }
    setUrlSearchParams(sp, { replace: true });
    setVisibleCount(next.count);
  }, [urlSearchParams, setUrlSearchParams]);

  return (
    <div ref={dropdownRef} className="w-full">
      <div className="relative mx-auto max-w-3xl">
        <svg
          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
          fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setShowDropdown(true); }}
          onFocus={() => setShowDropdown(true)}
          onKeyDown={handleKeyDown}
          placeholder={routeParams ? t("search.placeholder") : t("search.selectDataProductFirst")}
          disabled={!routeParams}
          className="w-full rounded-full border border-gray-300 bg-white py-3 pl-12 pr-10 text-sm text-gray-900 shadow-sm placeholder-gray-400 focus:border-dfrntBlue-400 focus:ring-2 focus:ring-dfrntBlue-100 disabled:bg-gray-50 disabled:text-gray-400"
          aria-label={t("search.ariaSearchDocuments")}
        />
        {query && (
          <button
            type="button"
            onClick={handleClearInput}
            aria-label={t("search.ariaClearSearch")}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-600"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        {suggestFetching && !query && (
          <div className="absolute right-12 top-1/2 -translate-y-1/2">
            <svg className="h-4 w-4 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}
      </div>

      {showDropdown && suggestErr && debouncedQuery.length >= 2 && (
        <div className="mx-auto mt-1 max-w-3xl rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 shadow-lg">
          {t("search.suggestFailed")} {"status" in suggestErr ? String(suggestErr.status) : String(suggestErr.message ?? suggestErr)}
        </div>
      )}

      {showDropdown && !suggestErr && allItems.length > 0 && routeParams && (
        <div className="mx-auto mt-1 max-h-96 max-w-3xl overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {debouncedQuery.length >= 2 && (
            <div
              className="cursor-pointer border-b border-gray-100 px-4 py-2.5 text-sm hover:bg-gray-50"
              onMouseDown={(e) => { e.preventDefault(); handleSelect(allItems[0]); }}
              role="option"
              aria-selected={activeIndex === 0}
              tabIndex={0}
            >
              <span className="text-gray-400">{t("common.searchFor")} </span>
              <span className="font-medium text-gray-900">&ldquo;{debouncedQuery}&rdquo;</span>
            </div>
          )}
          {completions.map((c, i) => {
            const idx = 1 + i;
            return (
              <div
                key={`c-${i}`}
                className={`cursor-pointer px-4 py-2.5 text-sm ${idx === activeIndex ? "bg-dfrntBlue-50" : "hover:bg-gray-50"}`}
                onMouseDown={(e) => { e.preventDefault(); handleSelect(allItems[idx]); }}
                role="option"
                aria-selected={idx === activeIndex}
                tabIndex={0}
              >
                <span className="font-medium text-gray-900">{c}</span>
                <span className="ml-2 text-xs text-gray-400">{t("common.completion")}</span>
              </div>
            );
          })}
          {hits.map((h, i) => {
            const idx = 1 + completions.length + i;
            return (
              <div
                key={`h-${h.id}`}
                className={`cursor-pointer px-4 py-2.5 text-sm ${idx === activeIndex ? "bg-dfrntBlue-50" : "hover:bg-gray-50"}`}
                onMouseDown={(e) => { e.preventDefault(); handleSelect(allItems[idx]); }}
                role="option"
                aria-selected={idx === activeIndex}
                tabIndex={0}
              >
                <span className="font-medium text-gray-900">{h.id}</span>
                <span className="ml-2 text-xs text-gray-400">{t("common.doc")}</span>
              </div>
            );
          })}
          {totalApprox > 0 && (
            <div className="border-t border-gray-100 px-4 py-2 text-xs text-gray-400">
              ~{totalApprox} {t("common.matchingDocuments")}
            </div>
          )}
        </div>
      )}

      {!searchTriggered && !showDropdown && (
        <div className="mx-auto max-w-3xl">
          <SearchHistory history={history} onSelect={(q) => doSearch(q)} onClear={handleClearHistory} />
        </div>
      )}

      {searchTriggered && (
        <div className="mx-auto mt-6 max-w-5xl">
          {isSearching && (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500">
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {t("search.searching")}
            </div>
          )}

          {searchErr && !isSearching && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
              {t("search.searchFailed")} {"status" in searchErr ? String(searchErr.status) : String(searchErr.message ?? searchErr)}
            </div>
          )}

          {!isSearching && !searchErr && allResults.length === 0 && (
            <div className="py-8 text-center">
              <p className="text-sm text-gray-500">
                {t("search.noResultsFor")} <span className="font-medium text-gray-700">&ldquo;{urlQuery}&rdquo;</span>
              </p>
              <p className="mt-1 text-xs text-gray-400">{t("search.tryDifferent")}</p>
            </div>
          )}

          {!isSearching && !searchErr && allResults.length > 0 && routeParams && (
            <div className="flex gap-6">
              <div className="hidden w-56 shrink-0 md:block">
                <SearchFilters
                  availableTypes={availableTypes}
                  filters={filters}
                  onChange={updateFiltersUrl}
                  totalResults={allResults.length}
                  filteredResults={filteredResults.length}
                />
              </div>
              <div className="flex-1">
                <div className="mb-3 text-sm text-gray-500">
                  {t("common.about")} {filteredResults.length} {t("common.result")}{filteredResults.length !== 1 ? "s" : ""}
                  {urlQuery && <> {t("common.for")} <span className="font-medium text-gray-700">&ldquo;{urlQuery}&rdquo;</span></>}
                </div>
                {filteredResults.length === 0 ? (
                  <div className="py-8 text-center text-sm text-gray-500">
                    {t("search.noResultsMatchFilters")}
                  </div>
                ) : (
                  <>
                    <div className="space-y-3">
                      {visibleResults.map((hit) => (
                        <SearchResultCard
                          key={hit.id}
                          hit={hit}
                          query={urlQuery}
                          routeParams={routeParams}
                          similarPath={similarPath}
                          docPath={docPath}
                        />
                      ))}
                    </div>
                    {hasMore && (
                      <div className="mt-6 text-center">
                        <button
                          type="button"
                          onClick={() => setVisibleCount((c) => c + filters.count)}
                          className="rounded-md border border-gray-300 px-6 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
                        >
                          {t("common.loadMore")}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
