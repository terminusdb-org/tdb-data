import { useCallback, useEffect, useRef, useState } from "react";
import { config } from "@/config";

export interface StreamingEmbeddingsParams {
  readonly path: string;
  readonly docTypes?: ReadonlyArray<string>;
  readonly docIds?: ReadonlyArray<string>;
  readonly skip: boolean;
}

export interface StreamingEmbeddingsResult {
  readonly docEmbeddings: Record<string, number[]>;
  readonly clusteringEmbeddings: Record<string, number[]>;
  readonly servedCommit: string;
  readonly storeClustering: boolean;
  readonly totalCount: number;
  readonly loadedCount: number;
  readonly isStreaming: boolean;
  readonly error: string | null;
}

export interface UseStreamingEmbeddingsCallbacks {
  readonly onProgress?: (loaded: number, total: number) => void;
  readonly onComplete: (result: {
    docEmbeddings: Record<string, number[]>;
    clusteringEmbeddings: Record<string, number[]>;
    servedCommit: string;
    storeClustering: boolean;
  }) => void;
  readonly onError: (error: Error) => void;
}

interface NdjsonRecord {
  readonly doc_id: string;
  readonly embedding: ReadonlyArray<number>;
  readonly clustering_embedding?: ReadonlyArray<number>;
}

export function useStreamingEmbeddings(
  params: StreamingEmbeddingsParams,
  callbacks: UseStreamingEmbeddingsCallbacks,
): {
  readonly stream: () => void;
  readonly cancel: () => void;
  readonly state: StreamingEmbeddingsResult;
} {
  const [state, setState] = useState<StreamingEmbeddingsResult>({
    docEmbeddings: {},
    clusteringEmbeddings: {},
    servedCommit: "",
    storeClustering: false,
    totalCount: 0,
    loadedCount: 0,
    isStreaming: false,
    error: null,
  });

  const abortRef = useRef<AbortController | null>(null);
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  const cancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setState((prev) => ({ ...prev, isStreaming: false }));
  }, []);

  const stream = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;

    setState({
      docEmbeddings: {},
      clusteringEmbeddings: {},
      servedCommit: "",
      storeClustering: false,
      totalCount: 0,
      loadedCount: 0,
      isStreaming: true,
      error: null,
    });

    const url = `${config.apiUrl}${params.path}`;
    const body = JSON.stringify({
      doc_ids: params.docIds ?? [],
      doc_types: params.docTypes ?? [],
    });

    const authState = JSON.parse(
      window.localStorage.getItem("terminusdb_data_auth") ?? "{}",
    ) as { credentials?: string };
    const headers: Record<string, string> = {
      Accept: "application/x-ndjson",
      "Content-Type": "application/json",
    };
    if (authState.credentials) {
      headers.Authorization = `Basic ${authState.credentials}`;
    }

    (async () => {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers,
          body,
          signal: controller.signal,
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(`Streaming embeddings failed: ${response.status} ${text}`);
        }

        const servedCommit = response.headers.get("x-served-commit") ?? "";
        const storeClustering =
          (response.headers.get("x-store-clustering") ?? "false").toLowerCase() === "true";
        const totalCount = parseInt(response.headers.get("x-total-count") ?? "0", 10) || 0;

        setState((prev) => ({
          ...prev,
          servedCommit,
          storeClustering,
          totalCount,
        }));

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("Response body is not readable");
        }

        const decoder = new TextDecoder();
        let buffer = "";
        const docEmbeddings: Record<string, number[]> = {};
        const clusteringEmbeddings: Record<string, number[]> = {};
        let loadedCount = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            try {
              const record = JSON.parse(trimmed) as NdjsonRecord;
              docEmbeddings[record.doc_id] = [...record.embedding];
              if (record.clustering_embedding) {
                clusteringEmbeddings[record.doc_id] = [...record.clustering_embedding];
              }
              loadedCount++;

              setState((prev) => ({
                ...prev,
                docEmbeddings: { ...docEmbeddings },
                clusteringEmbeddings: { ...clusteringEmbeddings },
                loadedCount,
              }));

              callbacksRef.current.onProgress?.(loadedCount, totalCount);
            } catch {
              // Skip malformed lines
            }
          }
        }

        // Process any remaining buffer
        const remaining = buffer.trim();
        if (remaining) {
          try {
            const record = JSON.parse(remaining) as NdjsonRecord;
            docEmbeddings[record.doc_id] = [...record.embedding];
            if (record.clustering_embedding) {
              clusteringEmbeddings[record.doc_id] = [...record.clustering_embedding];
            }
            loadedCount++;
          } catch {
            // Skip malformed final line
          }
        }

        setState((prev) => ({
          ...prev,
          docEmbeddings: { ...docEmbeddings },
          clusteringEmbeddings: { ...clusteringEmbeddings },
          loadedCount,
          isStreaming: false,
        }));

        callbacksRef.current.onComplete({
          docEmbeddings,
          clusteringEmbeddings,
          servedCommit,
          storeClustering,
        });
      } catch (err) {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : String(err);
        setState((prev) => ({
          ...prev,
          isStreaming: false,
          error: message,
        }));
        callbacksRef.current.onError(err instanceof Error ? err : new Error(message));
      }
    })();
  }, [params.path, params.docTypes, params.docIds]);

  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, []);

  return { stream, cancel, state };
}
