import React, { useEffect, useRef } from "react";
import ReactDOM from "react-dom/client";
import { useAppSelector } from "@/store";
import { PagePlaceholder, useRouteParams } from "@/components";
import { buildApiPath } from "@/utils/routes";
import { config } from "@/config";
import "graphiql/style.css";

export const GraphQLPage: React.FC = () => {
  const routeParams = useRouteParams();
  const credentials = useAppSelector((state) => state.auth.credentials);
  const containerRef = useRef<HTMLDivElement>(null);

  const graphqlPath = routeParams ? buildApiPath(routeParams, "graphql") : "";
  const graphqlUrl = `${config.apiUrl}${graphqlPath}`;

  useEffect(() => {
    if (!containerRef.current || !routeParams) return;

    let root: ReactDOM.Root | null = null;

    const renderGraphiQL = async () => {
      try {
        const GraphiQL = (await import("graphiql")).default;
        const { createGraphiQLFetcher } = await import("@graphiql/toolkit");

        const fetcher = createGraphiQLFetcher({
          url: graphqlUrl,
          headers: credentials ? { Authorization: `Basic ${credentials}` } : {},
        });

        root = ReactDOM.createRoot(containerRef.current!);
        root.render(React.createElement(GraphiQL, { fetcher }));
      } catch {
        if (containerRef.current) {
          containerRef.current.innerHTML = '<div class="p-8 text-center text-sm text-gray-500">Failed to load GraphiQL. Make sure the package is installed.</div>';
        }
      }
    };

    renderGraphiQL();

    return () => {
      if (root) {
        root.unmount();
      }
    };
  }, [routeParams, graphqlUrl, credentials]);

  if (!routeParams) return <PagePlaceholder>Select a data product first.</PagePlaceholder>;

  return (
    <div className="h-full">
      <div ref={containerRef} className="h-full" />
    </div>
  );
};
