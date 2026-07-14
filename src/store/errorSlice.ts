import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export interface ErrorInfo {
  readonly message: string;
  readonly statusCode?: number;
  readonly timestamp: number;
}

interface ErrorState {
  readonly latestError: ErrorInfo | null;
}

const initialState: ErrorState = {
  latestError: null,
};

export const errorSlice = createSlice({
  name: "error",
  initialState,
  reducers: {
    setError(state, action: PayloadAction<{ message: string; statusCode?: number }>) {
      state.latestError = {
        message: action.payload.message,
        statusCode: action.payload.statusCode,
        timestamp: Date.now(),
      };
    },
    clearError(state) {
      state.latestError = null;
    },
  },
});

export const { setError, clearError } = errorSlice.actions;

interface ErrorRootState {
  readonly error: ErrorState;
}

export const selectLatestError = (state: ErrorRootState): ErrorInfo | null =>
  state.error.latestError;

export default errorSlice.reducer;
