import React from "react";

const STORAGE_KEY = "tdb-data:search-history";
const MAX_HISTORY = 10;

export function getSearchHistory(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.slice(0, MAX_HISTORY) : [];
  } catch {
    return [];
  }
}

export function addToSearchHistory(query: string): void {
  if (!query.trim()) return;
  try {
    const existing = getSearchHistory();
    const next = [query, ...existing.filter((q) => q !== query)].slice(0, MAX_HISTORY);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // localStorage might be unavailable
  }
}

export function clearSearchHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

interface SearchHistoryProps {
  readonly history: string[];
  readonly onSelect: (query: string) => void;
  readonly onClear: () => void;
}

export const SearchHistory: React.FC<SearchHistoryProps> = ({ history, onSelect, onClear }) => {
  if (history.length === 0) return null;

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-400">Recent Searches</span>
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-gray-400 transition-colors hover:text-gray-600"
        >
          Clear
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {history.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onSelect(q)}
            className="flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-200 hover:text-gray-800"
          >
            <svg className="h-3.5 w-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            {q}
          </button>
        ))}
      </div>
    </div>
  );
};
