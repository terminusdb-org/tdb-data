import { baseApi } from "../baseApi";

export interface IndexerInfo {
  readonly backend: string;
  readonly configured: boolean;
  readonly available: boolean;
}

export interface ServerInfo {
  readonly authority: string;
  readonly edition: string;
  readonly http_engine: string;
  readonly indexer?: IndexerInfo;
  readonly terminusdb?: { readonly version: string; readonly git_hash: string };
  readonly terminusdb_store?: { readonly version: string };
  readonly storage?: { readonly version: string };
}

export const infoApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getInfo: builder.query<ServerInfo, void>({
      query: () => "/api/info",
      transformResponse: (raw: unknown): ServerInfo => {
        const resp = raw as Record<string, unknown>;
        const info = (resp["api:info"] as ServerInfo) ?? (raw as ServerInfo);
        return info;
      },
    }),
  }),
});

export const { useGetInfoQuery } = infoApi;
