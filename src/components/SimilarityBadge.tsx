import React from "react";
import { distanceToPercent } from "@/utils/similarity";

interface SimilarityBadgeProps {
  readonly distance: number;
  readonly size?: "sm" | "lg";
}

export const SimilarityBadge: React.FC<SimilarityBadgeProps> = ({ distance, size = "sm" }) => {
  const pct = distanceToPercent(distance);
  const barWidth = size === "lg" ? "w-20" : "w-10";
  const barHeight = size === "lg" ? "h-2" : "h-1.5";
  const color =
    pct >= 80 ? "bg-green-500" : pct >= 60 ? "bg-yellow-500" : "bg-gray-400";

  return (
    <div className="flex items-center gap-1.5" title={`Distance: ${distance.toFixed(4)}`}>
      <div className={`${barWidth} ${barHeight} rounded-full bg-gray-200 overflow-hidden`}>
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        />
      </div>
      <span className="text-xs font-bold tabular-nums text-gray-400">
        {pct}%
      </span>
    </div>
  );
};
