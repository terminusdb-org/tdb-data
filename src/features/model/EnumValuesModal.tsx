import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { SchemaModel } from "@/lib/schemaModel/types";
import type { SchemaClass } from "@/types/terminusdb";
import { ops as migOps } from "@/lib/schemaModel/migrationOps";
import { useReplaceSchemaDocumentMutation, useAppSelector } from "@/store";
import { describeApiError, type ApiErrorDetail } from "@/utils/apiErrors";
import { ApiErrorBlock } from "@/components/ApiErrorBlock";
import { ModelDialog } from "@/components/ModelDialog";
import { useApplyMigration } from "./applyEdit";

interface Props {
  readonly open: boolean;
  readonly model: SchemaModel;
  readonly classes: SchemaClass[];
  readonly elementId: string;
  readonly schemaPath: string;
  readonly docPath: string;
  readonly onClose: () => void;
}

// Enum values: add via ExpandEnum op; rename/remove attempt a schema doc replace
// and surface the engine's weakening_failure verbatim (decision 8).
export function EnumValuesModal({ open, model, classes, elementId, schemaPath, docPath, onClose }: Props) {
  const { t } = useTranslation();
  const username = useAppSelector((s) => s.auth.username ?? "admin");
  const applyMigration = useApplyMigration();
  const [replaceSchemaDocument] = useReplaceSchemaDocumentMutation();
  const td = model[elementId]?.typeDefinition;
  const values = td?.enumValues ?? [];
  const [filter, setFilter] = useState("");
  const [newValue, setNewValue] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameTo, setRenameTo] = useState("");
  const [error, setError] = useState<ApiErrorDetail | null>(null);

  if (!open || !td) return null;
  const filtered = values.filter((v) => !filter || v.toLowerCase().includes(filter.toLowerCase()));

  const replaceValues = async (nextValues: string[]) => {
    setError(null);
    const cls = classes.find((c) => c["@id"] === elementId);
    if (!cls) return;
    try {
      const { ["@values"]: _v, ["@value"]: _v2, ...rest } = cls as Record<string, unknown>;
      await replaceSchemaDocument({
        path: docPath,
        id: elementId,
        document: { ...rest, "@value": nextValues } as unknown as SchemaClass,
        author: username,
        message: `model: enum values ${elementId}`,
      }).unwrap();
    } catch (err) {
      setError(describeApiError(err));
    }
  };

  const addValue = async () => {
    const v = newValue.trim();
    if (!v || values.includes(v)) return;
    setError(null);
    await applyMigration({ path: schemaPath, elementId, ops: [migOps.expandEnum(elementId, [v])] });
    setNewValue("");
  };

  const doRename = async () => {
    if (!renaming || !renameTo.trim() || values.includes(renameTo.trim())) return;
    await replaceValues(values.map((v) => (v === renaming ? renameTo.trim() : v)));
    setRenaming(null);
  };

  const remove = async (v: string) => replaceValues(values.filter((x) => x !== v));

  const inputCls = "rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-950";

  return (
    <ModelDialog open={open} onClose={onClose} widthClass="w-96" title={t("model.enum.title", { id: elementId })}>
        <div className="mb-2 flex gap-1">
          <input className={`${inputCls} flex-1`} placeholder={t("model.enum.filter")} value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>
        <ul className="mb-2 max-h-60 overflow-y-auto">
          {filtered.map((v) => (
            <li key={v} className="flex items-center gap-1 border-b border-gray-100 py-1 text-sm dark:border-gray-800">
              {renaming === v ? (
                <>
                  <input className={`${inputCls} flex-1`} defaultValue={v} onChange={(e) => setRenameTo(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void doRename()} />
                  <button type="button" className="rounded bg-sky-600 px-2 py-0.5 text-[11px] text-white" onClick={() => void doRename()}>{t("common.save")}</button>
                  <button type="button" className="rounded px-1 text-[11px]" onClick={() => setRenaming(null)}>{t("common.cancel")}</button>
                </>
              ) : (
                <>
                  <span className="flex-1 font-mono">{v}</span>
                  <button type="button" className="rounded px-1 text-[11px] text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950" onClick={() => { setRenaming(v); setRenameTo(v); }}>
                    {t("common.rename")}
                  </button>
                  <button type="button" className="rounded px-1 text-[11px] text-red-600 hover:bg-red-50 dark:hover:bg-red-950" onClick={() => void remove(v)}>
                    {t("common.delete")}
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
        <div className="flex gap-1">
          <input className={`${inputCls} flex-1`} placeholder={t("model.enum.newValue")} value={newValue} onChange={(e) => setNewValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void addValue()} />
          <button type="button" className="rounded bg-sky-600 px-2 py-1 text-xs text-white" onClick={() => void addValue()}>
            {t("common.add")}
          </button>
        </div>
        {error && <div className="mt-2"><ApiErrorBlock error={error} /></div>}
        <div className="mt-3 flex justify-end">
          <button type="button" className="rounded px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800" onClick={onClose}>
            {t("common.close")}
          </button>
        </div>
    </ModelDialog>
  );
}
