// @vitest-environment node
import { describe, expect, it } from "vitest";
import { diffClassToOps, isStrengthening, newClassDoc, ops, specOf } from "./migrationOps";
import { ITypeDefinition } from "./types";

describe("ops builders", () => {
  it("builds the exact documented op shapes", () => {
    expect(ops.createClass({ "@type": "Class", "@id": "C", "@key": { "@type": "Random" } })).toEqual({
      "@type": "CreateClass",
      class_document: { "@type": "Class", "@id": "C", "@key": { "@type": "Random" } },
    });
    expect(ops.deleteClass("C")).toEqual({ "@type": "DeleteClass", class: "C" });
    expect(ops.moveClass("A", "B")).toEqual({ "@type": "MoveClass", from: "A", to: "B" });
    expect(ops.replaceClassMetadata("C", { a: 1 })).toEqual({ "@type": "ReplaceClassMetadata", class: "C", metadata: { a: 1 } });
    expect(ops.setAbstract("C", true)).toEqual({ "@type": "Abstract", class: "C" });
    expect(ops.setAbstract("C", false)).toEqual({ "@type": "NotAbstract", class: "C" });
    expect(ops.setUnfoldable("C", true)).toEqual({ "@type": "Unfoldable", class: "C" });
    expect(ops.replaceClassDocumentation("C", { "@label": "x" })).toEqual({
      "@type": "ReplaceClassDocumentation",
      class: "C",
      documentation: { "@label": "x" },
    });
    expect(ops.changeKey("C", "Lexical", ["a"])).toEqual({ "@type": "ChangeKey", class: "C", key: "Lexical", fields: ["a"] });
    expect(ops.changeKey("C", "Random")).toEqual({ "@type": "ChangeKey", class: "C", key: "Random" });
    expect(ops.changeParents("C", ["P"], [{ property: "f", default: "v" }])).toEqual({
      "@type": "ChangeParents",
      class: "C",
      parents: ["P"],
      properties: [{ property: "f", default: "v" }],
    });
    expect(ops.createClassProperty("C", "p", "xsd:string", "dflt")).toEqual({
      "@type": "CreateClassProperty",
      class: "C",
      property: "p",
      type: "xsd:string",
      default: "dflt",
    });
    expect(ops.deleteClassProperty("C", "p")).toEqual({ "@type": "DeleteClassProperty", class: "C", property: "p" });
    expect(ops.moveClassProperty("C", "a", "b")).toEqual({ "@type": "MoveClassProperty", class: "C", from: "a", to: "b" });
    expect(ops.upcastClassProperty("C", "p", { "@type": "Optional", "@class": "xsd:string" })).toEqual({
      "@type": "UpcastClassProperty",
      class: "C",
      property: "p",
      type: { "@type": "Optional", "@class": "xsd:string" },
    });
    expect(ops.castClassProperty("C", "p", "xsd:integer", "error")).toEqual({
      "@type": "CastClassProperty",
      class: "C",
      property: "p",
      type: "xsd:integer",
      default: { "@type": "Error" },
    });
    expect(ops.castClassProperty("C", "p", "xsd:integer", { value: 7 })).toEqual({
      "@type": "CastClassProperty",
      class: "C",
      property: "p",
      type: "xsd:integer",
      default: { "@type": "Default", value: 7 },
    });
    expect(ops.expandEnum("E", ["a", "b"])).toEqual({ "@type": "ExpandEnum", enum: "E", values: ["a", "b"] });
  });

  it("builds minimal class documents for inline-created targets", () => {
    expect(newClassDoc("C", "class")).toEqual({ "@type": "Class", "@id": "C", "@key": { "@type": "Random" } });
    expect(newClassDoc("S", "subdoc")).toEqual({ "@type": "Class", "@id": "S", "@key": { "@type": "Random" }, "@subdocument": [] });
    expect(newClassDoc("E", "enum")).toEqual({ "@type": "Enum", "@id": "E", "@value": [] });
    expect(newClassDoc("T", "taggedunion")).toEqual({ "@type": "TaggedUnion", "@id": "T" });
    expect(newClassDoc("F", "foreign")).toEqual({ "@type": "Foreign", "@id": "F" });
  });
});

describe("isStrengthening", () => {
  it.each([
    ["CreateClass"],
    ["ExpandEnum"],
    ["UpcastClassProperty"],
    ["ReplaceClassMetadata"],
    ["ReplaceClassDocumentation"],
    ["Abstract"],
    ["NotAbstract"],
    ["Unfoldable"],
    ["NotUnfoldable"],
  ])("marks %s weakening", (t) => {
    expect(isStrengthening({ "@type": t })).toBe(false);
  });
  it.each([
    ["DeleteClass"],
    ["MoveClass"],
    ["DeleteClassProperty"],
    ["MoveClassProperty"],
    ["CastClassProperty"],
    ["ChangeKey"],
    ["ChangeParents"],
  ])("marks %s strengthening", (t) => {
    expect(isStrengthening({ "@type": t })).toBe(true);
  });
  it("CreateClassProperty: weakening for optional-ish specs, strengthening for mandatory-with-default", () => {
    expect(
      isStrengthening({ "@type": "CreateClassProperty", class: "C", property: "p", type: { "@type": "Optional", "@class": "xsd:string" } })
    ).toBe(false);
    expect(
      isStrengthening({ "@type": "CreateClassProperty", class: "C", property: "p", type: { "@type": "Set", "@class": "xsd:string" } })
    ).toBe(false);
    expect(
      isStrengthening({
        "@type": "CreateClassProperty",
        class: "C",
        property: "p",
        type: "xsd:string",
        default: "x",
      })
    ).toBe(true);
    // Mandatory without default is illegal per docs — treat as strengthening so UI collects a default
    expect(isStrengthening({ "@type": "CreateClassProperty", class: "C", property: "p", type: "xsd:string" })).toBe(true);
    expect(
      isStrengthening({ "@type": "CreateClassProperty", class: "C", property: "p", type: { "@type": "List", "@class": "xsd:string" } })
    ).toBe(true);
  });
});

