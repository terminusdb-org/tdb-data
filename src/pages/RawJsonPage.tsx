import React from "react";
import { RawJsonList, PagePlaceholder, useRouteParams } from "@/components";

export const RawJsonPage: React.FC = () => {
  const routeParams = useRouteParams();

  if (!routeParams) return <PagePlaceholder>Select a data product first.</PagePlaceholder>;

  return <RawJsonList routeParams={routeParams} />;
};
