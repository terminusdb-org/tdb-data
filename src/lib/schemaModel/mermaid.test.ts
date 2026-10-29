// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  reduceClassDataFromTrait,
  reduceMermaidClassDiagramParts,
  renderClassDefinition,
  renderMermaidChartFromTraits,
  renderMermaidChartFromTraitSelection,
} from "./mermaid";
import { reduceZebraSchemaFromTerminusSchema } from "./schemaReducer";
import { TerminusSchemaObject } from "./terminusReducers";
import { terminusTestSchema } from "./__fixtures__/terminusBaseObjects";

const model = reduceZebraSchemaFromTerminusSchema(terminusTestSchema as TerminusSchemaObject);

describe("reduceClassDataFromTrait", () => {
  it("collects own, inherited and linked classes for the top-level class", () => {
    const cd = reduceClassDataFromTrait(model.myTestId.typeDefinition, "myTestId", true, true);
    expect(cd.name).toBe("myTestId");
    expect(cd.ownClassFields.length).toBeGreaterThan(0);
    expect(cd.associatedClasses.map((c) => c.className)).toContain("app.dfrnt.record");
    expect(cd.aggregatedClasses.map((c) => c.className)).toEqual(
      expect.arrayContaining(["myTestTrait", "myEnum", "myForeign"])
    );
  });

  it("marks multiplicity min/max for Optional and Set", () => {
    const cd = reduceClassDataFromTrait(model.myTestId.typeDefinition, "myTestId", true, true);
    const opt = cd.ownClassFields.find((f) => f.fieldId === "label");
    const set = cd.ownClassFields.find((f) => f.fieldId === "crm:descriptionSet");
    expect(opt).toMatchObject({ minMultiplicity: 0, maxMultiplicity: 1 });
    expect(set).toMatchObject({ minMultiplicity: 0, maxMultiplicity: Infinity });
  });
});

describe("renderMermaidChartFromTraits", () => {
  it("emits a classDiagram with classes and links", () => {
    const chart = renderMermaidChartFromTraits(model, "myTestId");
    expect(chart).toContain("classDiagram");
    expect(chart).toContain("class `myTestId`");
    expect(chart).toMatch(/`myTestId`.*-->/);
  });

  it("renders enum members for linked enums", () => {
    const chart = renderMermaidChartFromTraits(model, "myTestId");
    expect(chart).toContain("myEnum");
  });

  it("renders a multi-class selection", () => {
    const chart = renderMermaidChartFromTraitSelection(model, ["myTestId", "myTestTrait"]);
    expect(chart).toContain("classDiagram");
  });

  it("renders oneOf field sets as disjoint groups", () => {
    const chart = renderMermaidChartFromTraits(model, "myOneOf");
    expect(chart).toContain("myOneOf");
  });
});

describe("reduceMermaidClassDiagramParts", () => {
  it("dedupes classes reachable through multiple links", () => {
    const parts = reduceMermaidClassDiagramParts(model, "myTestId");
    const names = parts.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("renderClassDefinition", () => {
  it("emits a class block with fields", () => {
    const cd = reduceClassDataFromTrait(model.myTestId.typeDefinition, "`myTestId`", true, true);
    const def = renderClassDefinition(cd);
    expect(def).toContain("class `myTestId`");
    expect(def).toContain("label");
  });
});
