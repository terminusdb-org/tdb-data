import React, { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useGetIndexStatusQuery, useGetSchemaQuery, useGraphqlDocumentCountQuery } from "@/store";
import { buildApiPath, type RouteParams } from "@/utils/routes";
import { isSubdocument, type SchemaClass } from "@/types/terminusdb";

export const StatusBar: React.FC = () => {
  const params = useParams();
  const navigate = useNavigate();

  const org = params.org;
  const team = params.team;
  const branch = params.branch;
  const commitId = params.commitId;

  const refType = branch ? "branch" : commitId ? "commit" : null;
  const refName = branch ?? commitId ?? null;

  const routeParams: RouteParams | null = useMemo(() => {
    if (!org || !team || !refType || !refName) return null;
    return { org, team, refType, refName };
  }, [org, team, refType, refName]);

  const indexPath = routeParams ? buildApiPath(routeParams, "index") : "";
  const { data: indexStatus } = useGetIndexStatusQuery(
    { path: indexPath },
    { skip: !routeParams }
  );

  const schemaPath = routeParams ? buildApiPath(routeParams, "schema") : "";
  const { data: schemaClasses } = useGetSchemaQuery(
    { path: schemaPath, asList: true },
    { skip: !routeParams }
  );

  const docTypes = useMemo(() => {
    if (!schemaClasses) return [];
    return schemaClasses
      .filter((c: SchemaClass) => c["@type"] === "Class" && !isSubdocument(c))
      .map((c) => c["@id"]);
  }, [schemaClasses]);

  const graphqlPath = routeParams ? buildApiPath(routeParams, "graphql") : "";
  const { data: graphqlCounts } = useGraphqlDocumentCountQuery(
    { path: graphqlPath, types: docTypes },
    { skip: !routeParams || docTypes.length === 0 }
  );

  const documentCount = useMemo(() => {
    if (!graphqlCounts || docTypes.length === 0) return null;
    return docTypes.reduce((sum, _type, i) => sum + (graphqlCounts[`t${i}`] ?? 0), 0);
  }, [graphqlCounts, docTypes]);

  if (!routeParams) {
    return (
      <footer className="flex h-8 items-center border-t border-gray-200 bg-white px-4 text-xs text-gray-400">
        Select a data product to view statistics
      </footer>
    );
  }

  const buildLink = (segment: string): string => {
    const base = `/${org}/${team}/local/${refType}/${refName}`;
    return segment ? `${base}/${segment}` : base;
  };

  const handleClick = (segment: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    navigate(buildLink(segment));
  };

  return (
    <footer className="flex h-8 items-center gap-4 border-t border-gray-200 bg-white px-4 text-xs text-gray-500 overflow-x-auto whitespace-nowrap">
      <span className="font-medium text-gray-700">
        {org}/{team}
      </span>
      <span className="hidden text-gray-300 sm:inline">|</span>
      <button type="button" onClick={handleClick("index-stats")} className="hover:text-dfrntBlue-600 hover:underline">
        Documents:{" "}
        <span className="font-data font-medium text-gray-700">
          {documentCount !== null ? documentCount.toLocaleString() : "—"}
        </span>
      </button>
      <button type="button" onClick={handleClick("index-stats")} className="hidden hover:text-dfrntBlue-600 hover:underline sm:inline">
        Indexed:{" "}
        <span className="font-data font-medium text-gray-700">
          {indexStatus?.engine?.searchable_documents != null ? indexStatus.engine.searchable_documents.toLocaleString() : "—"}
        </span>
      </button>
      <span className="hidden text-gray-300 sm:inline">|</span>
      <button type="button" onClick={handleClick("doctypes")} className="hidden hover:text-dfrntBlue-600 hover:underline sm:inline">
        Types: <span className="font-data font-medium">{docTypes.length > 0 ? docTypes.length : "—"}</span>
      </button>
      <button type="button" onClick={handleClick("documents")} className="hidden hover:text-dfrntBlue-600 hover:underline md:inline">
        Documents
      </button>
      <button type="button" onClick={handleClick("raw")} className="hidden hover:text-dfrntBlue-600 hover:underline md:inline">
        Raw JSON
      </button>
    </footer>
  );
};
