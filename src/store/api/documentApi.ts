import { baseApi } from "../baseApi";
import type { EditableDocument, TerminusDBDocument } from "@/types/terminusdb";
import { normalizeDocId } from "@/utils/validation";
// Server ids are literal strings (e.g. "Person/Kurt%20G%C3%B6del") — never
// decode them in-app. On the wire the "/" separators stay literal and only
// the segments are encoded: use normalizeDocId, not encodeURIComponent.

export interface GetDocumentsParams {
  readonly path: string;
  readonly graphType?: "instance" | "schema";
  readonly type?: string;
  readonly id?: string;
  readonly skip?: number;
  readonly count?: number;
  readonly asList?: boolean;
  readonly minimized?: boolean;
  readonly unfold?: boolean;
  readonly rawJson?: boolean;
}

export const documentApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getDocuments: builder.query<TerminusDBDocument[] | TerminusDBDocument, GetDocumentsParams>({
      query: (params) => {
        const searchParams = new URLSearchParams();
        if (params.graphType) searchParams.set("graph_type", params.graphType);
        if (params.type) searchParams.set("type", params.type);
        if (params.skip !== undefined) searchParams.set("skip", String(params.skip));
        if (params.count !== undefined) searchParams.set("count", String(params.count));
        if (params.asList) searchParams.set("as_list", "true");
        if (params.minimized !== undefined) searchParams.set("minimized", String(params.minimized));
        if (params.unfold !== undefined) searchParams.set("unfold", String(params.unfold));
        if (params.rawJson) searchParams.set("raw_json", "true");
        searchParams.set("compress_ids", "true");
        const qs = [searchParams.toString(), params.id ? `id=${normalizeDocId(params.id)}` : ""]
          .filter(Boolean)
          .join("&");
        return qs ? `${params.path}?${qs}` : params.path;
      },
      providesTags: (result, _error, params) => {
        if (!result) return [{ type: "Document" as const, id: params.path }];
        if (Array.isArray(result)) {
          return result.map((doc) => ({ type: "Document" as const, id: doc["@id"] }));
        }
        return [{ type: "Document" as const, id: result["@id"] }];
      },
    }),

    getDocument: builder.query<TerminusDBDocument, { path: string; id: string; graphType?: "instance" | "schema" }>({
      query: (params) => {
        const searchParams = new URLSearchParams();
        if (params.graphType) searchParams.set("graph_type", params.graphType);
        searchParams.set("compress_ids", "true");
        return `${params.path}?id=${normalizeDocId(params.id)}&${searchParams.toString()}`;
      },
      providesTags: (_result, _error, params) => [{ type: "Document", id: params.id }],
    }),

    getEmbeddingText: builder.query<string, { path: string; id: string }>({
      query: (params) => {
        const searchParams = new URLSearchParams();
        searchParams.set("format", "embedding");
        searchParams.set("compress_ids", "true");
        return {
          url: `${params.path}?id=${normalizeDocId(params.id)}&${searchParams.toString()}`,
          responseHandler: (response: Response) => response.text(),
        };
      },
      providesTags: (_result, _error, params) => [{ type: "Document", id: `embedding-${params.id}` }],
    }),

    getMarkdownText: builder.query<string, { path: string; id: string }>({
      query: (params) => {
        const searchParams = new URLSearchParams();
        searchParams.set("format", "markdown");
        searchParams.set("compress_ids", "true");
        return {
          url: `${params.path}?id=${normalizeDocId(params.id)}&${searchParams.toString()}`,
          responseHandler: (response: Response) => response.text(),
        };
      },
      providesTags: (_result, _error, params) => [{ type: "Document", id: `markdown-${params.id}` }],
    }),

    replaceDocument: builder.mutation<
      unknown,
      { path: string; id: string; document: EditableDocument; author: string; message: string }
    >({
      query: (params) => ({
        url: `${params.path}?id=${normalizeDocId(params.id)}&author=${encodeURIComponent(params.author)}&message=${encodeURIComponent(params.message)}&graph_type=instance`,
        method: "PUT",
        body: params.document,
      }),
      invalidatesTags: (_result, _error, params) => [{ type: "Document", id: params.id }],
    }),

    replaceRawJsonDocument: builder.mutation<
      unknown,
      { path: string; id: string; document: TerminusDBDocument; author: string; message: string }
    >({
      query: (params) => ({
        url: `${params.path}?id=${normalizeDocId(params.id)}&author=${encodeURIComponent(params.author)}&message=${encodeURIComponent(params.message)}&graph_type=instance&raw_json=true`,
        method: "PUT",
        body: params.document,
      }),
      invalidatesTags: (_result, _error, params) => [{ type: "Document", id: params.id }],
    }),

    insertDocument: builder.mutation<
      unknown,
      { path: string; document: EditableDocument; author: string; message: string }
    >({
      query: (params) => ({
        url: `${params.path}?author=${encodeURIComponent(params.author)}&message=${encodeURIComponent(params.message)}&graph_type=instance`,
        method: "POST",
        body: params.document,
      }),
      invalidatesTags: ["Document"],
    }),

    insertRawJsonDocument: builder.mutation<
      unknown,
      { path: string; document: TerminusDBDocument; author: string; message: string }
    >({
      query: (params) => ({
        url: `${params.path}?author=${encodeURIComponent(params.author)}&message=${encodeURIComponent(params.message)}&graph_type=instance&raw_json=true`,
        method: "POST",
        body: params.document,
      }),
      invalidatesTags: ["Document"],
    }),

    deleteDocument: builder.mutation<
      unknown,
      { path: string; id: string; author: string; message: string }
    >({
      query: (params) => ({
        url: `${params.path}?id=${normalizeDocId(params.id)}&author=${encodeURIComponent(params.author)}&message=${encodeURIComponent(params.message)}&graph_type=instance`,
        method: "DELETE",
      }),
      invalidatesTags: ["Document"],
    }),
  }),
});

export const {
  useGetDocumentsQuery,
  useGetDocumentQuery,
  useGetEmbeddingTextQuery,
  useGetMarkdownTextQuery,
  useReplaceDocumentMutation,
  useReplaceRawJsonDocumentMutation,
  useInsertDocumentMutation,
  useInsertRawJsonDocumentMutation,
  useDeleteDocumentMutation,
} = documentApi;
