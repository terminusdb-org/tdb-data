import React from "react";
import { useTranslation } from "react-i18next";
import { useRouteParams, SearchBar } from "@/components";

export const MainPage: React.FC = () => {
  const { t } = useTranslation();
  const routeParams = useRouteParams();
  const hasContext = !!routeParams;

  return (
    <div className="flex h-full flex-col px-6 py-8">
      <div className="w-full">
        <h1 className="mb-4 text-center text-2xl font-bold text-gray-900">
          {hasContext
            ? `${routeParams!.org}/${routeParams!.team}`
            : t("mainPage.dataExplorer")}
        </h1>
        <p className="mb-6 text-center text-sm text-gray-500">
          {hasContext
            ? routeParams!.refType === "branch"
              ? t("mainPage.searchInBranch", { name: routeParams!.refName })
              : t("mainPage.searchInCommit", { name: routeParams!.refName })
            : t("mainPage.selectDataProductPrompt")}
        </p>
        <SearchBar />
      </div>
    </div>
  );
};
