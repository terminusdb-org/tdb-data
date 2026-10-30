// @vitest-environment node
import { describe, expect, it } from "vitest";
import { exampleFromJsonSchema } from "./exampleDocument";
import type { SchemaModel } from "./types";

describe("exampleFromJsonSchema", () => {
  it("emits an example for every property of an object", () => {
    const out = exampleFromJsonSchema({
      type: "object",
      properties: { name: { type: "string" }, age: { type: "integer" }, ok: { type: "boolean" } },
    });
    expect(out).toEqual({ name: "example name", age: 42, ok: true });
  });

  it("names @id and @type from x-terminusdb type_choices", () => {
    const out = exampleFromJsonSchema({
      type: "object",
      "x-terminusdb": { type_choices: ["Person"] },
      properties: { "@id": { type: "string" }, "@type": { type: "string" } },
    }) as Record<string, unknown>;
    expect(out["@id"]).toBe("Person/Example");
    expect(out["@type"]).toBe("Person");
  });

  it("uses the first of several type_choices for @type and @id", () => {
    const out = exampleFromJsonSchema({
      type: "object",
      "x-terminusdb": { type_choices: ["MemberA", "MemberB"] },
      properties: { "@id": { type: "string" }, "@type": { type: "string" } },
    }) as Record<string, unknown>;
    expect(out["@type"]).toBe("MemberA");
    expect(out["@id"]).toBe("MemberA/Example");
  });

  it("renders a link-typed string as a typed reference", () => {
    const out = exampleFromJsonSchema({
      type: "object",
      properties: { friend: { type: "string", "x-terminusdb": { link: "Person" } } },
    }) as Record<string, unknown>;
    expect(out.friend).toEqual({ "@type": "Person", "@id": "Person/Example" });
  });

  it("renders a stricted link oneOf as a typed reference", () => {
    const out = exampleFromJsonSchema({
      type: "object",
      properties: {
        friend: {
          "x-terminusdb": { link: "Person" },
          oneOf: [
            { type: "string" },
            { type: "object", required: ["@type", "@id"], properties: { "@type": { type: "string" }, "@id": { type: "string" } } },
          ],
        },
      },
    }) as Record<string, unknown>;
    expect(out.friend).toEqual({ "@type": "Person", "@id": "Person/Example" });
  });

  it("renders document list items as typed references", () => {
    const out = exampleFromJsonSchema({
      type: "object",
      properties: {
        list_objects: { type: "array", items: { type: "string", "x-terminusdb": { link: "MyclassList" } } },
      },
    }) as Record<string, unknown>;
    expect(out.list_objects).toEqual([{ "@type": "MyclassList", "@id": "MyclassList/Example" }]);
  });

  it("expands a nested subdocument object", () => {
    const out = exampleFromJsonSchema({
      type: "object",
      properties: {
        address: {
          type: "object",
          "x-terminusdb": { subdocument: true, type_choices: ["Address"] },
          properties: { "@id": { type: "string" }, "@type": { type: "string" }, city: { type: "string" } },
        },
      },
    }) as Record<string, unknown>;
    const addr = out.address as Record<string, unknown>;
    expect(addr["@type"]).toBe("Address");
    expect(addr["@id"]).toBeUndefined();
    expect(addr.city).toBe("example city");
  });

  it("uses the first enum value", () => {
    expect(exampleFromJsonSchema({ type: "string", enum: ["red", "blue"] })).toBe("red");
  });

  it("uses the first branch of a oneOf", () => {
    const out = exampleFromJsonSchema({
      oneOf: [
        { enum: ["a"], type: "string" },
        { enum: ["b"], type: "string" },
      ],
    });
    expect(out).toBe("a");
  });

  it("merges all anyOf branches so every variant is shown", () => {
    const out = exampleFromJsonSchema({
      type: "object",
      properties: { id: { type: "string" } },
      anyOf: [
        { oneOf: [{ properties: { a: { type: "string" } }, required: ["a"] }, { properties: { b: { type: "string" } }, required: ["b"] }] },
        { oneOf: [{ properties: { c: { type: "string" } }, required: ["c"] }] },
      ],
    }) as Record<string, unknown>;
    expect(out.a).toBe("example a");
    expect(out.c).toBe("example c");
    expect(out.b).toBeUndefined();
  });

  it("fills an array with minItems or one item", () => {
    expect(exampleFromJsonSchema({ type: "array", items: { type: "number" } })).toEqual([42]);
    expect(exampleFromJsonSchema({ type: "array", minItems: 2, items: { type: "number" } })).toEqual([42, 42]);
  });

  it("emits format-aware strings", () => {
    expect(exampleFromJsonSchema({ type: "string", format: "date-time" })).toBe("2024-01-15T09:30:00Z");
    expect(exampleFromJsonSchema({ type: "string", format: "date" })).toBe("2024-01-15");
    expect(exampleFromJsonSchema({ type: "string", format: "email" })).toBe("user@example.com");
    expect(exampleFromJsonSchema({ type: "string", format: "uri" })).toBe("https://example.com/");
  });

  it("resolves $ref against definitions and guards recursion", () => {
    const out = exampleFromJsonSchema({
      type: "object",
      definitions: {
        Node: {
          type: "object",
          "x-terminusdb": { type_choices: ["Node"] },
          properties: { next: { $ref: "#/definitions/Node" }, "@id": { type: "string" } },
        },
      },
      properties: { head: { $ref: "#/definitions/Node" } },
    }) as Record<string, unknown>;
    const head = out.head as Record<string, unknown>;
    expect(head["@id"]).toBe("Node/Example");
    // Recursion stops: the nested `next` link renders as a typed reference.
    expect(head.next).toEqual({ "@type": "Node", "@id": "Node/Example" });
  });

  it("resolves nested definition paths like EnumtraitValues/Color", () => {
    const out = exampleFromJsonSchema({
      type: "object",
      definitions: { EnumtraitValues: { Color: { oneOf: [{ enum: ["red"], type: "string" }] } } },
      properties: { colour: { $ref: "#/definitions/EnumtraitValues/Color" } },
    }) as Record<string, unknown>;
    expect(out.colour).toBe("red");
  });

  it("honours numeric minimum when it exceeds the default", () => {
    expect(exampleFromJsonSchema({ type: "integer", minimum: 100 })).toBe(100);
  });

  describe("taggedunion links", () => {
    const model: SchemaModel = {
      Test: {
        id: "Test",
        label: "Test",
        description: "",
        type: "taggedunion" as const,
        typeDefinition: {
          id: "Test",
          type: "taggedunion" as const,
          propertyDefinitionsOneOf: [
            {
              city: { name: "city", type: "string", multiplicity: "Optional" },
              tags: { name: "tags", type: "string", multiplicity: "Set" },
            },
          ],
        },
      },
      Colour: {
        id: "Colour",
        label: "Colour",
        description: "",
        type: "enumtrait" as const,
        typeDefinition: { id: "Colour", type: "enumtrait" as const, enumValues: ["red", "blue"] },
      },
      Empty: {
        id: "Empty",
        label: "Empty",
        description: "",
        type: "taggedunion" as const,
        typeDefinition: { id: "Empty", type: "taggedunion" as const, propertyDefinitionsOneOf: [{}] },
      },
    };

    it("fills member fields so the implied document satisfies a member", () => {
      const out = exampleFromJsonSchema(
        { type: "object", properties: { f30: { type: "string", "x-terminusdb": { link: "Test" } } } },
        model
      ) as Record<string, Record<string, unknown>>;
      // Engine rule: a taggedunion document must store at least one member
      // field — Optional means "at most one value when present", not
      // "absence satisfies the choice".
      expect(out.f30).toEqual({
        "@type": "Test",
        "@id": "Test/Example",
        city: "example city",
        tags: ["example tags"],
      });
    });

    it("emits the first enum value for an enum member field", () => {
      const m: SchemaModel = {
        U: {
          id: "U",
          label: "U",
          description: "",
          type: "taggedunion" as const,
          typeDefinition: {
            id: "U",
            type: "taggedunion" as const,
            propertyDefinitionsOneOf: [
              { colour: { name: "colour", type: "string", multiplicity: "Mandatory", linkedEnum: "Colour" } },
            ],
          },
        },
        Colour: model.Colour,
      };
      const out = exampleFromJsonSchema(
        { type: "object", properties: { u: { type: "string", "x-terminusdb": { link: "U" } } } },
        m
      ) as Record<string, Record<string, unknown>>;
      expect(out.u).toEqual({ "@type": "U", "@id": "U/Example", colour: "red" });
    });

    it("leaves a vacuous member (empty oneOf branch) as a bare ref", () => {
      const out = exampleFromJsonSchema(
        { type: "object", properties: { e: { type: "string", "x-terminusdb": { link: "Empty" } } } },
        model
      ) as Record<string, Record<string, unknown>>;
      expect(out.e).toEqual({ "@type": "Empty", "@id": "Empty/Example" });
    });
  });
});
