import type { ApiErrorDetail } from "@/utils/apiErrors";

// Modal/inline error block: verbatim api:message + expandable raw payload.
export function ApiErrorBlock({ error }: { error: ApiErrorDetail }) {
  return (
    <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
      <div className="font-medium">
        {error.type ? `${error.type}: ` : ""}
        {error.message}
      </div>
      <details className="mt-1">
        <summary className="cursor-pointer text-xs opacity-70">Details</summary>
        <pre className="mt-1 max-h-48 overflow-auto rounded bg-black/5 p-2 text-xs whitespace-pre-wrap dark:bg-black/30">
          {error.detailsJson}
        </pre>
      </details>
    </div>
  );
}
