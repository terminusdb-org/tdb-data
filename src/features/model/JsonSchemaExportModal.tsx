import { useTranslation } from "react-i18next";
import { useGetJsonSchemaQuery } from "@/store";
import { ApiErrorBlock } from "@/components/ApiErrorBlock";
import { ModelDialog } from "@/components/ModelDialog";
import { describeApiError, type ApiErrorDetail } from "@/utils/apiErrors";
import { strictJsonSchema } from "@/lib/schemaModel/jsonSchema";
import { exampleFromJsonSchema } from "@/lib/schemaModel/exampleDocument";
import type { SchemaModel } from "@/lib/schemaModel/types";
import { useEffect, useMemo, useState } from "react";

interface Props {
  readonly open: boolean;
  readonly elementId: string;
  readonly schemaPath: string;
  readonly model: SchemaModel;
  readonly onClose: () => void;
}

export function JsonSchemaExportModal({ open, elementId, schemaPath, model, onClose }: Props) {
  const { t } = useTranslation();
  const { data, error, isLoading } = useGetJsonSchemaQuery({ path: schemaPath, type: elementId }, { skip: !open });
  const [copied, setCopied] = useState(false);
  const [detail, setDetail] = useState<ApiErrorDetail | null>(null);
  const [view, setView] = useState<"schema" | "example">("schema");

  const strict = useMemo<Record<string, unknown> | undefined>(
    () => (data ? (strictJsonSchema(data, model) as Record<string, unknown>) : undefined),
    [data, model]
  );

  const example = useMemo(() => (strict ? exampleFromJsonSchema(strict, model) : undefined), [strict, model]);
  const shown = view === "schema" ? strict : example;

  useEffect(() => {
    if (error) setDetail(describeApiError(error));
  }, [error]);

  if (!open) return null;

  const tabCls = (active: boolean) =>
    `rounded px-2 py-0.5 text-xs ${active ? "bg-gray-200 font-medium text-gray-900 dark:bg-gray-700 dark:text-gray-100" : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"}`;

  return (
    <ModelDialog open={open} onClose={onClose} widthClass="w-[36rem]" title={t("model.export.title", { id: elementId })}>
        {isLoading && <div className="text-xs text-gray-500">{t("schema.loadingSchema")}</div>}
        {detail && <ApiErrorBlock error={detail} />}
        {shown !== undefined && (
          <>
            <div className="mb-1 flex gap-1" role="tablist">
              <button type="button" role="tab" aria-selected={view === "schema"} className={tabCls(view === "schema")} onClick={() => setView("schema")}>
                {t("model.export.tabSchema")}
              </button>
              <button type="button" role="tab" aria-selected={view === "example"} className={tabCls(view === "example")} onClick={() => setView("example")}>
                {t("model.export.tabExample")}
              </button>
            </div>
            <pre className="max-h-96 overflow-auto rounded bg-gray-50 p-2 text-[11px] dark:bg-gray-950">
              {JSON.stringify(shown, null, 2)}
            </pre>
          </>
        )}
        <div className="mt-3 flex justify-end gap-2">
          {shown !== undefined && (
            <button
              type="button"
              className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
              onClick={() => {
                void navigator.clipboard.writeText(JSON.stringify(shown, null, 2));
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? t("common.copied") : t("common.copy")}
            </button>
          )}
          <button type="button" className="rounded px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800" onClick={onClose}>
            {t("common.close")}
          </button>
        </div>
    </ModelDialog>
  );
}
