// @vitest-environment node
import { describe, it, expect } from "vitest";
import { epochDecimalToIso, isoToEpochDecimal } from "./datetime";

describe("isoToEpochDecimal", () => {
  it("parses whole-second instants", () => {
    expect(isoToEpochDecimal("2026-10-26T08:37:37Z")).toBe(1793003857);
  });

  it("preserves sub-millisecond fraction digits", () => {
    const v = isoToEpochDecimal("2026-10-26T08:37:37.9056506Z");
    expect(v).not.toBeNull();
    expect(v!).toBeGreaterThan(1793003857.905);
    expect(v!).toBeLessThan(1793003857.906);
    // The ns digits distinguish it from the ms-truncated value.
    expect(v!).not.toBe(1793003857.905);
  });

  it("round-trips epochDecimalToIso output within representation error", () => {
    const ts = 1793003857.927728891;
    const iso = epochDecimalToIso(ts);
    expect(iso).not.toBeNull();
    const back = isoToEpochDecimal(iso!);
    expect(back).not.toBeNull();
    expect(Math.abs(back! - ts)).toBeLessThan(1e-6);
  });

  it("returns null for invalid input", () => {
    expect(isoToEpochDecimal("not-a-date")).toBeNull();
  });
});
