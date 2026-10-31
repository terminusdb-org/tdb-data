// Fabricates an example instance document from an exported JSON Schema so
// every reachable part of the schema is shown with concrete data. Used by the
// JSON Schema export modal's "Example" view; the output is illustrative — it
// fills every property that can hold a value, picks the first branch where the
// schema is exclusive, and merges non-exclusive branches.

import type { ITypeDefinition, SchemaModel, TypePropertyDefinition } from "./types";

type JsonObject = Record<string, unknown>;

const SKIP = Symbol("skip");

const isObj = (v: unknown): v is JsonObject => typeof v === "object" && v !== null && !Array.isArray(v);

const FORMAT_EXAMPLES: Record<string, string> = {
  "date-time": "2024-01-15T09:30:00Z",
  date: "2024-01-15",
  time: "09:30:00",
  email: "user@example.com",
  uri: "https://example.com/",
  uuid: "5f5f5f5f-0000-4000-8000-000000000000",
  hostname: "example.com",
  ipv4: "192.0.2.1",
  ipv6: "2001:db8::1",
};

const deepMerge = (a: unknown, b: unknown): unknown => {
  if (isObj(a) && isObj(b)) {
    const out: JsonObject = { ...a };
    for (const [k, v] of Object.entries(b)) out[k] = k in out ? deepMerge(out[k], v) : v;
    return out;
  }
  return b === undefined ? a : b;
};

const resolveRef = (root: JsonObject, ref: string): unknown => {
  if (!ref.startsWith("#/")) return undefined;
  let node: unknown = root;
  for (const seg of ref.slice(2).split("/").map((s) => decodeURIComponent(s))) {
    if (!isObj(node)) return undefined;
    node = node[seg];
  }
  return node;
};

const refName = (ref: string): string => {
  const seg = ref.split("/").pop() ?? "Document";
  return decodeURIComponent(seg);
};

const typeNameOf = (schema: JsonObject): string | undefined => {
  const xtdb = schema["x-terminusdb"];
  const choices = isObj(xtdb) ? xtdb["type_choices"] : undefined;
  // Multi-choice types (TaggedUnion) take the first choice, same as the
  // oneOf branches below.
  if (Array.isArray(choices) && choices.length >= 1 && typeof choices[0] === "string") return choices[0];
  return undefined;
};

// A document link under upsert creates the implied document — it must be a
// complete, valid document, not just an id. `emitted` tracks the classId →
// document id of every doc already part of the example write: a link to an
// emitted class becomes a typed ref to that doc (covering self-links,
// repeated links and cycles); any other class link expands into a full
// example document with all of its schema fields.
interface EmitCtx {
  model?: SchemaModel;
  emitted: Map<string, string>;
}

const INTEGER_TYPES = new Set([
  "integer",
  "long",
  "int",
  "short",
  "byte",
  "unsignedByte",
  "unsignedShort",
  "unsignedInt",
  "unsignedLong",
  "positiveInteger",
  "negativeInteger",
  "nonPositiveInteger",
  "nonNegativeInteger",
  "decimal",
  "double",
  "float",
]);

const subdocExample = (traitId: string, ancestors: ReadonlySet<string>, ctx: EmitCtx): JsonObject => {
  // A subdocument is embedded inline and mints its own id on insert — no @id.
  const out: JsonObject = { "@type": traitId };
  const td = ctx.model?.[traitId]?.typeDefinition;
  if (td && !ancestors.has(`@sub:${traitId}`)) {
    emitPropertyFields(out, td, ctx, new Set([...ancestors, `@sub:${traitId}`]));
  }
  return out;
};

