import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppSelector, useReplaceSchemaDocumentMutation } from "@/store";
import { describeApiError, type ApiErrorDetail } from "@/utils/apiErrors";
import { ApiErrorBlock } from "@/components/ApiErrorBlock";
import { ModelDialog } from "@/components/ModelDialog";
import { readPropDocs, readTypeDocs, withDocumentation, type DocumentationSet } from "@/lib/schemaModel/classDocs";
import type { SchemaClass } from "@/types/terminusdb";

interface Props {
  open: boolean;
  /** Raw class document whose @documentation is edited. */
  cls: SchemaClass;
  /** Field name — when set, edits that field's docs instead of type docs. */
  propName?: string;
  docPath: string;
  onClose: () => void;
}

interface Row {
  lang: string;
  label: string;
  comment: string;
}

const inputCls =
  "w-full rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-950 dark:text-gray-100";

// Multilingual label/description editor — one default entry plus one row per
// language, written to the class doc's @documentation via schema doc replace.
export function DocumentationModal({ open, cls, propName, docPath, onClose }: Props) {
  const { t } = useTranslation();
  const username = useAppSelector((s) => s.auth.username ?? "admin");
  const [replaceSchemaDocument] = useReplaceSchemaDocumentMutation();
  const [initializedFor, setInitializedFor] = useState<string | null>(null);
  const [defaultDoc, setDefaultDoc] = useState<Row>({ lang: "", label: "", comment: "" });
  // Engine rule: once any entry carries @language, every entry must have one —
  // the "default" entry then needs an explicit tag (usually the primary language).
  const [defaultLang, setDefaultLang] = useState("en");
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<ApiErrorDetail | null>(null);
  const [saving, setSaving] = useState(false);

  const key = `${cls["@id"]}:${propName ?? ""}`;
  if (open && initializedFor !== key) {
    setInitializedFor(key);
    const docs: DocumentationSet = propName ? readPropDocs(cls, propName) : readTypeDocs(cls);
    setDefaultDoc({ lang: "", label: docs.default.label ?? "", comment: docs.default.comment ?? "" });
    setRows(
      Object.entries(docs.translations).map(([lang, d]) => ({ lang, label: d.label ?? "", comment: d.comment ?? "" }))
    );
    setError(null);
  }
  if (!open) return null;

  const updateRow = (i: number, patch: Partial<Row>) => setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));

  const save = async () => {
    setSaving(true);
    setError(null);
    const langs = rows.map((r) => r.lang.trim()).filter(Boolean);
    if (new Set(langs).size !== langs.length) {
      setError({ type: null, message: t("model.docs.duplicateLang"), detailsJson: "" });
      setSaving(false);
      return;
    }
    const docs: DocumentationSet = {
      default: { label: defaultDoc.label, comment: defaultDoc.comment },
      translations: Object.fromEntries(
        rows.filter((r) => r.lang.trim()).map((r) => [r.lang.trim(), { label: r.label, comment: r.comment }])
      ),
    };
    if (langs.length > 0) {
      // Multilingual → tag the default entry too.
      docs.translations = { ...docs.translations };
      const dl = defaultLang.trim() || "en";
      if (!langs.includes(dl) && (defaultDoc.label.trim() || defaultDoc.comment.trim())) {
        docs.translations[dl] = { label: defaultDoc.label, comment: defaultDoc.comment };
        docs.default = {};
      } else if (langs.includes(dl)) {
        docs.default = {};
      }
    }
    try {
      await replaceSchemaDocument({
        path: docPath,
        id: cls["@id"],
        document: withDocumentation(cls, propName ? { propName, propDocs: docs } : { typeDocs: docs }),
        author: username,
        message: propName ? `model: docs ${cls["@id"]}.${propName}` : `model: docs ${cls["@id"]}`,
      }).unwrap();
      onClose();
    } catch (err) {
      setError(describeApiError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModelDialog open={open} onClose={onClose} widthClass="w-[36rem]"
      title={propName ? t("model.docs.titleField", { id: cls["@id"], prop: propName }) : t("model.docs.titleClass", { id: cls["@id"] })}>
      <div className="mb-3 grid grid-cols-[5rem_1fr_1fr] items-end gap-2">
        <div className="text-[10px] font-semibold tracking-wide text-gray-400 uppercase">{t("model.docs.lang")}</div>
        <div className="text-[10px] font-semibold tracking-wide text-gray-400 uppercase">{t("model.docs.label")}</div>
        <div className="text-[10px] font-semibold tracking-wide text-gray-400 uppercase">{t("model.docs.comment")}</div>
        {rows.length > 0 ? (
          <input className={inputCls} value={defaultLang} aria-label={t("model.docs.defaultLangTag")} title={t("model.docs.defaultLangTitle")} onChange={(e) => setDefaultLang(e.target.value)} />
        ) : (
          <span className="text-xs text-gray-500 italic">{t("model.docs.defaultLang")}</span>
        )}
        <input className={inputCls} value={defaultDoc.label} aria-label={t("model.docs.label")} onChange={(e) => setDefaultDoc((d) => ({ ...d, label: e.target.value }))} />
        <input className={inputCls} value={defaultDoc.comment} aria-label={t("model.docs.comment")} onChange={(e) => setDefaultDoc((d) => ({ ...d, comment: e.target.value }))} />
        {rows.map((row, i) => (
          <div key={i} className="contents">
            <input className={inputCls} value={row.lang} placeholder="en" aria-label={t("model.docs.lang")} onChange={(e) => updateRow(i, { lang: e.target.value })} />
            <input className={inputCls} value={row.label} aria-label={`${t("model.docs.label")} ${row.lang}`} onChange={(e) => updateRow(i, { label: e.target.value })} />
            <div className="flex gap-1">
              <input className={inputCls} value={row.comment} aria-label={`${t("model.docs.comment")} ${row.lang}`} onChange={(e) => updateRow(i, { comment: e.target.value })} />
              <button type="button" className="shrink-0 rounded px-1 text-gray-400 hover:text-red-600" aria-label={t("common.delete")} onClick={() => setRows((r) => r.filter((_, j) => j !== i))}>
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
      <button type="button" className="rounded border border-dashed border-gray-300 px-2 py-0.5 text-xs text-gray-500 hover:border-sky-400 dark:border-gray-600" onClick={() => setRows((r) => [...r, { lang: "", label: "", comment: "" }])}>
        {t("model.docs.addLang")}
      </button>
      {error && (
        <div className="mt-2">
          <ApiErrorBlock error={error} />
        </div>
      )}
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" className="rounded px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800" onClick={onClose}>
          {t("common.close")}
        </button>
        <button type="button" className="rounded bg-sky-600 px-3 py-1 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50" disabled={saving} onClick={() => void save()}>
          {t("common.save")}
        </button>
      </div>
    </ModelDialog>
  );
}
