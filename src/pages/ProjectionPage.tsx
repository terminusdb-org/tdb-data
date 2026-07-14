import React, { useMemo, useCallback, useEffect, useRef } from "react";
import {
  PageShell,
  PageHeader,
  PagePlaceholder,
  Scatter2D,
  Scatter3D,
  TypeFilterPanel,
  ProjectionUnderpanel,
  DuplicateHighlightPanel,
  ProjectionSearchBar,
  WorkingSetPanel,
  PanelDock,
  useRouteParams,
  type TypeFilterEntry,
  type DupPanelGroup,
  type ScatterPoint,
  type Point3D,
} from "@/components";
import {
  useGetSchemaQuery,
  useGetEmbeddingsByTypeQuery,
  useGetDocumentQuery,
  useDuplicatesQuery,
  useGetIndexStatusQuery,
  useAppDispatch,
  useAppSelector,
  toggleType,
  setSelectedTypes,
  setFilterMode,
  setSelectedId,
  setHighlightedIds,
  toggleShowDuplicates,
  setLoadedTypes,
  toggleProjectionSelectionId,
  setProjectionSelectionIds,
  clearProjectionSelection,
  addToWorkingSet,
  removeFromWorkingSet,
  setWorkingSetIds,
  clearWorkingSet,
  toggleWorkingSetVisible,
  toggleProjectSelectionOnly,
  setProjectSelectionOnly,
  toggleProjectWorkingSet,
  setDimensions,
  setEmbeddingRole,
  setProjectionResult,
  selectSelectedTypes,
  selectFilterMode,
  selectSelectedId,
  selectHighlightedIds,
  selectShowDuplicates,
  selectLoadedTypes,
  selectWorkingSetIds,
  selectWorkingSetVisible,
  selectProjectionSelectionIds,
  selectProjectSelectionOnly,
  selectProjectWorkingSet,
  selectDimensions,
  selectEmbeddingRole,
  selectProjectionCacheKey,
  selectProjectionPoints2d,
  selectProjectionPoints3d,
} from "@/store";
import { buildApiPath } from "@/utils/routes";
import { generateTypeColors } from "@/utils/typeColors";
import { useUmapProjection, type UmapProjectionPoint } from "@/hooks/useUmapProjection";

