import { normalizeId } from "./lexical";
import type { CandidateEntry, LexicalScore } from "./lexical";

export type Stage = "core" | "set_extra" | "target_extra";

export interface ResolvedMatch {
  readonly set_id: string;
  readonly target_id: string;
  readonly distance: number;
  readonly effectiveDistance: number;
  readonly stage: Stage;
}

export interface ResolveOptions {
  readonly tauOneToOne: number;
  readonly tauOneToMany: number;
  readonly tauManyToOne: number;
  readonly blendAlpha: number;
  readonly jaccardWeight: number;
  readonly rareTokenWeight: number;
}

export interface ResolveStats {
  readonly core: number;
  readonly setExtra: number;
  readonly targetExtra: number;
  readonly total: number;
}

export interface ResolveResult {
  readonly matched: ReadonlyArray<ResolvedMatch>;
  readonly stats: ResolveStats;
}

export interface MatchStats {
  readonly truePositives: number;
  readonly falsePositives: number;
  readonly falseNegatives: number;
  readonly precision: number;
  readonly recall: number;
  readonly f1: number;
  readonly totalPerfect: number;
  readonly totalResolved: number;
}

function blendedDistance(
  docDistance: number,
  clusteringDistance: number | undefined,
  alpha: number,
): number {
  if (clusteringDistance === undefined) return docDistance;
  return alpha * docDistance + (1 - alpha) * clusteringDistance;
}

function effectiveDistance(
  blendedDist: number,
  lexical: LexicalScore | undefined,
  jaccardWeight: number,
  rareTokenWeight: number,
): number {
  if (!lexical) return blendedDist;
  const boost = jaccardWeight * lexical.jaccardWeighted + rareTokenWeight * lexical.rareTokenScore;
  if (boost === 0) return blendedDist;
  // Boost ceiling: up to 95% distance reduction for strong lexical matches.
  // Rare tokens are especially discriminative — a single shared rare token
  // is strong evidence of entity equivalence.
  return Math.max(0, blendedDist * (1 - 0.95 * Math.min(1, boost)));
}

interface Edge {
  readonly setId: string;
  readonly targetId: string;
  readonly blendedDist: number;
  readonly effectiveDist: number;
}

interface CandidateGraph {
  readonly edges: ReadonlyMap<string, Edge>;
  readonly setTopK: ReadonlyMap<string, ReadonlySet<string>>;
  readonly targetTopK: ReadonlyMap<string, ReadonlySet<string>>;
}

function pairKey(setId: string, targetId: string): string {
  return `${setId}::${targetId}`;
}

function buildCandidateGraph(
  setToTarget: Readonly<Record<string, ReadonlyArray<CandidateEntry>>>,
  targetToSet: Readonly<Record<string, ReadonlyArray<CandidateEntry>>>,
  k: number,
  threshold: number,
  options: ResolveOptions,
  lexicalScores: ReadonlyMap<string, LexicalScore> | undefined,
): CandidateGraph {
  const edges = new Map<string, Edge>();
  const setTopK = new Map<string, Set<string>>();
  const targetTopK = new Map<string, Set<string>>();

  const addEdge = (setId: string, targetId: string, docDistance: number, clusteringDistance: number | undefined) => {
    const nid = normalizeId(setId);
    const ntid = normalizeId(targetId);
    const blended = blendedDistance(docDistance, clusteringDistance, options.blendAlpha);
    const lex = lexicalScores?.get(`${nid}\u0000${ntid}`);
    const eff = effectiveDistance(blended, lex, options.jaccardWeight, options.rareTokenWeight);
    if (eff > threshold) return;
    const key = pairKey(nid, ntid);
    const existing = edges.get(key);
    if (!existing || eff < existing.effectiveDist) {
      edges.set(key, { setId: nid, targetId: ntid, blendedDist: blended, effectiveDist: eff });
    }
  };

  const topKSlice = (list: ReadonlyArray<CandidateEntry>) => list.slice(0, k);

  for (const [setId, neighbours] of Object.entries(setToTarget)) {
    const nid = normalizeId(setId);
    const members = new Set<string>();
    for (const n of topKSlice(neighbours)) {
      const nNid = normalizeId(n.id);
      members.add(nNid);
      addEdge(nid, nNid, n.distance, n.clustering_distance);
    }
    setTopK.set(nid, members);
  }

  for (const [targetId, neighbours] of Object.entries(targetToSet)) {
    const ntid = normalizeId(targetId);
    const members = new Set<string>();
    for (const n of topKSlice(neighbours)) {
      const nNid = normalizeId(n.id);
      members.add(nNid);
      addEdge(nNid, ntid, n.distance, n.clustering_distance);
    }
    targetTopK.set(ntid, members);
  }

  return { edges, setTopK, targetTopK };
}

