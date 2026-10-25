// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock @graphiql/toolkit so createGraphiQLFetcher returns a controllable
// mock HTTP fetcher. vi.hoisted ensures the mock fn is available inside the
// hoisted vi.mock factory (which runs before any other top-level code).
const { mockHttpFetcher } = vi.hoisted(() => ({
  mockHttpFetcher: vi.fn(),
}));
vi.mock("@graphiql/toolkit", () => ({
  createGraphiQLFetcher: vi.fn().mockReturnValue(mockHttpFetcher),
}));

import {
  isSubscriptionOperation,
  createTdbGraphiQLFetcher,
} from "./graphqlFetcher";

// ─── AST helpers ─────────────────────────────────────────────────────────

function makeDoc(definitions: unknown[]): unknown {
  return { kind: "Document", definitions };
}

function makeOp(
  operation: "query" | "mutation" | "subscription",
  name?: string,
): unknown {
  return {
    kind: "OperationDefinition",
    operation,
    name: name ? { kind: "Name", value: name } : undefined,
    selectionSet: { kind: "SelectionSet", selections: [] },
  };
}

// ─── SSE response helper ─────────────────────────────────────────────────

function makeSSEResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

async function collectAsyncIterable<T>(iter: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const v of iter) out.push(v);
  return out;
}

// ─── isSubscriptionOperation ─────────────────────────────────────────────

describe("isSubscriptionOperation", () => {
  it("identifies a subscription operation", () => {
    const doc = makeDoc([makeOp("subscription")]);
    expect(isSubscriptionOperation(doc)).toBe(true);
  });

  it("returns false for a query operation", () => {
    const doc = makeDoc([makeOp("query")]);
    expect(isSubscriptionOperation(doc)).toBe(false);
  });

  it("returns false for a mutation operation", () => {
    const doc = makeDoc([makeOp("mutation")]);
    expect(isSubscriptionOperation(doc)).toBe(false);
  });

  it("matches by operation name when provided", () => {
    const doc = makeDoc([makeOp("subscription", "MySub")]);
    expect(isSubscriptionOperation(doc, "MySub")).toBe(true);
  });

  it("does not match when operation name differs", () => {
    const doc = makeDoc([makeOp("subscription", "MySub")]);
    expect(isSubscriptionOperation(doc, "OtherSub")).toBe(false);
  });

  it("matches unnamed subscription when no operation name given", () => {
    const doc = makeDoc([makeOp("subscription")]);
    expect(isSubscriptionOperation(doc)).toBe(true);
  });

  it("returns false when documentAST is absent", () => {
    expect(isSubscriptionOperation(undefined)).toBe(false);
    expect(isSubscriptionOperation(null)).toBe(false);
  });

  it("returns false when document has no definitions", () => {
    const doc = makeDoc([]);
    expect(isSubscriptionOperation(doc)).toBe(false);
  });

  it("finds subscription among multiple operations by name", () => {
    const doc = makeDoc([makeOp("query", "Q1"), makeOp("subscription", "S1")]);
    expect(isSubscriptionOperation(doc, "S1")).toBe(true);
    expect(isSubscriptionOperation(doc, "Q1")).toBe(false);
  });
});

// ─── createTdbGraphiQLFetcher ────────────────────────────────────────────