const linkRef = (classId: string, ancestors: ReadonlySet<string>, ctx: EmitCtx): unknown => {
  const id = ctx.emitted.get(classId);
  // A doc already in this write is referenced as a bare id string — the
  // engine resolves it against the written document. A typed {@type,@id}
  // object would instead upsert an EMPTY document that fails every
  // required-field and taggedunion-member check.
  if (id !== undefined) return id;
  const ref: JsonObject = { "@type": classId, "@id": `${classId}/Example` };
  const td = ctx.model?.[classId]?.typeDefinition;
  if (td?.type !== "type" && td?.type !== "taggedunion") return ref;
  // Register before emitting fields so a self-referencing link resolves to
  // this document instead of expanding forever.
  ctx.emitted.set(classId, ref["@id"] as string);
  if (td.type === "taggedunion") {
    // The implied document must satisfy exactly one @oneOf member — a member
    // is "chosen" only when at least one of its fields is stored (Optional
    // means at-most-one-when-present, never absence-satisfies), so the first
    // member's fields are emitted.
    const member = td.propertyDefinitionsOneOf?.[0];
    if (member) {
      for (const [name, pd] of Object.entries(member)) {
        const v = propertyExample(name, pd, ctx, ancestors);
        if (v !== SKIP) ref[name] = v;
      }
    }
  } else {
    emitPropertyFields(ref, td, ctx, ancestors);
  }
  return ref;
};

const emitPropertyFields = (out: JsonObject, td: ITypeDefinition, ctx: EmitCtx, ancestors: ReadonlySet<string>): void => {
  for (const [name, pd] of Object.entries({ ...td.inheritedPropertyDefinitions, ...td.propertyDefinitions })) {
    const v = propertyExample(name, pd, ctx, ancestors);
    if (v !== SKIP) out[name] = v;
  }
};

const propertyExample = (name: string, pd: TypePropertyDefinition, ctx: EmitCtx, ancestors: ReadonlySet<string>): unknown => {
  const docLink = pd.linkedType ?? pd.linkedTaggedUnion;
  // An enum with no declared values admits no value — the engine rejects any
  // string, so the field is left out rather than filled with a
  // guaranteed-invalid example.
  const enumValue =
    pd.linkedEnum !== undefined ? ctx.model?.[pd.linkedEnum]?.typeDefinition.enumValues?.[0] : undefined;
  const scalar =
    pd.linkedTrait !== undefined
      ? subdocExample(pd.linkedTrait, ancestors, ctx)
      : docLink !== undefined
        ? linkRef(docLink, ancestors, ctx)
        : pd.linkedEnum !== undefined
          ? enumValue
          : INTEGER_TYPES.has(pd.type)
            ? 42
            : pd.type === "boolean"
              ? true
              : pd.type === "dateTime" || pd.type === "dateTimeStamp"
                ? FORMAT_EXAMPLES["date-time"]
                : pd.type === "date"
                  ? FORMAT_EXAMPLES["date"]
                  : pd.type === "time"
                    ? FORMAT_EXAMPLES["time"]
                    : `example ${name}`;
  if (scalar === undefined) return SKIP;
  return pd.multiplicity === "Set" || pd.multiplicity === "List" || pd.multiplicity === "Array" || pd.multiplicity === "Cardinality"
    ? [scalar]
    : scalar;
};

// Follow $ref with an ancestor set — a repeated reference renders as an id
// link instead of recursing forever on self-referencing classes.
const refExample = (ref: string, root: JsonObject, propName: string | undefined, ancestors: ReadonlySet<string>, ctx: EmitCtx): unknown => {
  const target = resolveRef(root, ref);
  if (target === undefined) return "example";
  if (ancestors.has(ref)) return linkRef(refName(ref), ancestors, ctx);
  return example(target, root, propName, new Set([...ancestors, ref]), ctx);
};

const literalExample = (s: JsonObject): unknown => {
  if ("const" in s) return s["const"];
  const values = s["enum"];
  return Array.isArray(values) && values.length > 0 ? values[0] : SKIP;
};

const combinatorExample = (s: JsonObject, root: JsonObject, propName: string | undefined, ancestors: ReadonlySet<string>, ctx: EmitCtx): unknown => {
  const merge = (branches: unknown[]): unknown =>
    branches.reduce<unknown>((acc, branch) => deepMerge(acc, example(branch, root, propName, ancestors, ctx)), {});
  // oneOf is exclusive — the first branch stands for the whole union.
  if (Array.isArray(s["oneOf"])) {
    const branches = s["oneOf"] as unknown[];
    return branches.length === 0 ? SKIP : example(branches[0], root, propName, ancestors, ctx);
  }
  if (Array.isArray(s["allOf"])) return merge(s["allOf"] as unknown[]);
  if (Array.isArray(s["anyOf"])) {
    // anyOf permits matching several branches — merge so every variant shows.
    const merged = merge(s["anyOf"] as unknown[]);
    return merged === undefined ? SKIP : merged;
  }
  return SKIP;
};

