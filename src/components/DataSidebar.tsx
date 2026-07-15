import React from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useAppDispatch, logout, useAppSelector, selectLatestCommitId, selectConnectionStatus } from "@/store";

interface NavItem {
  readonly label: string;
  readonly icon: React.ReactNode;
  readonly segment: string;
}

interface NavSection {
  readonly title: string;
  readonly items: ReadonlyArray<NavItem>;
}

const searchIcon = (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
  </svg>
);

const exploreIcon = (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75h16.5v16.5H3.75z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 7.5h9M7.5 12h9M7.5 16.5h5" />
  </svg>
);

const schemaIcon = (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25M6.75 17.25 1.5 12l5.25-5.25" />
  </svg>
);

const embeddingsIcon = (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.171.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23-.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
  </svg>
);

const documentsIcon = (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
  </svg>
);

const rawJsonIcon = (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 3.75 3 12l4.5 8.25M16.5 3.75 21 12l-4.5 8.25" />
  </svg>
);

const graphqlIcon = (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0 0V3m9 9H3M5.636 5.636l12.728 12.728M18.364 5.636 5.636 18.364" />
  </svg>
);

const contextIcon = (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
  </svg>
);

const vectorSearchIcon = (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
    <circle cx="6" cy="6.75" r="1.5" fill="currentColor" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    <circle cx="18" cy="17.25" r="1.5" fill="currentColor" />
  </svg>
);

const entityResolutionIcon = (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
    <circle cx="9" cy="12" r="5" />
    <circle cx="15" cy="12" r="5" />
  </svg>
);

const historyIcon = (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  </svg>
);

const topItems: ReadonlyArray<NavItem> = [
  { label: "Search", segment: "", icon: searchIcon },
];

const navSections: ReadonlyArray<NavSection> = [
  {
    title: "Types",
    items: [
      { label: "Explore", segment: "doctypes", icon: exploreIcon },
      { label: "Schema", segment: "schema", icon: schemaIcon },
      { label: "Embeddings", segment: "embeddings", icon: embeddingsIcon },
    ],
  },
  {
    title: "Records",
    items: [
      { label: "Documents", segment: "documents", icon: documentsIcon },
      { label: "Raw JSON", segment: "raw", icon: rawJsonIcon },
      { label: "GraphQL", segment: "graphql", icon: graphqlIcon },
      { label: "Vector Search", segment: "vector-search", icon: vectorSearchIcon },
      { label: "Entity Resolution", segment: "entity-resolution", icon: entityResolutionIcon },
    ],
  },
  {
    title: "Visualization",
    items: [
      { label: "Projection", segment: "projection", icon: embeddingsIcon },
    ],
  },
];

const bottomItems: ReadonlyArray<NavItem> = [
  { label: "Context", segment: "context", icon: contextIcon },
  { label: "History", segment: "history", icon: historyIcon },
];

export const DataSidebar: React.FC = () => {
  const params = useParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const username = useAppSelector((state) => state.auth.username);
  const latestCommitId = useAppSelector(selectLatestCommitId);
  const connectionStatus = useAppSelector(selectConnectionStatus);
  const [searchParams] = useSearchParams();

  const { org, team, branch, commitId } = params;
  const hasContext = !!(org && team && (branch || commitId));
  const fromBranch = searchParams.get("from-branch");

  const buildPath = (segment: string): string => {
    if (!org || !team) return "/";
    if (branch) {
      const base = `/${org}/${team}/local/branch/${branch}`;
      return segment ? `${base}/${segment}` : base;
    }
    if (commitId) {
      const base = `/${org}/${team}/local/commit/${commitId}`;
      return segment ? `${base}/${segment}` : base;
    }
    return `/${org}/${team}`;
  };

  const currentSegment = (() => {
    if (!params["*"]) return "";
    const parts = params["*"].split("/");
    return parts[0] ?? "";
  })();

  return (
    <aside className="flex w-60 flex-col border-r border-gray-200 bg-white">
      <div className="flex h-14 items-center gap-2 border-b border-gray-200 px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-dfrntBlue-600">
          <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375" />
          </svg>
        </div>
        <span className="font-headline text-sm font-bold text-gray-900">Data Explorer</span>
      </div>

      {hasContext && (
        <div className="border-b border-gray-200 px-4 py-3">
          <p className="text-xs font-medium text-gray-500">Data Product</p>
          <p className="mt-0.5 truncate text-sm font-semibold text-gray-900">
            {org}/{team}
          </p>
          <p className="mt-0.5 truncate text-xs text-gray-500">
            {branch ? `branch: ${branch}` : commitId ? `commit: ${commitId}` : ""}
          </p>
          {latestCommitId && (
            <button
              type="button"
              onClick={() => {
                if (branch) {
                  navigate(`/${org}/${team}/local/branch/${branch}/history`);
                } else if (commitId) {
                  const branchParam = fromBranch ? `?from-branch=${fromBranch}` : "";
                  navigate(`/${org}/${team}/local/commit/${commitId}/history${branchParam}`);
                }
              }}
              className="mt-1 inline-flex items-center gap-1 rounded text-xs font-mono text-dfrntBlue-600 hover:underline"
            >
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${
                  connectionStatus === "connected"
                    ? "bg-green-500"
                    : connectionStatus === "connecting"
                      ? "bg-yellow-500 animate-pulse"
                      : connectionStatus === "error"
                        ? "bg-red-500"
                        : "bg-gray-400"
                }`}
              />
              {latestCommitId.slice(0, 7)}
            </button>
          )}
        </div>
      )}

      <nav className="flex-1 overflow-y-auto px-2 py-2">
        {topItems.map((item) => {
          const isActive = currentSegment === item.segment;
          const path = buildPath(item.segment);
          const isDisabled = !hasContext;
          return (
            <button
              key={item.label}
              type="button"
              disabled={isDisabled}
              onClick={() => navigate(path)}
              className={`mb-1 flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-dfrntBlue-50 text-dfrntBlue-700"
                  : isDisabled
                    ? "cursor-not-allowed text-gray-300"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          );
        })}

        {navSections.map((section) => (
          <div key={section.title} className="mt-3">
            <div className="mb-1 px-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
              {section.title}
            </div>
            {section.items.map((item) => {
              const isActive = currentSegment === item.segment;
              const path = buildPath(item.segment);
              const isDisabled = !hasContext;
              return (
                <button
                  key={item.label}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => navigate(path)}
                  className={`mb-1 flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-dfrntBlue-50 text-dfrntBlue-700"
                      : isDisabled
                        ? "cursor-not-allowed text-gray-300"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  {item.icon}
                  {item.label}
                </button>
              );
            })}
          </div>
        ))}

        {bottomItems.map((item) => {
          const isActive = currentSegment === item.segment;
          const path = buildPath(item.segment);
          const isDisabled = !hasContext;
          return (
            <button
              key={item.label}
              type="button"
              disabled={isDisabled}
              onClick={() => navigate(path)}
              className={`mt-3 mb-1 flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-dfrntBlue-50 text-dfrntBlue-700"
                  : isDisabled
                    ? "cursor-not-allowed text-gray-300"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-gray-200 px-3 py-3">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="mb-2 flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
          </svg>
          All data products
        </button>
        <div className="flex items-center justify-between">
          <span className="truncate text-xs text-gray-400">{username}</span>
          <button
            type="button"
            onClick={() => {
              dispatch(logout());
              navigate("/login", { replace: true });
            }}
            className="rounded-md px-2 py-1 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
};
