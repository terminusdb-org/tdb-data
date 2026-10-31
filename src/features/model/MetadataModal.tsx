import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { SchemaModel } from "@/lib/schemaModel/types";
import { isStrengthening, ops as migOps, type KeyType, type MigrationOp } from "@/lib/schemaModel/migrationOps";
import { describeApiError, type ApiErrorDetail } from "@/utils/apiErrors";
import { ApiErrorBlock } from "@/components/ApiErrorBlock";
import { ModelDialog } from "@/components/ModelDialog";
import { FilterMultiCombobox } from "@/components/FilterCombobox";
import { DocumentationModal } from "./DocumentationModal";
import { useApplyMigration } from "./applyEdit";
import { useReplaceSchemaDocumentMutation, useAppSelector } from "@/store";
import type { SchemaClass } from "@/types/terminusdb";

interface Props {
  open: boolean;
  model: SchemaModel;
  elementId: string;
  schemaPath: string;
  docPath: string;
  classes: SchemaClass[];
  onClose: () => void;
  onWarn: (elementId: string, ops: MigrationOp[]) => void;
}

const KEY_TYPES: KeyType[] = ["Random", "Lexical", "Hash", "ValueHash", "UuidV7"];
const inputCls =
  "w-full rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-950 dark:text-gray-100";

// Every mandatory field a class gains when it inherits `parentIds` —
// recursively, minus what it already defines itself. Used to pre-collect
// ChangeParents defaults; the engine 500s without them.
export const mandatoryInheritedProps = (model: SchemaModel, childId: string, parentIds: string[]): string[] => {
  const child = model[childId]?.typeDefinition;
  const own = new Set(Object.keys(child?.propertyDefinitions ?? {}));
  const result: string[] = [];
  const seen = new Set<string>();
  const visit = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    const td = model[id]?.typeDefinition;
    if (!td) return;
    for (const p of Object.values(td.propertyDefinitions ?? {})) {
      if (p.multiplicity === "Mandatory" && !own.has(p.name) && !result.includes(p.name)) result.push(p.name);
    }
    for (const parent of td.inherits ?? []) visit(parent);
  };
  parentIds.forEach(visit);
  return result;
};

// What the metadata modal offers per master type — matching the Zebra model:
// documentation + @metadata for everything; key/parents/base/flags only for
// document classes (type/trait). Enums edit values via EnumValuesModal;
// tagged unions edit members via the Raw tab.
export const editableFeaturesFor = (kind: string) => ({
  docs: true,
  metadata: true,
  key: kind === "type" || kind === "trait",
  parents: kind === "type" || kind === "trait",
  flags: kind === "type" || kind === "trait",
});

