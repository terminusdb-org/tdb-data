import React from "react";

export function highlightTerms(text: string, query: string): React.ReactNode[] {
  if (!query.trim()) return [text];
  const terms = query
    .trim()
    .split(/\s+/)
    .filter((t) => t.length >= 2)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (terms.length === 0) return [text];
  const regex = new RegExp(`(${terms.join("|")})`, "gi");
  const parts = text.split(regex);
  return parts.map((part, i) => {
    if (i % 2 === 1) {
      return (
        <mark key={i} className="rounded bg-yellow-100 px-0.5 text-gray-900">
          {part}
        </mark>
      );
    }
    return part;
  });
}
