import React, { useState, useCallback, useMemo } from "react";
import { normalizeDocId } from "@/utils/validation";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  useGetDocumentsQuery,
  useInsertRawJsonDocumentMutation,
  useDeleteDocumentMutation,
  useAppSelector,
} from "@/store";
import { useRouteParams } from "@/components";
import type { TerminusDBDocument } from "@/types/terminusdb";

export interface WorkingSetPanelProps {
  readonly docPath: string;
  readonly workingSetIds: ReadonlySet<string>;
  readonly workingSetVisible?: boolean;
  readonly onLoadSet: (ids: string[]) => void;
  readonly onAddIds: (ids: string[]) => void;
  readonly onClear: () => void;
  readonly onToggleVisible?: () => void;
  readonly onProjectSet?: (ids: string[]) => void;
  readonly onRemoveItem?: (id: string) => void;
}

interface NamedSet {
  readonly id: string;
  readonly name: string;
  readonly documentIds: string[];
}

function isNamedSet(doc: TerminusDBDocument): doc is TerminusDBDocument & {
  name: string;
  document_ids: string[];
} {
  return (
    typeof doc === "object" &&
    doc !== null &&
    typeof (doc as Record<string, unknown>).name === "string" &&
    Array.isArray((doc as Record<string, unknown>).document_ids)
  );
}

