export interface TerminusDBDocument {
  readonly "@id": string;
  readonly "@type": string;
  readonly [key: string]: unknown;
}

export interface SchemaClass {
  readonly "@id": string;
  readonly "@type": string;
  readonly [key: string]: unknown;
}

export interface Frame {
  readonly [classId: string]: {
    readonly [field: string]: unknown;
  };
}

export interface Prefixes {
  readonly "@base": string;
  readonly "@schema": string;
  readonly [key: string]: string;
}

export interface SearchHit {
  readonly id: string;
  readonly distance: number;
  readonly doc_type?: string;
  readonly chunk?: {
    readonly snippet?: string;
    readonly [key: string]: unknown;
  };
  readonly [key: string]: unknown;
}

export interface DuplicateGroup {
  readonly group: ReadonlyArray<{
    readonly id: string;
    readonly snippet?: string;
  }>;
  readonly distance: number;
  readonly [key: string]: unknown;
}

export type DuplicatesResponse = ReadonlyArray<DuplicateGroup>;

export interface ResolveMatch {
  readonly set_id: string;
  readonly target_id: string;
  readonly distance: number;
  readonly stage: string;
  readonly [key: string]: unknown;
}

export interface ResolveResponse {
  readonly matched: ReadonlyArray<ResolveMatch>;
  readonly set_only: ReadonlyArray<unknown>;
  readonly target_only: ReadonlyArray<unknown>;
  readonly stats: {
    readonly k: number;
    readonly threshold: number;
    readonly [key: string]: unknown;
  };
  readonly [key: string]: unknown;
}

export interface CompareResponse {
  readonly distance: number;
  readonly source_role?: string;
  readonly target_role?: string;
  readonly [key: string]: unknown;
}

export interface SuggestResponse {
  readonly completions: string[];
  readonly hits: SuggestHit[];
  readonly total_approx: number;
  readonly served_commit?: string;
  readonly [key: string]: unknown;
}

export interface SuggestHit {
  readonly id: string;
  readonly distance: number;
  readonly doc_type?: string;
  readonly [key: string]: unknown;
}

export interface SearchStats {
  readonly domains?: number;
  readonly branches?: number;
  readonly indexed_commits?: number;
  readonly documents?: number;
  readonly chunks?: number;
  readonly pending_index_fragments?: number;
  readonly [key: string]: unknown;
}

export interface IndexStatus {
  readonly branch?: string;
  readonly status?: string;
  readonly error?: string | null;
  readonly last_indexed_commit?: string | null;
  readonly branch_processing?: {
    readonly commits_processed?: number;
    readonly current_commit?: string | null;
    readonly total_commits?: number;
    readonly upcoming_commit?: string | null;
  };
  readonly engine?: {
    readonly commits_received?: number;
    readonly pending_updates?: number;
    readonly processed_documents?: number;
    readonly documents_sent?: number;
    readonly searchable_documents?: number;
    readonly text_segments_indexed?: number;
    readonly total_documents?: number;
    readonly store_clustering?: boolean | null;
  };
  readonly [key: string]: unknown;
}

export interface WoqlResponse {
  readonly bindings?: ReadonlyArray<Record<string, unknown>>;
  readonly [key: string]: unknown;
}

export interface DataProductStats {
  readonly tripleCount: number | null;
  readonly storageSize: number | null;
  readonly typeCount: number | null;
  readonly documentCount: number | null;
  readonly rawJsonCount: number | null;
  readonly indexedCount: number | null;
}

export type PageSizes = 10 | 50 | 100 | 250 | 500 | 1000;

export const PAGE_SIZE_OPTIONS: ReadonlyArray<PageSizes> = [10, 50, 100, 250, 500, 1000];

export interface CandidateEntry {
  readonly id: string;
  readonly distance: number;
  readonly clustering_distance?: number;
  readonly embedding?: ReadonlyArray<number>;
  readonly content?: string;
}

export interface CandidatesResult {
  readonly set_to_target: Readonly<Record<string, ReadonlyArray<CandidateEntry>>>;
  readonly target_to_set: Readonly<Record<string, ReadonlyArray<CandidateEntry>>>;
  readonly stats: {
    readonly elapsed_ms: number;
    readonly set_points: number;
    readonly target_points: number;
    readonly set_to_target_edges: number;
    readonly target_to_set_edges: number;
  };
}

export interface EmbeddingsByTypeResponse {
  readonly doc_embeddings: Readonly<Record<string, ReadonlyArray<number>>>;
  readonly clustering_embeddings: Readonly<Record<string, ReadonlyArray<number>>>;
  readonly store_clustering: boolean;
  readonly served_commit: string;
}
