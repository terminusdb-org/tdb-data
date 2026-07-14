import { useMemo } from "react";
import { useParams } from "react-router-dom";
import type { RouteParams } from "@/utils/routes";

export function useRouteParams(): RouteParams | null {
  const params = useParams();
  const { org, team, branch, commitId } = params;
  const refType = branch ? "branch" : commitId ? "commit" : null;
  const refName = branch ?? commitId ?? null;

  return useMemo(() => {
    if (!org || !team || !refType || !refName) return null;
    return { org, team, refType, refName };
  }, [org, team, refType, refName]);
}
