import { baseApi } from "../baseApi";
import { schemaApi } from "./schemaApi";
import type { MigrationOp } from "@/lib/schemaModel/migrationOps";

export interface MigrationResponse {
  readonly "@type": string;
  readonly "api:status"?: string;
  readonly schema_operations?: number;
  readonly instance_operations?: number;
}

// check=true returns HTTP 200 even for invalid documents — validity is in the body.
export interface CheckResponse {
  readonly "@type"?: string;
  readonly "api:valid"?: boolean;
  readonly "api:witnesses"?: unknown[];
  readonly "api:embedding"?: { "api:will_embed"?: boolean; "api:reason"?: string };
  readonly "api:status"?: string;
}

export const migrationApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    runMigration: builder.mutation<
      MigrationResponse,
      {
        path: string;
        author: string;
        message: string;
        operations: MigrationOp[];
        dryRun?: boolean;
        verbose?: boolean;
      }
    >({
      query: (params) => {
        const search = new URLSearchParams();
        if (params.dryRun) search.set("dry_run", "true");
        if (params.verbose) search.set("verbose", "true");
        const qs = search.toString();
        return {
          url: params.path + (qs ? `?${qs}` : ""),
          method: "POST",
          body: { author: params.author, message: params.message, operations: params.operations },
        };
      },
      invalidatesTags: (_result, _error, params) => (params.dryRun ? [] : ["Schema", "Frame", "Prefixes"]),
      // The invalidation refetch is async — patch the schema cache on success so
      // the taxonomy shows class create/delete/rename instantly.
      onQueryStarted: async (params, { dispatch, getState, queryFulfilled }) => {
        try {
          await queryFulfilled;
        } catch {
          return;
        }
        if (params.dryRun) return;
        const schemaPath = params.path.replace("/api/migration/", "/api/schema/");
        const cached = schemaApi.util.selectCachedArgsForQuery(getState(), "getSchema");
        for (const args of cached) {
          if (args.path !== schemaPath) continue;
          dispatch(
            schemaApi.util.updateQueryData("getSchema", args, (draft) => {
              for (const op of params.operations) {
                if (op["@type"] === "CreateClass") {
                  const doc = op.class_document as Record<string, unknown>;
                  const id = String(doc["@id"] ?? "");
                  if (id && !draft.some((c) => c["@id"] === id)) {
                    draft.push({ "@id": id, "@type": doc["@type"] ?? "Class", ...doc } as (typeof draft)[number]);
                  }
                } else if (op["@type"] === "DeleteClass") {
                  const i = draft.findIndex((c) => c["@id"] === op.class);
                  if (i >= 0) draft.splice(i, 1);
                } else if (op["@type"] === "MoveClass") {
                  const c = draft.find((c) => c["@id"] === op.from);
                  if (c) (c as Record<string, unknown>)["@id"] = String(op.to);
                }
              }
            })
          );
        }
      },
    }),

    // Pre-flight: runs the document write in a discarded transaction (check=true).
    checkDocument: builder.mutation<
      CheckResponse,
      { path: string; document: unknown; author: string; message: string }
    >({
      query: (params) => ({
        url: `${params.path}?author=${encodeURIComponent(params.author)}&message=${encodeURIComponent(
          params.message
        )}&graph_type=instance&check=true&upsert=true`,
        method: "POST",
        body: params.document,
      }),
    }),
  }),
});

export const { useRunMigrationMutation, useCheckDocumentMutation } = migrationApi;
