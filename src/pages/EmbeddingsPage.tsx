import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Editor from "@monaco-editor/react";
import {
  useGetSchemaQuery,
  useGetDocumentsQuery,
  useGetEmbeddingTextQuery,
  useReplaceSchemaDocumentMutation,
  useRunGraphqlMutation,
  useGraphqlDocumentCountQuery,
  useAppSelector,
} from "@/store";
import {
  PageShell,
  PageHeader,
  PagePlaceholder,
  btnPrimary,
  btnSecondary,
  inputClass,
  selectClass,
  useRouteParams,
} from "@/components";
import { buildApiPath } from "@/utils/routes";
import { formatGraphql, formatHandlebars, renderHandlebars } from "@/utils/format";
import type { SchemaClass } from "@/types/terminusdb";
import { isSubdocument } from "@/types/terminusdb";

const EDITOR_HEIGHT = 240;

const GRAPHQL_PLACEHOLDER = `{ example {\n  Product(id: "Product/Product01") {\n    name\n    description\n  }\n}`;

const HANDLEBARS_PLACEHOLDER = `{{ name }}\n{{ description }}`;

interface ComboboxItem {
  readonly id: string;
  readonly hasEmbedding: boolean;
}

const TypeCombobox: React.FC<{
  readonly items: ReadonlyArray<ComboboxItem>;
  readonly value: string;
  readonly onSelect: (id: string) => void;
}> = ({ items, value, onSelect }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const filtered = useMemo(() => {
    if (!query) return items;
    const q = query.toLowerCase();
    return items.filter((i) => i.id.toLowerCase().includes(q));
  }, [items, query]);

  const selectedItem = items.find((i) => i.id === value) ?? null;

  return (
    <div ref={containerRef} className="relative w-64">
      <button
        type="button"
        onClick={() => { setOpen(true); inputRef.current?.focus(); }}
        className={`${selectClass} flex w-full items-center justify-between gap-2 text-left`}
      >
        <span className={selectedItem ? "text-gray-900" : "text-gray-400"}>
          {selectedItem ? selectedItem.id + (selectedItem.hasEmbedding ? " ✓" : "") : t("embeddings.selectTypePlaceholder")}
        </span>
        <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg">
          <div className="p-1.5">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("embeddings.filterTypes")}
              className="w-full rounded border border-gray-200 px-2 py-1 text-sm focus:border-dfrntBlue-400 focus:outline-none"
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-xs text-gray-400">{t("embeddings.noTypesFound")}</div>
            )}
            {filtered.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => { onSelect(item.id); setOpen(false); }}
                className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-sm transition-colors ${
                  item.id === value
                    ? "bg-dfrntBlue-50 text-dfrntBlue-700"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <span className="truncate">{item.id}</span>
                {item.hasEmbedding && <span className="ml-2 text-xs text-gray-400">✓</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

interface EmbeddingMetadata {
  readonly query?: string;
  readonly template?: string;
}

function getEmbeddingFromSchema(cls: SchemaClass): EmbeddingMetadata | null {
  const raw = cls as Record<string, unknown>;
  const metadata = (raw["@metadata"] as Record<string, unknown> | undefined) ??
    (raw["metadata"] as Record<string, unknown> | undefined);
  if (!metadata) return null;
  const embedding = metadata["embedding"] as Record<string, unknown> | undefined;
  if (!embedding) return null;
  return {
    query: typeof embedding["query"] === "string" ? (embedding["query"] as string) : undefined,
    template: typeof embedding["template"] === "string" ? (embedding["template"] as string) : undefined,
  };
}

function shortId(fullId: string): string {
  const parts = fullId.split("/");
  return parts.at(-1) ?? fullId;
}

export const EmbeddingsPage: React.FC = () => {
  const { t } = useTranslation();
  const routeParams = useRouteParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const typeFromUrl = searchParams.get("type") ?? "";
  const [selectedType, setSelectedType] = useState(typeFromUrl);
  const [graphqlQuery, setGraphqlQuery] = useState("");
  const [handlebarsTemplate, setHandlebarsTemplate] = useState("");
  const [selectedDocId, setSelectedDocId] = useState("");
  const [docFilter, setDocFilter] = useState("");
  const [graphqlSaveStatus, setGraphqlSaveStatus] = useState<"" | "saving" | "saved" | "error">("");
  const [templateSaveStatus, setTemplateSaveStatus] = useState<"" | "saving" | "saved" | "error">("");
  const [graphqlResult, setGraphqlResult] = useState<string | null>(null);
  const [graphqlError, setGraphqlError] = useState<string | null>(null);
  const [embeddingError, setEmbeddingError] = useState<string | null>(null);
  const [schemaVersion, setSchemaVersion] = useState(0);
  const [previewResult, setPreviewResult] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [formatStatus, setFormatStatus] = useState<"" | "formatting" | "error">("");

  const username = useAppSelector((state) => state.auth.username ?? "admin");

  useEffect(() => {
    if (typeFromUrl !== selectedType) {
      setSelectedType(typeFromUrl);
    }
  }, [typeFromUrl, selectedType]);

  const schemaReadPath = routeParams ? buildApiPath(routeParams, "schema") : "";
  const docPath = routeParams ? buildApiPath(routeParams, "document") : "";
  const graphqlPath = routeParams ? buildApiPath(routeParams, "graphql") : "";

  const { data: schemaClasses, isLoading: schemaLoading } = useGetSchemaQuery(
    { path: schemaReadPath, asList: true },
    { skip: !routeParams, refetchOnMountOrArgChange: true },
  );

  const { data: documents, isLoading: docsLoading } = useGetDocumentsQuery(
    { path: docPath, type: selectedType, count: 100, asList: true },
    { skip: !routeParams || !selectedType },
  );

  const { data: totalCountData } = useGraphqlDocumentCountQuery(
    { path: graphqlPath, types: selectedType ? [selectedType] : [] },
    { skip: !routeParams || !selectedType },
  );
  const totalDocCount = selectedType ? (totalCountData?.["t0"] ?? null) : null;

  const [replaceSchemaDocument] = useReplaceSchemaDocumentMutation();
  const [runGraphql] = useRunGraphqlMutation();

  const schemaBase = useMemo(() => {
    if (!schemaClasses) return "";
    const ctx = schemaClasses.find((c) => c["@id"] === "@context") as Record<string, unknown> | undefined;
    return (ctx?.["@base"] as string | undefined) ?? "";
  }, [schemaClasses]);

  const fullDocUri = useMemo(() => {
    if (!selectedDocId || !schemaBase) return selectedDocId;
    return schemaBase + selectedDocId;
  }, [selectedDocId, schemaBase]);

  const docTypes = useMemo(() => {
    if (!schemaClasses) return [];
    return schemaClasses
      .filter((c) => c["@type"] === "Class" && !isSubdocument(c))
      .map((c) => ({
        id: c["@id"],
        hasEmbedding: getEmbeddingFromSchema(c) !== null,
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
  }, [schemaClasses]);

  const selectedClass = useMemo(() => {
    if (!schemaClasses || !selectedType) return null;
    return schemaClasses.find((c) => c["@id"] === selectedType) ?? null;
  }, [schemaClasses, selectedType]);

  const currentEmbedding = useMemo(() => {
    if (!selectedClass) return null;
    return getEmbeddingFromSchema(selectedClass);
  }, [selectedClass]);

  useEffect(() => {
    if (currentEmbedding) {
      setGraphqlQuery(currentEmbedding.query ?? "");
      setHandlebarsTemplate(currentEmbedding.template ?? "");
    } else {
      setGraphqlQuery("");
      setHandlebarsTemplate("");
    }
    setSelectedDocId("");
    setGraphqlResult(null);
    setGraphqlError(null);
    setEmbeddingError(null);
  }, [selectedType, schemaVersion, currentEmbedding]);

  const filteredDocs = useMemo(() => {
    if (!documents || !Array.isArray(documents)) return [];
    const list = documents as ReadonlyArray<{ "@id": string }>;
    if (!docFilter) return list;
    const lower = docFilter.toLowerCase();
    return list.filter((d) => d["@id"].toLowerCase().includes(lower));
  }, [documents, docFilter]);

  const shouldFetchEmbedding = !!selectedDocId && !!selectedType;
  const { data: embeddingText, isFetching: embeddingFetching, error: embeddingErr } = useGetEmbeddingTextQuery(
    { path: docPath, id: selectedDocId },
    { skip: !shouldFetchEmbedding },
  );

  useEffect(() => {
    if (embeddingErr) {
      setEmbeddingError(
        typeof embeddingErr === "object" && "data" in embeddingErr
          ? String((embeddingErr as Record<string, unknown>).data ?? embeddingErr)
          : String(embeddingErr),
      );
    } else {
      setEmbeddingError(null);
    }
  }, [embeddingErr]);

  const handleSelectType = useCallback((id: string) => {
    setSelectedType(id);
    const next = new URLSearchParams(searchParams);
    if (id) {
      next.set("type", id);
    } else {
      next.delete("type");
    }
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleSaveField = async (field: "query" | "template", value: string) => {
    if (!schemaClasses || !selectedClass) return;
    const setStatus = field === "query" ? setGraphqlSaveStatus : setTemplateSaveStatus;
    setStatus("saving");
    try {
      const metadataKey = "@metadata" in selectedClass ? "@metadata" : "metadata";
      const existingMetadata = (selectedClass[metadataKey] as Record<string, unknown>) ?? {};
      const existingEmbedding = (existingMetadata["embedding"] as Record<string, unknown>) ?? {};
      const updatedDoc = {
        ...selectedClass,
        [metadataKey]: {
          ...existingMetadata,
          embedding: {
            ...existingEmbedding,
            [field]: value || undefined,
          },
        },
      } as SchemaClass;
      await replaceSchemaDocument({
        path: docPath,
        id: selectedType,
        document: updatedDoc,
        author: username,
        message: t("embeddings.updatedEmbedding", { field, type: selectedType }),
      }).unwrap();
      setStatus("saved");
      setSchemaVersion((v) => v + 1);
      setTimeout(() => setStatus(""), 3000);
    } catch (err: unknown) {
      console.error(t("embeddings.failedToSaveConfig"), err);
      setStatus("error");
    }
  };

  const handleRunGraphql = async () => {
    if (!graphqlQuery || !selectedDocId) return;
    setGraphqlResult(null);
    setGraphqlError(null);
    try {
      const res = await runGraphql({
        path: graphqlPath,
        query: graphqlQuery,
        variables: { id: fullDocUri },
      }).unwrap();
      setGraphqlResult(JSON.stringify(res, null, 2));
    } catch (err) {
      setGraphqlError(
        typeof err === "object" && err !== null && "data" in err
          ? JSON.stringify((err as Record<string, unknown>).data, null, 2)
          : String(err),
      );
    }
  };

  const handleFormatGraphql = async () => {
    setFormatStatus("formatting");
    try {
      const formatted = await formatGraphql(graphqlQuery || GRAPHQL_PLACEHOLDER);
      setGraphqlQuery(formatted.trimEnd());
      setFormatStatus("");
    } catch (err) {
      setFormatStatus("error");
      setGraphqlError(err instanceof Error ? err.message : String(err));
      setTimeout(() => setFormatStatus(""), 3000);
    }
  };

  const handleFormatHandlebars = async () => {
    setFormatStatus("formatting");
    try {
      const formatted = await formatHandlebars(handlebarsTemplate || HANDLEBARS_PLACEHOLDER);
      setHandlebarsTemplate(formatted.trimEnd());
      setFormatStatus("");
    } catch (err) {
      setFormatStatus("error");
      setEmbeddingError(err instanceof Error ? err.message : String(err));
      setTimeout(() => setFormatStatus(""), 3000);
    }
  };

  const handlePreview = async () => {
    if (!graphqlQuery || !selectedDocId) return;
    setPreviewLoading(true);
    setPreviewResult(null);
    setPreviewError(null);
    try {
      const res = await runGraphql({
        path: graphqlPath,
        query: graphqlQuery,
        variables: { id: fullDocUri },
      }).unwrap();
      setGraphqlResult(JSON.stringify(res, null, 2));
      const template = handlebarsTemplate || HANDLEBARS_PLACEHOLDER;
      const data = (res as Record<string, unknown>)?.["data"] as Record<string, unknown> | undefined;
      const typeKey = selectedType;
      const typeResults = data?.[typeKey] as ReadonlyArray<Record<string, unknown>> | undefined;
      const firstDoc = typeResults?.[0] ?? data ?? res;
      const rendered = renderHandlebars(template, firstDoc);
      setPreviewResult(rendered);
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("Handlebars")) {
        setPreviewError(err.message);
      } else {
        const msg = typeof err === "object" && err !== null && "data" in err
          ? JSON.stringify((err as Record<string, unknown>).data, null, 2)
          : String(err);
        setPreviewError(msg);
      }
    } finally {
      setPreviewLoading(false);
    }
  };

  if (!routeParams) return <PagePlaceholder>{t("common.selectDataProduct")}</PagePlaceholder>;
  if (schemaLoading) return <PagePlaceholder>{t("embeddings.loadingSchema")}</PagePlaceholder>;

  return (
    <PageShell
      header={
        <PageHeader>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{t("embeddings.title")}</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              {t("embeddings.description")}
            </p>
          </div>
        </PageHeader>
      }
    >
      <div className="flex flex-col gap-4 p-4">
        {/* Type selector */}
        <div className="flex items-end gap-3">
          <div>
            <span className="block text-xs font-medium text-gray-500 mb-1">{t("embeddings.typeSelector")}</span>
            <TypeCombobox
              items={docTypes}
              value={selectedType}
              onSelect={handleSelectType}
            />
          </div>
          {selectedType && (
            <span className="text-xs text-gray-400 pb-2">
              {currentEmbedding ? t("embeddings.hasEmbeddingMetadata") : t("embeddings.noEmbeddingMetadata")}
            </span>
          )}
        </div>

        {!selectedType && (
          <div className="flex flex-1 items-center justify-center text-sm text-gray-400">
            {t("embeddings.selectTypeToBegin")}
          </div>
        )}

        {selectedType && (
          <div className="flex flex-col gap-4">
            {/* GraphQL Query editor */}
            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t("embeddings.graphqlQuery")}</h3>
                  <span className="text-xs text-gray-400">(metadata.embedding.query)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleFormatGraphql}
                    disabled={formatStatus === "formatting"}
                    className={btnSecondary + " text-xs px-2 py-1"}
                  >
                    {formatStatus === "formatting" ? t("common.formatting") : formatStatus === "error" ? t("common.error") : t("common.format")}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveField("query", graphqlQuery)}
                    disabled={graphqlSaveStatus === "saving"}
                    className={btnPrimary + " text-xs px-2 py-1"}
                  >
                    {graphqlSaveStatus === "saving" ? t("common.saving") : graphqlSaveStatus === "saved" ? t("common.saved") : graphqlSaveStatus === "error" ? t("common.error") : t("common.save")}
                  </button>
                </div>
              </div>
              <div className="rounded-md border border-gray-200">
                <Editor
                  height={EDITOR_HEIGHT}
                  defaultLanguage="graphql"
                  value={graphqlQuery || GRAPHQL_PLACEHOLDER}
                  onChange={(v) => setGraphqlQuery(v ?? "")}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    wordWrap: "on",
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 2,
                    scrollbar: { alwaysConsumeMouseWheel: false },
                  }}
                />
              </div>
            </div>

            {/* Handlebars Template editor */}
            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t("embeddings.handlebarsTemplate")}</h3>
                  <span className="text-xs text-gray-400">(metadata.embedding.template)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleFormatHandlebars}
                    disabled={formatStatus === "formatting"}
                    className={btnSecondary + " text-xs px-2 py-1"}
                  >
                    {formatStatus === "formatting" ? t("common.formatting") : formatStatus === "error" ? t("common.error") : t("common.format")}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveField("template", handlebarsTemplate)}
                    disabled={templateSaveStatus === "saving"}
                    className={btnPrimary + " text-xs px-2 py-1"}
                  >
                    {templateSaveStatus === "saving" ? t("common.saving") : templateSaveStatus === "saved" ? t("common.saved") : templateSaveStatus === "error" ? t("common.error") : t("common.save")}
                  </button>
                </div>
              </div>
              <div className="rounded-md border border-gray-200">
                <Editor
                  height={EDITOR_HEIGHT}
                  defaultLanguage="handlebars"
                  value={handlebarsTemplate || HANDLEBARS_PLACEHOLDER}
                  onChange={(v) => setHandlebarsTemplate(v ?? "")}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    wordWrap: "on",
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 2,
                    scrollbar: { alwaysConsumeMouseWheel: false },
                  }}
                />
              </div>
            </div>

            {/* Document picker + previews */}
            <div className="flex flex-col gap-3">
              {/* Document picker */}
              <div className="flex flex-col gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {t("embeddings.selectDocument")}
                  {totalDocCount !== null && totalDocCount > 0 && (
                    <span className="ml-2 font-normal text-gray-400">
                      ({t("embeddings.shownOfTotal", { shown: filteredDocs.length, total: totalDocCount > 100 ? totalDocCount.toLocaleString() : filteredDocs.length })})
                    </span>
                  )}
                </h3>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={docFilter}
                    onChange={(e) => setDocFilter(e.target.value)}
                    placeholder={t("embeddings.filterById")}
                    className={inputClass + " w-64"}
                  />
                  {selectedDocId && (
                    <span className="text-xs text-gray-500">{t("embeddings.selected")}: {shortId(selectedDocId)}</span>
                  )}
                </div>
                <div className="max-h-32 overflow-y-auto rounded-md border border-gray-200 bg-white">
                  {docsLoading && <div className="p-2 text-xs text-gray-400">{t("embeddings.loadingDocuments")}</div>}
                  {!docsLoading && filteredDocs.length === 0 && (
                    <div className="p-2 text-xs text-gray-400">{t("embeddings.noDocuments")}</div>
                  )}
                  {filteredDocs.map((doc) => (
                    <button
                      key={doc["@id"]}
                      type="button"
                      onClick={() => setSelectedDocId(doc["@id"])}
                      className={`block w-full truncate px-3 py-1.5 text-left text-xs font-data transition-colors ${
                        selectedDocId === doc["@id"]
                          ? "bg-dfrntBlue-50 text-dfrntBlue-700"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {shortId(doc["@id"])}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview bar */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePreview}
                  disabled={!graphqlQuery || !selectedDocId || previewLoading}
                  className={btnPrimary + " text-xs px-3 py-1.5"}
                >
                  {previewLoading ? t("embeddings.previewing") : t("embeddings.preview")}
                </button>
                <span className="text-xs text-gray-400">
                  {t("embeddings.previewDescription")}
                </span>
              </div>

              {/* GraphQL response + Embedding text side by side */}
              <div className="grid grid-cols-2 gap-4">
                {/* GraphQL response */}
                <div className="flex flex-col">
                  <div className="mb-1 flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t("embeddings.graphqlResponse")}</h3>
                    <button
                      type="button"
                      onClick={handleRunGraphql}
                      disabled={!graphqlQuery || !selectedDocId}
                      className={btnSecondary + " text-xs"}
                    >
                      {t("embeddings.runQuery")}
                    </button>
                  </div>
                  <div className="h-48 overflow-auto rounded-md border border-gray-200 bg-gray-900 p-3">
                    {graphqlError && (
                      <pre className="text-xs text-red-400 whitespace-pre-wrap">{graphqlError}</pre>
                    )}
                    {graphqlResult && (
                      <pre className="text-xs text-green-300 whitespace-pre-wrap">{graphqlResult}</pre>
                    )}
                    {!graphqlResult && !graphqlError && (
                      <div className="text-xs text-gray-500">
                        {selectedDocId
                          ? t("embeddings.clickRunQuery")
                          : t("embeddings.selectDocumentFirst")}
                      </div>
                    )}
                  </div>
                </div>

                {/* Embedding text preview */}
                <div className="flex flex-col">
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {t("embeddings.embeddingTextPreview")} <span className="font-normal text-gray-400">{t("embeddings.inBrowserRender")}</span>
                  </h3>
                  <div className="h-48 overflow-auto rounded-md border border-gray-200 bg-gray-900 p-3">
                    {previewLoading && (
                      <div className="text-xs text-gray-400">{t("embeddings.runningPreview")}</div>
                    )}
                    {previewError && !previewLoading && (
                      <pre className="text-xs text-red-400 whitespace-pre-wrap">{previewError}</pre>
                    )}
                    {previewResult && !previewLoading && !previewError && (
                      <pre className="text-xs text-green-300 whitespace-pre-wrap">{previewResult}</pre>
                    )}
                    {!previewResult && !previewLoading && !previewError && (
                      <div className="text-xs text-gray-500">
                        {selectedDocId
                          ? t("embeddings.clickPreview")
                          : t("embeddings.selectDocumentToPreview")}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Backend embedding text (format=embedding) */}
              <div className="flex flex-col">
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {t("embeddings.backendEmbeddingText")} <span className="font-normal text-gray-400">{t("embeddings.formatEmbeddingFromServer")}</span>
                </h3>
                <div className="h-32 overflow-auto rounded-md border border-gray-200 bg-gray-900 p-3">
                  {embeddingFetching && (
                    <div className="text-xs text-gray-400">{t("embeddings.fetchingEmbeddingText")}</div>
                  )}
                  {embeddingError && !embeddingFetching && (
                    <pre className="text-xs text-amber-400 whitespace-pre-wrap">{embeddingError}</pre>
                  )}
                  {embeddingText && !embeddingFetching && !embeddingError && (
                    <pre className="text-xs text-gray-200 whitespace-pre-wrap">{embeddingText}</pre>
                  )}
                  {!embeddingText && !embeddingFetching && !embeddingError && (
                    <div className="text-xs text-gray-500">
                      {selectedDocId
                        ? t("embeddings.saveMetadataToSeeOutput")
                        : t("embeddings.selectDocumentToFetch")}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
};
