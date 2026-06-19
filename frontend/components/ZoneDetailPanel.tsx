'use client';

import React from "react";
import { ZoneFeature } from "../lib/types";

interface ZoneDetailPanelProps {
  selectedZone: ZoneFeature | null;
  onDeploy: (zoneId: string) => void;
  onDismiss: () => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

export default function ZoneDetailPanel({
  selectedZone,
  onDeploy,
  onDismiss,
  isExpanded,
  onToggleExpand,
}: ZoneDetailPanelProps) {
  if (!selectedZone) return null;

  const props = selectedZone.properties;
  const score = props.priority_score;
  const likelihood = Math.min(score * 10, 100);

  // Set colors based on priority score
  const isHigh = score >= 7.0;
  const isMed = score >= 4.0 && score < 7.0;

  const tierLabel = isHigh ? "HIGH" : isMed ? "MEDIUM" : "LOW";
  const badgeClass = isHigh
    ? "bg-error text-on-error"
    : isMed
    ? "bg-secondary-container text-black"
    : "bg-tertiary-fixed-dim text-black";

  // Provide a backup Gemini AI brief if the server hasn't cached one yet
  const defaultBrief = `Anomalous violation density detected in ${
    props.police_station
  } sector. Predictive modeling indicates a ${likelihood.toFixed(
    0
  )}% likelihood of traffic/parking violations during peak hours around ${
    props.peak_hour
  }. Hotspot density is driven by a repeat count of ${
    props.violation_count
  } historical offenses and a spatial junction correlation ratio of ${
    props.junction_ratio
  }. Recommendation: Deploy immediate enforcement patrol to coordinate deterrence.`;

  const brief = props.enforcement_brief || defaultBrief;

  return (
    <div
      className={`absolute bottom-0 left-0 right-0 bg-surface-container border-t border-primary-fixed-dim z-30 transform transition-transform duration-500 ${
        isExpanded ? "translate-y-0" : "translate-y-[calc(100%-36px)]"
      }`}
      id="zone-detail"
    >
      {/* Mini Header / Toggle bar */}
      <div
        onClick={onToggleExpand}
        className="h-9 px-4 bg-surface-container-high border-b border-outline-variant flex justify-between items-center cursor-pointer select-none"
      >
        <span className="text-[10px] text-primary-fixed-dim font-mono tracking-widest uppercase flex items-center">
          <span className="material-symbols-outlined text-xs mr-2">
            {isExpanded ? "keyboard_arrow_down" : "keyboard_arrow_up"}
          </span>
          {isExpanded ? "HIDE_DETAIL_PANEL" : "SHOW_DETAIL_PANEL"}
        </span>
        <span className="text-[9px] text-on-surface-variant font-mono opacity-50">
          [ PRESS 'Z' TO TOGGLE ]
        </span>
      </div>

      <div className="flex flex-col md:flex-row h-52 md:h-44">
        {/* Left Side: Metadata */}
        <div className="w-full md:w-1/4 p-4 border-r border-outline-variant flex flex-col justify-between">
          <div>
            <div className="text-[9px] text-on-surface-variant mb-1 font-mono">
              [ FIG. {props.zone_id.replace("cluster_", "") || "00"} ]
            </div>
            <h2 className="font-mono text-lg font-bold text-primary-fixed-dim leading-none uppercase">
              {props.zone_id}
            </h2>
            <p className="text-[10px] text-on-surface-variant mt-1 font-mono uppercase">
              SECTOR_{props.police_station.replace(/\s+/g, "_")}
            </p>
          </div>
          <div className="flex gap-2 mt-2 md:mt-0 font-mono">
            <span className={`${badgeClass} px-2 py-0.5 text-[9px] font-bold`}>
              RISK TIER: {tierLabel}
            </span>
            <span className="border border-primary-fixed-dim text-primary-fixed-dim px-2 py-0.5 text-[9px] font-bold">
              {likelihood.toFixed(0)}% LIKELIHOOD
            </span>
          </div>
        </div>

        {/* Right Side: AI Briefing and Actions */}
        <div className="flex-1 p-4 flex flex-col justify-between relative overflow-hidden">
          <div>
            <div className="text-[10px] text-primary-fixed-dim mb-1.5 uppercase tracking-widest flex items-center font-mono font-bold">
              <span className="material-symbols-outlined text-xs mr-1 text-primary-fixed-dim">
                bolt
              </span>
              Gemini AI Enforcement Brief
            </div>
            <div className="text-xs text-on-surface-variant leading-relaxed terminal-scroll overflow-y-auto h-16 pr-4 font-mono">
              {brief}
            </div>
          </div>

          <div className="flex gap-4 mt-2">
            <button
              onClick={() => onDeploy(props.zone_id)}
              className="bg-primary-container text-on-primary-container px-6 py-1 font-bold text-xs font-mono uppercase hover:opacity-85 active:scale-95 transition-all"
            >
              DEPLOY_UNIT
            </button>
            <button
              onClick={onDismiss}
              className="border border-outline-variant text-on-surface-variant px-6 py-1 font-bold text-xs font-mono uppercase hover:bg-surface-container-high active:scale-95 transition-all"
            >
              DISMISS
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
