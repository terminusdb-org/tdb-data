import React from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { ProtectedRoute, DataLayout } from "@/components";
import { LoginPage, DataProductPickerPage, MainPage, DoctypesPage, RawJsonPage, DocumentsPage, GraphQLPage, SchemaPage, ContextPage, VectorSearchPage, EmbeddingsPage, IndexStatsPage, EntityResolutionPage, BranchHistoryPage, ProjectionPage } from "@/pages";
import { config } from "@/config";

export const App: React.FC = () => {
  return (
    <BrowserRouter basename={config.basePath || "/"}>
      <Routes>
        <Route path="/*" element={<Outlet />}>
          <Route path="login" element={<LoginPage />} />
          <Route
            element={
              <ProtectedRoute>
                <DataLayout />
              </ProtectedRoute>
            }
          >
            {/* Data product picker — no org/team specified */}
            <Route index element={<DataProductPickerPage />} />

            {/* Org/team root — no branch/commit specified */}
            <Route path=":org/:team" element={<MainPage />} />

            {/* Branch-scoped routes */}
            <Route path=":org/:team/local/branch/:branch" element={<MainPage />} />
            <Route path=":org/:team/local/branch/:branch/doctypes" element={<DoctypesPage />} />
            <Route path=":org/:team/local/branch/:branch/raw" element={<RawJsonPage />} />
            <Route path=":org/:team/local/branch/:branch/documents" element={<DocumentsPage />} />
            <Route path=":org/:team/local/branch/:branch/graphql" element={<GraphQLPage />} />
            <Route path=":org/:team/local/branch/:branch/schema" element={<SchemaPage />} />
            <Route path=":org/:team/local/branch/:branch/schema/class/:classId" element={<SchemaPage />} />
            <Route path=":org/:team/local/branch/:branch/context" element={<ContextPage />} />
            <Route path=":org/:team/local/branch/:branch/embeddings" element={<EmbeddingsPage />} />
            <Route path=":org/:team/local/branch/:branch/index-stats" element={<IndexStatsPage />} />
            <Route path=":org/:team/local/branch/:branch/vector-search" element={<VectorSearchPage />} />
            <Route path=":org/:team/local/branch/:branch/entity-resolution" element={<EntityResolutionPage />} />
            <Route path=":org/:team/local/branch/:branch/projection" element={<ProjectionPage />} />
            <Route path=":org/:team/local/branch/:branch/history" element={<BranchHistoryPage />} />

            {/* Commit-scoped routes */}
            <Route path=":org/:team/local/commit/:commitId" element={<MainPage />} />
            <Route path=":org/:team/local/commit/:commitId/doctypes" element={<DoctypesPage />} />
            <Route path=":org/:team/local/commit/:commitId/raw" element={<RawJsonPage />} />
            <Route path=":org/:team/local/commit/:commitId/documents" element={<DocumentsPage />} />
            <Route path=":org/:team/local/commit/:commitId/graphql" element={<GraphQLPage />} />
            <Route path=":org/:team/local/commit/:commitId/schema" element={<SchemaPage />} />
            <Route path=":org/:team/local/commit/:commitId/schema/class/:classId" element={<SchemaPage />} />
            <Route path=":org/:team/local/commit/:commitId/context" element={<ContextPage />} />
            <Route path=":org/:team/local/commit/:commitId/embeddings" element={<EmbeddingsPage />} />
            <Route path=":org/:team/local/commit/:commitId/index-stats" element={<IndexStatsPage />} />
            <Route path=":org/:team/local/commit/:commitId/vector-search" element={<VectorSearchPage />} />
            <Route path=":org/:team/local/commit/:commitId/entity-resolution" element={<EntityResolutionPage />} />
            <Route path=":org/:team/local/commit/:commitId/projection" element={<ProjectionPage />} />
            <Route path=":org/:team/local/commit/:commitId/history" element={<BranchHistoryPage />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
};