const objectExample = (s: JsonObject, xt: JsonObject, root: JsonObject, ancestors: ReadonlySet<string>, ctx: EmitCtx): JsonObject => {
  const typeName = typeNameOf(s);
  const out: JsonObject = {};
  const props = isObj(s["properties"]) ? (s["properties"] as JsonObject) : {};
  for (const [key, sub] of Object.entries(props)) {
    if (key === "@id") {
      // Subdocuments mint their own id on insert — leave it out.
      if (xt["subdocument"] !== true) out[key] = `${typeName ?? "Document"}/Example`;
      continue;
    }
    if (key === "@type") {
      out[key] = typeName ?? "Document";
      continue;
    }
    const v = example(sub, root, key, ancestors, ctx);
    if (v !== SKIP) out[key] = v;
  }
  return out;
};

const arrayExample = (s: JsonObject, root: JsonObject, propName: string | undefined, ancestors: ReadonlySet<string>, ctx: EmitCtx): unknown => {
  const item = example(s["items"], root, propName, ancestors, ctx);
  const value = item === SKIP ? {} : item;
  const min = typeof s["minItems"] === "number" ? s["minItems"] : 0;
  return Array.from({ length: Math.max(1, min) }, () => value);
};

const scalarExample = (s: JsonObject, propName: string | undefined): unknown => {
  const type = s["type"];
  if (type === "string") {
    const format = typeof s["format"] === "string" ? s["format"] : undefined;
    if (format && FORMAT_EXAMPLES[format]) return FORMAT_EXAMPLES[format];
    return propName ? `example ${propName}` : "example";
  }
  if (type === "integer" || type === "number") {
    const min = typeof s["minimum"] === "number" ? s["minimum"] : 0;
    return Math.max(42, min);
  }
  if (type === "boolean") return true;
  if (type === "null") return null;
  return "example";
};

const example = (schema: unknown, root: JsonObject, propName: string | undefined, ancestors: ReadonlySet<string>, ctx: EmitCtx): unknown => {
  if (!isObj(schema)) return schema === undefined ? SKIP : "example";
  const s = schema;

  const ref = s["$ref"];
  if (typeof ref === "string") return refExample(ref, root, propName, ancestors, ctx);

  // A document link must carry its type on write — the engine reports a bare
  // "Class/id" string as an untyped reference (references_untyped_object /
  // references_untyped_list_range) even though the JSON Schema renders links
  // as plain strings. Checked before the combinators: strictJsonSchema wraps
  // link nodes in a oneOf that still carries x-terminusdb.link.
  const xt = isObj(s["x-terminusdb"]) ? (s["x-terminusdb"] as JsonObject) : {};
  if (typeof xt["link"] === "string") return linkRef(xt["link"], ancestors, ctx);

  const literal = literalExample(s);
  if (literal !== SKIP) return literal;

  const combined = combinatorExample(s, root, propName, ancestors, ctx);
  if (combined !== SKIP) return combined;

  const type = s["type"];
  if (type === "object" || isObj(s["properties"])) return objectExample(s, xt, root, ancestors, ctx);
  if (type === "array") return arrayExample(s, root, propName, ancestors, ctx);
  return scalarExample(s, propName);
};

export const exampleFromJsonSchema = (schema: unknown, model?: SchemaModel): unknown => {
  const ctx: EmitCtx = { model, emitted: new Map() };
  // Seed the root document's own id so self-links reference it rather than
  // expanding a second copy.
  const rootType = isObj(schema) ? typeNameOf(schema) : undefined;
  if (rootType !== undefined && model?.[rootType]?.type === "type") {
    ctx.emitted.set(rootType, `${rootType}/Example`);
  }
  return example(schema, isObj(schema) ? schema : {}, undefined, new Set(), ctx);
};
