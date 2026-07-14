import { baseApi } from "../baseApi";
import type { EmbeddingsByTypeResponse } from "@/types/terminusdb";

export interface EmbeddingsByTypeParams {
  readonly path: string;
  readonly docTypes?: ReadonlyArray<string>;
  readonly docIds?: ReadonlyArray<string>;
}

export function buildEmbeddingsByTypeQuery(params: EmbeddingsByTypeParams): string {
  const parts: string[] = [];
  for (const t of params.docTypes ?? []) parts.push(`doc_type=${encodeURIComponent(t)}`);
  for (const id of params.docIds ?? []) parts.push(`doc_id=${encodeURIComponent(id)}`);
  const qs = parts.join("&");
  const queryStr = qs ? "?" + qs : "";
  return params.path + queryStr;
}

export const projectionApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getEmbeddingsByType: builder.query<EmbeddingsByTypeResponse, EmbeddingsByTypeParams>({
      query: buildEmbeddingsByTypeQuery,
    }),
  }),
});

export const { useGetEmbeddingsByTypeQuery } = projectionApi;
