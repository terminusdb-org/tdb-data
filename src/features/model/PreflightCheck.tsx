import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Editor from "@monaco-editor/react";
import Ajv, { type ErrorObject } from "ajv";
import { useCheckDocumentMutation, useGetJsonSchemaQuery, useAppSelector } from "@/store";
import { describeApiError, type ApiErrorDetail } from "@/utils/apiErrors";
import { ApiErrorBlock } from "@/components/ApiErrorBlock";
import { ModelDialog } from "@/components/ModelDialog";
import { strictJsonSchema } from "@/lib/schemaModel/jsonSchema";
import { witnessSummary } from "@/lib/schemaModel/iri";
import type { SchemaModel } from "@/lib/schemaModel/types";

interface Props {
  open: boolean;
  type: string;
  docPath: string;
  /** When provided together with `model`, enables the JSON Schema check. */
  schemaPath?: string;
  model?: SchemaModel;
  initialDoc?: string;
  onClose: () => void;
}

const ajv = new Ajv({ allErrors: true });

interface TdbCheckResult {
  ok: boolean;
  /** api:error / api:message the engine returned, if any. */
  apiError?: string;
  /** One-line compressed summaries of each witness. */
  summaries: string[];
  /** Full witness/error payload, IRIs compressed, for the details block. */
  detailsJson: string;
}

