/// <reference lib="webworker" />
import { UMAP } from "umap-js";

export interface UmapWorkerInput {
  readonly embeddings: ReadonlyArray<ReadonlyArray<number>>;
  readonly ids: ReadonlyArray<string>;
  readonly nComponents: 2 | 3;
  readonly nNeighbors: number;
  readonly minDist: number;
  readonly spread: number;
}

export interface UmapWorkerOutput {
  readonly ids: ReadonlyArray<string>;
  readonly projections: ReadonlyArray<ReadonlyArray<number>>;
}

self.onmessage = (event: MessageEvent<UmapWorkerInput>) => {
  const { embeddings, ids, nComponents, nNeighbors, minDist, spread } = event.data;

  if (embeddings.length === 0) {
    const output: UmapWorkerOutput = { ids: [], projections: [] };
    (self as unknown as Worker).postMessage(output);
    return;
  }

  const umap = new UMAP({
    nComponents,
    nNeighbors: Math.min(nNeighbors, embeddings.length),
    minDist,
    spread,
  });

  const matrix = embeddings.map((e) => [...e]);
  const result = umap.fit(matrix);

  const output: UmapWorkerOutput = {
    ids,
    projections: result.map((row) => [...row]),
  };
  (self as unknown as Worker).postMessage(output);
};
