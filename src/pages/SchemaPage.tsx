import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Editor from "@monaco-editor/react";
import { useGetSchemaQuery, useReplaceSchemaMutation, useReplaceSchemaDocumentMutation, useInsertSchemaDocumentMutation, useDeleteSchemaDocumentMutation, useAppSelector } from "@/store";
import { PageShell, PageHeader, PagePlaceholder, btnPrimary, btnSecondary, selectClass, useRouteParams, ConfirmDialog } from "@/components";
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
  const { t } = useTranslation();
  const routeParams = useRouteParams();
  const { classId } = useParams<{ classId?: string }>();
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [valid, setValid] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"" | "saving" | "saved" | "error">("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);
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

  if (!routeParams) return <PagePlaceholder>{t("common.selectDataProduct")}</PagePlaceholder>;
  if (isLoading) return <PagePlaceholder>{t("schema.loadingSchema")}</PagePlaceholder>;

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
            message: t("common.createdVia", { id: docId }),
          }).unwrap();
          navigate(`${routeBase}/schema/class/${encodeURIComponent(docId)}`);
        } else {
          await replaceSchemaDocument({
            path: docPath,
            id: docId,
            document: doc,
            author: username,
            message: t("common.updatedVia", { id: docId }),
          }).unwrap();
        }
      } else {
        const schemaArray = parsed as SchemaClass[];
        await replaceSchema({
          path: schemaPath,
          schema: schemaArray,
          author: username,
          message: t("common.updatedSchemaVia"),
        }).unwrap();
      }
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(""), 3000);
    } catch (err) {
      setSaveStatus("error");
      if (err && typeof err === "object" && "data" in err) {
        const data = (err as { data: unknown }).data;
        if (typeof data === "object" && data !== null) {
          const msg = (data as Record<string, unknown>)["api:message"] ?? (data as Record<string, unknown>).message ?? t("schema.saveFailed");
          setSaveError(String(msg));
        } else {
          setSaveError(t("schema.saveFailed"));
        }
      } else {
        setSaveError(t("schema.saveFailed"));
      }
    }
  };

  const handleNewClass = () => {
    navigate(`${routeBase}/schema/class/new`);
  };

  const handleDeleteClass = () => {
    if (!selectedClassId) return;
    setConfirmState({
      title: t("common.deleteClass"),
      message: t("common.deleteClassConfirm", { id: selectedClassId }),
      onConfirm: () => {
        setConfirmState(null);
        void doDeleteClass();
      },
    });
  };

  const doDeleteClass = async () => {
    if (!selectedClassId) return;
    setSaveStatus("saving");
    setSaveError(null);
    try {
      await deleteSchemaDocument({
        path: docPath,
        id: selectedClassId,
        author: username,
        message: t("common.deletedVia", { id: selectedClassId }),
      }).unwrap();
      navigate(`${routeBase}/schema`);
    } catch (err) {
      setSaveStatus("error");
      if (err && typeof err === "object" && "data" in err) {
        const data = (err as { data: unknown }).data;
        if (typeof data === "object" && data !== null) {
          const msg = (data as Record<string, unknown>)["api:message"] ?? (data as Record<string, unknown>).message ?? t("schema.deleteFailed");
          setSaveError(String(msg));
        } else {
          setSaveError(t("schema.deleteFailed"));
        }
      } else {
        setSaveError(t("schema.deleteFailed"));
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

  const saveLabel = saveStatus === "saving" ? t("common.saving") : saveStatus === "saved" ? t("common.saved") : saveStatus === "error" ? t("common.error") : t("common.save");
  const saveClass = saveStatus === "saved"
    ? "bg-green-500 text-white"
    : saveStatus === "error"
    ? "bg-red-500 text-white"
    : btnPrimary;

  return (
    <>
    <PageShell
      header={
        <PageHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-gray-900">{t("schema.editor")}</h2>
              <select
                value={selectedClassId}
                onChange={(e) => handleClassSelect(e.target.value)}
                className={selectClass}
              >
                <option value="">{t("schema.allClasses")}</option>
                {classes?.map((cls) => (
                  <option key={cls["@id"]} value={cls["@id"]}>{cls["@id"]}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleNewClass}
                className={btnSecondary}
              >
                {t("schema.newClass")}
              </button>
              {selectedClassId && (
                <button
                  type="button"
                  onClick={handleDeleteClass}
                  disabled={saveStatus === "saving"}
                  className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  {t("common.delete")}
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
            {t("schema.invalidJson")}
          </div>
        )}
        {valid && saveError && (
          <div className="absolute bottom-4 left-4 rounded-md bg-red-100 px-3 py-1.5 text-xs font-medium text-red-700">
            {saveError}
          </div>
        )}
      </div>
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
