import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Editor from "@monaco-editor/react";
import ReactMarkdown from "react-markdown";
import Form from "@rjsf/core";
import { customizeValidator } from "@rjsf/validator-ajv8";
import type { ErrorSchema, IconButtonProps } from "@rjsf/utils";
import { TdbTextareaWidget } from "./form/widgets";
import { buildFormUiSchema } from "@/utils/formUiSchema";

// Studio (zebra) ajv configuration: ajv-formats enabled, allErrors, strict
// off so TerminusDB keywords like `x-terminusdb` pass through — the same
// setup `customizeValidator` applies by default, made explicit here.
const formValidator = customizeValidator();

const FORM_WIDGETS = { textarea: TdbTextareaWidget };
import type { EditableDocument, TerminusDBDocument } from "@/types/terminusdb";
import { isValidJson, displayId } from "@/utils/validation";
import { buildApiPath, type RouteParams } from "@/utils/routes";
import type { RefType } from "@/store/dataProductSlice";
import { useGetEmbeddingTextQuery, useGetMarkdownTextQuery, useGetJsonSchemaQuery } from "@/store";
import { SimilarDocumentsPanel } from "./SimilarDocumentsPanel";

type EditorTab = "form" | "json" | "markdown" | "embedding" | "similar";

const VALIDATE_DEBOUNCE_MS = 400;

// RJSF's stock icon buttons use Bootstrap glyphicons, which aren't shipped —
// swap them for plain symbol buttons with titles.
function makeIconButton(symbol: string, title: string) {
  return function TdbIconButton({ className, onClick, disabled }: IconButtonProps) {
    return (
      <button type="button" className={`tdb-form-btn ${className ?? ""}`} onClick={onClick} disabled={disabled} title={title} aria-label={title}>
        {symbol}
      </button>
    );
  };
}

const FORM_TEMPLATES = {
  ButtonTemplates: {
    AddButton: makeIconButton("+", "Add item"),
    MoveUpButton: makeIconButton("↑", "Move item up"),
    MoveDownButton: makeIconButton("↓", "Move item down"),
    RemoveButton: makeIconButton("×", "Remove item"),
    CopyButton: makeIconButton("⧉", "Copy item"),
  },
};

interface DocumentEditorProps {
  readonly document: EditableDocument;
  readonly onSave: (doc: EditableDocument) => Promise<void> | void;
  readonly onCancel: () => void;
  readonly saving?: boolean;
  readonly isNew?: boolean;
}

const MONACO_OPTIONS = {
  minimap: { enabled: false },
  fontSize: 13,
  wordWrap: "on" as const,
  scrollBeyondLastLine: false,
  automaticLayout: true,
  tabSize: 2,
  scrollbar: { alwaysConsumeMouseWheel: false },
};

