// @vitest-environment node
import { describe, it, expect } from "vitest";
import { normalizeDocId, displayId } from "./validation";

describe("normalizeDocId", () => {
  it("keeps slashes literal and encodes segments", () => {
    expect(normalizeDocId("Person/Kurt Gödel")).toBe("Person/Kurt%20G%C3%B6del");
  });

  it("re-encodes percent signs so decode-once yields the stored id", () => {
    // Stored id "Person/Kurt%20Gödel" — the wire form decodes back to it.
    const wire = normalizeDocId("Person/Kurt%20G%C3%B6del");
    expect(wire).toBe("Person/Kurt%2520G%25C3%25B6del");
    expect(decodeURIComponent(wire)).toBe("Person/Kurt%20G%C3%B6del");
  });

  it("preserves scheme and authority of full IRIs", () => {
    const wire = normalizeDocId("https://ex.com/data/Person/Kurt%20G%C3%B6del");
    expect(wire).toBe("https://ex.com/data/Person/Kurt%2520G%25C3%25B6del");
    expect(decodeURIComponent(wire)).toBe("https://ex.com/data/Person/Kurt%20G%C3%B6del");
  });

  it("encodes each segment independently", () => {
    expect(normalizeDocId("Person/a%20b/c d")).toBe("Person/a%2520b/c%20d");
  });

  it("encodes stray percent signs", () => {
    expect(normalizeDocId("Person/100%")).toBe("Person/100%25");
  });
});

describe("displayId", () => {
  it("decodes for display", () => {
    expect(displayId("Person/Kurt%20G%C3%B6del")).toBe("Person/Kurt Gödel");
  });

  it("returns input undecodable values unchanged", () => {
    expect(displayId("Person/100%")).toBe("Person/100%");
  });
});
