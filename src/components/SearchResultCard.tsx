import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useGetDocumentQuery } from "@/store";
import type { SearchHit } from "@/types/terminusdb";
import { SimilarityBadge } from "./SimilarityBadge";
import { DocumentPreviewModal } from "./DocumentPreviewModal";
import { SimilarDocumentsPanel } from "./SimilarDocumentsPanel";
import { highlightTerms } from "@/utils/highlight";
import type { RouteParams } from "@/utils/routes";

interface SearchResultCardProps {
  readonly hit: SearchHit;
  readonly query?: string;
  readonly routeParams: RouteParams;
  readonly similarPath: string;
  readonly docPath: string;
  readonly showSimilarButton?: boolean;
}

const typeColors: Record<string, string> = {
  default: "bg-gray-100 text-gray-600",
};

function getTypeColor(type: string | null): string {
  return typeColors[type ?? ""] ?? typeColors.default;
}

export const SearchResultCard: React.FC<SearchResultCardProps> = ({
  hit,
  query = "",
  routeParams,
  similarPath,
  docPath,
  showSimilarButton = true,
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [showSimilar, setShowSimilar] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: docData } = useGetDocumentQuery(
    { path: docPath, id: hit.id },
    { skip: !showPreview }
  );

  const navigateToDoc = () => {
    navigate(
      `/${routeParams.org}/${routeParams.team}/local/${routeParams.refType}/${routeParams.refName}/documents?edit=${encodeURIComponent(hit.id)}`
    );
  };

  const handleCopyId = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(hit.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group rounded-lg border border-gray-200 bg-white p-4 transition-all hover:border-dfrntBlue-300 hover:shadow-sm">
      {/* Top row: type badge + similarity */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {hit.doc_type && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getTypeColor(hit.doc_type)}`}>
              {hit.doc_type}
            </span>
          )}
          <SimilarityBadge distance={hit.distance} size="sm" />
        </div>
      </div>

      {/* Snippet */}
      {hit.chunk?.snippet && (
        <div
          className="mb-2 cursor-pointer text-sm leading-relaxed text-gray-800"
          onClick={navigateToDoc}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigateToDoc(); } }}
          role="button"
          tabIndex={0}
        >
          <span className="line-clamp-3">
            {highlightTerms(String(hit.chunk.snippet), query)}
          </span>
        </div>
      )}

      {/* Bottom row: ID + actions */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={navigateToDoc}
          className="flex items-center gap-1 text-xs text-gray-400 transition-colors hover:text-dfrntBlue-600"
        >
          <span className="font-data break-all">{hit.id}</span>
        </button>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowPreview(true); }}
            className="rounded-md px-2 py-0.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            {t("searchResultCard.preview")}
          </button>
          {showSimilarButton && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowSimilar(!showSimilar); }}
              className="rounded-md px-2 py-0.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
            >
              {showSimilar ? t("searchResultCard.hide") : t("searchResultCard.similar")}
            </button>
          )}
          <button
            type="button"
            onClick={handleCopyId}
            className="rounded-md px-2 py-0.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            {copied ? t("searchResultCard.copied") : t("searchResultCard.copyId")}
          </button>
        </div>
      </div>

      {/* Inline similar panel */}
      {showSimilar && showSimilarButton && (
        <div className="mt-3">
          <SimilarDocumentsPanel
            similarPath={similarPath}
            documentId={hit.id}
            onSelectDocument={(id) =>
              navigate(
                `/${routeParams.org}/${routeParams.team}/local/${routeParams.refType}/${routeParams.refName}/documents?edit=${encodeURIComponent(id)}`
              )
            }
          />
        </div>
      )}

      {/* Preview modal */}
      {showPreview && (
        <DocumentPreviewModal
          documentId={hit.id}
          docData={docData}
          onClose={() => setShowPreview(false)}
          onOpenFull={navigateToDoc}
        />
      )}
    </div>
  );
};
