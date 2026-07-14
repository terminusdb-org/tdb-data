import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type FilterMode = "visual" | "reproject";
export type EmbeddingRole = "document" | "clustering";

export interface CachedProjectionPoint {
  readonly id: string;
  readonly position: number[];
}

interface ProjectionState {
  selectedTypes: string[];
  filterMode: FilterMode;
  selectedId: string | null;
  highlightedIds: string[];
  showDuplicates: boolean;
  loadedTypes: string[];
  workingSetIds: string[];
  workingSetVisible: boolean;
  projectionSelectionIds: string[];
  projectSelectionOnly: boolean;
  projectWorkingSet: boolean;
  dimensions: 2 | 3;
  embeddingRole: EmbeddingRole;
  projectionCacheKey: string | null;
  projectionPoints2d: CachedProjectionPoint[];
  projectionPoints3d: CachedProjectionPoint[];
}

const initialState: ProjectionState = {
  selectedTypes: [],
  filterMode: "visual",
  selectedId: null,
  highlightedIds: [],
  showDuplicates: false,
  loadedTypes: [],
  workingSetIds: [],
  workingSetVisible: true,
  projectionSelectionIds: [],
  projectSelectionOnly: false,
  projectWorkingSet: false,
  dimensions: 2,
  embeddingRole: "clustering",
  projectionCacheKey: null,
  projectionPoints2d: [],
  projectionPoints3d: [],
};

export const projectionSlice = createSlice({
  name: "projection",
  initialState,
  reducers: {
    toggleType(state, action: PayloadAction<string>) {
      const type = action.payload;
      const idx = state.selectedTypes.indexOf(type);
      if (idx >= 0) {
        state.selectedTypes.splice(idx, 1);
      } else {
        state.selectedTypes.push(type);
      }
    },
    setSelectedTypes(state, action: PayloadAction<string[]>) {
      state.selectedTypes = action.payload;
    },
    setFilterMode(state, action: PayloadAction<FilterMode>) {
      state.filterMode = action.payload;
    },
    setSelectedId(state, action: PayloadAction<string | null>) {
      state.selectedId = action.payload;
    },
    setHighlightedIds(state, action: PayloadAction<string[]>) {
      state.highlightedIds = action.payload;
    },
    toggleShowDuplicates(state) {
      state.showDuplicates = !state.showDuplicates;
    },
    setShowDuplicates(state, action: PayloadAction<boolean>) {
      state.showDuplicates = action.payload;
    },
    setLoadedTypes(state, action: PayloadAction<string[]>) {
      state.loadedTypes = action.payload;
    },
    toggleProjectionSelectionId(state, action: PayloadAction<string>) {
      const id = action.payload;
      const idx = state.projectionSelectionIds.indexOf(id);
      if (idx >= 0) {
        state.projectionSelectionIds.splice(idx, 1);
      } else {
        state.projectionSelectionIds.push(id);
      }
    },
    setProjectionSelectionIds(state, action: PayloadAction<string[]>) {
      state.projectionSelectionIds = action.payload;
    },
    clearProjectionSelection(state) {
      state.projectionSelectionIds = [];
      state.projectSelectionOnly = false;
    },
    addToWorkingSet(state, action: PayloadAction<string[]>) {
      for (const id of action.payload) {
        if (!state.workingSetIds.includes(id)) {
          state.workingSetIds.push(id);
        }
      }
    },
    removeFromWorkingSet(state, action: PayloadAction<string>) {
      const idx = state.workingSetIds.indexOf(action.payload);
      if (idx >= 0) {
        state.workingSetIds.splice(idx, 1);
      }
    },
    setWorkingSetIds(state, action: PayloadAction<string[]>) {
      state.workingSetIds = action.payload;
    },
    clearWorkingSet(state) {
      state.workingSetIds = [];
    },
    toggleWorkingSetVisible(state) {
      state.workingSetVisible = !state.workingSetVisible;
    },
    setWorkingSetVisible(state, action: PayloadAction<boolean>) {
      state.workingSetVisible = action.payload;
    },
    toggleProjectSelectionOnly(state) {
      state.projectSelectionOnly = !state.projectSelectionOnly;
    },
    setProjectSelectionOnly(state, action: PayloadAction<boolean>) {
      state.projectSelectionOnly = action.payload;
    },
    toggleProjectWorkingSet(state) {
      state.projectWorkingSet = !state.projectWorkingSet;
    },
    setProjectWorkingSet(state, action: PayloadAction<boolean>) {
      state.projectWorkingSet = action.payload;
    },
    setDimensions(state, action: PayloadAction<2 | 3>) {
      state.dimensions = action.payload;
    },
    setEmbeddingRole(state, action: PayloadAction<EmbeddingRole>) {
      state.embeddingRole = action.payload;
    },
    setProjectionResult(state, action: PayloadAction<{ dimension: 2 | 3; points: CachedProjectionPoint[]; cacheKey: string }>) {
      const { dimension, points, cacheKey } = action.payload;
      if (state.projectionCacheKey !== cacheKey) {
        state.projectionCacheKey = cacheKey;
        state.projectionPoints2d = [];
        state.projectionPoints3d = [];
      }
      if (dimension === 2) {
        state.projectionPoints2d = points;
      } else {
        state.projectionPoints3d = points;
      }
    },
    clearProjectionCache(state) {
      state.projectionCacheKey = null;
      state.projectionPoints2d = [];
      state.projectionPoints3d = [];
    },
    clearProjectionState() {
      return initialState;
    },
  },
});

