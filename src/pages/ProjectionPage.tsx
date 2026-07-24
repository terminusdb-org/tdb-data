import React, { useMemo, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  PageShell,
  PageHeader,
  PagePlaceholder,
  Scatter2D,
  Scatter3D,
  TypeFilterPanel,
  DuplicateHighlightPanel,
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
  setServedCommit,
  setStoreClustering,
  addLoadedTypes,
  clearLoadedEmbeddings,
  clearProjectionCache,
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
  setCameraState,
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
  selectServedCommit,
  selectStoreClustering,
  selectCameraState,
  setError,
} from "@/store";
import { buildApiPath } from "@/utils/routes";
import { generateTypeColors } from "@/utils/typeColors";
import { filterEmbeddings } from "@/utils/filterEmbeddings";
import { useUmapProjection, type UmapProjectionPoint } from "@/hooks/useUmapProjection";
import { useStreamingEmbeddings } from "@/hooks/useStreamingEmbeddings";
import { isSubdocument } from "@/types/terminusdb";
import { getCachedEmbeddingsForTypes, setCachedEmbeddings } from "@/utils/embeddingCache";

export const ProjectionPage: React.FC = () => {
  const { t } = useTranslation();
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
        return (t === "Class" || t === "Enum") && !isSubdocument(c);
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
  const servedCommit = useAppSelector(selectServedCommit);
  const storeClustering = useAppSelector(selectStoreClustering);

  const selectedTypes = useMemo(() => new Set(selectedTypesArr), [selectedTypesArr]);
  const highlightedIds = useMemo(() => new Set(highlightedIdsArr), [highlightedIdsArr]);
  const loadedTypes = useMemo(() => new Set(loadedTypesArr), [loadedTypesArr]);
  const workingSetIds = useMemo(() => new Set(workingSetIdsArr), [workingSetIdsArr]);
  const projectionSelectionIds = useMemo(() => new Set(projectionSelectionIdsArr), [projectionSelectionIdsArr]);

  const [allEmbeddings, setAllEmbeddings] = useState<Record<string, number[]>>({});

  useEffect(() => {
    dispatch(clearLoadedEmbeddings());
    dispatch(clearProjectionCache());
    setAllEmbeddings({});
  }, [dispatch, embeddingsPath]);

  const typesToLoad = useMemo(() => {
    if (projectSelectionOnly && projectionSelectionIds.size > 0) {
      return [];
    }
    return [...selectedTypes].filter((t) => !loadedTypes.has(t));
  }, [selectedTypes, loadedTypes, projectSelectionOnly, projectionSelectionIds]);

  const cachedTypesFromStorage = useMemo(() => {
    if (!servedCommit || typesToLoad.length === 0) return { found: {} as Record<string, number[]>, missing: typesToLoad };
    return getCachedEmbeddingsForTypes(servedCommit, embeddingRole, typesToLoad);
  }, [servedCommit, embeddingRole, typesToLoad]);

  useEffect(() => {
    if (Object.keys(cachedTypesFromStorage.found).length > 0) {
      setAllEmbeddings((prev) => ({ ...prev, ...cachedTypesFromStorage.found }));
      dispatch(addLoadedTypes(typesToLoad.filter((t) => !cachedTypesFromStorage.missing.includes(t))));
    }
  }, [cachedTypesFromStorage, dispatch, typesToLoad]);

  const docIdsToFetch = useMemo(() => {
    const ids = new Set<string>();
    if (projectWorkingSet && workingSetIds.size > 0) {
      for (const id of workingSetIds) ids.add(id);
    }
    if (projectSelectionOnly && projectionSelectionIds.size > 0) {
      for (const id of projectionSelectionIds) ids.add(id);
    }
    const result: string[] = [];
    for (const id of ids) {
      if (!allEmbeddings[id]) result.push(id);
    }
    return result;
  }, [projectWorkingSet, workingSetIds, projectSelectionOnly, projectionSelectionIds, allEmbeddings]);

  const hasTypesToLoad = cachedTypesFromStorage.missing.length > 0;
  const hasDocIdsToFetch = docIdsToFetch.length > 0;
  const hasActiveQuery = hasTypesToLoad || hasDocIdsToFetch;

  const streamingParams = useMemo(() => ({
    path: embeddingsPath,
    docTypes: cachedTypesFromStorage.missing,
    docIds: docIdsToFetch,
    skip: !routeParams || !embeddingsPath || !hasActiveQuery,
  }), [embeddingsPath, cachedTypesFromStorage.missing, docIdsToFetch, routeParams, hasActiveQuery]);

  const { stream: streamEmbeddings, state: streamState } = useStreamingEmbeddings(
    streamingParams,
    {
      onComplete: (result) => {
        const roleEmbeddings = embeddingRole === "clustering"
          ? (Object.keys(result.clusteringEmbeddings).length > 0
            ? result.clusteringEmbeddings
            : result.docEmbeddings)
          : result.docEmbeddings;
        const embRecord: Record<string, number[]> = {};
        for (const [id, emb] of Object.entries(roleEmbeddings)) {
          embRecord[id] = [...emb];
        }
        setAllEmbeddings((prev) => ({ ...prev, ...embRecord }));
        dispatch(setServedCommit(result.servedCommit));
        dispatch(setStoreClustering(result.storeClustering));
        dispatch(addLoadedTypes(cachedTypesFromStorage.missing));
        for (const docType of cachedTypesFromStorage.missing) {
          const typeEmbeddings: Record<string, number[]> = {};
          for (const [id, emb] of Object.entries(embRecord)) {
            const parts = id.split("/");
            const typePart = parts.at(-2);
            if (typePart === docType) typeEmbeddings[id] = emb;
          }
          if (Object.keys(typeEmbeddings).length > 0) {
            setCachedEmbeddings(result.servedCommit, embeddingRole, docType, typeEmbeddings);
          }
        }
      },
      onError: (err) => {
        dispatch(setError({ message: t("projection.streamingError", { message: err.message }) }));
      },
    },
  );

  useEffect(() => {
    if (!streamingParams.skip && hasActiveQuery) {
      streamEmbeddings();
    }
  }, [streamingParams.skip, hasActiveQuery, streamEmbeddings]);

  const embeddingsLoading = streamState.isStreaming;

  const { data: duplicatesData, isFetching: duplicatesLoading } = useDuplicatesQuery(
    { path: duplicatesPath, count: 50 },
    { skip: !routeParams || !duplicatesPath || !showDuplicates }
  );

  const { data: indexStatus } = useGetIndexStatusQuery(
    { path: indexPath },
    { skip: !routeParams || !indexPath }
  );

  const docToTypeMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const id of Object.keys(allEmbeddings)) {
      const parts = id.split("/");
      const typePart = parts.at(-2);
      if (typePart) map[id] = typePart;
    }
    return map;
  }, [allEmbeddings]);

  const embeddings = useMemo(() => {
    return filterEmbeddings(allEmbeddings, {
      projectSelectionOnly,
      projectionSelectionIds,
      projectWorkingSet,
      workingSetIds,
      selectedTypes,
      docToTypeMap,
    });
  }, [allEmbeddings, projectSelectionOnly, projectionSelectionIds, projectWorkingSet, workingSetIds, selectedTypes, docToTypeMap]);

  const cacheKey = useMemo(() => {
    const loadedKey = [...loadedTypes].sort((a, b) => a.localeCompare(b)).join(",");
    const selectedKey = [...selectedTypes].sort((a, b) => a.localeCompare(b)).join(",");
    const wsKey = projectWorkingSet && workingSetIds.size > 0 ? `ws:${[...workingSetIds].sort((a, b) => a.localeCompare(b)).join(",")}` : "no-ws";
    const selectKey = projectSelectionOnly ? `sel:${[...projectionSelectionIds].sort((a, b) => a.localeCompare(b)).join(",")}` : "all";
    return `${embeddingRole}|${loadedKey}|sel:${selectedKey}|${wsKey}|${selectKey}`;
  }, [loadedTypes, selectedTypes, embeddingRole, projectSelectionOnly, projectionSelectionIds, projectWorkingSet, workingSetIds]);

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

  const scatterPoints = useMemo(() => {
    const skipTypeFilter = projectSelectionOnly && projectionSelectionIds.size > 0;
    return points
      .filter((p) => {
        if (skipTypeFilter) return true;
        const docType = docToTypeMap[p.id] ?? "Unknown";
        if (selectedTypes.has(docType)) return true;
        if (projectWorkingSet && workingSetIds.has(p.id)) return true;
        return false;
      })
      .map((p) => {
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
  }, [points, docToTypeMap, typeColors, dimensions, selectedTypes, projectWorkingSet, projectSelectionOnly, workingSetIds, projectionSelectionIds]);

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

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const { data: hoveredDoc, isLoading: hoveredDocLoading } = useGetDocumentQuery(
    { path: docPath, id: hoveredId ?? "" },
    { skip: !hoveredId || !docPath }
  );

  const handleHover = useCallback((id: string | null) => {
    setHoveredId(id);
  }, []);

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

  const cameraKey = useMemo(() => `${embeddingRole}-${dimensions}`, [embeddingRole, dimensions]);
  const savedCamera = useAppSelector((s) => selectCameraState(s, cameraKey));

  const handleViewStateChange = useCallback((vs: { target: [number, number, number]; zoom: number; rotationX?: number; rotationOrbit?: number }) => {
    dispatch(setCameraState({ key: cameraKey, camera: vs }));
  }, [dispatch, cameraKey]);

  if (!routeParams) return <PagePlaceholder>{t("common.selectDataProduct")}</PagePlaceholder>;
  if (schemaLoading) return <PagePlaceholder>{t("common.loadingSchema")}</PagePlaceholder>;

  const title = dimensions === 2 ? t("projection.2dTitle") : t("projection.3dTitle");

  return (
    <PageShell
      header={
        <PageHeader>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
              <p className="mt-0.5 text-sm text-gray-500">
                {t("projection.umapDescription")}
                {isProjecting && t("projection.projecting")}
                {!isProjecting && isBackgroundProjecting && t("projection.computingOtherView")}
              </p>
              {servedCommit && (
                <p className="mt-0.5 text-xs text-gray-400">
                  {t("projection.dataFromCommit")}{" "}
                  <span className="font-mono">{servedCommit.slice(0, 12)}</span>
                  {indexStatus?.last_indexed_commit &&
                    indexStatus.last_indexed_commit !== servedCommit && (
                      <span className="ml-2 text-amber-600">
                        {t("projection.newerCommitAvailable")} {indexStatus.last_indexed_commit.slice(0, 12)}
                      </span>
                    )}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {Object.keys(allEmbeddings).length > 0 && (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                  {scatterPoints.length} {t("projection.points")}
                </span>
              )}
              <button
                type="button"
                onClick={toggleDimensions}
                className="flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                title={t("projection.toggleView")}
              >
                {dimensions === 2 ? "2D" : "3D"}
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 10l5 5 5-5" />
                </svg>
              </button>
              {storeClustering && (
                <button
                  type="button"
                  onClick={toggleEmbeddingRole}
                  className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium hover:bg-gray-50 ${
                    embeddingRole === "clustering"
                      ? "border-dfrntBlue-300 bg-dfrntBlue-50 text-dfrntBlue-700"
                      : "border-gray-300 text-gray-600"
                  }`}
                  title={t("projection.toggleEmbeddingRole")}
                >
                  {embeddingRole === "clustering" ? t("projection.clustering") : t("projection.document")}
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
          <div className="relative flex-1">
            {selectedTypes.size === 0 && !((projectWorkingSet && workingSetIds.size > 0) || (projectSelectionOnly && projectionSelectionIds.size > 0)) ? (
              <PagePlaceholder>{t("projection.selectTypeOrWorkingSet")}</PagePlaceholder>
            ) : embeddingsLoading ? (
              <div className="flex h-full items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="text-sm text-base-content/60">
                    {t("projection.loadingEmbeddings", { loaded: streamState.loadedCount, total: streamState.totalCount || "?" })}
                  </div>
                  {streamState.totalCount > 0 && (
                    <progress
                      className="progress progress-primary w-64"
                      value={streamState.loadedCount}
                      max={streamState.totalCount}
                    />
                  )}
                </div>
              </div>
            ) : Object.keys(allEmbeddings).length === 0 ? (
              <PagePlaceholder>{t("projection.noEmbeddingsFound")}</PagePlaceholder>
            ) : isProjecting ? (
              <PagePlaceholder>{t("projection.runningUmap")}</PagePlaceholder>
            ) : scatterPoints.length > 0 ? (
              dimensions === 3 ? (
                <Scatter3D
                  key={cameraKey}
                  points={scatterPoints as unknown as Point3D[]}
                  selectedId={selectedId}
                  highlightedIds={combinedHighlightedIds}
                  selectionIds={projectionSelectionIds}
                  workingSetIds={workingSetIds}
                  workingSetVisible={workingSetVisible}
                  dimmedTypes={dimmedTypes}
                  onSelect={handleSelect}
                  onHover={handleHover}
                  width={800}
                  height={500}
                  savedViewState={savedCamera ?? null}
                  onViewStateChange={handleViewStateChange}
                />
              ) : (
                <Scatter2D
                  key={cameraKey}
                  points={scatterPoints as unknown as ScatterPoint[]}
                  selectedId={selectedId}
                  highlightedIds={combinedHighlightedIds}
                  selectionIds={projectionSelectionIds}
                  workingSetIds={workingSetIds}
                  workingSetVisible={workingSetVisible}
                  dimmedTypes={dimmedTypes}
                  onSelect={handleSelect}
                  onHover={handleHover}
                  width={800}
                  height={500}
                  savedViewState={savedCamera ?? null}
                  onViewStateChange={handleViewStateChange}
                />
              )
            ) : (
              <PagePlaceholder>{t("projection.noVisiblePoints")}</PagePlaceholder>
            )}

            {(() => {
              const displayId = hoveredId ?? selectedId;
              const displayDoc = hoveredId ? (hoveredDoc as Record<string, unknown> | undefined) : (selectedDoc as Record<string, unknown> | undefined);
              const displayLoading = hoveredId ? hoveredDocLoading : docLoading;
              const docType = displayId ? docToTypeMap[displayId] ?? null : null;

              if (projectionSelectionIds.size > 1) {
                return (
                  <div className="pointer-events-none absolute bottom-0 left-0 right-0 bg-white/90 px-4 py-2 text-sm text-gray-700 backdrop-blur-sm border-t border-gray-200">
                    {projectionSelectionIds.size} {t("projection.selected")}
                    {projectSelectionOnly && t("projection.projectingOnlySelection")}
                  </div>
                );
              }

              if (!displayId) {
                return (
                  <div className="pointer-events-none absolute bottom-0 left-0 right-0 bg-white/90 px-4 py-2 text-sm text-gray-400 backdrop-blur-sm border-t border-gray-200">
                    {t("projection.clickToViewDetails")}
                  </div>
                );
              }

              if (displayLoading) {
                return (
                  <div className="pointer-events-none absolute bottom-0 left-0 right-0 bg-white/90 px-4 py-2 text-sm text-gray-400 backdrop-blur-sm border-t border-gray-200">
                    {t("common.loading")} {displayId}…
                  </div>
                );
              }

              if (!displayDoc) {
                return (
                  <div className="pointer-events-none absolute bottom-0 left-0 right-0 bg-white/90 px-4 py-2 text-sm text-gray-400 backdrop-blur-sm border-t border-gray-200">
                    {t("projection.noDocumentFound")} {displayId}
                  </div>
                );
              }

              const name = displayDoc.name as string | undefined;
              const description = displayDoc.description as string | undefined;
              return (
                <div className="pointer-events-none absolute bottom-0 left-0 right-0 bg-white/90 px-4 py-2 backdrop-blur-sm border-t border-gray-200">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{displayId}</span>
                    {docType && (
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">{docType}</span>
                    )}
                    {hoveredId && hoveredId !== selectedId && (
                      <span className="text-xs text-gray-400">{t("projection.hovering")}</span>
                    )}
                  </div>
                  {name && <div className="truncate text-xs text-gray-700">{name}</div>}
                  {description && <div className="line-clamp-2 text-xs text-gray-500">{description}</div>}
                </div>
              );
            })()}
          </div>

          {projectionSelectionIds.size > 0 && (
            <div className="flex items-center gap-3 border-t border-gray-100 px-4 py-2 text-sm">
              <span className="text-gray-600">
                {projectionSelectionIds.size} {t("projection.selected")}
                {projectSelectionOnly && t("projection.projectingOnlySelection")}
              </span>
              <button
                className={
                  projectSelectionOnly
                    ? "rounded bg-dfrntBlue-500 px-2 py-1 text-xs font-medium text-white"
                    : "rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600"
                }
                onClick={handleProjectSelection}
              >
                {projectSelectionOnly ? t("projection.projectAll") : t("projection.projectSelection")}
              </button>
              <button
                className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600"
                onClick={handleClearSelection}
              >
                {t("common.clear")}
              </button>
            </div>
          )}
          {projectionSelectionIds.size === 0 && scatterPoints.length > 0 && (
            <div className="border-t border-gray-100 px-4 py-1.5 text-xs text-gray-400">
              {t("projection.tipShiftClick")}
            </div>
          )}
        </div>

        <PanelDock
          side="right"
          defaultActiveIds={["types"]}
          sections={[
            {
              id: "types",
              title: t("projection.documentTypes"),
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
                  searchPath={scatterPoints.length > 0 ? searchPath : undefined}
                  scatterPointIds={scatterPoints.length > 0 ? scatterPointIdSet : undefined}
                  onHighlightIds={(ids) => dispatch(setHighlightedIds([...ids]))}
                  onAddToWorkingSet={handleAddToWorkingSet}
                />
              ),
            },
            {
              id: "duplicates",
              title: t("projection.duplicates"),
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
              title: t("projection.workingSet"),
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
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}
