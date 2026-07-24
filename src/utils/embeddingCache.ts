import type { EmbeddingRole } from "@/store/projectionSlice";

export interface EmbeddingCacheEntry {
  readonly commit: string;
  readonly role: EmbeddingRole;
  readonly docType: string;
  readonly embeddings: Record<string, number[]>;
  readonly storedAt: number;
}

const CACHE_PREFIX = "tdb-emb:";
const CACHE_VERSION = 1;
const MAX_AGE_MS = 1000 * 60 * 60 * 24; // 24 hours

function cacheKey(commit: string, role: EmbeddingRole, docType: string): string {
  return `${CACHE_PREFIX}${CACHE_VERSION}:${commit}:${role}:${docType}`;
}

export function getCachedEmbeddings(
  commit: string,
  role: EmbeddingRole,
  docType: string,
): Record<string, number[]> | null {
  try {
    const raw = localStorage.getItem(cacheKey(commit, role, docType));
    if (!raw) return null;
    const entry = JSON.parse(raw) as EmbeddingCacheEntry;
    if (Date.now() - entry.storedAt > MAX_AGE_MS) {
      localStorage.removeItem(cacheKey(commit, role, docType));
      return null;
    }
    return entry.embeddings;
  } catch {
    return null;
  }
}

export function setCachedEmbeddings(
  commit: string,
  role: EmbeddingRole,
  docType: string,
  embeddings: Record<string, number[]>,
): void {
  try {
    const entry: EmbeddingCacheEntry = {
      commit,
      role,
      docType,
      embeddings,
      storedAt: Date.now(),
    };
    localStorage.setItem(cacheKey(commit, role, docType), JSON.stringify(entry));
  } catch {
    // localStorage might be full — silently drop
  }
}

export function getCachedEmbeddingsForTypes(
  commit: string,
  role: EmbeddingRole,
  docTypes: ReadonlyArray<string>,
): { found: Record<string, number[]>; missing: string[] } {
  const found: Record<string, number[]> = {};
  const missing: string[] = [];
  for (const docType of docTypes) {
    const cached = getCachedEmbeddings(commit, role, docType);
    if (cached) {
      for (const [id, emb] of Object.entries(cached)) {
        found[id] = emb;
      }
    } else {
      missing.push(docType);
    }
  }
  return { found, missing };
}

export function clearEmbeddingCache(commit?: string): void {
  const keys = Object.keys(localStorage);
  for (const key of keys) {
    if (key.startsWith(CACHE_PREFIX)) {
      if (commit) {
        const parts = key.split(":");
        if (parts[2] === commit) {
          localStorage.removeItem(key);
        }
      } else {
        localStorage.removeItem(key);
      }
    }
  }
}