describe("createTdbGraphiQLFetcher", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    mockHttpFetcher.mockReset();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("delegates non-subscription operations to the HTTP fetcher", async () => {
    const mockHttpResult = { data: { hello: "world" } };
    mockHttpFetcher.mockResolvedValue(mockHttpResult);

    const fetcher = createTdbGraphiQLFetcher({
      url: "http://localhost/api/graphql/x",
    });

    const params = { query: "{ hello }" };
    const opts = { documentAST: makeDoc([makeOp("query")]) };
    const result = await fetcher(params, opts);

    expect(result).toEqual(mockHttpResult);
    expect(mockHttpFetcher).toHaveBeenCalledWith(params, opts);
  });

  it("delegates to HTTP fetcher when documentAST is absent", async () => {
    const mockHttpResult = { data: { hello: "world" } };
    mockHttpFetcher.mockResolvedValue(mockHttpResult);

    const fetcher = createTdbGraphiQLFetcher({
      url: "http://localhost/api/graphql/x",
    });

    const result = await fetcher({ query: "{ hello }" });

    expect(result).toEqual(mockHttpResult);
  });

  it("sends SSE subscription request with Accept header and auth", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      makeSSEResponse(['data: {"data":{"Product_added":{"_id":"x"}}}\n\n']),
    );
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const fetcher = createTdbGraphiQLFetcher({
      url: "http://localhost/api/graphql/admin/db/local/branch/main",
      headers: { Authorization: "Basic abc123" },
    });

    const params = {
      query: "subscription { Product_added { _id } }",
      operationName: undefined as string | undefined,
    };
    const result = (await fetcher(params, {
      documentAST: makeDoc([makeOp("subscription")]),
    })) as AsyncIterable<Record<string, unknown>>;

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, calledOpts] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe(
      "http://localhost/api/graphql/admin/db/local/branch/main",
    );
    expect(calledOpts.method).toBe("POST");
    expect(calledOpts.headers["Accept"]).toBe("text/event-stream");
    expect(calledOpts.headers["Content-Type"]).toBe("application/json");
    expect(calledOpts.headers["Authorization"]).toBe("Basic abc123");
    expect(calledOpts.body).toBe(JSON.stringify(params));

    // Should not call the HTTP fetcher for subscriptions.
    expect(mockHttpFetcher).not.toHaveBeenCalled();
    expect(result).toBeDefined();
    expect(typeof (result as AsyncIterable<unknown>)[Symbol.asyncIterator]).toBe(
      "function",
    );
  });

  it("returns an async iterable that yields parsed SSE events", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      makeSSEResponse([
        'data: {"data":{"Product_added":{"_id":"a"}}}\n\n',
        'data: {"data":{"Product_added":{"_id":"b"}}}\n\n',
      ]),
    );
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const fetcher = createTdbGraphiQLFetcher({
      url: "http://localhost/api/graphql/x",
    });

    const result = (await fetcher(
      { query: "subscription { Product_added { _id } }" },
      { documentAST: makeDoc([makeOp("subscription")]) },
    )) as AsyncIterable<Record<string, unknown>>;

    const events = await collectAsyncIterable(result);
    expect(events).toEqual([
      { data: { Product_added: { _id: "a" } } },
      { data: { Product_added: { _id: "b" } } },
    ]);
  });

  it("throws when the SSE response is not ok", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("Unauthorized", { status: 401 }),
    );
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const fetcher = createTdbGraphiQLFetcher({
      url: "http://localhost/api/graphql/x",
    });

    await expect(
      fetcher(
        { query: "subscription { Product_added { _id } }" },
        { documentAST: makeDoc([makeOp("subscription")]) },
      ),
    ).rejects.toThrow(/SSE subscription failed: HTTP 401/);
  });

  it("passes AbortController signal to fetch for subscription cancellation", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      makeSSEResponse(['data: {"data":1}\n\n']),
    );
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const fetcher = createTdbGraphiQLFetcher({
      url: "http://localhost/api/graphql/x",
    });

    await fetcher(
      { query: "subscription { Product_added { _id } }" },
      { documentAST: makeDoc([makeOp("subscription")]) },
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const callOpts = fetchMock.mock.calls[0][1];
    expect(callOpts.signal).toBeInstanceOf(AbortSignal);
    expect(callOpts.signal.aborted).toBe(false);
  });

  it("aborts the HTTP connection when the iterator is early-terminated", async () => {
    // Create a stream that stays open (never closes) so the only way to
    // stop reading is via early termination.
    let streamController: ReadableStreamDefaultController<Uint8Array>;
    const encoder = new TextEncoder();
    const body = new ReadableStream({
      start(controller) {
        streamController = controller;
        controller.enqueue(
          encoder.encode('event: next\ndata: {"data":{"a":1}}\n\n'),
        );
        // Don't close — simulates an open SSE connection.
      },
    });

    let abortSignal: AbortSignal | undefined;
    const fetchMock = vi.fn().mockImplementation((_url: string, opts: RequestInit) => {
      abortSignal = opts.signal as AbortSignal;
      return Promise.resolve(
        new Response(body, {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        }),
      );
    });
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const fetcher = createTdbGraphiQLFetcher({
      url: "http://localhost/api/graphql/x",
    });

    const result = (await fetcher(
      { query: "subscription { Product_added { _id } }" },
      { documentAST: makeDoc([makeOp("subscription")]) },
    )) as AsyncIterable<Record<string, unknown>>;

    const iterator = result[Symbol.asyncIterator]();
    const first = await iterator.next();
    expect(first.value).toEqual({ data: { a: 1 } });

    // Simulate GraphiQL's stop button: call .return() on the iterator.
    expect(abortSignal!.aborted).toBe(false);
    await iterator.return!();
    expect(abortSignal!.aborted).toBe(true);

    // Stream may already be closed by reader.cancel() in the finally block.
    try { streamController!.close(); } catch { /* already closed */ }
  });

  it("supports continuous streaming — yields multiple events over time", async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream({
      start(controller) {
        // Simulate events arriving at different times.
        controller.enqueue(
          encoder.encode('event: next\ndata: {"data":{"n":1}}\n\n'),
        );
        setTimeout(() => {
          controller.enqueue(
            encoder.encode('event: next\ndata: {"data":{"n":2}}\n\n'),
          );
        }, 10);
        setTimeout(() => {
          controller.enqueue(
            encoder.encode('event: next\ndata: {"data":{"n":3}}\n\n'),
          );
          controller.close();
        }, 20);
      },
    });

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(body, {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      }),
    );
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const fetcher = createTdbGraphiQLFetcher({
      url: "http://localhost/api/graphql/x",
    });

    const result = (await fetcher(
      { query: "subscription { Product_added { _id } }" },
      { documentAST: makeDoc([makeOp("subscription")]) },
    )) as AsyncIterable<Record<string, unknown>>;

    const events = await collectAsyncIterable(result);
    expect(events).toEqual([
      { data: { n: 1 } },
      { data: { n: 2 } },
      { data: { n: 3 } },
    ]);
  });
});
