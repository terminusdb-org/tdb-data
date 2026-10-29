import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { ApiErrorDetail } from "@/utils/apiErrors";
import type { MigrationOp } from "@/lib/schemaModel/migrationOps";

// An in-flight (or failed) migration edit. elementId is the target class —
// nested edits register on the nested class so its rows go pending wherever rendered.
export interface PendingEdit {
  readonly id: string;
  readonly elementId: string;
  readonly ops: MigrationOp[];
  readonly startedAt: number;
  readonly status: "applying" | "error";
  readonly error?: ApiErrorDetail;
}

interface ModelState {
  readonly pendingEdits: PendingEdit[];
}

const initialState: ModelState = { pendingEdits: [] };

export const modelSlice = createSlice({
  name: "model",
  initialState,
  reducers: {
    editStarted(state, action: PayloadAction<{ id: string; elementId: string; ops: MigrationOp[] }>) {
      state.pendingEdits.push({ ...action.payload, startedAt: Date.now(), status: "applying" });
    },
    editSucceeded(state, action: PayloadAction<{ id: string }>) {
      state.pendingEdits = state.pendingEdits.filter((e) => e.id !== action.payload.id);
    },
    editFailed(state, action: PayloadAction<{ id: string; error: ApiErrorDetail }>) {
      const edit = state.pendingEdits.find((e) => e.id === action.payload.id);
      if (edit) {
        edit.status = "error";
        edit.error = action.payload.error;
      }
    },
    editDismissed(state, action: PayloadAction<{ id: string }>) {
      state.pendingEdits = state.pendingEdits.filter((e) => e.id !== action.payload.id);
    },
  },
  selectors: {
    selectPendingEdits: (state) => state.pendingEdits,
    selectPendingForElement: (state, elementId: string) =>
      state.pendingEdits.filter((e) => e.elementId === elementId),
  },
});

export const { editStarted, editSucceeded, editFailed, editDismissed } = modelSlice.actions;
export const { selectPendingEdits, selectPendingForElement } = modelSlice.selectors;
export default modelSlice.reducer;