const before: ITypeDefinition = {
  id: "Person",
  type: "type",
  keyDefinition: { type: "Random" },
  propertyDefinitions: {
    name: { name: "name", type: "string", multiplicity: "Mandatory" },
    nick: { name: "nick", type: "string", multiplicity: "Optional" },
    age: { name: "age", type: "integer", multiplicity: "Optional" },
  },
};

describe("diffClassToOps", () => {
  it("emits CreateClassProperty for added fields, spec via specOf, on the target class", () => {
    const after = {
      propertyDefinitions: {
        ...before.propertyDefinitions!,
        tags: { name: "tags", type: "string" as const, multiplicity: "Set" as const },
      },
    };
    const result = diffClassToOps("Person", before, after);
    expect(result).toEqual([
      { "@type": "CreateClassProperty", class: "Person", property: "tags", type: { "@type": "Set", "@class": "xsd:string" } },
    ]);
  });

  it("targets the nested class id for nested edits", () => {
    const beforeNested: ITypeDefinition = { id: "Address", type: "trait", propertyDefinitions: {} };
    const after = {
      propertyDefinitions: {
        city: { name: "city", type: "string" as const, multiplicity: "Optional" as const },
      },
    };
    const result = diffClassToOps("Address", beforeNested, after);
    expect(result[0]).toMatchObject({ class: "Address", property: "city" });
  });

  it("adds default only when supplied for mandatory new fields", () => {
    const after = {
      propertyDefinitions: {
        ...before.propertyDefinitions!,
        code: { name: "code", type: "string" as const, multiplicity: "Mandatory" as const },
      },
      defaults: { code: { value: "n/a" } },
    };
    const result = diffClassToOps("Person", before, after);
    expect(result[0]).toMatchObject({ type: "xsd:string", default: "n/a" });
  });

  it("emits DeleteClassProperty for removed fields", () => {
    const result = diffClassToOps("Person", before, {
      propertyDefinitions: { name: before.propertyDefinitions!.name, age: before.propertyDefinitions!.age },
    });
    expect(result).toEqual([{ "@type": "DeleteClassProperty", class: "Person", property: "nick" }]);
  });

  it("emits MoveClassProperty for renames", () => {
    const result = diffClassToOps("Person", before, { renames: [{ from: "nick", to: "nickname" }] });
    expect(result).toEqual([{ "@type": "MoveClassProperty", class: "Person", from: "nick", to: "nickname" }]);
  });

  it("emits Upcast for weakening spec change (Mandatory→Optional)", () => {
    const after = {
      propertyDefinitions: {
        ...before.propertyDefinitions!,
        name: { name: "name", type: "string" as const, multiplicity: "Optional" as const },
      },
    };
    const result = diffClassToOps("Person", before, after);
    expect(result).toEqual([
      { "@type": "UpcastClassProperty", class: "Person", property: "name", type: { "@type": "Optional", "@class": "xsd:string" } },
    ]);
  });

  it("emits Cast for strengthening spec change (Optional→Mandatory), with error policy", () => {
    const after = {
      propertyDefinitions: {
        ...before.propertyDefinitions!,
        nick: { name: "nick", type: "string" as const, multiplicity: "Mandatory" as const },
      },
      defaults: { nick: "error" as const },
    };
    const result = diffClassToOps("Person", before, after);
    expect(result).toEqual([
      { "@type": "CastClassProperty", class: "Person", property: "nick", type: "xsd:string", default: { "@type": "Error" } },
    ]);
  });

  it("emits Cast for changed @class target (retype)", () => {
    const after = {
      propertyDefinitions: {
        ...before.propertyDefinitions!,
        age: { name: "age", type: "decimal" as const, multiplicity: "Optional" as const },
      },
      defaults: { age: "error" as const },
    };
    const result = diffClassToOps("Person", before, after);
    expect(result[0]["@type"]).toBe("CastClassProperty");
  });

  it("emits MoveClass first when id changes", () => {
    const result = diffClassToOps("Person", before, { id: "Human" });
    expect(result[0]).toEqual({ "@type": "MoveClass", from: "Person", to: "Human" });
  });

  it("keeps op order: rename class, rename props, deletes, adds, spec changes", () => {
    const after = {
      id: "Human",
      renames: [{ from: "nick", to: "nickname" }],
      propertyDefinitions: {
        name: before.propertyDefinitions!.name,
        nickname: { name: "nickname", type: "string" as const, multiplicity: "Optional" as const },
        newField: { name: "newField", type: "string" as const, multiplicity: "Optional" as const },
      },
    };
    const result = diffClassToOps("Person", before, after);
    const types = result.map((o) => o["@type"]);
    expect(types).toEqual(["MoveClass", "MoveClassProperty", "DeleteClassProperty", "CreateClassProperty"]);
  });
});

describe("specOf", () => {
  it("extracts the bare spec from a property definition", () => {
    expect(specOf({ name: "p", type: "string", multiplicity: "Optional" })).toEqual({
      "@type": "Optional",
      "@class": "xsd:string",
    });
  });
});
