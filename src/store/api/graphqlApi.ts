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

    graphqlDocumentCount: builder.query<
      Record<string, number>,
      { path: string; types: string[] }
    >({
      query: (params) => {
        const fields = params.types
          .map(
            (type, i) =>
              `t${i}: _count(${type}:{})`
          )
          .join(" ");
        return {
          url: params.path,
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: { query: `{ ${fields} }` },
        };
      },
      transformResponse: (response: { data?: Record<string, number> }) =>
        response.data ?? {},
    }),
  }),
});

export const { useRunGraphqlMutation, useGraphqlDocumentCountQuery } = graphqlApi;
