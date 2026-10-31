import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export interface AppNotification {
  readonly id: string;
  readonly severity: "info" | "success" | "warning" | "error";
  readonly title: string;
  readonly message?: string;
  readonly detailsJson?: string;
}

interface NotificationState {
  readonly items: AppNotification[];
}

const initialState: NotificationState = { items: [] };

export const notificationSlice = createSlice({
  name: "notification",
  initialState,
  reducers: {
    notify(state, action: PayloadAction<Omit<AppNotification, "id"> & { id?: string }>) {
      state.items.push({ id: action.payload.id ?? crypto.randomUUID(), ...action.payload });
    },
    dismissNotification(state, action: PayloadAction<{ id: string }>) {
      state.items = state.items.filter((n) => n.id !== action.payload.id);
    },
  },
  selectors: {
    selectNotifications: (state) => state.items,
  },
});

export const { notify, dismissNotification } = notificationSlice.actions;
export const { selectNotifications } = notificationSlice.selectors;
export default notificationSlice.reducer;
