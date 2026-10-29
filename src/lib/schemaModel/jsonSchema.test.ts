// @vitest-environment node
import { describe, expect, it } from "vitest";
import { strictJsonSchema, mandatoryFieldNames } from "./jsonSchema";
import type { SchemaModel } from "./types";

const model: SchemaModel = {
  Address: {
    id: "Address",
    label: "",
    description: "",
    type: "trait",
    typeDefinition: {
      id: "Address",
      type: "trait",
      propertyDefinitions: {
        city: { name: "city", type: "string", multiplicity: "Mandatory" },
        zip: { name: "zip", type: "string", multiplicity: "Optional" },
      },
    },
  },
};

describe("mandatoryFieldNames", () => {
  it("returns mandatory own fields only", () => {
    expect(mandatoryFieldNames(model, "Address")).toEqual(["city"]);
  });
  it("returns empty for unknown class", () => {
    expect(mandatoryFieldNames(model, "Nope")).toEqual([]);
  });
});

describe("strictJsonSchema", () => {
  it("closes objects and fills required for known classes", () => {
    const schema = {
      type: "object",
      properties: {
        address: {
          type: "object",
          properties: { city: { type: "string" } },
          required: [],
          "x-terminusdb": { subdocument: true, type_choices: ["Address"] },
        },
      },
      required: ["address"],
    };
    const out = strictJsonSchema(schema, model) as { additionalProperties?: boolean; required?: string[]; properties: Record<string, { additionalProperties?: boolean; required?: string[] }> };
    expect(out.additionalProperties).toBe(false);
    const addr = out.properties.address;
    expect(addr.additionalProperties).toBe(false);
    expect(addr.required).toEqual(["city"]);
    expect(out.required).toEqual(["address"]);
  });

  it("leaves required untouched for unknown types and non-objects", () => {
    const schema = { type: "object", properties: { n: { type: "string" } } };
    const out = strictJsonSchema(schema, model) as { additionalProperties?: boolean; required?: string[] };
    expect(out.required).toBeUndefined();
    expect(out.additionalProperties).toBe(false);
  });
});
