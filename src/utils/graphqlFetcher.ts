import { createGraphiQLFetcher } from "@graphiql/toolkit";
import { parseSSEStream } from "./sseStream";

interface FetcherParams {
  query: string;
  operationName?: string | null;
  variables?: Record<string, unknown>;
}

interface FetcherOpts {
  headers?: Record<string, string>;
  documentAST?: unknown;
}

/**
 * Detect whether a GraphQL document AST contains a subscription operation,
 * optionally matching by operation name.
 *
 * The AST is a plain object tree (per graphql-js `DocumentNode`). We walk it
 * looking for `OperationDefinition` nodes where `operation === "subscription"`.
 * When `operationName` is provided, the node's `name.value` must match.
 */
export function isSubscriptionOperation(
  documentAST: unknown,
  operationName?: string | null,
): boolean {
  if (!documentAST || typeof documentAST !== "object") return false;
  let found = false;
  const visit = (node: unknown): void => {
    if (found || !node || typeof node !== "object") return;
    const n = node as Record<string, unknown>;
    if (
      n.kind === "OperationDefinition" &&
      n.operation === "subscription"
    ) {
      if (!operationName) {
        found = true;
        return;
      }
      const nameNode = n.name as Record<string, unknown> | undefined;
      if (nameNode?.value === operationName) {
        found = true;
        return;
      }
    }
    for (const key in n) {
      const val = n[key];
      if (Array.isArray(val)) {
        for (const child of val) visit(child);
      } else if (val && typeof val === "object") {
        const child = val as Record<string, unknown>;
        if (child.kind) visit(child);
      }
    }
  };
  visit(documentAST);
  return found;
}

/**
 * Create a GraphiQL fetcher that supports TerminusDB's SSE-based GraphQL
 * subscriptions.
 *
 * TerminusDB serves subscriptions over the same HTTP endpoint as queries and
 * mutations, distinguished by the `Accept: text/event-stream` header. This
 * fetcher inspects the parsed document AST (provided by GraphiQL via
 * `fetcherOpts.documentAST`) and routes subscription operations through SSE,
 * delegating all other operations to the standard `createGraphiQLFetcher`.
 */
export function createTdbGraphiQLFetcher(options: {
  url: string;
  headers?: Record<string, string>;
}) {
  const httpFetcher = createGraphiQLFetcher(options);

  return async (
    graphQLParams: FetcherParams,
    fetcherOpts?: FetcherOpts,
  ): Promise<unknown> => {
    if (
      isSubscriptionOperation(
        fetcherOpts?.documentAST,
        graphQLParams.operationName,
      )
    ) {
      // AbortController ensures the HTTP connection is properly closed
      // when GraphiQL's stop button calls .return() on the async iterator.
      // The parseSSEStream generator's finally block calls reader.cancel(),
      // and aborting the controller ensures the underlying TCP connection
      // is torn down even if the reader is stuck waiting for data.
      const controller = new AbortController();
      const res = await fetch(options.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          ...options.headers,
          ...fetcherOpts?.headers,
        },
        body: JSON.stringify(graphQLParams),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        throw new Error(`SSE subscription failed: HTTP ${res.status}`);
      }
      // Wrap the generator so that early termination (GraphiQL stop button)
      // aborts the HTTP connection via the AbortController.
      const inner = parseSSEStream(res.body);
      return {
        [Symbol.asyncIterator]() {
          return {
            next: inner.next.bind(inner),
            return: async (value?: unknown) => {
              controller.abort();
              return inner.return(value);
            },
            throw: inner.throw?.bind(inner),
          };
        },
      };
    }
    return httpFetcher(
      graphQLParams as Parameters<typeof httpFetcher>[0],
      fetcherOpts as Parameters<typeof httpFetcher>[1],
    );
  };
}
