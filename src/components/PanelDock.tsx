import React, { useState, useEffect } from "react";

export interface PanelSection {
  readonly id: string;
  readonly title: string;
  readonly icon: React.ReactNode;
  readonly badge?: string | number;
  readonly content: React.ReactNode;
}

export interface PanelDockProps {
  readonly sections: ReadonlyArray<PanelSection>;
  readonly side?: "left" | "right";
  readonly defaultActiveId?: string;
}

export const PanelDock: React.FC<PanelDockProps> = ({
  sections,
  side = "right",
  defaultActiveId,
}) => {
  const [activeId, setActiveId] = useState<string | null>(
    defaultActiveId ?? sections[0]?.id ?? null,
  );
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (defaultActiveId) {
      setActiveId(defaultActiveId);
    }
  }, [defaultActiveId]);

  const activeSection = sections.find((s) => s.id === activeId) ?? null;
  const borderSide = side === "right" ? "border-l" : "border-r";
  const iconBarOrder = side === "right" ? "flex-row" : "flex-row-reverse";

  const iconBar = (
    <div
      className={`flex ${collapsed ? "flex-col" : iconBarOrder} items-center gap-0.5 border-b border-gray-100 px-1 py-1`}
    >
      {sections.map((s) => {
        const isActive = s.id === activeId && !collapsed;
        return (
          <button
            key={s.id}
            type="button"
            title={s.title}
            onClick={() => {
              if (isActive) {
                setCollapsed(true);
              } else {
                setActiveId(s.id);
                setCollapsed(false);
              }
            }}
            className={`relative flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
              isActive
                ? "bg-dfrntBlue-50 text-dfrntBlue-700"
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
            }`}
          >
            {s.icon}
            {s.badge !== undefined && s.badge !== 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-dfrntBlue-500 px-1 text-[9px] font-bold text-white">
                {s.badge}
              </span>
            )}
          </button>
        );
      })}
      <button
        type="button"
        title={collapsed ? "Expand panel" : "Collapse panel"}
        onClick={() => setCollapsed((v) => !v)}
        className={`${collapsed ? "" : "ml-auto"} flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600`}
      >
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
        >
          {side === "right" ? (
            collapsed ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5l7 7-7 7"
              />
            )
          ) : collapsed ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5"
            />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />
          )}
        </svg>
      </button>
    </div>
  );

  const panelContent = activeSection && !collapsed && (
    <div
      className="flex flex-col overflow-hidden"
      style={{ maxHeight: "calc(100vh - 3.5rem - 2rem)" }}
    >
      <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {activeSection.title}
        </span>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="text-gray-400 hover:text-gray-600"
          title="Collapse"
        >
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
          >
            {side === "right" ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5l7 7-7 7"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19l-7-7 7-7"
              />
            )}
          </svg>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">{activeSection.content}</div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger — hidden on desktop */}
      {!mobileOpen && (
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className={`fixed top-2 z-40 flex h-9 w-9 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 shadow-sm md:hidden ${
            side === "right" ? "right-2" : "left-2"
          }`}
          aria-label="Open panels"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5"
            />
          </svg>
        </button>
      )}

      {/* Mobile slide-out drawer */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <div
            className={`fixed top-0 z-50 flex h-full w-72 flex-col bg-white shadow-lg md:hidden ${
              side === "right" ? "right-0" : "left-0"
            }`}
          >
            {/* Mobile top icon bar */}
            <div className="flex items-center gap-0.5 border-b border-gray-200 px-1 py-1">
              {sections.map((s) => {
                const isActive = s.id === activeId;
                return (
                  <button
                    key={s.id}
                    type="button"
                    title={s.title}
                    onClick={() => setActiveId(s.id)}
                    className={`relative flex h-9 w-9 items-center justify-center rounded-md transition-colors ${
                      isActive
                        ? "bg-dfrntBlue-50 text-dfrntBlue-700"
                        : "text-gray-500 hover:bg-gray-100"
                    }`}
                  >
                    {s.icon}
                    {s.badge !== undefined && s.badge !== 0 && (
                      <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-dfrntBlue-500 px-1 text-[9px] font-bold text-white">
                        {s.badge}
                      </span>
                    )}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="ml-auto flex h-9 w-9 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100"
                aria-label="Close panels"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            {/* Mobile panel content */}
            {activeSection && (
              <div className="flex-1 overflow-y-auto">{activeSection.content}</div>
            )}
          </div>
        </>
      )}

      {/* Desktop panel dock */}
      <div
        className={`hidden shrink-0 flex-col ${borderSide} border-gray-200 bg-white md:flex ${
          collapsed ? "w-10" : "w-72"
        }`}
      >
        {iconBar}
        {panelContent}
      </div>
    </>
  );
};
