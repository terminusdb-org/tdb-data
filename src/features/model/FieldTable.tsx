import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ITypeDefinition, SchemaModel, TypePropertyDefinition, TypePropertyDefinitions } from "@/lib/schemaModel/types";
import { describeApiError, type ApiErrorDetail } from "@/utils/apiErrors";
import { buildPredicateIndex, specsEqual } from "@/lib/schemaModel/predicates";
import { diffClassToOps, isStrengthening, ops as migOps, specOf, type MigrationOp } from "@/lib/schemaModel/migrationOps";
import { useAppSelector, useAppDispatch, useReplaceSchemaDocumentMutation } from "@/store";
import { selectPendingForElement, editDismissed } from "@/store/modelSlice";
import { useApplyMigration } from "./applyEdit";
import { FieldEditRow, type FieldDraft } from "./FieldEditRow";
import { ApiErrorBlock } from "@/components/ApiErrorBlock";
import { DocumentationModal } from "./DocumentationModal";
import type { SchemaClass } from "@/types/terminusdb";

const MULT_GLYPH: Record<string, string> = {
  Mandatory: "1", Optional: "0..1", Set: "0..*", List: "[*]", Array: "⊞", Foreign: "⇢",
};

// Cardinality is a bounded Set: show bounds when set, plain Set otherwise.
const multGlyph = (p: TypePropertyDefinition): string => {
  if (p.multiplicity === "Cardinality") {
    const lo = p.minCardinality ?? p.cardinality;
    const hi = p.maxCardinality ?? p.cardinality;
    return lo != null || hi != null ? `${lo ?? 0}..${hi ?? "*"}` : MULT_GLYPH.Set;
  }
  return MULT_GLYPH[p.multiplicity] ?? p.multiplicity;
};

interface Props {
  model: SchemaModel;
  elementId: string;
  pathIds: string[]; // expansion chain — prevents infinite recursion
  schemaPath: string;
  onNavigate: (id: string) => void;
  onEditMetadata: (elementId: string) => void;
  onWarn: (elementId: string, ops: MigrationOp[]) => void;
  readOnly?: boolean; // tagged unions & oneOf sets are read-only (decision 10)
  /** Raw schema docs + document path — enable the per-field docs modal. */
  classes?: SchemaClass[];
  docPath?: string;
  /** Per-class document counts — ops on classes over the threshold warn first. */
  docCounts?: Record<string, number>;
}

// Classes above this many documents get the confirmation modal before any op.
const LARGE_CLASS_THRESHOLD = 1000;

const linkedTargetOf = (p: TypePropertyDefinition, model: SchemaModel): { id: string; kind: string } | null => {
  if (p.linkedTrait) return { id: p.linkedTrait, kind: "subdoc" };
  if (p.linkedType) return { id: p.linkedType, kind: model[p.linkedType]?.typeDefinition.isShared ? "shared" : "class" };
  if (p.linkedEnum) return { id: p.linkedEnum, kind: "enum" };
  if (p.linkedForeign) return { id: p.linkedForeign, kind: "foreign" };
  if (p.linkedTaggedUnion) return { id: p.linkedTaggedUnion, kind: "union" };
  return null;
};

// BFS the parents chain to find which ancestor owns the field — that's where
// "inherited" actually comes from, and where editing belongs.
const inheritedFrom = (model: SchemaModel, td: ITypeDefinition, propName: string): string | undefined => {
  const seen = new Set<string>();
  const queue = [...(td.inherits ?? [])];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const parent = model[id]?.typeDefinition;
    if (!parent) continue;
    if (parent.propertyDefinitions && propName in parent.propertyDefinitions) return id;
    if (parent.propertyDefinitionsOneOf?.some((set) => propName in set)) return id;
    queue.push(...(parent.inherits ?? []));
  }
  return undefined;
};

