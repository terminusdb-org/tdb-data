import React, { useState, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  useDuplicatesQuery,
  useSimilarQuery,
  useResolveMutation,
  useCompareMutation,
  useGetSchemaQuery,
  useGetDocumentQuery,
  useGetEmbeddingTextQuery,
} from "@/store";
import { PageShell, PageHeader, PagePlaceholder, useRouteParams, SimilarityBadge, SearchResultCard, DocumentPicker, DocumentPreviewModal, MatchComparisonModal } from "@/components";
import { buildApiPath, type RouteParams } from "@/utils/routes";
import type { DuplicatesResponse, SearchHit, ResolveResponse, ResolveMatch, CompareResponse } from "@/types/terminusdb";
import { distanceToPercent, similarityLabel } from "@/utils/similarity";

// --- Single-entry resolve cache ---
// Keyed by routeParams + resolve query params. Replaced on each new resolve.

interface ResolveCacheEntry {
  readonly cacheKey: string;
  readonly result: ResolveResponse;
}

let resolveCache: ResolveCacheEntry | null = null;

function resolveCacheKey(
  routeParams: RouteParams,
  params: { setDocType: string; targetDocType: string; threshold: number; k: number; tauOneToOne: number; tauOneToMany: number; tauManyToOne: number },
): string {
  return [
    routeParams.org, routeParams.team, routeParams.refType, routeParams.refName,
    params.setDocType, params.targetDocType,
    params.threshold, params.k,
    params.tauOneToOne, params.tauOneToMany, params.tauManyToOne,
  ].join("|");
}

function getResolveCache(cacheKey: string): ResolveResponse | null {
  if (resolveCache && resolveCache.cacheKey === cacheKey) return resolveCache.result;
  return null;
}

function setResolveCache(cacheKey: string, result: ResolveResponse): void {
  resolveCache = { cacheKey, result };
}

function clearResolveCache(): void {
  resolveCache = null;
}

// --- CSV perfect-match verification ---

interface PerfectMatchStats {
  readonly truePositives: number;
  readonly falsePositives: number;
  readonly falseNegatives: number;
  readonly precision: number;
  readonly recall: number;
  readonly f1: number;
  readonly totalPerfect: number;
  readonly totalResolved: number;
}

interface PerfectMatch {
  readonly set_id: string;
  readonly target_id: string;
}

function parsePerfectMatchCSV(text: string): PerfectMatch[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = lines[0].split(",").map((c) => c.trim());
  const setIdx = header.findIndex((h) => h === "set_id");
  const targetIdx = header.findIndex((h) => h === "target_id");
  if (setIdx === -1 || targetIdx === -1) return [];
  const matches: PerfectMatch[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    if (cols[setIdx] && cols[targetIdx]) {
      matches.push({ set_id: cols[setIdx], target_id: cols[targetIdx] });
    }
  }
  return matches;
}

function computeMatchStats(
  resolved: ReadonlyArray<ResolveMatch>,
  perfect: ReadonlyArray<PerfectMatch>,
): PerfectMatchStats {
  const perfectSet = new Set(perfect.map((m) => `${m.set_id}\u0000${m.target_id}`));
  const resolvedSet = new Set(resolved.map((m) => `${m.set_id}\u0000${m.target_id}`));
  let tp = 0;
  for (const key of resolvedSet) if (perfectSet.has(key)) tp++;
  const fp = resolvedSet.size - tp;
  const fn = perfectSet.size - tp;
  const precision = resolvedSet.size > 0 ? tp / resolvedSet.size : 0;
  const recall = perfectSet.size > 0 ? tp / perfectSet.size : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  return {
    truePositives: tp,
    falsePositives: fp,
    falseNegatives: fn,
    precision,
    recall,
    f1,
    totalPerfect: perfectSet.size,
    totalResolved: resolvedSet.size,
  };
}

type Tab = "similar" | "duplicates" | "resolve" | "compare";

