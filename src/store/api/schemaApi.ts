import { baseApi } from "../baseApi";
import type { SchemaClass, Frame } from "@/types/terminusdb";

const SCHEMA_RESERVED_KEYS = new Set([
  "@id", "@type", "@key", "@base", "@inherits", "@documentation",
  "@subdocument", "@abstract", "@unfoldable", "@unfold", "@shared",
  "@metadata", "@oneOf", "@cardinality", "@min_cardinality",
  "@max_cardinality", "@dimensions", "@class",
]);

function normalizeSchemaClass(cls: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(cls)) {
    if (SCHEMA_RESERVED_KEYS.has(key)) {
      result[key] = value;
      continue;
    }
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      const propObj = value as Record<string, unknown>;
      const normalized: Record<string, unknown> = {};
      for (const [propKey, propVal] of Object.entries(propObj)) {
        if (propKey === "@subdocument") continue;
        if (propKey === "@class" && typeof propVal === "object" && propVal !== null) {
          const inner = propVal as Record<string, unknown>;
          normalized["@class"] = inner["@class"] ?? inner["@id"] ?? JSON.stringify(propVal);
        } else {
          normalized[propKey] = propVal;
        }
      }
      result[key] = normalized;
    } else {
      result[key] = value;
    }
  }
  return result;
}

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
            const normalized = normalizeSchemaClass(cls);
            classes.push({
              "@id": key,
              "@type": (normalized["@type"] as string) ?? "Class",
              ...normalized,
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