export function FieldTable({ model, elementId, pathIds, schemaPath, onNavigate, onEditMetadata, onWarn, readOnly, classes, docPath, docCounts }: Props) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const applyMigration = useApplyMigration();
  const [replaceSchemaDocument] = useReplaceSchemaDocumentMutation();
  const username = useAppSelector((s) => s.auth.username ?? "admin");
  const td = model[elementId]?.typeDefinition;
  const pending = useAppSelector((s) => selectPendingForElement(s, elementId));
  const predicates = useMemo(() => buildPredicateIndex(model), [model]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [docsFor, setDocsFor] = useState<string | null>(null);
  const [error, setError] = useState<ApiErrorDetail | null>(null);
  const [showSpinner, setShowSpinner] = useState(false);

  const applying = pending.some((p) => p.status === "applying");
  useEffect(() => {
    if (!applying) {
      setShowSpinner(false);
      return;
    }
    const timer = setTimeout(() => setShowSpinner(true), 500);
    return () => clearTimeout(timer);
  }, [applying]);

  if (!td) return null;
  const ownProps = Object.values(td.propertyDefinitions ?? {});
  const docsCls = docPath && classes?.find((c) => c["@id"] === elementId);
  const docsAvailable = !!docsCls && !!docPath;
  const inheritedProps = Object.values(td.inheritedPropertyDefinitions ?? {});
  const oneOfSets = td.propertyDefinitionsOneOf ?? [];
  const existingNames = [...ownProps, ...inheritedProps].map((p) => p.name);

  const toggle = (name: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  // Engine bug: CreateClassProperty/CastClassProperty 500 (api:TypeError) for
  // Cardinality, Array, Foreign and @unfold specs — those edits go through a
  // class-document replace instead of the migration API.
  const specNeedsDocReplace = (spec: unknown): boolean => {
    if (!spec || typeof spec !== "object") return false;
    const t = (spec as Record<string, unknown>)["@type"];
    return t === "Cardinality" || t === "Array" || t === "Foreign" || "@unfold" in (spec as object);
  };
  const propNeedsDocReplace = (p: TypePropertyDefinition) => specNeedsDocReplace(specOf(p));

  // Subdoc edits rewrite the parents' documents — fall back to the chain root.
  const affectedCount = docCounts?.[elementId] ?? docCounts?.[pathIds[0]] ?? 0;
  const commitOps = (ops: MigrationOp[]) => {
    if (ops.length === 0) return;
    if (ops.some(isStrengthening) || affectedCount > LARGE_CLASS_THRESHOLD) {
      onWarn(elementId, ops);
    } else {
      void applyMigration({ path: schemaPath, elementId, ops });
    }
  };

  // Rewrite the class document with a new property set (doc-replace path).
  const applyPropertyDocReplace = async (nextProps: TypePropertyDefinitions, message: string) => {
    if (!docsCls) {
      setError({ type: null, message: t("model.metadata.classDocMissing"), detailsJson: "" });
      return;
    }
    const rest = Object.fromEntries(
      Object.entries(docsCls as Record<string, unknown>).filter(([k]) => k.startsWith("@"))
    );
    const next = { ...rest };
    for (const p of Object.values(nextProps)) next[p.name] = specOf(p);
    try {
      await replaceSchemaDocument({ path: docPath!, id: elementId, document: next as SchemaClass, author: username, message }).unwrap();
    } catch (err) {
      setError(describeApiError(err));
    }
  };

  const saveField = (draft: FieldDraft, originalName?: string) => {
    setAdding(false);
    setEditingName(null);
    const prevProp = originalName ? td.propertyDefinitions?.[originalName] : undefined;
    if (propNeedsDocReplace(draft.prop) || (prevProp && propNeedsDocReplace(prevProp)) || (draft.prop.unfold)) {
      const next = { ...(td.propertyDefinitions ?? {}) };
      if (originalName && originalName !== draft.name) delete next[originalName];
      next[draft.name] = draft.prop;
      void applyPropertyDocReplace(next, `model: field ${draft.name} on ${elementId}`);
      return;
    }
    const operations: MigrationOp[] = [];
    if (draft.newClass) {
      operations.push(
        migOps.createClass({
          "@type": "Class",
          "@id": draft.newClass.id,
          "@key": { "@type": "Random" },
          ...(draft.newClass.subdocument && { "@subdocument": [] }),
        })
      );
    }
    const after = {
      ...(originalName && originalName !== draft.name ? { renames: [{ from: originalName, to: draft.name }] } : {}),
      propertyDefinitions: { ...(td.propertyDefinitions ?? {}), [draft.name]: draft.prop },
      ...(draft.default && { defaults: { [draft.name]: draft.default } }),
    };
    operations.push(...diffClassToOps(elementId, td, after));
    commitOps(operations);
  };

  const deleteField = (prop: TypePropertyDefinition) => {
    if (propNeedsDocReplace(prop)) {
      const next = Object.fromEntries(
        Object.entries(td.propertyDefinitions ?? {}).filter(([k]) => k !== prop.name)
      );
      void applyPropertyDocReplace(next as TypePropertyDefinitions, `model: delete ${prop.name} on ${elementId}`);
      return;
    }
    commitOps(diffClassToOps(elementId, td, {
      propertyDefinitions: Object.fromEntries(
        Object.entries(td.propertyDefinitions ?? {}).filter(([k]) => k !== prop.name)
      ),
    }));
  };

  const retryEdit = (editId: string) => {
    const edit = pending.find((e) => e.id === editId);
    if (!edit) return;
    dispatch(editDismissed({ id: edit.id }));
    void applyMigration({ path: schemaPath, elementId: edit.elementId, ops: edit.ops });
  };

  const docTooltip = (p: TypePropertyDefinition): string | undefined => {
    const doc = p.metaData;
    if (!doc) {
      const known = predicates[p.name]?.defs.find((d) => d.doc);
      return known && ("description" in (known.doc ?? {}) ? (known.doc as { description?: string }).description : "comment" in (known.doc ?? {}) ? (known.doc as { comment?: string }).comment : undefined);
    }
    return "description" in doc ? doc.description : "comment" in doc ? doc.comment : undefined;
  };

  const overloadInfo = (p: TypePropertyDefinition) => {
    const defs = predicates[p.name]?.defs ?? [];
    const distinct = defs.filter((d, i, arr) => arr.findIndex((x) => specsEqual(x.spec, d.spec)) === i);
    return distinct.length > 1 ? distinct.length : 0;
  };

  const renderRow = (p: TypePropertyDefinition, inherited: boolean) => {
    const target = linkedTargetOf(p, model);
    const targetTd = target ? model[target.id]?.typeDefinition : undefined;
    const expandable = !!target && !!targetTd && !pathIds.includes(target.id);
    const origin = inherited ? inheritedFrom(model, td, p.name) : undefined;
    const cycle = !!target && pathIds.includes(target.id as string);
    const isExpanded = expanded.has(p.name);
    const overload = overloadInfo(p);
    const doc = docTooltip(p);
    const isEditing = editingName === p.name;
    return (
      <li key={`${inherited ? "inh" : "own"}-${p.name}`} className="border-b border-gray-100 last:border-0 dark:border-gray-800">
        <div className={`flex items-center gap-2 px-2 py-1 text-sm ${applying ? "pointer-events-none opacity-60" : ""}`}>
          <button
            type="button"
            className="min-h-7 min-w-7 shrink-0 text-[10px] text-gray-400"
            onClick={() => expandable && toggle(p.name)}
            disabled={!expandable}
            aria-label={isExpanded ? t("model.field.collapse") : t("model.field.expand")}
          >
            {expandable ? (isExpanded ? "▾" : "▸") : ""}
          </button>
          <span className="font-mono">{p.name}</span>
          {doc && <span className="cursor-help text-[10px] text-gray-400" title={doc}>ⓘ</span>}
          {overload > 0 && (
            <span
              className="rounded bg-amber-100 px-1 text-[10px] text-amber-800 dark:bg-amber-900 dark:text-amber-200"
              title={t("model.field.overloadTitle", { count: overload })}
            >
              ×{overload}
            </span>
          )}
          <span className="rounded bg-gray-100 px-1 font-mono text-[10px] text-gray-600 dark:bg-gray-800 dark:text-gray-300">
            {multGlyph(p)}
          </span>
          <span className="text-xs text-gray-500">
            {p.type}
            {target && (
              <>
                {" → "}
                <button
                  type="button"
                  className="rounded bg-indigo-100 px-1 font-mono text-[10px] text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900 dark:text-indigo-300"
                  title={t("model.field.editTargetMetadata")}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditMetadata(target.id);
                  }}
                >
                  {target.id}
                </button>
                <span className="ml-1 rounded bg-gray-100 px-1 text-[10px] text-gray-500 dark:bg-gray-800">{target.kind}</span>
              </>
            )}
          </span>
          {inherited && (
            <span className="ml-auto flex items-center gap-1 text-[10px] text-gray-400 italic">
              {t("model.field.inherited")}
              {origin && (
                <button
                  type="button"
                  className="rounded bg-gray-100 px-1 font-mono text-sky-600 not-italic hover:bg-sky-100 dark:bg-gray-800 dark:hover:bg-sky-900/50"
                  title={t("model.field.inheritedFrom", { id: origin })}
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigate(origin);
                  }}
                >
                  ↑{origin}
                </button>
              )}
            </span>
          )}
          {cycle && (
            <button type="button" className="ml-auto text-[11px] text-sky-600 hover:underline" onClick={() => target && onNavigate(target.id)}>
              {t("model.field.openDetail")}
            </button>
          )}
          {!inherited && !readOnly && (
            <span className="ml-auto flex gap-1">
              {docsAvailable && (
                <button type="button" className="min-h-7 rounded px-1.5 text-[11px] text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950" title={t("model.docs.editField")} onClick={() => setDocsFor(p.name)}>
                  {t("model.docs.button")}
                </button>
              )}
              <button type="button" className="min-h-7 rounded px-1.5 text-[11px] text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950" onClick={() => setEditingName(p.name)}>
                {t("common.edit")}
              </button>
              <button type="button" className="min-h-7 rounded px-1.5 text-[11px] text-red-600 hover:bg-red-50 dark:hover:bg-red-950" onClick={() => deleteField(p)}>
                {t("common.delete")}
              </button>
            </span>
          )}
        </div>
        {isEditing && (
          <div className="px-2 pb-2">
            <FieldEditRow
              model={model}
              targetId={elementId}
              existingNames={existingNames}
              initial={{ ...p, originalName: p.name }}
              onSave={(d) => saveField(d, p.name)}
              onCancel={() => setEditingName(null)}
            />
          </div>
        )}
        {isExpanded && target && targetTd && (
          <div className="ml-6 border-l-2 border-indigo-200 pl-2 dark:border-indigo-800">
            {targetTd.type === "enumtrait" ? (
              <div className="px-2 py-1 text-xs text-gray-500">
                {t("model.field.enumValues", { values: (targetTd.enumValues ?? []).join(", ") })}
              </div>
            ) : (
              <FieldTable
                model={model}
                elementId={target.id}
                pathIds={[...pathIds, elementId]}
                schemaPath={schemaPath}
                onNavigate={onNavigate}
                onEditMetadata={onEditMetadata}
                onWarn={onWarn}
                readOnly={readOnly || targetTd.type === "taggedunion"}
                classes={classes}
                docPath={docPath}
                docCounts={docCounts}
              />
            )}
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="relative overflow-x-auto">
      {showSpinner && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50 dark:bg-gray-950/50">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" aria-label={t("model.field.applying")} />
        </div>
      )}
      <ul>
        {ownProps.map((p) => renderRow(p, false))}
        {oneOfSets.map((fieldSet, i) => (
          <li key={`oneof-${i}`} className="border-b border-gray-100 px-2 py-1 dark:border-gray-800">
            <div className="text-[10px] font-semibold tracking-wide text-gray-400 uppercase">⨁ {t("model.field.oneOfSet", { index: i + 1 })}</div>
            <ul>{Object.values(fieldSet).map((p) => renderRow(p, false))}</ul>
          </li>
        ))}
        {inheritedProps.length > 0 && (
          <li className="border-b border-gray-100 px-2 py-1 dark:border-gray-800">
            <div className="text-[10px] font-semibold tracking-wide text-gray-400 uppercase">{t("model.field.inheritedFields")}</div>
            <ul>{inheritedProps.map((p) => renderRow(p, true))}</ul>
          </li>
        )}
      </ul>
      {error && (
        <div className="mx-2 mt-1">
          <ApiErrorBlock error={error} />
        </div>
      )}
      {pending
        .filter((e) => e.status === "error")
        .map((e) => (
          <div key={e.id} className="mx-2 mt-1">
            <ApiErrorBlock error={e.error!} />
            <div className="mt-1 flex gap-2">
              <button type="button" className="min-h-8 rounded bg-sky-600 px-2 py-0.5 text-[11px] text-white" onClick={() => retryEdit(e.id)}>
                {t("common.retry")}
              </button>
              <button type="button" className="min-h-8 rounded px-2 py-0.5 text-[11px] text-gray-500" onClick={() => dispatch(editDismissed({ id: e.id }))}>
                {t("common.dismiss")}
              </button>
            </div>
          </div>
        ))}
      {!readOnly && !adding && (
        <button
          type="button"
          className="mt-1 ml-2 min-h-9 rounded border border-dashed border-gray-300 px-2 py-0.5 text-xs text-gray-500 hover:border-sky-400 hover:text-sky-600 dark:border-gray-600"
          onClick={() => setAdding(true)}
        >
          {t("model.field.addTo", { id: elementId })}
        </button>
      )}
      {adding && (
        <div className="mt-1 px-2 pb-2">
          <FieldEditRow model={model} targetId={elementId} existingNames={existingNames} onSave={(d) => saveField(d)} onCancel={() => setAdding(false)} />
        </div>
      )}
      {docsFor && docsCls && docPath && (
        <DocumentationModal open cls={docsCls} propName={docsFor} docPath={docPath} onClose={() => setDocsFor(null)} />
      )}
    </div>
  );
}
