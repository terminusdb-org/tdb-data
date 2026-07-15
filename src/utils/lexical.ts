export interface CandidateEntry {
  readonly id: string;
  readonly distance: number;
  readonly clustering_distance?: number;
  readonly embedding?: ReadonlyArray<number>;
  readonly content?: string;
}

/**
 * Normalize a document ID to a full TerminusDB IRI.
 *
 * The search engine returns full IRIs as map keys (e.g.
 * `terminusdb:///data/Buy/207645242`) but partial IDs as neighbour
 * IDs (e.g. `Abt/35843`). This function ensures both forms resolve
 * to the same canonical IRI so that pair keys and lexical score
 * lookups are consistent across directions.
 */
export function normalizeId(id: string): string {
  if (id.startsWith("terminusdb:///")) return id;
  return `terminusdb:///data/${id}`;
}

export interface LexicalScore {
  readonly jaccard: number;
  readonly jaccardWeighted: number;
  readonly rareTokenScore: number;
  readonly sharedRareTokens: ReadonlyArray<string>;
}

interface CorpusStats {
  readonly documentCount: number;
  readonly tokenDocFrequency: ReadonlyMap<string, number>;
}

function tokenize(content: string): Set<string> {
  return new Set(
    content
      .toLowerCase()
      .replace(/[^\w\s-]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1),
  );
}

function buildCorpusStats(
  setToTarget: Readonly<Record<string, ReadonlyArray<CandidateEntry>>>,
  targetToSet: Readonly<Record<string, ReadonlyArray<CandidateEntry>>>,
): CorpusStats {
  const tokenDocFreq = new Map<string, number>();
  const seenDocs = new Set<string>();
  const docTokens = new Map<string, Set<string>>();

  const processDoc = (id: string, content: string | undefined) => {
    if (seenDocs.has(id) || !content) return;
    seenDocs.add(id);
    const tokens = tokenize(content);
    docTokens.set(id, tokens);
    for (const token of tokens) {
      tokenDocFreq.set(token, (tokenDocFreq.get(token) ?? 0) + 1);
    }
  };

  const contentMap = new Map<string, string>();
  for (const [, neighbours] of Object.entries(setToTarget)) {
    for (const n of neighbours) {
      if (n.content) contentMap.set(normalizeId(n.id), n.content);
    }
  }
  for (const [, neighbours] of Object.entries(targetToSet)) {
    for (const n of neighbours) {
      if (n.content) contentMap.set(normalizeId(n.id), n.content);
    }
  }

  for (const setId of Object.keys(setToTarget)) {
    processDoc(normalizeId(setId), contentMap.get(normalizeId(setId)));
  }
  for (const targetId of Object.keys(targetToSet)) {
    processDoc(normalizeId(targetId), contentMap.get(normalizeId(targetId)));
  }

  return { documentCount: seenDocs.size, tokenDocFrequency: tokenDocFreq };
}

function idf(token: string, corpus: CorpusStats): number {
  const df = corpus.tokenDocFrequency.get(token) ?? 0;
  if (df === 0) return 0;
  return Math.log(corpus.documentCount / df);
}

function jaccardSimilarity(setTokens: Set<string>, targetTokens: Set<string>): number {
  let intersection = 0;
  for (const t of setTokens) {
    if (targetTokens.has(t)) intersection++;
  }
  const unionSize = setTokens.size + targetTokens.size - intersection;
  if (unionSize === 0) return 0;
  return intersection / unionSize;
}

function weightedJaccard(
  setTokens: Set<string>,
  targetTokens: Set<string>,
  corpus: CorpusStats,
): number {
  let interWeight = 0;
  let unionWeight = 0;
  const unionTokens = new Set<string>([...setTokens, ...targetTokens]);
  for (const t of setTokens) {
    if (targetTokens.has(t)) interWeight += idf(t, corpus);
  }
  for (const t of unionTokens) {
    unionWeight += idf(t, corpus);
  }
  if (unionWeight === 0) return 0;
  return interWeight / unionWeight;
}

function computeRareTokenScore(
  setTokens: Set<string>,
  targetTokens: Set<string>,
  corpus: CorpusStats,
  rareThreshold: number = 5,
): { score: number; shared: string[] } {
  const isRare = (token: string): boolean => {
    const df = corpus.tokenDocFrequency.get(token) ?? 0;
    return df > 0 && df <= rareThreshold;
  };

  const setRare = [...setTokens].filter(isRare);
  if (setRare.length === 0) return { score: 0, shared: [] };

  const targetRareSet = new Set([...targetTokens].filter(isRare));
  const shared = setRare.filter((t) => targetRareSet.has(t));
  if (shared.length === 0) return { score: 0, shared: [] };

  // IDF-weighted rare token score: rarer tokens contribute more.
  // A token appearing in only 1 doc gets the maximum IDF weight.
  // Normalised by the sum of IDF weights of all rare tokens in the set,
  // so the score stays in [0, 1] but is biased toward very rare matches.
  let sharedIdfWeight = 0;
  let allRareIdfWeight = 0;
  for (const t of setRare) {
    const w = idf(t, corpus);
    allRareIdfWeight += w;
    if (targetRareSet.has(t)) sharedIdfWeight += w;
  }
  if (allRareIdfWeight === 0) return { score: shared.length / setRare.length, shared };
  return { score: sharedIdfWeight / allRareIdfWeight, shared };
}

export function computeLexicalScores(
  setToTarget: Readonly<Record<string, ReadonlyArray<CandidateEntry>>>,
  targetToSet: Readonly<Record<string, ReadonlyArray<CandidateEntry>>>,
): ReadonlyMap<string, LexicalScore> {
  const corpus = buildCorpusStats(setToTarget, targetToSet);
  const scores = new Map<string, LexicalScore>();
  const tokenCache = new Map<string, Set<string>>();

  const contentMap = new Map<string, string>();
  for (const [, neighbours] of Object.entries(setToTarget)) {
    for (const n of neighbours) {
      if (n.content) contentMap.set(normalizeId(n.id), n.content);
    }
  }
  for (const [, neighbours] of Object.entries(targetToSet)) {
    for (const n of neighbours) {
      if (n.content) contentMap.set(normalizeId(n.id), n.content);
    }
  }

  const getTokens = (id: string): Set<string> => {
    const nid = normalizeId(id);
    if (tokenCache.has(nid)) return tokenCache.get(nid)!;
    const tokens = tokenize(contentMap.get(nid) ?? "");
    tokenCache.set(nid, tokens);
    return tokens;
  };

  const rareThreshold = Math.min(5, Math.max(2, Math.floor(corpus.documentCount * 0.1)));

  for (const [setId, neighbours] of Object.entries(setToTarget)) {
    const nid = normalizeId(setId);
    const setTokens = getTokens(nid);
    for (const n of neighbours) {
      const nNid = normalizeId(n.id);
      const targetTokens = getTokens(nNid);
      const jac = jaccardSimilarity(setTokens, targetTokens);
      const wJac = weightedJaccard(setTokens, targetTokens, corpus);
      const { score: rareScore, shared } = computeRareTokenScore(setTokens, targetTokens, corpus, rareThreshold);
      scores.set(`${nid}\u0000${nNid}`, {
        jaccard: jac,
        jaccardWeighted: wJac,
        rareTokenScore: rareScore,
        sharedRareTokens: shared,
      });
    }
  }

  return scores;
}
