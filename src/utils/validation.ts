export function isValidJson(text: string): boolean {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// Ids are stored/sent verbatim (e.g. "Person/Kurt%20G%C3%B6del") but should
// render human-readable. Display-only decode — never apply to wire values.
// Encode an @id for the wire. The stored id is a literal that may itself
// contain percent-encoding ("Person/Kurt%20Gödel") or be a full IRI
// ("https://ex.com/data/Person/Kurt%20Gödel") — the server decodes the
// query param once, so each segment must be encoded as-is (% → %25) while
// scheme, authority and "/" separators stay literal. This is the one place
// doc-id wire encoding is defined — call it for every id param.
export function normalizeDocId(id: string): string {
  const iri = /^([a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^/]*)(\/.*)?$/.exec(id);
  const prefix = iri ? iri[1] : "";
  const rest = iri ? (iri[2] ?? "") : id;
  return prefix + rest.split("/").map(encodeURIComponent).join("/");
}

export function displayId(id: string): string {
  try {
    return decodeURIComponent(id);
  } catch {
    return id;
  }
}

export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "...";
}
