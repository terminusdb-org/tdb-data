import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type RefType = "branch" | "commit";

export interface DataProductState {
  readonly org: string | null;
  readonly team: string | null;
  readonly refType: RefType | null;
  readonly refName: string | null;
}

const initialState: DataProductState = {
  org: null,
  team: null,
  refType: null,
  refName: null,
};

export const dataProductSlice = createSlice({
  name: "dataProduct",
  initialState,
  reducers: {
    setContext(
      state,
      action: PayloadAction<{
        org: string;
        team: string;
        refType: RefType;
        refName: string;
      }>
    ) {
      state.org = action.payload.org;
      state.team = action.payload.team;
      state.refType = action.payload.refType;
      state.refName = action.payload.refName;
    },
    clearContext(state) {
      state.org = null;
      state.team = null;
      state.refType = null;
      state.refName = null;
    },
  },
});

export const { setContext, clearContext } = dataProductSlice.actions;

interface DataRootState {
  readonly dataProduct: DataProductState;
}

export const selectDataProduct = (state: DataRootState) => state.dataProduct;

export default dataProductSlice.reducer;
