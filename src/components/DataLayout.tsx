import React, { useEffect } from "react";
import { Outlet, useParams } from "react-router-dom";
import { useAppDispatch, setContext, clearContext } from "@/store";
import { DataSidebar } from "./DataSidebar";
import { StatusBar } from "./StatusBar";
import { ErrorBanner } from "./ErrorBanner";
import { useCommitStream } from "@/hooks/useCommitStream";

export const DataLayout: React.FC = () => {
  const dispatch = useAppDispatch();
  const params = useParams();

  useEffect(() => {
    const org = params.org;
    const team = params.team;
    const branch = params.branch;
    const commitId = params.commitId;

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

  // Connect commit stream globally so the sidebar shows the latest commit hash
  // on all data product pages, not just the history page.
  const org = params.org;
  const team = params.team;
  const branch = params.branch;
  useCommitStream({ org: org ?? "", team: team ?? "", branch: branch ?? "", enabled: !!(org && team && branch) });

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <div className="flex flex-1 overflow-hidden">
        <DataSidebar />
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
      <StatusBar />
      <ErrorBanner />
    </div>
  );
};
