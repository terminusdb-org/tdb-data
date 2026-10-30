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

  describe("enum fields", () => {
    // Enum values only resolve through the model — a plain {type:"string"}
    // schema node can't know the legal values.
    const enumLinkModel: SchemaModel = {
      Linked: {
        id: "Linked",
        label: "Linked",
        description: "",
        type: "type" as const,
        typeDefinition: {
          id: "Linked",
          type: "type" as const,
          propertyDefinitions: {
            sub: { name: "sub", type: "linkedTrait", multiplicity: "Optional", linkedTrait: "Sub" },
          },
        },
      },
      Sub: {
        id: "Sub",
        label: "Sub",
        description: "",
        type: "trait" as const,
        typeDefinition: {
          id: "Sub",
          type: "trait" as const,
          propertyDefinitions: {
            good: { name: "good", type: "string", multiplicity: "Optional", linkedEnum: "Colour" },
            bad: { name: "bad", type: "string", multiplicity: "Optional", linkedEnum: "EmptyEnum" },
          },
        },
      },
      Colour: {
        id: "Colour",
        label: "Colour",
        description: "",
        type: "enumtrait" as const,
        typeDefinition: { id: "Colour", type: "enumtrait" as const, enumValues: ["red", "blue"] },
      },
      EmptyEnum: {
        id: "EmptyEnum",
        label: "EmptyEnum",
        description: "",
        type: "enumtrait" as const,
        typeDefinition: { id: "EmptyEnum", type: "enumtrait" as const, enumValues: [] },
      },
    };

    it("emits the first declared value for a linked enum inside an expanded doc", () => {
      const out = exampleFromJsonSchema(
        { type: "object", properties: { l: { type: "string", "x-terminusdb": { link: "Linked" } } } },
        enumLinkModel
      ) as Record<string, Record<string, Record<string, unknown>>>;
      expect(out.l.sub.good).toBe("red");
    });

    // An enum with no @values admits no value — an Optional field typed by
    // it must be omitted, not filled with a guaranteed-invalid string.
    it("omits a field typed by an enum with no values", () => {
      const out = exampleFromJsonSchema(
        { type: "object", properties: { l: { type: "string", "x-terminusdb": { link: "Linked" } } } },
        enumLinkModel
      ) as Record<string, Record<string, Record<string, unknown>>>;
      expect("bad" in out.l.sub).toBe(false);
    });
  });

  describe("class links", () => {
    // A typed ref under upsert creates the implied document — it must be a
    // complete, valid document. Links therefore expand to a full example doc
    // with every schema field; a link to a class already emitted in the write
    // (self-links, repeats, cycles) becomes a ref to that doc's id.
    const mtxModel: SchemaModel = {
      Mtx: {
        id: "Mtx",
        label: "Mtx",
        description: "",
        type: "type",
        typeDefinition: {
          id: "Mtx",
          type: "type",
          propertyDefinitions: {
            t1: { name: "t1", type: "string", multiplicity: "Mandatory" },
            f37: { name: "f37", type: "linkedType", multiplicity: "Optional", linkedType: "Mtx" },
            f11: { name: "f11", type: "linkedTrait", multiplicity: "List", linkedTrait: "MtxSub" },
          },
        },
      },
      MtxSub: {
        id: "MtxSub",
        label: "MtxSub",
        description: "",
        type: "trait",
        typeDefinition: {
          id: "MtxSub",
          type: "trait",
          propertyDefinitions: { city: { name: "city", type: "string", multiplicity: "Mandatory" } },
        },
      },
    };
    const linkNode = (classId: string) => ({ type: "string", "x-terminusdb": { link: classId } });

    it("expands a linked class into a complete document with its fields", () => {
      const out = exampleFromJsonSchema(
        {
          type: "object",
          "x-terminusdb": { type_choices: ["Holder"] },
          properties: { "@id": { type: "string" }, "@type": { type: "string" }, link: linkNode("Mtx") },
        },
        mtxModel
      ) as Record<string, Record<string, unknown>>;
      expect(out.link["@type"]).toBe("Mtx");
      expect(out.link.t1).toBe("example t1");
      // linkedTrait is a subdocument — embedded inline, no fabricated @id.
      expect(out.link.f11).toEqual([{ "@type": "MtxSub", city: "example city" }]);
      // The expanded doc's self-link points back at itself as a bare id
      // string — a typed {@type,@id} object would upsert an empty document.
      expect(out.link.f37).toBe("Mtx/Example");
    });

    it("points a self-link at the root document's id", () => {
      const out = exampleFromJsonSchema(
        {
          type: "object",
          "x-terminusdb": { type_choices: ["Mtx"] },
          properties: { "@id": { type: "string" }, "@type": { type: "string" }, f37: linkNode("Mtx") },
        },
        mtxModel
      ) as Record<string, Record<string, unknown>>;
      expect(out["@id"]).toBe("Mtx/Example");
      expect(out.f37).toBe("Mtx/Example");
    });

    it("points a repeated link at the emitted doc as a bare id string", () => {
      const out = exampleFromJsonSchema(
        {
          type: "object",
          "x-terminusdb": { type_choices: ["Holder"] },
          properties: { "@id": { type: "string" }, "@type": { type: "string" }, a: linkNode("Mtx"), b: linkNode("Mtx") },
        },
        mtxModel
      ) as Record<string, Record<string, unknown>>;
      expect(out.b).toBe("Mtx/Example");
      expect(out.a["@id"]).toBe("Mtx/Example");
    });
  });
});
