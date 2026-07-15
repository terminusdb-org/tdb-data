import React, { useState } from "react";
import type { TypeColor } from "@/utils/typeColors";
import { ProjectionSearchBar } from "./ProjectionSearchBar";

export interface TypeFilterEntry {
  readonly type: string;
  readonly count: number;
  readonly color: TypeColor;
  readonly checked: boolean;
  readonly loading: boolean;
}

export interface TypeFilterPanelProps {
  readonly types: ReadonlyArray<TypeFilterEntry>;
  readonly filterMode: "visual" | "reproject";
  readonly onToggleType: (type: string) => void;
  readonly onSelectAll: () => void;
  readonly onSelectNone: () => void;
  readonly onFilterModeChange: (mode: "visual" | "reproject") => void;
  readonly onReproject: () => void;
  readonly isProjecting: boolean;
  readonly isLoading: boolean;
  readonly projectWorkingSet?: boolean;
  readonly workingSetCount?: number;
  readonly onToggleProjectWorkingSet?: () => void;
  readonly searchPath?: string;
  readonly scatterPointIds?: ReadonlySet<string>;
  readonly onHighlightIds?: (ids: Set<string>) => void;
  readonly onAddToWorkingSet?: (ids: string[]) => void;
}

export const TypeFilterPanel: React.FC<TypeFilterPanelProps> = ({
  types,
  filterMode,
  onToggleType,
  onSelectAll,
  onSelectNone,
  onFilterModeChange,
  onReproject,
  isProjecting,
  isLoading,
  projectWorkingSet = false,
  workingSetCount = 0,
  onToggleProjectWorkingSet,
  searchPath,
  scatterPointIds,
  onHighlightIds,
  onAddToWorkingSet,
}) => {
  const [searchExpanded, setSearchExpanded] = useState(false);
  return (
    <div className="p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Document Types
          {isLoading && (
            <span className="ml-1 inline-block h-2.5 w-2.5 animate-spin rounded-full border border-gray-300 border-t-dfrntBlue-500 align-middle" />
          )}
        </span>
        <div className="flex gap-2">
          <button
            className="text-xs text-gray-400 hover:text-gray-600"
            onClick={onSelectAll}
          >
            All
          </button>
          <span className="text-xs text-gray-300">|</span>
          <button
            className="text-xs text-gray-400 hover:text-gray-600"
            onClick={onSelectNone}
          >
            None
          </button>
        </div>
      </div>

      <div className="space-y-1">
        {types.map((entry) => (
          <label
            key={entry.type}
            className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <input
              type="checkbox"
              className="h-3.5 w-3.5 rounded border-gray-300 text-dfrntBlue-500 focus:ring-dfrntBlue-200"
              checked={entry.checked}
              onChange={() => onToggleType(entry.type)}
            />
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{ backgroundColor: entry.color.hex }}
            />
            <span className="flex-1 truncate">{entry.type}</span>
            {entry.loading ? (
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-dfrntBlue-500" />
            ) : (
              <span className="text-xs text-gray-400 tabular-nums">
                {entry.count}
              </span>
            )}
          </label>
        ))}
      </div>

      {types.length === 0 && (
        <div className="py-4 text-center text-xs text-gray-400">
          No types available
        </div>
      )}

      {onToggleProjectWorkingSet && (
        <>
          <div className="my-2 border-t border-gray-100" />
          <label
            className={`flex cursor-pointer items-center gap-2 text-sm ${
              workingSetCount > 0 ? "text-gray-700" : "text-gray-400"
            }`}
            title="Include working set documents in the projection (union with selected types)"
          >
            <input
              type="checkbox"
              className="h-3.5 w-3.5 rounded border-gray-300 text-dfrntBlue-500 focus:ring-dfrntBlue-200"
              checked={projectWorkingSet}
              onChange={onToggleProjectWorkingSet}
              disabled={workingSetCount === 0}
            />
            <span className="flex-1 truncate">Working Set (union)</span>
            <span className="text-xs text-gray-400 tabular-nums">{workingSetCount}</span>
          </label>
        </>
      )}

      {searchPath && scatterPointIds && onHighlightIds && onAddToWorkingSet && (
        <>
          <div className="my-2 border-t border-gray-100" />
          <button
            className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wide text-gray-400 hover:text-gray-600"
            onClick={() => setSearchExpanded((v) => !v)}
          >
            <span>Search</span>
            <svg
              className="h-3 w-3 transition-transform"
              style={{ transform: searchExpanded ? "rotate(180deg)" : "none" }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 10l5 5 5-5" />
            </svg>
          </button>
          {searchExpanded && (
            <div className="mt-1">
              <ProjectionSearchBar
                searchPath={searchPath}
                scatterPointIds={scatterPointIds}
                onHighlightIds={onHighlightIds}
                onAddToWorkingSet={onAddToWorkingSet}
              />
            </div>
          )}
        </>
      )}

      <div className="my-3 border-t border-gray-100" />

      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
        Filter Mode
      </div>
      <div className="mb-3 flex gap-1">
        <button
          className={
            filterMode === "visual"
              ? "rounded bg-dfrntBlue-500 px-2 py-1 text-xs font-medium text-white"
              : "rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600"
          }
          onClick={() => onFilterModeChange("visual")}
        >
          Visual Filter
        </button>
        <button
          className={
            filterMode === "reproject"
              ? "rounded bg-dfrntBlue-500 px-2 py-1 text-xs font-medium text-white"
              : "rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600"
          }
          onClick={() => onFilterModeChange("reproject")}
        >
          Re-project
        </button>
      </div>

      {filterMode === "reproject" && (
        <button
          className="w-full rounded-md bg-dfrntBlue-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-dfrntBlue-400 disabled:cursor-not-allowed disabled:bg-gray-300"
          onClick={onReproject}
          disabled={isProjecting}
        >
          {isProjecting ? "Projecting…" : "Re-project Now"}
        </button>
      )}
    </div>
  );
};
