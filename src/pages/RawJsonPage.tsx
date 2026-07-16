import React from "react";
import { useTranslation } from "react-i18next";
import { RawJsonList, PagePlaceholder, useRouteParams } from "@/components";

export const RawJsonPage: React.FC = () => {
  const { t } = useTranslation();
  const routeParams = useRouteParams();

  if (!routeParams) return <PagePlaceholder>{t("common.selectDataProduct")}</PagePlaceholder>;

  return <RawJsonList routeParams={routeParams} />;
};