export const WorkingSetPanel: React.FC<WorkingSetPanelProps> = ({
  docPath,
  workingSetIds,
  workingSetVisible = true,
  onLoadSet,
  onAddIds,
  onClear,
  onToggleVisible,
  onProjectSet,
  onRemoveItem,
}) => {
  const { t } = useTranslation();
  const username = useAppSelector((state) => state.auth.username ?? "admin");
  const routeParams = useRouteParams();
  const navigate = useNavigate();
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [setName, setSetName] = useState("");
  const [showItems, setShowItems] = useState(false);
  const [itemFilter, setItemFilter] = useState("");
  const [insertRawJson] = useInsertRawJsonDocumentMutation();
  const [deleteDoc] = useDeleteDocumentMutation();

  const { data: documentsData, refetch } = useGetDocumentsQuery(
    {
      path: docPath,
      rawJson: true,
      asList: true,
      type: "sys:JSONDocument",
      count: 100,
    },
    { skip: !docPath }
  );

  const namedSets: NamedSet[] = useMemo(() => {
    if (!documentsData) return [];
    const docs = Array.isArray(documentsData) ? documentsData : [documentsData];
    const result: NamedSet[] = [];
    for (const doc of docs) {
      const id = (doc["@id"] as string) ?? "";
      if (id.startsWith("WorkingSet/") && isNamedSet(doc)) {
        result.push({ id, name: doc.name, documentIds: doc.document_ids });
      }
    }
    return result;
  }, [documentsData]);

  const handleSave = useCallback(async () => {
    if (!setName.trim() || workingSetIds.size === 0) return;
    const guid = crypto.randomUUID();
    const doc: Record<string, unknown> = {
      "@id": `WorkingSet/${guid}`,
      "@type": "sys:JSONDocument",
      name: setName.trim(),
      document_ids: Array.from(workingSetIds),
    };
    await insertRawJson({
      path: docPath,
      document: doc as TerminusDBDocument,
      author: username,
      message: `Save working set "${setName.trim()}"`,
    });
    setSetName("");
    setShowSaveDialog(false);
    refetch();
  }, [setName, workingSetIds, insertRawJson, docPath, username, refetch]);

  const handleLoadSet = useCallback(
    (set: NamedSet) => {
      onLoadSet(set.documentIds);
    },
    [onLoadSet]
  );

  const handleAddSetToWorking = useCallback(
    (set: NamedSet) => {
      onAddIds(set.documentIds);
    },
    [onAddIds]
  );

  const handleProjectSet = useCallback(
    (set: NamedSet) => {
      onProjectSet?.(set.documentIds);
    },
    [onProjectSet]
  );

  const handleDeleteSet = useCallback(
    async (id: string) => {
      if (!id) return;
      await deleteDoc({ path: docPath, id, author: username, message: `Delete named set "${id}"` });
      refetch();
    },
    [deleteDoc, docPath, refetch, username]
  );

  const filteredItems = useMemo(() => {
    const ids = Array.from(workingSetIds);
    if (!itemFilter.trim()) return ids;
    const lower = itemFilter.toLowerCase();
    return ids.filter((id) => id.toLowerCase().includes(lower));
  }, [workingSetIds, itemFilter]);

  const navigateToDoc = useCallback(
    (id: string) => {
      if (routeParams) {
        navigate(`/${routeParams.org}/${routeParams.team}/local/${routeParams.refType}/${routeParams.refName}/documents?edit=${normalizeDocId(id)}`);
      }
    },
    [routeParams, navigate]
  );

  return (
    <div className="p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-xs text-gray-500">
          {workingSetIds.size} {t("common.item")}{workingSetIds.size !== 1 ? "s" : ""} {t("workingSetPanel.inWorkingSet")}
        </span>
        {onToggleVisible && workingSetIds.size > 0 && (
          <button
            type="button"
            onClick={onToggleVisible}
            className="text-xs text-gray-400 hover:text-dfrntBlue-600"
            title={workingSetVisible ? t("workingSetPanel.hideInProjection") : t("workingSetPanel.showInProjection")}
          >
            {workingSetVisible ? "👁" : "🚫"}
          </button>
        )}
        {workingSetIds.size > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="ml-auto text-xs text-gray-400 hover:text-gray-600"
          >
            {t("common.clear")}
          </button>
        )}
      </div>

      {workingSetIds.size > 0 && !showSaveDialog && (
        <div className="px-3 pb-2">
          <button
            type="button"
            onClick={() => setShowSaveDialog(true)}
            className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            {t("workingSetPanel.saveAsNamedSet")}
          </button>
        </div>
      )}

      {showSaveDialog && (
        <div className="px-3 pb-2">
          <input
            type="text"
            value={setName}
            onChange={(e) => setSetName(e.target.value)}
            placeholder={t("workingSetPanel.setNamePlaceholder")}
            className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-dfrntBlue-500 focus:outline-none"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") setShowSaveDialog(false);
            }}
          />
          <div className="mt-1 flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={!setName.trim()}
              className="flex-1 rounded-md bg-dfrntBlue-500 px-2 py-1 text-xs font-medium text-white disabled:opacity-40"
            >
              {t("common.save")}
            </button>
            <button
              type="button"
              onClick={() => setShowSaveDialog(false)}
              className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600"
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}

      {workingSetIds.size > 0 && (
        <div className="border-t border-gray-100 px-3 py-2">
          <button
            type="button"
            onClick={() => setShowItems(!showItems)}
            className="flex w-full items-center gap-1 text-xs font-medium text-gray-500"
          >
            <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" />
            </svg>
            {t("workingSetPanel.items")}
            <span className="ml-1 rounded bg-gray-100 px-1.5 text-gray-400">{workingSetIds.size}</span>
          </button>
          {showItems && (
            <div className="mt-2">
              <input
                type="text"
                value={itemFilter}
                onChange={(e) => setItemFilter(e.target.value)}
                placeholder={t("workingSetPanel.filterById")}
                className="mb-2 w-full rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-dfrntBlue-500 focus:outline-none"
              />
              <div className="max-h-48 space-y-0.5 overflow-y-auto">
                {filteredItems.map((id) => (
                  <div
                    key={id}
                    className="group flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-600 hover:bg-dfrntBlue-50"
                  >
                    <button
                      type="button"
                      onClick={() => navigateToDoc(id)}
                      className="flex-1 truncate text-left hover:text-dfrntBlue-700"
                      title={id}
                    >
                      {id}
                    </button>
                    {onRemoveItem && (
                      <button
                        type="button"
                        onClick={() => onRemoveItem(id)}
                        className="hidden text-gray-400 hover:text-red-500 group-hover:inline"
                        title={t("workingSetPanel.removeFromWorkingSet")}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                {filteredItems.length === 0 && (
                  <p className="px-2 py-1 text-xs text-gray-400">{t("workingSetPanel.noMatchingItems")}</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {namedSets.length > 0 && (
        <div className="border-t border-gray-100 px-3 py-2">
          <p className="mb-1.5 text-xs font-medium text-gray-500">{t("workingSetPanel.savedSets")}</p>
          <div className="space-y-1">
            {namedSets.map((set) => (
              <div
                key={set.id}
                className="group flex items-center gap-1 rounded px-2 py-1 text-xs hover:bg-gray-50"
              >
                <button
                  type="button"
                  onClick={() => handleLoadSet(set)}
                  className="flex-1 truncate text-left text-gray-700"
                  title={`Load "${set.name}" (${set.documentIds.length} items)`}
                >
                  {set.name}
                  <span className="ml-1 text-gray-400">({set.documentIds.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAddSetToWorking(set)}
                  className="hidden text-gray-400 hover:text-dfrntBlue-500 group-hover:inline"
                  title={t("workingSetPanel.addToWorkingSet")}
                >
                  +
                </button>
                {onProjectSet && (
                  <button
                    type="button"
                    onClick={() => handleProjectSet(set)}
                    className="hidden text-gray-400 hover:text-green-500 group-hover:inline"
                    title={t("workingSetPanel.projectThisSet")}
                  >
                    ◎
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDeleteSet(set.id)}
                  className="hidden text-gray-400 hover:text-red-500 group-hover:inline"
                  title={t("workingSetPanel.deleteSet")}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