export const DocumentEditor: React.FC<DocumentEditorProps> = ({ document, onSave, onCancel, saving, isNew }) => {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const [doc, setDoc] = useState<EditableDocument>(document);
  const [valid, setValid] = useState(true);
  const [schemaErrors, setSchemaErrors] = useState<string[]>([]);
  const [errorSchema, setErrorSchema] = useState<ErrorSchema<TerminusDBDocument>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<EditorTab>("form");
  const params = useParams();
  const navigate = useNavigate();

  const { org, team, branch, commitId } = params;
  let refType: RefType | null = null;
  if (branch) {
    refType = "branch";
  } else if (commitId) {
    refType = "commit";
  }
  const refName = branch ?? commitId ?? null;

  const routeParams: RouteParams | null = useMemo(() => {
    if (!org || !team || !refType || !refName) return null;
    return { org, team, refType, refName };
  }, [org, team, refType, refName]);

  const docPath = routeParams ? buildApiPath(routeParams, "document") : "";
  const schemaPath = routeParams ? buildApiPath(routeParams, "schema") : "";
  const similarPath = routeParams ? buildApiPath(routeParams, "similar") : "";
  const docId = document["@id"];
  const docType = document["@type"];

  const { data: jsonSchema, isFetching: schemaFetching } = useGetJsonSchemaQuery(
    { path: schemaPath, type: docType },
    { skip: !schemaPath || !docType }
  );

  const formUiSchema = useMemo(
    () => (jsonSchema ? buildFormUiSchema(jsonSchema, docPath, isNew) : {}),
    [jsonSchema, docPath, isNew]
  );

  const { data: embeddingText, isFetching: embeddingFetching, error: embeddingErr } = useGetEmbeddingTextQuery(
    { path: docPath, id: docId ?? "" },
    { skip: !docId || activeTab !== "embedding" }
  );

  const { data: markdownText, isFetching: markdownFetching, error: markdownErr } = useGetMarkdownTextQuery(
    { path: docPath, id: docId ?? "" },
    { skip: !docId || activeTab !== "markdown" }
  );

  // The server reports api:NoEmbeddingQueriesDefined when the type has no
  // embedding metadata — the Embeddings page can configure it.
  const noEmbeddingQueries = useMemo(() => {
    if (!embeddingErr || typeof embeddingErr !== "object" || !("data" in embeddingErr)) return false;
    const data = (embeddingErr as { data: unknown }).data;
    if (typeof data !== "object" || data === null) return false;
    const apiError = (data as Record<string, unknown>)["api:error"];
    const errorType =
      typeof apiError === "object" && apiError !== null
        ? (apiError as Record<string, unknown>)["@type"]
        : (data as Record<string, unknown>)["@type"];
    return errorType === "api:NoEmbeddingQueriesDefined";
  }, [embeddingErr]);

  useEffect(() => {
    setText(JSON.stringify(document, null, 2));
    setDoc(document);
    setValid(true);
    setSchemaErrors([]);
    setErrorSchema({});
  }, [document]);

  // Debounced JSON Schema validation — keeps typing snappy on complex
  // documents while still giving near-live feedback in the form.
  useEffect(() => {
    if (!jsonSchema || !valid) {
      setSchemaErrors([]);
      setErrorSchema({});
      return;
    }
    const handle = setTimeout(() => {
      const result = formValidator.validateFormData(doc, jsonSchema);
      const errors = (result.errors ?? []).map((e) => {
        const property = e.property ? e.property + " " : "";
        return property + (e.message ?? "");
      });
      setSchemaErrors(errors);
      setErrorSchema(result.errorSchema ?? {});
    }, VALIDATE_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [doc, jsonSchema, valid]);

  const handleChange = (value = "") => {
    const newText = value;
    setText(newText);
    const ok = isValidJson(newText);
    setValid(ok);
    if (ok) setDoc(JSON.parse(newText) as TerminusDBDocument);
    setSaveError(null);
  };

  const handleFormChange = (formData: TerminusDBDocument) => {
    const next = { ...formData, "@type": doc["@type"] ?? docType };
    if (next["@id"] === undefined && doc["@id"] !== undefined) next["@id"] = doc["@id"];
    setDoc(next);
    setText(JSON.stringify(next, null, 2));
    setValid(true);
    setSaveError(null);
  };

  const handleSave = async () => {
    if (!valid) return;
    setSaveError(null);
    try {
      await onSave(doc);
    } catch (err) {
      if (err && typeof err === "object" && "data" in err) {
        const data = (err as { data: unknown }).data;
        if (typeof data === "object" && data !== null) {
          const msg = (data as Record<string, unknown>)["api:message"] ?? (data as Record<string, unknown>).message ?? t("documentEditor.saveFailed");
          setSaveError(typeof msg === "string" ? msg : JSON.stringify(msg));
        } else {
          setSaveError(t("documentEditor.saveFailed"));
        }
      } else {
        setSaveError(t("documentEditor.saveFailed"));
      }
    }
  };

  const tabs: ReadonlyArray<{ id: EditorTab; label: string }> = [
    { id: "form", label: t("documentEditor.form") },
    { id: "json", label: t("documentEditor.json") },
    { id: "markdown", label: t("documentEditor.markdown") },
    { id: "embedding", label: t("documentEditor.embedding") },
    { id: "similar", label: t("documentEditor.similar") },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700">{docId ? displayId(docId) : ""}</span>
          {document["@type"] && (
            <button
              type="button"
              onClick={() => {
                if (org && team && refType && refName) {
                  navigate(`/${org}/${team}/local/${refType}/${refName}/schema?class=${encodeURIComponent(document["@type"])}`);
                }
              }}
              className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500 transition-colors hover:bg-dfrntBlue-100 hover:text-dfrntBlue-700"
            >
              {document["@type"]}
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!valid || saving}
            className="rounded-md bg-dfrntBlue-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-dfrntBlue-400 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {saving ? t("documentEditor.saving") : t("common.save")}
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-gray-200 bg-gray-50 px-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "border-dfrntBlue-500 text-dfrntBlue-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === "form" && (
          <div className="flex-1 overflow-auto p-4">
            {schemaFetching && (
              <div className="text-sm text-gray-500">{t("documentEditor.loadingSchema")}</div>
            )}
            {!schemaFetching && !jsonSchema && (
              <div className="text-sm text-gray-400">{t("documentEditor.noSchema")}</div>
            )}
            {jsonSchema && (
              <div className="tdb-form">
                {schemaErrors.length > 0 && (
                  <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                    <ul className="list-inside list-disc">
                      {schemaErrors.map((msg) => (
                        <li key={msg}>{msg}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <Form
                  key={`${docType}:${docId}`}
                  schema={jsonSchema}
                  uiSchema={formUiSchema}
                  formData={doc}
                  validator={formValidator}
                  widgets={FORM_WIDGETS}
                  onChange={(e) => handleFormChange(e.formData as TerminusDBDocument)}
                  extraErrors={errorSchema}
                  showErrorList={false}
                  templates={FORM_TEMPLATES}
                  noHtml5Validate
                  disabled={saving}
                >
                  <span />
                </Form>
              </div>
            )}
          </div>
        )}

        {activeTab === "json" && (
          <div className="relative flex-1">
            <Editor
              height="100%"
              defaultLanguage="json"
              value={text}
              onChange={handleChange}
              options={MONACO_OPTIONS}
            />
            {!valid && (
              <div className="absolute bottom-4 left-4 rounded-md bg-red-100 px-3 py-1.5 text-xs font-medium text-red-700">
                {t("documentEditor.invalidJson")}
              </div>
            )}
            {valid && schemaErrors.length > 0 && (
              <div className="absolute bottom-4 left-4 max-w-md rounded-md bg-red-100 px-3 py-1.5 text-xs font-medium text-red-700">
                {t("documentEditor.schemaErrors", { count: schemaErrors.length })}
              </div>
            )}
            {valid && schemaErrors.length === 0 && saveError && (
              <div className="absolute bottom-4 left-4 rounded-md bg-red-100 px-3 py-1.5 text-xs font-medium text-red-700">
                {saveError}
              </div>
            )}
          </div>
        )}

        {activeTab === "markdown" && (
          <div className="flex-1 overflow-auto p-4">
            {markdownFetching && <div className="text-sm text-gray-500">{t("documentEditor.loadingMarkdown")}</div>}
            {markdownErr && !markdownFetching && (
              <div className="text-sm text-red-600">
                {t("documentEditor.failedToLoadMarkdown")} {"status" in markdownErr ? String(markdownErr.status) : t("common.unknown")}
              </div>
            )}
            {markdownText && !markdownFetching && !markdownErr && (
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown>{markdownText}</ReactMarkdown>
              </div>
            )}
            {!markdownText && !markdownFetching && !markdownErr && (
              <div className="text-sm text-gray-400">{t("documentEditor.noMarkdown")}</div>
            )}
          </div>
        )}

        {activeTab === "embedding" && (
          <div className="flex-1 overflow-auto p-4">
            {embeddingFetching && <div className="text-sm text-gray-500">{t("documentEditor.fetchingEmbedding")}</div>}
            {embeddingErr && !embeddingFetching && (
              <div className="text-sm text-red-600">
                {t("documentEditor.failedToLoadEmbedding")} {"status" in embeddingErr ? String(embeddingErr.status) : t("common.unknown")}
              </div>
            )}
            {noEmbeddingQueries && (
              <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                {t("documentEditor.noEmbeddingQueriesDefined")}
                {routeParams && docType && (
                  <>
                    {" "}
                    <button
                      type="button"
                      className="font-medium text-dfrntBlue-600 underline hover:text-dfrntBlue-700"
                      onClick={() => navigate(`/${org}/${team}/local/${refType}/${refName}/embeddings?type=${encodeURIComponent(docType)}`)}
                    >
                      {t("documentEditor.configureEmbeddings", { type: docType })}
                    </button>
                  </>
                )}
              </div>
            )}
            {embeddingText && !embeddingFetching && !embeddingErr && (
              <pre className="overflow-auto rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700 whitespace-pre-wrap">
                {embeddingText}
              </pre>
            )}
            {!embeddingText && !embeddingFetching && !embeddingErr && (
              <div className="text-sm text-gray-400">{t("documentEditor.noEmbeddingText")}</div>
            )}
          </div>
        )}

        {activeTab === "similar" && routeParams && docId && (
          <SimilarDocumentsPanel
            similarPath={similarPath}
            documentId={docId}
            onSelectDocument={(id) => {
              if (org && team && refType && refName) {
                navigate(`/${org}/${team}/local/${refType}/${refName}/documents?edit=${encodeURIComponent(id)}`);
              }
            }}
          />
        )}

        {activeTab === "similar" && (!routeParams || !docId) && (
          <div className="p-4 text-sm text-gray-400">{t("documentEditor.saveFirst")}</div>
        )}
      </div>
    </div>
  );
};