export const {
  toggleType,
  setSelectedTypes,
  setFilterMode,
  setSelectedId,
  setHighlightedIds,
  toggleShowDuplicates,
  setShowDuplicates,
  setLoadedTypes,
  toggleProjectionSelectionId,
  setProjectionSelectionIds,
  clearProjectionSelection,
  addToWorkingSet,
  removeFromWorkingSet,
  setWorkingSetIds,
  clearWorkingSet,
  toggleWorkingSetVisible,
  setWorkingSetVisible,
  toggleProjectSelectionOnly,
  setProjectSelectionOnly,
  toggleProjectWorkingSet,
  setProjectWorkingSet,
  setDimensions,
  setEmbeddingRole,
  setProjectionResult,
  clearProjectionCache,
  clearProjectionState,
} = projectionSlice.actions;

export default projectionSlice.reducer;

interface ProjectionRootState {
  readonly projection: ProjectionState;
}

export const selectSelectedTypes = (state: ProjectionRootState): string[] =>
  state.projection.selectedTypes;
export const selectFilterMode = (state: ProjectionRootState): FilterMode =>
  state.projection.filterMode;
export const selectSelectedId = (state: ProjectionRootState): string | null =>
  state.projection.selectedId;
export const selectHighlightedIds = (state: ProjectionRootState): string[] =>
  state.projection.highlightedIds;
export const selectShowDuplicates = (state: ProjectionRootState): boolean =>
  state.projection.showDuplicates;
export const selectLoadedTypes = (state: ProjectionRootState): string[] =>
  state.projection.loadedTypes;
export const selectWorkingSetIds = (state: ProjectionRootState): string[] =>
  state.projection.workingSetIds;
export const selectWorkingSetVisible = (state: ProjectionRootState): boolean =>
  state.projection.workingSetVisible;
export const selectProjectionSelectionIds = (state: ProjectionRootState): string[] =>
  state.projection.projectionSelectionIds;
export const selectProjectSelectionOnly = (state: ProjectionRootState): boolean =>
  state.projection.projectSelectionOnly;
export const selectProjectWorkingSet = (state: ProjectionRootState): boolean =>
  state.projection.projectWorkingSet;
export const selectDimensions = (state: ProjectionRootState): 2 | 3 =>
  state.projection.dimensions;
export const selectEmbeddingRole = (state: ProjectionRootState): EmbeddingRole =>
  state.projection.embeddingRole;
export const selectProjectionCacheKey = (state: ProjectionRootState): string | null =>
  state.projection.projectionCacheKey;
export const selectProjectionPoints2d = (state: ProjectionRootState): ReadonlyArray<CachedProjectionPoint> =>
  state.projection.projectionPoints2d;
export const selectProjectionPoints3d = (state: ProjectionRootState): ReadonlyArray<CachedProjectionPoint> =>
  state.projection.projectionPoints3d;
