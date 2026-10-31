import { ModelElement } from "../types";
import { ITypeDefinition } from "../types";
import { TerminusSchema } from "../terminusReducers";

export const zebraForeignType: ITypeDefinition = {
  id: "myForeign",
  type: "foreign",
};

export const terminusMyForeign: TerminusSchema = {
  "@type": "Foreign",
  "@id": "myForeign",
};

export const zebraMyForeign: ModelElement = {
  description: "Foreign myForeign Type",
  type: "foreign",
  id: "myForeign",
  label: "Foreign myForeign Type",
  path: "app.dfrnt.record.myForeign",
  typeDefinition: zebraForeignType,
};
