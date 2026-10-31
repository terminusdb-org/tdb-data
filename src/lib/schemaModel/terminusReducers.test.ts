// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  castTerminusValue,
  getCleanProperties,
  getTerminusPropertyDefinition,
  getZebraPropertyDefinition,
  reduceTerminusSchemaToZebra,
  reduceZebraSchemaToTerminus,
  TerminusSchemaObject,
} from "./terminusReducers";
import { terminusTestSchema } from "./__fixtures__/terminusBaseObjects";
import { terminusEnum } from "./__fixtures__/myEnum";
import { terminusMyForeign } from "./__fixtures__/myForeign";
import { terminusMyTaggedUnion } from "./__fixtures__/myTaggedUnion";
import { terminusDocSchemaMyCardinality } from "./__fixtures__/myCardinality";
import { zebraSubDocSchema } from "./__fixtures__/myTestTrait";
import { terminusDocSchemaMyTestId } from "./__fixtures__/myTestId";
import { terminusMyArray } from "./__fixtures__/myArray";

const schema = terminusTestSchema as TerminusSchemaObject;

describe("reduceTerminusSchemaToZebra", () => {
  it("reduces an enum with values, docs and translations", () => {
    const td = reduceTerminusSchemaToZebra(schema, "myEnum");
    expect(td.type).toBe("enumtrait");
    expect(td.enumValues).toEqual(["value"]);
    expect(td.valuesMetadata?.value).toEqual({ description: "myValue" });
    expect(td.translations?.sv_SE.propertyDocumentation.value).toEqual({
      comment: "Kommentar om mittvärde",
      label: "mittVärde",
    });
    expect(td.metaData?.comment).toBe("Myclass");
  });

  it("reduces a Foreign", () => {
    const td = reduceTerminusSchemaToZebra({ myForeign: terminusMyForeign }, "myForeign");
    expect(td.type).toBe("foreign");
  });

  it("reduces a TaggedUnion with mandatory fields", () => {
    const td = reduceTerminusSchemaToZebra({ t: terminusMyTaggedUnion }, "t");
    expect(td.type).toBe("taggedunion");
    expect(td.propertyDefinitions?.leaf).toMatchObject({ name: "leaf", type: "integer", multiplicity: "Mandatory" });
    expect(td.propertyDefinitions?.trunk).toMatchObject({ type: "string", multiplicity: "Mandatory" });
  });

  it("reduces a subdocument Class to kind trait", () => {
    const td = reduceTerminusSchemaToZebra(schema, "myTestTrait");
    expect(td.type).toBe("trait");
    expect(td.keyDefinition).toEqual({ type: "Random" });
    expect(td.propertyDefinitions?.label).toMatchObject({ type: "string", multiplicity: "Optional" });
    expect(td.propertyDefinitions?.linkedRecord).toMatchObject({ linkedType: "app.dfrnt.record", type: "linkedType" });
    expect(td.propertyDefinitions?.linkedRecord.metaData).toEqual({ description: "Some comment" });
  });

  it("reduces Cardinality parameters (@cardinality/@min/@max)", () => {
    const td = reduceTerminusSchemaToZebra({ c: terminusDocSchemaMyCardinality }, "c");
    expect(td.propertyDefinitions?.cardinalityOne).toMatchObject({ multiplicity: "Cardinality", cardinality: 1 });
    expect(td.propertyDefinitions?.cardinalityMinOne).toMatchObject({ minCardinality: 1 });
    expect(td.propertyDefinitions?.cardinalityMaxOne).toMatchObject({ maxCardinality: 1 });
    expect(td.propertyDefinitions?.cardinalityMinOneMaxFour).toMatchObject({ minCardinality: 1, maxCardinality: 4 });
  });
});

describe("linked-class detection (getCleanProperties)", () => {
  it("detects linkedType for plain classes", () => {
    const td = reduceTerminusSchemaToZebra(schema, "myTestId");
    expect(td.propertyDefinitions?.description).toMatchObject({ linkedType: "app.dfrnt.record", type: "linkedType" });
  });

  it("detects linkedTrait for subdocuments", () => {
    const td = reduceTerminusSchemaToZebra(schema, "myTestId");
    expect(td.propertyDefinitions?.["crm:descriptionSet"]).toMatchObject({
      linkedTrait: "myTestTrait",
      type: "linkedTrait",
      multiplicity: "Set",
    });
  });

  it("detects linkedEnum and linkedForeign", () => {
    const td = reduceTerminusSchemaToZebra(schema, "myTestId");
    expect(td.propertyDefinitions?.descriptionSetEnum).toMatchObject({ linkedEnum: "myEnum", type: "linkedEnum", multiplicity: "Set" });
    expect(td.propertyDefinitions?.descriptionForeign).toMatchObject({
      linkedForeign: "myForeign",
      type: "linkedForeign",
      multiplicity: "Foreign",
    });
  });

  it("detects cardinality-bounded linked traits (#1932)", () => {
    const td = reduceTerminusSchemaToZebra(schema, "myTestId");
    expect(td.propertyDefinitions?.descriptionCardinality).toMatchObject({
      linkedTrait: "myTestTrait",
      minCardinality: 1,
      maxCardinality: 100,
    });
  });
});

