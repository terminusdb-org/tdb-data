import React from "react";

export const btnPrimary =
  "rounded-md bg-dfrntBlue-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-dfrntBlue-400 disabled:cursor-not-allowed disabled:bg-gray-300";

export const btnSecondary =
  "rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50";

export const inputClass =
  "rounded-md border border-gray-300 px-3 py-1.5 text-sm";

export const selectClass =
  "rounded-md border border-gray-300 px-3 py-1.5 text-sm";

export const errorBanner =
  "rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600";

export const PagePlaceholder: React.FC<{ children: React.ReactNode; error?: boolean }> = ({ children, error }) => (
  <div className={`p-8 text-center text-sm ${error ? "text-red-600" : "text-gray-500"}`}>
    {children}
  </div>
);

export const PageHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="border-b border-gray-200 px-4 py-3">{children}</div>
);

export const PageFooter: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex items-center justify-between border-t border-gray-200 px-4 py-2">
    {children}
  </div>
);

export const PageShell: React.FC<{
  header?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}> = ({ header, footer, children }) => (
  <div className="flex h-full flex-col">
    {header}
    <div className="flex-1 overflow-auto">{children}</div>
    {footer}
  </div>
);
