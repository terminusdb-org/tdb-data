export { store } from "./store";
export type { RootState, AppDispatch } from "./store";
export { useAppDispatch, useAppSelector } from "./hooks";
export { login, logout, selectIsAuthenticated, selectAuthUsername } from "./authSlice";
export { setContext, clearContext, selectDataProduct } from "./dataProductSlice";
export type { DataProductState, RefType } from "./dataProductSlice";
export { setError, clearError, selectLatestError } from "./errorSlice";
export type { ErrorInfo } from "./errorSlice";
export {
  setCandidates, setCandidatesLoading, setCandidatesError, setLexicalScores,
  setPerfectMatches, setCsvFileName, setCsvError, setResultsTab, setStageFilter,
  setSortBy, setSortDir, clearERState,
  selectERCandidates, selectERCandidatesLoading, selectERCandidatesError,
  selectERLexicalScores, selectERPerfectMatches, selectERCsvFileName, selectERCsvError,
  selectERResultsTab, selectERStageFilter, selectERSortBy, selectERSortDir,
} from "./erSlice";
export type { ResultsTab, StageFilter, SortBy, SortDir } from "./erSlice";
export { baseApi } from "./baseApi";

export {
  useGetDocumentsQuery,
  useGetDocumentQuery,
  useGetEmbeddingTextQuery,
  useGetMarkdownTextQuery,
  useReplaceDocumentMutation,
  useReplaceRawJsonDocumentMutation,
  useInsertDocumentMutation,
  useInsertRawJsonDocumentMutation,
  useDeleteDocumentMutation,
} from "./api/documentApi";

export {
  useGetSchemaQuery,
  useGetFrameQuery,
  useGetPrefixesQuery,
  useReplaceSchemaMutation,
  useReplaceSchemaDocumentMutation,
  useInsertSchemaDocumentMutation,
  useDeleteSchemaDocumentMutation,
  useReplaceContextMutation,
} from "./api/schemaApi";

export {
  useSearchQuery,
  useSuggestQuery,
  useSimilarQuery,
  useDuplicatesQuery,
  useResolveMutation,
  useCompareMutation,
  useSearchStatsQuery,
  useCandidatesMutation,
} from "./api/searchApi";

export { useRunWoqlMutation } from "./api/woqlApi";
export { useRunGraphqlMutation } from "./api/graphqlApi";
export { useGetDatabasesQuery } from "./api/dbApi";
export type { DatabaseEntry } from "./api/dbApi";
export { useGetIndexStatusQuery, useTriggerIndexMutation, useDeleteIndexMutation } from "./api/indexApi";
export { useGetClusteringQuery, useToggleClusteringMutation } from "./api/clusteringApi";
export { setClusteringToggling, setClusteringError, clearClusteringError, selectClusteringToggling, selectClusteringError } from "./clusteringSlice";
export { useGetEmbeddingsByTypeQuery } from "./api/projectionApi";
export type { EmbeddingsByTypeParams } from "./api/projectionApi";
export {
  setConnectionStatus, setCommitStreamError, addCommitEntry, clearCommitHistory,
  selectLatestCommitId, selectConnectionStatus, selectCommitHistory, selectCommitStreamError,
} from "./commitStreamSlice";
export type { CommitEntry } from "./commitStreamSlice";
export {
  toggleType, setSelectedTypes, setFilterMode, setSelectedId, setHighlightedIds,
  toggleShowDuplicates, setShowDuplicates, setLoadedTypes,
  toggleMultiSelectId, addMultiSelectIds, setMultiSelectIds, clearMultiSelectIds,
  toggleProjectSelectionOnly, setProjectSelectionOnly, clearProjectionState,
  selectSelectedTypes, selectFilterMode, selectSelectedId, selectHighlightedIds,
  selectShowDuplicates, selectLoadedTypes, selectMultiSelectIds, selectProjectSelectionOnly,
} from "./projectionSlice";
export type { FilterMode } from "./projectionSlice";
