import { useState, useCallback } from "react";
import { config } from "@/config";
import { useAppSelector } from "@/store";

export interface CommitChanges {
  readonly added: readonly string[];
  readonly changed: readonly string[];
  readonly deleted: readonly string[];
}

export function useCommitChanges(org: string, team: string) {
  const credentials = useAppSelector((state) => state.auth.credentials);
  const [changesCache, setChangesCache] = useState<Record<string, CommitChanges>>({});
  const [countsCache, setCountsCache] = useState<Record<string, { added: number; changed: number; deleted: number }>>({});
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const fetchChanges = useCallback(
    async (commitId: string) => {
      if (changesCache[commitId]) return;
      if (!org || !team || !commitId) return;

      setLoadingIds((prev) => new Set(prev).add(commitId));
      setError(null);
      try {
        const url = `${config.apiUrl}/api/changes/${org}/${team}/local/commit/${commitId}`;
        const headers: Record<string, string> = {
          Accept: "application/json",
        };
        if (credentials) {
          headers.Authorization = `Basic ${credentials}`;
        }
        const res = await fetch(url, { headers });
        if (!res.ok) {
          const body = await res.text();
          throw new Error(`HTTP ${res.status}: ${body}`);
        }
        const data = (await res.json()) as CommitChanges;
        setChangesCache((prev) => ({ ...prev, [commitId]: data }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
      } finally {
        setLoadingIds((prev) => {
          const next = new Set(prev);
          next.delete(commitId);
          return next;
        });
      }
    },
    [org, team, credentials, changesCache],
  );

  const fetchCountsBatch = useCallback(
    async (commitIds: readonly string[]) => {
      if (!org || !team || commitIds.length === 0) return;
      const toFetch = commitIds.filter((id) => !countsCache[id] && !changesCache[id]);
      if (toFetch.length === 0) return;

      const headers: Record<string, string> = {
        Accept: "application/json",
      };
      if (credentials) {
        headers.Authorization = `Basic ${credentials}`;
      }

      // Fetch counts in parallel (limited concurrency)
      const CONCURRENCY = 10;
      for (let i = 0; i < toFetch.length; i += CONCURRENCY) {
        const batch = toFetch.slice(i, i + CONCURRENCY);
        await Promise.all(
          batch.map(async (commitId) => {
            try {
              const url = `${config.apiUrl}/api/changes/${org}/${team}/local/commit/${commitId}`;
              const res = await fetch(url, { headers });
              if (!res.ok) return;
              const data = (await res.json()) as CommitChanges;
              setCountsCache((prev) => ({
                ...prev,
                [commitId]: {
                  added: data.added.length,
                  changed: data.changed.length,
                  deleted: data.deleted.length,
                },
              }));
            } catch {
              // skip individual failures
            }
          }),
        );
      }
    },
    [org, team, credentials, countsCache, changesCache],
  );

  return { changesCache, countsCache, loadingIds, error, fetchChanges, fetchCountsBatch };
}
