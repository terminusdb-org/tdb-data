import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";
import { config } from "@/config";
import { setError } from "./errorSlice";
import { logout } from "./authSlice";
import { isAcceptedApiError } from "@/utils/apiErrors";

interface AuthStateShape {
  readonly auth: {
    readonly credentials: string | null;
  };
}

const rawBaseQuery = fetchBaseQuery({
  baseUrl: config.apiUrl,
  prepareHeaders: (headers, { getState }) => {
    const state = getState() as AuthStateShape;
    const credentials = state.auth.credentials;
    if (credentials) {
      headers.set("Authorization", `Basic ${credentials}`);
    }
    return headers;
  },
});

const baseQueryWithErrorHandling: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  const result = await rawBaseQuery(args, api, extraOptions);

  if (result.error) {
    if (result.error.status === 401) {
      api.dispatch(logout());
    } else if (result.error.status === "FETCH_ERROR") {
      // Aborted requests (e.g. from navigation) produce FETCH_ERROR — skip
    } else if (isAcceptedApiError(result.error)) {
      // Recognized guidance payloads (e.g. api:NoEmbeddingQueriesDefined,
      // api:EndpointNotConfigured) — call sites render direction, no banner
    } else {
      const data = result.error.data;
      let message: string;
      if (typeof data === "object" && data !== null) {
        const record = data as Record<string, unknown>;
        message = (record["api:message"] ?? record.message ?? record.error ?? "An error occurred") as string;
      } else if (typeof data === "string") {
        // text responseHandlers surface the error payload as a JSON string —
        // pull api:message out of it when present
        try {
          const parsed = JSON.parse(data) as Record<string, unknown>;
          message = String(parsed["api:message"] ?? data);
        } catch {
          message = data;
        }
      } else {
        message = String(result.error.status);
      }
      api.dispatch(
        setError({
          message,
          statusCode: typeof result.error.status === "number" ? result.error.status : undefined,
        })
      );
    }
  }

  return result;
};

export const baseApi = createApi({
  reducerPath: "dataApi",
  baseQuery: baseQueryWithErrorHandling,
  tagTypes: ["Document", "Schema", "Frame", "Prefixes", "Database"],
  endpoints: () => ({}),
});
