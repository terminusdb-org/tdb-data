import { configureStore } from "@reduxjs/toolkit";
import { baseApi } from "./baseApi";
import authReducer from "./authSlice";
import dataProductReducer from "./dataProductSlice";
import errorReducer from "./errorSlice";
import erReducer from "./erSlice";
import clusteringReducer from "./clusteringSlice";
import commitStreamReducer from "./commitStreamSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    dataProduct: dataProductReducer,
    error: errorReducer,
    entityResolution: erReducer,
    clustering: clusteringReducer,
    commitStream: commitStreamReducer,
    [baseApi.reducerPath]: baseApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(baseApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
