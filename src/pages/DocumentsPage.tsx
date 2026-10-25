import React, { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useGetDocumentsQuery, useGetDocumentQuery, useReplaceDocumentMutation, useInsertDocumentMutation, useDeleteDocumentMutation, useGetSchemaQuery, useAppSelector, useAppDispatch, addToWorkingSet } from "@/store";
import { DocumentEditor, PageShell, PageHeader, PageFooter, PagePlaceholder, btnPrimary, selectClass, useRouteParams, ConfirmDialog } from "@/components";
import { buildApiPath } from "@/utils/routes";
import { isSubdocument, PAGE_SIZE_OPTIONS, type EditableDocument, type TerminusDBDocument, type PageSizes, type SchemaClass } from "@/types/terminusdb";
import { displayId, normalizeDocId, truncate } from "@/utils/validation";

function extractErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "data" in err) {
    const data = (err as { data: unknown }).data;
    if (typeof data === "object" && data !== null) {
      const msg = (data as Record<string, unknown>)["api:message"] ?? (data as Record<string, unknown>).message ?? "Delete failed";
      return typeof msg === "string" ? msg : JSON.stringify(msg);
    }
    return typeof data === "string" ? data : "Delete failed";
  }
  return "Delete failed";
}

export const DocumentsPage: React.FC = () => {
  const { t } = useTranslation();
  const routeParams = useRouteParams();
  const dispatch = useAppDispatch();
  const [searchParams, setSearchParams] = useSearchParams();
  const editId = searchParams.get("edit");
  const savedId = searchParams.get("id");
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
  const [confirmState, setConfirmState] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const docPath = routeParams ? buildApiPath(routeParams, "document") : "";
  const schemaPath = routeParams ? buildApiPath(routeParams, "schema") : "";
  const { data: schemaClasses } = useGetSchemaQuery(
    { path: schemaPath, asList: true },
    { skip: !routeParams }
  );

  const docTypes = useMemo(() => {
    if (!schemaClasses) return [];
    return schemaClasses
      .filter((c: SchemaClass) => c["@type"] === "Class" && !isSubdocument(c))
      .map((c) => c["@id"])
      .sort((a, b) => a.localeCompare(b));
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

  let docList: TerminusDBDocument[];
  if (Array.isArray(documents)) {
    docList = documents;
  } else if (documents) {
    docList = [documents];
  } else {
    docList = [];
  }

  if (!routeParams) return <PagePlaceholder>{t("common.selectDataProduct")}</PagePlaceholder>;

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

  // The server returns the ids it wrote — open the first one in the editor
  // instead of dropping back to the list.
  const openSavedDocument = (result: unknown) => {
    const first = Array.isArray(result) ? result[0] : result;
    let id: string | null = null;
    if (typeof first === "string") {
      id = first;
    } else if (typeof first === "object" && first !== null) {
      const maybeId = (first as Record<string, unknown>)["@id"];
      if (typeof maybeId === "string") id = maybeId;
    }
    const next = new URLSearchParams();
    if (selectedType) next.set("type", selectedType);
    if (id) next.set("id", id);
    setSearchParams(next, { replace: true });
  };

  const handleSave = async (doc: EditableDocument) => {
    if (!doc["@id"]) throw new Error("Internal error: cannot replace a document without @id");
    const result = await replaceDoc({
      path: docPath,
      id: doc["@id"],
      document: doc,
      author: username,
      message: t("common.updatedVia", { id: doc["@id"] }),
    }).unwrap();
    openSavedDocument(result);
  };

  const handleInsert = async (doc: EditableDocument) => {
    // An empty @id means "let the server mint one" — never send "".
    const payload = { ...doc };
    if (payload["@id"] === "") {
      delete payload["@id"];
    } else if (typeof payload["@id"] === "string") {
      payload["@id"] = normalizeDocId(payload["@id"]);
    }
    const result = await insertDoc({
      path: docPath,
      document: payload,
      author: username,
      message: t("common.createdVia", { id: doc["@id"] }),
    }).unwrap();
    openSavedDocument(result);
  };

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    setConfirmState({
      title: t("common.deleteDocs"),
      message: t("common.deleteConfirmPlural", { count: selectedIds.size }),
      onConfirm: () => {
        setConfirmState(null);
        void doDeleteSelected();
      },
    });
  };

  const doDeleteSelected = async () => {
    setDeleteError(null);
    try {
      await Promise.all(
        [...selectedIds].map((id) =>
          deleteDoc({ path: docPath, id, author: username, message: t("common.deletedVia", { id }) }).unwrap()
        )
      );
      setSelectedIds(new Set());
    } catch (err) {
      setDeleteError(extractErrorMessage(err));
    }
  };

  const handleDeleteSingle = (id: string) => {
    setConfirmState({
      title: t("common.deleteDoc"),
      message: t("common.deleteConfirmSingular", { id }),
      onConfirm: () => {
        setConfirmState(null);
        void doDeleteSingle(id);
      },
    });
  };

  const doDeleteSingle = async (id: string) => {
    setDeleteError(null);
    try {
      await deleteDoc({ path: docPath, id, author: username, message: t("common.deletedVia", { id }) }).unwrap();
      setSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    } catch (err) {
      setDeleteError(extractErrorMessage(err));
    }
  };

  const handleAddToWorkingSet = () => {
    if (selectedIds.size === 0) return;
    dispatch(addToWorkingSet(Array.from(selectedIds)));
  };

  const closeEditor = () => {
    setSearchParams(selectedType ? { type: selectedType } : {}, { replace: false });
  };

  const handleNewDocument = () => {
    setSearchParams(selectedType ? { edit: "new", type: selectedType } : { edit: "new" });
  };

  const renderContent = (): React.ReactNode => {
    if (isLoading) return <PagePlaceholder>{t("common.loading")}</PagePlaceholder>;
    if (error) return <PagePlaceholder error>{t("documents.failedToLoad")}</PagePlaceholder>;
    if (docList.length === 0) return <PagePlaceholder>{t("documents.noDocuments")}</PagePlaceholder>;
    return (
      <div className="overflow-x-auto">
        <table className="w-full">
        <thead className="border-b border-gray-200 bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left">
              <input
                type="checkbox"
                checked={selectedIds.size === docList.length && docList.length > 0}
                onChange={handleSelectAll}
                className="rounded border-gray-300"
                aria-label={t("documents.selectAll")}
              />
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">{t("documents.id")}</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">{t("documents.type")}</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">{t("documentPreviewModal.title")}</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">{t("common.actions")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {docList.map((doc) => (
            <tr
              key={doc["@id"]}
              className={`cursor-pointer hover:bg-gray-50 ${doc["@id"] === savedId ? "bg-green-50" : ""}`}
              onClick={() => setSearchParams({ edit: doc["@id"] })}
            >
              <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={selectedIds.has(doc["@id"])}
                  onChange={() => handleSelect(doc["@id"])}
                  className="rounded border-gray-300"
                  aria-label={t("documents.selectDocumentAria", { id: displayId(doc["@id"]) })}
                />
              </td>
              <td className="px-4 py-2 font-data text-sm font-medium text-gray-900">
                {truncate(displayId(doc["@id"]), 40)}
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
                  {t("common.delete")}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    );
  };

  if (editId) {
    if (editId === "new") {
      const newDoc: EditableDocument = {
        "@type": selectedType || docTypes[0] || "",
      };
      return (
        <div className="h-full">
          <DocumentEditor
            document={newDoc}
            onSave={handleInsert}
            onCancel={closeEditor}
            isNew
          />
        </div>
      );
    }
    if (isLoadingEdit) return <PagePlaceholder>{t("documents.loadingDocument")}</PagePlaceholder>;
    if (!editDoc) return <PagePlaceholder>{t("documents.documentNotFound")}</PagePlaceholder>;
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
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <h2 className="text-lg font-semibold text-gray-900">{t("documents.title")}</h2>
            <select
              value={selectedType}
              onChange={(e) => {
                const type = e.target.value;
                setSelectedType(type);
                setPage(0);
                setSearchParams(type ? { type } : {});
              }}
              className={selectClass}
            >
              <option value="">{t("common.allTypes")}</option>
              {docTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            {selectedIds.size > 0 && (
              <>
                <span className="text-sm text-gray-500">{t("documents.selected", { count: selectedIds.size })}</span>
                <button
                  type="button"
                  onClick={handleAddToWorkingSet}
                  className="rounded-md border border-dfrntBlue-300 px-3 py-1.5 text-xs font-medium text-dfrntBlue-600 hover:bg-dfrntBlue-50"
                >
                  {t("documents.addToWorkingSet")}
                </button>
                <button
                  type="button"
                  onClick={handleDeleteSelected}
                  className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  {t("documents.deleteSelected")}
                </button>
              </>
            )}
            <button
              type="button"
              onClick={handleNewDocument}
              className={`ml-auto w-full sm:w-auto ${btnPrimary}`}
            >
              {t("documents.newDocument")}
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
              {t("common.previous")}
            </button>
            <span className="text-sm text-gray-500">{t("documents.page", { page: page + 1 })}</span>
            <button
              type="button"
              onClick={() => setPage(page + 1)}
              disabled={docList.length < pageSize}
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
              <option key={size} value={size}>{size} / {t("documents.page", { page: "" })}</option>
            ))}
          </select>
        </PageFooter>
      }
    >
      {savedId && (
        <div className="mb-2 flex items-center justify-between rounded-lg border border-green-200 bg-green-50 p-2 text-xs text-green-800">
          <span>{t("documents.savedSuccess", { id: displayId(savedId) })}</span>
          <button
            type="button"
            aria-label={t("common.close")}
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              next.delete("id");
              setSearchParams(next, { replace: true });
            }}
            className="font-medium hover:text-green-900"
          >
            ×
          </button>
        </div>
      )}
      {deleteError && (
        <div className="mb-2 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-600">{deleteError}</div>
      )}
      {renderContent()}
      <ConfirmDialog
        open={confirmState !== null}
        title={confirmState?.title ?? ""}
        message={confirmState?.message ?? ""}
        confirmLabel={t("common.delete")}
        destructive
        onConfirm={() => confirmState?.onConfirm()}
        onCancel={() => setConfirmState(null)}
      />
    </PageShell>
  );
};
