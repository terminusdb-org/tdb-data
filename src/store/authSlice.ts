import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface AuthState {
  readonly credentials: string | null;
  readonly username: string | null;
  readonly isAuthenticated: boolean;
}

const STORAGE_KEY = "terminusdb_data_auth";

function loadInitialState(): AuthState {
  if (typeof window === "undefined") {
    return { credentials: null, username: null, isAuthenticated: false };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AuthState;
      if (parsed.credentials && parsed.username && parsed.isAuthenticated) {
        return parsed;
      }
    }
  } catch {
    // ignore parse errors
  }
  return { credentials: null, username: null, isAuthenticated: false };
}

function persistAuth(state: AuthState): void {
  if (typeof window === "undefined") return;
  try {
    if (state.isAuthenticated) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

const initialState: AuthState = loadInitialState();

export const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    login(state, action: PayloadAction<{ username: string; password: string }>) {
      const { username, password } = action.payload;
      state.credentials = btoa(`${username}:${password}`);
      state.username = username;
      state.isAuthenticated = true;
      persistAuth(state);
    },
    logout(state) {
      state.credentials = null;
      state.username = null;
      state.isAuthenticated = false;
      persistAuth(state);
    },
  },
});

export const { login, logout } = authSlice.actions;

interface AuthRootState {
  readonly auth: AuthState;
}

export const selectIsAuthenticated = (state: AuthRootState): boolean =>
  state.auth.isAuthenticated;

export const selectAuthUsername = (state: AuthRootState): string | null =>
  state.auth.username;

export const selectAuthCredentials = (state: AuthRootState): string | null =>
  state.auth.credentials;

export default authSlice.reducer;
