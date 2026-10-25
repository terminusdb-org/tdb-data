import type { UiSchema } from "@rjsf/utils";
import { makeLinkWidget } from "@/components/form/widgets";

type JsonSchemaObject = Record<string, unknown> & {
  properties?: Record<string, unknown>;
  items?: unknown;
  type?: string;
  "x-terminusdb"?: { link?: string };
};

// Ported from zebra's RecordForm/buildUiSchema: walks the JSON Schema and
// assigns widgets — textarea for strings, a linked-record selector for
// document links, and hides @id/@type (the editor header shows them and
// @type must stay fixed anyway).
function linkTarget(def: unknown): string | undefined {
  if (typeof def !== "object" || def === null || Array.isArray(def)) return undefined;
  const tdb = (def as JsonSchemaObject)["x-terminusdb"];
  return tdb && typeof tdb.link === "string" ? tdb.link : undefined;
}

const TEXTAREA_SCHEMA: UiSchema = { "ui:widget": "textarea", "ui:options": { rows: 3 } };
const HIDDEN_SCHEMA: UiSchema = { "ui:widget": "hidden" };

function propertyUiSchema(propSchema: unknown, docPath: string): UiSchema {
  if (typeof propSchema !== "object" || propSchema === null || Array.isArray(propSchema)) return {};
  const prop = propSchema as JsonSchemaObject;

  const itemLink = prop.type === "array" ? linkTarget(prop.items) : undefined;
  if (itemLink) return { items: { "ui:widget": makeLinkWidget(docPath, itemLink) } };

  const propLink = linkTarget(prop);
  if (propLink) return { "ui:widget": makeLinkWidget(docPath, propLink) };

  if (prop.type === "string") return TEXTAREA_SCHEMA;
  if (prop.type === "array" && prop.items) {
    return { items: buildFormUiSchema(prop.items, docPath) };
  }
  return buildFormUiSchema(prop, docPath);
}

export function buildFormUiSchema(schema: unknown, docPath: string, isNew = false): UiSchema {
  if (typeof schema !== "object" || schema === null || Array.isArray(schema)) return {};
  const node = schema as JsonSchemaObject;

  const link = linkTarget(node);
  if (link && !node.properties) {
    return { "ui:widget": makeLinkWidget(docPath, link) };
  }
  if (node.type === "string" && !link) return TEXTAREA_SCHEMA;
  if (!node.properties) return {};

  const uiSchema: UiSchema = {};
  for (const key of Object.keys(node.properties)) {
    if (key === "@type") continue;
    uiSchema[key] = propertyUiSchema(node.properties[key], docPath);
  }

  if ("@type" in node.properties) {
    // Hidden unless the schema offers several interpretations (oneOf) —
    // same rule as the studio's builder.
    const typeDef = node.properties["@type"];
    const hasAlternatives = typeof typeDef === "object" && typeDef !== null && "oneOf" in (typeDef as object);
    if (!hasAlternatives) uiSchema["@type"] = HIDDEN_SCHEMA;
  }
  // @id is user-entered on new documents; once persisted it is immutable.
  if (!isNew) uiSchema["@id"] = HIDDEN_SCHEMA;

  return uiSchema;
}
