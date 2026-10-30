// Fabricates an example instance document from an exported JSON Schema so
// every reachable part of the schema is shown with concrete data. Used by the
// JSON Schema export modal's "Example" view; the output is illustrative — it
// fills every property that can hold a value, picks the first branch where the
// schema is exclusive, and merges non-exclusive branches.

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
  if (Array.isArray(choices) && choices.length === 1 && typeof choices[0] === "string") return choices[0];
  return undefined;
};

// A document link must carry its type on write — the engine reports a bare
// "Class/id" string as an untyped reference (references_untyped_object /
// references_untyped_list_range) even though the JSON Schema renders links as
// plain strings.
const linkRef = (classId: string): JsonObject => ({ "@type": classId, "@id": `${classId}/Example` });

const example = (schema: unknown, root: JsonObject, propName: string | undefined, ancestors: ReadonlySet<string>): unknown => {
  if (!isObj(schema)) return schema === undefined ? SKIP : "example";
  let s = schema;

  // Follow $ref with an ancestor set — a repeated reference renders as an id
  // link instead of recursing forever on self-referencing classes.
  const ref = s["$ref"];
  if (typeof ref === "string") {
    const target = resolveRef(root, ref);
    if (target === undefined) return "example";
    if (ancestors.has(ref)) return linkRef(refName(ref));
    return example(target, root, propName, new Set([...ancestors, ref]));
  }

  // A document link must carry its type on write — the engine reports a bare
  // "Class/id" string as an untyped reference (references_untyped_object /
  // references_untyped_list_range) even though the JSON Schema renders links
  // as plain strings. Checked before the combinators: strictJsonSchema wraps
  // link nodes in a oneOf that still carries x-terminusdb.link.
  const xt = isObj(s["x-terminusdb"]) ? (s["x-terminusdb"] as JsonObject) : {};
  if (typeof xt["link"] === "string") return linkRef(xt["link"]);

  if ("const" in s) return s["const"];
  if (Array.isArray(s["enum"]) && (s["enum"] as unknown[]).length > 0) return (s["enum"] as unknown[])[0];
  if (Array.isArray(s["oneOf"])) {
    const branches = s["oneOf"] as unknown[];
    return branches.length === 0 ? SKIP : example(branches[0], root, propName, ancestors);
  }
  if (Array.isArray(s["allOf"])) {
    return (s["allOf"] as unknown[]).reduce<unknown>(
      (acc, branch) => deepMerge(acc, example(branch, root, propName, ancestors)),
      {}
    );
  }
  if (Array.isArray(s["anyOf"])) {
    // anyOf permits matching several branches — merge so every variant shows.
    const merged = (s["anyOf"] as unknown[]).reduce<unknown>(
      (acc, branch) => deepMerge(acc, example(branch, root, propName, ancestors)),
      {}
    );
    return merged === undefined ? SKIP : merged;
  }

  const type = s["type"];

  if (type === "object" || isObj(s["properties"])) {
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
      const v = example(sub, root, key, ancestors);
      if (v !== SKIP) out[key] = v;
    }
    return out;
  }

  if (type === "array") {
    const item = example(s["items"], root, propName, ancestors);
    const value = item === SKIP ? {} : item;
    const min = typeof s["minItems"] === "number" ? s["minItems"] : 0;
    return Array.from({ length: Math.max(1, min) }, () => value);
  }

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

export const exampleFromJsonSchema = (schema: unknown): unknown =>
  example(schema, isObj(schema) ? schema : {}, undefined, new Set());
