import React, { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  useCandidatesMutation,
  useGetSchemaQuery,
  useGetDocumentsQuery,
  useReplaceRawJsonDocumentMutation,
  useInsertRawJsonDocumentMutation,
  useAppDispatch, useAppSelector,
  setCandidates, setCandidatesLoading, setCandidatesError, setLexicalScores,
  setPerfectMatches, setCsvFileName, setCsvError, setResultsTab, setStageFilter, setSortBy, setSortDir,
  selectERCandidates, selectERCandidatesLoading, selectERCandidatesError,
  selectERLexicalScores, selectERPerfectMatches, selectERCsvFileName, selectERCsvError,
  selectERResultsTab, selectERStageFilter, selectERSortBy, selectERSortDir,
} from "@/store";
import type { StageFilter, SortBy } from "@/store";
import { PageShell, PageHeader, PagePlaceholder, useRouteParams, DocumentPreviewModal, MatchComparisonModal } from "@/components";
import { buildApiPath } from "@/utils/routes";
import type { CandidatesResult, SchemaClass } from "@/types/terminusdb";
import { isSubdocument } from "@/types/terminusdb";
import { resolve, computeMatchStats, type ResolveResult, type MatchStats } from "@/utils/resolve";
import { computeLexicalScores, normalizeId, type CandidateEntry as LexCandidateEntry } from "@/utils/lexical";
import { parsePerfectMatchCSV } from "@/utils/csv";
import { buildTrialDocument, buildTrialEntry, trialsFromDocument, TRIAL_DOC_ID, type ERTrial } from "@/utils/erTrial";

function generateDemoCandidates(): CandidatesResult {
  const names = [
    "Apple iPhone 15 Pro Max 256GB Titanium Black",
    "Apple iPhone 15 Pro 128GB Titanium Blue",
    "Samsung Galaxy S24 Ultra 512GB Titanium Gray",
    "Samsung Galaxy S24 256GB Phantom Black",
    "Google Pixel 9 Pro 256GB Obsidian",
    "Google Pixel 9 128GB Hazel",
    "OnePlus 12 256GB Silky Black",
    "Xiaomi 14 Pro 512GB Jade Green",
  ];
  const features = [
    "A17 Pro chip titanium aerospace grade ProMotion 120Hz",
    "A17 Pro chip titanium aerospace grade ProMotion 120Hz",
    "Snapdragon 8 Gen 3 S Pen stylus 200MP camera titanium",
    "Snapdragon 8 Gen 3 AMOLED 2X display 200MP camera",
    "Tensor G3 chip Magic Editor AI photography Actua",
    "Tensor G3 chip Magic Editor AI photography Actua",
    "Snapdragon 8 Gen 3 Hasselblad camera 100W fast charging",
    "Leica optics Snapdragon 8 Gen 3 ceramic body Jade Green",
  ];
  const contents = names.map((n, i) =>
    n + " " + features[i] + " smartphone with advanced camera, OLED display, fast charging, 5G connectivity, and premium build quality.");
  const ids = names.map((_, i) => `doc/item_${i}`);

  const setToTarget: Record<string, LexCandidateEntry[]> = {};
  const targetToSet: Record<string, LexCandidateEntry[]> = {};

  for (let i = 0; i < ids.length; i++) {
    targetToSet[ids[i]] = [];
  }

  for (let i = 0; i < ids.length; i++) {
    const neighbours: LexCandidateEntry[] = [];
    for (let j = 0; j < ids.length; j++) {
      if (i === j) continue;
      const dist = 0.1 + Math.abs(i - j) * 0.08 + (i % 2 === j % 2 ? 0.0 : 0.15);
      neighbours.push({
        id: ids[j],
        distance: dist,
        content: contents[j],
      });
    }
    neighbours.sort((a, b) => a.distance - b.distance);
    const topK = neighbours.slice(0, 5);
    setToTarget[ids[i]] = topK;
    for (const n of topK) {
      if (!targetToSet[n.id]) targetToSet[n.id] = [];
      targetToSet[n.id].push({
        id: ids[i],
        distance: n.distance,
        content: contents[i],
      });
    }
  }

  for (const key of Object.keys(targetToSet)) {
    targetToSet[key].sort((a, b) => a.distance - b.distance);
  }

  let s2tEdges = 0, t2sEdges = 0;
  for (const v of Object.values(setToTarget)) s2tEdges += v.length;
  for (const v of Object.values(targetToSet)) t2sEdges += v.length;

  return {
    set_to_target: setToTarget,
    target_to_set: targetToSet,
    stats: {
      elapsed_ms: 0,
      set_points: ids.length,
      target_points: ids.length,
      set_to_target_edges: s2tEdges,
      target_to_set_edges: t2sEdges,
    },
  } as unknown as CandidatesResult;
}

const PRESETS: Record<string, Record<string, string>> = {
  loose: { threshold: "0.6", tau1to1: "0.5", tau1toN: "0.6", tauNto1: "0.6", jaccard: "0.0", rareToken: "0.3" },
  balanced: { threshold: "0.5", tau1to1: "0.3", tau1toN: "0.4", tauNto1: "0.4", jaccard: "0.0", rareToken: "0.8" },
  strict: { threshold: "0.3", tau1to1: "0.2", tau1toN: "0.25", tauNto1: "0.25", jaccard: "0.0", rareToken: "1.2" },
  lexical: { threshold: "0.5", tau1to1: "0.3", tau1toN: "0.4", tauNto1: "0.4", jaccard: "0.0", rareToken: "1.5" },
};

