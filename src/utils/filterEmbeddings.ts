export interface FilterEmbeddingsParams {
  readonly projectSelectionOnly: boolean;
  readonly projectionSelectionIds: ReadonlySet<string>;
  readonly projectWorkingSet: boolean;
  readonly workingSetIds: ReadonlySet<string>;
  readonly selectedTypes?: ReadonlySet<string>;
  readonly docToTypeMap?: Readonly<Record<string, string>>;
}

export function filterEmbeddings(
  allEmbeddings: Readonly<Record<string, number[]>>,
  params: FilterEmbeddingsParams,
): Record<string, number[]> {
  if (params.projectSelectionOnly && params.projectionSelectionIds.size > 0) {
    const filtered: Record<string, number[]> = {};
    for (const [id, emb] of Object.entries(allEmbeddings)) {
      if (params.projectionSelectionIds.has(id)) {
        filtered[id] = [...emb];
      }
    }
    return filtered;
  }

  if (params.projectWorkingSet && params.workingSetIds.size > 0) {
    const filtered: Record<string, number[]> = {};
    for (const [id, emb] of Object.entries(allEmbeddings)) {
      const inWorkingSet = params.workingSetIds.has(id);
      const matchesType = params.selectedTypes && params.docToTypeMap
        ? params.selectedTypes.has(params.docToTypeMap[id] ?? "Unknown")
        : false;
      if (inWorkingSet || matchesType) {
        filtered[id] = [...emb];
      }
    }
    return filtered;
  }

  const result: Record<string, number[]> = {};
  for (const [id, emb] of Object.entries(allEmbeddings)) {
    result[id] = [...emb];
  }
  return result;
}
