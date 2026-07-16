import React from "react";
import { useTranslation } from "react-i18next";
import { SimilarityBadge } from "./SimilarityBadge";

export interface DupPanelGroup {
  readonly distance: number;
  readonly members: ReadonlyArray<string>;
}

export interface DuplicateHighlightPanelProps {
  readonly groups: ReadonlyArray<DupPanelGroup>;
  readonly onHighlight: (ids: ReadonlySet<string>) => void;
  readonly onAddToWorkingSet?: (ids: string[]) => void;
  readonly showDuplicates: boolean;
  readonly onToggleLoadDuplicates: () => void;
  readonly duplicatesLoading: boolean;
}

export const DuplicateHighlightPanel: React.FC<DuplicateHighlightPanelProps> = ({
  groups,
  onHighlight,
  onAddToWorkingSet,
  showDuplicates,
  onToggleLoadDuplicates,
  duplicatesLoading,
}) => {
  const { t } = useTranslation();
  return (
    <div className="p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          {t("duplicateHighlightPanel.title")}{showDuplicates && groups.length > 0 && ` (${groups.length})`}
        </span>
        <button
          type="button"
          className={
            showDuplicates
              ? "rounded bg-dfrntBlue-500 px-2 py-0.5 text-xs font-medium text-white"
              : "rounded border border-gray-300 px-2 py-0.5 text-xs font-medium text-gray-600"
          }
          onClick={onToggleLoadDuplicates}
          disabled={duplicatesLoading}
        >
          {duplicatesLoading
            ? t("common.loading")
            : showDuplicates
              ? t("duplicateHighlightPanel.hide")
              : t("duplicateHighlightPanel.load")}
        </button>
      </div>
      <div className="overflow-auto">
        {!showDuplicates && (
          <div className="py-4 text-center text-xs text-gray-400">
            {t("duplicateHighlightPanel.clickLoad")}
          </div>
        )}
        {showDuplicates && duplicatesLoading && (
          <div className="flex items-center justify-center py-4 text-xs text-gray-400">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-dfrntBlue-500" />
            <span className="ml-2">{t("duplicateHighlightPanel.finding")}</span>
          </div>
        )}
        {showDuplicates && !duplicatesLoading && groups.length === 0 && (
          <div className="py-4 text-center text-xs text-gray-400">
            {t("duplicateHighlightPanel.none")}
          </div>
        )}
        {groups.map((group, i) => (
          <div
            key={i}
            className="border-b border-gray-50 py-2 hover:bg-gray-50"
            onMouseEnter={() => onHighlight(new Set(group.members))}
            onMouseLeave={() => onHighlight(new Set())}
            onFocus={() => onHighlight(new Set(group.members))}
            onBlur={() => onHighlight(new Set())}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onHighlight(new Set(group.members)); } }}
          >
            <div className="mb-1 flex items-center gap-2">
              <SimilarityBadge distance={group.distance} />
              <span className="text-xs text-gray-400">
                {group.members.length} {t("duplicateHighlightPanel.docs")}
              </span>
              {onAddToWorkingSet && (
                <button
                  type="button"
                  className="ml-auto rounded border border-gray-300 px-1.5 py-0.5 text-xs font-medium text-gray-500 hover:bg-gray-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddToWorkingSet(group.members as readonly string[] as string[]);
                  }}
                  title={t("duplicateHighlightPanel.addGroupToWorkingSet")}
                >
                  {t("duplicateHighlightPanel.addSet")}
                </button>
              )}
            </div>
            <div className="space-y-0.5">
              {group.members.map((id) => (
                <div
                  key={id}
                  className="truncate text-xs text-gray-600"
                  title={id}
                >
                  {id}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