function Gauge({ value, label, size = "md" }: { value: number; label: string; size?: "sm" | "md" | "lg" }) {
  const pct = Math.round(value * 100);
  const radius = size === "lg" ? 52 : size === "md" ? 40 : 32;
  const stroke = size === "lg" ? 8 : 6;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - Math.max(0, Math.min(100, pct)) / 100);
  const color = pct >= 85 ? "#16a34a" : pct >= 70 ? "#ca8a04" : "#dc2626";
  const fontSize = size === "lg" ? 20 : 16;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={radius * 2 + stroke * 2} height={radius * 2 + stroke * 2} className="-rotate-90">
        <circle cx={radius + stroke} cy={radius + stroke} r={radius} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
        <circle
          cx={radius + stroke}
          cy={radius + stroke}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
        />
      </svg>
      <div className="-mt-12 flex flex-col items-center">
        <span className="font-semibold tabular-nums" style={{ fontSize, color }}>{pct}%</span>
      </div>
      <span className="text-xs font-medium text-gray-500">{label}</span>
    </div>
  );
}

function SliderControl({ label, value, onChange, min = 0, max = 1, step = 0.01, format }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  format?: (v: number) => string;
}) {
  const [textValue, setTextValue] = useState(String(value));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setTextValue(String(value));
  }, [value, editing]);

  const commitText = () => {
    setEditing(false);
    const parsed = Number(textValue);
    if (!Number.isNaN(parsed)) {
      const clamped = Math.min(max, Math.max(min, parsed));
      onChange(clamped);
    } else {
      setTextValue(String(value));
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-gray-500">{label}</label>
        <input
          type="text"
          value={textValue}
          onChange={(e) => setTextValue(e.target.value)}
          onFocus={() => setEditing(true)}
          onBlur={commitText}
          onKeyDown={(e) => { if (e.key === "Enter") commitText(); }}
          className="w-16 rounded border border-gray-200 px-1 py-0.5 text-right font-data text-xs tabular-nums text-gray-700 focus:border-dfrntBlue-400 focus:outline-none"
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-dfrntBlue-500"
      />
      {format && (
        <span className="text-[10px] text-gray-400">{format(value)}</span>
      )}
    </div>
  );
}

const stageColors: Record<string, string> = {
  core: "bg-blue-100 text-blue-700",
  set_extra: "bg-amber-100 text-amber-700",
  target_extra: "bg-purple-100 text-purple-700",
};

