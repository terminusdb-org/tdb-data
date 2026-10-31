import { ModelElement } from "../types";
import { ITypeDefinition } from "../types";
import { TerminusSchema } from "../terminusReducers";

export const zebraSubDocSchema: ITypeDefinition = {
  id: "myTestTrait",
  metaData: {
    comment: "Myclass",
  },
  keyDefinition: {
    type: "Random",
  },
  propertyDefinitions: {
    linkedRecord: {
      linkedType: "app.dfrnt.record",
      multiplicity: "Mandatory",
      name: "linkedRecord",
      type: "linkedType",
      metaData: {
        description: "Some comment",
      },
    },
    label: {
      multiplicity: "Optional",
      name: "label",
      type: "string",
    },
  },
  type: "trait",
};

export const terminusSubDocSchema: TerminusSchema = {
  "@type": "Class",
  "@id": "myTestTrait",
  "@subdocument": [],
  "@documentation": {
    "@comment": "Myclass",
    "@properties": {
      linkedRecord: "Some comment",
    },
  },
  "@key": { "@type": "Random" },
  label: {
    "@class": "xsd:string",
    "@type": "Optional",
  },
  linkedRecord: "app.dfrnt.record",
};

export const zebraMyTestTrait: ModelElement = {
  description: "Myclass",
  type: "trait",
  id: "myTestTrait",
  label: "myTestTrait",
  path: "app.dfrnt.record.myTestTrait",
  typeDefinition: zebraSubDocSchema,
};
