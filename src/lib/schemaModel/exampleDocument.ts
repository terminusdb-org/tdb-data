// Fabricates an example instance document from an exported JSON Schema so
// every reachable part of the schema is shown with concrete data. Used by the
// JSON Schema export modal's "Example" view; the output is illustrative — it
// fills every property that can hold a value, picks the first branch where the
// schema is exclusive, and merges non-exclusive branches.

import type { SchemaModel, TypePropertyDefinition } from "./types";

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

// A document link must carry its type on write — the engine reports a bare
// "Class/id" string as an untyped reference (references_untyped_object /
// references_untyped_list_range) even though the JSON Schema renders links as
// plain strings. For a taggedunion target the implied document must also
// store at least one member field — Optional means "at most one value when
// present", never "absence satisfies the choice" — so the first member's
// fields are emitted (no_choice_is_cardinality_one otherwise).
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

const memberFieldExample = (name: string, pd: TypePropertyDefinition, model: SchemaModel | undefined, ancestors: ReadonlySet<string>): unknown => {
  const linked = pd.linkedType ?? pd.linkedTrait ?? pd.linkedTaggedUnion;
  const scalar =
    linked !== undefined
      ? linkRef(linked, model, ancestors)
      : pd.linkedEnum !== undefined
        ? (model?.[pd.linkedEnum]?.typeDefinition.enumValues?.[0] ?? `example ${name}`)
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
  return pd.multiplicity === "Set" || pd.multiplicity === "List" || pd.multiplicity === "Array" ? [scalar] : scalar;
};

const linkRef = (classId: string, model: SchemaModel | undefined, ancestors: ReadonlySet<string>): JsonObject => {
  const ref: JsonObject = { "@type": classId, "@id": `${classId}/Example` };
  const td = model?.[classId]?.typeDefinition;
  const member = td?.type === "taggedunion" ? td.propertyDefinitionsOneOf?.[0] : undefined;
  if (member && !ancestors.has(`@oneOf:${classId}`)) {
    const inner = new Set([...ancestors, `@oneOf:${classId}`]);
    for (const [name, pd] of Object.entries(member)) {
      ref[name] = memberFieldExample(name, pd, model, inner);
    }
  }
  return ref;
};

// Follow $ref with an ancestor set — a repeated reference renders as an id
// link instead of recursing forever on self-referencing classes.
const refExample = (ref: string, root: JsonObject, propName: string | undefined, ancestors: ReadonlySet<string>, model: SchemaModel | undefined): unknown => {
  const target = resolveRef(root, ref);
  if (target === undefined) return "example";
  if (ancestors.has(ref)) return linkRef(refName(ref), model, ancestors);
  return example(target, root, propName, new Set([...ancestors, ref]), model);
};

const literalExample = (s: JsonObject): unknown => {
  if ("const" in s) return s["const"];
  const values = s["enum"];
  return Array.isArray(values) && values.length > 0 ? values[0] : SKIP;
};

const combinatorExample = (s: JsonObject, root: JsonObject, propName: string | undefined, ancestors: ReadonlySet<string>, model: SchemaModel | undefined): unknown => {
  const merge = (branches: unknown[]): unknown =>
    branches.reduce<unknown>((acc, branch) => deepMerge(acc, example(branch, root, propName, ancestors, model)), {});
  // oneOf is exclusive — the first branch stands for the whole union.
  if (Array.isArray(s["oneOf"])) {
    const branches = s["oneOf"] as unknown[];
    return branches.length === 0 ? SKIP : example(branches[0], root, propName, ancestors, model);
  }
  if (Array.isArray(s["allOf"])) return merge(s["allOf"] as unknown[]);
  if (Array.isArray(s["anyOf"])) {
    // anyOf permits matching several branches — merge so every variant shows.
    const merged = merge(s["anyOf"] as unknown[]);
    return merged === undefined ? SKIP : merged;
  }
  return SKIP;
};

const objectExample = (s: JsonObject, xt: JsonObject, root: JsonObject, ancestors: ReadonlySet<string>, model: SchemaModel | undefined): JsonObject => {
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
    const v = example(sub, root, key, ancestors, model);
    if (v !== SKIP) out[key] = v;
  }
  return out;
};

const arrayExample = (s: JsonObject, root: JsonObject, propName: string | undefined, ancestors: ReadonlySet<string>, model: SchemaModel | undefined): unknown => {
  const item = example(s["items"], root, propName, ancestors, model);
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

const example = (schema: unknown, root: JsonObject, propName: string | undefined, ancestors: ReadonlySet<string>, model: SchemaModel | undefined): unknown => {
  if (!isObj(schema)) return schema === undefined ? SKIP : "example";
  const s = schema;

  const ref = s["$ref"];
  if (typeof ref === "string") return refExample(ref, root, propName, ancestors, model);

  // A document link must carry its type on write — the engine reports a bare
  // "Class/id" string as an untyped reference (references_untyped_object /
  // references_untyped_list_range) even though the JSON Schema renders links
  // as plain strings. Checked before the combinators: strictJsonSchema wraps
  // link nodes in a oneOf that still carries x-terminusdb.link.
  const xt = isObj(s["x-terminusdb"]) ? (s["x-terminusdb"] as JsonObject) : {};
  if (typeof xt["link"] === "string") return linkRef(xt["link"], model, ancestors);

  const literal = literalExample(s);
  if (literal !== SKIP) return literal;

  const combined = combinatorExample(s, root, propName, ancestors, model);
  if (combined !== SKIP) return combined;

  const type = s["type"];
  if (type === "object" || isObj(s["properties"])) return objectExample(s, xt, root, ancestors, model);
  if (type === "array") return arrayExample(s, root, propName, ancestors, model);
  return scalarExample(s, propName);
};

export const exampleFromJsonSchema = (schema: unknown, model?: SchemaModel): unknown =>
  example(schema, isObj(schema) ? schema : {}, undefined, new Set(), model);
