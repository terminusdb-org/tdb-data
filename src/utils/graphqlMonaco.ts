import { initializeMode } from "monaco-graphql/initializeMode";

type MonacoGraphQLAPI = ReturnType<typeof initializeMode>;
import GraphqlWorker from "monaco-graphql/esm/graphql.worker?worker";
import EditorWorker from "monaco-editor/editor/editor.worker?worker";
import JsonWorker from "monaco-editor/language/json/json.worker?worker";
import CssWorker from "monaco-editor/language/css/css.worker?worker";
import HtmlWorker from "monaco-editor/language/html/html.worker?worker";
import TsWorker from "monaco-editor/language/typescript/ts.worker?worker";
import { getIntrospectionQuery, type IntrospectionQuery } from "graphql";
import { createTdbGraphiQLFetcher } from "./graphqlFetcher";
import { config } from "@/config";

let graphqlApi: MonacoGraphQLAPI | null = null;
let workersInstalled = false;

// Monaco needs a worker factory per language label. Install once — covers
// graphql plus the stock languages used elsewhere in the app.
function installWorkers(): void {
  if (workersInstalled) return;
  workersInstalled = true;
  const prior = self.MonacoEnvironment?.getWorker?.bind(self.MonacoEnvironment);
  self.MonacoEnvironment = {
    ...self.MonacoEnvironment,
    getWorker(id: string, label: string): Worker | Promise<Worker> {
      switch (label) {
        case "graphql":
          return new GraphqlWorker();
        case "json":
          return new JsonWorker();
        case "css":
        case "scss":
        case "less":
          return new CssWorker();
        case "html":
        case "handlebars":
        case "razor":
          return new HtmlWorker();
        case "typescript":
        case "javascript":
          return new TsWorker();
        default:
          return prior?.(id, label) ?? new EditorWorker();
      }
    },
  };
}

export function ensureGraphqlMonaco(): MonacoGraphQLAPI {
  installWorkers();
  if (!graphqlApi) {
    // completionSettings is dereferenced unconditionally in WorkerManager —
    // omitting it crashes worker spawn and every completion silently fails.
    graphqlApi = initializeMode({ schemas: [], completionSettings: {} });
  }
  return graphqlApi;
}

const loadedSchemaUris = new Set<string>();

// Fetch the endpoint's schema once per URL and hand it to the graphql
// language worker for completions, hover and diagnostics.
export async function loadGraphqlSchemaForMonaco(
  graphqlPath: string,
  credentials: string | null,
): Promise<void> {
  const url = `${config.apiUrl}${graphqlPath}`;
  // Register the graphql mode and worker factory up front — Monaco spawns
  // editor workers as soon as the editor mounts, before the schema arrives.
  ensureGraphqlMonaco();
  if (loadedSchemaUris.has(url)) return;
  loadedSchemaUris.add(url);
  try {
    const fetcher = createTdbGraphiQLFetcher({
      url,
      headers: credentials ? { Authorization: `Basic ${credentials}` } : {},
    });
    // TerminusDB's GraphQL schema predates graphql-17 — omit the newer
    // introspection fields or the whole query is rejected.
    const raw = (await fetcher({
      query: getIntrospectionQuery({
        specifiedByUrl: false,
        directiveIsRepeatable: false,
        schemaDescription: false,
        inputValueDeprecation: false,
        oneOf: false,
      }),
    })) as unknown;
    // The GraphiQL fetcher may return an async iterator for streaming
    // results — take the first yielded value for a plain query.
    const result = (
      raw && typeof (raw as AsyncIterator<unknown>).next === "function"
        ? (await (raw as AsyncIterator<{ data?: IntrospectionQuery }>).next()).value
        : raw
    ) as { data?: IntrospectionQuery };
    if (!result.data) {
      console.warn("[graphqlMonaco] introspection returned no schema data");
      return;
    }
    ensureGraphqlMonaco().setSchemaConfig([
      {
        introspectionJSON: result.data,
        uri: url,
        fileMatch: ["**"],
      },
    ]);
  } catch (err) {
    loadedSchemaUris.delete(url);
    console.warn("[graphqlMonaco] schema introspection failed", err);
  }
}
