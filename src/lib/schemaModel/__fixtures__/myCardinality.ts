import { ModelElement } from "../types";
import { ITypeDefinition } from "../types";
import { TerminusSchema } from "../terminusReducers";

export const terminusDocSchemaMyCardinality: TerminusSchema = {
  "@type": "Class",
  "@id": "myCardinality",
  "@key": { "@type": "Random" },
  cardinalityOne: {
    "@class": "xsd:string",
    "@type": "Cardinality",
    "@cardinality": 1,
  },
  cardinalityMinOne: {
    "@class": "xsd:string",
    "@type": "Cardinality",
    "@min_cardinality": 1,
  },
  cardinalityMaxOne: {
    "@class": "xsd:string",
    "@type": "Cardinality",
    "@max_cardinality": 1,
  },
  cardinalityMinOneMaxFour: {
    "@class": "xsd:string",
    "@type": "Cardinality",
    "@min_cardinality": 1,
    "@max_cardinality": 4,
  },
};

export const terminusDocSchemaModelWorkaround: TerminusSchema = {
  "@type": "Class",
  "@id": "myCardinalityModelWorkaround",
  "@key": { "@type": "Random" },
  cardinalityOne: {
    "@class": "xsd:string",
    "@type": "Cardinality",
    "@cardinality": 1,
  },
  cardinalityMinOne: {
    "@class": "xsd:string",
    "@type": "Cardinality",
    "@min": 1,
  },
  cardinalityMaxOne: {
    "@class": "xsd:string",
    "@type": "Cardinality",
    "@max": 1,
  },
  cardinalityMinOneMaxFour: {
    "@class": "xsd:string",
    "@type": "Cardinality",
    "@min": 1,
    "@max": 4,
  },
};

export const zebraDocTypeMyCardinality: ITypeDefinition = {
  id: "myCardinality",
  type: "type",
  keyDefinition: {
    type: "Random",
  },
  propertyDefinitions: {
    cardinalityOne: {
      name: "cardinalityOne",
      type: "string",
      multiplicity: "Cardinality",
      cardinality: 1,
    },
    cardinalityMinOne: {
      name: "cardinalityMinOne",
      type: "string",
      multiplicity: "Cardinality",
      minCardinality: 1,
    },
    cardinalityMaxOne: {
      name: "cardinalityMaxOne",
      type: "string",
      multiplicity: "Cardinality",
      maxCardinality: 1,
    },
    cardinalityMinOneMaxFour: {
      name: "cardinalityMinOneMaxFour",
      type: "string",
      multiplicity: "Cardinality",
      minCardinality: 1,
      maxCardinality: 4,
    },

  },
};

export const zebraMyCardinality: ModelElement = {
  description: "myCardinality",
  type: "type",
  id: "myCardinality",
  label: "myCardinality",
  path: "app.dfrnt.record.myTestId",
  typeDefinition: zebraDocTypeMyCardinality,
};
