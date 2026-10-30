import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { SchemaModel } from "@/lib/schemaModel/types";
import type { SchemaClass } from "@/types/terminusdb";
import { ops as migOps, type MigrationOp } from "@/lib/schemaModel/migrationOps";
import { FieldTable } from "./FieldTable";
import { MermaidPanel } from "./MermaidPanel";
import { SchemaRawEditor } from "./SchemaRawEditor";
import { MetadataModal } from "./MetadataModal";
import { MigrationWarningModal } from "./MigrationWarningModal";
import { JsonSchemaExportModal } from "./JsonSchemaExportModal";
import { PreflightCheck } from "./PreflightCheck";

interface Props {
  model: SchemaModel;
  classes: SchemaClass[];
  elementId: string;
  schemaPath: string;
  docPath: string;
  /** Active tab comes from the route so detail views are linkable. */
  tab?: string;
  onTabChange: (tab: string) => void;
  onNavigate: (id: string) => void;
  onNavigateObject: (id: string) => void;
  /** Navigate to a class on a specific tab — diagram clicks stay in diagram view. */
  onNavigateTab?: (id: string, tab: string) => void;
  onDeleted: () => void;
  /** Per-class document counts — drives the large-class migration gate. */
  docCounts?: Record<string, number>;
}

type Tab = "fields" | "diagram" | "raw";
const VALID_TABS: readonly Tab[] = ["fields", "diagram", "raw"];

