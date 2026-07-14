import React, { useState, useEffect } from "react";
import Editor from "@monaco-editor/react";
import { useGetPrefixesQuery, useReplaceContextMutation, useAppSelector } from "@/store";
import { PageShell, PageHeader, PagePlaceholder, btnPrimary, useRouteParams } from "@/components";
import { buildApiPath } from "@/utils/routes";
import { isValidJson } from "@/utils/validation";

export const ContextPage: React.FC = () => {
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
      const ctx = raw["@type"] === "@context" ? raw : (raw["@context"] ?? raw);
      setText(JSON.stringify(ctx, null, 2));
      setValid(true);
    }
  }, [schemaData]);

  if (!routeParams) return <PagePlaceholder>Select a data product first.</PagePlaceholder>;
  if (isLoading) return <PagePlaceholder>Loading context…</PagePlaceholder>;

  const handleChange = (value: string | undefined) => {
    const newText = value ?? "";
    setText(newText);
    setValid(isValidJson(newText));
  };

  const handleSave = async () => {
    if (!valid) return;
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      setSaveStatus("saving");
      await replaceContext({
        path: schemaPath,
        context: parsed,
        author: username,
        message: "Updated context via Data Explorer",
      }).unwrap();
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(""), 3000);
    } catch {
      setSaveStatus("error");
      setValid(false);
    }
  };

  return (
    <PageShell
      header={
        <PageHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Context Editor (@context)</h2>
            <button
              type="button"
              onClick={handleSave}
              disabled={!valid || saveStatus === "saving"}
              className={btnPrimary}
            >
              {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved!" : "Save Context"}
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
            Invalid JSON — fix errors before saving
          </div>
        )}
      </div>
    </PageShell>
  );
};

