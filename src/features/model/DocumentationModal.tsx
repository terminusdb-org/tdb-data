import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppSelector, useReplaceSchemaDocumentMutation } from "@/store";
import { describeApiError, type ApiErrorDetail } from "@/utils/apiErrors";
import { ApiErrorBlock } from "@/components/ApiErrorBlock";
import { ModelDialog } from "@/components/ModelDialog";
import { asArray, readPropDocs, readTypeDocs, withDocumentation, type DocumentationSet } from "@/lib/schemaModel/classDocs";
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
const langCls =
  "w-24 shrink-0 rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-950 dark:text-gray-100";
const labelCls =
  "min-w-0 flex-1 rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-950 dark:text-gray-100";

// Multilingual label/description editor — one default entry plus one row per
// language, written to the class doc's @documentation via schema doc replace.
export function DocumentationModal({ open, cls, propName, docPath, onClose }: Props) {
  const { t } = useTranslation();
  const username = useAppSelector((s) => s.auth.username ?? "admin");
  const [replaceSchemaDocument] = useReplaceSchemaDocumentMutation();
  const [initializedFor, setInitializedFor] = useState<string | null>(null);
  const [defaultDoc, setDefaultDoc] = useState<Row>({ lang: "", label: "", comment: "" });
  // Engine rule (api:NoLanguageTagForMultilingual): once any entry carries
  // @language, every entry must have one — the default entry then needs an
  // explicit tag. Left empty so the user picks rather than silently becoming "en".
  const [defaultLang, setDefaultLang] = useState("");
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
    setDefaultLang("");
    setError(null);
  }
  if (!open) return null;

  const updateRow = (i: number, patch: Partial<Row>) => setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));

  // Engine rule: tagged and untagged @documentation entries cannot mix. When
  // the class doc already has tagged entries, no untagged "default" entry can
  // exist — the default row is only shown in monolingual docs (or to rescue
  // content a corrupt doc left in one).
  const docEntries = asArray(cls["@documentation"]);
  const classHasUntagged = docEntries.some((e) => e["@language"] === undefined);
  const classHasTagged = docEntries.some((e) => typeof e["@language"] === "string");
  // Show the default row for monolingual docs, for existing untagged content,
  // and for corrupt docs carrying an untagged entry (its tag input is needed
  // to retag it on a multilingual save).
  const showDefaultRow = !classHasTagged || classHasUntagged || !!(defaultDoc.label.trim() || defaultDoc.comment.trim());

  const save = async () => {
    setSaving(true);
    setError(null);
    const langs = rows.map((r) => r.lang.trim()).filter(Boolean);
    if (new Set(langs).size !== langs.length) {
      setError({ type: null, message: t("model.docs.duplicateLang"), detailsJson: "" });
      setSaving(false);
      return;
    }
    if (rows.some((r) => !r.lang.trim() && (r.label.trim() || r.comment.trim()))) {
      setError({ type: null, message: t("model.docs.langRequired"), detailsJson: "" });
      setSaving(false);
      return;
    }
    const multilingual = langs.length > 0;
    const dl = defaultLang.trim();
    const defaultHasContent = !!(defaultDoc.label.trim() || defaultDoc.comment.trim());
    // An untagged entry must be retagged when it exists in the class doc
    // (carrying other fields' docs) or the default row has content.
    if (multilingual && (classHasUntagged || defaultHasContent)) {
      if (!dl) {
        setError({ type: null, message: t("model.docs.defaultNeedsLang"), detailsJson: "" });
        setSaving(false);
        return;
      }
      if (langs.includes(dl)) {
        setError({ type: null, message: t("model.docs.defaultLangDuplicate", { lang: dl }), detailsJson: "" });
        setSaving(false);
        return;
      }
    }
    const docs: DocumentationSet = {
      default: multilingual ? {} : { label: defaultDoc.label, comment: defaultDoc.comment },
      translations: Object.fromEntries(
        rows.filter((r) => r.lang.trim()).map((r) => [r.lang.trim(), { label: r.label, comment: r.comment }])
      ),
    };
    if (multilingual && defaultHasContent) docs.translations[dl] = { label: defaultDoc.label, comment: defaultDoc.comment };
    try {
      await replaceSchemaDocument({
        path: docPath,
        id: cls["@id"],
        document: withDocumentation(cls, {
          ...(propName ? { propName, propDocs: docs } : { typeDocs: docs }),
          defaultLang: dl || undefined,
        }),
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
      {rows.length > 0 && !classHasTagged && (
        <div role="alert" className="mb-3 flex items-start gap-2 rounded bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <span aria-hidden="true">⚠</span>
          <span>{t("model.docs.firstLangWarning")}</span>
        </div>
      )}
      <div className="mb-3 flex flex-col gap-3">
        {showDefaultRow && (
        <div>
          <div className="flex items-center gap-2">
            <span className="flex w-24 shrink-0 items-center gap-1 text-xs text-gray-500 italic" title={t("model.docs.defaultTitle")}>
              {t("model.docs.defaultLang")}
              {rows.length > 0 && (
                <input
                  className="w-11 shrink-0 rounded border border-gray-300 px-1 py-1 text-xs not-italic dark:border-gray-600 dark:bg-gray-950 dark:text-gray-100"
                  value={defaultLang}
                  placeholder="en"
                  aria-label={t("model.docs.defaultLangTag")}
                  title={t("model.docs.defaultLangTitle")}
                  onChange={(e) => setDefaultLang(e.target.value)}
                />
              )}
            </span>
            <input className={labelCls} value={defaultDoc.label} placeholder={t("model.docs.label")} aria-label={t("model.docs.label")} onChange={(e) => setDefaultDoc((d) => ({ ...d, label: e.target.value }))} />
            <span className="w-5 shrink-0" />
          </div>
          <textarea className={`${inputCls} mt-1 resize-y`} rows={3} value={defaultDoc.comment} placeholder={t("model.docs.comment")} aria-label={t("model.docs.comment")} onChange={(e) => setDefaultDoc((d) => ({ ...d, comment: e.target.value }))} />
        </div>
        )}
        {!showDefaultRow && rows.length === 0 && (
          <p className="text-xs text-gray-500 italic">{t("model.docs.multilingualHint")}</p>
        )}
        {rows.map((row, i) => (
          <div key={i}>
            <div className="flex items-center gap-2">
              <input className={langCls} value={row.lang} placeholder="en" aria-label={t("model.docs.lang")} onChange={(e) => updateRow(i, { lang: e.target.value })} />
              <input className={labelCls} value={row.label} placeholder={t("model.docs.label")} aria-label={`${t("model.docs.label")} ${row.lang}`} onChange={(e) => updateRow(i, { label: e.target.value })} />
              <button type="button" className="w-5 shrink-0 rounded text-gray-400 hover:text-red-600" aria-label={t("common.delete")} onClick={() => setRows((r) => r.filter((_, j) => j !== i))}>
                ×
              </button>
            </div>
            <textarea className={`${inputCls} mt-1 resize-y`} rows={3} value={row.comment} placeholder={t("model.docs.comment")} aria-label={`${t("model.docs.comment")} ${row.lang}`} onChange={(e) => updateRow(i, { comment: e.target.value })} />
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
