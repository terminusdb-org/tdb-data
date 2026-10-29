// @vitest-environment node
import { describe, expect, it } from "vitest";
import { editableFeaturesFor, mandatoryInheritedProps } from "./MetadataModal";
import type { SchemaModel } from "@/lib/schemaModel/types";

const cls = (id: string, props: Record<string, { multiplicity?: string }>, inherits?: string[]) =>
  ({
    id,
    label: "",
    description: "",
    type: "type",
    typeDefinition: {
      id,
      type: "type",
      ...(inherits && { inherits }),
      propertyDefinitions: Object.fromEntries(
        Object.entries(props).map(([name, p]) => [name, { name, type: "string", multiplicity: p.multiplicity ?? "Optional" }])
      ),
    },
  }) as SchemaModel[string];

describe("mandatoryInheritedProps", () => {
  const model: SchemaModel = {
    Grand: cls("Grand", { g1: { multiplicity: "Mandatory" }, g2: {} }),
    Par: cls("Par", { p1: { multiplicity: "Mandatory" } }, ["Grand"]),
    Child: cls("Child", { own1: { multiplicity: "Mandatory" } }),
    Empty: cls("Empty", {}),
  };

  it("collects mandatory props transitively", () => {
    expect(mandatoryInheritedProps(model, "Child", ["Par"]).sort()).toEqual(["g1", "p1"]);
  });

  it("skips optional and self-defined props", () => {
    const m2: SchemaModel = { ...model, Child: cls("Child", { g1: { multiplicity: "Optional" } }) };
    expect(mandatoryInheritedProps(m2, "Child", ["Grand"])).toEqual([]);
  });

  it("returns empty for parentless targets", () => {
    expect(mandatoryInheritedProps(model, "Child", ["Empty"])).toEqual([]);
  });

  it("is cycle-safe", () => {
    const m3: SchemaModel = { A: cls("A", { f: { multiplicity: "Mandatory" } }, ["B"]), B: cls("B", {}, ["A"]) };
    expect(mandatoryInheritedProps(m3, "Child", ["A"])).toEqual(["f"]);
  });
});

describe("editableFeaturesFor", () => {
  const kinds = { key: false, parents: false, flags: false };
  it("classes and traits get the full matrix", () => {
    expect(editableFeaturesFor("type")).toEqual({ docs: true, metadata: true, key: true, parents: true, flags: true });
    expect(editableFeaturesFor("trait")).toEqual({ docs: true, metadata: true, key: true, parents: true, flags: true });
  });
  it("enum/taggedunion/foreign get docs+metadata only", () => {
    for (const k of ["enumtrait", "taggedunion", "foreign", "unit", ""]) {
      expect(editableFeaturesFor(k)).toEqual({ docs: true, metadata: true, ...kinds });
    }
  });
});
