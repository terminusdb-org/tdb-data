import type { SchemaClass } from "@/types/terminusdb";

// TerminusDB stores class + field documentation in the class document's
// @documentation array: one default entry (no @language) plus one entry per
// language. Entries may also carry @properties/@values maps and type metadata.

export interface LangDoc {
  label?: string;
  comment?: string;
}

export interface DocumentationSet {
  /** The default (no-language) entry. */
  default: LangDoc;
  /** Per-language entries keyed by BCP47 tag. */
  translations: Record<string, LangDoc>;
}

type DocEntry = Record<string, unknown>;

export const asArray = (v: unknown): DocEntry[] => {
  if (!v) return [];
  const arr = Array.isArray(v) ? v : [v];
  return arr.filter((e): e is DocEntry => !!e && typeof e === "object" && !Array.isArray(e));
};

const readLangDoc = (v: unknown): LangDoc => {
  if (typeof v === "string") return v ? { comment: v } : {};
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    const d: LangDoc = {};
    if (typeof o["@label"] === "string") d.label = o["@label"];
    if (typeof o["@comment"] === "string") d.comment = o["@comment"];
    if (typeof o["description"] === "string") d.comment ??= o["description"];
    return d;
  }
  return {};
};

const empty = (): DocumentationSet => ({ default: {}, translations: {} });

/** Type-level documentation: top-level @label/@comment per language. */
export const readTypeDocs = (cls: SchemaClass): DocumentationSet => {
  const out = empty();
  for (const e of asArray(cls["@documentation"])) {
    const lang = typeof e["@language"] === "string" ? e["@language"] : undefined;
    const doc: LangDoc = {
      ...(typeof e["@label"] === "string" && { label: e["@label"] }),
      ...(typeof e["@comment"] === "string" && { comment: e["@comment"] }),
    };
    // Skip entries whose type-level doc is empty (e.g. only @properties) —
    // they carry no row for the type editor.
    if (isBlank(doc)) continue;
    if (lang) out.translations[lang] = doc;
    else out.default = doc;
  }
  return out;
};

/** Field-level documentation: @properties[propName] per language entry. */
export const readPropDocs = (cls: SchemaClass, propName: string): DocumentationSet => {
  const out = empty();
  for (const e of asArray(cls["@documentation"])) {
    const props = e["@properties"];
    if (!props || typeof props !== "object" || Array.isArray(props)) continue;
    const doc = readLangDoc((props as Record<string, unknown>)[propName]);
    if (isBlank(doc)) continue;
    const lang = typeof e["@language"] === "string" ? e["@language"] : undefined;
    if (lang) out.translations[lang] = doc;
    else out.default = doc;
  }
  return out;
};

const isBlank = (d: LangDoc) => !d.label?.trim() && !d.comment?.trim();

const langDocToTerminus = (d: LangDoc): Record<string, string> | undefined => {
  const out: Record<string, string> = {};
  if (d.label?.trim()) out["@label"] = d.label.trim();
  if (d.comment?.trim()) out["@comment"] = d.comment.trim();
  return Object.keys(out).length ? out : undefined;
};

/**
 * Rebuild a class doc's @documentation with updated type- or field-level
 * docs. All other entry content (@values, type metadata keys) is preserved.
 *
 * Engine rule (api:NoLanguageTagForMultilingual): untagged and @language-
 * tagged entries cannot mix. When the update introduces tagged entries and
 * the doc still has an untagged entry, the untagged entry is retagged to
 * `defaultLang` so its remaining content survives under that language.
 */
export const withDocumentation = (
  cls: SchemaClass,
  update: { typeDocs?: DocumentationSet; propName?: string; propDocs?: DocumentationSet; defaultLang?: string }
): SchemaClass => {
  const wantedLangs = new Set<string>();
  const docs = update.propDocs ?? update.typeDocs;
  if (docs) Object.keys(docs.translations).forEach((l) => wantedLangs.add(l));
  const multilingual = wantedLangs.size > 0;

  const rawEntries = asArray(cls["@documentation"]);
  const untagged = rawEntries.filter((e) => e["@language"] === undefined);
  let entries = rawEntries;
  if (multilingual && untagged.length > 0) {
    if (untagged.length > 1) throw new Error("Internal error: multiple untagged @documentation entries");
    if (!update.defaultLang) throw new Error("Internal error: multilingual @documentation update requires defaultLang to retag the untagged entry");
    entries = rawEntries.map((e) => (e["@language"] === undefined ? { ...e, "@language": update.defaultLang } : e));
    const langs = new Set<string>();
    for (const e of entries) {
      const l = e["@language"];
      if (typeof l === "string") {
        if (langs.has(l)) throw new Error(`Internal error: duplicate @documentation language "${l}"`);
        langs.add(l);
      }
    }
  }

  const applyTo = (e: DocEntry, lang: string | undefined): DocEntry => {
    const next = { ...e };
    // A retagged (former default) entry takes docs.default unless it is blank,
    // in which case the caller-provided translations[defaultLang] applies.
    const d = docs
      ? lang === update.defaultLang && !isBlank(docs.default)
        ? docs.default
        : lang
          ? docs.translations[lang]
          : docs.default
      : undefined;
    if (update.typeDocs) {
      const td = langDocToTerminus(d ?? {});
      delete next["@label"];
      delete next["@comment"];
      if (td) Object.assign(next, td);
    }
    if (update.propName) {
      const props = { ...(next["@properties"] as Record<string, unknown> | undefined) };
      const pd = langDocToTerminus(d ?? {});
      if (pd) props[update.propName] = pd;
      else delete props[update.propName];
      if (Object.keys(props).length) next["@properties"] = props;
      else delete next["@properties"];
    }
    return next;
  };

  const result: DocEntry[] = entries.map((e) =>
    applyTo(e, typeof e["@language"] === "string" ? e["@language"] : undefined)
  );
  const hasDefault = entries.some((e) => e["@language"] === undefined);
  // Create an untagged default entry when needed — only for monolingual
  // output; a multilingual doc must not gain an untagged entry.
  if (!hasDefault && !multilingual && docs && (!isBlank(docs.default) || update.propName)) {
    result.unshift(applyTo({}, undefined));
  }
  // Create entries for languages that had none.
  const presentLangs = new Set(entries.map((e) => e["@language"]).filter((l) => typeof l === "string"));
  for (const lang of wantedLangs) {
    if (!presentLangs.has(lang)) {
      result.push(applyTo({ "@language": lang }, lang));
    }
  }
  // Drop language entries that are now empty of all documentation content.
  // Drop entries left with no documentation content at all.
  const cleaned = result.filter((e) => Object.keys(e).some((k) => k !== "@language"));
  const next = { ...(cls as Record<string, unknown>) };
  if (cleaned.length) next["@documentation"] = cleaned;
  else delete next["@documentation"];
  return next as SchemaClass;
};
