import React, { useState, useEffect, useCallback } from "react";

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
  readonly defaultActiveIds?: ReadonlyArray<string>;
}

export const PanelDock: React.FC<PanelDockProps> = ({
  sections,
  side = "right",
  defaultActiveIds,
}) => {
  const [activePanelIds, setActivePanelIds] = useState<string[]>(
    defaultActiveIds ? [...defaultActiveIds] : [],
  );
  const [focusedPanelId, setFocusedPanelId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (defaultActiveIds && defaultActiveIds.length > 0) {
      setActivePanelIds([...defaultActiveIds]);
      setFocusedPanelId(defaultActiveIds[0] ?? null);
    }
  }, [defaultActiveIds]);

  const togglePanel = useCallback((id: string) => {
    setActivePanelIds((prev) => {
      const idx = prev.indexOf(id);
      if (idx < 0) {
        setFocusedPanelId(id);
        return [...prev, id];
      }
      if (idx === prev.length - 1) {
        setFocusedPanelId((f) => (f === id ? null : f));
        return prev.filter((p) => p !== id);
      }
      const next = prev.filter((p) => p !== id);
      next.push(id);
      setFocusedPanelId(id);
      return next;
    });
  }, []);

  const activeSections = activePanelIds
    .map((id) => sections.find((s) => s.id === id))
    .filter((s): s is PanelSection => s !== undefined);

  const borderSide = side === "right" ? "border-l" : "border-r";
  const iconBarOrder = side === "right" ? "flex-row" : "flex-row-reverse";

  const iconBar = (
    <div
      className={`flex ${collapsed ? "flex-col" : iconBarOrder} items-center gap-0.5 border-b border-gray-100 px-1 py-1`}
    >
      {sections.map((s) => {
        const isActive = activePanelIds.includes(s.id) && !collapsed;
        const isFocused = s.id === focusedPanelId && !collapsed;
        return (
          <button
            key={s.id}
            type="button"
            title={s.title}
            aria-label={s.title}
            onClick={() => {
              if (collapsed) {
                setCollapsed(false);
              }
              togglePanel(s.id);
            }}
            className={`relative flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
              isActive
                ? isFocused
                  ? "bg-dfrntBlue-100 text-dfrntBlue-700 ring-1 ring-dfrntBlue-300"
                  : "bg-dfrntBlue-50 text-dfrntBlue-700"
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
        aria-label={collapsed ? "Expand panel" : "Collapse panel"}
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

  const panelContent = !collapsed && activeSections.length > 0 && (
    <div
      className="flex flex-col overflow-y-auto"
      style={{ maxHeight: "calc(100vh - 3.5rem - 2rem)" }}
    >
      {activeSections.map((section) => {
        const isFocused = section.id === focusedPanelId;
        return (
          <div key={section.id} className="flex flex-col border-b border-gray-100">
            <div className="flex items-center justify-between px-3 py-2">
              <button
                type="button"
                onClick={() => setFocusedPanelId(isFocused ? null : section.id)}
                className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 hover:text-gray-700"
              >
                <svg
                  className={`h-3 w-3 transition-transform ${isFocused ? "rotate-90" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                {section.title}
                {section.badge !== undefined && section.badge !== 0 && (
                  <span className="ml-1 rounded-full bg-dfrntBlue-100 px-1.5 py-0.5 text-[9px] font-bold text-dfrntBlue-700">
                    {section.badge}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => togglePanel(section.id)}
                aria-label={`Close ${section.title} panel`}
                className="text-gray-300 hover:text-gray-500"
                title="Remove panel"
              >
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {isFocused ? (
              <div className="flex-1 overflow-y-auto" style={{ maxHeight: "calc(100vh - 8rem)" }}>
                {section.content}
              </div>
            ) : (
              <div className="max-h-32 overflow-y-auto">{section.content}</div>
            )}
          </div>
        );
      })}
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
            onKeyDown={(e) => { if (e.key === "Escape") setMobileOpen(false); }}
            role="button"
            tabIndex={0}
            aria-label="Close panel"
          />
          <div
            className={`fixed top-0 z-50 flex h-full w-72 flex-col bg-white shadow-lg md:hidden ${
              side === "right" ? "right-0" : "left-0"
            }`}
          >
            {/* Mobile top icon bar */}
            <div className="flex items-center gap-0.5 border-b border-gray-200 px-1 py-1">
              {sections.map((s) => {
                const isActive = activePanelIds.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    title={s.title}
                    onClick={() => togglePanel(s.id)}
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
                aria-label="Close panels"
                className="ml-auto flex h-9 w-9 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100"
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
            {/* Mobile panel content — stacked */}
            <div className="flex-1 overflow-y-auto">
              {activeSections.map((section) => (
                <div key={section.id} className="border-b border-gray-100">
                  <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {section.title}
                  </div>
                  <div>{section.content}</div>
                </div>
              ))}
            </div>
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
