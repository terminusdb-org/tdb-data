import React, { useState, useCallback, useMemo } from "react";
import {
  useGetDocumentsQuery,
  useInsertRawJsonDocumentMutation,
  useDeleteDocumentMutation,
  useAppSelector,
} from "@/store";
import type { TerminusDBDocument } from "@/types/terminusdb";

export interface WorkingSetPanelProps {
  readonly docPath: string;
  readonly workingSetIds: ReadonlySet<string>;
  readonly onLoadSet: (ids: string[]) => void;
  readonly onAddIds: (ids: string[]) => void;
  readonly onClear: () => void;
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
  onLoadSet,
  onAddIds,
  onClear,
}) => {
  const username = useAppSelector((state) => state.auth.username ?? "admin");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [setName, setSetName] = useState("");
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
    return docs.filter(isNamedSet).map((doc) => ({
      id: (doc["@id"] as string) ?? "",
      name: doc.name,
      documentIds: doc.document_ids,
    }));
  }, [documentsData]);

  const handleSave = useCallback(async () => {
    if (!setName.trim() || workingSetIds.size === 0) return;
    const doc: Record<string, unknown> = {
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

  const handleDeleteSet = useCallback(
    async (id: string) => {
      if (!id) return;
      await deleteDoc({ path: docPath, id, author: username, message: `Delete named set "${id}"` });
      refetch();
    },
    [deleteDoc, docPath, refetch]
  );

  return (
    <div className="p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-xs text-gray-500">
          {workingSetIds.size} item{workingSetIds.size !== 1 ? "s" : ""} in working set
        </span>
        {workingSetIds.size > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="ml-auto text-xs text-gray-400 hover:text-gray-600"
          >
            Clear
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
            Save as Named Set
          </button>
        </div>
      )}

      {showSaveDialog && (
        <div className="px-3 pb-2">
          <input
            type="text"
            value={setName}
            onChange={(e) => setSetName(e.target.value)}
            placeholder="Set name…"
            className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-dfrntBlue-500 focus:outline-none"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") setShowSaveDialog(false);
            }}
            autoFocus
          />
          <div className="mt-1 flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={!setName.trim()}
              className="flex-1 rounded-md bg-dfrntBlue-500 px-2 py-1 text-xs font-medium text-white disabled:opacity-40"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setShowSaveDialog(false)}
              className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {namedSets.length > 0 && (
        <div className="border-t border-gray-100 px-3 py-2">
          <p className="mb-1.5 text-xs font-medium text-gray-500">Saved Sets</p>
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
                  title="Add to working set"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteSet(set.id)}
                  className="hidden text-gray-400 hover:text-red-500 group-hover:inline"
                  title="Delete set"
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
