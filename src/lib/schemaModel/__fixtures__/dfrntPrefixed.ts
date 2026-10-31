import { ModelElement } from "../types";
import { ITypeDefinition } from "../types";
import { TerminusSchema } from "../terminusReducers";

export const zebraDfrntPrefixed: ITypeDefinition = {
  id: "dfrnt:Prefixed",
  metaData: {
    comment: "Prefixed Trait",
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

export const terminusDfrntPrefixed: TerminusSchema = {
  "@type": "Class",
  "@id": "dfrnt:Prefixed",
  "@subdocument": [],
  "@documentation": [{
    "@comment": "Prefixed Trait",
    "@properties": {
      linkedRecord: "Some comment",
    },
  }],
  "@key": { "@type": "Random" },
  label: {
    "@class": "xsd:string",
    "@type": "Optional",
  },
  linkedRecord: "app.dfrnt.record",
};

export const zebraDfrntPrefixedSchema: ModelElement = {
  description: "Prefixed Trait",
  type: "trait",
  id: "dfrnt:Prefixed",
  label: "myTestTrait",
  path: "app.dfrnt.record.myTestTrait",
  typeDefinition: zebraDfrntPrefixed,
};
