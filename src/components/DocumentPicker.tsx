import React, { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useSuggestQuery } from "@/store";
import type { SuggestResponse } from "@/types/terminusdb";

interface DocumentPickerProps {
  readonly suggestPath: string;
  readonly value: string;
  readonly onChange: (id: string) => void;
  readonly placeholder?: string;
  readonly label?: string;
}

export const DocumentPicker: React.FC<DocumentPickerProps> = ({
  suggestPath,
  value,
  onChange,
  placeholder,
  label,
}) => {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState(value);
  const [debounced, setDebounced] = useState(value);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(inputValue), 200);
    return () => clearTimeout(timer);
  }, [inputValue]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const { data: suggestData, isFetching } = useSuggestQuery(
    { path: suggestPath, query: debounced, count: 10 },
    { skip: debounced.length < 2 }
  );

  const suggest: SuggestResponse | undefined = suggestData;
  const completions = suggest?.completions ?? [];
  const hits = suggest?.hits ?? [];

  const allItems = [
    ...completions.map((c) => ({ type: "completion" as const, value: c, id: c })),
    ...hits.map((h) => ({ type: "hit" as const, value: h.id, id: h.id, distance: h.distance })),
  ];

  useEffect(() => {
    setActiveIndex(-1);
  }, [debounced]);

  const handleSelect = useCallback((item: { type: string; value: string; id: string }) => {
    if (item.type === "completion") {
      setInputValue(item.value);
      setShowDropdown(true);
    } else {
      setInputValue(item.id);
      onChange(item.id);
      setShowDropdown(false);
    }
  }, [onChange]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && activeIndex < 0 && inputValue.trim()) {
      const matchedHit = hits.find((h) => h.id === inputValue.trim());
      if (matchedHit) {
        e.preventDefault();
        onChange(matchedHit.id);
        setShowDropdown(false);
      }
      return;
    }
    if (!showDropdown || allItems.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, allItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      handleSelect(allItems[activeIndex]);
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  const selectedType = hits.find((h) => h.id === inputValue)?.doc_type;

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className="mb-1 block text-xs font-medium text-gray-500">{label}</label>
      )}
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
          fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => { setInputValue(e.target.value); setShowDropdown(true); }}
          onFocus={() => setShowDropdown(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? t("documentPicker.placeholder")}
          className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm font-data text-gray-900 placeholder-gray-400 focus:border-dfrntBlue-400 focus:ring-2 focus:ring-dfrntBlue-100"
        />
        {isFetching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <svg className="h-4 w-4 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}
      </div>

      {selectedType && !showDropdown && (
        <div className="mt-1">
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
            {selectedType}
          </span>
        </div>
      )}

      {showDropdown && allItems.length > 0 && (
        <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {completions.map((c, i) => (
            <div
              key={`c-${i}`}
              className={`cursor-pointer px-3 py-2 text-sm ${i === activeIndex ? "bg-dfrntBlue-50" : "hover:bg-gray-50"}`}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(allItems[i]); }}
              role="option"
              aria-selected={i === activeIndex}
              tabIndex={0}
            >
              <span className="font-medium text-gray-900">{c}</span>
              <span className="ml-2 text-xs text-gray-400">{t("common.completion")}</span>
            </div>
          ))}
          {hits.map((h, i) => {
            const idx = completions.length + i;
            return (
              <div
                key={`h-${h.id}`}
                className={`cursor-pointer px-3 py-2 text-sm ${idx === activeIndex ? "bg-dfrntBlue-50" : "hover:bg-gray-50"}`}
                onMouseDown={(e) => { e.preventDefault(); handleSelect(allItems[idx]); }}
                role="option"
                aria-selected={idx === activeIndex}
                tabIndex={0}
              >
                <span className="font-data font-medium text-gray-900">{h.id}</span>
                <span className="ml-2 text-xs text-gray-400">{h.doc_type ?? t("common.doc")}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
