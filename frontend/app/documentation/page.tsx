'use client';

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth } from "../../lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { UserSession } from "../../lib/types";

// Import Components
import Navbar from "../../components/Navbar";

export default function DocumentationPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserSession | null>(() => {
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem("gridlock_session");
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch (_) {}
      }
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [cmdValue, setCmdValue] = useState<string>("");

  // Sync auth state (No redirects, public page)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const session = {
          session_id: "local-session",
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          display_name: firebaseUser.displayName,
          photo_url: firebaseUser.photoURL,
        };
        setUser(session);
        localStorage.setItem("gridlock_session", JSON.stringify(session));
      } else {
        const cached = localStorage.getItem("gridlock_session");
        if (cached) {
          try {
            setUser(JSON.parse(cached));
          } catch (_) {}
        } else {
          setUser(null);
        }
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Handle command console submit
  function handleCmdSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!cmdValue.trim()) return;
    const cmd = cmdValue.trim().toLowerCase();
    setCmdValue("");

    if (cmd === "help") {
      alert("Available commands: [predict, dashboard, system]");
    } else if (cmd === "dashboard") {
      router.push("/dashboard");
    } else if (cmd === "predict") {
      router.push("/live-predictor");
    } else if (cmd === "system") {
      router.push("/system");
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground font-mono-data uppercase relative selection:bg-primary-fixed-dim selection:text-surface">
      <div className="scanline z-50 pointer-events-none"></div>

      {/* Top Navigation */}
      <Navbar
        user={user}
        onLogin={() => router.push("/login")}
        onLogout={async () => {
          try {
            await signOut(auth);
          } catch (e) {
            console.warn("Logout error:", e);
          } finally {
            localStorage.removeItem("gridlock_session");
            setUser(null);
            router.push("/login");
          }
        }}
        cmdValue={cmdValue}
        onCmdChange={setCmdValue}
        onCmdSubmit={handleCmdSubmit}
      />

      {/* Main Content */}
      <main className="grow max-w-5xl mx-auto w-full px-6 py-12 space-y-12">
        
        {/* Header Block */}
        <div className="border-b border-outline-variant pb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <div className="flex items-center gap-2 text-primary-fixed-dim mb-2">
              <span className="material-symbols-outlined text-sm">menu_book</span>
              <span className="text-[10px] font-bold tracking-widest">PUBLIC_DOCUMENTATION_PORTAL</span>
            </div>
            <h1 className="text-3xl font-bold text-on-surface tracking-tighter uppercase font-mono">
              SYSTEM_OPERATIONS_MANUAL
            </h1>
            <p className="text-xs text-on-surface-variant uppercase mt-1 opacity-70">
              Technical Documentation Guide for Gridlock v4.2 Predictive Enforcement Engine
            </p>
          </div>
          <div className="text-left md:text-right font-mono text-[9px] text-primary-fixed-dim leading-snug">
            SECURITY_LEVEL: PUBLIC
            <br />
            DOCUMENTATION_VER: v4.2.0-STABLE
          </div>
        </div>

        {/* Section 1: Overview */}
        <section className="border border-outline-variant bg-surface-container p-6 relative font-mono">
          <div className="flex justify-between items-center mb-4 pb-2 border-b border-outline-variant/40">
            <h2 className="text-xs font-bold text-primary-fixed-dim tracking-widest uppercase">
              [ 1.0 SYSTEM_OVERVIEW ]
            </h2>
            <span className="text-[8px] text-on-surface-variant">GRIDLOCK_OVERVIEW.TXT</span>
          </div>
          <div className="text-xs text-on-surface-variant leading-relaxed uppercase space-y-4">
            <p>
              Gridlock is an advanced, AI-driven spatial analytics platform designed for municipal parking and traffic enforcement management. By combining spatial density clustering (DBSCAN) with supervised machine learning regression (XGBoost), the system predicts the likelihood of upcoming traffic infractions across city nodes.
            </p>
            <p>
              The platform empowers city operators, coordinators, and enforcers to transition from reactive patrol dispatching to proactive predictive scheduling, significantly reducing urban congestion, bottleneck delays, and parking violations.
            </p>
          </div>
        </section>

        {/* Section 2: Architecture */}
        <section className="border border-outline-variant bg-surface-container p-6 relative font-mono">
          <div className="flex justify-between items-center mb-4 pb-2 border-b border-outline-variant/40">
            <h2 className="text-xs font-bold text-primary-fixed-dim tracking-widest uppercase">
              [ 2.0 ARCHITECTURAL_DIAGRAM ]
            </h2>
            <span className="text-[8px] text-on-surface-variant">ENGINE_STRUCTURE.TXT</span>
          </div>
          
          <div className="space-y-6">
            {/* ASCII System Flow Chart */}
            <div className="p-4 bg-surface-container-lowest border border-outline-variant/60 text-[10px] text-primary-fixed-dim font-mono leading-tight whitespace-pre overflow-x-auto select-none uppercase">
{`+------------------------+      +------------------------+      +------------------------+
|    DATA CLEANING       | ---> |    DBSCAN CLUSTERING   | ---> |   XGBOOST REGRESSOR    |
| (pipeline/clean.py)   |      |  (pipeline/score.py)   |      |  (pipeline/score.py)   |
+------------------------+      +------------------------+      +------------------------+
                                                                             |
                                                                             v
+------------------------+      +------------------------+      +------------------------+
|   NEXT.JS INTERFACE    | <--- |     FASTAPI BACKEND    | <--- |   MODEL SERIALIZATION  |
|  (frontend/app/*)      |      |     (backend/main.py)  |      |   (.pkl model file)    |
+------------------------+      +------------------------+      +------------------------+`}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-[11px] leading-relaxed uppercase text-on-surface-variant">
              <div>
                <h3 className="text-xs font-bold text-foreground mb-1">DATA PROCESSING PIPELINE</h3>
                <p className="opacity-80">
                  Raw infractions datasets containing coordinates and timestamps are processed under the <span className="text-foreground">pipeline/</span> workspace. DBSCAN groups coordinates into dense violation hotspots, which are saved in <span className="text-foreground">zones.geojson</span>. Feature mapping encodes parameters such as peak hours, junction distances, and station loads to train the XGBoost regressor model.
                </p>
              </div>
              <div>
                <h3 className="text-xs font-bold text-foreground mb-1">API & TELEMETRY DELIVERY</h3>
                <p className="opacity-80">
                  The FastAPI application serves pre-calculated spatial polygons, loads the serialized XGBoost regressor, and computes on-demand coordinates risk score predictions. It integrates with Firebase Authentication for operator session validation and implements Firebase Cloud Messaging (FCM) to push live hotspot alerts directly into browser client workers.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Feature Specifications */}
        <section className="border border-outline-variant bg-surface-container p-6 relative font-mono">
          <div className="flex justify-between items-center mb-4 pb-2 border-b border-outline-variant/40">
            <h2 className="text-xs font-bold text-primary-fixed-dim tracking-widest uppercase">
              [ 3.0 SYSTEM_FEATURE_MODULES ]
            </h2>
            <span className="text-[8px] text-on-surface-variant">OPERATOR_CHANNELS.TXT</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-[11px] uppercase text-on-surface-variant">
            
            <div className="border border-outline-variant/60 p-4 bg-surface-container-low">
              <h3 className="text-xs font-bold text-foreground mb-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-sm text-primary-fixed-dim">map</span>
                NETWORK VISUALIZER
              </h3>
              <p className="opacity-85">
                Displays real-time Leaflet GIS overlays containing DBSCAN-constructed hotspots. Each hotspot contains a prioritized risk score calculated dynamically based on violation density ratios and dispatcher station capacities. Requires operator authorization to load.
              </p>
            </div>

            <div className="border border-outline-variant/60 p-4 bg-surface-container-low">
              <h3 className="text-xs font-bold text-foreground mb-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-sm text-primary-fixed-dim">gavel</span>
                THREAT PREDICTOR
              </h3>
              <p className="opacity-85">
                Exposes parameter controls to input coordinates, hours, and days of the week. Submits inputs to the FastAPI backend XGBoost pipeline to obtain risk likelihood calculations, generating radial color gauges. Requires operator authorization to load.
              </p>
            </div>

            <div className="border border-outline-variant/60 p-4 bg-surface-container-low">
              <h3 className="text-xs font-bold text-foreground mb-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-sm text-primary-fixed-dim">inventory_2</span>
                TELEMETRY ARCHIVE
              </h3>
              <p className="opacity-85">
                Provides central logging files containing system operation triggers, API endpoint queries, client FCM connection streams, and specific machine learning model statistics. Contains built-in buffer clearing and download tools. Requires operator authorization to load.
              </p>
            </div>

            <div className="border border-outline-variant/60 p-4 bg-surface-container-low">
              <h3 className="text-xs font-bold text-foreground mb-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-sm text-primary-fixed-dim">developer_board</span>
                SYSTEM DIAGNOSTICS
              </h3>
              <p className="opacity-85">
                Monitors system ping latency and memory utilization logs. Contains a diagnostics game sub-layer (isolated Snake game) used to test display rendering speed and input capture latency. Accessible to public visitors in diagnostics mode.
              </p>
            </div>

          </div>
        </section>

        {/* Section 4: Command Cheat Sheet */}
        <section className="border border-outline-variant bg-surface-container p-6 relative font-mono">
          <div className="flex justify-between items-center mb-4 pb-2 border-b border-outline-variant/40">
            <h2 className="text-xs font-bold text-primary-fixed-dim tracking-widest uppercase">
              [ 4.0 COMMAND_LINE_INTERFACE ]
            </h2>
            <span className="text-[8px] text-on-surface-variant">CONSOLE_COMMANDS.TXT</span>
          </div>
          <div className="text-[11px] leading-relaxed uppercase space-y-4 text-on-surface-variant">
            <p>
              When signed in, operators can type commands in the header console command input:
            </p>
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-outline-variant text-foreground">
                  <th className="pb-1 font-bold">COMMAND</th>
                  <th className="pb-1 font-bold">DESCRIPTION</th>
                  <th className="pb-1 font-bold">TARGET ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30 text-on-surface-variant font-mono">
                <tr>
                  <td className="py-2 text-foreground font-bold">HELP</td>
                  <td className="py-2">LISTS ALL VERIFIED CONSOLE ACTIONS</td>
                  <td className="py-2 text-primary-fixed-dim">POPS HELP INFO BOX</td>
                </tr>
                <tr>
                  <td className="py-2 text-foreground font-bold">DASHBOARD</td>
                  <td className="py-2">SHIFTS VIEWPORT TO MAP PORTAL</td>
                  <td className="py-2 text-primary-fixed-dim">ROUTES TO /DASHBOARD</td>
                </tr>
                <tr>
                  <td className="py-2 text-foreground font-bold">PREDICT</td>
                  <td className="py-2">INITIALIZES LIVE REGRESSOR SIMULATOR</td>
                  <td className="py-2 text-primary-fixed-dim">ROUTES TO /LIVE-PREDICTOR</td>
                </tr>
                <tr>
                  <td className="py-2 text-foreground font-bold">SYSTEM</td>
                  <td className="py-2">INITIALIZES DIAGNOSTICS SHELL</td>
                  <td className="py-2 text-primary-fixed-dim">ROUTES TO /SYSTEM</td>
                </tr>
                <tr>
                  <td className="py-2 text-foreground font-bold">SNAKE</td>
                  <td className="py-2">LAUNCHES DIAGNOSTICS EASTER EGG</td>
                  <td className="py-2 text-primary-fixed-dim">ROUTES TO /SYSTEM?START=TRUE</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 5: Run Guide */}
        <section className="border border-outline-variant bg-surface-container p-6 relative font-mono">
          <div className="flex justify-between items-center mb-4 pb-2 border-b border-outline-variant/40">
            <h2 className="text-xs font-bold text-primary-fixed-dim tracking-widest uppercase">
              [ 5.0 RUNNING_LOCALLY ]
            </h2>
            <span className="text-[8px] text-on-surface-variant">DEPLOYMENT_GUIDE.TXT</span>
          </div>
          <div className="text-[11px] leading-relaxed uppercase space-y-4 text-on-surface-variant">
            <div>
              <span className="text-foreground font-bold">1. ML PIPELINE INSTRUCTIONS:</span>
              <pre className="p-3 bg-surface-container-lowest border border-outline-variant/60 text-primary-fixed-dim mt-1.5 overflow-x-auto text-[10px]">
{`cd pipeline
pip install -r requirements.txt
python clean.py
python score.py`}
              </pre>
            </div>
            <div>
              <span className="text-foreground font-bold">2. FASTAPI BACKEND SERVER INSTRUCTIONS:</span>
              <pre className="p-3 bg-surface-container-lowest border border-outline-variant/60 text-primary-fixed-dim mt-1.5 overflow-x-auto text-[10px]">
{`cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000`}
              </pre>
            </div>
            <div>
              <span className="text-foreground font-bold">3. NEXT.JS FRONTEND PORTAL INSTRUCTIONS:</span>
              <pre className="p-3 bg-surface-container-lowest border border-outline-variant/60 text-primary-fixed-dim mt-1.5 overflow-x-auto text-[10px]">
{`cd frontend
npm install
npm run dev`}
              </pre>
            </div>
          </div>
        </section>

        {/* Back Link */}
        <div className="flex justify-center pt-4">
          <Link
            href="/"
            className="px-8 py-3.5 bg-primary-fixed-dim text-surface font-extrabold text-xs uppercase tracking-widest hover:opacity-80 transition-opacity flex items-center gap-2 group active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-sm group-hover:-translate-x-0.5 transition-transform">
              arrow_back
            </span>
            <span>BACK TO HOME</span>
          </Link>
        </div>

      </main>

      {/* Global Footer */}
      <footer className="bg-surface-container-lowest border-t border-outline-variant py-6 px-6 font-mono text-[10px] tracking-wider text-on-surface-variant uppercase mt-auto">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-2">
          <span>© 2026 ENFORCEMENT INTEL. GLOBAL_DOCUMENTATION_NETWORK.</span>
          <span>SYSTEM_STATUS: STABLE // SECTORS: SYNCED</span>
        </div>
      </footer>
    </div>
  );
}
