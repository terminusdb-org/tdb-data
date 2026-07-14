import { baseApi } from "../baseApi";
import type { IndexStatus } from "@/types/terminusdb";

export const indexApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getIndexStatus: builder.query<IndexStatus, { path: string }>({
      query: (params) => params.path,
    }),

    triggerIndex: builder.mutation<
      { status: string; message?: string },
      { path: string }
    >({
      query: (params) => ({
        url: params.path,
        method: "POST",
      }),
    }),

    deleteIndex: builder.mutation<
      { status: string; message?: string },
      { path: string }
    >({
      query: (params) => ({
        url: params.path,
        method: "DELETE",
      }),
    }),
  }),
});

export const {
  useGetIndexStatusQuery,
  useTriggerIndexMutation,
  useDeleteIndexMutation,
} = indexApi;