export const ProjectionPage: React.FC = () => {
  const routeParams = useRouteParams();
  const dimensions = useAppSelector(selectDimensions);
  const embeddingRole = useAppSelector(selectEmbeddingRole);

  const schemaPath = routeParams ? buildApiPath(routeParams, "schema") : "";
  const embeddingsPath = routeParams
    ? buildApiPath(routeParams, "plugin/search-embeddings")
    : "";
  const duplicatesPath = routeParams
    ? buildApiPath(routeParams, "duplicates")
    : "";
  const searchPath = routeParams
    ? buildApiPath(routeParams, "search")
    : "";
  const indexPath = routeParams
    ? buildApiPath(routeParams, "index")
    : "";

  const { data: schemaClasses, isLoading: schemaLoading } = useGetSchemaQuery(
    { path: schemaPath, asList: true },
    { skip: !routeParams }
  );

  const allTypes = useMemo(() => {
    if (!schemaClasses) return [];
    return schemaClasses
      .filter((c) => {
        const t = c["@type"];
        return t === "Class" || t === "Enum";
      })
      .map((c) => c["@id"])
      .filter((id): id is string => typeof id === "string");
  }, [schemaClasses]);

  const typeColors = useMemo(() => generateTypeColors(allTypes), [allTypes]);

  const dispatch = useAppDispatch();

  const selectedTypesArr = useAppSelector(selectSelectedTypes);
  const filterMode = useAppSelector(selectFilterMode);
  const selectedId = useAppSelector(selectSelectedId);
  const highlightedIdsArr = useAppSelector(selectHighlightedIds);
  const showDuplicates = useAppSelector(selectShowDuplicates);
  const loadedTypesArr = useAppSelector(selectLoadedTypes);
  const workingSetIdsArr = useAppSelector(selectWorkingSetIds);
  const workingSetVisible = useAppSelector(selectWorkingSetVisible);
  const projectionSelectionIdsArr = useAppSelector(selectProjectionSelectionIds);
  const projectSelectionOnly = useAppSelector(selectProjectSelectionOnly);
  const projectWorkingSet = useAppSelector(selectProjectWorkingSet);
  const projectionCacheKey = useAppSelector(selectProjectionCacheKey);
  const projectionPoints2d = useAppSelector(selectProjectionPoints2d);
  const projectionPoints3d = useAppSelector(selectProjectionPoints3d);

  const selectedTypes = useMemo(() => new Set(selectedTypesArr), [selectedTypesArr]);
  const highlightedIds = useMemo(() => new Set(highlightedIdsArr), [highlightedIdsArr]);
  const loadedTypes = useMemo(() => new Set(loadedTypesArr), [loadedTypesArr]);
  const workingSetIds = useMemo(() => new Set(workingSetIdsArr), [workingSetIdsArr]);
  const projectionSelectionIds = useMemo(() => new Set(projectionSelectionIdsArr), [projectionSelectionIdsArr]);

  const docTypesForQuery = useMemo(() => {
    return [...selectedTypes];
  }, [selectedTypes]);

  const workingSetDocIds = useMemo(() => {
    if (projectWorkingSet && workingSetIds.size > 0) {
      return [...workingSetIds];
    }
    return [];
  }, [projectWorkingSet, workingSetIds]);

  const hasActiveQuery = selectedTypes.size > 0 || (projectWorkingSet && workingSetDocIds.length > 0);

  const { data: embeddingsData, isLoading: embeddingsLoading } =
    useGetEmbeddingsByTypeQuery(
      { path: embeddingsPath, docTypes: docTypesForQuery, docIds: workingSetDocIds },
      { skip: !routeParams || !embeddingsPath || !hasActiveQuery }
    );

  useEffect(() => {
    if (!embeddingsLoading && embeddingsData && hasActiveQuery) {
      dispatch(setLoadedTypes([...selectedTypes]));
    }
  }, [embeddingsLoading, embeddingsData, selectedTypes, hasActiveQuery, dispatch]);

  const { data: duplicatesData, isFetching: duplicatesLoading } = useDuplicatesQuery(
    { path: duplicatesPath, count: 50 },
    { skip: !routeParams || !duplicatesPath || !showDuplicates }
  );

  const { data: indexStatus } = useGetIndexStatusQuery(
    { path: indexPath },
    { skip: !routeParams || !indexPath }
  );

  const allEmbeddings = embeddingsData
    ? embeddingRole === "clustering"
      ? embeddingsData.clustering_embeddings
      : embeddingsData.doc_embeddings
    : {};

  const embeddings = useMemo(() => {
    if (projectSelectionOnly && projectionSelectionIds.size > 0) {
      const filtered: Record<string, number[]> = {};
      for (const [id, emb] of Object.entries(allEmbeddings)) {
        if (projectionSelectionIds.has(id)) {
          filtered[id] = [...emb];
        }
      }
      return filtered;
    }
    return allEmbeddings;
  }, [allEmbeddings, projectSelectionOnly, projectionSelectionIds]);

  const cacheKey = useMemo(() => {
    const typesKey = [...selectedTypes].sort().join(",");
    const wsKey = projectWorkingSet && workingSetIds.size > 0 ? `ws:${[...workingSetIds].sort().join(",")}` : "no-ws";
    const selectKey = projectSelectionOnly ? `sel:${[...projectionSelectionIds].sort().join(",")}` : "all";
    return `${embeddingRole}|${typesKey}|${wsKey}|${selectKey}`;
  }, [selectedTypes, embeddingRole, projectSelectionOnly, projectionSelectionIds, projectWorkingSet, workingSetIds]);

  const cacheValid = projectionCacheKey === cacheKey;
  const cachedPointsForCurrentDim = cacheValid
    ? (dimensions === 2 ? projectionPoints2d : projectionPoints3d)
    : null;
  const cachedPointsForOtherDim = cacheValid
    ? (dimensions === 2 ? projectionPoints3d : projectionPoints2d)
    : null;
  const otherDimension: 2 | 3 = dimensions === 2 ? 3 : 2;

  const handleProjectionResult = useCallback((pts: ReadonlyArray<UmapProjectionPoint>, dim: 2 | 3) => {
    dispatch(setProjectionResult({
      dimension: dim,
      points: pts.map((p) => ({ id: p.id, position: [...p.position] })),
      cacheKey,
    }));
  }, [dispatch, cacheKey]);

  const { points, isRunning: isProjecting, reproject } = useUmapProjection({
    embeddings,
    nComponents: dimensions,
    enabled: !embeddingsLoading && Object.keys(embeddings).length > 0,
    cachedPoints: cachedPointsForCurrentDim,
    onResult: handleProjectionResult,
  });

  const otherDimHasCache = cachedPointsForOtherDim !== null && cachedPointsForOtherDim.length > 0;

  const { isRunning: isBackgroundProjecting } = useUmapProjection({
    embeddings,
    nComponents: otherDimension,
    enabled: !embeddingsLoading && Object.keys(embeddings).length > 0 && !otherDimHasCache && !isProjecting,
    cachedPoints: cachedPointsForOtherDim,
    onResult: handleProjectionResult,
  });

  const docToTypeMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const id of Object.keys(allEmbeddings)) {
      const parts = id.split("/");
      const typePart = parts.at(-2);
      if (typePart) map[id] = typePart;
    }
    return map;
  }, [allEmbeddings]);

  const scatterPoints = useMemo(() => {
    return points.map((p) => {
      const docType = docToTypeMap[p.id] ?? "Unknown";
      const color = typeColors[docType];
      const rgb: [number, number, number] = color
        ? hexToRgb(color.hex)
        : [128, 128, 128];
      const position: [number, number] | [number, number, number] =
        dimensions === 3
          ? [p.position[0], p.position[1], p.position[2] ?? 0]
          : [p.position[0], p.position[1]];
      return {
        id: p.id,
        position,
        color: rgb,
        radius: 5,
        docType,
      };
    });
  }, [points, docToTypeMap, typeColors, dimensions]);

  const dimmedTypes = useMemo(() => {
    if (filterMode !== "visual") return new Set<string>();
    const dimmed = new Set<string>();
    for (const t of allTypes) {
      if (!selectedTypes.has(t)) dimmed.add(t);
    }
    return dimmed;
  }, [filterMode, selectedTypes, allTypes]);

  const typeFilterEntries: TypeFilterEntry[] = useMemo(() => {
    return allTypes.map((type) => ({
      type,
      count: scatterPoints.filter((p) => p.docType === type).length,
      color: typeColors[type] ?? { hex: "#808080", hsl: "hsl(0, 0%, 50%)" },
      checked: selectedTypes.has(type),
      loading: selectedTypes.has(type) && !loadedTypes.has(type),
    }));
  }, [allTypes, scatterPoints, typeColors, selectedTypes, loadedTypes]);

  const duplicateGroups: DupPanelGroup[] = useMemo(() => {
    if (!duplicatesData) return [];
    return duplicatesData.slice(0, 20).map((g) => ({
      distance: g.distance,
      members: g.group.map((m) => m.id),
    }));
  }, [duplicatesData]);

  const docPath = routeParams
    ? buildApiPath(routeParams, "document")
    : "";
  const { data: selectedDoc, isLoading: docLoading } = useGetDocumentQuery(
    { path: docPath, id: selectedId ?? "" },
    { skip: !selectedId || !docPath }
  );

  const handleToggleType = useCallback((type: string) => {
    dispatch(toggleType(type));
  }, [dispatch]);

  const handleSelectAll = useCallback(() => {
    dispatch(setSelectedTypes(allTypes));
  }, [allTypes, dispatch]);

  const handleSelectNone = useCallback(() => {
    dispatch(setSelectedTypes([]));
  }, [dispatch]);

  const shiftPressedRef = useRef(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Shift") shiftPressedRef.current = true; };
    const onKeyUp = (e: KeyboardEvent) => { if (e.key === "Shift") shiftPressedRef.current = false; };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  const handleToggleProjectWorkingSet = useCallback(() => {
    dispatch(toggleProjectWorkingSet());
  }, [dispatch]);

  const handleSelect = useCallback((id: string | null) => {
    if (id === null) {
      dispatch(setSelectedId(null));
      return;
    }
    if (shiftPressedRef.current) {
      dispatch(toggleProjectionSelectionId(id));
    } else {
      dispatch(setSelectedId(id));
    }
  }, [dispatch]);

  const handleProjectSelection = useCallback(() => {
    if (projectionSelectionIds.size > 0) {
      dispatch(toggleProjectSelectionOnly());
    }
  }, [projectionSelectionIds, dispatch]);

  const handleClearSelection = useCallback(() => {
    dispatch(clearProjectionSelection());
  }, [dispatch]);

  const handleClearWorkingSet = useCallback(() => {
    dispatch(clearWorkingSet());
  }, [dispatch]);

  const handleToggleWorkingSetVisible = useCallback(() => {
    dispatch(toggleWorkingSetVisible());
  }, [dispatch]);

  const handleRemoveFromWorkingSet = useCallback((id: string) => {
    dispatch(removeFromWorkingSet(id));
  }, [dispatch]);

  const handleAddToWorkingSet = useCallback((ids: string[]) => {
    dispatch(addToWorkingSet(ids));
  }, [dispatch]);

  const handleLoadSet = useCallback((ids: string[]) => {
    dispatch(setWorkingSetIds(ids));
    dispatch(setProjectSelectionOnly(false));
  }, [dispatch]);

  const handleProjectSet = useCallback((ids: string[]) => {
    dispatch(setProjectionSelectionIds(ids));
    dispatch(setProjectSelectionOnly(true));
  }, [dispatch]);

  const scatterPointIdSet = useMemo(
    () => new Set(scatterPoints.map((p) => p.id)),
    [scatterPoints]
  );

  const combinedHighlightedIds = useMemo(() => {
    const combined = new Set(highlightedIds);
    for (const id of projectionSelectionIds) combined.add(id);
    return combined;
  }, [highlightedIds, projectionSelectionIds]);

  const toggleDimensions = useCallback(() => {
    dispatch(setDimensions(dimensions === 2 ? 3 : 2));
  }, [dispatch, dimensions]);

  const toggleEmbeddingRole = useCallback(() => {
    dispatch(setEmbeddingRole(embeddingRole === "document" ? "clustering" : "document"));
  }, [dispatch, embeddingRole]);

  if (!routeParams) return <PagePlaceholder>Select a data product first.</PagePlaceholder>;
  if (schemaLoading) return <PagePlaceholder>Loading schema…</PagePlaceholder>;

  const title = dimensions === 2 ? "2D Projection" : "3D Projection";

  return (
    <PageShell
      header={
        <PageHeader>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
              <p className="mt-0.5 text-sm text-gray-500">
                UMAP dimension reduction of document embeddings
                {isProjecting && " — projecting…"}
                {!isProjecting && isBackgroundProjecting && " — computing other view…"}
              </p>
              {embeddingsData && (
                <p className="mt-0.5 text-xs text-gray-400">
                  Data from commit:{" "}
                  <span className="font-mono">{embeddingsData.served_commit.slice(0, 12)}</span>
                  {indexStatus?.last_indexed_commit &&
                    indexStatus.last_indexed_commit !== embeddingsData.served_commit && (
                      <span className="ml-2 text-amber-600">
                        ⚠ Newer commit available: {indexStatus.last_indexed_commit.slice(0, 12)}
                      </span>
                    )}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {embeddingsData && (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                  {scatterPoints.length} points
                </span>
              )}
              <button
                type="button"
                onClick={toggleDimensions}
                className="flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                title="Toggle 2D/3D view"
              >
                {dimensions === 2 ? "2D" : "3D"}
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 10l5 5 5-5" />
                </svg>
              </button>
              {embeddingsData?.store_clustering && (
                <button
                  type="button"
                  onClick={toggleEmbeddingRole}
                  className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium hover:bg-gray-50 ${
                    embeddingRole === "clustering"
                      ? "border-dfrntBlue-300 bg-dfrntBlue-50 text-dfrntBlue-700"
                      : "border-gray-300 text-gray-600"
                  }`}
                  title="Toggle document/clustering embeddings"
                >
                  {embeddingRole === "clustering" ? "Clustering" : "Document"}
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 10l5 5 5-5" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </PageHeader>
      }
    >
      <div className="flex h-full">
        <div className="flex flex-1 flex-col">
          {scatterPoints.length > 0 && (
            <ProjectionSearchBar
              searchPath={searchPath}
              scatterPointIds={scatterPointIdSet}
              onHighlightIds={(ids) => dispatch(setHighlightedIds([...ids]))}
              onAddToWorkingSet={handleAddToWorkingSet}
            />
          )}
          <div className="relative flex-1">
            {selectedTypes.size === 0 && !(projectWorkingSet && workingSetDocIds.length > 0) ? (
              <PagePlaceholder>Select a document type or enable Working Set union to load embeddings.</PagePlaceholder>
            ) : embeddingsLoading ? (
              <PagePlaceholder>Loading embeddings…</PagePlaceholder>
            ) : isProjecting ? (
              <PagePlaceholder>Running UMAP projection…</PagePlaceholder>
            ) : scatterPoints.length > 0 ? (
              dimensions === 3 ? (
                <Scatter3D
                  points={scatterPoints as unknown as Point3D[]}
                  selectedId={selectedId}
                  highlightedIds={combinedHighlightedIds}
                  selectionIds={projectionSelectionIds}
                  workingSetIds={workingSetIds}
                  workingSetVisible={workingSetVisible}
                  dimmedTypes={dimmedTypes}
                  onSelect={handleSelect}
                  width={800}
                  height={500}
                />
              ) : (
                <Scatter2D
                  points={scatterPoints as unknown as ScatterPoint[]}
                  selectedId={selectedId}
                  highlightedIds={combinedHighlightedIds}
                  selectionIds={projectionSelectionIds}
                  workingSetIds={workingSetIds}
                  workingSetVisible={workingSetVisible}
                  dimmedTypes={dimmedTypes}
                  onSelect={handleSelect}
                  width={800}
                  height={500}
                />
              )
            ) : (
              <PagePlaceholder>No embeddings found. Index your documents first.</PagePlaceholder>
            )}
          </div>

          {projectionSelectionIds.size > 0 && (
            <div className="flex items-center gap-3 border-t border-gray-100 px-4 py-2 text-sm">
              <span className="text-gray-600">
                {projectionSelectionIds.size} selected
                {projectSelectionOnly && " (projecting only selection)"}
              </span>
              <button
                className={
                  projectSelectionOnly
                    ? "rounded bg-dfrntBlue-500 px-2 py-1 text-xs font-medium text-white"
                    : "rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600"
                }
                onClick={handleProjectSelection}
              >
                {projectSelectionOnly ? "Project All" : "Project Selection"}
              </button>
              <button
                className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600"
                onClick={handleClearSelection}
              >
                Clear
              </button>
            </div>
          )}
          {projectionSelectionIds.size === 0 && scatterPoints.length > 0 && (
            <div className="border-t border-gray-100 px-4 py-1.5 text-xs text-gray-400">
              Tip: Shift+click points to multi-select, then "Project Selection" to re-run UMAP on a subset.
            </div>
          )}

          <ProjectionUnderpanel
            selectedId={selectedId}
            docType={selectedId ? docToTypeMap[selectedId] ?? null : null}
            document={selectedDoc as Record<string, unknown> | null}
            isLoading={docLoading}
          />
        </div>

        <PanelDock
          side="right"
          sections={[
            {
              id: "types",
              title: "Document Types",
              icon: (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75h16.5v16.5H3.75z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 7.5h9M7.5 12h9M7.5 16.5h5" />
                </svg>
              ),
              content: (
                <TypeFilterPanel
                  types={typeFilterEntries}
                  filterMode={filterMode}
                  onToggleType={handleToggleType}
                  onSelectAll={handleSelectAll}
                  onSelectNone={handleSelectNone}
                  onFilterModeChange={setFilterMode}
                  onReproject={reproject}
                  isProjecting={isProjecting}
                  isLoading={embeddingsLoading}
                  projectWorkingSet={projectWorkingSet}
                  workingSetCount={workingSetIds.size}
                  onToggleProjectWorkingSet={handleToggleProjectWorkingSet}
                />
              ),
            },
            {
              id: "duplicates",
              title: "Duplicates",
              badge: showDuplicates && duplicateGroups.length > 0 ? duplicateGroups.length : undefined,
              icon: (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <circle cx="9" cy="12" r="5" />
                  <circle cx="15" cy="12" r="5" />
                </svg>
              ),
              content: (
                <DuplicateHighlightPanel
                  groups={duplicateGroups}
                  onHighlight={(ids) => dispatch(setHighlightedIds([...ids]))}
                  onAddToWorkingSet={handleAddToWorkingSet}
                  showDuplicates={showDuplicates}
                  onToggleLoadDuplicates={() => dispatch(toggleShowDuplicates())}
                  duplicatesLoading={duplicatesLoading}
                />
              ),
            },
            {
              id: "working-set",
              title: "Working Set",
              badge: workingSetIds.size > 0 ? workingSetIds.size : undefined,
              icon: (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.171.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23-.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                </svg>
              ),
              content: (
                <WorkingSetPanel
                  docPath={docPath}
                  workingSetIds={workingSetIds}
                  workingSetVisible={workingSetVisible}
                  onLoadSet={handleLoadSet}
                  onAddIds={handleAddToWorkingSet}
                  onClear={handleClearWorkingSet}
                  onToggleVisible={handleToggleWorkingSetVisible}
                  onProjectSet={handleProjectSet}
                  onRemoveItem={handleRemoveFromWorkingSet}
                />
              ),
            },
          ]}
        />
      </div>
    </PageShell>
  );
};


function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}
