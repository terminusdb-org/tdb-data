// Helpers for editing the @context document: splitting a context document into
// prefix pairs vs JSON-LD keyword fields, diffing prefix sets for the
// /api/prefix/* management endpoints, and client-side validation that mirrors
// the engine's checks (NCName prefix names, IRIs with a scheme).

export interface PrefixRow {
  prefix: string;
  uri: string;
}

export type PrefixMap = Record<string, string>;

export interface PrefixDiff {
  adds: PrefixRow[];
  updates: PrefixRow[];
  deletes: string[];
}

// Mirrors the engine's valid_prefix_name (ASCII NCName, no leading '@').
const PREFIX_NAME_RE = /^[A-Za-z_][A-Za-z0-9_.-]*$/;

export const isPrefixKey = (key: string): boolean => !key.startsWith("@");

export const isValidPrefixName = (name: string): boolean =>
  PREFIX_NAME_RE.test(name) && !name.startsWith("@");

// Must have a URI scheme, e.g. http://, https://, urn:.
export const isValidPrefixIri = (uri: string): boolean => /^[A-Za-z][A-Za-z0-9+.-]*:/.test(uri);

/** Non-@ keys of a context document, coerced to strings. */
export function prefixMapOf(ctx: Record<string, unknown>): PrefixMap {
  const out: PrefixMap = {};
  for (const [k, v] of Object.entries(ctx)) {
    if (!isPrefixKey(k) || typeof v !== "string") continue;
    out[k] = v;
  }
  return out;
}

/** Split a context doc into editable prefix pairs vs JSON-LD keyword fields. */
export function splitContextDoc(doc: Record<string, unknown>): {
  prefixes: PrefixMap;
  fields: Record<string, unknown>;
} {
  const prefixes: PrefixMap = {};
  const fields: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(doc)) {
    if (isPrefixKey(k) && typeof v === "string") prefixes[k] = v;
    else fields[k] = v;
  }
  return { prefixes, fields };
}

export function rowsToPrefixMap(rows: PrefixRow[]): { map: PrefixMap; errors: string[] } {
  const map: PrefixMap = {};
  const errors: string[] = [];
  for (const { prefix, uri } of rows) {
    const p = prefix.trim();
    const u = uri.trim();
    if (!p && !u) continue;
    if (!isValidPrefixName(p)) {
      errors.push(p || "(empty)");
      continue;
    }
    if (!isValidPrefixIri(u)) {
      errors.push(`${p} → "${u}"`);
      continue;
    }
    if (map[p] !== undefined && map[p] !== u) {
      errors.push(`${p} (duplicate)`);
      continue;
    }
    map[p] = u;
  }
  return { map, errors };
}

/** Diff server-side prefixes against desired rows. */
export function diffPrefixes(current: PrefixMap, desired: PrefixMap): PrefixDiff {
  const adds: PrefixRow[] = [];
  const updates: PrefixRow[] = [];
  const deletes: string[] = [];
  for (const [prefix, uri] of Object.entries(desired)) {
    if (!(prefix in current)) adds.push({ prefix, uri });
    else if (current[prefix] !== uri) updates.push({ prefix, uri });
  }
  for (const prefix of Object.keys(current)) {
    if (!(prefix in desired)) deletes.push(prefix);
  }
  return { adds, updates, deletes };
}

export const isEmptyPrefixDiff = (d: PrefixDiff): boolean =>
  d.adds.length === 0 && d.updates.length === 0 && d.deletes.length === 0;
