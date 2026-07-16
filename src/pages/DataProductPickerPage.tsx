import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useGetDatabasesQuery, useAppSelector, useAppDispatch, logout } from "@/store";
import { config } from "@/config";

export const DataProductPickerPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const username = useAppSelector((state) => state.auth.username);
  const { data: databases, isLoading, error } = useGetDatabasesQuery({ branches: true });
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!databases) return [];
    const lower = search.toLowerCase();
    return databases
      .filter((db) => db.path.toLowerCase().includes(lower))
      .sort((a, b) => a.path.localeCompare(b.path));
  }, [databases, search]);

  const handleSelect = (path: string, branch: string) => {
    const [org, team] = path.split("/");
    if (!org || !team) return;
    navigate(`/${org}/${team}/local/branch/${branch}`);
  };

  const handleLogout = () => {
    dispatch(logout());
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-dfrntBlue-900">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="font-headline text-2xl font-bold text-white">{t("dataProductPicker.title")}</h1>
            <p className="mt-1 text-sm text-dfrntBlue-200">
              {t("dataProductPicker.signedInAs")} <span className="font-data text-dfrntBlue-100">{username}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-md border border-white/20 bg-white/5 px-3 py-1.5 text-sm font-medium text-dfrntBlue-100 transition-colors hover:bg-white/10"
          >
            {t("dataProductPicker.signOut")}
          </button>
        </div>

        <div className="mb-6">
          <input
            type="text"
            placeholder={t("dataProductPicker.placeholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="block w-full rounded-lg border-white/20 bg-white/10 text-white placeholder-dfrntBlue-300 shadow-sm focus:border-dfrntBlue-400 focus:ring-dfrntBlue-400 sm:text-sm"
          />
        </div>

        {isLoading && (
          <div className="py-12 text-center text-sm text-dfrntBlue-200">{t("dataProductPicker.loading")}</div>
        )}

        {error && (
          <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {t("dataProductPicker.loadFailed")}{" "}
            <span className="font-data">{config.apiUrl || t("common.sameOrigin")}</span>.
          </div>
        )}

        {!isLoading && !error && filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-dfrntBlue-200">
            {t("dataProductPicker.noProducts")}{search ? ` ${t("dataProductPicker.matching")} "${search}"` : ""}.
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((db) => {
            const branches = db.branches ?? ["main"];
            return (
              <div
                key={db.path}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-4 shadow-lg backdrop-blur-sm transition-colors hover:bg-white/[0.06]"
              >
                <div className="mb-2 flex items-center gap-2">
                  <svg
                    className="h-5 w-5 flex-shrink-0 text-dfrntBlue-400"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375" />
                  </svg>
                  <h3 className="font-data text-sm font-semibold text-white">{db.path}</h3>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {branches.map((br) => (
                    <button
                      key={br}
                      type="button"
                      onClick={() => handleSelect(db.path, br)}
                      className="rounded-md bg-dfrntBlue-600/40 px-2.5 py-1 text-xs font-medium text-dfrntBlue-100 transition-colors hover:bg-dfrntBlue-500/60"
                    >
                      {br}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
