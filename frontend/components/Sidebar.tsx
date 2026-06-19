'use client';

import React from "react";
import Link from "next/link";
import { UserSession } from "../lib/types";

interface SidebarProps {
  user: UserSession | null;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onTriggerScan: () => void;
}

export default function Sidebar({
  user,
  activeTab,
  onTabChange,
  onTriggerScan,
}: SidebarProps) {
  const navItems = [
    { id: "dashboard", label: "DASHBOARD", icon: "grid_view" },
    { id: "assets", label: "ASSETS", icon: "visibility" },
    { id: "enforcement", label: "ENFORCEMENT", icon: "gavel" },
    { id: "logs", label: "LOGS", icon: "inventory_2" },
    { id: "system", label: "SYSTEM", icon: "settings" },
  ];

  return (
    <aside className="hidden md:flex flex-col bg-surface-container text-primary-fixed-dim font-mono-data uppercase border-r border-outline-variant h-full w-[280px] py-6 z-40">
      {/* Operator Status */}
      <div className="px-6 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 border border-primary-fixed-dim flex items-center justify-center overflow-hidden">
            {user && user.photo_url ? (
              <img
                src={user.photo_url}
                alt="Profile"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="material-symbols-outlined text-primary-fixed-dim">
                account_circle
              </span>
            )}
          </div>
          <div>
            <div className="text-sm font-bold text-primary-fixed-dim leading-none">
              OP_CENTER
            </div>
            <div className="text-[9px] text-on-surface-variant opacity-70 mt-1">
              {user ? `SECTOR_7G // ${user.uid.slice(0, 8)}` : "SECTOR_7G // OFFLINE"}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full group flex items-center px-6 py-3 text-left font-mono transition-transform active:translate-x-1 ${
                isActive
                  ? "bg-surface-container-highest text-primary border-l-2 border-primary"
                  : "text-on-surface-variant hover:bg-surface-container-high"
              }`}
            >
              <span className="material-symbols-outlined mr-3">{item.icon}</span>
              <span className="text-xs tracking-wider">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Bottom Actions */}
      <div className="px-6 mt-auto pt-6 border-t border-outline-variant/30">
        <button
          onClick={onTriggerScan}
          className="w-full py-3 mb-4 bg-transparent border border-primary-fixed-dim text-primary-fixed-dim hover:bg-primary-fixed-dim/10 transition-colors text-xs font-bold font-mono tracking-widest"
        >
          [ NEW_SCAN ]
        </button>
        <div className="space-y-1 text-xs">
          <Link
            className={`flex items-center py-2 text-on-surface-variant hover:text-primary transition-colors ${activeTab === "features" ? "text-primary font-bold" : ""}`}
            href="/dashboard/features"
          >
            <span className="material-symbols-outlined text-sm mr-2">info</span>
            FEATURES DIRECTORY
          </Link>
          <a
            className="flex items-center py-2 text-on-surface-variant hover:text-primary-fixed-dim transition-colors"
            href="#"
          >
            <span className="material-symbols-outlined text-sm mr-2">help</span>
            SUPPORT
          </a>
        </div>
      </div>
    </aside>
  );
}
