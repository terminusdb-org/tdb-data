import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ITypeDefinition, SchemaModel, TypePropertyDefinition } from "@/lib/schemaModel/types";
import { buildPredicateIndex, specsEqual } from "@/lib/schemaModel/predicates";
import { diffClassToOps, isStrengthening, newClassDoc, ops as migOps, specOf, type MigrationOp } from "@/lib/schemaModel/migrationOps";
import { useAppSelector, useAppDispatch, useReplaceSchemaDocumentMutation } from "@/store";
import { selectPendingForElement, editDismissed } from "@/store/modelSlice";
import { notify } from "@/store/notificationSlice";
import { describeApiError } from "@/utils/apiErrors";
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
  const username = useAppSelector((s) => s.auth.username ?? "admin");
  const [replaceSchemaDocument] = useReplaceSchemaDocumentMutation();
  const td = model[elementId]?.typeDefinition;
  const pending = useAppSelector((s) => selectPendingForElement(s, elementId));
  const predicates = useMemo(() => buildPredicateIndex(model), [model]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [docsFor, setDocsFor] = useState<string | null>(null);
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
  const oneOfGroupOf: Record<string, number> = {};
  oneOfSets.forEach((set, i) => Object.keys(set).forEach((n) => (oneOfGroupOf[n] = i)));
  const existingNames = [...ownProps, ...inheritedProps, ...oneOfSets.flatMap((s) => Object.values(s))].map((p) => p.name);

  const toggle = (name: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

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

  // @oneOf membership isn't expressible through the migration op vocabulary —
  // rewrite the class document directly (same path as the raw/docs editors).
  const applyFieldDoc = async (mutate: (doc: Record<string, unknown>, segs: Record<string, unknown>[]) => void, message: string) => {
    if (!docsCls || !docPath) {
      dispatch(notify({ severity: "error", title: t("model.field.oneOfFailed"), message: t("model.field.oneOfNoDoc") }));
      return;
    }
    const doc = JSON.parse(JSON.stringify(docsCls)) as Record<string, unknown>;
    const rawOneOf = doc["@oneOf"];
    const segs = (Array.isArray(rawOneOf) ? rawOneOf : rawOneOf && typeof rawOneOf === "object" ? [rawOneOf] : []) as Record<string, unknown>[];
    mutate(doc, segs);
    const nonempty = segs.filter((s) => Object.keys(s).length > 0);
    if (nonempty.length) doc["@oneOf"] = nonempty;
    else delete doc["@oneOf"];
    try {
      await replaceSchemaDocument({
        path: docPath,
        id: elementId,
        document: doc as SchemaClass,
        author: username,
        message,
      }).unwrap();
    } catch (err) {
      const detail = describeApiError(err);
      dispatch(notify({ severity: "error", title: detail.type ?? t("model.field.oneOfFailed"), message: detail.message, detailsJson: detail.detailsJson }));
    }
  };

  const saveField = (draft: FieldDraft, originalName?: string) => {
    setAdding(false);
    setEditingName(null);
    const origGroup = originalName !== undefined ? oneOfGroupOf[originalName] : undefined;
    if (origGroup !== undefined || draft.oneOfGroup !== undefined) {
      const spec = specOf(draft.prop);
      const origProp = origGroup !== undefined ? oneOfSets[origGroup]?.[originalName!] : undefined;
      if (origProp && originalName === draft.name && origGroup === draft.oneOfGroup && specsEqual(specOf(origProp), spec)) return;
      void (async () => {
        if (draft.newClass) {
          await applyMigration({
            path: schemaPath,
            elementId,
            ops: [migOps.createClass(newClassDoc(draft.newClass.id, draft.newClass.kind))],
          });
        }
        await applyFieldDoc((doc, segs) => {
          const removeName = originalName ?? draft.name;
          delete doc[removeName];
          for (const seg of segs) delete seg[removeName];
          if (draft.oneOfGroup !== undefined) {
            while (segs.length <= draft.oneOfGroup) segs.push({});
            segs[draft.oneOfGroup][draft.name] = spec;
          } else {
            doc[draft.name] = spec;
          }
        }, `model: field ${elementId}.${draft.name}`);
      })();
      return;
    }
    const operations: MigrationOp[] = [];
    if (draft.newClass) {
      operations.push(migOps.createClass(newClassDoc(draft.newClass.id, draft.newClass.kind)));
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
    if (oneOfGroupOf[prop.name] !== undefined) {
      void applyFieldDoc((doc, segs) => {
        delete doc[prop.name];
        for (const seg of segs) delete seg[prop.name];
      }, `model: delete ${elementId}.${prop.name}`);
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

  const renderRow = (p: TypePropertyDefinition, inherited: boolean, oneOfGroup?: number) => {
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
              oneOfCount={oneOfSets.length}
              oneOfGroup={oneOfGroup}
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
            <ul>{Object.values(fieldSet).map((p) => renderRow(p, false, i))}</ul>
          </li>
        ))}
        {inheritedProps.length > 0 && (
          <li className="border-b border-gray-100 px-2 py-1 dark:border-gray-800">
            <div className="text-[10px] font-semibold tracking-wide text-gray-400 uppercase">{t("model.field.inheritedFields")}</div>
            <ul>{inheritedProps.map((p) => renderRow(p, true))}</ul>
          </li>
        )}
      </ul>
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
          <FieldEditRow model={model} targetId={elementId} existingNames={existingNames} oneOfCount={oneOfSets.length} onSave={(d) => saveField(d)} onCancel={() => setAdding(false)} />
        </div>
      )}
      {docsFor && docsCls && docPath && (
        <DocumentationModal open cls={docsCls} propName={docsFor} docPath={docPath} onClose={() => setDocsFor(null)} />
      )}
    </div>
  );
}
