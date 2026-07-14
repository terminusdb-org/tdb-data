import React from "react";
import { useGetSchemaQuery } from "@/store";
import { DoctypeTree, PageShell, PageHeader, PagePlaceholder, useRouteParams } from "@/components";
import { buildApiPath } from "@/utils/routes";

export const DoctypesPage: React.FC = () => {
  const routeParams = useRouteParams();

  const schemaPath = routeParams ? buildApiPath(routeParams, "schema") : "";
  const { data: classes, isLoading, error } = useGetSchemaQuery(
    { path: schemaPath, asList: true },
    { skip: !routeParams }
  );

  if (!routeParams) return <PagePlaceholder>Select a data product first.</PagePlaceholder>;
  if (isLoading) return <PagePlaceholder>Loading schema…</PagePlaceholder>;
  if (error) return <PagePlaceholder error>Failed to load schema.</PagePlaceholder>;

  return (
    <PageShell
      header={
        <PageHeader>
          <h2 className="text-lg font-semibold text-gray-900">Document Types</h2>
          <p className="mt-0.5 text-sm text-gray-500">Non-subdocument, shared types</p>
        </PageHeader>
      }
    >
      {classes && classes.length > 0 ? (
        <DoctypeTree classes={classes} />
      ) : (
        <PagePlaceholder>No document types found.</PagePlaceholder>
      )}
    </PageShell>
  );
};
