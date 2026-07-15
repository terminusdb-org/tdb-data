import { useEffect } from "react";
import { useAppDispatch, startCommitStream, stopCommitStream } from "@/store";

interface UseCommitStreamOptions {
  org: string;
  team: string;
  branch: string;
  enabled?: boolean;
}

export function useCommitStream({ org, team, branch, enabled = true }: UseCommitStreamOptions) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (enabled && org && team && branch) {
      dispatch(startCommitStream({ org, team, branch }));
      return () => {
        dispatch(stopCommitStream());
      };
    }
  }, [enabled, org, team, branch, dispatch]);
}
