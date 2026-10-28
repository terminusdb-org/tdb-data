// @vitest-environment node
import { describe, it, expect, vi, afterEach } from "vitest";
import { streamLog, type LogCommit } from "./logApi";

const COMMIT = {
  identifier: "abc123",
  timestamp: 1793028605.337362,
  author: "admin",
  message: "thing",
};

function ndjsonResponse(lines: object[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      for (const line of lines) {
        controller.enqueue(encoder.encode(JSON.stringify(line) + "\n"));
      }
      controller.close();
    },
  });
  return new Response(body, { status: 200 });
}

function lastUrl(): URL {
  const call = vi.mocked(fetch).mock.calls.at(-1);
  return new URL(String(call?.[0]));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("streamLog request parameters", () => {
  it("sends with_counts=false for light metadata fetches", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ndjsonResponse([COMMIT])));
    await streamLog("http://x", "p", { start: 0, count: 10, withCounts: false }, null, undefined);
    expect(lastUrl().searchParams.get("with_counts")).toBe("false");
  });

  it("defaults to with_counts=true for enriched fetches", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ndjsonResponse([COMMIT])));
    await streamLog("http://x", "p", { start: 0, count: 10 }, null, undefined);
    expect(lastUrl().searchParams.get("with_counts")).toBe("true");
  });

  it("sends startDateTime instead of start, with endDateTime independent", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ndjsonResponse([COMMIT])));
    await streamLog(
      "http://x",
      "p",
      { startDateTime: "2026-10-26T15:30:05Z", endDateTime: "2026-10-26T15:30:02Z", count: -1 },
      null,
      undefined,
    );
    const params = lastUrl().searchParams;
    expect(params.get("startDateTime")).toBe("2026-10-26T15:30:05Z");
    expect(params.get("endDateTime")).toBe("2026-10-26T15:30:02Z");
    expect(params.get("start")).toBeNull();
  });

  it("invokes onCommit per streamed row so callers can merge by identifier", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ndjsonResponse([COMMIT, { ...COMMIT, identifier: "def456" }])),
    );
    const seen: LogCommit[] = [];
    await streamLog("http://x", "p", { count: -1, withCounts: true }, null, undefined, (c) =>
      seen.push(c),
    );
    expect(seen.map((c) => c.identifier)).toEqual(["abc123", "def456"]);
  });
});
