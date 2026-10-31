import { ModelElement } from "../types";
import { ITypeDefinition } from "../types";
import { TerminusSchema } from "../terminusReducers";

export const zebraTaggedUnionType: ITypeDefinition = {
  id: "myTaggedUnion",
  type: "taggedunion",
  propertyDefinitions: {
    "leaf": {
      name: "leaf",
      type: "integer",
      multiplicity: "Mandatory",
    },
    "trunk": {
      name: "trunk",
      type: "string",
      multiplicity: "Mandatory",
    }
  }
};

export const terminusMyTaggedUnion: TerminusSchema = {
  "@type": "TaggedUnion",
  "@id": "myTaggedUnion",
  "leaf": "xsd:integer",
  "trunk": "xsd:string"
};

export const zebraMyTaggedUnion: ModelElement = {
  description: "TaggedUnion myTaggedUnion Type",
  type: "taggedunion",
  id: "myTaggedUnion",
  label: "TaggedUnion myTaggedUnion Type",
  path: "app.dfrnt.record.myTaggedUnion",
  typeDefinition: zebraTaggedUnionType,
};
