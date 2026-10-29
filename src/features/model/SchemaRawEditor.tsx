import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Editor from "@monaco-editor/react";
import { useReplaceSchemaDocumentMutation, useReplaceSchemaMutation, useAppSelector } from "@/store";
import { isValidJson } from "@/utils/validation";
import { describeApiError, type ApiErrorDetail } from "@/utils/apiErrors";
import { ApiErrorBlock } from "@/components/ApiErrorBlock";
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

interface Props {
  classes: SchemaClass[];
  schemaPath: string;
  docPath: string;
  /** Per-class raw doc when set; whole schema list otherwise. */
  elementId?: string;
}

// The Raw tab: JSON editing of the selected class doc (or whole schema) via the
// document API — the escape hatch for anything the modeller doesn't model.
export function SchemaRawEditor({ classes, schemaPath, docPath, elementId }: Props) {
  const { t } = useTranslation();
  const username = useAppSelector((s) => s.auth.username ?? "admin");
  const [replaceSchema] = useReplaceSchemaMutation();
  const [replaceSchemaDocument] = useReplaceSchemaDocumentMutation();
  const [text, setText] = useState("");
  const [valid, setValid] = useState(true);
  const [status, setStatus] = useState<"" | "saving" | "saved" | "error">("");
  const [error, setError] = useState<ApiErrorDetail | null>(null);

  useEffect(() => {
    const cls = elementId ? classes.find((c) => c["@id"] === elementId) : undefined;
    if (elementId && cls) {
      const { "@id": _id, ...rest } = cls;
      setText(JSON.stringify(rest, null, 2));
    } else if (!elementId) {
      setText(JSON.stringify(classes, null, 2));
    }
    setValid(true);
    setError(null);
  }, [classes, elementId]);

  const save = async () => {
    if (!valid) return;
    setStatus("saving");
    setError(null);
    try {
      const parsed = JSON.parse(text);
      if (elementId) {
        await replaceSchemaDocument({
          path: docPath,
          id: elementId,
          document: { "@id": elementId, ...parsed },
          author: username,
          message: t("common.updatedVia", { id: elementId }),
        }).unwrap();
      } else {
        await replaceSchema({ path: schemaPath, schema: parsed as SchemaClass[], author: username, message: t("common.updatedSchemaVia") }).unwrap();
      }
      setStatus("saved");
      setTimeout(() => setStatus(""), 3000);
    } catch (err) {
      setStatus("error");
      setError(describeApiError(err));
    }
  };

  return (
    <div className="relative" style={{ height: "560px" }}>
      <Editor
        height="100%"
        defaultLanguage="json"
        value={text}
        onChange={(v) => {
          const next = v ?? "";
          setText(next);
          setValid(isValidJson(next));
        }}
        options={MONACO_OPTIONS}
      />
      <div className="absolute right-4 bottom-4 flex items-center gap-2">
        {!valid && <span className="rounded bg-red-100 px-2 py-1 text-xs text-red-700">{t("schema.invalidJson")}</span>}
        {error && <ApiErrorBlock error={error} />}
        <button type="button" onClick={() => void save()} disabled={!valid || status === "saving"} className="rounded bg-sky-600 px-3 py-1 text-xs font-medium text-white hover:bg-sky-700 disabled:opacity-50">
          {status === "saving" ? t("common.saving") : status === "saved" ? t("common.saved") : t("common.save")}
        </button>
      </div>
    </div>
  );
}
