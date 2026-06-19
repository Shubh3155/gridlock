'use client';

import React from "react";
import Link from "next/link";
import { UserSession } from "../lib/types";

interface NavbarProps {
  user: UserSession | null;
  onLogin: () => void;
  onLogout: () => void;
  cmdValue: string;
  onCmdChange: (val: string) => void;
  onCmdSubmit: (e: React.FormEvent) => void;
}

export default function Navbar({
  user,
  onLogin,
  onLogout,
  cmdValue,
  onCmdChange,
  onCmdSubmit,
}: NavbarProps) {
  return (
    <header className="bg-surface text-primary-fixed-dim font-mono-data uppercase tracking-widest border-b border-outline-variant flex justify-between items-center w-full px-6 h-16 z-50">
      <div className="flex items-center gap-8">
        <Link href="/" className="font-headline-md text-xl font-bold text-primary-fixed-dim tracking-tighter hover:opacity-80 transition-opacity">
          ENFORCEMENT_INTEL_v4.2
        </Link>
        <nav className="hidden md:flex gap-4 ml-8 text-sm">
          <Link
            className="text-on-surface-variant hover:text-primary transition-colors px-2 py-1"
            href="/dashboard"
          >
            NETWORK
          </Link>
          <Link
            className="text-primary border-b-2 border-primary pb-1 px-2 py-1"
            href="/dashboard"
          >
            ASSETS
          </Link>
          <Link
            className="text-on-surface-variant hover:text-primary transition-colors px-2 py-1"
            href="/live-predictor"
          >
            THREATS
          </Link>
          <Link
            className="text-on-surface-variant hover:text-primary transition-colors px-2 py-1"
            href="/dashboard"
          >
            LOGS
          </Link>
        </nav>
      </div>

      <div className="flex items-center gap-4">
        {/* Command Line Input */}
        <form
          onSubmit={onCmdSubmit}
          className="flex items-center gap-2 px-3 py-1 bg-surface-container-high border border-outline-variant"
        >
          <span className="text-primary-fixed-dim font-bold">&gt;</span>
          <input
            className="bg-transparent border-none outline-none focus:ring-0 text-xs font-mono w-32 placeholder:text-on-surface-variant/40 text-foreground"
            placeholder="CMD_PROMPT"
            type="text"
            value={cmdValue}
            onChange={(e) => onCmdChange(e.target.value)}
          />
        </form>

        {/* User Auth Control */}
        {user ? (
          <div className="flex items-center gap-4">
            <span className="hidden lg:inline text-[10px] text-on-surface-variant font-mono">
              {user.display_name || user.email}
            </span>
            <button
              onClick={onLogout}
              className="text-error border border-error px-4 py-1 text-xs font-bold hover:bg-error/10 transition-colors"
            >
              LOGOUT
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="bg-primary-container text-on-primary-container px-4 py-1 text-xs font-bold hover:opacity-80 transition-opacity flex items-center justify-center"
          >
            AUTHENTICATE
          </Link>
        )}

        <Link href="/dashboard" className="hidden sm:inline-flex border border-primary-container px-4 py-1 text-xs font-bold text-primary-fixed-dim hover:bg-surface-container-highest transition-colors items-center justify-center">
          CONSOLE
        </Link>
      </div>
    </header>
  );
}
