import React from "react";
import { useRouteParams, SearchBar } from "@/components";

export const MainPage: React.FC = () => {
  const routeParams = useRouteParams();
  const hasContext = !!routeParams;

  return (
    <div className="flex h-full flex-col px-6 py-8">
      <div className="w-full">
        <h1 className="mb-4 text-center text-2xl font-bold text-gray-900">
          {hasContext
            ? `${routeParams!.org}/${routeParams!.team}`
            : "Data Explorer"}
        </h1>
        <p className="mb-6 text-center text-sm text-gray-500">
          {hasContext
            ? `Search documents in ${routeParams!.refType === "branch" ? `branch "${routeParams!.refName}"` : `commit "${routeParams!.refName}"`}`
            : "Select a data product from the sidebar or navigate to a data product URL"}
        </p>
        <SearchBar />
      </div>
    </div>
  );
};
