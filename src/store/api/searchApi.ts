import { baseApi } from "../baseApi";
import type { SearchHit, SuggestResponse, SearchStats, DuplicatesResponse, ResolveResponse, CompareResponse, CandidatesResult } from "@/types/terminusdb";
// Hit ids are server literals (possibly percent-encoded IRI fragments) —
// keep them verbatim; they are re-encoded on egress.

export interface SearchParams {
  readonly path: string;
  readonly query: string;
  readonly count?: number;
  readonly snippet?: boolean;
}

export interface SuggestParams {
  readonly path: string;
  readonly query: string;
  readonly count?: number;
}

export interface SimilarParams {
  readonly path: string;
  readonly id?: string;
  readonly text?: string;
  readonly count?: number;
  readonly snippet?: boolean;
}

export interface DuplicatesParams {
  readonly path: string;
  readonly threshold?: number;
  readonly count?: number;
  readonly snippet?: boolean;
  readonly docTypes?: readonly string[];
  readonly docIds?: readonly string[];
  readonly targetDocTypes?: readonly string[];
  readonly targetDocIds?: readonly string[];
}

export interface ResolveParams {
  readonly path: string;
  readonly body: {
    readonly set_doc_ids?: string[];
    readonly set_doc_types?: string[];
    readonly target_doc_ids?: string[];
    readonly target_doc_types?: string[];
    readonly threshold?: number;
    readonly tau_one_to_one?: number;
    readonly tau_one_to_many?: number;
    readonly tau_many_to_one?: number;
    readonly k?: number;
  };
}

export interface CompareParams {
  readonly method: string;
  readonly role?: string;
  readonly source: string;
  readonly target: string;
}

export const searchApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    search: builder.query<SearchHit[], SearchParams>({
      query: (params) => {
        const sp = new URLSearchParams();
        sp.set("q", params.query);
        if (params.count) sp.set("count", String(params.count));
        if (params.snippet) sp.set("snippet", "true");
        return `${params.path}?${sp.toString()}`;
      },
    }),

    suggest: builder.query<SuggestResponse, SuggestParams>({
      query: (params) => {
        const sp = new URLSearchParams();
        sp.set("q", params.query);
        sp.set("count", String(params.count ?? 10));
        return `${params.path}?${sp.toString()}`;
      },
    }),

    similar: builder.query<SearchHit[], SimilarParams>({
      query: (params) => {
        const sp = new URLSearchParams();
        if (params.id) sp.set("id", params.id);
        if (params.count) sp.set("count", String(params.count));
        if (params.snippet) sp.set("snippet", "true");
        if (params.text) {
          return {
            url: `${params.path}?${sp.toString()}`,
            method: "POST",
            body: { text: params.text },
          };
        }
        return `${params.path}?${sp.toString()}`;
      },
    }),

    duplicates: builder.query<DuplicatesResponse, DuplicatesParams>({
      query: (params) => {
        const parts: string[] = [];
        if (params.threshold) parts.push(`threshold=${params.threshold}`);
        if (params.count) parts.push(`count=${params.count}`);
        if (params.snippet) parts.push("snippet=true");
        for (const t of params.docTypes ?? []) parts.push(`doc_type=${encodeURIComponent(t)}`);
        for (const id of params.docIds ?? []) parts.push(`doc_id=${encodeURIComponent(id)}`);
        for (const t of params.targetDocTypes ?? []) parts.push(`target_doc_type=${encodeURIComponent(t)}`);
        for (const id of params.targetDocIds ?? []) parts.push(`target_doc_id=${encodeURIComponent(id)}`);
        const qs = parts.join("&");
        return qs ? `${params.path}?${qs}` : params.path;
      },
    }),

    resolve: builder.mutation<ResolveResponse, ResolveParams>({
      query: (params) => ({
        url: params.path,
        method: "POST",
        body: params.body,
      }),
    }),

    compare: builder.mutation<CompareResponse, CompareParams>({
      query: (params) => {
        const sp = new URLSearchParams();
        sp.set("method", params.method);
        if (params.role) sp.set("role", params.role);
        return {
          url: `/api/compare?${sp.toString()}`,
          method: "POST",
          body: { source: params.source, target: params.target },
        };
      },
    }),

    searchStats: builder.query<SearchStats, { path: string }>({
      query: (params) => `/api/statistics/${params.path}`,
    }),

    candidates: builder.mutation<CandidatesResult, CandidatesParams>({
      query: (params) => ({
        url: params.path,
        method: "POST",
        body: params.body,
      }),
    }),
  }),
});

export interface CandidatesParams {
  readonly path: string;
  readonly body: {
    readonly set_doc_types?: string[];
    readonly target_doc_types?: string[];
    readonly set_doc_ids?: string[];
    readonly target_doc_ids?: string[];
    readonly k?: number;
    readonly threshold_set?: number;
    readonly threshold_target?: number;
    readonly include?: string;
  };
}

export const {
  useSearchQuery,
  useSuggestQuery,
  useSimilarQuery,
  useDuplicatesQuery,
  useResolveMutation,
  useCompareMutation,
  useSearchStatsQuery,
  useCandidatesMutation,
} = searchApi;
