import { baseApi } from "../baseApi";

export const graphqlApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    runGraphql: builder.mutation<unknown, { path: string; query: string; variables?: Record<string, unknown> }>({
      query: (params) => ({
        url: params.path,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: {
          query: params.query,
          variables: params.variables ?? {},
        },
      }),
    }),
  }),
});

export const { useRunGraphqlMutation } = graphqlApi;
