import React, { useEffect, useRef } from "react";
import ReactDOM from "react-dom/client";
import { useTranslation } from "react-i18next";
import { useAppSelector } from "@/store";
import { PagePlaceholder, useRouteParams } from "@/components";
import { buildApiPath } from "@/utils/routes";
import { createTdbGraphiQLFetcher } from "@/utils/graphqlFetcher";
import { config } from "@/config";
import "graphiql/style.css";

export const GraphQLPage: React.FC = () => {
  const { t } = useTranslation();
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

        const fetcher = createTdbGraphiQLFetcher({
          url: graphqlUrl,
          headers: credentials ? { Authorization: `Basic ${credentials}` } : {},
        });

        root = ReactDOM.createRoot(containerRef.current!);
        root.render(React.createElement(GraphiQL, { fetcher }));
      } catch (err: unknown) {
        console.error(t("graphql.failedToLoad"), err);
        if (containerRef.current) {
          containerRef.current.innerHTML = `<div class="p-8 text-center text-sm text-gray-500">${t("graphql.loadFailedMsg")}</div>`;
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

  if (!routeParams) return <PagePlaceholder>{t("common.selectDataProduct")}</PagePlaceholder>;

  return (
    <div className="h-full">
      <div ref={containerRef} className="h-full" />
    </div>
  );
};
