// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  indexTerminusClasses,
  reduceTerminusSchemaFromZebraSchema,
  reduceZebraSchemaFromTerminusSchema,
} from "./schemaReducer";
import { TerminusSchemaObject } from "./terminusReducers";
import { terminusTestSchema } from "./__fixtures__/terminusBaseObjects";

const inheritanceSchema: TerminusSchemaObject = {
  Base: {
    "@type": "Class",
    "@id": "Base",
    "@key": { "@type": "Random" },
    baseField: "xsd:string",
  },
  Mid: {
    "@type": "Class",
    "@id": "Mid",
    "@key": { "@type": "Random" },
    "@inherits": "Base",
    midField: { "@type": "Optional", "@class": "xsd:string" },
  },
  Leaf: {
    "@type": "Class",
    "@id": "Leaf",
    "@key": { "@type": "Random" },
    "@inherits": ["Mid", "Other"],
    leafField: "xsd:integer",
  },
  Other: {
    "@type": "Class",
    "@id": "Other",
    "@key": { "@type": "Random" },
    otherField: "xsd:boolean",
  },
};

describe("indexTerminusClasses", () => {
  it("indexes schema docs by @id and drops entries without @id", () => {
    const indexed = indexTerminusClasses({
      A: { "@id": "A", "@type": "Class" },
      noId: { "@type": "Class" } as never,
    });
    expect(Object.keys(indexed)).toEqual(["A"]);
  });
});

describe("reduceZebraSchemaFromTerminusSchema", () => {
  it("produces a SchemaModel keyed by class id", () => {
    const model = reduceZebraSchemaFromTerminusSchema(terminusTestSchema as TerminusSchemaObject);
    expect(model.myTestId.typeDefinition.id).toBe("myTestId");
    expect(model.myEnum.type).toBe("enumtrait");
    expect(model.myTestTrait.type).toBe("trait");
  });

  it("computes inheritedPropertyDefinitions transitively", () => {
    const model = reduceZebraSchemaFromTerminusSchema(inheritanceSchema);
    expect(model.Mid.typeDefinition.inheritedPropertyDefinitions?.baseField).toMatchObject({ type: "string" });
    expect(model.Leaf.typeDefinition.inheritedPropertyDefinitions?.baseField).toBeDefined();
    expect(model.Leaf.typeDefinition.inheritedPropertyDefinitions?.midField).toBeDefined();
    expect(model.Leaf.typeDefinition.inheritedPropertyDefinitions?.otherField).toMatchObject({ type: "boolean" });
  });

  it("keeps own props out of inherited set and builds subsumed index", () => {
    const model = reduceZebraSchemaFromTerminusSchema(inheritanceSchema);
    expect(model.Leaf.typeDefinition.inheritedPropertyDefinitions?.leafField).toBeUndefined();
    expect(model.Base.typeDefinition.subsumed).toEqual(["Mid"]);
    expect(model.Mid.typeDefinition.subsumed).toEqual(["Leaf"]);
    expect(model.Other.typeDefinition.subsumed).toEqual(["Leaf"]);
  });

  it("handles multiple @inherits (string or array)", () => {
    const model = reduceZebraSchemaFromTerminusSchema(inheritanceSchema);
    expect(model.Mid.typeDefinition.inherits).toEqual(["Base"]);
    expect(model.Leaf.typeDefinition.inherits).toEqual(["Mid", "Other"]);
  });
});

describe("reduceTerminusSchemaFromZebraSchema", () => {
  it("emits terminus docs for every model element", () => {
    const model = reduceZebraSchemaFromTerminusSchema(inheritanceSchema);
    const docs = reduceTerminusSchemaFromZebraSchema(model);
    expect(docs.Leaf["@type"]).toBe("Class");
    expect(docs.Leaf["@inherits"]).toEqual(["Mid", "Other"]);
    expect(docs.Base.baseField).toBe("xsd:string");
  });
});