const SimilarTab: React.FC<{ routeParams: RouteParams; urlSearchParams: URLSearchParams; setUrlSearchParams: (sp: URLSearchParams, opts?: { replace?: boolean }) => void }> = ({ routeParams, urlSearchParams, setUrlSearchParams }) => {
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
        Find documents semantically similar to a specific document or to raw text. In document mode, search for a document to find its nearest neighbours. In text mode, enter raw text to embed and find similar documents.
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
          By Document
        </button>
        <button
          type="button"
          onClick={() => setMode("text")}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            searchMode === "text" ? "bg-dfrntBlue-500 text-white" : "border border-gray-300 text-gray-600 hover:bg-gray-50"
          }`}
        >
          By Text
        </button>
      </div>

      <div className="flex items-end gap-3">
        {searchMode === "doc" ? (
          <div className="flex-1">
            <DocumentPicker
              suggestPath={suggestPath}
              value={docId}
              onChange={(id) => handleSearch(id)}
              placeholder="Search for a document…"
              label="Source document"
            />
          </div>
        ) : (
          <div className="flex-1">
            <label htmlFor="similar-text" className="mb-1 block text-xs font-medium text-gray-500">Search text</label>
            <textarea
              id="similar-text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Enter text to find similar documents…"
              rows={3}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        )}
        <div>
          <label htmlFor="similar-count" className="mb-1 block text-xs font-medium text-gray-500">Max results</label>
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
            Search
          </button>
        )}
      </div>

      {error && triggered && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          {"status" in error
            ? (() => {
                const errData = "data" in error && error.data ? JSON.stringify(error.data) : "Failed to find similar documents";
                return `Error ${error.status}: ${errData}`;
              })()
            : "Failed to find similar documents"}
        </div>
      )}

      {isFetching && triggered && (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500">
          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Finding similar documents…
        </div>
      )}

      {!isFetching && triggered && results.length === 0 && !error && (
        <div className="py-8 text-center text-sm text-gray-500">No similar documents found.</div>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          <div className="text-sm text-gray-500">
            {results.length} similar document{results.length !== 1 ? "s" : ""}
            {searchMode === "doc" && <> to <span className="font-data font-medium text-gray-700">{docId}</span></>}
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
      .filter((c) => c["@type"] === "Class")
      .map((c) => c["@id"])
      .sort();
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
        Find near-identical document pairs across the dataset. Duplicates are documents with very low embedding distance, indicating likely redundant or repeated content. Filter by document type to scope the scan and speed up results.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="dup-threshold" className="mb-1 block text-xs font-medium text-gray-500">Threshold (distance)</label>
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
          <label htmlFor="dup-count" className="mb-1 block text-xs font-medium text-gray-500">Max results</label>
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
          <label htmlFor="dup-doctype" className="mb-1 block text-xs font-medium text-gray-500">Document type (optional)</label>
          <select
            id="dup-doctype"
            value={docTypeInput}
            onChange={(e) => setDocTypeInput(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="">All types</option>
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
          {isFetching ? "Finding…" : "Find Duplicates"}
        </button>
      </div>

      {error && triggered && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          {"status" in error ? `Error: ${String(error.status)}` : "Failed to find duplicates"}
        </div>
      )}

      {!isFetching && triggered && results.length === 0 && !error && (
        <div className="py-8 text-center text-sm text-gray-500">No duplicates found at this threshold.</div>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          <div className="text-sm text-gray-500">{results.length} duplicate group{results.length !== 1 ? "s" : ""}</div>
          {results.map((group, i) => {
            const groupColors = ["border-l-dfrntBlue-400", "border-l-green-400", "border-l-yellow-400", "border-l-purple-400", "border-l-pink-400"];
            const borderColor = groupColors[i % groupColors.length];
            return (
              <div key={i} className={`rounded-lg border border-gray-200 border-l-4 ${borderColor} bg-white p-4`}>
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-500">Group {i + 1}</span>
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

function TauDial({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <label className="text-xs font-medium text-gray-500">{label}</label>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-24 accent-dfrntBlue-500"
      />
      <span className="font-data text-xs tabular-nums text-gray-700">{value.toFixed(2)}</span>
    </div>
  );
}

const ResolveTab: React.FC<{ routeParams: RouteParams; urlSearchParams: URLSearchParams; setUrlSearchParams: (sp: URLSearchParams, opts?: { replace?: boolean }) => void }> = ({ routeParams, urlSearchParams, setUrlSearchParams }) => {
  const setDocType = urlSearchParams.get("setType") ?? "";
  const targetDocType = urlSearchParams.get("targetType") ?? "";
  const threshold = Number(urlSearchParams.get("threshold") ?? "0.5");
  const k = Number(urlSearchParams.get("k") ?? "5");
  const tauOneToOne = Number(urlSearchParams.get("tau1to1") ?? "0.3");
  const tauOneToMany = Number(urlSearchParams.get("tau1toN") ?? "0.3");
  const tauManyToOne = Number(urlSearchParams.get("tauNto1") ?? "0.3");
  const [result, setResult] = useState<ResolveResponse | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [compareIndex, setCompareIndex] = useState<number | null>(null);
  const [sortOrder, setSortOrder] = useState<"closest" | "furthest">("closest");
  const [csvStats, setCsvStats] = useState<PerfectMatchStats | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [resolve, { isLoading, error }] = useResolveMutation();
  const navigate = useNavigate();

  const sortedMatches = useMemo(() => {
    if (!result) return [];
    const sorted = [...result.matched];
    sorted.sort((a, b) => sortOrder === "closest" ? a.distance - b.distance : b.distance - a.distance);
    return sorted;
  }, [result, sortOrder]);

  // Restore cached result on mount if params match
  const cacheKey = resolveCacheKey(routeParams, { setDocType, targetDocType, threshold, k, tauOneToOne, tauOneToMany, tauManyToOne });
  const cached = useMemo(() => getResolveCache(cacheKey), [cacheKey]);
  React.useEffect(() => {
    if (cached && !result) setResult(cached);
  }, [cached, result]);

  const resolvePath = buildApiPath(routeParams, "plugin/search-resolve");
  const schemaPath = buildApiPath(routeParams, "schema");
  const docPath = buildApiPath(routeParams, "document");
  const { data: schemaClasses } = useGetSchemaQuery(
    { path: schemaPath, asList: true },
  );
  const { data: previewDoc } = useGetDocumentQuery(
    { path: docPath, id: previewId ?? "" },
    { skip: !previewId }
  );

  const docTypes = useMemo(() => {
    if (!schemaClasses) return [];
    return schemaClasses
      .filter((c) => c["@type"] === "Class")
      .map((c) => c["@id"])
      .sort();
  }, [schemaClasses]);

  const updateParam = (key: string, value: string) => {
    const sp = new URLSearchParams(urlSearchParams);
    sp.set(key, value);
    setUrlSearchParams(sp, { replace: true });
  };

  const applyPreset = (preset: "loose" | "balanced" | "strict") => {
    const presets = {
      loose: { threshold: "0.20", tau1to1: "0.12", tau1toN: "0.12", tauNto1: "0.12" },
      balanced: { threshold: "0.15", tau1to1: "0.08", tau1toN: "0.08", tauNto1: "0.08" },
      strict: { threshold: "0.12", tau1to1: "0.05", tau1toN: "0.05", tauNto1: "0.05" },
    };
    const sp = new URLSearchParams(urlSearchParams);
    const p = presets[preset];
    sp.set("threshold", p.threshold);
    sp.set("tau1to1", p.tau1to1);
    sp.set("tau1toN", p.tau1toN);
    sp.set("tauNto1", p.tauNto1);
    setUrlSearchParams(sp, { replace: true });
  };

  const handleResolve = async () => {
    clearResolveCache();
    setCsvStats(null);
    setCsvError(null);
    setCsvFileName(null);
    try {
      const res = await resolve({
        path: resolvePath,
        body: {
          set_doc_types: setDocType ? [setDocType] : undefined,
          target_doc_types: targetDocType ? [targetDocType] : undefined,
          threshold,
          tau_one_to_one: tauOneToOne,
          tau_one_to_many: tauOneToMany,
          tau_many_to_one: tauManyToOne,
          k,
        },
      }).unwrap();
      setResult(res);
      setResolveCache(cacheKey, res);
    } catch {
      setResult(null);
    }
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const perfect = parsePerfectMatchCSV(text);
      if (perfect.length === 0) {
        setCsvStats(null);
        setCsvError("CSV must have a header row with 'set_id' and 'target_id' columns, followed by at least one data row.");
        setCsvFileName(null);
        return;
      }
      if (!result || result.matched.length === 0) {
        setCsvStats(null);
        setCsvError("Run a resolve query first before uploading a perfect match CSV.");
        setCsvFileName(null);
        return;
      }
      const stats = computeMatchStats(result.matched, perfect);
      setCsvStats(stats);
      setCsvFileName(file.name);
    };
    reader.onerror = () => {
      setCsvError("Failed to read file.");
      setCsvStats(null);
      setCsvFileName(null);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const navigateToDoc = (id: string) => {
    navigate(`/${routeParams.org}/${routeParams.team}/local/${routeParams.refType}/${routeParams.refName}/documents?edit=${encodeURIComponent(id)}`);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Match source documents to target documents by type using embedding similarity. Select a source and target type, then tune the tau thresholds to control match strictness.
      </p>

      <div className="flex gap-2">
        <button type="button" onClick={() => applyPreset("loose")} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">Loose</button>
        <button type="button" onClick={() => applyPreset("balanced")} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">Balanced</button>
        <button type="button" onClick={() => applyPreset("strict")} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">Strict</button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="resolve-set-type" className="mb-1 block text-xs font-medium text-gray-500">Source type</label>
          <select
            id="resolve-set-type"
            value={setDocType}
            onChange={(e) => updateParam("setType", e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">All types</option>
            {docTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="resolve-target-type" className="mb-1 block text-xs font-medium text-gray-500">Target type</label>
          <select
            id="resolve-target-type"
            value={targetDocType}
            onChange={(e) => updateParam("targetType", e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">All types</option>
            {docTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Matching Parameters</div>
        <div className="flex flex-wrap items-end gap-6">
          <div>
            <label htmlFor="resolve-threshold" className="mb-1 block text-xs font-medium text-gray-500">Threshold</label>
            <input id="resolve-threshold" type="number" step="0.05" min="0" max="1" value={threshold}
              onChange={(e) => updateParam("threshold", e.target.value)}
              className="w-20 rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label htmlFor="resolve-k" className="mb-1 block text-xs font-medium text-gray-500">K (neighbors)</label>
            <input id="resolve-k" type="number" min="1" max="50" value={k}
              onChange={(e) => updateParam("k", e.target.value)}
              className="w-20 rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
          </div>
          <TauDial label="τ 1:1" value={tauOneToOne} onChange={(v) => updateParam("tau1to1", String(v))} />
          <TauDial label="τ 1:N" value={tauOneToMany} onChange={(v) => updateParam("tau1toN", String(v))} />
          <TauDial label="τ N:1" value={tauManyToOne} onChange={(v) => updateParam("tauNto1", String(v))} />
          <button
            type="button"
            onClick={handleResolve}
            disabled={isLoading}
            className="rounded-md bg-dfrntBlue-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-dfrntBlue-400 disabled:bg-gray-300"
          >
            {isLoading ? "Resolving…" : "Resolve"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          {"status" in error ? `Error: ${String(error.status)}` : "Resolution failed"}
        </div>
      )}

      {result && (
        <>
          {/* CSV upload — above results */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Perfect Match Verification</div>
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleCsvUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                Upload Perfect Match CSV
              </button>
              {csvFileName && (
                <span className="text-xs text-gray-500">{csvFileName}</span>
              )}
            </div>
            <p className="mt-2 text-xs text-gray-400">
              CSV must have a header row with <code className="font-mono">set_id</code> and <code className="font-mono">target_id</code> columns.
            </p>
            {csvError && (
              <div className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">{csvError}</div>
            )}
            {csvStats && (
              <div className="mt-3 grid grid-cols-4 gap-3">
                <div className="rounded-md bg-white px-3 py-2 text-center">
                  <div className="text-lg font-semibold text-green-600">{csvStats.truePositives}</div>
                  <div className="text-xs text-gray-500">True Positives</div>
                </div>
                <div className="rounded-md bg-white px-3 py-2 text-center">
                  <div className="text-lg font-semibold text-red-600">{csvStats.falsePositives}</div>
                  <div className="text-xs text-gray-500">False Positives</div>
                </div>
                <div className="rounded-md bg-white px-3 py-2 text-center">
                  <div className="text-lg font-semibold text-orange-600">{csvStats.falseNegatives}</div>
                  <div className="text-xs text-gray-500">False Negatives</div>
                </div>
                <div className="rounded-md bg-white px-3 py-2 text-center">
                  <div className="text-lg font-semibold text-gray-900">{csvStats.totalPerfect}</div>
                  <div className="text-xs text-gray-500">Perfect Matches</div>
                </div>
                <div className="rounded-md bg-white px-3 py-2 text-center">
                  <div className="text-lg font-semibold text-dfrntBlue-600">{(csvStats.precision * 100).toFixed(1)}%</div>
                  <div className="text-xs text-gray-500">Precision</div>
                </div>
                <div className="rounded-md bg-white px-3 py-2 text-center">
                  <div className="text-lg font-semibold text-dfrntBlue-600">{(csvStats.recall * 100).toFixed(1)}%</div>
                  <div className="text-xs text-gray-500">Recall</div>
                </div>
                <div className="rounded-md bg-white px-3 py-2 text-center">
                  <div className="text-lg font-semibold text-dfrntBlue-700">{(csvStats.f1 * 100).toFixed(1)}%</div>
                  <div className="text-xs text-gray-500">F1 Score</div>
                </div>
                <div className="rounded-md bg-white px-3 py-2 text-center">
                  <div className="text-lg font-semibold text-gray-900">{csvStats.totalResolved}</div>
                  <div className="text-xs text-gray-500">Resolved Matches</div>
                </div>
              </div>
            )}
          </div>

          {/* Summary + sort toggle */}
          <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-2 text-sm text-gray-600">
            <div className="flex items-center gap-4">
              <span><strong className="text-gray-900">{result.matched.length}</strong> matched</span>
              {result.set_only.length > 0 && <span><strong className="text-gray-900">{result.set_only.length}</strong> set-only</span>}
              {result.target_only.length > 0 && <span><strong className="text-gray-900">{result.target_only.length}</strong> target-only</span>}
            </div>
            {sortedMatches.length > 0 && (
              <button
                type="button"
                onClick={() => setSortOrder(sortOrder === "closest" ? "furthest" : "closest")}
                className="flex items-center gap-1.5 rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={
                    sortOrder === "closest"
                      ? "M3 4.5h18M6 9.75h12M9 15h6M12 19.5h0"
                      : "M3 19.5h18M6 14.25h12M9 9h6M12 4.5h0"
                  } />
                </svg>
                {sortOrder === "closest" ? "Most similar first" : "Least similar first"}
              </button>
            )}
          </div>

          {/* Scrollable results */}
          {sortedMatches.length > 0 && (
            <div className="max-h-[60vh] space-y-2 overflow-y-auto">
              {sortedMatches.map((m, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3">
                  <div className="flex-1 cursor-pointer rounded-md bg-gray-50 p-2 hover:bg-gray-100" onClick={() => navigateToDoc(m.set_id)}>
                    <div className="text-xs text-gray-400">source</div>
                    <div className="font-data text-sm text-gray-900">{m.set_id}</div>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <SimilarityBadge distance={m.distance} size="lg" />
                    <span className="text-xs text-gray-400">{m.stage}</span>
                  </div>
                  <div className="flex-1 cursor-pointer rounded-md bg-gray-50 p-2 hover:bg-gray-100" onClick={() => navigateToDoc(m.target_id)}>
                    <div className="text-xs text-gray-400">target</div>
                    <div className="font-data text-sm text-gray-900">{m.target_id}</div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setCompareIndex(i); }}
                    className="rounded-md px-2 py-0.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
                  >
                    Compare
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {previewId && (
        <DocumentPreviewModal
          documentId={previewId}
          docData={previewDoc}
          onClose={() => setPreviewId(null)}
          onOpenFull={() => navigateToDoc(previewId)}
        />
      )}

      {compareIndex !== null && sortedMatches.length > 0 && (
        <MatchComparisonModal
          matches={sortedMatches}
          initialIndex={compareIndex}
          docPath={docPath}
          onClose={() => setCompareIndex(null)}
          onOpenFull={(id) => navigateToDoc(id)}
        />
      )}
    </div>
  );
};

const CompareTab: React.FC<{ routeParams: RouteParams; urlSearchParams: URLSearchParams; setUrlSearchParams: (sp: URLSearchParams, opts?: { replace?: boolean }) => void }> = ({ routeParams, urlSearchParams, setUrlSearchParams }) => {
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
    } catch {
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
        Compare two documents or text snippets by embedding distance. Each source and target can independently be set to text or document mode.
      </p>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="mb-2 flex gap-1">
            <button
              type="button"
              onClick={() => updateParam("smode", "text")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${sourceMode === "text" ? "bg-dfrntBlue-500 text-white" : "border border-gray-300 text-gray-600 hover:bg-gray-50"}`}
            >
              Source: Text
            </button>
            <button
              type="button"
              onClick={() => updateParam("smode", "doc")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${sourceMode === "doc" ? "bg-dfrntBlue-500 text-white" : "border border-gray-300 text-gray-600 hover:bg-gray-50"}`}
            >
              Source: Document
            </button>
          </div>
          {sourceMode === "doc" ? (
            <>
              <DocumentPicker
                suggestPath={suggestPath}
                value={sourceDocId}
                onChange={(id) => updateParam("source_id", id)}
                placeholder="Select source document…"
                label="Source document"
              />
              {sourceEmbedding && (
                <div className="mt-1 line-clamp-2 text-xs text-gray-400">{sourceEmbedding.slice(0, 200)}…</div>
              )}
            </>
          ) : (
            <>
              <label htmlFor="compare-source-text" className="mb-1 block text-xs font-medium text-gray-500">Source text</label>
              <textarea
                id="compare-source-text"
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                placeholder="Enter source text…"
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
              Target: Text
            </button>
            <button
              type="button"
              onClick={() => updateParam("tmode", "doc")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${targetMode === "doc" ? "bg-dfrntBlue-500 text-white" : "border border-gray-300 text-gray-600 hover:bg-gray-50"}`}
            >
              Target: Document
            </button>
          </div>
          {targetMode === "doc" ? (
            <>
              <DocumentPicker
                suggestPath={suggestPath}
                value={targetDocId}
                onChange={(id) => updateParam("target_id", id)}
                placeholder="Select target document…"
                label="Target document"
              />
              {targetEmbedding && (
                <div className="mt-1 line-clamp-2 text-xs text-gray-400">{targetEmbedding.slice(0, 200)}…</div>
              )}
            </>
          ) : (
            <>
              <label htmlFor="compare-target-text" className="mb-1 block text-xs font-medium text-gray-500">Target text</label>
              <textarea
                id="compare-target-text"
                value={targetText}
                onChange={(e) => setTargetText(e.target.value)}
                placeholder="Enter target text…"
                rows={4}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </>
          )}
        </div>
      </div>

      <div className="flex items-end gap-3">
        <div>
          <span className="mb-1 block text-xs font-medium text-gray-500">Role</span>
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
          {isLoading ? "Comparing…" : "Compare"}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          {"status" in error ? `Error: ${String(error.status)}` : "Comparison failed"}
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
              <span className="text-xs font-medium text-gray-500">Similarity</span>
              <p className="text-lg font-semibold text-gray-900">{label}</p>
            </div>
            <div>
              <span className="text-xs font-medium text-gray-500">Distance</span>
              <p className="font-data text-sm text-gray-700">{result.distance.toFixed(4)}</p>
            </div>
            <div>
              <span className="text-xs font-medium text-gray-500">Role</span>
              <p className="text-sm font-medium text-gray-700">{result.source_role ?? role}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const VectorSearchPage: React.FC = () => {
  const routeParams = useRouteParams();
  const [urlSearchParams, setUrlSearchParams] = useSearchParams();
  const tab = (urlSearchParams.get("mode") as Tab) ?? "similar";

  if (!routeParams) return <PagePlaceholder>Select a data product first.</PagePlaceholder>;

  const modes: ReadonlyArray<{ id: Tab; label: string; description: string; icon: React.ReactNode }> = [
    {
      id: "similar",
      label: "Similar",
      description: "Find semantically related documents",
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
        </svg>
      ),
    },
    {
      id: "duplicates",
      label: "Duplicates",
      description: "Discover near-identical content",
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-.975M15.75 17.25h-.975m-7.5 0v3.375c0 .621.504 1.125 1.125 1.125H9.75m-2.475 0H9.75m0 0v-3.375m0 0c0-.621.504-1.125 1.125-1.125h.975M9.75 17.25h.975m0 0v3.375m0-3.375c0-.621.504-1.125 1.125-1.125h.975m-.975 0h.975" />
        </svg>
      ),
    },
    {
      id: "resolve",
      label: "Entity Resolution",
      description: "Match documents across types",
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      ),
    },
    {
      id: "compare",
      label: "Compare",
      description: "Compare data products by embedding",
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
          <h2 className="text-lg font-semibold text-gray-900">Vector Search</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Find similar documents, discover duplicates, resolve entities, and compare data products using embedding-based similarity.
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
          {tab === "similar" && <SimilarTab routeParams={routeParams} urlSearchParams={urlSearchParams} setUrlSearchParams={setUrlSearchParams} />}
          {tab === "duplicates" && <DuplicatesTab routeParams={routeParams} urlSearchParams={urlSearchParams} setUrlSearchParams={setUrlSearchParams} />}
          {tab === "resolve" && <ResolveTab routeParams={routeParams} urlSearchParams={urlSearchParams} setUrlSearchParams={setUrlSearchParams} />}
          {tab === "compare" && <CompareTab routeParams={routeParams} urlSearchParams={urlSearchParams} setUrlSearchParams={setUrlSearchParams} />}
        </div>
      </div>
    </PageShell>
  );
};
