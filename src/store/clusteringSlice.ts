import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface ClusteringState {
  toggling: boolean;
  error: string | null;
}

const initialState: ClusteringState = {
  toggling: false,
  error: null,
};

export const clusteringSlice = createSlice({
  name: "clustering",
  initialState,
  reducers: {
    setClusteringToggling(state, action: PayloadAction<boolean>) {
      state.toggling = action.payload;
    },
    setClusteringError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
    clearClusteringError(state) {
      state.error = null;
    },
  },
});

export const { setClusteringToggling, setClusteringError, clearClusteringError } = clusteringSlice.actions;
export default clusteringSlice.reducer;

interface ClusteringRootState {
  readonly clustering: ClusteringState;
}

export const selectClusteringToggling = (state: ClusteringRootState) => state.clustering.toggling;
export const selectClusteringError = (state: ClusteringRootState) => state.clustering.error;
