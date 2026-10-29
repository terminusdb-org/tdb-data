import { baseApi } from "../baseApi";
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
