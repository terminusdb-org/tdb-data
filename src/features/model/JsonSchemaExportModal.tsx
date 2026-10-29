import { useTranslation } from "react-i18next";
import { useGetJsonSchemaQuery } from "@/store";
import { ApiErrorBlock } from "@/components/ApiErrorBlock";
import { ModelDialog } from "@/components/ModelDialog";
import { describeApiError, type ApiErrorDetail } from "@/utils/apiErrors";
import { strictJsonSchema } from "@/lib/schemaModel/jsonSchema";
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

  const strict = useMemo<Record<string, unknown> | undefined>(
    () => (data ? (strictJsonSchema(data, model) as Record<string, unknown>) : undefined),
    [data, model]
  );

  useEffect(() => {
    if (error) setDetail(describeApiError(error));
  }, [error]);

  if (!open) return null;
  return (
    <ModelDialog open={open} onClose={onClose} widthClass="w-[36rem]" title={t("model.export.title", { id: elementId })}>
        {isLoading && <div className="text-xs text-gray-500">{t("schema.loadingSchema")}</div>}
        {detail && <ApiErrorBlock error={detail} />}
        {strict && (
          <pre className="max-h-96 overflow-auto rounded bg-gray-50 p-2 text-[11px] dark:bg-gray-950">
            {JSON.stringify(strict, null, 2)}
          </pre>
        )}
        <div className="mt-3 flex justify-end gap-2">
          {strict && (
            <button
              type="button"
              className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
              onClick={() => {
                void navigator.clipboard.writeText(JSON.stringify(strict, null, 2));
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
