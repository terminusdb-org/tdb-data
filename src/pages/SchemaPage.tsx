import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Editor from "@monaco-editor/react";
import { useGetSchemaQuery, useReplaceSchemaMutation, useReplaceSchemaDocumentMutation, useInsertSchemaDocumentMutation, useDeleteSchemaDocumentMutation, useAppSelector } from "@/store";
import { PageShell, PageHeader, PagePlaceholder, btnPrimary, btnSecondary, selectClass, useRouteParams } from "@/components";
import { buildApiPath, buildRoutePath } from "@/utils/routes";
import { isValidJson } from "@/utils/validation";
import type { SchemaClass } from "@/types/terminusdb";

const MONACO_OPTIONS = {
  minimap: { enabled: false },
  fontSize: 13,
  wordWrap: "on" as const,
  scrollBeyondLastLine: false,
  automaticLayout: true,
  tabSize: 2,
  scrollbar: { alwaysConsumeMouseWheel: false },
};

export const SchemaPage: React.FC = () => {
  const routeParams = useRouteParams();
  const { classId } = useParams<{ classId?: string }>();
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [valid, setValid] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"" | "saving" | "saved" | "error">("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [replaceSchema] = useReplaceSchemaMutation();
  const [replaceSchemaDocument] = useReplaceSchemaDocumentMutation();
  const [insertSchemaDocument] = useInsertSchemaDocumentMutation();
  const [deleteSchemaDocument] = useDeleteSchemaDocumentMutation();
  const username = useAppSelector((state) => state.auth.username ?? "admin");

  const schemaPath = routeParams ? buildApiPath(routeParams, "schema") : "";
  const docPath = routeParams ? buildApiPath(routeParams, "document") : "";
  const { data: classes, isLoading } = useGetSchemaQuery(
    { path: schemaPath, asList: true },
    { skip: !routeParams }
  );

  const isNewClass = classId === "new";
  const selectedClassId = classId && classId !== "new" ? classId : "";

  const routeBase = routeParams ? buildRoutePath(routeParams) : "";

  useEffect(() => {
    if (classes && !isNewClass) {
      if (selectedClassId) {
        const cls = classes.find((c) => c["@id"] === selectedClassId);
        if (cls) {
          const { "@id": _id, ...rest } = cls;
          setText(JSON.stringify(rest, null, 2));
        } else {
          setText("{}");
        }
      } else {
        setText(JSON.stringify(classes, null, 2));
      }
      setValid(true);
    }
  }, [classes, selectedClassId, isNewClass]);

  useEffect(() => {
    if (isNewClass) {
      const newId = `NewClass_${Date.now()}`;
      setText(JSON.stringify({
        "@type": "Class",
        "@id": newId,
        "@key": { "@type": "Random" }
      }, null, 2));
      setValid(true);
    }
  }, [isNewClass]);

  if (!routeParams) return <PagePlaceholder>Select a data product first.</PagePlaceholder>;
  if (isLoading) return <PagePlaceholder>Loading schema…</PagePlaceholder>;

  const handleChange = (value: string | undefined) => {
    const newText = value ?? "";
    setText(newText);
    setValid(isValidJson(newText));
    setSaveError(null);
  };

  const handleSave = async () => {
    if (!valid) return;
    setSaveStatus("saving");
    setSaveError(null);
    try {
      const parsed = JSON.parse(text);
      if (selectedClassId || isNewClass) {
        const docId = parsed["@id"] ?? selectedClassId;
        const doc: SchemaClass = { "@id": docId, ...parsed };
        const isNew = !classes?.some((c) => c["@id"] === docId);
        if (isNew) {
          await insertSchemaDocument({
            path: docPath,
            document: doc,
            author: username,
            message: `Created ${docId} via Data Explorer`,
          }).unwrap();
          navigate(`${routeBase}/schema/class/${encodeURIComponent(docId)}`);
        } else {
          await replaceSchemaDocument({
            path: docPath,
            id: docId,
            document: doc,
            author: username,
            message: `Updated ${docId} via Data Explorer`,
          }).unwrap();
        }
      } else {
        const schemaArray = parsed as SchemaClass[];
        await replaceSchema({
          path: schemaPath,
          schema: schemaArray,
          author: username,
          message: "Updated schema via Data Explorer",
        }).unwrap();
      }
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(""), 3000);
    } catch (err) {
      setSaveStatus("error");
      if (err && typeof err === "object" && "data" in err) {
        const data = (err as { data: unknown }).data;
        if (typeof data === "object" && data !== null) {
          const msg = (data as Record<string, unknown>)["api:message"] ?? (data as Record<string, unknown>).message ?? "Save failed";
          setSaveError(String(msg));
        } else {
          setSaveError(String(data ?? "Save failed"));
        }
      } else {
        setSaveError("Save failed");
      }
    }
  };

  const handleNewClass = () => {
    navigate(`${routeBase}/schema/class/new`);
  };

  const handleDeleteClass = async () => {
    if (!selectedClassId) return;
    if (!window.confirm(`Delete class "${selectedClassId}"? This cannot be undone.`)) return;
    setSaveStatus("saving");
    setSaveError(null);
    try {
      await deleteSchemaDocument({
        path: docPath,
        id: selectedClassId,
        author: username,
        message: `Deleted ${selectedClassId} via Data Explorer`,
      }).unwrap();
      navigate(`${routeBase}/schema`);
    } catch (err) {
      setSaveStatus("error");
      if (err && typeof err === "object" && "data" in err) {
        const data = (err as { data: unknown }).data;
        if (typeof data === "object" && data !== null) {
          const msg = (data as Record<string, unknown>)["api:message"] ?? (data as Record<string, unknown>).message ?? "Delete failed";
          setSaveError(String(msg));
        } else {
          setSaveError(String(data ?? "Delete failed"));
        }
      } else {
        setSaveError("Delete failed");
      }
    }
  };

  const handleClassSelect = (id: string) => {
    if (id) {
      navigate(`${routeBase}/schema/class/${encodeURIComponent(id)}`);
    } else {
      navigate(`${routeBase}/schema`);
    }
  };

  const saveLabel = saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved!" : saveStatus === "error" ? "Error" : "Save";
  const saveClass = saveStatus === "saved"
    ? "bg-green-500 text-white"
    : saveStatus === "error"
    ? "bg-red-500 text-white"
    : btnPrimary;

  return (
    <PageShell
      header={
        <PageHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-gray-900">Schema Editor</h2>
              <select
                value={selectedClassId}
                onChange={(e) => handleClassSelect(e.target.value)}
                className={selectClass}
              >
                <option value="">All classes</option>
                {classes?.map((cls) => (
                  <option key={cls["@id"]} value={cls["@id"]}>{cls["@id"]}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleNewClass}
                className={btnSecondary}
              >
                New Class
              </button>
              {selectedClassId && (
                <button
                  type="button"
                  onClick={handleDeleteClass}
                  disabled={saveStatus === "saving"}
                  className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  Delete
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={!valid || saveStatus === "saving"}
              className={saveClass}
            >
              {saveLabel}
            </button>
          </div>
        </PageHeader>
      }
    >
      <div className="relative" style={{ height: "600px" }}>
        <Editor
          height="100%"
          defaultLanguage="json"
          value={text}
          onChange={handleChange}
          options={MONACO_OPTIONS}
        />
        {!valid && (
          <div className="absolute bottom-4 left-4 rounded-md bg-red-100 px-3 py-1.5 text-xs font-medium text-red-700">
            Invalid JSON — fix errors before saving
          </div>
        )}
        {valid && saveError && (
          <div className="absolute bottom-4 left-4 rounded-md bg-red-100 px-3 py-1.5 text-xs font-medium text-red-700">
            {saveError}
          </div>
        )}
      </div>
    </PageShell>
  );
};
