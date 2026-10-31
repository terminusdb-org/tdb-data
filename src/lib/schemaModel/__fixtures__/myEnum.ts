import { ModelElement } from "../types";
import { ITypeDefinition } from "../types";
import { TerminusSchema } from "../terminusReducers";

export const zebraEnumType: ITypeDefinition = {
  id: "myEnum",
  type: "enumtrait",
  metaData: { comment: "Myclass" },
  enumValues: ["value"],
  valuesMetadata: {
    value: {
      description: "myValue"
    }
  },
  translations: {
    sv_SE: {
      metaData: {
        comment: "Myclass",
      },
      propertyDocumentation: {
        value: {
          comment: "Kommentar om mittvärde",
          label: "mittVärde",
        },
      },
    },
  },
};

export const terminusEnum: TerminusSchema = {
  "@type": "Enum",
  "@id": "myEnum",
  "@value": ["value"],
  "@documentation": [
    {
      "@comment": "Myclass",
      "@values": { value: "myValue" },
    },
    {
      "@language": "sv_SE",
      "@comment": "Myclass",
      "@values": { value: { "@label": "mittVärde", "@comment": "Kommentar om mittvärde" } },
    },
  ],
};

export const zebraMyEnum: ModelElement = {
  description: "Myclass",
  type: "enumtrait",
  id: "myTestTrait",
  label: "myTestTrait",
  path: "app.dfrnt.record.myTestTrait",
  typeDefinition: zebraEnumType,
};