// Pre-flight a document: strict JSON Schema validation (primary, mirrors the
// engine's "known fields only" rule) plus the live engine check under an
// upsert regime (secondary, reported as technical feedback with witnesses).
export function PreflightCheck({ open, type, docPath, schemaPath, model, initialDoc, onClose }: Props) {
  const { t } = useTranslation();
  const username = useAppSelector((s) => s.auth.username ?? "admin");
  const [checkDocument] = useCheckDocumentMutation();
  const jsonModeAvailable = !!schemaPath && !!model;
  const [text, setText] = useState(initialDoc ?? JSON.stringify({ "@type": type }, null, 2));
  const [ajvResult, setAjvResult] = useState<"ok" | "fail" | null>(null);
  const [ajvErrors, setAjvErrors] = useState<ErrorObject[] | null>(null);
  const [tdbResult, setTdbResult] = useState<TdbCheckResult | null>(null);
  const [tdbError, setTdbError] = useState<ApiErrorDetail | null>(null);
  const [checking, setChecking] = useState(false);

  const { data: jsonSchema } = useGetJsonSchemaQuery(
    { path: schemaPath ?? "", type },
    { skip: !open || !jsonModeAvailable }
  );
  const strict = useMemo(() => (jsonSchema && model ? strictJsonSchema(jsonSchema, model) : undefined), [jsonSchema, model]);

  if (!open) return null;

  const run = async () => {
    setChecking(true);
    setAjvResult(null);
    setAjvErrors(null);
    setTdbResult(null);
    setTdbError(null);
    let doc: unknown;
    try {
      doc = JSON.parse(text);
    } catch (err) {
      setTdbError({ type: null, message: t("model.preflight.invalidJson"), detailsJson: String(err) });
      setChecking(false);
      return;
    }

    // 1) JSON Schema check — primary verdict.
    if (strict) {
      const validate = ajv.compile(strict);
      if (validate(doc)) {
        setAjvResult("ok");
      } else {
        setAjvResult("fail");
        setAjvErrors(validate.errors ?? []);
      }
    }

    // 2) TerminusDB engine check under upsert — technical feedback.
    try {
      const res = await checkDocument({
        path: docPath,
        document: doc,
        author: username,
        message: `model: preflight ${type}`,
      }).unwrap();
      const rec = res as Record<string, unknown>;
      const witnesses = rec["api:witnesses"];
      const apiError = rec["api:error"];
      const summaries = (Array.isArray(witnesses) ? witnesses : [])
        .map(witnessSummary)
        .filter((s): s is string => !!s);
      const technical: Record<string, unknown> = {};
      if (apiError !== undefined) technical["api:error"] = apiError;
      if (rec["api:message"] !== undefined) technical["api:message"] = rec["api:message"];
      if (witnesses !== undefined) technical["api:witnesses"] = witnesses;
      if (rec["api:embedding"] !== undefined) technical["api:embedding"] = rec["api:embedding"];
      setTdbResult({
        ok: rec["api:valid"] !== false,
        apiError:
          apiError && typeof apiError === "object" && "@type" in (apiError as object)
            ? String((apiError as Record<string, unknown>)["@type"])
            : typeof rec["api:message"] === "string"
              ? (rec["api:message"] as string)
              : undefined,
        summaries,
        detailsJson: Object.keys(technical).length ? JSON.stringify(technical, null, 2) : "",
      });
    } catch (err) {
      setTdbError(describeApiError(err));
    } finally {
      setChecking(false);
    }
  };

  const waitingOnSchema = jsonModeAvailable && !strict;

  return (
    <ModelDialog open={open} onClose={onClose} widthClass="w-[38rem]" title={t("model.preflight.title", { type })}>
      <div className="h-64">
        <Editor
          height="100%"
          defaultLanguage="json"
          value={text}
          onChange={(v) => setText(v ?? "")}
          options={{ minimap: { enabled: false }, fontSize: 12, automaticLayout: true, scrollBeyondLastLine: false }}
        />
      </div>

      {jsonModeAvailable && (
        <div className="mt-2">
          <div className="text-[10px] font-semibold tracking-wide text-gray-400 uppercase">
            {t("model.preflight.mode.jsonschema")}
          </div>
          {waitingOnSchema && <div className="mt-1 text-xs text-gray-500">{t("model.preflight.schemaLoading")}</div>}
          {ajvResult === "ok" && (
            <div className="mt-1 rounded bg-emerald-50 p-2 text-xs text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
              {t("model.preflight.ok")}
            </div>
          )}
          {ajvResult === "fail" && ajvErrors && (
            <ul className="mt-1 max-h-32 overflow-y-auto rounded bg-red-50 p-2 text-xs text-red-800 dark:bg-red-950/40 dark:text-red-300">
              {ajvErrors.map((e, i) => (
                <li key={i} className="font-mono">
                  {("instancePath" in e ? String(e.instancePath) : "") || "/"} {e.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-2">
        <div className="text-[10px] font-semibold tracking-wide text-gray-400 uppercase">
          {t("model.preflight.mode.terminusdb")}
        </div>
        {tdbResult?.ok && (
          <div className="mt-1 rounded bg-emerald-50 p-2 text-xs text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
            {t("model.preflight.ok")}
          </div>
        )}
        {tdbResult && !tdbResult.ok && (
          <div className="mt-1 rounded bg-red-50 p-2 text-xs text-red-800 dark:bg-red-950/40 dark:text-red-300">
            <div>{t("model.preflight.failed")}{tdbResult.apiError ? ` — ${tdbResult.apiError}` : ""}</div>
            {tdbResult.summaries.map((s, i) => (
              <div key={i} className="mt-0.5 font-mono">{s}</div>
            ))}
          </div>
        )}
        {tdbResult?.detailsJson && (
          <details className="mt-1 text-xs">
            <summary className="cursor-pointer text-gray-500">{t("model.preflight.technical")}</summary>
            <pre className="mt-1 max-h-40 overflow-auto rounded bg-gray-50 p-2 font-mono text-[10px] text-gray-600 dark:bg-gray-900 dark:text-gray-400">
              {tdbResult.detailsJson}
            </pre>
          </details>
        )}
        {tdbError && (
          <div className="mt-1">
            <ApiErrorBlock error={tdbError} />
          </div>
        )}
      </div>

      <div className="mt-3 flex justify-end gap-2">
        <button type="button" className="rounded px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800" onClick={onClose}>
          {t("common.close")}
        </button>
        <button
          type="button"
          className="rounded bg-sky-600 px-3 py-1 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
          disabled={checking || waitingOnSchema}
          onClick={() => void run()}
        >
          {checking ? t("model.preflight.checking") : t("model.preflight.run")}
        </button>
      </div>
    </ModelDialog>
  );
}
