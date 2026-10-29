// Witness formatting for the schema check. IRIs arrive already compressed
// (the engine folds them through the database @context since the
// schema-modeller-adjustments change), so these helpers format only.

// Human-readable single-line summary of one schema-check witness.
export const witnessSummary = (w: unknown): string | null => {
  if (!w || typeof w !== "object") return null;
  const obj = w as Record<string, unknown>;
  // Property-keyed wrappers: { "field": { @type, ... } }
  if (!("@type" in obj)) {
    const inner = Object.values(obj).find((v) => v && typeof v === "object" && "@type" in (v as object));
    return inner ? witnessSummary(inner) : null;
  }
  const type = String(obj["@type"]);
  const bits: string[] = [];
  for (const key of ["property", "field", "type", "ascribed_type", "required_type"]) {
    const v = obj[key];
    if (v === undefined) continue;
    bits.push(`${key}=${Array.isArray(v) ? v.map(String).join(",") : String(v)}`);
  }
  return bits.length ? `${type} (${bits.join(", ")})` : type;
};
