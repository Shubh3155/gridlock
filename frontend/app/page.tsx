'use client';

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { loginWithGoogle, auth } from "./../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { UserSession } from "../lib/types";

export default function LandingPage() {
  const router = useRouter();
  const [time, setTime] = useState<string>("00:00:00");
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [inputSequence, setInputSequence] = useState<string>("");
  const [bootLogs, setBootLogs] = useState<string[]>([
    "INITIATING HEURISTIC_SCAN...",
    "FETCHING SECTOR_7G GEODATA...",
    "APPLYING XGBOOST WEIGHTS...",
    "TARGET_ID: #40922_BETA FOUND",
    "RISK_LEVEL: HIGH_DENSITY",
  ]);

  const [user, setUser] = useState<UserSession | null>(null);

  // Sync auth state
  useEffect(() => {
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem("gridlock_session");
      if (cached) {
        try {
          setUser(JSON.parse(cached));
        } catch (_) {}
      }
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const localSession = {
            session_id: "local-session",
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            display_name: firebaseUser.displayName,
            photo_url: firebaseUser.photoURL,
          };
          setUser(localSession);
          localStorage.setItem("gridlock_session", JSON.stringify(localSession));
        } catch (e) {}
      } else {
        const cached = localStorage.getItem("gridlock_session");
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (parsed.session_id !== "demo-session-id") {
              setUser(null);
              localStorage.removeItem("gridlock_session");
            }
          } catch (_) {}
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Update clock every second
  useEffect(() => {
    function updateClock() {
      const now = new Date();
      setTime(now.toTimeString().split(" ")[0]);
    }
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Periodic mock logs updates for right visual console
  useEffect(() => {
    const logsPool = [
      "ACK SIGNAL FROM SECTOR_7G",
      "RE-ROUTING LOGISTICS TELEMETRY",
      "UPDATING PRIORITY QUEUE MATRIX",
      "HEARTBEAT OK // SERVER STATE 1",
      "SURVEILLANCE ARRAY ENGAGED",
    ];
    const interval = setInterval(() => {
      const log = logsPool[Math.floor(Math.random() * logsPool.length)];
      setBootLogs((prev) => [...prev.slice(-6), log]);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Global window keyboard listener for detecting 'snake' typing easter egg
  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) {
        return;
      }

      const char = e.key.toLowerCase();
      if (char.length === 1 && /[a-z]/.test(char)) {
        setInputSequence((prev) => {
          const next = (prev + char).slice(-5);
          if (next === "snake") {
            router.push("/system?start=true");
            return "";
          }
          return next;
        });
      }
    }
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [router]);

  // Sign In Trigger
  async function handleGoogleSignIn() {
    setIsLoggingIn(true);
    try {
      const result = await loginWithGoogle();
      const session = {
        session_id: "local-session",
        uid: result.user.uid,
        email: result.user.email,
        display_name: result.user.displayName,
        photo_url: result.user.photoURL,
      };
      localStorage.setItem("gridlock_session", JSON.stringify(session));
      router.push("/dashboard");
    } catch (e: any) {
      console.warn("Sign-in error, redirecting using local demo operator:", e);
      // Fallback redirect for offline demo mode
      const session = {
        session_id: "demo-session-id",
        uid: "OP_DEMO",
        email: "demo@gridlock.gov",
        display_name: "DEMO OPERATOR",
        photo_url: null,
      };
      localStorage.setItem("gridlock_session", JSON.stringify(session));
      router.push("/dashboard");
    } finally {
      setIsLoggingIn(false);
    }
  }


  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground relative selection:bg-primary-fixed-dim selection:text-surface">
      <div className="scanline z-50 pointer-events-none"></div>

      {/* Top Banner Navigation */}
      <header className="bg-surface fixed top-0 w-full z-40 border-b border-outline-variant flex justify-between items-center px-6 h-16 font-mono-data text-[11px] tracking-widest uppercase">
        <div className="flex items-center gap-8">
          <span className="font-headline-md text-sm font-bold text-primary-fixed-dim tracking-tighter">
            ENFORCEMENT_INTEL_v4.2
          </span>
          <nav className="hidden md:flex gap-6">
            <Link
              href={user ? "/dashboard/features" : "/login"}
              className="text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
            >
              NETWORK
            </Link>
            <Link
              href={user ? "/dashboard?tab=assets" : "/login"}
              className="text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
            >
              ASSETS
            </Link>
            <Link
              href={user ? "/live-predictor" : "/login"}
              className="text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
            >
              THREATS
            </Link>
            <Link
              href={user ? "/dashboard/features/logs-archive" : "/login"}
              className="text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
            >
              LOGS
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          {user ? (
            <>
              <span className="hidden lg:inline text-[10px] text-on-surface-variant font-mono">
                {user.display_name || user.email}
              </span>
              <Link
                href="/dashboard"
                className="bg-primary-fixed-dim text-surface px-4 py-1 font-bold hover:opacity-80 transition-opacity flex items-center justify-center font-mono text-[11px]"
              >
                CONSOLE
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-on-surface-variant px-4 py-1 border border-outline-variant hover:bg-surface-container-highest transition-colors font-bold"
              >
                LOGIN
              </Link>
              <Link
                href="/signup"
                className="bg-primary-fixed-dim text-surface px-4 py-1 font-bold hover:opacity-80 transition-opacity"
              >
                REQUEST_ACCESS
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Main operational Hero Body */}
      <main className="flex-grow pt-24 max-w-7xl mx-auto w-full px-6 flex flex-col justify-center">
        <section className="py-16 md:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 flex flex-col justify-center">
              <div className="mb-3 flex items-center gap-2 text-primary-fixed-dim">
                <span className="material-symbols-outlined text-sm">terminal</span>
                <span className="text-[10px] font-bold uppercase tracking-widest font-mono">
                  BOOT_SEQUENCE_COMPLETE
                </span>
              </div>
              <h1 className="font-mono text-5xl md:text-7xl font-extrabold leading-none tracking-tighter mb-6 uppercase">
                ENFORCEMENT
                <br />
                INTEL
              </h1>
              <p className="text-sm font-mono text-on-surface-variant max-w-2xl mb-8 border-l-2 border-primary-fixed-dim pl-6 leading-relaxed uppercase">
                DBSCAN-powered violation clustering and XGBoost risk prediction for modern urban safety.
              </p>
              <div className="flex flex-wrap gap-4 font-mono">
                {user ? (
                  <Link
                    href="/dashboard"
                    className="px-8 py-4 bg-transparent border-2 border-primary-fixed-dim text-primary-fixed-dim font-bold uppercase text-xs tracking-widest hover:bg-primary-fixed-dim hover:text-surface transition-all flex items-center gap-3 group active:scale-95"
                  >
                    <span>ENTER DASHBOARD CONSOLE</span>
                    <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform text-sm">
                      dashboard
                    </span>
                  </Link>
                ) : (
                  <button
                    onClick={handleGoogleSignIn}
                    disabled={isLoggingIn}
                    className="px-8 py-4 bg-transparent border-2 border-primary-fixed-dim text-primary-fixed-dim font-bold uppercase text-xs tracking-widest hover:bg-primary-fixed-dim hover:text-surface transition-all flex items-center gap-3 group active:scale-95 disabled:opacity-50"
                  >
                    <span>{isLoggingIn ? "INITIALIZING_SESSION..." : "SIGN IN WITH GOOGLE"}</span>
                    <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">
                      login
                    </span>
                  </button>
                )}
                <Link
                  href="/login"
                  className="px-8 py-4 bg-surface-container-high border border-outline-variant text-on-surface-variant font-bold uppercase text-xs tracking-widest hover:border-on-surface hover:text-primary transition-all flex items-center justify-center"
                >
                  [ VIEW_DOCUMENTATION ]
                </Link>
              </div>
            </div>

            {/* Right Terminal Visual Overlay */}
            <div className="lg:col-span-4 hidden lg:block relative font-mono">
              <div className="absolute inset-0 bg-gradient-to-br from-primary-fixed-dim/5 to-transparent rounded-none"></div>
              <div className="border border-outline-variant p-4 h-full bg-surface-container-lowest/50 backdrop-blur-sm relative">
                <div className="border-b border-outline-variant flex justify-between items-center px-4 py-2 mb-4 -mx-4 -mt-4 bg-surface-container-high">
                  <span className="text-[10px] text-on-surface-variant opacity-70">SYS_MONITOR_0.1</span>
                  <div className="flex gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-error"></div>
                    <div className="w-2 h-2 rounded-full bg-secondary-container"></div>
                    <div className="w-2 h-2 bg-primary-fixed-dim"></div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="h-44 w-full overflow-hidden border border-outline-variant bg-black/40">
                    <div className="p-2 space-y-1 text-[10px] text-primary-fixed-dim/80">
                      {bootLogs.map((log, idx) => (
                        <p key={idx}>&gt; {log}</p>
                      ))}
                      <p className="animate-pulse">&gt; █</p>
                    </div>
                  </div>
                  <div className="p-4 bg-primary-fixed-dim/5 border border-primary-fixed-dim/20">
                    <div className="text-[9px] uppercase mb-2 opacity-60 font-bold tracking-wider">
                      Threat Density Matrix
                    </div>
                    <div className="grid grid-cols-6 gap-1">
                      <div className="h-4 bg-primary-fixed-dim/40"></div>
                      <div className="h-4 bg-primary-fixed-dim/20"></div>
                      <div className="h-4 bg-primary-fixed-dim/60"></div>
                      <div className="h-4 bg-primary-fixed-dim/10"></div>
                      <div className="h-4 bg-error/40 animate-pulse"></div>
                      <div className="h-4 bg-error"></div>
                      <div className="h-4 bg-primary-fixed-dim/20"></div>
                      <div className="h-4 bg-primary-fixed-dim/10"></div>
                      <div className="h-4 bg-primary-fixed-dim/40"></div>
                      <div className="h-4 bg-primary-fixed-dim/80 animate-pulse"></div>
                      <div className="h-4 bg-primary-fixed-dim/30"></div>
                      <div className="h-4 bg-primary-fixed-dim/20"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* System capabilities section */}
        <section className="py-16 border-t border-outline-variant/30 font-mono">
          <div className="flex flex-col md:flex-row justify-between items-end mb-8">
            <div>
              <h2 className="text-lg font-bold mb-1 tracking-wider">SYSTEM_CAPABILITIES</h2>
              <p className="text-xs text-on-surface-variant">Core modules for algorithmic urban management.</p>
            </div>
            <span className="text-[10px] text-primary-fixed-dim hidden md:block">VER: 4.2.0-STABLE</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1 */}
            <div className="border border-outline-variant hover:border-primary-fixed-dim transition-all bg-surface-container overflow-hidden">
              <div className="px-4 py-2 border-b border-outline-variant flex justify-between items-center text-[10px] bg-surface-container-high font-bold tracking-widest">
                <span>[ FIG. 1 ]</span>
                <span className="text-primary-fixed-dim">MODULE_DETECT</span>
              </div>
              <div className="p-6">
                <div className="w-10 h-10 border border-primary-fixed-dim/30 flex items-center justify-center mb-4 bg-primary-fixed-dim/5">
                  <span className="material-symbols-outlined text-primary-fixed-dim text-lg">radar</span>
                </div>
                <h3 className="text-sm font-bold mb-2">Violation Clustering</h3>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Utilizes density-based spatial clustering (DBSCAN) to identify hotspots of non-compliance across urban datasets.
                </p>
              </div>
            </div>
            {/* Card 2 */}
            <div className="border border-outline-variant hover:border-primary-fixed-dim transition-all bg-surface-container overflow-hidden">
              <div className="px-4 py-2 border-b border-outline-variant flex justify-between items-center text-[10px] bg-surface-container-high font-bold tracking-widest">
                <span>[ FIG. 2 ]</span>
                <span className="text-primary-fixed-dim">MODULE_PREDICT</span>
              </div>
              <div className="p-6">
                <div className="w-10 h-10 border border-primary-fixed-dim/30 flex items-center justify-center mb-4 bg-primary-fixed-dim/5">
                  <span className="material-symbols-outlined text-primary-fixed-dim text-lg">timeline</span>
                </div>
                <h3 className="text-sm font-bold mb-2">Risk Assessment</h3>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  High-accuracy XGBoost models trained on violation coordinates to predict upcoming space-time risk parameters.
                </p>
              </div>
            </div>
            {/* Card 3 */}
            <div className="border border-outline-variant hover:border-primary-fixed-dim transition-all bg-surface-container overflow-hidden">
              <div className="px-4 py-2 border-b border-outline-variant flex justify-between items-center text-[10px] bg-surface-container-high font-bold tracking-widest">
                <span>[ FIG. 3 ]</span>
                <span className="text-primary-fixed-dim">MODULE_ENFORCE</span>
              </div>
              <div className="p-6">
                <div className="w-10 h-10 border border-primary-fixed-dim/30 flex items-center justify-center mb-4 bg-primary-fixed-dim/5">
                  <span className="material-symbols-outlined text-primary-fixed-dim text-lg">gavel</span>
                </div>
                <h3 className="text-sm font-bold mb-2">Automated Pipeline</h3>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Direct integration with enforcer alerts and push messaging queues for predictive dispatch patrol runs.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Global Footer */}
      <footer className="bg-surface-container-lowest border-t border-outline-variant py-6 px-6 font-mono text-[10px] tracking-wider text-on-surface-variant uppercase mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-2">
          <span>© 2026 ENFORCEMENT INTEL. GLOBAL_SURVEILLANCE_NETWORK.</span>
          <span>
            LOCAL_TIME: <span id="clock" className="text-primary-fixed-dim font-bold">{time}</span> // LAT: 12.9716 N // LONG: 77.5946 E
          </span>
        </div>
      </footer>
    </div>
  );
}
