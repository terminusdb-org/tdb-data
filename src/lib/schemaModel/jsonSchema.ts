import type { SchemaModel } from "./types";

type JsonObject = Record<string, unknown>;

// Mandatory own + inherited field names for a model class — what the engine's
// JSON Schema sometimes fails to put in `required` (subdocuments come back
// with required:[] even when fields are mandatory).
export const mandatoryFieldNames = (model: SchemaModel, classId: string): string[] => {
  const td = model[classId]?.typeDefinition;
  if (!td) return [];
  const own = Object.values(td.propertyDefinitions ?? {})
    .filter((p) => p.multiplicity === "Mandatory")
    .map((p) => p.name);
  const inh = Object.values(td.inheritedPropertyDefinitions ?? {})
    .filter((p) => p.multiplicity === "Mandatory")
    .map((p) => p.name);
  return [...new Set([...own, ...inh])];
};

// TerminusDB rejects unknown document fields, so the exported JSON Schema must
// too. Post-processes the engine's export: additionalProperties:false on every
// object schema, and fills `required` from the model wherever a schema node's
// x-terminusdb.type_choices names a known class.
export const strictJsonSchema = (schema: unknown, model: SchemaModel): unknown => {
  if (Array.isArray(schema)) return schema.map((s) => strictJsonSchema(s, model));
  if (schema === null || typeof schema !== "object") return schema;
  const obj = schema as JsonObject;

  const out: JsonObject = {};
  for (const [k, v] of Object.entries(obj)) out[k] = strictJsonSchema(v, model);

  // A document link is exported as a plain string, but the engine also
  // accepts the typed reference form {"@type","@id"} — required for List/Set
  // members and for references to documents that don't exist yet.
  const link = (out["x-terminusdb"] as JsonObject | undefined)?.["link"];
  if (out["type"] === "string" && typeof link === "string") {
    delete out["type"];
    out["oneOf"] = [
      { type: "string" },
      // Not @type: {const: link} — a reference may point at a subclass.
      {
        type: "object",
        required: ["@type", "@id"],
        properties: { "@type": { type: "string" }, "@id": { type: "string" } },
      },
    ];
  }

  if (out["properties"] && typeof out["properties"] === "object") {
    out["additionalProperties"] = false;
    const typeChoices = (out["x-terminusdb"] as JsonObject | undefined)?.["type_choices"];
    const classId = Array.isArray(typeChoices) && typeChoices.length === 1 ? String(typeChoices[0]) : undefined;
    if (classId && model[classId]) {
      const existing = Array.isArray(out["required"]) ? (out["required"] as unknown[]).map(String) : [];
      out["required"] = [...new Set([...existing, ...mandatoryFieldNames(model, classId)])];
    }
  }
  return out;
};
