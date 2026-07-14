import React from "react";
import { useNavigate } from "react-router-dom";
import { useAppSelector } from "@/store";
import { useRouteParams, PageShell, PageHeader } from "@/components";

function shortenUri(uri: string): string {
  const match = uri.match(/terminusdb:\/\/(?:data|schema)#(.+)/) || uri.match(/\/data\/(.+)/);
  return match ? match[1] : uri;
}

function formatTimestamp(ts: string): string {
  const num = Number(ts);
  if (!isNaN(num) && num > 0) {
    const date = new Date(num * 1000);
    return date.toLocaleString();
  }
  return ts;
}

function ChangeBadge({ label, items, color, onNavigate }: { label: string; items: string[]; color: string; onNavigate: (uri: string) => void }) {
  if (items.length === 0) return null;
  return (
    <div className="flex items-start gap-1.5">
      <span className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-xs font-medium ${color}`}>
        {label} ({items.length})
      </span>
      <div className="flex flex-wrap gap-1">
        {items.map((uri, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onNavigate(uri)}
            className="rounded bg-gray-50 px-1 py-0.5 text-xs text-gray-600 hover:bg-dfrntBlue-50 hover:text-dfrntBlue-700"
            title={`Open ${shortenUri(uri)}`}
          >
            {shortenUri(uri)}
          </button>
        ))}
      </div>
    </div>
  );
}

export const BranchHistoryPage: React.FC = () => {
  const routeParams = useRouteParams();
  const navigate = useNavigate();
  const connectionStatus = useAppSelector((state) => state.commitStream.connectionStatus);
  const error = useAppSelector((state) => state.commitStream.error);
  const history = useAppSelector((state) => state.commitStream.history);

  const org = routeParams?.org ?? "";
  const team = routeParams?.team ?? "";
  const branch = routeParams?.refType === "branch" ? routeParams.refName : "main";

  // Commit stream is connected globally in DataLayout — no local connection needed.

  const navigateToDoc = (uri: string) => {
    if (!routeParams) return;
    const docId = shortenUri(uri);
    navigate(`/${routeParams.org}/${routeParams.team}/local/${routeParams.refType}/${routeParams.refName}/documents?edit=${encodeURIComponent(docId)}`);
  };

  const statusColor =
    connectionStatus === "connected"
      ? "bg-green-500"
      : connectionStatus === "connecting"
        ? "bg-yellow-500"
        : connectionStatus === "error"
          ? "bg-red-500"
          : "bg-gray-400";

  return (
    <PageShell>
      <PageHeader>
        <h1 className="text-lg font-semibold text-gray-900">Branch History</h1>
        <p className="text-sm text-gray-500">
          Live commit stream for {org}/{team} — branch {branch}
        </p>
      </PageHeader>
      <div className="px-6 py-4">
        <div className="mb-4 flex items-center gap-2">
          <span className={`inline-block h-2.5 w-2.5 rounded-full ${statusColor}`} />
          <span className="text-sm text-gray-600">
            {connectionStatus === "connected" && "Connected — receiving commits"}
            {connectionStatus === "connecting" && "Connecting…"}
            {connectionStatus === "disconnected" && "Disconnected"}
            {connectionStatus === "error" && `Error: ${error ?? "unknown"}`}
          </span>
        </div>

        {history.length === 0 ? (
          <p className="text-sm text-gray-400">No commits received yet.</p>
        ) : (
          <div className="space-y-0">
            {history.map((entry, idx) => {
              const changes = entry.changes;
              const totalChanges = changes
                ? changes.added.length + changes.changed.length + changes.deleted.length
                : 0;
              const isLatest = idx === 0;
              return (
                <div key={entry.id} className="relative flex gap-4 pb-6">
                  {/* Timeline line and dot */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`mt-1 h-3 w-3 rounded-full border-2 ${
                        isLatest ? "border-dfrntBlue-500 bg-dfrntBlue-100" : "border-gray-300 bg-white"
                      }`}
                    />
                    {idx < history.length - 1 && (
                      <div className="mt-1 w-0.5 flex-1 bg-gray-200" />
                    )}
                  </div>

                  {/* Commit content */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-mono text-gray-700">
                        {entry.id.slice(0, 7)}
                      </code>
                      <span className="text-sm font-medium text-gray-900">
                        {entry.message || "(no message)"}
                      </span>
                      {isLatest && (
                        <span className="rounded-full bg-dfrntBlue-100 px-2 py-0.5 text-xs font-medium text-dfrntBlue-700">
                          latest
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                      <span className="font-medium text-gray-600">{entry.author}</span>
                      {entry.user && entry.user !== `terminusdb://system/data/User/${entry.author}` && (
                        <span className="text-gray-400">as {shortenUri(entry.user)}</span>
                      )}
                      {entry.timestamp && <span>{formatTimestamp(entry.timestamp)}</span>}
                      {totalChanges > 0 && (
                        <span className="text-gray-400">{totalChanges} document{totalChanges > 1 ? "s" : ""} changed</span>
                      )}
                    </div>
                    {changes && totalChanges > 0 && (
                      <div className="mt-2 space-y-1.5 rounded-lg bg-gray-50 px-3 py-2">
                        <ChangeBadge label="Added" items={changes.added} color="bg-green-100 text-green-700" onNavigate={navigateToDoc} />
                        <ChangeBadge label="Changed" items={changes.changed} color="bg-blue-100 text-blue-700" onNavigate={navigateToDoc} />
                        <ChangeBadge label="Deleted" items={changes.deleted} color="bg-red-100 text-red-700" onNavigate={navigateToDoc} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PageShell>
  );
};
