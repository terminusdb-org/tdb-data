import React from "react";

export interface SearchFiltersState {
  readonly types: ReadonlySet<string>;
  readonly maxDistance: number;
  readonly sort: "match" | "id";
  readonly count: number;
}

interface SearchFiltersProps {
  readonly availableTypes: ReadonlyArray<string>;
  readonly filters: SearchFiltersState;
  readonly onChange: (filters: SearchFiltersState) => void;
  readonly totalResults: number;
  readonly filteredResults: number;
}

export const SearchFilters: React.FC<SearchFiltersProps> = ({
  availableTypes,
  filters,
  onChange,
  totalResults,
  filteredResults,
}) => {
  const toggleType = (type: string) => {
    const next = new Set(filters.types);
    if (next.has(type)) {
      next.delete(type);
    } else {
      next.add(type);
    }
    onChange({ ...filters, types: next });
  };

  const allTypes = availableTypes.slice().sort();

  return (
    <div className="space-y-5">
      {/* Result count */}
      <div className="text-xs text-gray-500">
        {filteredResults !== totalResults
          ? `${filteredResults} of ${totalResults} results`
          : `${totalResults} results`}
      </div>

      {/* Document type filter */}
      {allTypes.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Document Types</h4>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => onChange({ ...filters, types: new Set() })}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                All
              </button>
              <span className="text-gray-300">|</span>
              <button
                type="button"
                onClick={() => onChange({ ...filters, types: new Set(allTypes) })}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                None
              </button>
            </div>
          </div>
          <div className="space-y-1">
            {allTypes.map((type) => (
              <label key={type} className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={!filters.types.has(type)}
                  onChange={() => toggleType(type)}
                  className="h-3.5 w-3.5 rounded border-gray-300 text-dfrntBlue-500 focus:ring-dfrntBlue-200"
                />
                <span className="truncate">{type}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Distance threshold */}
      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Max Distance</h4>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={filters.maxDistance}
          onChange={(e) => onChange({ ...filters, maxDistance: Number(e.target.value) })}
          className="w-full accent-dfrntBlue-500"
        />
        <div className="mt-1 flex justify-between text-xs text-gray-400">
          <span>0.0</span>
          <span className="font-data font-medium text-gray-600">{filters.maxDistance.toFixed(2)}</span>
          <span>1.0</span>
        </div>
      </div>

      {/* Sort */}
      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Sort By</h4>
        <select
          value={filters.sort}
          onChange={(e) => onChange({ ...filters, sort: e.target.value as "match" | "id" })}
          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        >
          <option value="match">Best match</option>
          <option value="id">Document ID</option>
        </select>
      </div>

      {/* Results per page */}
      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Results Per Page</h4>
        <select
          value={filters.count}
          onChange={(e) => onChange({ ...filters, count: Number(e.target.value) })}
          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        >
          <option value={10}>10</option>
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
      </div>
    </div>
  );
};
