'use client';

import React from "react";
import { Stats } from "../lib/types";

interface StatsBarProps {
  stats: Stats | null;
}

export default function StatsBar({ stats }: StatsBarProps) {
  const displayStats = stats || {
    total_violations: 0,
    total_zones: 0,
    top_station: "N/A",
    peak_hour: "N/A",
    avg_risk_score: 0.0,
  };

  return (
    <div className="bg-surface-container border-b border-outline-variant px-6 py-2.5 flex flex-wrap gap-6 items-center justify-between text-primary font-mono text-[10px] tracking-wider uppercase z-30">
      <div className="flex items-center gap-2">
        <span className="text-on-surface-variant font-bold">TOTAL_VIOLATIONS:</span>
        <span className="text-primary-fixed-dim font-bold bg-surface-container-high px-2 py-0.5 border border-outline-variant">
          {displayStats.total_violations.toLocaleString()}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-on-surface-variant font-bold">TOTAL_HOTSPOTS:</span>
        <span className="text-error font-bold bg-surface-container-high px-2 py-0.5 border border-outline-variant">
          {displayStats.total_zones}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-on-surface-variant font-bold">PEAK_HOUR:</span>
        <span className="text-secondary-container font-bold bg-surface-container-high px-2 py-0.5 border border-outline-variant">
          {displayStats.peak_hour}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-on-surface-variant font-bold">PEAK_STATION:</span>
        <span className="text-primary font-bold bg-surface-container-high px-2 py-0.5 border border-outline-variant max-w-37.5 truncate">
          {displayStats.top_station}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-on-surface-variant font-bold">AVG_RISK_SCORE:</span>
        <span className="text-tertiary-fixed-dim font-bold bg-surface-container-high px-2 py-0.5 border border-outline-variant">
          {displayStats.avg_risk_score.toFixed(2)}/10
        </span>
      </div>
    </div>
  );
}
