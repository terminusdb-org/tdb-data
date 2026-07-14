import { useState, useEffect, useRef, useCallback } from "react";
import type { UmapWorkerOutput } from "@/workers/umapWorker";

export interface UmapProjectionPoint {
  readonly id: string;
  readonly position: ReadonlyArray<number>;
}

export interface UseUmapProjectionResult {
  readonly points: ReadonlyArray<UmapProjectionPoint>;
  readonly isRunning: boolean;
  readonly error: string | null;
  readonly reproject: () => void;
}

export interface UseUmapProjectionParams {
  readonly embeddings: Readonly<Record<string, ReadonlyArray<number>>>;
  readonly nComponents: 2 | 3;
  readonly nNeighbors?: number;
  readonly minDist?: number;
  readonly spread?: number;
  readonly enabled?: boolean;
}

export function useUmapProjection(params: UseUmapProjectionParams): UseUmapProjectionResult {
  const { embeddings, nComponents, enabled = true } = params;
  const nNeighbors = params.nNeighbors ?? 15;
  const minDist = params.minDist ?? 0.1;
  const spread = params.spread ?? 1.0;

  const [points, setPoints] = useState<ReadonlyArray<UmapProjectionPoint>>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const embeddingsRef = useRef(embeddings);
  const handlerRef = useRef<((event: MessageEvent<UmapWorkerOutput>) => void) | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    embeddingsRef.current = embeddings;
  }, [embeddings]);

  const runProjection = useCallback(() => {
    const entries = Object.entries(embeddingsRef.current);
    if (entries.length === 0) {
      setPoints([]);
      return;
    }

    const ids = entries.map(([id]) => id);
    const matrix = entries.map(([, emb]) => [...emb]);

    setIsRunning(true);
    setError(null);

    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL("../workers/umapWorker.ts", import.meta.url),
        { type: "module" }
      );
    }

    const worker = workerRef.current;

    if (handlerRef.current) {
      worker.removeEventListener("message", handlerRef.current);
    }

    const currentRequestId = ++requestIdRef.current;

    const handler = (event: MessageEvent<UmapWorkerOutput>) => {
      if (currentRequestId !== requestIdRef.current) return;
      const output = event.data;
      const newPoints = output.ids.map((id, i) => ({
        id,
        position: output.projections[i],
      }));
      setPoints(newPoints);
      setIsRunning(false);
      worker.removeEventListener("message", handler);
      handlerRef.current = null;
    };

    handlerRef.current = handler;
    worker.addEventListener("message", handler);

    worker.onerror = (e) => {
      if (currentRequestId !== requestIdRef.current) return;
      setError(e.message);
      setIsRunning(false);
    };

    worker.postMessage({
      embeddings: matrix,
      ids,
      nComponents,
      nNeighbors,
      minDist,
      spread,
    });
  }, [nComponents, nNeighbors, minDist, spread]);

  useEffect(() => {
    if (enabled) {
      runProjection();
    }
  }, [enabled, runProjection, embeddings]);

  const reproject = useCallback(() => {
    runProjection();
  }, [runProjection]);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  return { points, isRunning, error, reproject };
}
