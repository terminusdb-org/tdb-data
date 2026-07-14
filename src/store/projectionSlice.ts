import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type FilterMode = "visual" | "reproject";

interface ProjectionState {
  selectedTypes: string[];
  filterMode: FilterMode;
  selectedId: string | null;
  highlightedIds: string[];
  showDuplicates: boolean;
  loadedTypes: string[];
  multiSelectIds: string[];
  projectSelectionOnly: boolean;
}

const initialState: ProjectionState = {
  selectedTypes: [],
  filterMode: "visual",
  selectedId: null,
  highlightedIds: [],
  showDuplicates: false,
  loadedTypes: [],
  multiSelectIds: [],
  projectSelectionOnly: false,
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
    toggleMultiSelectId(state, action: PayloadAction<string>) {
      const id = action.payload;
      const idx = state.multiSelectIds.indexOf(id);
      if (idx >= 0) {
        state.multiSelectIds.splice(idx, 1);
      } else {
        state.multiSelectIds.push(id);
      }
    },
    addMultiSelectIds(state, action: PayloadAction<string[]>) {
      for (const id of action.payload) {
        if (!state.multiSelectIds.includes(id)) {
          state.multiSelectIds.push(id);
        }
      }
    },
    setMultiSelectIds(state, action: PayloadAction<string[]>) {
      state.multiSelectIds = action.payload;
    },
    clearMultiSelectIds(state) {
      state.multiSelectIds = [];
      state.projectSelectionOnly = false;
    },
    toggleProjectSelectionOnly(state) {
      state.projectSelectionOnly = !state.projectSelectionOnly;
    },
    setProjectSelectionOnly(state, action: PayloadAction<boolean>) {
      state.projectSelectionOnly = action.payload;
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
  toggleMultiSelectId,
  addMultiSelectIds,
  setMultiSelectIds,
  clearMultiSelectIds,
  toggleProjectSelectionOnly,
  setProjectSelectionOnly,
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
export const selectMultiSelectIds = (state: ProjectionRootState): string[] =>
  state.projection.multiSelectIds;
export const selectProjectSelectionOnly = (state: ProjectionRootState): boolean =>
  state.projection.projectSelectionOnly;