export const EntityResolutionPage: React.FC = () => {
  const { t } = useTranslation();
  const routeParams = useRouteParams();
  const [urlSearchParams, setUrlSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const setDocType = urlSearchParams.get("setType") ?? "";
  const targetDocType = urlSearchParams.get("targetType") ?? "";
  const k = Number(urlSearchParams.get("k") ?? "3");
  const threshold = Number(urlSearchParams.get("threshold") ?? "0.8");
  const tauOneToOne = Number(urlSearchParams.get("tau1to1") ?? "0.3");
  const tauOneToMany = Number(urlSearchParams.get("tau1toN") ?? "0");
  const tauManyToOne = Number(urlSearchParams.get("tauNto1") ?? "0");
  const blendAlpha = Number(urlSearchParams.get("blend") ?? "0.3");
  const jaccardWeight = Number(urlSearchParams.get("jaccard") ?? "0.0");
  const rareTokenWeight = Number(urlSearchParams.get("rareToken") ?? "0.0");

  const dispatch = useAppDispatch();
  const candidates = useAppSelector(selectERCandidates);
  const candidatesLoading = useAppSelector(selectERCandidatesLoading);
  const candidatesError = useAppSelector(selectERCandidatesError);
  const lexicalScores = useAppSelector(selectERLexicalScores);
  const perfectMatches = useAppSelector(selectERPerfectMatches);
  const csvFileName = useAppSelector(selectERCsvFileName);
  const csvError = useAppSelector(selectERCsvError);
  const resultsTab = useAppSelector(selectERResultsTab);
  const stageFilter = useAppSelector(selectERStageFilter);
  const sortBy = useAppSelector(selectERSortBy);
  const sortDir = useAppSelector(selectERSortDir);
  const [loadElapsed, setLoadElapsed] = useState(0);
  const [loadStartTime, setLoadStartTime] = useState<number | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [compareIndex, setCompareIndex] = useState<number | null>(null);
  const [trialLabel, setTrialLabel] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [candidatesMutation] = useCandidatesMutation();
  const [replaceTrial] = useReplaceRawJsonDocumentMutation();
  const [insertTrial] = useInsertRawJsonDocumentMutation();

  const candidatesPath = routeParams ? buildApiPath(routeParams, "plugin/search-candidates") : "";
  const schemaPath = routeParams ? buildApiPath(routeParams, "schema") : "";
  const docPath = routeParams ? buildApiPath(routeParams, "document") : "";

  const { data: schemaClasses } = useGetSchemaQuery({ path: schemaPath, asList: true }, { skip: !routeParams });

  const docTypes = useMemo(() => {
    if (!schemaClasses) return [];
    return schemaClasses
      .filter((c: SchemaClass) => c["@type"] === "Class" && !isSubdocument(c))
      .map((c) => c["@id"])
      .sort((a, b) => a.localeCompare(b));
  }, [schemaClasses]);

  const trialsPath = routeParams ? buildApiPath(routeParams, "document") : "";
  const { data: trialDoc, refetch: refetchTrials } = useGetDocumentsQuery(
    { path: trialsPath, id: TRIAL_DOC_ID, asList: true },
    { skip: !candidates || !routeParams },
  );

  const trials = useMemo(() => {
    if (!trialDoc) return [];
    const docs = Array.isArray(trialDoc) ? trialDoc : [trialDoc];
    if (docs.length === 0) return [];
    return trialsFromDocument(docs[0] as Record<string, unknown>);
  }, [trialDoc]);

  const { data: previewDoc } = useGetDocumentsQuery(
    { path: docPath, id: previewId ?? "", asList: true },
    { skip: !previewId || !routeParams },
  );

  const updateParam = (key: string, value: string) => {
    const sp = new URLSearchParams(urlSearchParams);
    sp.set(key, value);
    setUrlSearchParams(sp, { replace: true });
  };

  const applyPreset = (preset: keyof typeof PRESETS) => {
    const sp = new URLSearchParams(urlSearchParams);
    const p = PRESETS[preset];
    for (const [key, val] of Object.entries(p)) {
      sp.set(key, val);
    }
    setUrlSearchParams(sp, { replace: true });
  };

  useEffect(() => {
    if (!loadStartTime) return;
    const interval = setInterval(() => {
      setLoadElapsed(Math.floor((Date.now() - loadStartTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [loadStartTime]);

  const handleLoadCandidates = async () => {
    dispatch(setCandidatesLoading(true));
    dispatch(setCandidatesError(null));
    setSaveSuccess(false);
    setLoadStartTime(Date.now());
    setLoadElapsed(0);
    try {
      const result = await candidatesMutation({
        path: candidatesPath,
        body: {
          set_doc_types: setDocType ? [setDocType] : undefined,
          target_doc_types: targetDocType ? [targetDocType] : undefined,
          k,
          threshold_set: threshold,
          threshold_target: threshold,
          include: "content",
        },
      }).unwrap();
      dispatch(setCandidates(result));
      const scores = computeLexicalScores(result.set_to_target, result.target_to_set);
      dispatch(setLexicalScores(scores));
    } catch (err) {
      dispatch(setCandidates(null));
      dispatch(setCandidatesError("status" in (err as object) ? `${t("common.error")}: ${String((err as { status: unknown }).status)}` : t("entityResolution.failedToLoadCandidates")));
    } finally {
      dispatch(setCandidatesLoading(false));
      setLoadStartTime(null);
    }
  };

  const resolveResult: ResolveResult | null = useMemo(() => {
    if (!candidates) return null;
    return resolve(
      candidates.set_to_target,
      candidates.target_to_set,
      { tauOneToOne, tauOneToMany, tauManyToOne, blendAlpha, jaccardWeight, rareTokenWeight },
      lexicalScores ?? undefined,
      k,
    );
  }, [candidates, tauOneToOne, tauOneToMany, tauManyToOne, blendAlpha, jaccardWeight, rareTokenWeight, lexicalScores, k]);

  const matchStats: MatchStats | null = useMemo(() => {
    if (!resolveResult || !perfectMatches) return null;
    return computeMatchStats(resolveResult.matched, perfectMatches);
  }, [resolveResult, perfectMatches]);

  const filteredMatches = useMemo(() => {
    if (!resolveResult) return [];
    let matches = [...resolveResult.matched];
    if (stageFilter !== "all") {
      matches = matches.filter((m) => m.stage === stageFilter);
    }
    matches.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "effective") cmp = a.effectiveDistance - b.effectiveDistance;
      else if (sortBy === "distance") cmp = a.distance - b.distance;
      else if (sortBy === "setId") cmp = a.set_id.localeCompare(b.set_id);
      else if (sortBy === "targetId") cmp = a.target_id.localeCompare(b.target_id);
      else if (sortBy === "lexical") {
        const la = lexicalScores?.get(`${normalizeId(a.set_id)}\u0000${normalizeId(a.target_id)}`);
        const lb = lexicalScores?.get(`${normalizeId(b.set_id)}\u0000${normalizeId(b.target_id)}`);
        cmp = (la?.jaccardWeighted ?? 0) - (lb?.jaccardWeighted ?? 0);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return matches;
  }, [resolveResult, stageFilter, sortBy, sortDir, lexicalScores]);

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    dispatch(setCsvError(null));
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const perfect = parsePerfectMatchCSV(text);
      if (perfect.length === 0) {
        dispatch(setPerfectMatches(null));
        dispatch(setCsvError(t("entityResolution.csvFormatError")));
        dispatch(setCsvFileName(null));
        return;
      }
      dispatch(setPerfectMatches(perfect));
      dispatch(setCsvFileName(file.name));
    };
    reader.onerror = () => {
      dispatch(setCsvError(t("entityResolution.failedToReadFile")));
      dispatch(setPerfectMatches(null));
      dispatch(setCsvFileName(null));
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleSaveTrial = async () => {
    if (!resolveResult || !matchStats) return;
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const newEntry = buildTrialEntry(
        {
          setDocType,
          targetDocType,
          k,
          threshold,
          tauOneToOne,
          tauOneToMany,
          tauManyToOne,
          blendAlpha,
          jaccardWeight,
          rareTokenWeight,
        },
        {
          truePositives: matchStats.truePositives,
          falsePositives: matchStats.falsePositives,
          falseNegatives: matchStats.falseNegatives,
          precision: matchStats.precision,
          recall: matchStats.recall,
          f1: matchStats.f1,
          totalMatched: matchStats.totalResolved,
        },
        trialLabel || undefined,
      );
      const updatedTrials = [...trials, newEntry];
      const doc = buildTrialDocument(updatedTrials);
      // Try replace first (overwrite the single trial document).
      // Fall back to insert if the document doesn't exist yet.
      try {
        await replaceTrial({
          path: docPath,
          id: TRIAL_DOC_ID,
          document: doc as unknown as { "@id": string; "@type": string; [key: string]: unknown },
          author: t("common.admin"),
          message: t("entityResolution.saveTrialMessage"),
        }).unwrap();
      } catch {
        await insertTrial({
          path: docPath,
          document: doc as unknown as { "@id": string; "@type": string; [key: string]: unknown },
          author: t("common.admin"),
          message: t("entityResolution.saveTrialMessage"),
        }).unwrap();
      }
      setSaveSuccess(true);
      setTrialLabel("");
      refetchTrials();
    } catch (err) {
      setSaveError("status" in (err as object) ? `${t("common.error")}: ${String((err as { status: unknown }).status)}` : t("entityResolution.failedToSaveTrial"));
    }
  };

  const handleDeleteTrial = async (trialTimestamp: string) => {
    try {
      const updatedTrials = trials.filter((trial) => trial.timestamp !== trialTimestamp);
      const doc = buildTrialDocument(updatedTrials);
      await replaceTrial({
        path: docPath,
        id: TRIAL_DOC_ID,
        document: doc as unknown as { "@id": string; "@type": string; [key: string]: unknown },
        author: t("common.admin"),
        message: t("entityResolution.deleteTrialMessage"),
      }).unwrap();
      refetchTrials();
    } catch (err: unknown) {
      console.error(t("entityResolution.failedToDeleteTrial"), err);
    }
  };

  const handleLoadTrial = (trial: ERTrial) => {
    const sp = new URLSearchParams(urlSearchParams);
    sp.set("threshold", String(trial.params.threshold));
    sp.set("k", String(trial.params.k));
    sp.set("tau1to1", String(trial.params.tauOneToOne));
    sp.set("tau1toN", String(trial.params.tauOneToMany));
    sp.set("tauNto1", String(trial.params.tauManyToOne));
    sp.set("blend", String(trial.params.blendAlpha));
    sp.set("jaccard", String(trial.params.jaccardWeight));
    sp.set("rareToken", String(trial.params.rareTokenWeight));
    setUrlSearchParams(sp, { replace: true });
  };

  const navigateToDoc = (id: string) => {
    if (!routeParams) return;
    navigate(`/${routeParams.org}/${routeParams.team}/local/${routeParams.refType}/${routeParams.refName}/documents?edit=${encodeURIComponent(id)}`);
  };

  const hasClustering = useMemo(() => {
    if (!candidates) return false;
    for (const neighbours of Object.values(candidates.set_to_target)) {
      for (const n of neighbours) {
        if (n.clustering_distance !== undefined) return true;
      }
    }
    return false;
  }, [candidates]);

  useEffect(() => {
    if (saveSuccess) {
      const timer = setTimeout(() => setSaveSuccess(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [saveSuccess]);

  // Histogram data
  const histogramData = useMemo(() => {
    if (!resolveResult) return [];
    const buckets = new Array(10).fill(0).map(() => ({ matched: 0, unmatched: 0 }));
    const matchedKeys = new Set(resolveResult.matched.map((m) => `${normalizeId(m.set_id)}\u0000${normalizeId(m.target_id)}`));
    if (candidates) {
      for (const [setId, neighbours] of Object.entries(candidates.set_to_target)) {
        for (const n of neighbours) {
          const dist = blendAlpha !== 1.0 && n.clustering_distance !== undefined
            ? blendAlpha * n.distance + (1 - blendAlpha) * n.clustering_distance
            : n.distance;
          const bucketIdx = Math.min(9, Math.floor(dist * 10));
          const key = `${normalizeId(setId)}\u0000${normalizeId(n.id)}`;
          if (matchedKeys.has(key)) buckets[bucketIdx].matched++;
          else buckets[bucketIdx].unmatched++;
        }
      }
    }
    return buckets;
  }, [resolveResult, candidates, blendAlpha]);

  if (!routeParams) return <PagePlaceholder>{t("common.selectDataProduct")}</PagePlaceholder>;

  return (
    <PageShell
      header={
        <PageHeader>
          <h2 className="text-lg font-semibold text-gray-900">{t("entityResolution.title")}</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            {t("entityResolution.description")}
          </p>
        </PageHeader>
      }
    >
      <div className="flex h-full">
        {/* Left panel: Parameter controls */}
        <div className="w-80 shrink-0 overflow-y-auto border-r border-gray-200 bg-white p-4">
          <div className="space-y-4">
            {/* Source/Target type selectors */}
            <div className="space-y-2">
              <div>
                <label htmlFor="er-source-type" className="mb-1 block text-xs font-medium text-gray-500">{t("entityResolution.sourceType")}</label>
                <select
                  id="er-source-type"
                  value={setDocType}
                  onChange={(e) => updateParam("setType", e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">{t("common.allTypes")}</option>
                  {docTypes.map((dt) => (
                    <option key={dt} value={dt}>{dt}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="er-target-type" className="mb-1 block text-xs font-medium text-gray-500">{t("entityResolution.targetType")}</label>
                <select
                  id="er-target-type"
                  value={targetDocType}
                  onChange={(e) => updateParam("targetType", e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">{t("common.allTypes")}</option>
                  {docTypes.map((dt) => (
                    <option key={dt} value={dt}>{dt}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* K + Threshold */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label htmlFor="er-k" className="mb-1 block text-xs font-medium text-gray-500">{t("entityResolution.kNeighbors")}</label>
                <input
                  id="er-k"
                  type="number" min={1} max={50} value={k}
                  onChange={(e) => updateParam("k", e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
              <div className="flex-1">
                <label htmlFor="er-threshold" className="mb-1 block text-xs font-medium text-gray-500">{t("entityResolution.threshold")}</label>
                <input
                  id="er-threshold"
                  type="number" step={0.01} min={0} max={1} value={threshold}
                  onChange={(e) => updateParam("threshold", e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
            </div>

            {/* Tau sliders */}
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">{t("entityResolution.tauThresholds")}</div>
              <p className="text-xs text-gray-500">
                {t("entityResolution.tauDescription")}
              </p>
              <SliderControl label={t("entityResolution.tauOneToOne")} value={tauOneToOne} onChange={(v) => updateParam("tau1to1", String(v))} />
              <p className="text-xs text-gray-400">{t("entityResolution.tau1to1Description")}</p>
              <SliderControl label={t("entityResolution.tauOneToMany")} value={tauOneToMany} onChange={(v) => updateParam("tau1toN", String(v))} />
              <p className="text-xs text-gray-400">{t("entityResolution.tau1toNDescription")}</p>
              <SliderControl label={t("entityResolution.tauManyToOne")} value={tauManyToOne} onChange={(v) => updateParam("tauNto1", String(v))} />
              <p className="text-xs text-gray-400">{t("entityResolution.tauNto1Description")}</p>
            </div>

            {/* Blend slider */}
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">{t("entityResolution.distanceBlending")}</div>
              <SliderControl
                label={t("entityResolution.clusteringDocument")}
                value={blendAlpha}
                onChange={(v) => updateParam("blend", String(v))}
                format={(v) => `${Math.round(v * 100)}% doc`}
              />
              {!hasClustering && candidates && (
                <p className="text-xs text-amber-600">{t("entityResolution.clusteringNotAvailable")}</p>
              )}
            </div>

            {/* Lexical sliders */}
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">{t("entityResolution.lexicalBoost")}</div>
              <p className="text-xs text-gray-500">
                {t("entityResolution.lexicalBoostDescription")}
              </p>
              <SliderControl
                label={t("entityResolution.jaccardBoost")}
                value={jaccardWeight}
                onChange={(v) => updateParam("jaccard", String(v))}
                format={(v) => `${Math.round(v * 100)}%`}
              />
              <p className="text-xs text-gray-400">
                {t("entityResolution.jaccardDescription")}
              </p>
              <SliderControl
                label={t("entityResolution.rareTokenBoost")}
                value={rareTokenWeight}
                onChange={(v) => updateParam("rareToken", String(v))}
                format={(v) => `${Math.round(v * 100)}%`}
              />
              <p className="text-xs text-gray-400">
                {t("entityResolution.rareTokenDescription")}
              </p>
            </div>

            {/* Presets */}
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => applyPreset("loose")} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">{t("entityResolution.loose")}</button>
              <button type="button" onClick={() => applyPreset("balanced")} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">{t("entityResolution.balanced")}</button>
              <button type="button" onClick={() => applyPreset("strict")} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">{t("entityResolution.strict")}</button>
              <button type="button" onClick={() => applyPreset("lexical")} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">{t("entityResolution.lexical")}</button>
            </div>

            {/* Load candidates + demo */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleLoadCandidates}
                disabled={candidatesLoading}
                className="flex-1 rounded-md bg-dfrntBlue-500 px-4 py-2 text-sm font-medium text-white hover:bg-dfrntBlue-400 disabled:bg-gray-300"
              >
                {candidatesLoading ? `${t("common.loading")} ${loadElapsed}s` : candidates ? t("entityResolution.reloadCandidates") : t("entityResolution.loadCandidates")}
              </button>
              <button
                type="button"
                onClick={() => {
                  const demo = generateDemoCandidates();
                  dispatch(setCandidates(demo));
                  const scores = computeLexicalScores(demo.set_to_target, demo.target_to_set);
                  dispatch(setLexicalScores(scores));
                  dispatch(setCandidatesError(null));
                }}
                className="rounded-md border border-gray-300 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
                title={t("entityResolution.demoTooltip")}
              >
                {t("entityResolution.demo")}
              </button>
            </div>

            {candidatesError && (
              <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">{candidatesError}</div>
            )}

            {candidates && (
              <div className="text-xs text-gray-500">
                {candidates.stats.set_points} {t("entityResolution.set")} · {candidates.stats.target_points} {t("entityResolution.target")} · {candidates.stats.set_to_target_edges} {t("entityResolution.edges")}
              </div>
            )}

            {/* Save trial */}
            {resolveResult && matchStats && (
              <div className="space-y-2 border-t border-gray-200 pt-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">{t("entityResolution.saveTrial")}</div>
                <input
                  type="text"
                  value={trialLabel}
                  onChange={(e) => setTrialLabel(e.target.value)}
                  placeholder={t("entityResolution.trialLabelOptional")}
                  className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                />
                <button
                  type="button"
                  onClick={handleSaveTrial}
                  className="w-full rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  {t("entityResolution.saveTrial")}
                </button>
                {saveSuccess && <div className="text-xs text-green-600">{t("entityResolution.trialSavedSuccessfully")}</div>}
                {saveError && <div className="text-xs text-red-600">{saveError}</div>}
              </div>
            )}
          </div>
        </div>

        {/* Right panel: Results */}
        <div className="flex-1 overflow-auto p-6">
          {!candidates && !candidatesLoading && (
            <div className="flex h-full items-center justify-center text-sm text-gray-500">
              {t("entityResolution.selectToBegin")}
            </div>
          )}

          {candidatesLoading && (
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-dfrntBlue-200 border-t-dfrntBlue-500" />
              <div className="text-sm font-medium text-gray-700">{t("entityResolution.loadingCandidates")}</div>
              <div className="text-xs text-gray-400">
                {t("entityResolution.elapsedFetching", { seconds: loadElapsed })}
                {loadElapsed > 10 && t("entityResolution.takingLonger")}
              </div>
            </div>
          )}

          {candidates && resolveResult && (
            <div className="space-y-4">
              {/* Metrics row */}
              <div className="flex items-center gap-6 rounded-lg border border-gray-200 bg-white p-4">
                {matchStats ? (
                  <>
                    <Gauge value={matchStats.f1} label={t("entityResolution.f1Score")} size="lg" />
                    <Gauge value={matchStats.precision} label={t("entityResolution.precision")} />
                    <Gauge value={matchStats.recall} label={t("entityResolution.recall")} />
                    <div className="flex-1" />
                    <div className="grid grid-cols-5 gap-3">
                      <div className="text-center">
                        <div className="text-lg font-semibold text-green-600">{matchStats.truePositives}</div>
                        <div className="text-xs text-gray-500">TP</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-red-600">{matchStats.falsePositives}</div>
                        <div className="text-xs text-gray-500">FP</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-orange-600">{matchStats.falseNegatives}</div>
                        <div className="text-xs text-gray-500">FN</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-gray-900">{matchStats.totalResolved}</div>
                        <div className="text-xs text-gray-500">{t("entityResolution.matched")}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-gray-900">{matchStats.totalPerfect}</div>
                        <div className="text-xs text-gray-500">{t("entityResolution.perfect")}</div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 text-center text-sm text-gray-500">
                    {t("entityResolution.uploadGroundTruthCSV")}
                  </div>
                )}
              </div>

              {/* Ground truth CSV upload */}
              <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
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
                  {t("entityResolution.uploadGroundTruthCSVButton")}
                </button>
                {csvFileName && <span className="text-xs text-gray-500">{csvFileName} ({perfectMatches?.length ?? 0} {t("entityResolution.matches")})</span>}
                {csvError && <span className="text-xs text-red-600">{csvError}</span>}
              </div>

              {/* Tab bar */}
              <div className="flex gap-1 border-b border-gray-200">
                {([
                  { id: "matches", label: t("entityResolution.matchesTab", { count: resolveResult.stats.total }) },
                  { id: "histogram", label: t("entityResolution.histogram") },
                  { id: "scatter", label: t("entityResolution.trialScatter") },
                  { id: "trials", label: t("entityResolution.savedTrialsTab", { count: trials.length }) },
                ] as const).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => dispatch(setResultsTab(tab.id))}
                    className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                      resultsTab === tab.id
                        ? "border-dfrntBlue-500 text-dfrntBlue-600"
                        : "border-transparent text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              {resultsTab === "matches" && (
                <div className="space-y-3">
                  {/* Filters */}
                  <div className="flex items-center gap-3 text-xs">
                    <select
                      value={stageFilter}
                      onChange={(e) => dispatch(setStageFilter(e.target.value as StageFilter))}
                      className="rounded-md border border-gray-300 px-2 py-1 text-xs"
                    >
                      <option value="all">{t("entityResolution.allStages")}</option>
                      <option value="core">{t("entityResolution.core")}</option>
                      <option value="set_extra">{t("entityResolution.setExtra")}</option>
                      <option value="target_extra">{t("entityResolution.targetExtra")}</option>
                    </select>
                    <select
                      value={sortBy}
                      onChange={(e) => dispatch(setSortBy(e.target.value as SortBy))}
                      className="rounded-md border border-gray-300 px-2 py-1 text-xs"
                    >
                      <option value="effective">{t("entityResolution.sortEffectiveDist")}</option>
                      <option value="distance">{t("entityResolution.sortEmbeddingDist")}</option>
                      <option value="lexical">{t("entityResolution.sortLexicalScore")}</option>
                      <option value="setId">{t("entityResolution.sortSetId")}</option>
                      <option value="targetId">{t("entityResolution.sortTargetId")}</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => dispatch(setSortDir(sortDir === "asc" ? "desc" : "asc"))}
                      className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                    >
                      {sortDir === "asc" ? t("entityResolution.asc") : t("entityResolution.desc")}
                    </button>
                    <span className="text-gray-400">
                      {resolveResult.stats.core} {t("entityResolution.core")} · {resolveResult.stats.setExtra} {t("entityResolution.setExtra")} · {resolveResult.stats.targetExtra} {t("entityResolution.targetExtra")}
                    </span>
                  </div>

                  {/* Matches table */}
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-xs font-medium text-gray-500">
                        <tr>
                          <th className="px-3 py-2 text-left">{t("entityResolution.setId")}</th>
                          <th className="px-3 py-2 text-left">{t("entityResolution.targetId")}</th>
                          <th className="px-3 py-2 text-right">{t("entityResolution.embedDist")}</th>
                          <th className="px-3 py-2 text-center">{t("entityResolution.lexical")}</th>
                          <th className="px-3 py-2 text-right">{t("entityResolution.effective")}</th>
                          <th className="px-3 py-2 text-center">{t("entityResolution.stage")}</th>
                          <th className="px-3 py-2 text-right">{t("entityResolution.actions")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredMatches.slice(0, 200).map((m, i) => {
                          const lex = lexicalScores?.get(`${normalizeId(m.set_id)}\u0000${normalizeId(m.target_id)}`);
                          const boosted = lex && (lex.jaccardWeighted > 0 || lex.rareTokenScore > 0) && (jaccardWeight > 0 || rareTokenWeight > 0);
                          return (
                            <tr key={i} className="hover:bg-gray-50">
                              <td className="cursor-pointer px-3 py-2 font-data text-xs text-gray-900" onClick={() => setPreviewId(m.set_id)}>{m.set_id}</td>
                              <td className="cursor-pointer px-3 py-2 font-data text-xs text-gray-900" onClick={() => setPreviewId(m.target_id)}>{m.target_id}</td>
                              <td className="px-3 py-2 text-right tabular-nums text-gray-600">{m.distance.toFixed(3)}</td>
                              <td className="px-3 py-2 text-center text-xs text-gray-500" title={lex?.sharedRareTokens.join(", ")}>
                                {lex ? `J:${lex.jaccardWeighted.toFixed(2)} R:${lex.rareTokenScore.toFixed(1)}` : "—"}
                              </td>
                              <td className={`px-3 py-2 text-right tabular-nums ${boosted ? "font-medium text-green-600" : "text-gray-600"}`}>
                                {m.effectiveDistance.toFixed(3)}
                              </td>
                              <td className="px-3 py-2 text-center">
                                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${stageColors[m.stage] ?? ""}`}>{m.stage}</span>
                              </td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setCompareIndex(i); }}
                                  className="rounded-md px-2 py-0.5 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                                >
                                  {t("entityResolution.compare")}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {filteredMatches.length > 200 && (
                      <div className="border-t border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-500">
                        {t("entityResolution.showingFirstN", { count: filteredMatches.length })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {resultsTab === "histogram" && (
                <div className="rounded-lg border border-gray-200 bg-white p-6">
                  <h3 className="mb-4 text-sm font-semibold text-gray-700">{t("entityResolution.distanceDistribution")}</h3>
                  <div className="flex items-end gap-2" style={{ height: 200 }}>
                    {histogramData.map((bucket, i) => {
                      const maxCount = Math.max(...histogramData.map((b) => b.matched + b.unmatched), 1);
                      const totalHeight = ((bucket.matched + bucket.unmatched) / maxCount) * 160;
                      const matchedHeight = (bucket.matched / Math.max(bucket.matched + bucket.unmatched, 1)) * totalHeight;
                      const unmatchedHeight = totalHeight - matchedHeight;
                      return (
                        <div key={i} className="flex flex-1 flex-col items-center gap-1">
                          <div className="flex w-full flex-col justify-end" style={{ height: 160 }}>
                            <div style={{ height: matchedHeight, backgroundColor: "#16a34a" }} className="w-full rounded-t" title={`${bucket.matched} matched`} />
                            <div style={{ height: unmatchedHeight, backgroundColor: "#d1d5db" }} className="w-full" title={`${bucket.unmatched} unmatched`} />
                          </div>
                          <span className="text-xs text-gray-400">{(i * 0.1).toFixed(1)}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-green-600" /> {t("entityResolution.matched")}</span>
                    <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-gray-300" /> {t("entityResolution.unmatched")}</span>
                  </div>
                  {/* Threshold lines */}
                  <div className="mt-4 flex gap-4 text-xs">
                    <span className="text-blue-600">τ 1:1 = {tauOneToOne.toFixed(2)}</span>
                    <span className="text-amber-600">τ 1:N = {tauOneToMany.toFixed(2)}</span>
                    <span className="text-purple-600">τ N:1 = {tauManyToOne.toFixed(2)}</span>
                  </div>
                </div>
              )}

              {resultsTab === "scatter" && (
                <div className="rounded-lg border border-gray-200 bg-white p-6">
                  <h3 className="mb-4 text-sm font-semibold text-gray-700">{t("entityResolution.trialScatterPrecisionRecall")}</h3>
                  {trials.length === 0 && !matchStats ? (
                    <p className="text-sm text-gray-500">{t("entityResolution.noSavedTrialsPlot")}</p>
              ) : (
                    <svg viewBox="0 0 400 400" className="w-full max-w-md">
                      {/* Axes */}
                      <line x1="40" y1="10" x2="40" y2="380" stroke="#e5e7eb" strokeWidth="1" />
                      <line x1="40" y1="380" x2="390" y2="380" stroke="#e5e7eb" strokeWidth="1" />
                      <text x="20" y="200" transform="rotate(-90 20 200)" textAnchor="middle" className="fill-gray-400 text-xs">{t("entityResolution.recall")}</text>
                      <text x="215" y="398" textAnchor="middle" className="fill-gray-400 text-xs">{t("entityResolution.precision")}</text>
                      {/* Grid lines */}
                      {[0, 0.25, 0.5, 0.75, 1].map((v) => (
                        <g key={v}>
                          <line x1="40" y1={380 - v * 370} x2="390" y2={380 - v * 370} stroke="#f3f4f6" strokeWidth="0.5" />
                          <line x1={40 + v * 350} y1="10" x2={40 + v * 350} y2="380" stroke="#f3f4f6" strokeWidth="0.5" />
                        </g>
                      ))}
                      {/* Trial points */}
                      {trials.map((trial, i) => {
                        const cx = 40 + trial.metrics.precision * 350;
                        const cy = 380 - trial.metrics.recall * 370;
                        const f1Pct = Math.round(trial.metrics.f1 * 100);
                        const color = f1Pct >= 85 ? "#16a34a" : f1Pct >= 70 ? "#ca8a04" : "#dc2626";
                        const r = 4 + Math.min(8, trial.metrics.totalMatched / 100);
                        return (
                          <g key={i}>
                            <circle cx={cx} cy={cy} r={r} fill={color} opacity="0.7" />
                            <title>{`${trial.label ?? t("entityResolution.trialN", { n: i + 1 })}\nF1: ${trial.metrics.f1.toFixed(3)}\nP: ${trial.metrics.precision.toFixed(3)}\nR: ${trial.metrics.recall.toFixed(3)}`}</title>
                          </g>
                        );
                      })}
                      {/* Current unsaved trial */}
                      {matchStats && (
                        <circle
                          cx={40 + matchStats.precision * 350}
                          cy={380 - matchStats.recall * 370}
                          r={6}
                          fill="none"
                          stroke="#2563eb"
                          strokeWidth="2"
                        >
                          <title>{t("entityResolution.currentUnsaved")}</title>
                        </circle>
                      )}
                    </svg>
                  )}
                </div>
              )}

              {resultsTab === "trials" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-700">{t("entityResolution.savedTrials")}</h3>
                    <button
                      type="button"
                      onClick={() => {
                        const blob = new Blob([JSON.stringify(trials, null, 2)], { type: "application/json" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = "er-trials.json";
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                    >
                      {t("entityResolution.exportAll")}
                    </button>
                  </div>
                  {trials.length === 0 ? (
                    <p className="text-sm text-gray-500">{t("entityResolution.noSavedTrialsYet")}</p>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-xs font-medium text-gray-500">
                          <tr>
                            <th className="px-3 py-2 text-left">{t("entityResolution.label")}</th>
                            <th className="px-3 py-2 text-left">{t("entityResolution.timestamp")}</th>
                            <th className="px-3 py-2 text-right">F1</th>
                            <th className="px-3 py-2 text-right">{t("entityResolution.precision")}</th>
                            <th className="px-3 py-2 text-right">{t("entityResolution.recall")}</th>
                            <th className="px-3 py-2 text-right">{t("entityResolution.threshold")}</th>
                            <th className="px-3 py-2 text-right">τ1:1</th>
                            <th className="px-3 py-2 text-right">τ1:N</th>
                            <th className="px-3 py-2 text-right">τN:1</th>
                            <th className="px-3 py-2 text-right">{t("entityResolution.blend")}</th>
                            <th className="px-3 py-2 text-right">{t("entityResolution.jaccard")}</th>
                            <th className="px-3 py-2 text-right">{t("entityResolution.rare")}</th>
                            <th className="px-3 py-2 text-right">{t("entityResolution.actions")}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {trials.map((trial, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                              <td className="px-3 py-2 text-xs text-gray-900">{trial.label ?? t("entityResolution.trialN", { n: i + 1 })}</td>
                              <td className="px-3 py-2 text-xs text-gray-500">{trial.timestamp.slice(0, 19)}</td>
                              <td className="px-3 py-2 text-right tabular-nums text-xs">{(trial.metrics.f1 * 100).toFixed(1)}%</td>
                              <td className="px-3 py-2 text-right tabular-nums text-xs">{(trial.metrics.precision * 100).toFixed(1)}%</td>
                              <td className="px-3 py-2 text-right tabular-nums text-xs">{(trial.metrics.recall * 100).toFixed(1)}%</td>
                              <td className="px-3 py-2 text-right tabular-nums text-xs">{trial.params.threshold.toFixed(2)}</td>
                              <td className="px-3 py-2 text-right tabular-nums text-xs">{trial.params.tauOneToOne.toFixed(2)}</td>
                              <td className="px-3 py-2 text-right tabular-nums text-xs">{trial.params.tauOneToMany.toFixed(2)}</td>
                              <td className="px-3 py-2 text-right tabular-nums text-xs">{trial.params.tauManyToOne.toFixed(2)}</td>
                              <td className="px-3 py-2 text-right tabular-nums text-xs">{trial.params.blendAlpha.toFixed(2)}</td>
                              <td className="px-3 py-2 text-right tabular-nums text-xs">{trial.params.jaccardWeight.toFixed(2)}</td>
                              <td className="px-3 py-2 text-right tabular-nums text-xs">{trial.params.rareTokenWeight.toFixed(2)}</td>
                              <td className="px-3 py-2 text-right">
                                <button type="button" onClick={() => handleLoadTrial(trial)} className="rounded-md px-2 py-0.5 text-xs font-medium text-dfrntBlue-600 hover:bg-dfrntBlue-50">{t("common.load")}</button>
                                <button type="button" onClick={() => handleDeleteTrial(trial.timestamp)} className="ml-1 rounded-md px-2 py-0.5 text-xs font-medium text-red-500 hover:bg-red-50">{t("common.delete")}</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {previewId && (
        <DocumentPreviewModal
          documentId={previewId}
          docData={Array.isArray(previewDoc) ? previewDoc[0] : previewDoc}
          onClose={() => setPreviewId(null)}
          onOpenFull={() => navigateToDoc(previewId)}
        />
      )}

      {compareIndex !== null && filteredMatches.length > 0 && (
        <MatchComparisonModal
          matches={filteredMatches as unknown as ReadonlyArray<{ set_id: string; target_id: string; distance: number; stage: string; [key: string]: unknown }>}
          initialIndex={compareIndex}
          docPath={docPath}
          onClose={() => setCompareIndex(null)}
          onOpenFull={(id) => navigateToDoc(id)}
        />
      )}
    </PageShell>
  );
};
