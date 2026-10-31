import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRunMigrationMutation, useAppSelector } from "@/store";
import type { MigrationOp } from "@/lib/schemaModel/migrationOps";
import { describeApiError, type ApiErrorDetail } from "@/utils/apiErrors";
import { ApiErrorBlock } from "@/components/ApiErrorBlock";
import { ModelDialog } from "@/components/ModelDialog";
import { autoMigrationMessage, migrationPathFor, useApplyMigration } from "./applyEdit";

interface Props {
  readonly open: boolean;
  readonly elementId: string;
  readonly ops: MigrationOp[];
  readonly schemaPath: string;
  readonly onClose: () => void;
  /** Document count of the affected class — shown when known. */
  readonly docCount?: number;
}

// Strengthening ops: dry-run on open, show affected counts, confirm applies.
export function MigrationWarningModal({ open, elementId, ops, schemaPath, onClose, docCount }: Props) {
  const { t } = useTranslation();
  const username = useAppSelector((s) => s.auth.username ?? "admin");
  const [runMigration] = useRunMigrationMutation();
  const applyMigration = useApplyMigration();
  const [dryRun, setDryRun] = useState<{ schemaOps?: number; instanceOps?: number } | null>(null);
  const [error, setError] = useState<ApiErrorDetail | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDryRun(null);
    setError(null);
    setChecking(true);
    runMigration({
      path: migrationPathFor(schemaPath),
      author: username,
      message: autoMigrationMessage(ops),
      operations: ops,
      dryRun: true,
    })
      .unwrap()
      .then((res) => setDryRun({ schemaOps: res.schema_operations, instanceOps: res.instance_operations }))
      .catch((err) => setError(describeApiError(err)))
      .finally(() => setChecking(false));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;
  return (
    <ModelDialog open={open} onClose={onClose} widthClass="w-[32rem]" title={t("model.migration.warningTitle", { id: elementId })}>
        <pre className="mb-2 max-h-40 overflow-auto rounded bg-gray-50 p-2 text-[11px] dark:bg-gray-950">
          {JSON.stringify(ops, null, 2)}
        </pre>
        {docCount !== undefined && docCount > 0 && (
          <div className="mb-2 rounded bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            {t("model.migration.documentsAffected", { count: docCount, id: elementId })}
          </div>
        )}
        {checking && <div className="text-xs text-gray-500">{t("model.migration.dryRunRunning")}</div>}
        {dryRun && (
          <div className="mb-2 rounded bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            {t("model.migration.dryRunResult", { schemaOps: dryRun.schemaOps ?? 0, instanceOps: dryRun.instanceOps ?? 0 })}
          </div>
        )}
        {error && <ApiErrorBlock error={error} />}
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" className="rounded px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className="rounded bg-red-600 px-3 py-1 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            disabled={checking || error !== null}
            onClick={async () => {
              await applyMigration({ path: schemaPath, elementId, ops });
              onClose();
            }}
          >
            {t("model.migration.applyAnyway")}
          </button>
        </div>
    </ModelDialog>
  );
}
