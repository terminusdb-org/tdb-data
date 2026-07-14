import React, { useEffect, useState } from "react";
import { useGetDocumentQuery, useGetEmbeddingTextQuery } from "@/store";
import type { ResolveMatch } from "@/types/terminusdb";
import { SimilarityBadge } from "./SimilarityBadge";

type ViewTab = "document" | "embedding";

interface MatchComparisonModalProps {
  readonly matches: ReadonlyArray<ResolveMatch>;
  readonly initialIndex: number;
  readonly docPath: string;
  readonly onClose: () => void;
  readonly onOpenFull: (id: string) => void;
}

const Spinner: React.FC = () => (
  <div className="flex items-center justify-center py-12">
    <svg className="h-5 w-5 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  </div>
);

export const MatchComparisonModal: React.FC<MatchComparisonModalProps> = ({
  matches,
  initialIndex,
  docPath,
  onClose,
  onOpenFull,
}) => {
  const [index, setIndex] = useState(initialIndex);
  const [viewTab, setViewTab] = useState<ViewTab>("document");
  const match = matches[index];

  const { data: setDoc, isFetching: setFetching } = useGetDocumentQuery(
    { path: docPath, id: match.set_id },
    { skip: !match },
  );
  const { data: targetDoc, isFetching: targetFetching } = useGetDocumentQuery(
    { path: docPath, id: match.target_id },
    { skip: !match },
  );
  const { data: setEmbedding, isFetching: setEmbFetching } = useGetEmbeddingTextQuery(
    { path: docPath, id: match.set_id },
    { skip: !match || viewTab !== "embedding" },
  );
  const { data: targetEmbedding, isFetching: targetEmbFetching } = useGetEmbeddingTextQuery(
    { path: docPath, id: match.target_id },
    { skip: !match || viewTab !== "embedding" },
  );

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && index > 0) setIndex(index - 1);
      if (e.key === "ArrowRight" && index < matches.length - 1) setIndex(index + 1);
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose, index, matches.length]);

  if (!match) return null;

  const setLoading = viewTab === "document" ? setFetching : setEmbFetching;
  const targetLoading = viewTab === "document" ? targetFetching : targetEmbFetching;
  const setData = viewTab === "document" ? setDoc : setEmbedding;
  const targetData = viewTab === "document" ? targetDoc : targetEmbedding;

  const renderContent = (data: unknown, loading: boolean) => {
    if (loading) return <Spinner />;
    if (data) {
      const text = typeof data === "string" ? data : JSON.stringify(data, null, 2);
      return <pre className="whitespace-pre-wrap text-xs text-gray-700">{text}</pre>;
    }
    return <div className="py-8 text-center text-xs text-gray-400">No data</div>;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-gray-900">
              Match {index + 1} of {matches.length}
            </h3>
            <SimilarityBadge distance={match.distance} size="sm" />
            <span className="text-xs text-gray-400">{match.stage}</span>
          </div>
          <div className="flex items-center gap-3">
            {/* View tabs */}
            <div className="flex gap-1 rounded-md bg-gray-100 p-0.5">
              <button
                type="button"
                onClick={() => setViewTab("document")}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  viewTab === "document" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Document
              </button>
              <button
                type="button"
                onClick={() => setViewTab("embedding")}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  viewTab === "embedding" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Embedding
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Side-by-side panels with center compare link */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Source */}
          <div className="flex flex-1 flex-col">
            <div className="border-b border-gray-100 px-4 py-2">
              <span className="text-xs font-medium text-gray-400">Source</span>
            </div>
            <div className="font-data text-xs text-gray-500 px-4 py-1 border-b border-gray-50">{match.set_id}</div>
            <div className="flex-1 overflow-auto p-4">
              {renderContent(setData, setLoading)}
            </div>
          </div>

          {/* Center: compare link */}
          <div className="flex flex-col items-center justify-center border-x border-gray-200 px-2">
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => onOpenFull(match.set_id)}
                className="rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700"
                title="Open source document"
              >
                ← Source
              </button>
              <div className="flex flex-col items-center text-gray-300">
                <SimilarityBadge distance={match.distance} size="sm" />
              </div>
              <button
                type="button"
                onClick={() => onOpenFull(match.target_id)}
                className="rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700"
                title="Open target document"
              >
                Target →
              </button>
            </div>
          </div>

          {/* Right: Target */}
          <div className="flex flex-1 flex-col">
            <div className="border-b border-gray-100 px-4 py-2">
              <span className="text-xs font-medium text-gray-400">Target</span>
            </div>
            <div className="font-data text-xs text-gray-500 px-4 py-1 border-b border-gray-50">{match.target_id}</div>
            <div className="flex-1 overflow-auto p-4">
              {renderContent(targetData, targetLoading)}
            </div>
          </div>
        </div>

        {/* Slider scrubber */}
        <div className="border-t border-gray-200 px-5 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIndex(Math.max(0, index - 1))}
              disabled={index === 0}
              className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
            >
              ← Prev
            </button>
            <input
              type="range"
              min={0}
              max={matches.length - 1}
              value={index}
              onChange={(e) => setIndex(Number(e.target.value))}
              className="flex-1 accent-dfrntBlue-500"
            />
            <button
              type="button"
              onClick={() => setIndex(Math.min(matches.length - 1, index + 1))}
              disabled={index === matches.length - 1}
              className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
