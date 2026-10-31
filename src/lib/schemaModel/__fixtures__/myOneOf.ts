import { ModelElement } from "../types";
import { ITypeDefinition } from "../types";
import { TerminusSchema } from "../terminusReducers";

export const terminusMyOneOf: TerminusSchema = {
  "@type": "Class",
  "@id": "myOneOf",
  "@key": { "@type": "Random" },
  "@documentation": [
    {
      "@comment": "",
      "@properties": {
        either: "It's either this",
        or: "or this",
      },
    },
  ],
  "@oneOf": [
    {
      either: "xsd:string",
      or: "xsd:string",
    },
  ],
};

export const zebraDocTypeMyOneOf: ITypeDefinition = {
  id: "myOneOf",
  type: "type",
  keyDefinition: {
    type: "Random",
  },
  metaData: {
    comment: "",
  },

  propertyDefinitionsOneOf: [
    {
      either: {
        name: "either",
        type: "string",
        multiplicity: "Mandatory",
        metaData: { description: "It's either this" },
      },
      or: {
        name: "or",
        type: "string",
        multiplicity: "Mandatory",
        metaData: { description: "or this" },
      },
    },
  ],
};

export const zebraMyOneOf: ModelElement = {
  description: "myOneOf",
  type: "type",
  id: "myOneOf",
  label: "myOneOf",
  path: "app.dfrnt.record.myOneOf",
  typeDefinition: zebraDocTypeMyOneOf,
};
