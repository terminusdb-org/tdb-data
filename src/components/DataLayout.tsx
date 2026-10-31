import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, Outlet, useLocation, useParams } from "react-router-dom";
import {
  useAppDispatch,
  setContext,
  clearContext,
  clearProjectionState,
  clearERState,
  clearCommitHistory,
  clearError,
  baseApi,
} from "@/store";
import { IconRail } from "./IconRail";
import { StatusBar } from "./StatusBar";
import { ErrorBanner } from "./ErrorBanner";
import { ToastStack } from "./ToastStack";
import { useCommitStream } from "@/hooks/useCommitStream";

export const DataLayout: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const params = useParams();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [desktopNavCollapsed, setDesktopNavCollapsed] = useState(false);

  const prevDataProductKey = useRef<string | null>(null);

  useEffect(() => {
    const org = params.org;
    const team = params.team;
    const branch = params.branch;
    const commitId = params.commitId;

    const dataProductKey = org && team
      ? `${org}/${team}`
      : null;

    if (prevDataProductKey.current !== null && prevDataProductKey.current !== dataProductKey) {
      dispatch(clearProjectionState());
      dispatch(clearERState());
      dispatch(clearCommitHistory());
      dispatch(clearError());
      // Skip the cache reset when leaving for the picker (key becomes
      // null): it clobbers the picker's getDatabases subscription mounting
      // in the same commit, leaving it stuck on "Loading" with no request
      // fired. Cached entries are arg-keyed per product, so retention is
      // safe.
      if (dataProductKey !== null) {
        dispatch(baseApi.util.resetApiState());
      }
    }
    prevDataProductKey.current = dataProductKey;

    if (org && team) {
      if (branch) {
        dispatch(setContext({ org, team, refType: "branch", refName: branch }));
      } else if (commitId) {
        dispatch(setContext({ org, team, refType: "commit", refName: commitId }));
      } else {
        dispatch(clearContext());
      }
    } else {
      dispatch(clearContext());
    }
  }, [params.org, params.team, params.branch, params.commitId, dispatch]);

  const org = params.org;
  const team = params.team;
  const branch = params.branch;
  useCommitStream({ org: org ?? "", team: team ?? "", branch: branch ?? "", enabled: !!(org && team && branch) });

  const mainBranchPath = location.pathname.replace(`/local/commit/${params.commitId}`, "/local/branch/main");

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      {/* Mobile hamburger button — hidden on desktop */}
      {!mobileNavOpen && (
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          className="absolute left-2 top-2 z-50 flex h-9 w-9 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 shadow-sm md:hidden"
          aria-label={t("nav.openNavigation")}
        >
          <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
          </svg>
        </button>
      )}

      {/* Mobile slide-out drawer overlay */}
      {mobileNavOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/20 md:hidden"
            onClick={() => setMobileNavOpen(false)}
            onKeyDown={(e) => { if (e.key === "Escape") setMobileNavOpen(false); }}
            aria-label={t("nav.closeNavigation")}
          />
          <div className="fixed left-0 top-0 z-50 h-full shadow-xl md:hidden">
            <IconRail variant="drawer" onNavigate={() => setMobileNavOpen(false)} />
          </div>
        </>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop icon rail — collapsible on md+ */}
        {desktopNavCollapsed ? (
          <div className="hidden md:flex w-8 flex-col items-center border-r border-gray-200 bg-white">
            <button
              type="button"
              onClick={() => setDesktopNavCollapsed(false)}
              className="flex h-14 w-full items-center justify-center text-gray-400 hover:text-gray-600"
              title={t("nav.showNavigation")}
            >
              <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="hidden md:flex relative">
            <IconRail />
            <button
              type="button"
              onClick={() => setDesktopNavCollapsed(true)}
              className="absolute -right-3 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400 shadow-sm hover:text-gray-600"
              title={t("nav.hideNavigation")}
            >
              <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          </div>
        )}
        <main className="flex-1 overflow-auto p-3 sm:p-6">
          {params.commitId && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
              <svg aria-hidden="true" className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.852l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
              </svg>
              <span>
                {t("dataLayout.viewingCommit")} <code className="font-mono text-xs">{params.commitId.slice(0, 12)}</code> {t("dataLayout.readOnlySnapshot")}{" "}
                <Link
                  className="font-medium text-amber-900 underline underline-offset-2 hover:text-amber-700"
                  to={mainBranchPath + location.search}
                >
                  {t("dataLayout.backToMain")}
                </Link>
              </span>
            </div>
          )}
          <Outlet />
        </main>
      </div>
      <StatusBar />
      <ErrorBanner />
      <ToastStack />
    </div>
  );
};
