// @vitest-environment node
import { describe, it, expect } from "vitest";
import { witnessSummary } from "./iri";

describe("witnessSummary", () => {
  it("summarizes unknown_property_for_type (engine sends compressed ids)", () => {
    const w = { "@type": "unknown_property_for_type", property: ["ghjghj"], type: "Animal" };
    expect(witnessSummary(w)).toBe("unknown_property_for_type (property=ghjghj, type=Animal)");
  });
  it("unwraps property-keyed nested witnesses", () => {
    const w = { city: { "@type": "ascribed_type_not_subsumed", required_type: "xsd:string" } };
    expect(witnessSummary(w)).toBe("ascribed_type_not_subsumed (required_type=xsd:string)");
  });
  it("returns null for non-witness shapes", () => {
    expect(witnessSummary("x")).toBeNull();
    expect(witnessSummary({ foo: 1 })).toBeNull();
  });
});
