import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { CandidatesResult } from "@/types/terminusdb";
import type { LexicalScore } from "@/utils/lexical";
import type { PerfectMatch } from "@/utils/csv";

export type ResultsTab = "matches" | "histogram" | "scatter" | "trials";
export type StageFilter = "all" | "core" | "set_extra" | "target_extra";
export type SortBy = "effective" | "distance" | "lexical" | "setId" | "targetId";
export type SortDir = "asc" | "desc";

interface ERState {
  candidates: unknown;
  candidatesLoading: boolean;
  candidatesError: string | null;
  lexicalScores: string | null;
  perfectMatches: PerfectMatch[] | null;
  csvFileName: string | null;
  csvError: string | null;
  resultsTab: ResultsTab;
  stageFilter: StageFilter;
  sortBy: SortBy;
  sortDir: SortDir;
}

const initialState: ERState = {
  candidates: null,
  candidatesLoading: false,
  candidatesError: null,
  lexicalScores: null,
  perfectMatches: null,
  csvFileName: null,
  csvError: null,
  resultsTab: "matches",
  stageFilter: "all",
  sortBy: "effective",
  sortDir: "asc",
};

function asJson(map: ReadonlyMap<string, LexicalScore> | null): string | null {
  if (!map) return null;
  return JSON.stringify(Array.from(map.entries()));
}

function asMap(json: string | null): ReadonlyMap<string, LexicalScore> | null {
  if (!json) return null;
  return new Map(JSON.parse(json) as Array<[string, LexicalScore]>);
}

export const erSlice = createSlice({
  name: "entityResolution",
  initialState,
  reducers: {
    setCandidates(state, action: PayloadAction<CandidatesResult | null>) {
      state.candidates = action.payload;
    },
    setCandidatesLoading(state, action: PayloadAction<boolean>) {
      state.candidatesLoading = action.payload;
    },
    setCandidatesError(state, action: PayloadAction<string | null>) {
      state.candidatesError = action.payload;
    },
    setLexicalScores(state, action: PayloadAction<ReadonlyMap<string, LexicalScore> | null>) {
      state.lexicalScores = asJson(action.payload);
    },
    setPerfectMatches(state, action: PayloadAction<PerfectMatch[] | null>) {
      state.perfectMatches = action.payload;
    },
    setCsvFileName(state, action: PayloadAction<string | null>) {
      state.csvFileName = action.payload;
    },
    setCsvError(state, action: PayloadAction<string | null>) {
      state.csvError = action.payload;
    },
    setResultsTab(state, action: PayloadAction<ResultsTab>) {
      state.resultsTab = action.payload;
    },
    setStageFilter(state, action: PayloadAction<StageFilter>) {
      state.stageFilter = action.payload;
    },
    setSortBy(state, action: PayloadAction<SortBy>) {
      state.sortBy = action.payload;
    },
    setSortDir(state, action: PayloadAction<SortDir>) {
      state.sortDir = action.payload;
    },
    clearERState() {
      return initialState;
    },
  },
});

export const {
  setCandidates,
  setCandidatesLoading,
  setCandidatesError,
  setLexicalScores,
  setPerfectMatches,
  setCsvFileName,
  setCsvError,
  setResultsTab,
  setStageFilter,
  setSortBy,
  setSortDir,
  clearERState,
} = erSlice.actions;

export default erSlice.reducer;

interface ERRootState {
  readonly entityResolution: ERState;
}

export const selectER = (state: ERRootState) => state.entityResolution;
export const selectERCandidates = (state: ERRootState): CandidatesResult | null =>
  state.entityResolution.candidates as CandidatesResult | null;
export const selectERCandidatesLoading = (state: ERRootState) => state.entityResolution.candidatesLoading;
export const selectERCandidatesError = (state: ERRootState) => state.entityResolution.candidatesError;
export const selectERLexicalScores = (state: ERRootState): ReadonlyMap<string, LexicalScore> | null =>
  asMap(state.entityResolution.lexicalScores);
export const selectERPerfectMatches = (state: ERRootState) => state.entityResolution.perfectMatches;
export const selectERCsvFileName = (state: ERRootState) => state.entityResolution.csvFileName;
export const selectERCsvError = (state: ERRootState) => state.entityResolution.csvError;
export const selectERResultsTab = (state: ERRootState) => state.entityResolution.resultsTab;
export const selectERStageFilter = (state: ERRootState) => state.entityResolution.stageFilter;
export const selectERSortBy = (state: ERRootState) => state.entityResolution.sortBy;
export const selectERSortDir = (state: ERRootState) => state.entityResolution.sortDir;
