import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Editor from "@monaco-editor/react";
import ReactMarkdown from "react-markdown";
import type { TerminusDBDocument } from "@/types/terminusdb";
import { isValidJson } from "@/utils/validation";
import { buildApiPath, type RouteParams } from "@/utils/routes";
import { useGetEmbeddingTextQuery, useGetMarkdownTextQuery } from "@/store";
import { SimilarDocumentsPanel } from "./SimilarDocumentsPanel";

type EditorTab = "json" | "markdown" | "embedding" | "similar";

interface DocumentEditorProps {
  readonly document: TerminusDBDocument;
  readonly onSave: (doc: TerminusDBDocument) => Promise<void> | void;
  readonly onCancel: () => void;
  readonly saving?: boolean;
}

const MONACO_OPTIONS = {
  minimap: { enabled: false },
  fontSize: 13,
  wordWrap: "on" as const,
  scrollBeyondLastLine: false,
  automaticLayout: true,
  tabSize: 2,
  scrollbar: { alwaysConsumeMouseWheel: false },
};

export const DocumentEditor: React.FC<DocumentEditorProps> = ({ document, onSave, onCancel, saving }) => {
  const [text, setText] = useState("");
  const [valid, setValid] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<EditorTab>("json");
  const params = useParams();
  const navigate = useNavigate();

  const { org, team, branch, commitId } = params;
  const refType = branch ? "branch" : commitId ? "commit" : null;
  const refName = branch ?? commitId ?? null;

  const routeParams: RouteParams | null = useMemo(() => {
    if (!org || !team || !refType || !refName) return null;
    return { org, team, refType, refName };
  }, [org, team, refType, refName]);

  const docPath = routeParams ? buildApiPath(routeParams, "document") : "";
  const similarPath = routeParams ? buildApiPath(routeParams, "similar") : "";
  const docId = document["@id"];

  const { data: embeddingText, isFetching: embeddingFetching, error: embeddingErr } = useGetEmbeddingTextQuery(
    { path: docPath, id: docId },
    { skip: !docId || activeTab !== "embedding" }
  );

  const { data: markdownText, isFetching: markdownFetching, error: markdownErr } = useGetMarkdownTextQuery(
    { path: docPath, id: docId },
    { skip: !docId || activeTab !== "markdown" }
  );

  useEffect(() => {
    setText(JSON.stringify(document, null, 2));
    setValid(true);
  }, [document]);

  const handleChange = (value: string | undefined) => {
    const newText = value ?? "";
    setText(newText);
    setValid(isValidJson(newText));
    setSaveError(null);
  };

  const handleSave = async () => {
    if (!valid) return;
    setSaveError(null);
    try {
      const parsed = JSON.parse(text) as TerminusDBDocument;
      await onSave(parsed);
    } catch (err) {
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

  const tabs: ReadonlyArray<{ id: EditorTab; label: string }> = [
    { id: "json", label: "JSON" },
    { id: "markdown", label: "Markdown" },
    { id: "embedding", label: "Embedding" },
    { id: "similar", label: "Similar" },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700">{docId}</span>
          {document["@type"] && (
            <button
              type="button"
              onClick={() => {
                if (org && team && refType && refName) {
                  navigate(`/${org}/${team}/local/${refType}/${refName}/schema?class=${encodeURIComponent(document["@type"])}`);
                }
              }}
              className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500 transition-colors hover:bg-dfrntBlue-100 hover:text-dfrntBlue-700"
            >
              {document["@type"]}
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!valid || saving}
            className="rounded-md bg-dfrntBlue-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-dfrntBlue-400 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-gray-200 bg-gray-50 px-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "border-dfrntBlue-500 text-dfrntBlue-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === "json" && (
          <div className="relative flex-1">
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
        )}

        {activeTab === "markdown" && (
          <div className="flex-1 overflow-auto p-4">
            {markdownFetching && <div className="text-sm text-gray-500">Loading markdown…</div>}
            {markdownErr && !markdownFetching && (
              <div className="text-sm text-red-600">
                Failed to load markdown: {"status" in markdownErr ? String(markdownErr.status) : "Unknown error"}
              </div>
            )}
            {markdownText && !markdownFetching && !markdownErr && (
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown>{markdownText}</ReactMarkdown>
              </div>
            )}
            {!markdownText && !markdownFetching && !markdownErr && (
              <div className="text-sm text-gray-400">No markdown available for this document.</div>
            )}
          </div>
        )}

        {activeTab === "embedding" && (
          <div className="flex-1 overflow-auto p-4">
            {embeddingFetching && <div className="text-sm text-gray-500">Fetching embedding text…</div>}
            {embeddingErr && !embeddingFetching && (
              <div className="text-sm text-red-600">
                Failed to load embedding: {"status" in embeddingErr ? String(embeddingErr.status) : "Unknown error"}
              </div>
            )}
            {embeddingText && !embeddingFetching && !embeddingErr && (
              <pre className="overflow-auto rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700 whitespace-pre-wrap">
                {embeddingText}
              </pre>
            )}
            {!embeddingText && !embeddingFetching && !embeddingErr && (
              <div className="text-sm text-gray-400">No embedding text available for this document.</div>
            )}
          </div>
        )}

        {activeTab === "similar" && routeParams && docId && (
          <SimilarDocumentsPanel
            similarPath={similarPath}
            documentId={docId}
            onSelectDocument={(id) => {
              if (org && team && refType && refName) {
                navigate(`/${org}/${team}/local/${refType}/${refName}/documents?edit=${encodeURIComponent(id)}`);
              }
            }}
          />
        )}

        {activeTab === "similar" && (!routeParams || !docId) && (
          <div className="p-4 text-sm text-gray-400">Save the document first to find similar documents.</div>
        )}
      </div>
    </div>
  );
};