export function ClassDetail({ model, classes, elementId, schemaPath, docPath, tab: routeTab, onTabChange, onNavigate, onNavigateObject, onNavigateTab, onDeleted, docCounts }: Props) {
  const { t } = useTranslation();
  const td = model[elementId]?.typeDefinition;
  const tab: Tab = VALID_TABS.includes(routeTab as Tab) ? (routeTab as Tab) : "fields";
  const [metaTarget, setMetaTarget] = useState<string | null>(null);
  const [warn, setWarn] = useState<{ elementId: string; ops: MigrationOp[] } | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [preflightOpen, setPreflightOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  if (!td) return <div className="p-4 text-sm text-gray-500">{t("model.class.notFound", { id: elementId })}</div>;

  const keySummary = td.keyDefinition
    ? td.keyDefinition.type + (td.keyDefinition.includedFields ? `(${td.keyDefinition.includedFields.join(",")})` : "")
    : "Random";

  const doRename = () => {
    const next = renameValue.trim();
    setRenaming(false);
    if (!next || next === elementId || model[next]) return;
    const op = migOps.moveClass(elementId, next);
    setWarn({ elementId, ops: [op] });
  };

  const doDelete = () => setWarn({ elementId, ops: [migOps.deleteClass(elementId)] });

  const handleNavigate = (id: string) => {
    const kind = model[id]?.type;
    if (kind === "type" || kind === "trait") onNavigate(id);
    else onNavigateObject(id);
  };

  // Diagram clicks open the target's diagram (objects have no diagram tab).
  const handleDiagramNavigate = (id: string) => {
    const kind = model[id]?.type;
    if ((kind === "type" || kind === "trait") && onNavigateTab) onNavigateTab(id, "diagram");
    else handleNavigate(id);
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "fields", label: t("model.class.fieldsTab") },
    { id: "diagram", label: t("model.class.diagramTab") },
    { id: "raw", label: t("model.class.rawTab") },
  ];

  return (
    <div className="min-w-0 flex-1 p-3">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {renaming ? (
          <span className="flex items-center gap-1">
            <input
              className="rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-950"
              defaultValue={elementId}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doRename()}
            />
            <button type="button" className="rounded bg-sky-600 px-2 py-1 text-xs text-white" onClick={doRename}>{t("common.save")}</button>
            <button type="button" className="rounded px-2 py-1 text-xs" onClick={() => setRenaming(false)}>{t("common.cancel")}</button>
          </span>
        ) : (
          <h2 className="text-base font-semibold">
            {elementId}
            {td.isAbstract && <span className="ml-2 text-xs text-gray-400 italic">abstract</span>}
            {td.type === "trait" && <span className="ml-2 rounded bg-violet-100 px-1 text-[10px] text-violet-700 dark:bg-violet-900">subdocument</span>}
          </h2>
        )}
        <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-600 dark:bg-gray-800 dark:text-gray-300">key: {keySummary}</span>
        <span className="flex items-center gap-1 text-xs text-gray-500">
          {(td.inherits ?? []).map((p) => (
            <button key={p} type="button" className="rounded bg-sky-100 px-1 text-sky-700 hover:bg-sky-200 dark:bg-sky-900 dark:text-sky-300" onClick={() => handleNavigate(p)}>
              ↑{p}
            </button>
          ))}
          {(td.subsumed ?? []).map((c) => (
            <button key={c} type="button" className="rounded bg-emerald-100 px-1 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900 dark:text-emerald-300" onClick={() => handleNavigate(c)}>
              ↓{c}
            </button>
          ))}
        </span>
        <span className="ml-auto flex flex-wrap justify-end gap-1">
          <button type="button" className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800" onClick={() => { setRenameValue(elementId); setRenaming(true); }}>
            {t("model.class.rename")}
          </button>
          <button type="button" className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800" onClick={() => setMetaTarget(elementId)}>
            {t("model.class.editMetadata")}
          </button>
          <button type="button" className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800" onClick={() => setExportOpen(true)}>
            {t("model.class.exportSchema")}
          </button>
          <button type="button" className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800" onClick={() => setPreflightOpen(true)}>
            {t("model.class.testDocument")}
          </button>
          <button type="button" className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950" onClick={doDelete}>
            {t("common.delete")}
          </button>
        </span>
      </div>
      <div className="mb-2 flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {tabs.map((tb) => (
          <button
            key={tb.id}
            type="button"
            className={`border-b-2 px-3 py-1 text-sm ${tab === tb.id ? "border-sky-500 font-medium" : "border-transparent text-gray-500"}`}
            onClick={() => onTabChange(tb.id)}
          >
            {tb.label}
          </button>
        ))}
      </div>
      {tab === "fields" && (
        <FieldTable
          model={model}
          elementId={elementId}
          pathIds={[elementId]}
          schemaPath={schemaPath}
          onNavigate={handleNavigate}
          onEditMetadata={setMetaTarget}
          onWarn={(el, ops) => setWarn({ elementId: el, ops })}
          classes={classes}
          docPath={docPath}
          docCounts={docCounts}
        />
      )}
      {tab === "diagram" && <MermaidPanel model={model} elementId={elementId} onNavigate={handleDiagramNavigate} />}
      {tab === "raw" && <SchemaRawEditor classes={classes} schemaPath={schemaPath} docPath={docPath} elementId={elementId} />}
      {metaTarget && (
        <MetadataModal
          open
          model={model}
          elementId={metaTarget}
          schemaPath={schemaPath}
          docPath={docPath}
          classes={classes}
          onClose={() => setMetaTarget(null)}
          onWarn={(el, ops) => setWarn({ elementId: el, ops })}
        />
      )}
      {warn && (
        <MigrationWarningModal
          open
          elementId={warn.elementId}
          ops={warn.ops}
          schemaPath={schemaPath}
          docCount={docCounts?.[warn.elementId] ?? docCounts?.[elementId]}
          onClose={() => {
            setWarn(null);
            if (warn.ops.some((o) => o["@type"] === "DeleteClass" && o.class === elementId)) onDeleted();
            if (warn.ops.some((o) => o["@type"] === "MoveClass")) onNavigate(String(warn.ops.find((o) => o["@type"] === "MoveClass")?.to ?? elementId));
          }}
        />
      )}
      {exportOpen && <JsonSchemaExportModal open elementId={elementId} schemaPath={schemaPath} model={model} onClose={() => setExportOpen(false)} />}
      {preflightOpen && <PreflightCheck open type={elementId} docPath={docPath} schemaPath={schemaPath} model={model} onClose={() => setPreflightOpen(false)} />}
    </div>
  );
}
