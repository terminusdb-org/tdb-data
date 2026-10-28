import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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

  const productHref = (path: string, branch: string) => `/${path}/local/branch/${branch}`;
  // tdb-admin mounts alongside this app (/app/data → /app/admin)
  const adminHref = (path: string) =>
    `${config.basePath.replace(/\/[^/]*$/, "")}/admin/data-products/${path.split("/").map(encodeURIComponent).join("/")}/branches`;

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
                  <Link
                    to={productHref(db.path, "main")}
                    className="font-data text-sm font-semibold text-white underline decoration-white/30 underline-offset-2 transition-colors hover:text-dfrntBlue-300 hover:decoration-dfrntBlue-300"
                  >
                    {db.path}
                  </Link>
                  <a
                    href={adminHref(db.path)}
                    className="ml-auto text-dfrntBlue-300 transition-colors hover:text-white"
                    title={t("dataProductPicker.adminSettings")}
                    aria-label={`${t("dataProductPicker.adminSettings")}: ${db.path}`}
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </a>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {branches.map((br) => (
                    <Link
                      key={br}
                      to={productHref(db.path, br)}
                      className="rounded-md bg-dfrntBlue-600/40 px-2.5 py-1 text-xs font-medium text-dfrntBlue-100 transition-colors hover:bg-dfrntBlue-500/60"
                    >
                      {br}
                    </Link>
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
