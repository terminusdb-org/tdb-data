import React, { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useGetSchemaQuery, useGetIndexStatusQuery, useTriggerIndexMutation, useDeleteIndexMutation,
  useGetClusteringQuery, useToggleClusteringMutation,
  useGraphqlDocumentCountQuery,
} from "@/store";
import { isSubdocument } from "@/types/terminusdb";
import { PageShell, PageHeader, PagePlaceholder, btnSecondary, useRouteParams, ConfirmDialog } from "@/components";
import { buildApiPath } from "@/utils/routes";
import type { SchemaClass, IndexStatus } from "@/types/terminusdb";

interface TypeCount {
  readonly type: string;
  readonly count: number;
}

const statusColors: Record<string, string> = {
  indexing: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  not_found: "bg-gray-100 text-gray-600",
  error: "bg-red-100 text-red-700",
  indexer_unavailable: "bg-amber-100 text-amber-700",
};

function StatCard({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-4 ${highlight ? "border-amber-300 bg-amber-50" : "border-gray-200 bg-white"}`}>
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-gray-900">
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
    </div>
  );
}

function truncateId(id: string | null | undefined, maxLen = 24): string {
  if (!id) return "—";
  if (id.length <= maxLen) return id;
  return `${id.slice(0, maxLen - 3)}…`;
}

export const IndexStatsPage: React.FC = () => {
  const { t } = useTranslation();
  const routeParams = useRouteParams();
  const [triggerIndex] = useTriggerIndexMutation();
  const [deleteIndex] = useDeleteIndexMutation();
  const [triggerStatus, setTriggerStatus] = useState<"" | "indexing" | "success" | "error">("");
  const [reindexStatus, setReindexStatus] = useState<"" | "deleting" | "indexing" | "success" | "error">("");

  const schemaPath = routeParams ? buildApiPath(routeParams, "schema") : "";
  const indexPath = routeParams ? buildApiPath(routeParams, "index") : "";
  const graphqlPath = routeParams ? buildApiPath(routeParams, "graphql") : "";

  const { data: clusteringData, isError: clusteringIsError, refetch: refetchClustering } = useGetClusteringQuery(
    { path: schemaPath },
    { skip: !routeParams },
  );
  const [toggleClustering, { isLoading: clusteringToggling }] = useToggleClusteringMutation();
  const [clusteringError, setClusteringError] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const doToggleClustering = useCallback(async (enable: boolean, action: string) => {
    if (!routeParams) return;
    try {
      await toggleClustering({
        org: routeParams.org,
        db: routeParams.team,
        enable,
      }).unwrap();
      refetchClustering();
    } catch (err) {
      const errData = (err as { data?: Record<string, unknown> }).data;
      const msg = String(errData?.["api:message"] ?? errData?.["api:status"] ?? t("indexStats.failedToToggleClustering", { action }));
      setClusteringError(msg);
    }
  }, [routeParams, toggleClustering, refetchClustering, t]);

  const handleToggleClustering = useCallback(async () => {
    if (!routeParams) return;
    setClusteringError(null);
    const current = clusteringData?.storeClustering ?? false;
    const action = current ? "disable" : "enable";
    setConfirmState({
      title: t("indexStats.toggleClusteringTitle", { action: action === "enable" ? t("common.enable") : t("common.disable") }),
      message: t("indexStats.toggleClusteringMessage", { action: action === "enable" ? t("common.enable") : t("common.disable"), org: routeParams.org, team: routeParams.team }),
      onConfirm: () => {
        setConfirmState(null);
        void doToggleClustering(!current, action);
      },
    });
  }, [routeParams, clusteringData, doToggleClustering, t]);

  const { data: schemaClasses, refetch: refetchSchema } = useGetSchemaQuery(
    { path: schemaPath, asList: true },
    { skip: !routeParams },
  );

  const { data: indexStatus, isLoading: indexLoading, error: indexError, refetch: refetchIndex } = useGetIndexStatusQuery(
    { path: indexPath },
    { skip: !routeParams, refetchOnMountOrArgChange: true },
  );

  const docTypes = useMemo(() => {
    if (!schemaClasses) return [];
    return schemaClasses
      .filter((c: SchemaClass) => c["@type"] === "Class" && !isSubdocument(c))
      .map((c) => c["@id"])
      .sort((a, b) => a.localeCompare(b));
  }, [schemaClasses]);

  const { data: graphqlCounts, isLoading: countsLoading, error: countErrorObj, refetch: refetchCounts } = useGraphqlDocumentCountQuery(
    { path: graphqlPath, types: docTypes },
    { skip: !routeParams || docTypes.length === 0 },
  );

  const typeCounts = useMemo<TypeCount[]>(() => {
    if (!graphqlCounts || docTypes.length === 0) return [];
    return docTypes.map((type, i) => ({ type, count: graphqlCounts[`t${i}`] ?? 0 }));
  }, [graphqlCounts, docTypes]);

  const totalDocs = useMemo(() => {
    if (typeCounts.length === 0) return null;
    return typeCounts.reduce((s, c) => s + c.count, 0);
  }, [typeCounts]);

  const loadingCounts = countsLoading;
  const countError = countErrorObj
    ? (countErrorObj as { data?: Record<string, unknown> }).data?.["api:message"] as string ?? undefined
    : null;

  const handleTriggerIndex = useCallback(async () => {
    if (!indexPath) return;
    setTriggerStatus("indexing");
    try {
      await triggerIndex({ path: indexPath }).unwrap();
      setTriggerStatus("success");
      refetchIndex();
      refetchCounts();
      setTimeout(() => setTriggerStatus(""), 5000);
    } catch (err: unknown) {
      console.error(t("indexStats.triggerIndexFailed"), err);
      setTriggerStatus("error");
      setTimeout(() => setTriggerStatus(""), 5000);
    }
  }, [indexPath, triggerIndex, refetchIndex, refetchCounts, t]);

  const handleReindex = useCallback(async () => {
    if (!indexPath) return;
    setReindexStatus("deleting");
    try {
      await deleteIndex({ path: indexPath }).unwrap();
      setReindexStatus("indexing");
      await triggerIndex({ path: indexPath }).unwrap();
      setReindexStatus("success");
      refetchIndex();
      refetchCounts();
      setTimeout(() => setReindexStatus(""), 5000);
    } catch (err: unknown) {
      console.error(t("indexStats.reindexFailed"), err);
      setReindexStatus("error");
      setTimeout(() => setReindexStatus(""), 5000);
    }
  }, [indexPath, deleteIndex, triggerIndex, refetchIndex, refetchCounts, t]);

  const handleRefresh = useCallback(() => {
    refetchIndex();
    refetchCounts();
    refetchSchema();
    refetchClustering();
  }, [refetchIndex, refetchCounts, refetchSchema, refetchClustering]);

  if (!routeParams) return <PagePlaceholder>{t("common.selectDataProduct")}</PagePlaceholder>;

  const idx = indexStatus as IndexStatus | undefined;
  const bp = idx?.branch_processing;
  const eng = idx?.engine;
  const statusColor = idx?.status ? statusColors[idx.status] ?? "bg-gray-100 text-gray-600" : "";

  const indexErrObj = indexError as Record<string, unknown> | undefined;
  const indexErrData = indexErrObj?.["data"] as Record<string, unknown> | undefined;
  const indexErrMessage = indexErrData?.["api:message"] as string | undefined;

  const commitProgress = bp && bp.total_commits && bp.total_commits > 0
    ? Math.round(((bp.commits_processed ?? 0) / bp.total_commits) * 100)
    : null;

  return (
    <>
    <PageShell
      header={
        <PageHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">{t("indexStats.title")}</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTriggerIndex}
                disabled={triggerStatus === "indexing" || reindexStatus === "deleting" || reindexStatus === "indexing"}
                className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                  triggerStatus === "success"
                    ? "bg-green-100 text-green-700"
                    : triggerStatus === "error"
                    ? "bg-red-100 text-red-700"
                    : "bg-gray-100 text-gray-600 hover:bg-dfrntBlue-50 hover:text-dfrntBlue-700"
                }`}
              >
                {triggerStatus === "indexing" ? t("indexStats.indexing") : triggerStatus === "success" ? t("indexStats.indexTriggered") : triggerStatus === "error" ? t("indexStats.indexFailed") : t("indexStats.triggerIndex")}
              </button>
              <button
                type="button"
                onClick={handleReindex}
                disabled={triggerStatus === "indexing" || reindexStatus === "deleting" || reindexStatus === "indexing"}
                className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                  reindexStatus === "success"
                    ? "bg-green-100 text-green-700"
                    : reindexStatus === "error"
                    ? "bg-red-100 text-red-700"
                    : "bg-gray-100 text-gray-600 hover:bg-amber-50 hover:text-amber-700"
                }`}
              >
                {reindexStatus === "deleting" ? t("indexStats.deleting") : reindexStatus === "indexing" ? t("indexStats.indexing") : reindexStatus === "success" ? t("indexStats.reindexed") : reindexStatus === "error" ? t("indexStats.reindexFailed") : t("indexStats.reindex")}
              </button>
              <button
                type="button"
                onClick={handleRefresh}
                disabled={loadingCounts || indexLoading}
                className={btnSecondary}
              >
                {loadingCounts || indexLoading ? t("indexStats.refreshing") : t("indexStats.refresh")}
              </button>
            </div>
          </div>
        </PageHeader>
      }
    >
      <div className="space-y-6 p-4">
        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label={t("indexStats.totalDocuments")} value={totalDocs !== null ? totalDocs : "—"} />
          <StatCard label={t("indexStats.indexedDocuments")} value={eng?.searchable_documents ?? "—"} />
          <StatCard label={t("indexStats.documentTypes")} value={docTypes.length} />
          <StatCard label={t("indexStats.textSegmentsIndexed")} value={eng?.text_segments_indexed ?? "—"} />
        </div>

        {/* Document counts by type */}
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-900">{t("indexStats.documentsByType")}</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {loadingCounts && typeCounts.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500">{t("indexStats.countingDocuments")}</div>
            ) : typeCounts.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500">{t("indexStats.noDocumentTypesFound")}</div>
            ) : (
              typeCounts.map(({ type, count }) => (
                <div key={type} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="font-medium text-gray-700">{type}</span>
                  <span className="font-data tabular-nums text-gray-900">{count.toLocaleString()}</span>
                </div>
              ))
            )}
            {countError && (
              <div className="px-4 py-2 text-xs text-red-600">{t("indexStats.errorCountingDocuments")} {countError}</div>
            )}
          </div>
        </div>

        {/* Index Status */}
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-900">{t("indexStats.indexStatus")}</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {indexLoading && (
              <div className="px-4 py-3 text-sm text-gray-500">{t("indexStats.loadingIndexStatus")}</div>
            )}
            {indexErrMessage && !indexLoading && (
              <div className="px-4 py-3 text-sm text-amber-600">
                {t("indexStats.indexStatusUnavailable")} {indexErrMessage}
              </div>
            )}
            {!indexLoading && !indexErrMessage && idx && (
              <>
                <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="font-medium text-gray-700">{t("indexStats.status")}</span>
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusColor}`}>
                    {idx.status ?? t("indexStats.unknown")}
                  </span>
                </div>
                {idx.error && (
                  <div className="px-4 py-2.5 text-sm text-red-600">
                    <span className="font-medium">{t("common.error")}: </span>{idx.error}
                  </div>
                )}
                <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="font-medium text-gray-700">{t("indexStats.branch")}</span>
                  <span className="font-data text-gray-900">{idx.branch ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="font-medium text-gray-700">{t("indexStats.lastIndexedCommit")}</span>
                  <span className="font-data text-gray-900" title={idx.last_indexed_commit ?? undefined}>
                    {truncateId(idx.last_indexed_commit)}
                  </span>
                </div>
              </>
            )}
            {!indexLoading && !indexErrMessage && !idx && (
              <div className="px-4 py-3 text-sm text-gray-500">{t("indexStats.noIndexStatusAvailable")}</div>
            )}
          </div>
        </div>

        {/* Clustering */}
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-900">{t("indexStats.clustering")}</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {clusteringIsError ? (
              <div className="px-4 py-3 text-sm text-gray-500">{t("indexStats.clusteringUnavailable")}</div>
            ) : clusteringData ? (
              <div className="flex items-center justify-between px-4 py-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${clusteringData.storeClustering ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                    {clusteringData.storeClustering ? t("indexStats.clustering") : t("indexStats.noClustering")}
                  </span>
                  <span className="text-xs text-gray-500">
                    {clusteringData.storeClustering
                      ? t("indexStats.clusteringEmbeddingsStored")
                      : t("indexStats.clusteringEmbeddingsNotStored")}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleToggleClustering}
                  disabled={clusteringToggling}
                  className="rounded px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition-colors"
                >
                  {clusteringToggling ? "…" : clusteringData.storeClustering ? t("common.disable") : t("common.enable")}
                </button>
              </div>
            ) : (
              <div className="px-4 py-3 text-sm text-gray-500">{t("indexStats.loadingClusteringStatus")}</div>
            )}
            <div className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span className="font-medium text-gray-700">{t("indexStats.indexEngineStatus")}</span>
              {idx?.engine?.store_clustering === true ? (
                <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">{t("indexStats.clusteringActive")}</span>
              ) : idx?.engine?.store_clustering === false ? (
                <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{t("indexStats.clusteringInactive")}</span>
              ) : (
                <span className="text-xs text-gray-400">{t("indexStats.unknownEngineUnavailable")}</span>
              )}
            </div>
            {clusteringError && (
              <div className="px-4 py-2 text-xs text-red-600">{clusteringError}</div>
            )}
          </div>
        </div>

        {/* Branch Processing Progress */}
        {bp && (
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-200 px-4 py-3">
              <h3 className="text-sm font-semibold text-gray-900">{t("indexStats.branchProcessingProgress")}</h3>
            </div>
            <div className="divide-y divide-gray-100">
              <div className="px-4 py-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-700">{t("indexStats.commitsProcessed")}</span>
                  <span className="font-data tabular-nums text-gray-900">
                    {bp.commits_processed ?? 0} / {bp.total_commits ?? 0}
                  </span>
                </div>
                {commitProgress !== null && (
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200">
                    <div
                      className="h-full bg-dfrntBlue-500 transition-all"
                      style={{ width: `${commitProgress}%` }}
                    />
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="font-medium text-gray-700">{t("indexStats.currentCommit")}</span>
                <span className="font-data text-gray-900" title={bp.current_commit ?? undefined}>
                  {truncateId(bp.current_commit)}
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="font-medium text-gray-700">{t("indexStats.upcomingCommit")}</span>
                <span className="font-data text-gray-900" title={bp.upcoming_commit ?? undefined}>
                  {bp.upcoming_commit ? truncateId(bp.upcoming_commit) : t("indexStats.noneAtHead")}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Engine Statistics */}
        {eng && (
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-200 px-4 py-3">
              <h3 className="text-sm font-semibold text-gray-900">{t("indexStats.engineStatistics")}</h3>
            </div>
            <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3">
              <StatCard label={t("indexStats.processedDocuments")} value={eng.processed_documents ?? "—"} />
              <StatCard label={t("indexStats.totalDocuments")} value={eng.total_documents ?? "—"} />
              <StatCard label={t("indexStats.documentsSent")} value={eng.documents_sent ?? "—"} />
              <StatCard label={t("indexStats.searchableDocuments")} value={eng.searchable_documents ?? "—"} />
              <StatCard label={t("indexStats.textSegmentsIndexed")} value={eng.text_segments_indexed ?? "—"} />
              <StatCard label={t("indexStats.commitsReceived")} value={eng.commits_received ?? "—"} />
              <StatCard
                label={t("indexStats.pendingUpdates")}
                value={eng.pending_updates ?? 0}
                highlight={(eng.pending_updates ?? 0) > 0}
              />
            </div>
          </div>
        )}
      </div>
    </PageShell>
      <ConfirmDialog
        open={confirmState !== null}
        title={confirmState?.title ?? ""}
        message={confirmState?.message ?? ""}
        confirmLabel={t("common.confirm")}
        destructive
        onConfirm={() => confirmState?.onConfirm()}
        onCancel={() => setConfirmState(null)}
      />
    </>
  );
};
