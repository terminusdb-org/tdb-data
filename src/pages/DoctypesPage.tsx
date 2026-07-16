import React from "react";
import { useTranslation } from "react-i18next";
import { useGetSchemaQuery } from "@/store";
import { DoctypeTree, PageShell, PageHeader, PagePlaceholder, useRouteParams } from "@/components";
import { buildApiPath } from "@/utils/routes";

export const DoctypesPage: React.FC = () => {
  const { t } = useTranslation();
  const routeParams = useRouteParams();

  const schemaPath = routeParams ? buildApiPath(routeParams, "schema") : "";
  const { data: classes, isLoading, error } = useGetSchemaQuery(
    { path: schemaPath, asList: true },
    { skip: !routeParams }
  );

  if (!routeParams) return <PagePlaceholder>{t("common.selectDataProduct")}</PagePlaceholder>;
  if (isLoading) return <PagePlaceholder>{t("doctypes.loadingSchema")}</PagePlaceholder>;
  if (error) return <PagePlaceholder error>{t("doctypes.failedToLoad")}</PagePlaceholder>;

  return (
    <PageShell
      header={
        <PageHeader>
          <h2 className="text-lg font-semibold text-gray-900">{t("doctypes.title")}</h2>
          <p className="mt-0.5 text-sm text-gray-500">{t("doctypes.subtitle")}</p>
        </PageHeader>
      }
    >
      {classes && classes.length > 0 ? (
        <DoctypeTree classes={classes} />
      ) : (
        <PagePlaceholder>{t("doctypes.noDocTypes")}</PagePlaceholder>
      )}
    </PageShell>
  );
};
