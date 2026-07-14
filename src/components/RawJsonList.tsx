import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useGetDocumentsQuery, useInsertRawJsonDocumentMutation, useReplaceRawJsonDocumentMutation, useDeleteDocumentMutation, useAppSelector, useAppDispatch, addToWorkingSet, setProjectionSelectionIds, setProjectSelectionOnly } from "@/store";
import { PageShell, PageHeader, PageFooter, PagePlaceholder, btnPrimary, selectClass } from "@/components";
import { buildApiPath, type RouteParams } from "@/utils/routes";
import type { TerminusDBDocument, PageSizes } from "@/types/terminusdb";
import { PAGE_SIZE_OPTIONS } from "@/types/terminusdb";
import Editor from "@monaco-editor/react";
import { isValidJson } from "@/utils/validation";

interface RawJsonListProps {
  readonly routeParams: RouteParams;
}

export const RawJsonList: React.FC<RawJsonListProps> = ({ routeParams }) => {
  const username = useAppSelector((state) => state.auth.username ?? "admin");
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [idFilter, setIdFilter] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<PageSizes>(50);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showNewDoc, setShowNewDoc] = useState(false);
  const [newDocText, setNewDocText] = useState("{}");
  const [newDocValid, setNewDocValid] = useState(true);
  const [newDocError, setNewDocError] = useState<string | null>(null);
  const [useCustomId, setUseCustomId] = useState(false);
  const [customId, setCustomId] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editValid, setEditValid] = useState(true);
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [insertRawJson] = useInsertRawJsonDocumentMutation();
  const [replaceRawJson] = useReplaceRawJsonDocumentMutation();
  const [deleteDoc] = useDeleteDocumentMutation();

  const docPath = buildApiPath(routeParams, "document");

  const { data: documentsData, isLoading: loading, refetch } = useGetDocumentsQuery(
    {
      path: docPath,
      rawJson: true,
      asList: true,
      type: "sys:JSONDocument",
      skip: page * pageSize,
      count: pageSize,
    },
    { skip: !docPath }
  );

  const allDocs: TerminusDBDocument[] = Array.isArray(documentsData) ? documentsData : documentsData ? [documentsData] : [];
  const documents = idFilter.trim()
    ? allDocs.filter((d) => (d["@id"] ?? "").startsWith(idFilter.trim()))
    : allDocs;

  const handleNewDocSave = async () => {
    if (!newDocValid) return;
    setNewDocError(null);
    try {
      const parsed = JSON.parse(newDocText) as TerminusDBDocument;
      const doc = useCustomId && customId.trim()
        ? { ...parsed, "@id": `JSONDocument/${customId.trim()}` }
        : parsed;
      await insertRawJson({
        path: docPath,
        document: doc,
        author: username,
        message: "Created via Raw JSON",
      }).unwrap();
      setShowNewDoc(false);
      setNewDocText("{}");
      setUseCustomId(false);
      setCustomId("");
      refetch();
    } catch (err) {
      if (err && typeof err === "object" && "data" in err) {
        const data = (err as { data: unknown }).data;
        if (typeof data === "object" && data !== null) {
          const msg = (data as Record<string, unknown>)["api:message"] ?? (data as Record<string, unknown>).message ?? "Insert failed";
          setNewDocError(String(msg));
        } else {
          setNewDocError(String(data ?? "Insert failed"));
        }
      } else {
        setNewDocError("Insert failed");
      }
    }
  };

  useEffect(() => {
    if (expandedId) {
      const doc = allDocs.find((d) => d["@id"] === expandedId);
      if (doc) {
        setEditText(JSON.stringify(doc, null, 2));
        setEditValid(true);
        setEditError(null);
      }
    }
  }, [expandedId, allDocs]);

  const handleEditSave = async (id: string) => {
    if (!editValid) return;
    setSaving(true);
    setEditError(null);
    try {
      const parsed = JSON.parse(editText) as TerminusDBDocument;
      await replaceRawJson({
        path: docPath,
        id,
        document: parsed,
        author: username,
        message: "Updated via Raw JSON",
      }).unwrap();
      refetch();
    } catch (err) {
      if (err && typeof err === "object" && "data" in err) {
        const data = (err as { data: unknown }).data;
        if (typeof data === "object" && data !== null) {
          const msg = (data as Record<string, unknown>)["api:message"] ?? (data as Record<string, unknown>).message ?? "Save failed";
          setEditError(String(msg));
        } else {
          setEditError(String(data ?? "Save failed"));
        }
      } else {
        setEditError("Save failed");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(`Delete document "${id}"? This cannot be undone.`)) return;
    setDeleteError(null);
    try {
      await deleteDoc({ path: docPath, id, author: username, message: "Deleted via Raw JSON" }).unwrap();
      if (expandedId === id) setExpandedId(null);
      refetch();
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

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAddToWorkingSet = () => {
    if (selectedIds.size === 0) return;
    dispatch(addToWorkingSet(Array.from(selectedIds)));
  };

  const handleProjectSelection = () => {
    if (selectedIds.size === 0) return;
    dispatch(setProjectionSelectionIds(Array.from(selectedIds)));
    dispatch(setProjectSelectionOnly(true));
    navigate(`/${routeParams.org}/${routeParams.team}/local/${routeParams.refType}/${routeParams.refName}/projection`);
  };

  return (
    <PageShell
      header={
        <PageHeader>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Raw JSON Documents</h2>
            <div className="flex gap-2">
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
                </>
              )}
              <button
                type="button"
                onClick={() => setShowNewDoc(!showNewDoc)}
                className={btnPrimary}
              >
                {showNewDoc ? "Cancel" : "New Document"}
              </button>
              {!showNewDoc && (
                <input
                  type="text"
                  value={idFilter}
                  onChange={(e) => { setIdFilter(e.target.value); setPage(0); }}
                  placeholder="Filter by ID prefix…"
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                />
              )}
            </div>
          </div>
        {showNewDoc && (
          <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500">New JSON Document (sys#JSONDocument)</span>
              <button
                type="button"
                onClick={handleNewDocSave}
                disabled={!newDocValid}
                className={btnPrimary}
              >
                Insert
              </button>
            </div>
            <div className="mb-2 flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-gray-600">
                <input
                  type="checkbox"
                  checked={useCustomId}
                  onChange={(e) => setUseCustomId(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Custom ID
              </label>
              {useCustomId && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-400">JSONDocument/</span>
                  <input
                    type="text"
                    value={customId}
                    onChange={(e) => setCustomId(e.target.value)}
                    placeholder="my-custom-id"
                    className="w-48 rounded-md border border-gray-300 px-2 py-1 text-sm font-data"
                  />
                </div>
              )}
            </div>
            <div style={{ height: "240px" }}>
              <Editor
                height="100%"
                defaultLanguage="json"
                value={newDocText}
                onChange={(v) => { const t = v ?? ""; setNewDocText(t); setNewDocValid(isValidJson(t)); setNewDocError(null); }}
                options={{ minimap: { enabled: false }, fontSize: 13, wordWrap: "on", scrollBeyondLastLine: false, automaticLayout: true, tabSize: 2, scrollbar: { alwaysConsumeMouseWheel: false } }}
              />
            </div>
            {!newDocValid && (
              <div className="mt-1 text-xs text-red-600">Invalid JSON — fix errors before inserting</div>
            )}
            {newDocValid && newDocError && (
              <div className="mt-1 text-xs text-red-600">{newDocError}</div>
            )}
          </div>
        )}
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
              disabled={documents.length < pageSize}
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
        {loading ? (
          <PagePlaceholder>Loading…</PagePlaceholder>
        ) : documents.length === 0 ? (
          <PagePlaceholder>No documents found.</PagePlaceholder>
        ) : (
          <ul className="divide-y divide-gray-100">
            {documents.map((doc) => (
              <li key={doc["@id"]} className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex flex-1 items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(doc["@id"])}
                      onChange={() => toggleSelect(doc["@id"])}
                      className="rounded border-gray-300 text-dfrntBlue-600 focus:ring-dfrntBlue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setExpandedId(expandedId === doc["@id"] ? null : doc["@id"])}
                      className="flex flex-1 items-center justify-between text-left"
                    >
                      <span className="font-data text-sm font-medium text-gray-900">{doc["@id"]}</span>
                      <svg className={`h-4 w-4 text-gray-400 transition-transform ${expandedId === doc["@id"] ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(doc["@id"])}
                    className="ml-2 rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
                {expandedId === doc["@id"] && (
                  <div className="mt-2">
                    <div className="mb-1 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setExpandedId(null)}
                        className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEditSave(doc["@id"])}
                        disabled={!editValid || saving}
                        className="rounded-md bg-dfrntBlue-500 px-2 py-1 text-xs font-medium text-white hover:bg-dfrntBlue-400 disabled:cursor-not-allowed disabled:bg-gray-300"
                      >
                        {saving ? "Saving…" : "Save"}
                      </button>
                    </div>
                    <div style={{ height: "300px" }}>
                      <Editor
                        height="100%"
                        defaultLanguage="json"
                        value={editText}
                        onChange={(v) => { const t = v ?? ""; setEditText(t); setEditValid(isValidJson(t)); setEditError(null); }}
                        options={{ minimap: { enabled: false }, fontSize: 13, wordWrap: "on", scrollBeyondLastLine: false, automaticLayout: true, tabSize: 2, scrollbar: { alwaysConsumeMouseWheel: false } }}
                      />
                    </div>
                    {!editValid && (
                      <div className="mt-1 text-xs text-red-600">Invalid JSON — fix errors before saving</div>
                    )}
                    {editValid && editError && (
                      <div className="mt-1 text-xs text-red-600">{editError}</div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
    </PageShell>
  );
};