// Edits everything about a class except its fields and identity: docs, metadata,
// key, parents, base, abstract/unfoldable, subdoc/shared flags.
export function MetadataModal({ open, model, elementId, schemaPath, docPath, classes, onClose, onWarn }: Props) {
  const { t } = useTranslation();
  const applyMigration = useApplyMigration();
  const [replaceSchemaDocument] = useReplaceSchemaDocumentMutation();
  const username = useAppSelector((s) => s.auth.username ?? "admin");
  const td = model[elementId]?.typeDefinition;
  const features = editableFeaturesFor(td?.type ?? "");
  const [label, setLabel] = useState("");
  const [comment, setComment] = useState("");
  const [authors, setAuthors] = useState("");
  const [metadataJson, setMetadataJson] = useState("");
  const [keyType, setKeyType] = useState<KeyType>("Random");
  const [keyFields, setKeyFields] = useState("");
  const [parents, setParents] = useState<string[]>([]);
  const [base, setBase] = useState("");
  const [abstract, setAbstract] = useState(false);
  const [unfoldable, setUnfoldable] = useState(false);
  const [subdoc, setSubdoc] = useState(false);
  const [shared, setShared] = useState(false);
  const [propDefaults, setPropDefaults] = useState<Record<string, string>>({});
  const [docsOpen, setDocsOpen] = useState(false);
  const [error, setError] = useState<ApiErrorDetail | null>(null);
  const [initializedFor, setInitializedFor] = useState<string | null>(null);

  if (open && td && initializedFor !== elementId) {
    setInitializedFor(elementId);
    setLabel(td.metaData?.label ?? "");
    setComment(td.metaData?.comment ?? "");
    setAuthors((td.metaData?.authors ?? []).join(", "));
    setMetadataJson(td.typeMetadata?.parsed ? JSON.stringify(td.typeMetadata.parsed, null, 2) : td.typeMetadata?.unparsed ? JSON.stringify(td.typeMetadata.unparsed, null, 2) : "");
    setKeyType(td.keyDefinition?.type ?? "Random");
    setKeyFields((td.keyDefinition?.includedFields ?? []).join(", "));
    setParents(td.inherits ?? []);
    setBase(td.base ?? "");
    setAbstract(!!td.isAbstract);
    setUnfoldable(!!td.unfoldable);
    setSubdoc(td.type === "trait");
    setShared(!!td.isShared);
    setPropDefaults({});
    setError(null);
  }

  if (!open || !td) return null;

  const descendants = new Set<string>();
  const collectDescendants = (id: string) => {
    for (const child of model[id]?.typeDefinition.subsumed ?? []) {
      if (!descendants.has(child)) {
        descendants.add(child);
        collectDescendants(child);
      }
    }
  };
  collectDescendants(elementId);
  const parentOptions = Object.keys(model).filter(
    (id) => (model[id].type === "type" || model[id].type === "trait") && id !== elementId && !descendants.has(id)
  );

  const parentsChanged = features.parents && JSON.stringify(parents.slice().sort()) !== JSON.stringify((td.inherits ?? []).slice().sort());
  const requiredDefaults = parentsChanged ? mandatoryInheritedProps(model, elementId, parents) : [];

  const save = async () => {
    setError(null);
    const operations: MigrationOp[] = [];
    const doc: Record<string, unknown> = {};
    if (label) doc["@label"] = label;
    if (comment) doc["@comment"] = comment;
    if (authors.trim()) doc["@authors"] = authors.split(",").map((a) => a.trim());
    if (label || comment || authors.trim()) operations.push(migOps.replaceClassDocumentation(elementId, doc));

    if (metadataJson.trim()) {
      try {
        operations.push(migOps.replaceClassMetadata(elementId, JSON.parse(metadataJson)));
      } catch {
        setError({ type: null, message: t("model.metadata.invalidJson"), detailsJson: "" });
        return;
      }
    }
    if (features.key && (keyType !== (td.keyDefinition?.type ?? "Random") || keyFields !== (td.keyDefinition?.includedFields ?? []).join(", "))) {
      operations.push(
        migOps.changeKey(elementId, keyType, keyType === "Lexical" || keyType === "Hash" ? keyFields.split(",").map((f) => f.trim()).filter(Boolean) : undefined)
      );
    }
    if (parentsChanged) {
      // Mandatory inherited fields need defaults — the engine 500s without them.
      const missing = requiredDefaults.filter((p) => !propDefaults[p]);
      if (missing.length > 0) {
        setError({ type: null, message: t("model.metadata.missingDefaults", { props: missing.join(", ") }), detailsJson: "" });
        return;
      }
      const defaults = requiredDefaults.map((p) => ({ property: p, default: propDefaults[p] }));
      operations.push(migOps.changeParents(elementId, parents, defaults.length > 0 ? defaults : undefined));
    }
    if (features.flags && abstract !== !!td.isAbstract) operations.push(migOps.setAbstract(elementId, abstract));
    if (features.flags && unfoldable !== !!td.unfoldable) operations.push(migOps.setUnfoldable(elementId, unfoldable));

    // @subdocument / @shared have no migration op — replace the class document.
    const flagOpsPending: { subdoc: boolean; shared: boolean } = {
      subdoc: features.flags && subdoc !== (td.type === "trait"),
      shared: features.flags && shared !== !!td.isShared,
    };
    const needsDocReplace = flagOpsPending.subdoc || flagOpsPending.shared;

    if (operations.length === 0 && !needsDocReplace) {
      onClose();
      return;
    }
    if (operations.some(isStrengthening)) {
      onWarn(elementId, operations);
      onClose();
      return;
    }
    if (operations.length > 0) {
      await applyMigration({ path: schemaPath, elementId, ops: operations });
    }
    if (needsDocReplace) {
      const cls = classes.find((c) => c["@id"] === elementId);
      if (!cls) {
        setError({ type: null, message: t("model.metadata.classDocMissing"), detailsJson: "" });
        return;
      }
      const { ["@subdocument"]: _sd, ["@shared"]: _sh, ...rest } = cls as Record<string, unknown>;
      const next = {
        ...rest,
        ...(subdoc ? { "@subdocument": [] } : {}),
        ...(shared ? { "@shared": [] } : {}),
      };
      try {
        await replaceSchemaDocument({
          path: docPath,
          id: elementId,
          document: next as unknown as SchemaClass,
          author: username,
          message: `model: flags ${elementId}`,
        }).unwrap();
      } catch (err) {
        setError(describeApiError(err));
        return;
      }
    }
    onClose();
  };

  const fieldCls = "mb-2";
  return (
    <ModelDialog open={open} onClose={onClose} widthClass="w-[34rem]"
      title={
        <>
          {t("model.metadata.title", { id: elementId })}
          {td.type === "trait" && <span className="ml-2 rounded bg-violet-100 px-1 text-[10px] text-violet-700 dark:bg-violet-900">subdoc</span>}
          {td.isShared && <span className="ml-2 rounded bg-teal-100 px-1 text-[10px] text-teal-700 dark:bg-teal-900">shared</span>}
        </>
      }
    >
      <div className={fieldCls}>
        <label className="mb-0.5 block text-xs text-gray-500">{t("model.metadata.label")}</label>
        <input className={inputCls} value={label} onChange={(e) => setLabel(e.target.value)} />
      </div>
      <div className={fieldCls}>
        <label className="mb-0.5 block text-xs text-gray-500">{t("model.metadata.comment")}</label>
        <textarea className={inputCls} rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
      </div>
      <div className={fieldCls}>
        <button type="button" className="rounded border border-gray-300 px-2 py-1 text-xs text-sky-600 hover:border-sky-400 dark:border-gray-600" onClick={() => setDocsOpen(true)}>
          {t("model.docs.translations")}
        </button>
      </div>
      <div className={fieldCls}>
        <label className="mb-0.5 block text-xs text-gray-500">{t("model.metadata.authors")}</label>
        <input className={inputCls} value={authors} onChange={(e) => setAuthors(e.target.value)} />
      </div>
      <div className={fieldCls}>
        <label className="mb-0.5 block text-xs text-gray-500">{t("model.metadata.metadataJson")}</label>
        <textarea className={`${inputCls} font-mono`} rows={3} value={metadataJson} onChange={(e) => setMetadataJson(e.target.value)} />
      </div>
      {features.key && (
        <div className={`${fieldCls} flex gap-2`}>
          <div className="flex-1">
            <label className="mb-0.5 block text-xs text-gray-500">{t("model.metadata.keyType")}</label>
            <select className={inputCls} value={keyType} onChange={(e) => setKeyType(e.target.value as KeyType)}>
              {KEY_TYPES.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>
          {(keyType === "Lexical" || keyType === "Hash") && (
            <div className="flex-1">
              <label className="mb-0.5 block text-xs text-gray-500">{t("model.metadata.keyFields")}</label>
              <input className={inputCls} value={keyFields} onChange={(e) => setKeyFields(e.target.value)} placeholder="a, b" />
            </div>
          )}
        </div>
      )}
      {features.parents && (
        <div className={fieldCls}>
          <label className="mb-0.5 block text-xs text-gray-500">{t("model.metadata.parents")}</label>
          <FilterMultiCombobox options={parentOptions} values={parents} onChange={setParents} placeholder={t("model.metadata.parentsPlaceholder")} aria-label={t("model.metadata.parents")} />
          {requiredDefaults.length > 0 && (
            <div className="mt-1 rounded bg-amber-50 p-2 dark:bg-amber-950/30">
              <div className="mb-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">{t("model.metadata.mandatoryDefaults")}</div>
              {requiredDefaults.map((p) => (
                <div key={p} className="mb-1 flex items-center gap-1">
                  <span className="w-28 truncate font-mono text-[11px]">{p}</span>
                  <input
                    className={`${inputCls} flex-1`}
                    placeholder={t("model.metadata.defaultFor", { prop: p })}
                    value={propDefaults[p] ?? ""}
                    onChange={(e) => setPropDefaults((prev) => ({ ...prev, [p]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {features.key && (
        <div className={fieldCls}>
          <label className="mb-0.5 block text-xs text-gray-500">{t("model.metadata.base")}</label>
          <input className={inputCls} value={base} onChange={(e) => setBase(e.target.value)} placeholder="Person_" />
        </div>
      )}
      {features.flags && (
        <>
          <div className="mb-2 flex flex-wrap gap-4">
            <label className="flex items-center gap-1 text-xs">
              <input type="checkbox" checked={abstract} onChange={(e) => setAbstract(e.target.checked)} />
              {t("model.metadata.abstract")}
            </label>
            <label className="flex items-center gap-1 text-xs">
              <input type="checkbox" checked={unfoldable} onChange={(e) => setUnfoldable(e.target.checked)} />
              {t("model.metadata.unfoldable")}
            </label>
            <label className="flex items-center gap-1 text-xs" title={t("model.metadata.subdocTitle")}>
              <input
                type="checkbox"
                checked={subdoc}
                onChange={(e) => {
                  setSubdoc(e.target.checked);
                  if (e.target.checked) setShared(false);
                }}
              />
              {t("model.metadata.subdocument")}
            </label>
            <label className="flex items-center gap-1 text-xs" title={t("model.metadata.sharedTitle")}>
              <input
                type="checkbox"
                checked={shared}
                onChange={(e) => {
                  setShared(e.target.checked);
                  if (e.target.checked) setSubdoc(false);
                }}
              />
              {t("model.metadata.shared")}
            </label>
          </div>
          <div className="mb-2 text-[11px] text-gray-400">{t("model.metadata.flagsNote")}</div>
        </>
      )}
      {error && <ApiErrorBlock error={error} />}
      {docsOpen &&
        (() => {
          const c = classes.find((x) => x["@id"] === elementId);
          return c ? <DocumentationModal open cls={c} docPath={docPath} onClose={() => setDocsOpen(false)} /> : null;
        })()}
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" className="rounded px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800" onClick={onClose}>
          {t("common.cancel")}
        </button>
        <button type="button" className="rounded bg-sky-600 px-3 py-1 text-sm font-medium text-white hover:bg-sky-700" onClick={() => void save()}>
          {t("common.save")}
        </button>
      </div>
    </ModelDialog>
  );
}
