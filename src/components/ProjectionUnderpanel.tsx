import React from "react";
import { useTranslation } from "react-i18next";

export interface ProjectionUnderpanelProps {
  readonly selectedId: string | null;
  readonly docType: string | null;
  readonly document: Record<string, unknown> | null;
  readonly isLoading: boolean;
}

export const ProjectionUnderpanel: React.FC<ProjectionUnderpanelProps> = ({
  selectedId,
  docType,
  document,
  isLoading,
}) => {
  const { t } = useTranslation();
  if (!selectedId) {
    return (
      <div className="border-t border-gray-200 bg-white px-4 py-3 text-sm text-gray-400">
        {t("projectionUnderpanel.clickToView")}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="border-t border-gray-200 bg-white px-4 py-3 text-sm text-gray-400">
        {t("projectionUnderpanel.loadingDoc")}
      </div>
    );
  }

  if (!document) {
    return (
      <div className="border-t border-gray-200 bg-white px-4 py-3 text-sm text-gray-400">
        {t("projectionUnderpanel.noDocFound", { id: selectedId })}
      </div>
    );
  }

  return (
    <div className="max-h-64 overflow-auto border-t border-gray-200 bg-white px-4 py-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700">{selectedId}</span>
        {docType && (
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
            {docType}
          </span>
        )}
      </div>
      <pre className="overflow-auto break-all whitespace-pre-wrap text-xs text-gray-600" style={{ overflowWrap: "break-word", wordBreak: "break-all" }}>
        {JSON.stringify(document, null, 2)}
      </pre>
    </div>
  );
};
