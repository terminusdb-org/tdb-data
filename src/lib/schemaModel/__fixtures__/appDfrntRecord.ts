import { ModelElement } from "../types";
import { TerminusSchema } from "../terminusReducers";

export const appDfrntRecord: TerminusSchema = {
  "@id": "app.dfrnt.record",
  "@documentation": [
    {
      "@comment": "This is a type",
      "@authors": ["Nicolas Daugart"],
      "@label": "The type type",
    },
    {
      "@language": "sv_SE",
      "@authors": ["Nicolas Daugart"],
      "@comment": "Detta är en typ",
      "@label": "Typen typ",
    },
  ],
  "@metadata": {
    DFRNT: {
      version: "1.0.0",
      hexRgbBackground: "#ffffff",
      labelOverride: "Topic",
      labelPropertyOverride: "displayName",
      propertyDisplayOrder: ["first", "second"],
    },
    OtherParty: {
      someMetaData: {
        subdata: "String",
      },
    },
    tags: {
      businessOwner: "userid",
    },
  },
  "@key": { "@type": "Random" },
  "@type": "Class",
  "@base": "base_",
  "@unfoldable": [],
  "@inherits": [],
};

export const zebraAppDfrntRecord: ModelElement = {
  id: "app.dfrnt.record",
  type: "type",
  description: "description",
  label: "label",
  path: "app.dfrnt.record",
  typeDefinition: {
    id: "app.dfrnt.record",
    inherits: [],
    base: "base_",
    unfoldable: true,
    keyDefinition: {
      type: "Random",
    },
    metaData: {
      comment: "This is a type",
      authors: ["Nicolas Daugart"],
      label: "The type type",
    },
    translations: {
      sv_SE: {
        propertyDocumentation: {},
        metaData: {
          comment: "Detta är en typ",
          authors: ["Nicolas Daugart"],
          label: "Typen typ",
        },
      },
    },
    typeMetadata: {
      parsed: {
        DFRNT: ({
          version: "1.0.0",
          hexRgbBackground: "#ffffff",
          labelOverride: "Topic",
          labelPropertyOverride: "displayName",
          propertyDisplayOrder: ["first", "second"],
        }),
        OtherParty: {
          someMetaData: {
            subdata: "String",
          },
        },
        tags: {
          businessOwner: "userid",
        },
      },
    },
    type: "type",
  },
};
