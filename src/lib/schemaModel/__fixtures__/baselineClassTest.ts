import { SchemaModel } from "../types";
import { TerminusSchemaObject } from "../terminusReducers";
import { terminusTestSchema, zebraTestSchema } from "./terminusBaseObjects";

export interface ClassReductionPair {
  terminusSchema: TerminusSchemaObject;
  zebraSchema: SchemaModel;
}

export type ClassReductionTest = Record<string, ClassReductionPair>;

export const broadBaselineSchema: ClassReductionTest = {
  baseline: {
    terminusSchema: terminusTestSchema,
    zebraSchema: zebraTestSchema,
  },
  lexicalKey: {
    terminusSchema: {
      "app.dfrnt.record": { ...terminusTestSchema["app.dfrnt.record"], "@key": { "@type": "Lexical", "@fields": ["myTestTrait"] } },
    },
    zebraSchema: {
      "app.dfrnt.record": {
        ...zebraTestSchema["app.dfrnt.record"],
        typeDefinition: {
          ...zebraTestSchema["app.dfrnt.record"].typeDefinition,
          keyDefinition: { type: "Lexical", includedFields: ["myTestTrait"] },
        },
      },
    },
  },
  valueHashKey: {
    terminusSchema: { "app.dfrnt.record": { ...terminusTestSchema["app.dfrnt.record"], "@key": { "@type": "ValueHash" } } },
    zebraSchema: {
      "app.dfrnt.record": {
        ...zebraTestSchema["app.dfrnt.record"],
        typeDefinition: {
          ...zebraTestSchema["app.dfrnt.record"].typeDefinition,
          keyDefinition: { type: "ValueHash" },
        },
      },
    },
  },
  base: {
    terminusSchema: { "app.dfrnt.record": { ...terminusTestSchema["app.dfrnt.record"], "@base": "customBase/" } },
    zebraSchema: {
      "app.dfrnt.record": {
        ...zebraTestSchema["app.dfrnt.record"],
        typeDefinition: {
          ...zebraTestSchema["app.dfrnt.record"].typeDefinition,
          base: "customBase/",
        },
      },
    },
  },
  cardinality: {
    terminusSchema: { myCardinality: { ...terminusTestSchema["myCardinality"], "@key": { "@type": "ValueHash" } } },
    zebraSchema: {
      myCardinality: {
        ...zebraTestSchema["myCardinality"],
        typeDefinition: {
          ...zebraTestSchema["myCardinality"].typeDefinition,
          keyDefinition: { type: "ValueHash" },
        },
      },
    },
  },
  objectDocumentation: {
    terminusSchema: {
      ...terminusTestSchema,
      myTestId_object: {
        ...terminusTestSchema["myTestId"],
        "@documentation": {
          "@label": "My Class",
          "@comment": "Myclass documentation",
          "@properties": {
            description: "Some comment",
          },
        },
      },
      myTestId_array: {
        ...terminusTestSchema["myTestId"],
        "@documentation": [
          {
            "@comment": "Myclass documentation",
            "@label": "My Class",
            "@properties": {
              description: "Some comment",
            },
          },
        ],
      },
    },
    zebraSchema: {
      myTestId: {
        ...zebraTestSchema["myTestId"],
      },
    },
  },
};
