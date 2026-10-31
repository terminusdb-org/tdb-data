import { SchemaModel } from "../types";
import { TerminusSchemaObject } from "../terminusReducers";
import { terminusDocSchemaMyTestId, zebraMyTestId } from "./myTestId";
import { terminusSubDocSchema, zebraMyTestTrait } from "./myTestTrait";
import { terminusEnum, zebraMyEnum } from "./myEnum";
import { appDfrntRecord, zebraAppDfrntRecord } from "./appDfrntRecord";
import { terminusDfrntPrefixed, zebraDfrntPrefixedSchema } from "./dfrntPrefixed";
import { terminusDocSchemaModelWorkaround, terminusDocSchemaMyCardinality, zebraMyCardinality } from "./myCardinality";
import { terminusMyForeign, zebraMyForeign } from "./myForeign";
import { terminusMyArray, zebraMyArray } from "./myArray";
import { terminusMyTaggedUnion, zebraMyTaggedUnion } from "./myTaggedUnion";
import { terminusMyOneOf, zebraMyOneOf } from "./myOneOf";
import { ITypeDefinition } from "../types";

export const terminusTestSchema: TerminusSchemaObject = {
  "app.dfrnt.record": appDfrntRecord,
  "dfrnt:Prefixed": terminusDfrntPrefixed,
  myTestId: terminusDocSchemaMyTestId,
  myTestTrait: terminusSubDocSchema,
  myEnum: terminusEnum,
  myCardinality: terminusDocSchemaMyCardinality,
  myCardinalityModelWorkaround: terminusDocSchemaModelWorkaround,
  myForeign: terminusMyForeign,
  myArray: terminusMyArray,
  myTaggedUnion: terminusMyTaggedUnion,
  myOneOf: terminusMyOneOf,
};

export const zebraTestSchema: SchemaModel = {
  "app.dfrnt.record": zebraAppDfrntRecord,
  "dfrnt:Prefixed": zebraDfrntPrefixedSchema,
  myTestId: zebraMyTestId,
  myTestTrait: zebraMyTestTrait,
  myEnum: zebraMyEnum,
  myCardinality: zebraMyCardinality,
  myCardinalityModelWorkaround: {...zebraMyCardinality, id: "myCardinalityModelWorkaround" },
  myForeign: zebraMyForeign,
  myArray: zebraMyArray,
  myTaggedUnion: zebraMyTaggedUnion,
  myOneOf: zebraMyOneOf,
};

export const allITypeDefinitionFields: ITypeDefinition = {
  id: "id",
  base: "base",
  enumValues: ["value"],
  inheritedPropertyDefinitions: {},
  propertyDefinitions: {},
  inherits: ["Entity"],
  isAbstract: true,
  metaData: {
    label: "123",
  },
  unfoldable: true,
  keyDefinition: {
    type: "Random",
  },
  inheritedPropertyDefinitionsOneOf: [],
  subsumed: [],
  type: "type",
};
