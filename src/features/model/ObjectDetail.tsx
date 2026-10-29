import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { SchemaModel } from "@/lib/schemaModel/types";
import type { SchemaClass } from "@/types/terminusdb";
import { ops as migOps, type MigrationOp } from "@/lib/schemaModel/migrationOps";
import { FieldTable } from "./FieldTable";
import { SchemaRawEditor } from "./SchemaRawEditor";
import { EnumValuesModal } from "./EnumValuesModal";
import { MetadataModal } from "./MetadataModal";
import { MigrationWarningModal } from "./MigrationWarningModal";
import type { RouteParams } from "@/utils/routes";

interface Props {
  readonly model: SchemaModel;
  readonly classes: SchemaClass[];
  readonly elementId: string;
  readonly schemaPath: string;
  readonly docPath: string;
  readonly routeParams: RouteParams;
  readonly tab?: string;
  readonly onTabChange: (tab: string) => void;
  readonly onNavigate: (id: string) => void;
  readonly onDeleted: () => void;
}

// Enum / TaggedUnion / Foreign detail. Enum values edit via ExpandEnum + doc
// replace; tagged unions show read-only field sets; foreigns are metadata only.
export function ObjectDetail({ model, classes, elementId, schemaPath, docPath, routeParams: _routeParams, tab: routeTab, onTabChange, onNavigate, onDeleted }: Props) {
  const { t } = useTranslation();
  const element = model[elementId];
  const tab = routeTab === "raw" ? "raw" : "def";
  const [enumModal, setEnumModal] = useState(false);
  const [metaTarget, setMetaTarget] = useState<string | null>(null);
  const [warn, setWarn] = useState<{ elementId: string; ops: MigrationOp[] } | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  if (!element) return <div className="p-4 text-sm text-gray-500">{t("model.object.notFound", { id: elementId })}</div>;

  const td = element.typeDefinition;
  const kindLabel = td.type === "enumtrait" ? "Enum" : td.type === "taggedunion" ? "TaggedUnion" : "Foreign";

  const doRename = () => {
    const next = renameValue.trim();
    setRenaming(false);
    if (!next || next === elementId || model[next]) return;
    setWarn({ elementId, ops: [migOps.moveClass(elementId, next)] });
  };

  return (
    <div className="min-w-0 flex-1 p-3">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {renaming ? (
          <span className="flex items-center gap-1">
            <input className="rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-950" defaultValue={elementId} onChange={(e) => setRenameValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doRename()} />
            <button type="button" className="rounded bg-sky-600 px-2 py-1 text-xs text-white" onClick={doRename}>{t("common.save")}</button>
            <button type="button" className="rounded px-2 py-1 text-xs" onClick={() => setRenaming(false)}>{t("common.cancel")}</button>
          </span>
        ) : (
          <h2 className="text-base font-semibold">
            {elementId}
            <span className="ml-2 rounded bg-amber-100 px-1 text-[10px] text-amber-800 dark:bg-amber-900 dark:text-amber-200">{kindLabel}</span>
          </h2>
        )}
        <span className="ml-auto flex gap-1">
          {td.type === "enumtrait" && (
            <button type="button" className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800" onClick={() => setEnumModal(true)}>
              {t("model.object.editValues")}
            </button>
          )}
          <button type="button" className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800" onClick={() => { setRenameValue(elementId); setRenaming(true); }}>
            {t("model.class.rename")}
          </button>
          <button type="button" className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800" onClick={() => setMetaTarget(elementId)}>
            {t("model.class.editMetadata")}
          </button>
          <button type="button" className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950" onClick={() => setWarn({ elementId, ops: [migOps.deleteClass(elementId)] })}>
            {t("common.delete")}
          </button>
        </span>
      </div>
      <div className="mb-2 flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {(["def", "raw"] as const).map((tb) => (
          <button key={tb} type="button" className={`border-b-2 px-3 py-1 text-sm ${tab === tb ? "border-sky-500 font-medium" : "border-transparent text-gray-500"}`} onClick={() => onTabChange(tb)}>
            {tb === "def" ? t("model.object.definitionTab") : t("model.class.rawTab")}
          </button>
        ))}
      </div>
      {tab === "def" && td.type === "enumtrait" && (
        <div className="text-sm">
          <div className="mb-1 text-xs font-semibold text-gray-500 uppercase">{t("model.object.values")}</div>
          <ul className="columns-3">
            {(td.enumValues ?? []).map((v) => (
              <li key={v} className="font-mono text-xs">{v}</li>
            ))}
          </ul>
        </div>
      )}
      {tab === "def" && td.type === "taggedunion" && (
        <FieldTable
          model={model}
          elementId={elementId}
          pathIds={[elementId]}
          schemaPath={schemaPath}
          onNavigate={onNavigate}
          onEditMetadata={setMetaTarget}
          onWarn={(el, ops) => setWarn({ elementId: el, ops })}
          readOnly
        />
      )}
      {tab === "def" && td.type === "foreign" && <div className="text-sm text-gray-500">{t("model.object.foreignBlurb")}</div>}
      {tab === "raw" && <SchemaRawEditor classes={classes} schemaPath={schemaPath} docPath={docPath} elementId={elementId} />}
      {enumModal && <EnumValuesModal open model={model} classes={classes} elementId={elementId} schemaPath={schemaPath} docPath={docPath} onClose={() => setEnumModal(false)} />}
      {metaTarget && <MetadataModal open model={model} elementId={metaTarget} schemaPath={schemaPath} docPath={docPath} classes={classes} onClose={() => setMetaTarget(null)} onWarn={(el, ops) => setWarn({ elementId: el, ops })} />}
      {warn && (
        <MigrationWarningModal
          open
          elementId={warn.elementId}
          ops={warn.ops}
          schemaPath={schemaPath}
          onClose={() => {
            const deleted = warn.ops.some((o) => o["@type"] === "DeleteClass" && o.class === elementId);
            const moved = warn.ops.find((o) => o["@type"] === "MoveClass");
            setWarn(null);
            if (deleted) onDeleted();
            else if (moved) onNavigate(String(moved.to));
          }}
        />
      )}
    </div>
  );
}
