export interface ERTrial {
  readonly timestamp: string;
  readonly params: {
    readonly setDocType: string;
    readonly targetDocType: string;
    readonly k: number;
    readonly threshold: number;
    readonly tauOneToOne: number;
    readonly tauOneToMany: number;
    readonly tauManyToOne: number;
    readonly blendAlpha: number;
    readonly jaccardWeight: number;
    readonly rareTokenWeight: number;
  };
  readonly metrics: {
    readonly truePositives: number;
    readonly falsePositives: number;
    readonly falseNegatives: number;
    readonly precision: number;
    readonly recall: number;
    readonly f1: number;
    readonly totalMatched: number;
  };
  readonly label?: string;
}

export const TRIAL_DOC_ID = "er-plot/trials";

export interface TrialDocument {
  readonly "@id": string;
  readonly "@type": string;
  readonly trials: ERTrial[];
}

export function buildTrialEntry(
  params: ERTrial["params"],
  metrics: ERTrial["metrics"],
  label?: string,
): ERTrial {
  const ts = new Date().toISOString();
  return { timestamp: ts, params, metrics, label };
}

export function buildTrialDocument(trials: ERTrial[]): TrialDocument {
  return {
    "@id": TRIAL_DOC_ID,
    "@type": "er-plot",
    trials,
  };
}

export function trialsFromDocument(doc: Record<string, unknown>): ERTrial[] {
  if (doc["@type"] !== "er-plot") return [];
  const arr = doc.trials;
  if (!Array.isArray(arr)) return [];
  return arr.map((t) => ({
    timestamp: String(t.timestamp ?? ""),
    params: t.params as ERTrial["params"],
    metrics: t.metrics as ERTrial["metrics"],
    label: t.label as string | undefined,
  }));
}
