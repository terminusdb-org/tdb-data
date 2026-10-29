import { castTerminusValue, TerminusSchema } from "./terminusReducers";
import { ITypeDefinition, TypePropertyDefinition, TypePropertyDefinitions } from "./types";

export type MigrationOp = Record<string, unknown> & { "@type": string };
export type KeyType = "Random" | "Lexical" | "Hash" | "ValueHash" | "UuidV7";

export const ops = {
  createClass: (doc: TerminusSchema): MigrationOp => ({ "@type": "CreateClass", class_document: doc }),
  deleteClass: (cls: string): MigrationOp => ({ "@type": "DeleteClass", class: cls }),
  moveClass: (from: string, to: string): MigrationOp => ({ "@type": "MoveClass", from, to }),
  replaceClassMetadata: (cls: string, metadata: unknown): MigrationOp => ({
    "@type": "ReplaceClassMetadata",
    class: cls,
    metadata,
  }),
  setAbstract: (cls: string, on: boolean): MigrationOp => ({ "@type": on ? "Abstract" : "NotAbstract", class: cls }),
  setUnfoldable: (cls: string, on: boolean): MigrationOp => ({ "@type": on ? "Unfoldable" : "NotUnfoldable", class: cls }),
  replaceClassDocumentation: (cls: string, doc: unknown): MigrationOp => ({
    "@type": "ReplaceClassDocumentation",
    class: cls,
    documentation: doc,
  }),
  changeKey: (cls: string, key: KeyType, fields?: string[]): MigrationOp => ({
    "@type": "ChangeKey",
    class: cls,
    key,
    ...(fields && { fields }),
  }),
  changeParents: (cls: string, parents: string[], propDefaults?: { property: string; default: unknown }[]): MigrationOp => ({
    "@type": "ChangeParents",
    class: cls,
    parents,
    ...(propDefaults && propDefaults.length > 0 && { properties: propDefaults }),
  }),
  createClassProperty: (cls: string, prop: string, spec: unknown, deflt?: unknown): MigrationOp => ({
    "@type": "CreateClassProperty",
    class: cls,
    property: prop,
    type: spec,
    ...(deflt !== undefined && { default: deflt }),
  }),
  deleteClassProperty: (cls: string, prop: string): MigrationOp => ({
    "@type": "DeleteClassProperty",
    class: cls,
    property: prop,
  }),
  moveClassProperty: (cls: string, from: string, to: string): MigrationOp => ({
    "@type": "MoveClassProperty",
    class: cls,
    from,
    to,
  }),
  upcastClassProperty: (cls: string, prop: string, spec: unknown): MigrationOp => ({
    "@type": "UpcastClassProperty",
    class: cls,
    property: prop,
    type: spec,
  }),
  castClassProperty: (cls: string, prop: string, spec: unknown, deflt: { value: unknown } | "error"): MigrationOp => ({
    "@type": "CastClassProperty",
    class: cls,
    property: prop,
    type: spec,
    default: deflt === "error" ? { "@type": "Error" } : { "@type": "Default", value: deflt.value },
  }),
  expandEnum: (enm: string, values: string[]): MigrationOp => ({ "@type": "ExpandEnum", enum: enm, values }),
  // ReplaceContextMetadata / ReplaceContextDocumentation are implemented
  // engine-side; plain ReplaceContext is not — context edits go through
  // PUT /api/document (@type "@context") + the /api/prefix/* endpoints.
};

// The schema property spec for a definition, e.g. "xsd:string" or {"@type":"Set","@class":"xsd:string"}.
export const specOf = (pd: TypePropertyDefinition): unknown => castTerminusValue(pd)[pd.name];

type NormalizedSpec = {
  "@class"?: string;
  "@type": string;
  "@cardinality"?: number;
  "@min_cardinality"?: number;
  "@max_cardinality"?: number;
  "@dimensions"?: number;
};
const normalizeSpec = (spec: unknown): NormalizedSpec => {
  if (typeof spec === "string") return { "@class": spec, "@type": "Mandatory" };
  if (spec && typeof spec === "object") return spec as NormalizedSpec;
  throw new Error("Internal error: unexpected property spec shape: " + JSON.stringify(spec));
};

