import { baseApi } from "../baseApi";
import type { WoqlResponse } from "@/types/terminusdb";

export interface WoqlParams {
  readonly path: string;
  readonly query: Record<string, unknown>;
}

const REGEX_META = /[.*+?^${}()|[\]\\]/g;

export const woqlApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    runWoql: builder.mutation<WoqlResponse, WoqlParams>({
      query: (params) => ({
        url: params.path,
        method: "POST",
        body: { query: params.query },
      }),
    }),

    // Document ids whose IRI starts with `prefix`. Relative prefixes (the
    // "Class/" form shown with compress_ids) expand under `base`; a full IRI
    // passes through verbatim. The engine's Regexp matches the expanded IRI
    // while bindings come back compressed — the same form the document API
    // takes for `ids`.
    getDocumentIdsByPrefix: builder.query<
      string[],
      { path: string; base: string; prefix: string; type?: string }
    >({
      query: ({ path, base, prefix, type }) => {
        const expanded = /^[A-Za-z][\w+.-]*:/.test(prefix) ? prefix : `${base}${prefix}`;
        const pattern = `^${expanded.replace(REGEX_META, "\\$&")}`;
        return {
          url: path,
          method: "POST",
          body: {
            query: {
              "@type": "OrderBy",
              ordering: [{ "@type": "OrderTemplate", variable: "d", order: "asc" }],
              query: {
                "@type": "And",
                and: [
                  {
                    "@type": "Distinct",
                    variables: ["d"],
                    query: {
                      "@type": "Triple",
                      subject: { "@type": "NodeValue", variable: "d" },
                      predicate: { "@type": "NodeValue", node: "rdf:type" },
                      object: { "@type": "NodeValue", node: type ?? "sys:JSONDocument" },
                    },
                  },
                  {
                    "@type": "Regexp",
                    pattern: { "@type": "DataValue", data: { "@type": "xsd:string", "@value": pattern } },
                    string: { "@type": "DataValue", variable: "d" },
                    result: { "@type": "DataValue", variable: "m" },
                  },
                ],
              },
            },
          },
        };
      },
      transformResponse: (res: WoqlResponse) =>
        (res.bindings ?? [])
          .map((b) => b["d"])
          .filter((d): d is string => typeof d === "string"),
    }),
  }),
});

export const { useRunWoqlMutation, useGetDocumentIdsByPrefixQuery } = woqlApi;
