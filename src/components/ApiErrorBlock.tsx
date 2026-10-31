import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ApiErrorDetail } from "@/utils/apiErrors";

// Modal/inline error block: verbatim api:message + expandable raw payload.
export function ApiErrorBlock({ error }: { error: ApiErrorDetail }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
      <div className="font-medium">
        {error.type ? `${error.type}: ` : ""}
        {error.message}
      </div>
      <details className="mt-1">
        <summary className="cursor-pointer text-xs opacity-70">Details</summary>
        <div className="relative">
          <pre className="mt-1 max-h-48 overflow-auto rounded bg-black/5 p-2 text-xs whitespace-pre-wrap dark:bg-black/30">
            {error.detailsJson}
          </pre>
          <button
            type="button"
            className="absolute right-1 top-1 rounded border border-gray-300 bg-white/90 px-1.5 py-0.5 text-[10px] text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800/90 dark:text-gray-300 dark:hover:bg-gray-700"
            onClick={() => {
              void navigator.clipboard.writeText(error.detailsJson);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? t("common.copied") : t("common.copy")}
          </button>
        </div>
      </details>
    </div>
  );
}
