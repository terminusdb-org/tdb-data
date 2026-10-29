import { ModelElement } from "../types";
import { ITypeDefinition } from "../types";
import { TerminusSchema } from "../terminusReducers";

export const terminusMyArray: TerminusSchema = {
  "@type": "Class",
  "@id": "myArray",
  "@key": { "@type": "Random" },
  array: {
    "@class": "xsd:string",
    "@dimensions": 1,
    "@type": "Array",
  },
  arrayTwoDimensions: {
    "@class": "xsd:string",
    "@dimensions": 2,
    "@type": "Array",
  },
};

export const zebraDocTypeMyArray: ITypeDefinition = {
  id: "myArray",
  type: "type",
  keyDefinition: {
    type: "Random",
  },
  propertyDefinitions: {
    array: {
      name: "array",
      type: "string",
      multiplicity: "Array",
      dimensions: 1,
    },
    arrayTwoDimensions: {
      name: "arrayTwoDimensions",
      type: "string",
      multiplicity: "Array",
      dimensions: 2,
    },
  },
};

export const zebraMyArray: ModelElement = {
  description: "myArray",
  type: "type",
  id: "myArray",
  label: "myArray",
  path: "app.dfrnt.record.myArray",
  typeDefinition: zebraDocTypeMyArray,
};
