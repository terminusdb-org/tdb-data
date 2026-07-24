import React, { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  useDuplicatesQuery,
  useSimilarQuery,
  useCompareMutation,
  useGetSchemaQuery,
  useGetEmbeddingTextQuery,
} from "@/store";
import { PageShell, PageHeader, PagePlaceholder, useRouteParams, SimilarityBadge, SearchResultCard, DocumentPicker, IndexerDisabledNotice, useIndexerDisabled } from "@/components";
import { buildApiPath, type RouteParams } from "@/utils/routes";
import type { DuplicatesResponse, SearchHit, CompareResponse, SchemaClass } from "@/types/terminusdb";
import { isSubdocument } from "@/types/terminusdb";
import { distanceToPercent, similarityLabel } from "@/utils/similarity";

type Tab = "similar" | "duplicates" | "compare";

const SimilarTab: React.FC<{ routeParams: RouteParams; urlSearchParams: URLSearchParams; setUrlSearchParams: (sp: URLSearchParams, opts?: { replace?: boolean }) => void }> = ({ routeParams, urlSearchParams, setUrlSearchParams }) => {
  const { t } = useTranslation();
  const docId = urlSearchParams.get("id") ?? "";
  const searchText = urlSearchParams.get("text") ?? "";
  const searchMode = urlSearchParams.get("smode") ?? "doc";
  const count = Number(urlSearchParams.get("count") ?? "20");
  const triggered = searchMode === "text" ? !!searchText : !!docId;
  const [textInput, setTextInput] = useState(searchText);

  const similarPath = buildApiPath(routeParams, "similar");
  const suggestPath = buildApiPath(routeParams, "suggest");
  const docPath = buildApiPath(routeParams, "document");
  const { data, isFetching, error } = useSimilarQuery(
    searchMode === "text"
      ? { path: similarPath, text: searchText, count, snippet: true }
      : { path: similarPath, id: docId, count, snippet: true },
    { skip: !triggered }
  );

  const results: SearchHit[] = data ?? [];

  const handleSearch = (id: string) => {
    if (!id.trim()) return;
    const sp = new URLSearchParams(urlSearchParams);
    sp.set("id", id.trim());
    sp.delete("text");
    sp.set("smode", "doc");
    sp.set("count", String(count));
    setUrlSearchParams(sp, { replace: false });
  };

  const handleTextSearch = () => {
    if (!textInput.trim()) return;
    const sp = new URLSearchParams(urlSearchParams);
    sp.set("text", textInput);
    sp.delete("id");
    sp.set("smode", "text");
    sp.set("count", String(count));
    setUrlSearchParams(sp, { replace: false });
  };

  const setMode = (mode: "doc" | "text") => {
    const sp = new URLSearchParams(urlSearchParams);
    sp.set("smode", mode);
    if (mode === "doc") sp.delete("text");
    else sp.delete("id");
    setUrlSearchParams(sp, { replace: true });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        {t("vectorSearch.similarDescription")}
      </p>

      {/* Mode toggle */}
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => setMode("doc")}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            searchMode === "doc" ? "bg-dfrntBlue-500 text-white" : "border border-gray-300 text-gray-600 hover:bg-gray-50"
          }`}
        >
          {t("vectorSearch.byDocument")}
        </button>
        <button
          type="button"
          onClick={() => setMode("text")}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            searchMode === "text" ? "bg-dfrntBlue-500 text-white" : "border border-gray-300 text-gray-600 hover:bg-gray-50"
          }`}
        >
          {t("vectorSearch.byText")}
        </button>
      </div>

      <div className="flex items-end gap-3">
        {searchMode === "doc" ? (
          <div className="flex-1">
            <DocumentPicker
              suggestPath={suggestPath}
              value={docId}
              onChange={(id) => handleSearch(id)}
              placeholder={t("vectorSearch.searchForDocument")}
              label={t("vectorSearch.sourceDocument")}
            />
          </div>
        ) : (
          <div className="flex-1">
            <label htmlFor="similar-text" className="mb-1 block text-xs font-medium text-gray-500">{t("vectorSearch.searchText")}</label>
            <textarea
              id="similar-text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder={t("vectorSearch.enterTextToFind")}
              rows={3}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        )}
        <div>
          <label htmlFor="similar-count" className="mb-1 block text-xs font-medium text-gray-500">{t("vectorSearch.maxResults")}</label>
          <select
            id="similar-count"
            value={count}
            onChange={(e) => {
              const sp = new URLSearchParams(urlSearchParams);
              sp.set("count", e.target.value);
              setUrlSearchParams(sp, { replace: true });
            }}
            className="rounded-md border border-gray-300 px-2 py-2 text-sm"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
        {searchMode === "text" && (
          <button
            type="button"
            onClick={handleTextSearch}
            disabled={!textInput.trim() || isFetching}
            className="rounded-md bg-dfrntBlue-500 px-4 py-2 text-sm font-medium text-white hover:bg-dfrntBlue-400 disabled:bg-gray-300"
          >
            {t("common.search")}
          </button>
        )}
      </div>

      {error && triggered && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          {"status" in error
            ? (() => {
                const errData = "data" in error && error.data ? JSON.stringify(error.data) : t("vectorSearch.failedToFindSimilar");
                return `${t("common.error")} ${error.status}: ${errData}`;
              })()
            : t("vectorSearch.failedToFindSimilar")}
        </div>
      )}

      {isFetching && triggered && (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500">
          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {t("vectorSearch.findingSimilar")}
        </div>
      )}

      {!isFetching && triggered && results.length === 0 && !error && (
        <div className="py-8 text-center text-sm text-gray-500">{t("vectorSearch.noSimilarFound")}</div>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          <div className="text-sm text-gray-500">
            {results.length} {t("vectorSearch.similarDocument", { count: results.length })}
            {searchMode === "doc" && <> {t("vectorSearch.to")} <span className="font-data font-medium text-gray-700">{docId}</span></>}
          </div>
          {results.map((hit) => (
            <SearchResultCard
              key={hit.id}
              hit={hit}
              routeParams={routeParams}
              similarPath={similarPath}
              docPath={docPath}
              showSimilarButton={false}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const DuplicatesTab: React.FC<{ routeParams: RouteParams; urlSearchParams: URLSearchParams; setUrlSearchParams: (sp: URLSearchParams, opts?: { replace?: boolean }) => void }> = ({ routeParams, urlSearchParams, setUrlSearchParams }) => {
  const { t } = useTranslation();
  const triggered = urlSearchParams.has("triggered");
  const urlThreshold = Number(urlSearchParams.get("threshold") ?? "0.15");
  const urlCount = Number(urlSearchParams.get("count") ?? "20");
  const urlDocType = urlSearchParams.get("doc_type") ?? "";

  const [thresholdInput, setThresholdInput] = useState(urlThreshold);
  const [countInput, setCountInput] = useState(urlCount);
  const [docTypeInput, setDocTypeInput] = useState(urlDocType);

  const duplicatesPath = buildApiPath(routeParams, "duplicates");
  const schemaPath = buildApiPath(routeParams, "schema");
  const { data: schemaClasses } = useGetSchemaQuery(
    { path: schemaPath, asList: true },
  );

  const docTypes = useMemo(() => {
    if (!schemaClasses) return [];
    return schemaClasses
      .filter((c: SchemaClass) => c["@type"] === "Class" && !isSubdocument(c))
      .map((c) => c["@id"])
      .sort((a, b) => a.localeCompare(b));
  }, [schemaClasses]);

  const docTypesParam = docTypeInput ? [docTypeInput] : undefined;

  const { data, isFetching, error } = useDuplicatesQuery(
    { path: duplicatesPath, threshold: urlThreshold, count: urlCount, snippet: true, docTypes: docTypesParam },
    { skip: !triggered }
  );

  const results: DuplicatesResponse = data ?? [];

  const handleFindDuplicates = () => {
    const sp = new URLSearchParams(urlSearchParams);
    sp.set("threshold", String(thresholdInput));
    sp.set("count", String(countInput));
    if (docTypeInput) sp.set("doc_type", docTypeInput);
    else sp.delete("doc_type");
    sp.set("triggered", "1");
    setUrlSearchParams(sp, { replace: false });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        {t("vectorSearch.duplicatesDescription")}
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="dup-threshold" className="mb-1 block text-xs font-medium text-gray-500">{t("vectorSearch.threshold")}</label>
          <input
            id="dup-threshold"
            type="number"
            step="0.01"
            min="0"
            max="1"
            value={thresholdInput}
            onChange={(e) => setThresholdInput(Number(e.target.value))}
            className="w-24 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="dup-count" className="mb-1 block text-xs font-medium text-gray-500">{t("vectorSearch.maxResults")}</label>
          <select
            id="dup-count"
            value={countInput}
            onChange={(e) => setCountInput(Number(e.target.value))}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
        <div>
          <label htmlFor="dup-doctype" className="mb-1 block text-xs font-medium text-gray-500">{t("vectorSearch.documentTypeOptional")}</label>
          <select
            id="dup-doctype"
            value={docTypeInput}
            onChange={(e) => setDocTypeInput(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="">{t("common.allTypes")}</option>
            {docTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={handleFindDuplicates}
          disabled={isFetching}
          className="rounded-md bg-dfrntBlue-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-dfrntBlue-400 disabled:bg-gray-300"
        >
          {isFetching ? t("vectorSearch.finding") : t("vectorSearch.findDuplicates")}
        </button>
      </div>

      {error && triggered && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          {"status" in error ? `${t("common.error")}: ${String(error.status)}` : t("vectorSearch.failedToFindDuplicates")}
        </div>
      )}

      {!isFetching && triggered && results.length === 0 && !error && (
        <div className="py-8 text-center text-sm text-gray-500">{t("vectorSearch.noDuplicatesFound")}</div>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          <div className="text-sm text-gray-500">{results.length} {t("vectorSearch.duplicateGroup", { count: results.length })}</div>
          {results.map((group, i) => {
            const groupColors = ["border-l-dfrntBlue-400", "border-l-green-400", "border-l-yellow-400", "border-l-purple-400", "border-l-pink-400"];
            const borderColor = groupColors[i % groupColors.length];
            return (
              <div key={i} className={`rounded-lg border border-gray-200 border-l-4 ${borderColor} bg-white p-4`}>
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-500">{t("vectorSearch.group")} {i + 1}</span>
                  <SimilarityBadge distance={group.distance} size="lg" />
                </div>
                <div className="space-y-2">
                  {group.group.map((doc) => (
                    <div key={doc.id} className="rounded-md bg-gray-50 p-2">
                      {doc.snippet && (
                        <div className="mb-1 line-clamp-2 text-sm text-gray-800">{doc.snippet}</div>
                      )}
                      <div className="text-xs font-data text-gray-400">{doc.id}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const CompareTab: React.FC<{ routeParams: RouteParams; urlSearchParams: URLSearchParams; setUrlSearchParams: (sp: URLSearchParams, opts?: { replace?: boolean }) => void }> = ({ routeParams, urlSearchParams, setUrlSearchParams }) => {
  const { t } = useTranslation();
  const role = urlSearchParams.get("role") ?? "query";
  const sourceMode = urlSearchParams.get("smode") ?? "text";
  const targetMode = urlSearchParams.get("tmode") ?? "text";
  const sourceDocId = urlSearchParams.get("source_id") ?? "";
  const targetDocId = urlSearchParams.get("target_id") ?? "";
  const [sourceText, setSourceText] = useState("");
  const [targetText, setTargetText] = useState("");
  const [result, setResult] = useState<CompareResponse | null>(null);
  const [compare, { isLoading, error }] = useCompareMutation();

  const suggestPath = buildApiPath(routeParams, "suggest");
  const docPath = buildApiPath(routeParams, "document");

  const { data: sourceEmbedding } = useGetEmbeddingTextQuery(
    { path: docPath, id: sourceDocId },
    { skip: !sourceDocId || sourceMode !== "doc" }
  );
  const { data: targetEmbedding } = useGetEmbeddingTextQuery(
    { path: docPath, id: targetDocId },
    { skip: !targetDocId || targetMode !== "doc" }
  );

  const updateParam = (key: string, value: string) => {
    const sp = new URLSearchParams(urlSearchParams);
    sp.set(key, value);
    setUrlSearchParams(sp, { replace: true });
  };

  const handleCompare = async () => {
    const source = sourceMode === "doc" ? (sourceEmbedding ?? "") : sourceText;
    const target = targetMode === "doc" ? (targetEmbedding ?? "") : targetText;
    if (!source || !target) return;
    try {
      const res = await compare({
        method: "embedding",
        role,
        source,
        target,
      }).unwrap();
      setResult(res);
    } catch (err: unknown) {
      console.error(t("vectorSearch.compareFailed"), err);
      setResult(null);
    }
  };

  const canCompare =
    (sourceMode === "doc" ? !!sourceEmbedding : !!sourceText.trim()) &&
    (targetMode === "doc" ? !!targetEmbedding : !!targetText.trim());

  const pct = result ? distanceToPercent(result.distance) : 0;
  const label = result ? similarityLabel(result.distance) : "";
  const circumference = 2 * Math.PI * 40;
  const dashOffset = circumference * (1 - Math.max(0, Math.min(100, pct)) / 100);

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        {t("vectorSearch.compareDescription")}
      </p>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="mb-2 flex gap-1">
            <button
              type="button"
              onClick={() => updateParam("smode", "text")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${sourceMode === "text" ? "bg-dfrntBlue-500 text-white" : "border border-gray-300 text-gray-600 hover:bg-gray-50"}`}
            >
              {t("vectorSearch.sourceText")}
            </button>
            <button
              type="button"
              onClick={() => updateParam("smode", "doc")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${sourceMode === "doc" ? "bg-dfrntBlue-500 text-white" : "border border-gray-300 text-gray-600 hover:bg-gray-50"}`}
            >
              {t("vectorSearch.sourceDocument")}
            </button>
          </div>
          {sourceMode === "doc" ? (
            <>
              <DocumentPicker
                suggestPath={suggestPath}
                value={sourceDocId}
                onChange={(id) => updateParam("source_id", id)}
                placeholder={t("vectorSearch.selectSourceDocument")}
                label={t("vectorSearch.sourceDocument")}
              />
              {sourceEmbedding && (
                <div className="mt-1 line-clamp-2 text-xs text-gray-400">{sourceEmbedding.slice(0, 200)}…</div>
              )}
            </>
          ) : (
            <>
              <label htmlFor="compare-source-text" className="mb-1 block text-xs font-medium text-gray-500">{t("vectorSearch.sourceText")}</label>
              <textarea
                id="compare-source-text"
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                placeholder={t("vectorSearch.enterSourceText")}
                rows={4}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </>
          )}
        </div>
        <div>
          <div className="mb-2 flex gap-1">
            <button
              type="button"
              onClick={() => updateParam("tmode", "text")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${targetMode === "text" ? "bg-dfrntBlue-500 text-white" : "border border-gray-300 text-gray-600 hover:bg-gray-50"}`}
            >
              {t("vectorSearch.targetText")}
            </button>
            <button
              type="button"
              onClick={() => updateParam("tmode", "doc")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${targetMode === "doc" ? "bg-dfrntBlue-500 text-white" : "border border-gray-300 text-gray-600 hover:bg-gray-50"}`}
            >
              {t("vectorSearch.targetDocument")}
            </button>
          </div>
          {targetMode === "doc" ? (
            <>
              <DocumentPicker
                suggestPath={suggestPath}
                value={targetDocId}
                onChange={(id) => updateParam("target_id", id)}
                placeholder={t("vectorSearch.selectTargetDocument")}
                label={t("vectorSearch.targetDocument")}
              />
              {targetEmbedding && (
                <div className="mt-1 line-clamp-2 text-xs text-gray-400">{targetEmbedding.slice(0, 200)}…</div>
              )}
            </>
          ) : (
            <>
              <label htmlFor="compare-target-text" className="mb-1 block text-xs font-medium text-gray-500">{t("vectorSearch.targetText")}</label>
              <textarea
                id="compare-target-text"
                value={targetText}
                onChange={(e) => setTargetText(e.target.value)}
                placeholder={t("vectorSearch.enterTargetText")}
                rows={4}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </>
          )}
        </div>
      </div>

      <div className="flex items-end gap-3">
        <div>
          <span className="mb-1 block text-xs font-medium text-gray-500">{t("vectorSearch.role")}</span>
          <div className="flex gap-1">
            {["query", "document", "clustering", "classification"].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => updateParam("role", r)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  role === r
                    ? "bg-dfrntBlue-500 text-white"
                    : "border border-gray-300 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={handleCompare}
          disabled={isLoading || !canCompare}
          className="rounded-md bg-dfrntBlue-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-dfrntBlue-400 disabled:bg-gray-300"
        >
          {isLoading ? t("vectorSearch.comparing") : t("vectorSearch.compare")}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          {"status" in error ? `${t("common.error")}: ${String(error.status)}` : t("vectorSearch.comparisonFailed")}
        </div>
      )}

      {result && (
        <div className="flex items-center gap-8 rounded-lg border border-gray-200 bg-white p-6">
          <div className="relative h-32 w-32 shrink-0">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="8" className="text-gray-200" />
              <circle
                cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="8"
                className={pct >= 80 ? "text-green-500" : pct >= 60 ? "text-yellow-500" : "text-gray-400"}
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-gray-900">{pct}%</span>
            </div>
          </div>
          <div className="space-y-2">
            <div>
              <span className="text-xs font-medium text-gray-500">{t("vectorSearch.similarity")}</span>
              <p className="text-lg font-semibold text-gray-900">{label}</p>
            </div>
            <div>
              <span className="text-xs font-medium text-gray-500">{t("vectorSearch.distance")}</span>
              <p className="font-data text-sm text-gray-700">{result.distance.toFixed(4)}</p>
            </div>
            <div>
              <span className="text-xs font-medium text-gray-500">{t("vectorSearch.role")}</span>
              <p className="text-sm font-medium text-gray-700">{result.source_role ?? role}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const VectorSearchPage: React.FC = () => {
  const { t } = useTranslation();
  const routeParams = useRouteParams();
  const indexerDisabled = useIndexerDisabled();
  const [urlSearchParams, setUrlSearchParams] = useSearchParams();
  const tab = (urlSearchParams.get("mode") as Tab) ?? "similar";

  if (!routeParams) return <PagePlaceholder>{t("common.selectDataProduct")}</PagePlaceholder>;

  const modes: ReadonlyArray<{ id: Tab; label: string; description: string; icon: React.ReactNode }> = [
    {
      id: "similar",
      label: t("vectorSearch.similar"),
      description: t("vectorSearch.similarTabDescription"),
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
        </svg>
      ),
    },
    {
      id: "duplicates",
      label: t("vectorSearch.duplicates"),
      description: t("vectorSearch.duplicatesTabDescription"),
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-.975M15.75 17.25h-.975m-7.5 0v3.375c0 .621.504 1.125 1.125 1.125H9.75m-2.475 0H9.75m0 0v-3.375m0 0c0-.621.504-1.125 1.125-1.125h.975M9.75 17.25h.975m0 0v3.375m0-3.375c0-.621.504-1.125 1.125-1.125h.975m-.975 0h.975" />
        </svg>
      ),
    },
    {
      id: "compare",
      label: t("vectorSearch.compare"),
      description: t("vectorSearch.compareTabDescription"),
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
      ),
    },
  ];

  const setMode = (mode: Tab) => {
    const sp = new URLSearchParams(urlSearchParams);
    sp.set("mode", mode);
    setUrlSearchParams(sp, { replace: true });
  };

  return (
    <PageShell
      header={
        <PageHeader>
          <h2 className="text-lg font-semibold text-gray-900">{t("vectorSearch.title")}</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            {t("vectorSearch.description")}
          </p>
        </PageHeader>
      }
    >
      <div className="flex h-full">
        <div className="w-56 shrink-0 border-r border-gray-200 bg-white p-2">
          {modes.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={`mb-1 flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left transition-colors ${
                tab === m.id
                  ? "bg-dfrntBlue-50 text-dfrntBlue-700"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              {m.icon}
              <div>
                <div className="text-sm font-medium">{m.label}</div>
                <div className="text-xs text-gray-400">{m.description}</div>
              </div>
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-auto p-6">
          {indexerDisabled && <IndexerDisabledNotice className="mb-4" />}
          {tab === "similar" && <SimilarTab routeParams={routeParams} urlSearchParams={urlSearchParams} setUrlSearchParams={setUrlSearchParams} />}
          {tab === "duplicates" && <DuplicatesTab routeParams={routeParams} urlSearchParams={urlSearchParams} setUrlSearchParams={setUrlSearchParams} />}
          {tab === "compare" && <CompareTab routeParams={routeParams} urlSearchParams={urlSearchParams} setUrlSearchParams={setUrlSearchParams} />}
        </div>
      </div>
    </PageShell>
  );
};
