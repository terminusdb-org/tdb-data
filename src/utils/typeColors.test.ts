// @vitest-environment node
import { describe, it, expect } from "vitest";
import { generateTypeColors } from "./typeColors";

describe("generateTypeColors", () => {
  it("returns empty object for empty input", () => {
    const result = generateTypeColors([]);
    expect(result).toEqual({});
  });

  it("returns one color per type", () => {
    const result = generateTypeColors(["Product", "Customer", "Order"]);
    expect(Object.keys(result)).toHaveLength(3);
    expect(result["Product"]).toBeDefined();
    expect(result["Customer"]).toBeDefined();
    expect(result["Order"]).toBeDefined();
  });

  it("produces hex colors starting with #", () => {
    const result = generateTypeColors(["Product"]);
    expect(result["Product"].hex).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("produces hsl colors in hsl() format", () => {
    const result = generateTypeColors(["Product"]);
    expect(result["Product"].hsl).toMatch(/^hsl\(\d+,\s*\d+%,\s*\d+%\)$/);
  });

  it("produces different colors for different types", () => {
    const result = generateTypeColors(["A", "B", "C", "D"]);
    const colors = Object.values(result).map((c) => c.hex);
    const unique = new Set(colors);
    expect(unique.size).toBe(4);
  });

  it("is deterministic — same input always produces same output", () => {
    const a = generateTypeColors(["Product", "Customer"]);
    const b = generateTypeColors(["Product", "Customer"]);
    expect(a).toEqual(b);
  });
});