// Multiplicity transitions applied without touching instance documents.
const WEAKENING_PAIRS: Array<[string, string]> = [
  ["Mandatory", "Optional"],
  ["Mandatory", "Set"],
  ["Mandatory", "Cardinality"],
  ["Optional", "Set"],
];

const isSpecWeakening = (oldSpec: unknown, newSpec: unknown): boolean => {
  const o = normalizeSpec(oldSpec);
  const n = normalizeSpec(newSpec);
  if (o["@class"] !== n["@class"]) return false;
  if (o["@type"] === n["@type"]) {
    if (o["@type"] === "Cardinality") {
      const omin = (o["@min_cardinality"] as number) ?? o["@cardinality"] ?? 0;
      const nmin = (n["@min_cardinality"] as number) ?? n["@cardinality"] ?? 0;
      const omax = (o["@max_cardinality"] as number) ?? o["@cardinality"] ?? Infinity;
      const nmax = (n["@max_cardinality"] as number) ?? n["@cardinality"] ?? Infinity;
      return nmin <= omin && nmax >= omax;
    }
    return o["@type"] !== "Array" && o["@type"] !== "List"; // List/Array param changes reorder/reshape data
  }
  return WEAKENING_PAIRS.some(([a, b]) => a === o["@type"] && b === n["@type"]);
};

export const isStrengthening = (op: MigrationOp): boolean => {
  switch (op["@type"]) {
    case "DeleteClass":
    case "MoveClass":
    case "DeleteClassProperty":
    case "MoveClassProperty":
    case "CastClassProperty":
    case "ChangeKey":
    case "ChangeParents":
      return true;
    case "CreateClassProperty": {
      const spec = normalizeSpec(op.type);
      if (spec["@type"] === "List") return true;
      if (spec["@type"] === "Mandatory" || spec["@type"] === "Foreign") return true; // mandatory always needs a default
      return false;
    }
    default:
      return false;
  }
};

export interface EditedClassDraft {
  id?: string; // renamed class id
  propertyDefinitions?: TypePropertyDefinitions;
  renames?: Array<{ from: string; to: string }>;
  defaults?: Record<string, { value: unknown } | "error">;
}

// Ordered ops transforming `before` into `after`. Always targets `targetClassId` — callers
// pass the nested class id for inline edits (decision 13).
export const diffClassToOps = (targetClassId: string, before: ITypeDefinition, after: EditedClassDraft): MigrationOp[] => {
  const result: MigrationOp[] = [];
  const renamedTo = after.id && after.id !== targetClassId ? after.id : undefined;
  if (renamedTo) result.push(ops.moveClass(targetClassId, renamedTo));

  const beforeProps = before.propertyDefinitions ?? {};
  const afterProps = after.propertyDefinitions ?? beforeProps;

  for (const { from, to } of after.renames ?? []) {
    if (from in beforeProps && !(to in beforeProps)) result.push(ops.moveClassProperty(targetClassId, from, to));
  }

  const renamedFrom = new Set((after.renames ?? []).map((r) => r.from));
  const renamedToSet = new Set((after.renames ?? []).map((r) => r.to));

  for (const name of Object.keys(beforeProps)) {
    if (renamedFrom.has(name)) continue;
    if (!(name in afterProps) && !renamedToSet.has(name)) result.push(ops.deleteClassProperty(targetClassId, name));
  }

  for (const name of Object.keys(afterProps)) {
    if (name in beforeProps || renamedToSet.has(name)) {
      // Spec change?
      const prevName = (after.renames ?? []).find((r) => r.to === name)?.from ?? name;
      const prev = beforeProps[prevName];
      if (prev && JSON.stringify(specOf(prev)) !== JSON.stringify(specOf(afterProps[name]))) {
        const spec = specOf(afterProps[name]);
        const policy = after.defaults?.[name];
        if (isSpecWeakening(specOf(prev), spec)) {
          result.push(ops.upcastClassProperty(targetClassId, name, spec));
        } else {
          result.push(ops.castClassProperty(targetClassId, name, spec, policy ?? "error"));
        }
      }
      continue;
    }
    const spec = specOf(afterProps[name]);
    const deflt = after.defaults?.[name];
    result.push(ops.createClassProperty(targetClassId, name, spec, deflt && deflt !== "error" ? deflt.value : undefined));
  }

  return result;
};
