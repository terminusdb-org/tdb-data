import React, { useState, useCallback, useMemo } from "react";
import { useSearchQuery } from "@/store";
import type { SearchHit } from "@/types/terminusdb";

export interface ProjectionSearchBarProps {
  readonly searchPath: string;
  readonly scatterPointIds: ReadonlySet<string>;
  readonly onHighlightIds: (ids: Set<string>) => void;
  readonly onAddToWorkingSet: (ids: string[]) => void;
}

export const ProjectionSearchBar: React.FC<ProjectionSearchBarProps> = ({
  searchPath,
  scatterPointIds,
  onHighlightIds,
  onAddToWorkingSet,
}) => {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [selectedResultIds, setSelectedResultIds] = useState<Set<string>>(new Set());

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data: searchResults, isFetching } = useSearchQuery(
    { path: searchPath, query: debouncedQuery, count: 50, snippet: true },
    { skip: !debouncedQuery.trim() || !searchPath }
  );

  const matchedInProjection = useMemo(() => {
    if (!searchResults) return [];
    return searchResults.filter((h: SearchHit) => scatterPointIds.has(h.id));
  }, [searchResults, scatterPointIds]);

  const handleSearch = useCallback(() => {
    if (debouncedQuery.trim() && matchedInProjection.length > 0) {
      onHighlightIds(new Set(matchedInProjection.map((h) => h.id)));
      setShowResults(true);
    }
  }, [debouncedQuery, matchedInProjection, onHighlightIds]);

  const handleClear = useCallback(() => {
    setQuery("");
    setDebouncedQuery("");
    setShowResults(false);
    setSelectedResultIds(new Set());
    onHighlightIds(new Set());
  }, [onHighlightIds]);

  const toggleResultSelection = useCallback((id: string) => {
    setSelectedResultIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleAddSelectedToWorkingSet = useCallback(() => {
    if (selectedResultIds.size > 0) {
      onAddToWorkingSet(Array.from(selectedResultIds));
      setSelectedResultIds(new Set());
    }
  }, [selectedResultIds, onAddToWorkingSet]);

  const handleAddAllToWorkingSet = useCallback(() => {
    if (matchedInProjection.length > 0) {
      onAddToWorkingSet(matchedInProjection.map((h) => h.id));
    }
  }, [matchedInProjection, onAddToWorkingSet]);

  return (
    <div className="border-b border-gray-100 bg-white">
      <div className="flex items-center gap-2 px-4 py-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch();
              if (e.key === "Escape") handleClear();
            }}
            placeholder="Search documents to highlight in projection…"
            className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 placeholder:text-gray-400 focus:border-dfrntBlue-500 focus:outline-none focus:ring-1 focus:ring-dfrntBlue-500"
          />
          {isFetching && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-dfrntBlue-500" />
          )}
        </div>
        <button
          type="button"
          onClick={handleSearch}
          disabled={!query.trim()}
          className="rounded-md bg-dfrntBlue-500 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
        >
          Search
        </button>
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-xs font-medium text-gray-600"
          >
            Clear
          </button>
        )}
      </div>

      {showResults && matchedInProjection.length > 0 && (
        <div className="border-t border-gray-100 px-4 py-2">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600">
              {matchedInProjection.length} match{matchedInProjection.length !== 1 ? "es" : ""} in projection
              {selectedResultIds.size > 0 && ` · ${selectedResultIds.size} selected`}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleAddSelectedToWorkingSet}
                disabled={selectedResultIds.size === 0}
                className="rounded border border-gray-300 px-2 py-0.5 text-xs font-medium text-gray-600 disabled:opacity-40"
              >
                Add Selected to Working Set
              </button>
              <button
                type="button"
                onClick={handleAddAllToWorkingSet}
                className="rounded border border-gray-300 px-2 py-0.5 text-xs font-medium text-gray-600"
              >
                Add All to Working Set
              </button>
            </div>
          </div>
          <div className="max-h-40 overflow-y-auto">
            {matchedInProjection.slice(0, 20).map((hit: SearchHit) => (
              <label
                key={hit.id}
                className="flex cursor-pointer items-start gap-2 px-2 py-1 text-xs hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={selectedResultIds.has(hit.id)}
                  onChange={() => toggleResultSelection(hit.id)}
                  className="mt-0.5 h-3 w-3 rounded border-gray-300 text-dfrntBlue-500 focus:ring-dfrntBlue-500"
                />
                <div className="flex-1 min-w-0">
                  <span className="font-mono text-gray-700">{hit.id}</span>
                  {hit.doc_type && (
                    <span className="ml-2 text-gray-400">{hit.doc_type}</span>
                  )}
                  {hit.chunk?.snippet && (
                    <p className="mt-0.5 truncate text-gray-400">{hit.chunk.snippet}</p>
                  )}
                </div>
                <span className="text-gray-300 tabular-nums">{hit.distance.toFixed(3)}</span>
              </label>
            ))}
            {matchedInProjection.length > 20 && (
              <p className="px-2 py-1 text-xs text-gray-400">
                +{matchedInProjection.length - 20} more matches…
              </p>
            )}
          </div>
        </div>
      )}

      {showResults && matchedInProjection.length === 0 && !isFetching && (
        <div className="border-t border-gray-100 px-4 py-2 text-xs text-gray-400">
          No matches found in the current projection.
        </div>
      )}
    </div>
  );
};
