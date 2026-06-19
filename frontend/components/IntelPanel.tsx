'use client';

import React from "react";
import { ZoneFeature } from "../lib/types";

interface IntelPanelProps {
  zones: ZoneFeature[];
  selectedZoneId: string | null;
  onSelectZone: (zoneId: string) => void;
  logs: string[];
}

export default function IntelPanel({
  zones,
  selectedZoneId,
  onSelectZone,
  logs,
}: IntelPanelProps) {
  // Sort zones by priority score descending
  const sortedZones = [...zones].sort(
    (a, b) => b.properties.priority_score - a.properties.priority_score
  );

  // Compute total violations
  const totalViolations = zones.reduce(
    (acc, z) => acc + (z.properties.violation_count || 0),
    0
  );

  // Hardcode relative ratio for custom pie chart visual
  const civilPercent = 45;
  const trafficPercent = 35;
  const dataPercent = 20;

  return (
    <section className="w-full lg:w-[35%] h-full bg-surface-container flex flex-col overflow-y-auto border-l border-outline-variant terminal-scroll">
      {/* Top Zones Panel */}
      <div className="p-4 border-b border-outline-variant">
        <div className="flex justify-between items-center mb-4">
          <span className="text-[11px] font-bold text-on-surface-variant tracking-wider font-mono">
            [ FIG. 01 ] TOP_ZONES
          </span>
          <span className="material-symbols-outlined text-primary-fixed-dim text-sm cursor-pointer hover:rotate-90 transition-transform">
            sync
          </span>
        </div>
        <div className="space-y-1">
          {sortedZones.slice(0, 5).map((zone, idx) => {
            const zId = zone.properties.zone_id;
            const score = zone.properties.priority_score;
            const pct = Math.min(score * 10, 100);
            const isSelected = selectedZoneId === zId;

            // Tier color mapping
            const textColor =
              score >= 7.0
                ? "text-error"
                : score >= 4.0
                ? "text-secondary-container"
                : "text-tertiary-fixed-dim";

            const barBg =
              score >= 7.0
                ? "bg-error"
                : score >= 4.0
                ? "bg-secondary-container"
                : "bg-tertiary-fixed-dim";

            return (
              <div
                key={zId}
                onClick={() => onSelectZone(zId)}
                className={`flex items-center justify-between p-2 bg-surface-container-lowest border transition-colors cursor-pointer ${
                  isSelected
                    ? "border-primary-fixed-dim bg-surface-container-high/40"
                    : "border-outline-variant hover:border-primary-fixed-dim/70"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`${textColor} font-bold text-xs`}>
                    {(idx + 1).toString().padStart(2, "0")}
                  </span>
                  <span className="text-xs font-mono tracking-wider">{zId.toUpperCase()}</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-1.5 bg-outline-variant overflow-hidden">
                    <div className={`h-full ${barBg}`} style={{ width: `${pct}%` }}></div>
                  </div>
                  <span className={`text-[11px] font-mono w-8 text-right ${textColor}`}>
                    {pct.toFixed(0)}%
                  </span>
                </div>
              </div>
            );
          })}
          {sortedZones.length === 0 && (
            <div className="text-center py-4 text-xs text-on-surface-variant/55 font-mono">
              [ NO_HOTSPOTS_DETECTED ]
            </div>
          )}
        </div>
      </div>

      {/* Violation Breakdown Panel */}
      <div className="p-4 border-b border-outline-variant min-h-65 flex flex-col justify-between">
        <div className="text-[11px] font-bold text-on-surface-variant tracking-wider font-mono mb-2">
          [ FIG. 02 ] VIOLATION_BREAKDOWN
        </div>
        <div className="flex flex-row items-center justify-around py-2">
          {/* Custom SVG Pie Chart matching Stitch Hacker-Noir Spec */}
          <div className="relative w-32 h-32 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 32 32">
              <circle
                cx="16"
                cy="16"
                r="14"
                fill="transparent"
                stroke="#1A2634"
                strokeWidth="4"
              />
              {/* Civil - Red (45%) */}
              <circle
                cx="16"
                cy="16"
                r="14"
                fill="transparent"
                stroke="#ffb4ab"
                strokeWidth="4"
                strokeDasharray={`${civilPercent} 100`}
                strokeDashoffset="0"
              />
              {/* Traffic - Cyan (35%) */}
              <circle
                cx="16"
                cy="16"
                r="14"
                fill="transparent"
                stroke="#00dbe9"
                strokeWidth="4"
                strokeDasharray={`${trafficPercent} 100`}
                strokeDashoffset={`-${civilPercent}`}
              />
              {/* Data - Lime (20%) */}
              <circle
                cx="16"
                cy="16"
                r="14"
                fill="transparent"
                stroke="#8fdb00"
                strokeWidth="4"
                strokeDasharray={`${dataPercent} 100`}
                strokeDashoffset={`-${civilPercent + trafficPercent}`}
              />
            </svg>
            <div className="absolute text-center bg-surface-container rounded-full w-24 h-24 flex flex-col items-center justify-center border border-outline-variant">
              <div className="text-sm font-bold text-primary-fixed-dim leading-none">
                {totalViolations.toLocaleString()}
              </div>
              <div className="text-[8px] text-on-surface-variant opacity-75 mt-1">
                TOTAL_EVENTS
              </div>
            </div>
          </div>
          <div className="space-y-1.5 font-mono text-[9px] uppercase">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-error block"></span>
              <span className="text-on-surface-variant">CIVIL ({civilPercent}%)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-primary-fixed-dim block"></span>
              <span className="text-on-surface-variant">TRAFFIC ({trafficPercent}%)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-tertiary-fixed-dim block"></span>
              <span className="text-on-surface-variant">DATA ({dataPercent}%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* SHAP Feature Importance */}
      <div className="p-4 border-b border-outline-variant">
        <div className="flex justify-between items-center mb-3">
          <span className="text-[11px] font-bold text-on-surface-variant tracking-wider font-mono">
            [ FIG. 03 ] SHAP_IMPORTANCE
          </span>
          <span className="text-[9px] text-primary-fixed-dim font-mono">MODEL_v2.1</span>
        </div>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-[10px] mb-1 font-mono">
              <span className="uppercase text-on-surface-variant">Signal Variance (Spatial)</span>
              <span className="text-primary-fixed-dim font-bold">+0.42</span>
            </div>
            <div className="h-1 bg-outline-variant">
              <div className="h-full bg-primary-fixed-dim" style={{ width: "85%" }}></div>
            </div>
          </div>
          <div>
            <div className="flex justify-between text-[10px] mb-1 font-mono">
              <span className="uppercase text-on-surface-variant">Node Density (DBSCAN)</span>
              <span className="text-primary-fixed-dim font-bold">+0.28</span>
            </div>
            <div className="h-1 bg-outline-variant">
              <div className="h-full bg-primary-fixed-dim" style={{ width: "62%" }}></div>
            </div>
          </div>
          <div>
            <div className="flex justify-between text-[10px] mb-1 font-mono">
              <span className="uppercase text-on-surface-variant">History Echo (Temporal)</span>
              <span className="text-primary-fixed-dim font-bold">+0.15</span>
            </div>
            <div className="h-1 bg-outline-variant">
              <div className="h-full bg-primary-fixed-dim" style={{ width: "35%" }}></div>
            </div>
          </div>
        </div>
      </div>

      {/* Terminal Log Stream */}
      <div className="p-4 flex-1">
        <div className="p-3 border border-dotted border-outline-variant bg-surface-container-lowest max-h-48 overflow-y-auto terminal-scroll">
          <div className="text-[10px] text-on-surface-variant font-mono space-y-1">
            {logs.map((log, index) => (
              <div key={index} className="leading-tight">
                {log}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
