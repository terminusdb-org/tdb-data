import React from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAppDispatch, logout, useAppSelector, selectLatestCommitId, selectConnectionStatus } from "@/store";

interface RailItem {
  readonly label: string;
  readonly icon: React.ReactNode;
  readonly segment: string;
}

const searchIcon = (
  <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
  </svg>
);

const exploreIcon = (
  <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75h16.5v16.5H3.75z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 7.5h9M7.5 12h9M7.5 16.5h5" />
  </svg>
);

const schemaIcon = (
  <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25M6.75 17.25 1.5 12l5.25-5.25" />
  </svg>
);

const embeddingsIcon = (
  <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.171.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23-.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
  </svg>
);

const documentsIcon = (
  <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
  </svg>
);

const rawJsonIcon = (
  <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 3.75 3 12l4.5 8.25M16.5 3.75 21 12l-4.5 8.25" />
  </svg>
);

const graphqlIcon = (
  <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0 0V3m9 9H3M5.636 5.636l12.728 12.728M18.364 5.636 5.636 18.364" />
  </svg>
);

const contextIcon = (
  <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
  </svg>
);

const vectorSearchIcon = (
  <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
    <circle cx="6" cy="6.75" r="1.5" fill="currentColor" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    <circle cx="18" cy="17.25" r="1.5" fill="currentColor" />
  </svg>
);

const entityResolutionIcon = (
  <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
    <circle cx="9" cy="12" r="5" />
    <circle cx="15" cy="12" r="5" />
  </svg>
);

const historyIcon = (
  <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  </svg>
);

const allItems: ReadonlyArray<RailItem> = [
  { label: "nav.search", segment: "search", icon: searchIcon },
  { label: "nav.explore", segment: "doctypes", icon: exploreIcon },
  { label: "nav.schema", segment: "schema", icon: schemaIcon },
  { label: "nav.embeddings", segment: "embeddings", icon: embeddingsIcon },
  { label: "nav.documents", segment: "documents", icon: documentsIcon },
  { label: "nav.rawJson", segment: "raw", icon: rawJsonIcon },
  { label: "nav.graphql", segment: "graphql", icon: graphqlIcon },
  { label: "nav.vectorSearch", segment: "vector-search", icon: vectorSearchIcon },
  { label: "nav.entityResolution", segment: "entity-resolution", icon: entityResolutionIcon },
  { label: "nav.projection", segment: "projection", icon: embeddingsIcon },
  { label: "nav.context", segment: "context", icon: contextIcon },
  { label: "nav.history", segment: "history", icon: historyIcon },
];

export interface IconRailProps {
  readonly onNavigate?: () => void;
}

export const IconRail: React.FC<IconRailProps> = ({ onNavigate }) => {
  const { t } = useTranslation();
  const params = useParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const location = useLocation();
  const username = useAppSelector((state) => state.auth.username);
  const latestCommitId = useAppSelector(selectLatestCommitId);
  const connectionStatus = useAppSelector(selectConnectionStatus);

  const { org, team, branch, commitId } = params;
  const hasContext = !!(org && team && (branch || commitId));

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
    const parts = location.pathname.split("/");
    const localIdx = parts.indexOf("local");
    if (localIdx === -1) return "";
    // After 'local' comes 'branch/{name}' or 'commit/{id}', then the segment
    const segmentIdx = localIdx + 3;
    if (segmentIdx >= parts.length) return "";
    return parts[segmentIdx] ?? "";
  })();

  let statusDotClass = "bg-gray-400";
  if (connectionStatus === "connected") {
    statusDotClass = "bg-green-500";
  } else if (connectionStatus === "connecting") {
    statusDotClass = "bg-yellow-500 animate-pulse";
  } else if (connectionStatus === "error") {
    statusDotClass = "bg-red-500";
  }

  return (
    <aside className="flex w-14 flex-col items-center border-r border-gray-200 bg-white">
      <div className="flex h-14 w-full items-center justify-center border-b border-gray-200">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-dfrntBlue-600">
          <svg aria-hidden="true" className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375" />
          </svg>
        </div>
      </div>

      <nav className="flex flex-1 flex-col items-center overflow-y-auto py-2" aria-label={t("nav.mainNavigation")}>
        {allItems.map((item) => {
          const isActive = currentSegment === item.segment;
          const path = buildPath(item.segment);
          const isDisabled = !hasContext;
          const label = t(item.label);
          let toneClass = "text-gray-500 hover:bg-gray-100 hover:text-gray-900";
          if (isActive) {
            toneClass = "bg-dfrntBlue-50 text-dfrntBlue-700";
          } else if (isDisabled) {
            toneClass = "cursor-not-allowed text-gray-300";
          }
          return (
            <button
              key={item.label}
              type="button"
              disabled={isDisabled}
              title={label}
              aria-label={label}
              aria-current={isActive ? "page" : undefined}
              onClick={() => {
                navigate(path);
                onNavigate?.();
              }}
              className={`group relative mb-1 flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${toneClass}`}
            >
              {item.icon}
              <span className="pointer-events-none absolute left-12 z-50 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                {label}
              </span>
              {isActive && (
                <span className="absolute -left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full bg-dfrntBlue-600" />
              )}
            </button>
          );
        })}
      </nav>

      <div className="flex flex-col items-center border-t border-gray-200 py-2">
        {latestCommitId && (
          <span
            className={`mb-2 h-1.5 w-1.5 rounded-full ${statusDotClass}`}
            title={latestCommitId.slice(0, 7)}
          />
        )}
        <button
          type="button"
          title={t("nav.allDataProducts")}
          aria-label={t("nav.allDataProducts")}
          onClick={() => {
            navigate("/");
            onNavigate?.();
          }}
          className="mb-1 flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
          </svg>
        </button>
        <button
          type="button"
          title={t("nav.signOutWithUser", { username })}
          aria-label={t("nav.signOutWithUser", { username })}
          onClick={() => {
            dispatch(logout());
            navigate("/login", { replace: true });
          }}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
          </svg>
        </button>
      </div>
    </aside>
  );
};
