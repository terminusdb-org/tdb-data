import { baseApi } from "../baseApi";

export interface DatabaseEntry {
  readonly path: string;
  readonly branches?: ReadonlyArray<string>;
}

export const dbApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getDatabases: builder.query<DatabaseEntry[], { branches?: boolean }>({
      query: (params) => {
        const searchParams = new URLSearchParams();
        if (params.branches) searchParams.set("branches", "true");
        const qs = searchParams.toString();
        return `/api/db${qs ? `?${qs}` : ""}`;
      },
      providesTags: ["Database"],
    }),
  }),
});

export const { useGetDatabasesQuery } = dbApi;
