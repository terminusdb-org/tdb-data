import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppDispatch, useAppSelector, clearError } from "@/store";
import type { ErrorInfo } from "@/store";

export const ErrorBanner: React.FC = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const error: ErrorInfo | null = useAppSelector((state) => state.error.latestError);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (error) {
      setVisible(true);
    }
  }, [error]);

  if (!error || !visible) {
    return null;
  }

  const handleDismiss = () => {
    setVisible(false);
    dispatch(clearError());
  };

  return (
    <div className="border-t border-red-200 bg-red-50 px-4 py-3">
      <div className="flex items-start gap-3">
        <svg
          className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500"
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
            clipRule="evenodd"
          />
        </svg>
        <div className="flex-1">
          <p className="text-sm font-medium text-red-800">
            {error.message}
            {error.statusCode && (
              <span className="ml-2 rounded bg-red-200 px-1.5 py-0.5 text-xs font-mono text-red-700">
                {error.statusCode}
              </span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded p-1 text-red-400 hover:bg-red-100 hover:text-red-600"
          aria-label={t("errorBanner.dismissError")}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};
