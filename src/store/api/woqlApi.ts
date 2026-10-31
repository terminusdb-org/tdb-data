import { baseApi } from "../baseApi";
import type { WoqlResponse } from "@/types/terminusdb";

export interface WoqlParams {
  readonly path: string;
  readonly query: Record<string, unknown>;
}

export const woqlApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    runWoql: builder.mutation<WoqlResponse, WoqlParams>({
      query: (params) => ({
        url: params.path,
        method: "POST",
        body: { query: params.query },
      }),
    }),

  }),
});

export const { useRunWoqlMutation } = woqlApi;
