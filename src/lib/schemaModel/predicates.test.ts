// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildPredicateIndex, specsEqual } from "./predicates";
import { reduceZebraSchemaFromTerminusSchema } from "./schemaReducer";
import { TerminusSchemaObject } from "./terminusReducers";

const schema: TerminusSchemaObject = {
  Person: {
    "@type": "Class",
    "@id": "Person",
    "@key": { "@type": "Random" },
    name: "xsd:string",
    "@documentation": { "@properties": { name: "Full legal name" } },
  },
  Company: {
    "@type": "Class",
    "@id": "Company",
    "@key": { "@type": "Random" },
    name: { "@type": "Set", "@class": "xsd:string" }, // same name, different spec → overload
    founded: "xsd:date",
  },
  Pet: {
    "@type": "Class",
    "@id": "Pet",
    "@key": { "@type": "Random" },
    name: "xsd:string", // same spec as Person — reuse, not overload
  },
  Color: { "@type": "Enum", "@id": "Color", "@value": ["red"] },
};

describe("buildPredicateIndex", () => {
  const idx = buildPredicateIndex(reduceZebraSchemaFromTerminusSchema(schema));

  it("indexes every property name across classes", () => {
    expect(Object.keys(idx).sort()).toEqual(["founded", "name"]);
  });

  it("records each defining element and its spec", () => {
    const defs = idx.name.defs;
    expect(defs.map((d) => d.elementId).sort()).toEqual(["Company", "Person", "Pet"]);
    expect(defs.find((d) => d.elementId === "Person")?.spec).toBe("xsd:string");
    expect(defs.find((d) => d.elementId === "Company")?.spec).toEqual({ "@type": "Set", "@class": "xsd:string" });
  });

  it("attaches predicate documentation", () => {
    expect(idx.name.defs.find((d) => d.elementId === "Person")?.doc).toEqual({ description: "Full legal name" });
  });

  it("surfaces multiple definitions as distinct specs", () => {
    const distinct = new Set(idx.name.defs.map((d) => JSON.stringify(d.spec)));
    expect(distinct.size).toBe(2); // xsd:string vs Set xsd:string
  });

  it("ignores non-class schema objects (enums contribute no predicates)", () => {
    expect(idx.name.defs.every((d) => d.elementId !== "Color")).toBe(true);
  });
});

describe("specsEqual", () => {
  it("deep-compares specs regardless of key order", () => {
    expect(specsEqual("xsd:string", "xsd:string")).toBe(true);
    expect(specsEqual({ "@type": "Set", "@class": "xsd:string" }, { "@class": "xsd:string", "@type": "Set" })).toBe(true);
    expect(specsEqual({ "@type": "Set" }, { "@type": "Optional" })).toBe(false);
    expect(specsEqual("xsd:string", { "@class": "xsd:string", "@type": "Mandatory" })).toBe(false);
  });
});
