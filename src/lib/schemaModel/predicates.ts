import { specOf } from "./migrationOps";
import { SchemaModel, TypePropertyDescription } from "./types";

export interface PredicateDef {
  elementId: string;
  spec: unknown; // raw schema property spec ("xsd:string" or {"@type":...,"@class":...})
  doc?: TypePropertyDescription;
}

export interface PredicateEntry {
  name: string;
  defs: PredicateDef[];
}

// Stable-ish deep equality for specs: sort object keys before stringify.
const canonical = (v: unknown): string => {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return (
      "{" +
      Object.keys(v as Record<string, unknown>)
        .sort()
        .map((k) => JSON.stringify(k) + ":" + canonical((v as Record<string, unknown>)[k]))
        .join(",") +
      "}"
    );
  }
  return JSON.stringify(v);
};

export const specsEqual = (a: unknown, b: unknown): boolean => canonical(a) === canonical(b);

// Property names are schema-global predicates; the same name may be defined differently
// in multiple classes (overloads). Index them all so the UI can offer reuse + surface
// ambiguity instead of silently picking one.
export const buildPredicateIndex = (model: SchemaModel): Record<string, PredicateEntry> => {
  const index: Record<string, PredicateEntry> = {};
  for (const elementId of Object.keys(model)) {
    const td = model[elementId].typeDefinition;
    for (const [name, prop] of Object.entries(td.propertyDefinitions ?? {})) {
      index[name] = index[name] ?? { name, defs: [] };
      index[name].defs.push({ elementId, spec: specOf(prop), ...(prop.metaData && { doc: prop.metaData }) });
    }
    for (const fieldSet of td.propertyDefinitionsOneOf ?? []) {
      for (const [name, prop] of Object.entries(fieldSet)) {
        index[name] = index[name] ?? { name, defs: [] };
        index[name].defs.push({ elementId, spec: specOf(prop), ...(prop.metaData && { doc: prop.metaData }) });
      }
    }
  }
  return index;
};
