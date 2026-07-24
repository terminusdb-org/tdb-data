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
    } else {
      const message =
        typeof result.error.data === "object" && result.error.data !== null
          ? (result.error.data as Record<string, unknown>)["api:message"] as string ??
            (result.error.data as Record<string, unknown>).message as string ??
            (result.error.data as Record<string, unknown>).error as string ??
            "An error occurred"
          : String(result.error.data ?? result.error.status);
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
