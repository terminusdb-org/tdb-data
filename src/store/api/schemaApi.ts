import { baseApi } from "../baseApi";
import type { SchemaClass, Frame } from "@/types/terminusdb";

export const schemaApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getSchema: builder.query<SchemaClass[], { path: string; asList?: boolean }>({
      query: (params) => {
        const searchParams = new URLSearchParams();
        searchParams.set("graph_type", "schema");
        if (params.asList) searchParams.set("as_list", "true");
        searchParams.set("compress_ids", "true");
        return `${params.path}?${searchParams.toString()}`;
      },
      transformResponse: (response: Record<string, unknown>): SchemaClass[] => {
        const classes: SchemaClass[] = [];
        for (const [key, value] of Object.entries(response)) {
          if (key === "@context") {
            classes.push({ "@id": "@context", ...(value as Record<string, unknown>) } as SchemaClass);
            continue;
          }
          if (typeof value === "object" && value !== null) {
            const cls = value as Record<string, unknown>;
            classes.push({
              "@id": key,
              "@type": (cls["@type"] as string) ?? "Class",
              ...cls,
            });
          }
        }
        return classes;
      },
      providesTags: ["Schema"],
    }),

    getFrame: builder.query<Frame, { path: string; type?: string }>({
      query: (params) => {
        const searchParams = new URLSearchParams();
        searchParams.set("type", params.type ?? "all");
        searchParams.set("compress_ids", "true");
        searchParams.set("expand_abstract", "true");
        return `${params.path}?${searchParams.toString()}`;
      },
      providesTags: ["Frame"],
    }),

    getPrefixes: builder.query<unknown, { path: string }>({
      query: (params) => {
        const searchParams = new URLSearchParams();
        searchParams.set("graph_type", "schema");
        searchParams.set("compress_ids", "true");
        return `${params.path}?${searchParams.toString()}`;
      },
      providesTags: ["Prefixes"],
    }),

    replaceSchema: builder.mutation<
      unknown,
      { path: string; schema: SchemaClass[]; author: string; message: string }
    >({
      query: (params) => {
        const docPath = params.path.replace("/api/schema/", "/api/document/");
        return {
          url: `${docPath}?author=${encodeURIComponent(params.author)}&message=${encodeURIComponent(params.message)}&graph_type=schema&full_replace=true`,
          method: "POST",
          body: params.schema,
        };
      },
      invalidatesTags: ["Schema", "Frame"],
    }),

    replaceSchemaDocument: builder.mutation<
      unknown,
      { path: string; id: string; document: SchemaClass; author: string; message: string }
    >({
      query: (params) => ({
        url: `${params.path}?author=${encodeURIComponent(params.author)}&message=${encodeURIComponent(params.message)}&graph_type=schema&id=${encodeURIComponent(params.id)}`,
        method: "PUT",
        body: params.document,
      }),
      invalidatesTags: ["Schema", "Frame"],
    }),

    insertSchemaDocument: builder.mutation<
      unknown,
      { path: string; document: SchemaClass; author: string; message: string }
    >({
      query: (params) => ({
        url: `${params.path}?author=${encodeURIComponent(params.author)}&message=${encodeURIComponent(params.message)}&graph_type=schema`,
        method: "POST",
        body: params.document,
      }),
      invalidatesTags: ["Schema", "Frame"],
    }),

    deleteSchemaDocument: builder.mutation<
      unknown,
      { path: string; id: string; author: string; message: string }
    >({
      query: (params) => ({
        url: `${params.path}?author=${encodeURIComponent(params.author)}&message=${encodeURIComponent(params.message)}&graph_type=schema&id=${encodeURIComponent(params.id)}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Schema", "Frame"],
    }),

    replaceContext: builder.mutation<
      unknown,
      { path: string; context: Record<string, unknown>; author: string; message: string }
    >({
      query: (params) => ({
        url: `${params.path}?author=${encodeURIComponent(params.author)}&message=${encodeURIComponent(params.message)}&graph_type=schema&id=@context`,
        method: "PUT",
        body: params.context,
      }),
      invalidatesTags: ["Schema", "Prefixes"],
    }),
  }),
});

export const {
  useGetSchemaQuery,
  useGetFrameQuery,
  useGetPrefixesQuery,
  useReplaceSchemaMutation,
  useReplaceSchemaDocumentMutation,
  useInsertSchemaDocumentMutation,
  useDeleteSchemaDocumentMutation,
  useReplaceContextMutation,
} = schemaApi;