describe("reduceZebraSchemaToTerminus round-trip", () => {
  it("round-trips a subdocument class", () => {
    const back = reduceZebraSchemaToTerminus(zebraSubDocSchema);
    expect(back["@type"]).toBe("Class");
    expect(back["@id"]).toBe("myTestTrait");
    expect(back["@subdocument"]).toEqual([]);
    expect(back["@key"]).toEqual({ "@type": "Random" });
    expect(back.linkedRecord).toBe("app.dfrnt.record");
    expect(back.label).toEqual({ "@type": "Optional", "@class": "xsd:string" });
    expect(back["@documentation"]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ "@comment": "Myclass", "@properties": { linkedRecord: "Some comment" } }),
      ])
    );
  });

  it("round-trips an enum", () => {
    const back = reduceZebraSchemaToTerminus(reduceTerminusSchemaToZebra({ e: terminusEnum }, "e"));
    expect(back["@type"]).toBe("Enum");
    expect(back["@value"]).toEqual(["value"]);
  });
});

describe("castTerminusValue / mapProperties", () => {
  it("encodes mandatory as a bare string", () => {
    expect(castTerminusValue({ name: "p", type: "string", multiplicity: "Mandatory" })).toEqual({ p: "xsd:string" });
  });
  it("encodes Optional/Set/List wrappers", () => {
    expect(castTerminusValue({ name: "p", type: "string", multiplicity: "Optional" })).toEqual({
      p: { "@type": "Optional", "@class": "xsd:string" },
    });
    expect(castTerminusValue({ name: "p", type: "integer", multiplicity: "Set" })).toEqual({
      p: { "@type": "Set", "@class": "xsd:integer" },
    });
    expect(castTerminusValue({ name: "p", type: "string", multiplicity: "List" })).toEqual({
      p: { "@type": "List", "@class": "xsd:string" },
    });
  });
  it("encodes linked types via linkedType/linkedTrait/linkedEnum/linkedForeign/linkedTaggedUnion", () => {
    expect(castTerminusValue({ name: "p", type: "linkedType", multiplicity: "Mandatory", linkedType: "Person" })).toEqual(
      { p: "Person" }
    );
    expect(castTerminusValue({ name: "p", type: "linkedTrait", multiplicity: "Set", linkedTrait: "Address" })).toEqual({
      p: { "@type": "Set", "@class": "Address" },
    });
    expect(castTerminusValue({ name: "p", type: "linkedEnum", multiplicity: "Optional", linkedEnum: "Color" })).toEqual({
      p: { "@type": "Optional", "@class": "Color" },
    });
    expect(
      castTerminusValue({ name: "p", type: "linkedTaggedUnion", multiplicity: "Mandatory", linkedTaggedUnion: "Shape" })
    ).toEqual({ p: "Shape" });
  });
  it("encodes Cardinality and Array parameters", () => {
    expect(
      castTerminusValue({ name: "p", type: "string", multiplicity: "Cardinality", minCardinality: 1, maxCardinality: 4 })
    ).toEqual({ p: { "@type": "Cardinality", "@class": "xsd:string", "@min_cardinality": 1, "@max_cardinality": 4 } });
    expect(castTerminusValue({ name: "p", type: "decimal", multiplicity: "Array", dimensions: 2 })).toEqual({
      p: { "@type": "Array", "@class": "xsd:decimal", "@dimensions": 2 },
    });
  });
});

describe("getTerminusPropertyDefinition / getZebraPropertyDefinition", () => {
  it("reads a terminus spec into zebra form", () => {
    const normalized = getTerminusPropertyDefinition({ "@type": "Set", "@class": "xsd:string" });
    const zebra = getZebraPropertyDefinition("p", normalized, {});
    expect(zebra.multiplicity).toBe("Set");
    expect(zebra.type).toBe("string");
    expect(getTerminusPropertyDefinition("xsd:string")).toEqual({ "@class": "xsd:string", "@type": "Mandatory" });
  });
  it("keeps Array spec shape", () => {
    const td = reduceTerminusSchemaToZebra({ a: terminusMyArray }, "a");
    expect(td.propertyDefinitions?.arrayTwoDimensions).toMatchObject({ multiplicity: "Array", dimensions: 2 });
  });
});

describe("getCleanProperties", () => {
  it("excludes @-prefixed keys", () => {
    const clean = getCleanProperties(schema, terminusDocSchemaMyTestId);
    expect(Object.keys(clean).every((k) => !k.startsWith("@"))).toBe(true);
    expect(clean.label2).toEqual({ "@class": "xsd:string", "@type": "Mandatory" });
  });
});
