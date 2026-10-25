// @vitest-environment node
import { describe, it, expect } from "vitest";
import { parseSSEStream } from "./sseStream";

// Build a ReadableStream<Uint8Array> from an array of string chunks.
// Each string is encoded as a separate chunk, simulating network delivery.
function makeStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

// Collect all values from an async generator into an array.
async function collect<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const v of gen) out.push(v);
  return out;
}

describe("parseSSEStream", () => {
  it("yields parsed JSON objects from data: lines", async () => {
    const stream = makeStream([
      "data: {\"data\":{\"Product_added\":{\"_id\":\"x\"}}}\n\n",
    ]);
    const events = await collect(parseSSEStream(stream));
    expect(events).toEqual([{ data: { Product_added: { _id: "x" } } }]);
  });

  it("skips comment lines starting with colon", async () => {
    const stream = makeStream([
      ": connected\n\n",
      "data: {\"data\":1}\n\n",
    ]);
    const events = await collect(parseSSEStream(stream));
    expect(events).toEqual([{ data: 1 }]);
  });

  it("handles events split across multiple chunks", async () => {
    const stream = makeStream([
      "data: {\"dat",
      "a\":{\"x\":1}}\n\n",
    ]);
    const events = await collect(parseSSEStream(stream));
    expect(events).toEqual([{ data: { x: 1 } }]);
  });

  it("handles multiple data events in a single chunk", async () => {
    const stream = makeStream([
      "data: {\"a\":1}\n\ndata: {\"b\":2}\n\n",
    ]);
    const events = await collect(parseSSEStream(stream));
    expect(events).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it("yields nothing for an empty stream", async () => {
    const stream = makeStream([]);
    const events = await collect(parseSSEStream(stream));
    expect(events).toEqual([]);
  });

  it("skips malformed JSON data lines without throwing", async () => {
    const stream = makeStream([
      "data: not-json\n\n",
      "data: {\"ok\":true}\n\n",
    ]);
    const events = await collect(parseSSEStream(stream));
    expect(events).toEqual([{ ok: true }]);
  });

  it("ignores trailing partial data without a closing delimiter", async () => {
    const stream = makeStream([
      "data: {\"ok\":true}\n\n",
      "data: {\"incompl",
    ]);
    const events = await collect(parseSSEStream(stream));
    expect(events).toEqual([{ ok: true }]);
  });

  it("cancels the reader when the generator is early-terminated", async () => {
    let cancelCalled = false;
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode("data: {\"a\":1}\n\n"));
        controller.enqueue(encoder.encode("data: {\"b\":2}\n\n"));
      },
      cancel() {
        cancelCalled = true;
      },
    });

    const gen = parseSSEStream(stream);
    const first = await gen.next();
    expect(first.value).toEqual({ a: 1 });
    await gen.return(undefined);
    expect(cancelCalled).toBe(true);
  });

  // graphql-sse protocol: events have an "event: next" line before "data:".
  it("parses graphql-sse event blocks with event: next and data: lines", async () => {
    const stream = makeStream([
      "event: next\ndata: {\"data\":{\"Product_added\":{\"_id\":\"x\"}}}\n\n",
    ]);
    const events = await collect(parseSSEStream(stream));
    expect(events).toEqual([{ data: { Product_added: { _id: "x" } } }]);
  });

  it("parses multiple graphql-sse event blocks in a single chunk", async () => {
    const stream = makeStream([
      "event: next\ndata: {\"a\":1}\n\nevent: next\ndata: {\"b\":2}\n\n",
    ]);
    const events = await collect(parseSSEStream(stream));
    expect(events).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it("handles graphql-sse event blocks split across chunks", async () => {
    const stream = makeStream([
      "event: nex",
      "t\ndata: {\"ok\":true}\n\n",
    ]);
    const events = await collect(parseSSEStream(stream));
    expect(events).toEqual([{ ok: true }]);
  });

  it("handles data: without trailing space (data:{json})", async () => {
    const stream = makeStream([
      "event: next\ndata:{\"compact\":true}\n\n",
    ]);
    const events = await collect(parseSSEStream(stream));
    expect(events).toEqual([{ compact: true }]);
  });

  it("skips event blocks with no data line", async () => {
    const stream = makeStream([
      "event: ping\n\n",
      "event: next\ndata: {\"ok\":true}\n\n",
    ]);
    const events = await collect(parseSSEStream(stream));
    expect(events).toEqual([{ ok: true }]);
  });
});
