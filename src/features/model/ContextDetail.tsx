import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Editor from "@monaco-editor/react";
import type { SchemaClass } from "@/types/terminusdb";
import {
  useAddPrefixMutation,
  useAppDispatch,
  useAppSelector,
  useDeletePrefixMutation,
  useReplaceContextMutation,
  useUpdatePrefixMutation,
  notify,
} from "@/store";
import { describeApiError } from "@/utils/apiErrors";
import {
  PrefixRow,
  diffPrefixes,
  isEmptyPrefixDiff,
  prefixMapOf,
  rowsToPrefixMap,
  splitContextDoc,
} from "@/lib/schemaModel/contextEdit";

interface Props {
  classes: SchemaClass[];
  schemaPath: string;
  tab?: string;
  onTabChange: (tab: string) => void;
}

interface FormState {
  base: string;
  schema: string;
  rows: PrefixRow[];
  metadataJson: string;
  storeIndices: boolean;
  storeClustering: boolean;
  docLang: string;
  docTitle: string;
  docDesc: string;
}

const inputCls =
  "rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-950 dark:text-gray-100";

const normalizeDocs = (ctx: Record<string, unknown>): Record<string, unknown>[] => {
  const d = ctx["@documentation"];
  if (Array.isArray(d)) return d as Record<string, unknown>[];
  if (d && typeof d === "object") return [d as Record<string, unknown>];
  return [];
};

const formFromDoc = (ctx: Record<string, unknown>): FormState => {
  const metadata = (ctx["@metadata"] ?? {}) as Record<string, unknown>;
  const opts = (metadata?.["terminusdb"] as Record<string, unknown> | undefined)?.["options"];
  const options = Array.isArray(opts) ? (opts as string[]) : [];
  const doc0 = normalizeDocs(ctx)[0] ?? {};
  return {
    base: String(ctx["@base"] ?? ""),
    schema: String(ctx["@schema"] ?? ""),
    rows: Object.entries(prefixMapOf(ctx)).map(([prefix, uri]) => ({ prefix, uri })),
    metadataJson: JSON.stringify(metadata, null, 2),
    storeIndices: options.includes("store_indices"),
    storeClustering: options.includes("store_clustering"),
    docLang: String(doc0["@language"] ?? "en"),
    docTitle: String(doc0["@title"] ?? ""),
    docDesc: String(doc0["@description"] ?? ""),
  };
};

// Builds the @context document from the structured form. Returns null when
// @metadata JSON is invalid; the caller surfaces the error.
const docFromForm = (f: FormState): Record<string, unknown> | null => {
  let parsedMetadata: Record<string, unknown> = {};
  if (f.metadataJson.trim()) {
    try {
      parsedMetadata = JSON.parse(f.metadataJson);
    } catch {
      return null;
    }
  }
  const options = [f.storeIndices ? "store_indices" : null, f.storeClustering ? "store_clustering" : null].filter(
    Boolean
  ) as string[];
  const nextMetadata = { ...parsedMetadata };
  if (options.length > 0) {
    nextMetadata["terminusdb"] = { ...((nextMetadata["terminusdb"] as Record<string, unknown>) ?? {}), options };
  } else if (nextMetadata["terminusdb"] && typeof nextMetadata["terminusdb"] === "object") {
    const { options: _drop, ...restTdb } = nextMetadata["terminusdb"] as Record<string, unknown>;
    if (Object.keys(restTdb).length > 0) nextMetadata["terminusdb"] = restTdb;
    else delete nextMetadata["terminusdb"];
  }

  const { map } = rowsToPrefixMap(f.rows);
  const out: Record<string, unknown> = { "@type": "@context", "@base": f.base, "@schema": f.schema, ...map };
  if (Object.keys(nextMetadata).length > 0) out["@metadata"] = nextMetadata;
  if (f.docTitle || f.docDesc) {
    out["@documentation"] = [
      { "@language": f.docLang || "en", ...(f.docTitle && { "@title": f.docTitle }), ...(f.docDesc && { "@description": f.docDesc }) },
    ];
  }
  return out;
};

