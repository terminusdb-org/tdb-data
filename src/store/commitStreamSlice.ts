import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export interface CommitChanges {
  added: string[];
  changed: string[];
  deleted: string[];
}

export interface CommitEntry {
  id: string;
  author: string;
  message: string;
  timestamp: string;
  user?: string;
  changes?: CommitChanges;
}

interface CommitStreamState {
  latestCommitId: string | null;
  connectionStatus: "disconnected" | "connecting" | "connected" | "error";
  error: string | null;
  history: CommitEntry[];
}

const initialState: CommitStreamState = {
  latestCommitId: null,
  connectionStatus: "disconnected",
  error: null,
  history: [],
};

export const commitStreamSlice = createSlice({
  name: "commitStream",
  initialState,
  reducers: {
    setConnectionStatus(state, action: PayloadAction<CommitStreamState["connectionStatus"]>) {
      state.connectionStatus = action.payload;
    },
    setCommitStreamError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
    addCommitEntry(state, action: PayloadAction<CommitEntry>) {
      const entry = action.payload;
      state.latestCommitId = entry.id;
      const exists = state.history.some((c) => c.id === entry.id);
      if (!exists) {
        state.history.unshift(entry);
        if (state.history.length > 100) {
          state.history = state.history.slice(0, 100);
        }
      }
    },
    clearCommitHistory(state) {
      state.history = [];
      state.latestCommitId = null;
    },
  },
});

export const {
  setConnectionStatus,
  setCommitStreamError,
  addCommitEntry,
  clearCommitHistory,
} = commitStreamSlice.actions;

export default commitStreamSlice.reducer;

interface CommitStreamRootState {
  readonly commitStream: CommitStreamState;
}

export const selectLatestCommitId = (state: CommitStreamRootState) => state.commitStream.latestCommitId;
export const selectConnectionStatus = (state: CommitStreamRootState) => state.commitStream.connectionStatus;
export const selectCommitHistory = (state: CommitStreamRootState) => state.commitStream.history;
export const selectCommitStreamError = (state: CommitStreamRootState) => state.commitStream.error;
