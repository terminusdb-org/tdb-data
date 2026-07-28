import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import Editor from "@monaco-editor/react";
import { useGetPrefixesQuery, useReplaceContextMutation, useAppSelector } from "@/store";
import { PageShell, PageHeader, PagePlaceholder, btnPrimary, useRouteParams } from "@/components";
import { buildApiPath } from "@/utils/routes";
import { isValidJson } from "@/utils/validation";

export const ContextPage: React.FC = () => {
  const { t } = useTranslation();
  const routeParams = useRouteParams();
  const [text, setText] = useState("");
  const [valid, setValid] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"" | "saving" | "saved" | "error">("");
  const [replaceContext] = useReplaceContextMutation();
  const username = useAppSelector((state) => state.auth.username ?? "admin");

  const schemaPath = routeParams ? buildApiPath(routeParams, "schema") : "";
  const { data: schemaData, isLoading } = useGetPrefixesQuery(
    { path: schemaPath },
    { skip: !routeParams }
  );

  useEffect(() => {
    if (schemaData) {
      const raw = schemaData as unknown as Record<string, unknown>;
      const ctx = raw["@type"] === "@context" || raw["@type"] === "Context"
        ? { ...raw, "@type": "@context" }
        : (raw["@context"] ?? raw);
      setText(JSON.stringify(ctx, null, 2));
      setValid(true);
    }
  }, [schemaData]);

  if (!routeParams) return <PagePlaceholder>{t("common.selectDataProduct")}</PagePlaceholder>;
  if (isLoading) return <PagePlaceholder>{t("context.loadingContext")}</PagePlaceholder>;

  const handleChange = (value: string | undefined) => {
    const newText = value ?? "";
    setText(newText);
    setValid(isValidJson(newText));
  };

  const handleSave = async () => {
    if (!valid) return;
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      const { "@id": _stripId, ...rest } = parsed;
      const normalized = { ...rest, "@type": "@context" };
      setSaveStatus("saving");
      await replaceContext({
        path: schemaPath,
        context: normalized,
        author: username,
        message: t("common.updatedContextVia"),
      }).unwrap();
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(""), 3000);
    } catch (err: unknown) {
      console.error(t("context.failedToSave"), err);
      setSaveStatus("error");
      setValid(false);
    }
  };

  return (
    <PageShell
      header={
        <PageHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">{t("context.title")}</h2>
            <button
              type="button"
              onClick={handleSave}
              disabled={!valid || saveStatus === "saving"}
              className={btnPrimary}
            >
              {saveStatus === "saving" ? t("common.saving") : saveStatus === "saved" ? t("common.saved") : t("context.saveContext")}
            </button>
          </div>
        </PageHeader>
      }
    >
      <div className="relative h-full">
        <Editor
          height="100%"
          defaultLanguage="json"
          value={text}
          onChange={handleChange}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            wordWrap: "on",
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
          }}
        />
        {!valid && (
          <div className="absolute bottom-4 left-4 rounded-md bg-red-100 px-3 py-1.5 text-xs font-medium text-red-700">
            {t("context.invalidJson")}
          </div>
        )}
      </div>
    </PageShell>
  );
};

