import { useMemo } from "react";
import { useGetInfoQuery } from "@/store";

export type IndexerState = "configured" | "available" | "operational" | "not_configured" | "not_available";

export interface IndexerStatus {
  readonly state: IndexerState;
  readonly configured: boolean;
  readonly available: boolean;
  readonly backend: string;
  readonly isLoading: boolean;
  readonly error: unknown;
}

export function useIndexerStatus(): IndexerStatus {
  const { data: info, isLoading, error } = useGetInfoQuery();

  return useMemo<IndexerStatus>(() => {
    const indexer = info?.indexer;
    const configured = indexer?.configured ?? false;
    const available = indexer?.available ?? false;
    const backend = indexer?.backend ?? "none";

    let state: IndexerState;
    if (!configured) {
      state = "not_configured";
    } else if (!available) {
      state = "not_available";
    } else {
      state = "operational";
    }

    return { state, configured, available, backend, isLoading, error };
  }, [info, isLoading, error]);
}
