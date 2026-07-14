import React, { useState, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useGetDocumentsQuery, useGetDocumentQuery, useReplaceDocumentMutation, useInsertDocumentMutation, useDeleteDocumentMutation, useGetSchemaQuery, useAppSelector, useAppDispatch, addToWorkingSet, setProjectionSelectionIds, setProjectSelectionOnly } from "@/store";
import { DocumentEditor, PageShell, PageHeader, PageFooter, PagePlaceholder, btnPrimary, selectClass, useRouteParams } from "@/components";
import { buildApiPath } from "@/utils/routes";
import type { TerminusDBDocument, PageSizes } from "@/types/terminusdb";
import { PAGE_SIZE_OPTIONS } from "@/types/terminusdb";
import { truncate } from "@/utils/validation";

export const DocumentsPage: React.FC = () => {
  const routeParams = useRouteParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [searchParams, setSearchParams] = useSearchParams();
  const editId = searchParams.get("edit");
  const initialType = searchParams.get("type") ?? "";
  const [selectedType, setSelectedType] = useState(initialType);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<PageSizes>(50);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [replaceDoc] = useReplaceDocumentMutation();
  const [insertDoc] = useInsertDocumentMutation();
  const [deleteDoc] = useDeleteDocumentMutation();
  const username = useAppSelector((state) => state.auth.username ?? "admin");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const docPath = routeParams ? buildApiPath(routeParams, "document") : "";
  const schemaPath = routeParams ? buildApiPath(routeParams, "schema") : "";
  const { data: schemaClasses } = useGetSchemaQuery(
    { path: schemaPath, asList: true },
    { skip: !routeParams }
  );

  const docTypes = useMemo(() => {
    if (!schemaClasses) return [];
    return schemaClasses
      .filter((c) => c["@type"] === "Class")
      .map((c) => c["@id"])
      .sort();
  }, [schemaClasses]);

  const { data: documents, isLoading, error } = useGetDocumentsQuery(
    {
      path: docPath,
      type: selectedType || undefined,
      asList: true,
      skip: page * pageSize,
      count: pageSize,
    },
    { skip: !routeParams || !!editId }
  );

  const { data: editDoc, isLoading: isLoadingEdit } = useGetDocumentQuery(
    { path: docPath, id: editId! },
    { skip: !routeParams || !editId }
  );

  const docList: TerminusDBDocument[] = Array.isArray(documents) ? documents : documents ? [documents] : [];

  if (!routeParams) return <PagePlaceholder>Select a data product first.</PagePlaceholder>;

  const handleSelectAll = () => {
    if (selectedIds.size === docList.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(docList.map((d) => d["@id"])));
    }
  };

  const handleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleSave = async (doc: TerminusDBDocument) => {
    await replaceDoc({
      path: docPath,
      id: doc["@id"],
      document: doc,
      author: username,
      message: "Updated via Data Explorer",
    }).unwrap();
    setSearchParams({}, { replace: true });
  };

  const handleInsert = async (doc: TerminusDBDocument) => {
    await insertDoc({
      path: docPath,
      document: doc,
      author: username,
      message: "Created via Data Explorer",
    }).unwrap();
    setSearchParams({}, { replace: true });
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Delete ${selectedIds.size} document(s)? This cannot be undone.`)) return;
    setDeleteError(null);
    try {
      for (const id of selectedIds) {
        await deleteDoc({ path: docPath, id, author: username, message: "Deleted via Data Explorer" }).unwrap();
      }
      setSelectedIds(new Set());
    } catch (err) {
      if (err && typeof err === "object" && "data" in err) {
        const data = (err as { data: unknown }).data;
        if (typeof data === "object" && data !== null) {
          const msg = (data as Record<string, unknown>)["api:message"] ?? (data as Record<string, unknown>).message ?? "Delete failed";
          setDeleteError(String(msg));
        } else {
          setDeleteError(String(data ?? "Delete failed"));
        }
      } else {
        setDeleteError("Delete failed");
      }
    }
  };

  const handleDeleteSingle = async (id: string) => {
    if (!window.confirm(`Delete document "${id}"? This cannot be undone.`)) return;
    setDeleteError(null);
    try {
      await deleteDoc({ path: docPath, id, author: username, message: "Deleted via Data Explorer" }).unwrap();
      setSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    } catch (err) {
      if (err && typeof err === "object" && "data" in err) {
        const data = (err as { data: unknown }).data;
        if (typeof data === "object" && data !== null) {
          const msg = (data as Record<string, unknown>)["api:message"] ?? (data as Record<string, unknown>).message ?? "Delete failed";
          setDeleteError(String(msg));
        } else {
          setDeleteError(String(data ?? "Delete failed"));
        }
      } else {
        setDeleteError("Delete failed");
      }
    }
  };

  const handleAddToWorkingSet = () => {
    if (selectedIds.size === 0) return;
    dispatch(addToWorkingSet(Array.from(selectedIds)));
  };

  const handleProjectSelection = () => {
    if (selectedIds.size === 0) return;
    dispatch(setProjectionSelectionIds(Array.from(selectedIds)));
    dispatch(setProjectSelectionOnly(true));
    if (routeParams) {
      navigate(`/${routeParams.org}/${routeParams.team}/local/${routeParams.refType}/${routeParams.refName}/projection`);
    }
  };

  const closeEditor = () => {
    setSearchParams({}, { replace: false });
  };

  const handleNewDocument = () => {
    setSearchParams({ edit: "new" });
  };

  if (editId) {
    if (editId === "new") {
      const newDoc: TerminusDBDocument = {
        "@id": "",
        "@type": selectedType || docTypes[0] || "",
      };
      return (
        <div className="h-full">
          <DocumentEditor
            document={newDoc}
            onSave={handleInsert}
            onCancel={closeEditor}
          />
        </div>
      );
    }
    if (isLoadingEdit) return <PagePlaceholder>Loading document…</PagePlaceholder>;
    if (!editDoc) return <PagePlaceholder>Document not found.</PagePlaceholder>;
    return (
      <div className="h-full">
        <DocumentEditor
          document={editDoc}
          onSave={handleSave}
          onCancel={closeEditor}
        />
      </div>
    );
  }

  return (
    <PageShell
      header={
        <PageHeader>
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-gray-900">Documents</h2>
            <select
              value={selectedType}
              onChange={(e) => { setSelectedType(e.target.value); setPage(0); }}
              className={selectClass}
            >
              <option value="">All types</option>
              {docTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            {selectedIds.size > 0 && (
              <>
                <span className="text-sm text-gray-500">{selectedIds.size} selected</span>
                <button
                  type="button"
                  onClick={handleAddToWorkingSet}
                  className="rounded-md border border-dfrntBlue-300 px-3 py-1.5 text-xs font-medium text-dfrntBlue-600 hover:bg-dfrntBlue-50"
                >
                  Add to Working Set
                </button>
                <button
                  type="button"
                  onClick={handleProjectSelection}
                  className="rounded-md border border-green-300 px-3 py-1.5 text-xs font-medium text-green-600 hover:bg-green-50"
                >
                  Project Selection
                </button>
                <button
                  type="button"
                  onClick={handleDeleteSelected}
                  className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  Delete Selected
                </button>
              </>
            )}
            <button
              type="button"
              onClick={handleNewDocument}
              className={`ml-auto ${btnPrimary}`}
            >
              New Document
            </button>
          </div>
        </PageHeader>
      }
      footer={
        <PageFooter>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="rounded border border-gray-300 px-2 py-1 text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-gray-500">Page {page + 1}</span>
            <button
              type="button"
              onClick={() => setPage(page + 1)}
              disabled={docList.length < pageSize}
              className="rounded border border-gray-300 px-2 py-1 text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value) as PageSizes); setPage(0); }}
            className={selectClass}
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>{size} / page</option>
            ))}
          </select>
        </PageFooter>
      }
    >
      {deleteError && (
        <div className="mb-2 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-600">{deleteError}</div>
      )}
      {isLoading ? (
          <PagePlaceholder>Loading…</PagePlaceholder>
        ) : error ? (
          <PagePlaceholder error>Failed to load documents.</PagePlaceholder>
        ) : docList.length === 0 ? (
          <PagePlaceholder>No documents found.</PagePlaceholder>
        ) : (
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === docList.length && docList.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300"
                    aria-label="Select all"
                  />
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">ID</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Type</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Preview</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {docList.map((doc) => (
                <tr
                  key={doc["@id"]}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => setSearchParams({ edit: doc["@id"] })}
                >
                  <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(doc["@id"])}
                      onChange={() => handleSelect(doc["@id"])}
                      className="rounded border-gray-300"
                      aria-label={`Select ${doc["@id"]}`}
                    />
                  </td>
                  <td className="px-4 py-2 font-data text-sm font-medium text-gray-900">
                    {truncate(doc["@id"], 40)}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-600">{doc["@type"]}</td>
                  <td className="px-4 py-2 text-xs text-gray-400">
                    {truncate(JSON.stringify(doc).slice(0, 100), 80)}
                  </td>
                  <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => handleDeleteSingle(doc["@id"])}
                      className="rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
    </PageShell>
  );
};
