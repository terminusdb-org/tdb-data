import React, { useState } from "react";
import { useSimilarQuery } from "@/store";
import type { SearchHit } from "@/types/terminusdb";
import { SimilarityBadge } from "./SimilarityBadge";

interface SimilarDocumentsPanelProps {
  readonly similarPath: string;
  readonly documentId: string;
  readonly onSelectDocument?: (id: string) => void;
}

export const SimilarDocumentsPanel: React.FC<SimilarDocumentsPanelProps> = ({ similarPath, documentId, onSelectDocument }) => {
  const [expanded, setExpanded] = useState(true);
  const { data: results, isFetching, error } = useSimilarQuery(
    { path: similarPath, id: documentId, count: 10, snippet: true },
    { skip: !documentId }
  );

  const hits: SearchHit[] = results ?? [];

  return (
    <div className="flex h-full flex-col border-t border-gray-200 bg-gray-50">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
      >
        <span className="flex items-center gap-2">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
          </svg>
          Similar Documents
          {hits.length > 0 && <span className="text-xs text-gray-400">({hits.length})</span>}
        </span>
        <svg className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {expanded && (
        <div className="flex-1 overflow-y-auto px-4 pb-3">
          {isFetching && <div className="py-2 text-center text-xs text-gray-500">Finding similar documents…</div>}
          {error && !isFetching && (
            <div className="py-2 text-center text-xs text-red-600">
              {"status" in error ? `Error: ${String(error.status)}` : "Failed to load similar documents"}
            </div>
          )}
          {!isFetching && !error && hits.length === 0 && (
            <div className="py-2 text-center text-xs text-gray-500">No similar documents found.</div>
          )}
          {hits.length > 0 && (
            <div className="space-y-1.5">
              {hits.map((hit) => (
                <div
                  key={hit.id}
                  className="cursor-pointer rounded-md border border-gray-200 bg-white p-2 transition-colors hover:border-dfrntBlue-400"
                  onClick={() => onSelectDocument?.(hit.id)}
                  onKeyDown={(e) => { if (e.key === "Enter") onSelectDocument?.(hit.id); }}
                  tabIndex={0}
                  role="button"
                >
                  {hit.chunk?.snippet && (
                    <div className="mb-1 line-clamp-2 text-sm text-gray-900 leading-relaxed overflow-hidden text-ellipsis">
                      {hit.chunk.snippet}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span className="break-all">{hit.id}</span>
                    <SimilarityBadge distance={hit.distance} size="sm" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
