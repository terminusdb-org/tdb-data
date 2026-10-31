import { useCallback } from "react";
import { useAppDispatch, useAppSelector, useRunMigrationMutation } from "@/store";
import { editStarted, editSucceeded, editFailed } from "@/store/modelSlice";
import { notify } from "@/store/notificationSlice";
import { describeApiError } from "@/utils/apiErrors";
import type { MigrationOp } from "@/lib/schemaModel/migrationOps";

let counter = 0;

// The migration endpoint shares the resource path with schema — only the suffix differs.
export const migrationPathFor = (resourcePath: string): string =>
  resourcePath.replace(/^\/api\/(?:schema|document|migration)\//, "/api/migration/");

export const autoMigrationMessage = (operations: MigrationOp[]): string =>
  "model: " +
  operations
    .map((o) => {
      const classDocId =
        o.class_document && typeof o.class_document === "object"
          ? (o.class_document as Record<string, unknown>)["@id"]
          : undefined;
      const target = (o.class ?? o.enum ?? o.from ?? classDocId ?? "") as string;
      const propName =
        typeof o.property === "string" ? o.property : o["@type"].includes("Property") && typeof o.from === "string" ? o.from : "";
      const prop = propName ? `.${propName}` : "";
      return `${o["@type"]}${target ? ` ${target}` : ""}${prop}`;
    })
    .join(", ");

// Applies a migration immediately, tracking the pending edit in modelSlice.
// Failures surface as a persistent toast AND stay on the pending row for retry.
export function useApplyMigration() {
  const dispatch = useAppDispatch();
  const [runMigration] = useRunMigrationMutation();
  const username = useAppSelector((state) => state.auth.username ?? "admin");

  return useCallback(
    async (args: { path: string; elementId: string; ops: MigrationOp[]; message?: string }) => {
      const id = `edit-${++counter}-${Date.now()}`;
      dispatch(editStarted({ id, elementId: args.elementId, ops: args.ops }));
      try {
        await runMigration({
          path: migrationPathFor(args.path),
          author: username,
          message: args.message ?? autoMigrationMessage(args.ops),
          operations: args.ops,
        }).unwrap();
        dispatch(editSucceeded({ id }));
      } catch (err) {
        const detail = describeApiError(err);
        dispatch(editFailed({ id, error: detail }));
        dispatch(
          notify({
            severity: "error",
            title: detail.type ?? "Migration failed",
            message: detail.message,
            detailsJson: detail.detailsJson,
          })
        );
      }
      return id;
    },
    [dispatch, runMigration, username]
  );
}
