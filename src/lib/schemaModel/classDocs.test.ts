// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readTypeDocs, readPropDocs, withDocumentation } from "./classDocs";
import type { SchemaClass } from "@/types/terminusdb";

const cls = {
  "@type": "Class",
  "@id": "Animal",
  "@key": { "@type": "Random" },
  "@documentation": [
    { "@label": "Animal", "@comment": "A creature", "@properties": { city: { "@label": "City", "@comment": "Where it lives" } } },
    { "@language": "sv", "@label": "Djur", "@comment": "En varelse", "@properties": { city: { "@label": "Stad" } } },
  ],
} as unknown as SchemaClass;

describe("readTypeDocs", () => {
  it("reads default + translated type docs", () => {
    const d = readTypeDocs(cls);
    expect(d.default).toEqual({ label: "Animal", comment: "A creature" });
    expect(d.translations.sv).toEqual({ label: "Djur", comment: "En varelse" });
  });
});

describe("readPropDocs", () => {
  it("reads per-language field docs", () => {
    const d = readPropDocs(cls, "city");
    expect(d.default).toEqual({ label: "City", comment: "Where it lives" });
    expect(d.translations.sv).toEqual({ label: "Stad" });
  });
});

describe("withDocumentation", () => {
  it("updates field docs per language, preserving other entries", () => {
    // cls's doc mixes untagged + sv — engine-invalid but exercising retag:
    // the untagged entry is retagged to defaultLang and keeps its content.
    const next = withDocumentation(cls, {
      propName: "city",
      propDocs: { default: { label: "Town" }, translations: { fr: { label: "Ville" }, sv: {} } },
      defaultLang: "en",
    }) as unknown as Record<string, unknown>;
    const docs = next["@documentation"] as Array<Record<string, unknown>>;
    const en = docs.find((e) => e["@language"] === "en")!;
    expect((en["@properties"] as Record<string, unknown>).city).toEqual({ "@label": "Town" });
    // type-level docs preserved on the retagged entry
    expect(en["@label"]).toBe("Animal");
    const sv = docs.find((e) => e["@language"] === "sv")!;
    // sv's city docs were cleared → its @properties is dropped entirely
    expect(sv["@properties"]).toBeUndefined();
    const fr = docs.find((e) => e["@language"] === "fr")!;
    expect((fr["@properties"] as Record<string, unknown>).city).toEqual({ "@label": "Ville" });
  });

  it("updates type docs and removes emptied entries", () => {
    const next = withDocumentation(cls, {
      typeDocs: { default: { label: "Beast" }, translations: {} },
    }) as unknown as Record<string, unknown>;
    const docs = next["@documentation"] as Array<Record<string, unknown>>;
    const def = docs.find((e) => e["@language"] === undefined)!;
    expect(def["@label"]).toBe("Beast");
    expect(def["@comment"]).toBeUndefined();
    // sv entry keeps @properties but loses its type-level label/comment
    const sv = docs.find((e) => e["@language"] === "sv")!;
    expect(sv["@label"]).toBeUndefined();
    expect(sv["@properties"]).toBeDefined();
  });

  it("deletes @documentation when everything is empty", () => {
    const bare = { "@type": "Class", "@id": "X", "@documentation": [{ "@label": "x" }] } as unknown as SchemaClass;
    const next = withDocumentation(bare, { typeDocs: { default: {}, translations: {} } }) as unknown as Record<string, unknown>;
    expect("@documentation" in next).toBe(false);
  });

  it("retags the untagged entry when the update goes multilingual", () => {
    // untagged entry carries another field's docs — retagging must preserve them
    const mono = {
      "@type": "Class", "@id": "Y",
      "@documentation": [{ "@properties": { other: { "@label": "Other" }, p: { "@label": "Old" } } }],
    } as unknown as SchemaClass;
    const next = withDocumentation(mono, {
      propName: "p",
      propDocs: { default: {}, translations: { en: { label: "New" }, sv: { label: "Ny" } } },
      defaultLang: "en",
    }) as unknown as Record<string, unknown>;
    const docs = next["@documentation"] as Array<Record<string, unknown>>;
    expect(docs.every((e) => e["@language"] !== undefined)).toBe(true);
    const en = docs.find((e) => e["@language"] === "en")!;
    const props = en["@properties"] as Record<string, unknown>;
    expect(props.other).toEqual({ "@label": "Other" });
    expect(props.p).toEqual({ "@label": "New" });
    const sv = docs.find((e) => e["@language"] === "sv")!;
    expect((sv["@properties"] as Record<string, unknown>).p).toEqual({ "@label": "Ny" });
  });

  it("throws when a multilingual update lacks defaultLang for the untagged entry", () => {
    const mono = {
      "@type": "Class", "@id": "Z",
      "@documentation": [{ "@properties": { other: { "@label": "Other" } } }],
    } as unknown as SchemaClass;
    expect(() =>
      withDocumentation(mono, {
        propName: "p",
        propDocs: { default: {}, translations: { en: { label: "x" } } },
      })
    ).toThrow(/defaultLang/);
  });

  it("does not create an untagged entry in a multilingual update", () => {
    const bare = { "@type": "Class", "@id": "W" } as unknown as SchemaClass;
    const next = withDocumentation(bare, {
      propName: "p",
      propDocs: { default: { label: "ignored" }, translations: { en: { label: "x" } } },
    }) as unknown as Record<string, unknown>;
    const docs = next["@documentation"] as Array<Record<string, unknown>>;
    expect(docs.every((e) => e["@language"] !== undefined)).toBe(true);
  });
});
