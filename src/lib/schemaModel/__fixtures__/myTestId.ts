import { ModelElement } from "../types";
import { ITypeDefinition } from "../types";
import { TerminusSchema } from "../terminusReducers";

export const terminusDocSchemaMyTestId: TerminusSchema = {
  "@type": "Class",
  "@id": "myTestId",
  "@metadata": {
    DFRNT: {
      version: "1.0.0",
      labelPropertyOverride: "displayName"
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
  "@documentation": [
    {
      "@label": "My Class",
      "@comment": "Myclass documentation",
      "@properties": {
        description: "Some comment",
      },
    },
  ],
  "@key": { "@type": "Random" },
  label: {
    "@class": "xsd:string",
    "@type": "Optional",
  },
  label2: "xsd:string",
  description: "app.dfrnt.record",
  descriptionList: {
    "@class": "app.dfrnt.record",
    "@type": "List",
  },
  "crm:descriptionSet": {
    "@class": "myTestTrait",
    "@type": "Set",
  },
  descriptionForeign: { 
    // This test is due to TerminusDB issue #1832 where a foreign type is returns multiplicity as mandatory
    // It should be converted to "Mandatory" when saved back
    "@class": "myForeign",
    "@type": "Foreign",
  },
  descriptionCardinality: {
    "@class": "myTestTrait",
    "@min_cardinality": 1,
    "@max_cardinality": 100,
    "@type": "Cardinality",
  },
  descriptionSetEnum: {
    "@class": "myEnum",
    "@type": "Set",
  },
};

// Previously named terminusDocProperties
export const terminusMyTestIdPropertiesZebraRepresentation = {
  label: {
    "@class": "xsd:string",
    "@type": "Optional",
  },
  label2: {
    "@class": "xsd:string",
    "@type": "Mandatory",
  },
  description: {
    "@class": "linkedType",
    "@type": "Mandatory",
    zebraLinkedClass: "app.dfrnt.record",
  },
  descriptionList: {
    "@class": "linkedType",
    "@type": "List",
    zebraLinkedClass: "app.dfrnt.record",
  },
  "crm:descriptionSet": {
    "@class": "linkedTrait",
    "@type": "Set",
    zebraLinkedClass: "myTestTrait",
  },
  descriptionForeign: {
    "@class": "linkedForeign",
    "@type": "Foreign",
    zebraLinkedClass: "myForeign",
  },
  descriptionCardinality: {
    "@class": "linkedTrait",
    "@type": "Cardinality",
    "@min_cardinality": 1,
    "@max_cardinality": 100,
    zebraLinkedClass: "myTestTrait",
  },
  descriptionSetEnum: {
    "@class": "linkedEnum",
    "@type": "Set",
    zebraLinkedClass: "myEnum",
  },
};

export const zebraDocTypeMyTestId: ITypeDefinition = {
  id: "myTestId",
  metaData: { 
    label: "My Class", 
    comment: "Myclass documentation"
  },
  typeMetadata: {
    parsed: {
      DFRNT: {
        version: "1.0.0",
        labelPropertyOverride: "displayName"
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
  },
  type: "type",
  keyDefinition: {
    type: "Random",
  },
  propertyDefinitions: {
    label: {
      name: "label",
      type: "string",
      multiplicity: "Optional",
    },
    label2: {
      name: "label2",
      type: "string",
      multiplicity: "Mandatory",
    },
    description: {
      name: "description",
      multiplicity: "Mandatory",
      type: "linkedType",
      linkedType: "app.dfrnt.record",
      metaData: {
        description: "Some comment",
      },
    },
    descriptionList: {
      name: "descriptionList",
      multiplicity: "List",
      type: "linkedType",
      linkedType: "app.dfrnt.record",
    },
    descriptionCardinality: {
      name: "descriptionCardinality",
      multiplicity: "Cardinality",
      type: "linkedTrait",
      maxCardinality: 100,
      minCardinality: 1,
      linkedTrait: "myTestTrait",
    },
    "crm:descriptionSet": {
      linkedTrait: "myTestTrait",
      name: "crm:descriptionSet",
      multiplicity: "Set",
      type: "linkedTrait",
    },
    descriptionForeign: {
      linkedForeign: "myForeign",
      name: "descriptionForeign",
      multiplicity: "Foreign",
      type: "linkedForeign",
    },
    descriptionSetEnum: {
      linkedEnum: "myEnum",
      name: "descriptionSetEnum",
      multiplicity: "Set",
      type: "linkedEnum",
    },
  },
};

export const zebraMyTestId: ModelElement = {
  description: "Myclass",
  type: "trait",
  id: "myTestId",
  label: "myTestId",
  path: "app.dfrnt.record.myTestId",
  typeDefinition: zebraDocTypeMyTestId,
};
