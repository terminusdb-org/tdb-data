import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useGetDocumentsQuery, useInsertRawJsonDocumentMutation, useReplaceRawJsonDocumentMutation, useDeleteDocumentMutation, useAppSelector, useAppDispatch, addToWorkingSet, setProjectionSelectionIds, setProjectSelectionOnly, useGetDocumentIdsByPrefixQuery, useGetSchemaQuery } from "@/store";
import { PageShell, PageHeader, PageFooter, PagePlaceholder, btnPrimary, selectClass, ConfirmDialog } from "@/components";
import { buildApiPath, type RouteParams } from "@/utils/routes";
import type { TerminusDBDocument, PageSizes } from "@/types/terminusdb";
import { PAGE_SIZE_OPTIONS } from "@/types/terminusdb";
import Editor from "@monaco-editor/react";
import { isValidJson } from "@/utils/validation";

interface RawJsonListProps {
  readonly routeParams: RouteParams;
}

export const RawJsonList: React.FC<RawJsonListProps> = ({ routeParams }) => {
  const { t } = useTranslation();
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
  const [confirmState, setConfirmState] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const [editText, setEditText] = useState("");
  const [editValid, setEditValid] = useState(true);
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [insertRawJson] = useInsertRawJsonDocumentMutation();
  const [replaceRawJson] = useReplaceRawJsonDocumentMutation();
  const [deleteDoc] = useDeleteDocumentMutation();

  const docPath = buildApiPath(routeParams, "document");
  const schemaPath = buildApiPath(routeParams, "schema");
  const woqlPath = buildApiPath(routeParams, "woql");

  // Debounce the prefix filter so typing doesn't fire a WOQL per keystroke.
  const [activeFilter, setActiveFilter] = useState("");
  useEffect(() => {
    const handle = setTimeout(() => setActiveFilter(idFilter.trim()), 300);
    return () => clearTimeout(handle);
  }, [idFilter]);

  // Relative prefixes expand under the context @base; a full IRI goes through
  // as-is (handled inside getDocumentIdsByPrefix).
  const { data: schemaDocs } = useGetSchemaQuery({ path: schemaPath, asList: true }, { skip: !schemaPath });
  const docBase = useMemo(() => {
    const ctx = schemaDocs?.find((d) => d["@id"] === "@context") as Record<string, unknown> | undefined;
    return typeof ctx?.["@base"] === "string" ? ctx["@base"] : "terminusdb:///data/";
  }, [schemaDocs]);

  const { data: matchingIds, refetch: refetchIds } = useGetDocumentIdsByPrefixQuery(
    { path: woqlPath, base: docBase, prefix: activeFilter, type: "sys:JSONDocument" },
    { skip: !activeFilter }
  );

  // Filtered mode: page over the matching ids, then fetch just that slice of
  // documents by id. Unfiltered mode: the paged listing as before.
  const pageIds = useMemo(
    () => (activeFilter ? (matchingIds ?? []).slice(page * pageSize, (page + 1) * pageSize) : []),
    [activeFilter, matchingIds, page, pageSize]
  );

  const { data: documentsData, isLoading: loading, refetch } = useGetDocumentsQuery(
    {
      path: docPath,
      rawJson: true,
      asList: true,
      type: "sys:JSONDocument",
      skip: page * pageSize,
      count: pageSize,
    },
    { skip: !docPath || !!activeFilter }
  );

  const { data: filteredData, isLoading: loadingFiltered, refetch: refetchFiltered } = useGetDocumentsQuery(
    {
      path: docPath,
      rawJson: true,
      asList: true,
      type: "sys:JSONDocument",
      ids: pageIds,
    },
    { skip: !activeFilter || pageIds.length === 0 }
  );

  const docsSource = activeFilter ? filteredData : documentsData;
  const isLoadingDocs = activeFilter ? loadingFiltered : loading;
  const refetchAll = () => {
    refetch();
    if (activeFilter) {
      refetchIds();
      refetchFiltered();
    }
  };

  const allDocs: TerminusDBDocument[] = useMemo(() =>
    Array.isArray(docsSource) ? docsSource : docsSource ? [docsSource] : [],
    [docsSource]
  );
  const documents = allDocs;

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
        message: t("rawJson.createdViaRawJson"),
      }).unwrap();
      setShowNewDoc(false);
      setNewDocText("{}");
      setUseCustomId(false);
      setCustomId("");
      refetchAll();
    } catch (err) {
      if (err && typeof err === "object" && "data" in err) {
        const data = (err as { data: unknown }).data;
        if (typeof data === "object" && data !== null) {
          const msg = (data as Record<string, unknown>)["api:message"] ?? (data as Record<string, unknown>).message ?? t("rawJson.insertFailed");
          setNewDocError(String(msg));
        } else {
          setNewDocError(t("rawJson.insertFailed"));
        }
      } else {
        setNewDocError(t("rawJson.insertFailed"));
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
        message: t("rawJson.updatedViaRawJson"),
      }).unwrap();
      refetchAll();
    } catch (err) {
      if (err && typeof err === "object" && "data" in err) {
        const data = (err as { data: unknown }).data;
        if (typeof data === "object" && data !== null) {
          const msg = (data as Record<string, unknown>)["api:message"] ?? (data as Record<string, unknown>).message ?? t("documentEditor.saveFailed");
          setEditError(String(msg));
        } else {
          setEditError(t("documentEditor.saveFailed"));
        }
      } else {
        setEditError(t("documentEditor.saveFailed"));
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    setConfirmState({
      title: t("common.deleteDoc"),
      message: t("common.deleteConfirmSingular", { id }),
      onConfirm: () => {
        setConfirmState(null);
        void doDelete(id);
      },
    });
  };

  const doDelete = async (id: string) => {
    setDeleteError(null);
    try {
      await deleteDoc({ path: docPath, id, author: username, message: t("rawJson.deletedViaRawJson") }).unwrap();
      if (expandedId === id) setExpandedId(null);
      refetchAll();
    } catch (err) {
      if (err && typeof err === "object" && "data" in err) {
        const data = (err as { data: unknown }).data;
        if (typeof data === "object" && data !== null) {
          const msg = (data as Record<string, unknown>)["api:message"] ?? (data as Record<string, unknown>).message ?? t("rawJson.deleteFailed");
          setDeleteError(String(msg));
        } else {
          setDeleteError(t("rawJson.deleteFailed"));
        }
      } else {
        setDeleteError(t("rawJson.deleteFailed"));
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
    <>
    <PageShell
      header={
        <PageHeader>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">{t("rawJson.title")}</h2>
            <div className="flex gap-2">
              {selectedIds.size > 0 && (
                <>
                  <span className="text-sm text-gray-500">{selectedIds.size} {t("rawJson.selected")}</span>
                  <button
                    type="button"
                    onClick={handleAddToWorkingSet}
                    className="rounded-md border border-dfrntBlue-300 px-3 py-1.5 text-xs font-medium text-dfrntBlue-600 hover:bg-dfrntBlue-50"
                  >
                    {t("rawJson.addToWorkingSet")}
                  </button>
                  <button
                    type="button"
                    onClick={handleProjectSelection}
                    className="rounded-md border border-green-300 px-3 py-1.5 text-xs font-medium text-green-600 hover:bg-green-50"
                  >
                    {t("rawJson.projectSelection")}
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setShowNewDoc(!showNewDoc)}
                className={btnPrimary}
              >
                {showNewDoc ? t("common.cancel") : t("rawJson.newDocument")}
              </button>
              {!showNewDoc && (
                <input
                  type="text"
                  value={idFilter}
                  onChange={(e) => { setIdFilter(e.target.value); setPage(0); }}
                  placeholder={t("rawJson.filterPlaceholder")}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                />
              )}
            </div>
          </div>
        {showNewDoc && (
          <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500">{t("rawJson.newJsonDocument")}</span>
              <button
                type="button"
                onClick={handleNewDocSave}
                disabled={!newDocValid}
                className={btnPrimary}
              >
                {t("rawJson.insert")}
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
                {t("rawJson.customId")}
              </label>
              {useCustomId && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-400">{t("rawJson.jsonDocumentPrefix")}</span>
                  <input
                    type="text"
                    value={customId}
                    onChange={(e) => setCustomId(e.target.value)}
                    placeholder={t("rawJson.idPlaceholder")}
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
              <div className="mt-1 text-xs text-red-600">{t("documentEditor.invalidJson")}</div>
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
              {t("common.previous")}
            </button>
            <span className="text-sm text-gray-500">{t("common.page")} {page + 1}</span>
            <button
              type="button"
              onClick={() => setPage(page + 1)}
              disabled={activeFilter ? (page + 1) * pageSize >= (matchingIds?.length ?? 0) : documents.length < pageSize}
              className="rounded border border-gray-300 px-2 py-1 text-sm disabled:opacity-50"
            >
              {t("common.next")}
            </button>
          </div>
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value) as PageSizes); setPage(0); }}
            className={selectClass}
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>{size} / {t("rawJson.page")}</option>
            ))}
          </select>
        </PageFooter>
      }
    >
        {deleteError && (
          <div className="mb-2 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-600">{deleteError}</div>
        )}
        {isLoadingDocs ? (
          <PagePlaceholder>{t("common.loading")}</PagePlaceholder>
        ) : documents.length === 0 ? (
          <PagePlaceholder>{t("rawJson.noDocuments")}</PagePlaceholder>
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
                    {t("common.delete")}
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
                        {t("common.cancel")}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEditSave(doc["@id"])}
                        disabled={!editValid || saving}
                        className="rounded-md bg-dfrntBlue-500 px-2 py-1 text-xs font-medium text-white hover:bg-dfrntBlue-400 disabled:cursor-not-allowed disabled:bg-gray-300"
                      >
                        {saving ? t("documentEditor.saving") : t("common.save")}
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
                      <div className="mt-1 text-xs text-red-600">{t("documentEditor.invalidJson")}</div>
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
    <ConfirmDialog
      open={confirmState !== null}
      title={confirmState?.title ?? ""}
      message={confirmState?.message ?? ""}
      confirmLabel={t("common.delete")}
      destructive
      onConfirm={() => confirmState?.onConfirm()}
      onCancel={() => setConfirmState(null)}
    />
    </>
  );
};