function groundCore(graph: CandidateGraph, tauOneToOne: number): Edge[] {
  const bestBySet = new Map<string, Edge>();
  for (const edge of graph.edges.values()) {
    if (edge.effectiveDist > tauOneToOne) continue;
    const targetInSetTopK = graph.setTopK.get(edge.setId)?.has(edge.targetId) === true;
    const setInTargetTopK = graph.targetTopK.get(edge.targetId)?.has(edge.setId) === true;
    if (targetInSetTopK && setInTargetTopK) {
      const current = bestBySet.get(edge.setId);
      if (!current || edge.effectiveDist < current.effectiveDist ||
          (edge.effectiveDist === current.effectiveDist && edge.targetId < current.targetId)) {
        bestBySet.set(edge.setId, edge);
      }
    }
  }
  return [...bestBySet.values()];
}

function setExtras(graph: CandidateGraph, corePairs: Edge[], tauOneToMany: number): Edge[] {
  const coreKeys = new Set(corePairs.map((p) => pairKey(p.setId, p.targetId)));
  const extras: Edge[] = [];
  for (const edge of graph.edges.values()) {
    if (edge.effectiveDist > tauOneToMany) continue;
    const key = pairKey(edge.setId, edge.targetId);
    if (coreKeys.has(key)) continue;
    if (graph.setTopK.get(edge.setId)?.has(edge.targetId) !== true) continue;
    extras.push(edge);
  }
  return extras;
}

function targetExtras(graph: CandidateGraph, corePairs: Edge[], tauManyToOne: number): Edge[] {
  const coreKeys = new Set(corePairs.map((p) => pairKey(p.setId, p.targetId)));
  const extras: Edge[] = [];
  for (const edge of graph.edges.values()) {
    if (edge.effectiveDist > tauManyToOne) continue;
    const key = pairKey(edge.setId, edge.targetId);
    if (coreKeys.has(key)) continue;
    if (graph.targetTopK.get(edge.targetId)?.has(edge.setId) !== true) continue;
    extras.push(edge);
  }
  return extras;
}

const stageRank: Readonly<Record<Stage, number>> = Object.freeze({ core: 0, set_extra: 1, target_extra: 2 });

export function resolve(
  setToTarget: Readonly<Record<string, ReadonlyArray<CandidateEntry>>>,
  targetToSet: Readonly<Record<string, ReadonlyArray<CandidateEntry>>>,
  options: ResolveOptions,
  lexicalScores?: ReadonlyMap<string, LexicalScore>,
  k: number = 5,
): ResolveResult {
  const maxTau = Math.max(options.tauOneToOne, options.tauOneToMany, options.tauManyToOne);
  const graph = buildCandidateGraph(setToTarget, targetToSet, k, maxTau, options, lexicalScores);

  const corePairs = groundCore(graph, options.tauOneToOne);
  const setExtraPairs = setExtras(graph, corePairs, options.tauOneToMany);
  const targetExtraPairs = targetExtras(graph, corePairs, options.tauManyToOne);

  const matchedMap = new Map<string, { edge: Edge; stage: Stage }>();

  const addToMatched = (edge: Edge, stage: Stage) => {
    const key = pairKey(edge.setId, edge.targetId);
    const existing = matchedMap.get(key);
    if (!existing) {
      matchedMap.set(key, { edge, stage });
    } else {
      const existingRank = stageRank[existing.stage] ?? 99;
      const newRank = stageRank[stage] ?? 99;
      if (newRank < existingRank ||
          (newRank === existingRank && edge.effectiveDist < existing.edge.effectiveDist)) {
        matchedMap.set(key, { edge, stage });
      }
    }
  };

  for (const e of corePairs) addToMatched(e, "core");
  for (const e of setExtraPairs) addToMatched(e, "set_extra");
  for (const e of targetExtraPairs) addToMatched(e, "target_extra");

  const matched = [...matchedMap.values()].map(({ edge, stage }) => ({
    set_id: edge.setId,
    target_id: edge.targetId,
    distance: edge.blendedDist,
    effectiveDistance: edge.effectiveDist,
    stage,
  }));

  const coreCount = matched.filter((m) => m.stage === "core").length;
  const setExtraCount = matched.filter((m) => m.stage === "set_extra").length;
  const targetExtraCount = matched.filter((m) => m.stage === "target_extra").length;

  return {
    matched,
    stats: {
      core: coreCount,
      setExtra: setExtraCount,
      targetExtra: targetExtraCount,
      total: matched.length,
    },
  };
}

export function computeMatchStats(
  resolved: ReadonlyArray<ResolvedMatch>,
  perfect: ReadonlyArray<{ set_id: string; target_id: string }>,
): MatchStats {
  const perfectSet = new Set(perfect.map((m) => `${m.set_id}\u0000${m.target_id}`));
  const resolvedSet = new Set(resolved.map((m) => `${m.set_id}\u0000${m.target_id}`));
  let tp = 0;
  for (const key of resolvedSet) {
    if (perfectSet.has(key)) tp++;
  }
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