// @context detail — structured editing (prefixes, @base/@schema, metadata
// options like indexing, documentation) plus a raw JSON tab that mirrors the
// structured state in both directions.
//
// Saving: prefix pairs go through the prefix management API as a side action
// (atomic per-prefix add/update/delete with engine validation), then the
// non-prefix fields are written via a PUT of the "@context" document —
// ReplaceContext is not implemented in the migration engine.
export function ContextDetail({ classes, schemaPath, tab: routeTab, onTabChange }: Props) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const username = useAppSelector((state) => state.auth.username ?? "admin");
  const [replaceContext] = useReplaceContextMutation();
  const [addPrefix] = useAddPrefixMutation();
  const [updatePrefix] = useUpdatePrefixMutation();
  const [deletePrefix] = useDeletePrefixMutation();
  const tab = routeTab === "json" ? "json" : "struct";

  const ctx = useMemo(() => {
    const raw = classes.find((c) => c["@id"] === "@context") as Record<string, unknown> | undefined;
    return raw ?? { "@type": "@context" };
  }, [classes]);

  const serverPrefixes = useMemo(() => prefixMapOf(ctx), [ctx]);

  const [form, setForm] = useState<FormState>(() => formFromDoc(ctx));
  const [jsonText, setJsonText] = useState(() => JSON.stringify(ctx, null, 2));
  const [jsonValid, setJsonValid] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [prefixApplying, setPrefixApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reload mirrored state when the context document changes server-side
  // (e.g. after prefix ops invalidate the query), unless edits are pending.
  useEffect(() => {
    if (dirty) return;
    setForm(formFromDoc(ctx));
    setJsonText(JSON.stringify(ctx, null, 2));
    setJsonValid(true);
  }, [ctx, dirty]);

  // Structured → raw mirror.
  const updateForm = (patch: Partial<FormState>) => {
    const next = { ...form, ...patch };
    setForm(next);
    setDirty(true);
    const doc = docFromForm(next);
    if (doc) setJsonText(JSON.stringify(doc, null, 2));
  };

  // Raw → structured mirror (only while the JSON stays legible).
  const onJsonChange = (v: string | undefined) => {
    const text = v ?? "";
    setJsonText(text);
    setDirty(true);
    try {
      const doc = JSON.parse(text) as unknown;
      if (doc && typeof doc === "object" && !Array.isArray(doc)) {
        setJsonValid(true);
        setForm(formFromDoc(doc as Record<string, unknown>));
      } else {
        setJsonValid(false);
      }
    } catch {
      setJsonValid(false);
    }
  };

  // In the JSON tab a malformed document yields no desired prefixes —
  // the diff is then meaningless, so the apply action stays gated by jsonValid.
  const desiredDoc = tab === "json" ? safeParse(jsonText) : null;
  const desiredRows =
    tab === "json"
      ? Object.entries(prefixMapOf(desiredDoc ?? {})).map(([prefix, uri]) => ({ prefix, uri }))
      : form.rows;
  const desiredPrefixes = rowsToPrefixMap(desiredRows);
  const prefixDiff = diffPrefixes(serverPrefixes, desiredPrefixes.map);
  const prefixDirty = !isEmptyPrefixDiff(prefixDiff) && (tab !== "json" || !!desiredDoc);

  const applyPrefixChanges = async (): Promise<boolean> => {
    if (tab === "json" && !desiredDoc) {
      setError(t("model.context.invalidJson"));
      return false;
    }
    if (desiredPrefixes.errors.length > 0) {
      setError(t("model.context.invalidPrefixes", { list: desiredPrefixes.errors.join(", ") }));
      return false;
    }
    if (isEmptyPrefixDiff(prefixDiff)) return true;
    setPrefixApplying(true);
    try {
      for (const name of prefixDiff.deletes) await deletePrefix({ path: schemaPath, name }).unwrap();
      for (const p of prefixDiff.updates) await updatePrefix({ path: schemaPath, name: p.prefix, uri: p.uri }).unwrap();
      for (const p of prefixDiff.adds) await addPrefix({ path: schemaPath, name: p.prefix, uri: p.uri }).unwrap();
      return true;
    } catch (err) {
      const detail = describeApiError(err);
      setError(detail.message);
      dispatch(notify({ severity: "error", title: t("model.context.prefixFailed"), message: detail.message, detailsJson: detail.detailsJson }));
      return false;
    } finally {
      setPrefixApplying(false);
    }
  };

  const save = async () => {
    setError(null);
    let doc: Record<string, unknown> | null;
    if (tab === "json") {
      if (!jsonValid) return;
      doc = JSON.parse(jsonText) as Record<string, unknown>;
      const { "@id": _id, ...rest } = doc;
      doc = { ...rest, "@type": "@context" };
    } else {
      doc = docFromForm(form);
      if (!doc) {
        setError(t("model.context.invalidJson"));
        return;
      }
    }
    const { prefixes, fields } = splitContextDoc(doc);

    setSaving(true);
    try {
      // Side action first: prefixes via the management API (atomic per-prefix
      // validation), then the keyword fields via the @context document PUT.
      if (!(await applyPrefixChanges())) return;
      await replaceContext({
        path: schemaPath,
        context: { ...fields, "@type": "@context", ...prefixes },
        author: username,
        message: t("common.updatedContextVia"),
      }).unwrap();
      setDirty(false);
    } catch (err) {
      const detail = describeApiError(err);
      setError(detail.message);
      dispatch(notify({ severity: "error", title: t("model.context.saveFailed"), message: detail.message, detailsJson: detail.detailsJson }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-w-0 flex-1 p-3">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-base font-semibold">@context</h2>
        <span className="ml-auto flex gap-1">
          <button
            type="button"
            className="rounded bg-sky-600 px-3 py-1 text-xs font-medium text-white hover:bg-sky-700 disabled:opacity-50"
            disabled={saving || prefixApplying || !jsonValid}
            onClick={() => void save()}
          >
            {saving ? t("common.saving") : t("common.save")}
          </button>
        </span>
      </div>
      <div className="mb-2 flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {(["struct", "json"] as const).map((tb) => (
          <button
            key={tb}
            type="button"
            className={`border-b-2 px-3 py-1 text-sm ${tab === tb ? "border-sky-500 font-medium" : "border-transparent text-gray-500"}`}
            onClick={() => onTabChange(tb === "struct" ? "def" : "json")}
          >
            {tb === "struct" ? t("model.context.structuredTab") : t("model.class.rawTab")}
          </button>
        ))}
      </div>

      {tab === "struct" && (
        <div className="max-w-2xl space-y-3 text-sm">
          <div className="flex gap-2">
            <label className="flex-1">
              <span className="mb-0.5 block text-xs text-gray-500">@base</span>
              <input className={`${inputCls} w-full font-mono`} value={form.base} onChange={(e) => updateForm({ base: e.target.value })} />
            </label>
            <label className="flex-1">
              <span className="mb-0.5 block text-xs text-gray-500">@schema</span>
              <input className={`${inputCls} w-full font-mono`} value={form.schema} onChange={(e) => updateForm({ schema: e.target.value })} />
            </label>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-500 uppercase">{t("model.context.prefixes")}</label>
              <span className="flex gap-1">
                {prefixDirty && (
                  <button
                    type="button"
                    className="rounded bg-sky-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-sky-700 disabled:opacity-50"
                    disabled={prefixApplying}
                    onClick={() => void applyPrefixChanges()}
                  >
                    {prefixApplying ? t("common.saving") : t("model.context.applyPrefixes")}
                  </button>
                )}
                <button
                  type="button"
                  className="rounded border border-dashed border-gray-300 px-2 py-0.5 text-xs text-gray-500 hover:border-sky-400 dark:border-gray-600"
                  onClick={() => updateForm({ rows: [...form.rows, { prefix: "", uri: "" }] })}
                >
                  {t("model.context.addPrefix")}
                </button>
              </span>
            </div>
            {form.rows.map((r, i) => (
              <div key={i} className="mb-1 flex gap-1">
                <input
                  className={`${inputCls} w-32 font-mono`}
                  placeholder="prefix"
                  value={r.prefix}
                  onChange={(e) => updateForm({ rows: form.rows.map((x, j) => (j === i ? { ...x, prefix: e.target.value } : x)) })}
                />
                <input
                  className={`${inputCls} flex-1 font-mono`}
                  placeholder="http://…"
                  value={r.uri}
                  onChange={(e) => updateForm({ rows: form.rows.map((x, j) => (j === i ? { ...x, uri: e.target.value } : x)) })}
                />
                <button
                  type="button"
                  className="rounded px-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                  onClick={() => updateForm({ rows: form.rows.filter((_, j) => j !== i) })}
                >
                  ×
                </button>
              </div>
            ))}
            {desiredPrefixes.errors.length > 0 && (
              <div className="mt-1 text-xs text-red-600">
                {t("model.context.invalidPrefixes", { list: desiredPrefixes.errors.join(", ") })}
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500 uppercase">{t("model.context.options")}</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-1 text-xs" title={t("model.context.storeIndicesTitle")}>
                <input type="checkbox" checked={form.storeIndices} onChange={(e) => updateForm({ storeIndices: e.target.checked })} />
                store_indices
              </label>
              <label className="flex items-center gap-1 text-xs" title={t("model.context.storeClusteringTitle")}>
                <input type="checkbox" checked={form.storeClustering} onChange={(e) => updateForm({ storeClustering: e.target.checked })} />
                store_clustering
              </label>
            </div>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-500 uppercase">@metadata (JSON)</span>
            <textarea
              className={`${inputCls} w-full font-mono`}
              rows={4}
              value={form.metadataJson}
              onChange={(e) => updateForm({ metadataJson: e.target.value })}
            />
          </label>

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500 uppercase">{t("model.context.documentation")}</label>
            <div className="mb-1 flex gap-2">
              <input className={`${inputCls} w-16`} placeholder="lang" value={form.docLang} onChange={(e) => updateForm({ docLang: e.target.value })} />
              <input className={`${inputCls} flex-1`} placeholder={t("model.context.docTitle")} value={form.docTitle} onChange={(e) => updateForm({ docTitle: e.target.value })} />
            </div>
            <textarea
              className={`${inputCls} w-full`}
              rows={2}
              placeholder={t("model.context.docDescription")}
              value={form.docDesc}
              onChange={(e) => updateForm({ docDesc: e.target.value })}
            />
          </div>
        </div>
      )}

      {tab === "json" && (
        <div className="h-[60vh]">
          <Editor
            height="100%"
            defaultLanguage="json"
            value={jsonText}
            onChange={onJsonChange}
            options={{ minimap: { enabled: false }, fontSize: 12, automaticLayout: true, scrollBeyondLastLine: false }}
          />
          {!jsonValid && <div className="mt-1 text-xs text-red-600">{t("model.context.invalidJson")}</div>}
        </div>
      )}
      {error && <div className="mt-2 text-xs text-red-600">{error}</div>}
    </div>
  );
}

const safeParse = (text: string): Record<string, unknown> | null => {
  try {
    const v = JSON.parse(text) as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};
