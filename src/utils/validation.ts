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
// Canonicalize a user-entered @id to the server's percent-encoded IRI form:
// encode each "/"-segment, decoding first so already-encoded input
// ("Kurt%20G%C3%B6del") and raw input ("Kurt Gödel") normalize identically.
export function normalizeDocId(id: string): string {
  return id
    .split("/")
    .map((seg) => {
      let raw = seg;
      try {
        raw = decodeURIComponent(seg);
      } catch {
        // stray '%' — keep segment as-is
      }
      return encodeURIComponent(raw);
    })
    .join("/");
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
