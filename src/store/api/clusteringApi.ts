import { baseApi } from "../baseApi";

export interface GetClusteringResponse {
  readonly storeClustering: boolean;
  readonly hasOptions: boolean;
}

export interface ToggleClusteringResponse {
  readonly success: boolean;
  readonly storeClustering: boolean;
  readonly message: string;
}

export interface ToggleClusteringRequest {
  readonly org: string;
  readonly db: string;
  readonly enable: boolean;
}

const SCHEMA_CONTEXT_ID = "@context";

function randomBranchName(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `tx-${suffix}`;
}

export const clusteringApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getClustering: builder.query<GetClusteringResponse, { path: string }>({
      query: ({ path }) => ({
        url: path,
        method: "GET",
        params: {
          graph_type: "schema",
          id: SCHEMA_CONTEXT_ID,
        },
      }),
      transformResponse: (raw: unknown): GetClusteringResponse => {
        const doc = raw as Record<string, unknown>;
        const contextObj = (doc["@context"] as Record<string, unknown>) ?? doc;
        const metadata = contextObj["@metadata"] as Record<string, unknown> | undefined;
        const terminusdb = metadata?.["terminusdb"] as Record<string, unknown> | undefined;
        const options = terminusdb?.["options"] as string[] | undefined;
        return {
          storeClustering: Array.isArray(options) && options.includes("store_clustering"),
          hasOptions: options !== undefined,
        };
      },
      providesTags: (_result, _error, { path }) => [
        { type: "Schema" as const, id: `clustering-${path}` },
      ],
    }),

    toggleClustering: builder.mutation<ToggleClusteringResponse, ToggleClusteringRequest>({
      async queryFn({ org, db, enable }, _api, _extra, baseQuery) {
        const branchName = randomBranchName();
        const basePath = `/${encodeURIComponent(org)}/${encodeURIComponent(db)}`;
        const branchPath = `${basePath}/local/branch/${encodeURIComponent(branchName)}`;
        const mainPath = `${basePath}/local/branch/main`;
        const message = enable ? "Enable clustering" : "Disable clustering";

        // Step 1: Create a temporary branch from main
        const createResult = await baseQuery({
          url: `/api/branch${branchPath}`,
          method: "POST",
          body: { origin: `${org}/${db}/local/branch/main` },
        });
        if (createResult.error) return { error: createResult.error };

        // Step 2: Read the full schema from the temp branch to get @context
        const readResult = await baseQuery({
          url: `/api/schema${branchPath}`,
          params: { graph_type: "schema", id: SCHEMA_CONTEXT_ID },
        });
        if (readResult.error) {
          await baseQuery({ url: `/api/branch${branchPath}`, method: "DELETE" });
          return { error: readResult.error };
        }

        // Step 3: Carefully patch only @metadata.terminusdb.options, preserving all other data
        const fullSchema = readResult.data as Record<string, unknown>;
        const contextObj = (fullSchema["@context"] as Record<string, unknown>) ?? {};
        const metadata = (contextObj["@metadata"] as Record<string, unknown>) ?? {};
        const terminusdb = (metadata["terminusdb"] as Record<string, unknown>) ?? {};
        const options = Array.isArray(terminusdb["options"])
          ? [...(terminusdb["options"] as string[])]
          : [];

        if (enable) {
          if (!options.includes("store_clustering")) options.push("store_clustering");
        } else {
          const idx = options.indexOf("store_clustering");
          if (idx >= 0) options.splice(idx, 1);
        }

        terminusdb["options"] = options;
        metadata["terminusdb"] = terminusdb;
        // Clean up stale flat key from previous versions
        delete metadata["terminusdb:options"];
        contextObj["@metadata"] = metadata;
        contextObj["@type"] = "@context";

        // Step 4: PUT the patched @context back to the temp branch
        const putResult = await baseQuery({
          url: `/api/document${branchPath}`,
          method: "PUT",
          params: { graph_type: "schema", full_replace: "false", author: "tdb-data", message },
          body: contextObj,
        });
        if (putResult.error) {
          await baseQuery({ url: `/api/branch${branchPath}`, method: "DELETE" });
          return { error: putResult.error };
        }

        // Step 5: Rebase the temp branch onto main
        // Note: We use rebase (not apply) because the apply endpoint only
        // operates on the instance graph. Schema @context changes require
        // rebase, which replays entire commits including schema changes.
        const rebaseResult = await baseQuery({
          url: `/api/rebase${mainPath}`,
          method: "POST",
          body: { author: "tdb-data", rebase_from: `${org}/${db}/local/branch/${branchName}` },
        });
        if (rebaseResult.error) {
          await baseQuery({ url: `/api/branch${branchPath}`, method: "DELETE" });
          return { error: rebaseResult.error };
        }

        // Step 6: Delete the temporary branch
        await baseQuery({ url: `/api/branch${branchPath}`, method: "DELETE" });

        return {
          data: {
            success: true,
            storeClustering: enable,
            message: enable ? "Clustering enabled" : "Clustering disabled",
          },
        };
      },
      invalidatesTags: ["Schema"],
    }),
  }),
});

export const useGetClusteringQuery = clusteringApi.endpoints.getClustering.useQuery;
export const useToggleClusteringMutation = clusteringApi.endpoints.toggleClustering.useMutation;
