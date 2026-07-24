import React from "react";
import { useTranslation } from "react-i18next";
import { useIndexerStatus } from "@/hooks/useIndexerStatus";

export const IndexerStatusPanel: React.FC = () => {
  const { t } = useTranslation();
  const { state, configured, available, backend, isLoading } = useIndexerStatus();

  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-gray-900">{t("indexer.title")}</h3>
        <p className="mt-2 text-sm text-gray-500">{t("indexer.loadingStatus")}</p>
      </div>
    );
  }

  function deriveStateVisuals(): { color: string; label: string; msg: string } {
    if (state === "operational") {
      return {
        color: "bg-green-100 text-green-700",
        label: t("indexer.operational"),
        msg: t("indexer.operationalMessage"),
      };
    }
    if (state === "not_available") {
      return {
        color: "bg-amber-100 text-amber-700",
        label: t("indexer.notAvailable"),
        msg: t("indexer.notAvailableMessage", { backend }),
      };
    }
    return {
      color: "bg-gray-100 text-gray-600",
      label: t("indexer.notConfigured"),
      msg: t("indexer.notConfiguredMessage"),
    };
  }

  const { color: stateColor, label: stateLabel, msg: message } = deriveStateVisuals();

  const panelClass =
    state === "operational"
      ? "border-gray-200 bg-white"
      : "border-amber-300 bg-amber-50";

  return (
    <div className={`rounded-lg border p-4 ${panelClass}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">{t("indexer.title")}</h3>
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${stateColor}`}>
          {stateLabel}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
        <span>
          {t("indexer.backend")}: <span className="font-medium text-gray-700">{backend}</span>
        </span>
        <span>
          {t("indexer.configured")}:{" "}
          <span className={`font-medium ${configured ? "text-green-600" : "text-gray-400"}`}>
            {configured ? t("indexer.configured") : t("indexer.notConfigured")}
          </span>
        </span>
        <span>
          {t("indexer.available")}:{" "}
          <span className={`font-medium ${available ? "text-green-600" : "text-gray-400"}`}>
            {available ? t("indexer.available") : t("indexer.notAvailable")}
          </span>
        </span>
      </div>
      {state !== "operational" && (
        <p className="mt-3 text-sm text-gray-600">{message}</p>
      )}
    </div>
  );
};

export const IndexerDisabledNotice: React.FC<{ className?: string }> = ({ className = "" }) => {
  const { t } = useTranslation();
  const { state, isLoading } = useIndexerStatus();

  if (isLoading || state === "operational") return null;

  return (
    <div className={`rounded-lg border border-amber-300 bg-amber-50 p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
        </svg>
        <div>
          <p className="text-sm font-medium text-amber-800">
            {t("indexer.featuresDisabled")}
          </p>
          <p className="mt-1 text-sm text-amber-700">
            {state === "not_configured"
              ? t("indexer.notConfiguredMessage")
              : t("indexer.notAvailableMessage", { backend: "" })}
          </p>
        </div>
      </div>
    </div>
  );
};

export function useIndexerDisabled(): boolean {
  const { state, isLoading } = useIndexerStatus();
  return !isLoading && state !== "operational";
}
