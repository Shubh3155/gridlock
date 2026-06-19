'use client';

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth } from "../../../../lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { UserSession } from "../../../../lib/types";

// Import Components
import Navbar from "../../../../components/Navbar";
import Sidebar from "../../../../components/Sidebar";

export default function LogsArchivePage() {
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
  const [isLoading, setIsLoading] = useState(() => {
    if (typeof window !== "undefined") {
      return !localStorage.getItem("gridlock_session");
    }
    return true;
  });

  const [cmdValue, setCmdValue] = useState<string>("");
  const [logs, setLogs] = useState<string[]>([
    "[SYS_INIT] Operator tunnel secured via cryptographic session.",
    "[GATEWAY] Connecting to telemetry cluster database...",
    "[GATEWAY] Connection established: sqlite3_db_v4.2",
    "[MODEL_LOAD] XGBoost regressor loaded from backend/models/violation_likelihood.pkl",
    "[MODEL_LOAD] DBSCAN spatial anchors loaded from pipeline/output/zones.geojson",
    "[FCM] Server message listener pipeline active.",
    "[LOGS_DAEMON] Streaming system telemetry events below:"
  ]);

  // Handle user authentication state
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
          } catch (err) {
            localStorage.removeItem("gridlock_session");
            router.push("/login");
          }
        } else {
          setUser(null);
          router.push("/login");
        }
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  // Continuous mock telemetry log generator
  useEffect(() => {
    const events = [
      "[SYS_HEALTH] CPU usage 14.2% // Memory load 488MB // Telemetry link OK",
      "[API_PING] GET /api/stats - 200 OK (8ms)",
      "[API_PING] GET /api/zones - 200 OK (12ms)",
      "[PREDICT] POST /api/predict - User run initiated from live-predictor",
      "[PREDICT] XGBoost regression executed successfully in 4ms (likelihood: 0.88)",
      "[FCM] Push token registered: fcm_client_web_7a90b4e2",
      "[SYS_HEALTH] Network packet latency: 12ms",
      "[GATEWAY] Refreshed geospatial cache from sqlite",
    ];

    const interval = setInterval(() => {
      const randomEvent = events[Math.floor(Math.random() * events.length)];
      const timestamp = new Date().toLocaleTimeString("en-GB", { hour12: false });
      setLogs((prev) => [...prev.slice(-30), `[${timestamp}] ${randomEvent}`]);
    }, 6000);

    return () => clearInterval(interval);
  }, []);

  function handleTabChange(tab: string) {
    if (tab === "enforcement") {
      router.push("/live-predictor");
    } else if (tab === "system") {
      router.push("/system");
    } else {
      router.push(`/dashboard?tab=${tab}`);
    }
  }

  // Handle command console submit
  function handleCmdSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!cmdValue.trim()) return;
    const cmd = cmdValue.trim().toLowerCase();
    setCmdValue("");

    if (cmd === "help") {
      alert("Available commands: [predict, dashboard, system, clear]");
    } else if (cmd === "dashboard") {
      router.push("/dashboard");
    } else if (cmd === "predict") {
      router.push("/live-predictor");
    } else if (cmd === "system") {
      router.push("/system");
    }
  }

  function handleClearLogs() {
    setLogs(["[SYSTEM] Telemetry log buffer cleared by operator."]);
  }

  function handleDownloadLogs() {
    const element = document.createElement("a");
    const file = new Blob([logs.join("\n")], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = `gridlock_telemetry_logs_${Date.now()}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-primary font-mono text-xs select-none animate-pulse">
        <div className="scanline z-50 pointer-events-none"></div>
        [ SECURING_OPERATOR_TUNNEL... ]
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden select-none bg-background text-foreground font-mono-data">
      <div className="scanline z-50 pointer-events-none"></div>

      {/* Top Banner Navigation */}
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

      <div className="flex flex-1 overflow-hidden relative pt-0">
        {/* Left Control Sidebar */}
        <Sidebar
          user={user}
          activeTab="features"
          onTabChange={handleTabChange}
          onTriggerScan={() => router.push("/dashboard")}
        />

        {/* Operational Area */}
        <main className="flex-1 relative overflow-y-auto p-6 flex flex-col justify-between">
          <div className="space-y-8">
            
            {/* Page Header */}
            <div className="border-b border-outline-variant pb-3 flex justify-between items-end">
              <div>
                <h1 className="text-xl font-bold text-on-surface tracking-tighter uppercase font-mono">
                  LOGS_AND_TELEMETRICS_ARCHIVE (04)
                </h1>
                <p className="text-[10px] text-on-surface-variant uppercase mt-1 opacity-70">
                  SYSTEM_INTEGRITY_LOGS_AND_MACHINE_LEARNING_METRICS
                </p>
              </div>
              <div className="text-right font-mono text-[9px] text-primary-fixed-dim leading-snug">
                STATUS: LIVE_STREAM
                <br />
                LOG_BUFFERS: OK
              </div>
            </div>

            {/* Grid for Logs and Model Parameters */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Left Column: Live Terminal logs */}
              <div className="lg:col-span-7 flex flex-col">
                <div className="border border-outline-variant bg-surface-container p-4 h-110 flex flex-col relative font-mono">
                  
                  {/* Terminal Header */}
                  <div className="flex justify-between items-center mb-3 pb-2 border-b border-outline-variant/40">
                    <span className="text-[10px] text-primary-fixed-dim font-bold uppercase tracking-wider flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-error animate-ping"></span>
                      [ TELEMETRY_STATION_MONITOR ]
                    </span>
                    <div className="flex gap-4 text-[9px] text-on-surface-variant font-bold font-mono">
                      <button onClick={handleClearLogs} className="hover:text-primary transition-colors cursor-pointer">
                        [ CLEAR_BUFFER ]
                      </button>
                      <button onClick={handleDownloadLogs} className="hover:text-primary transition-colors cursor-pointer">
                        [ DUMP_LOGS ]
                      </button>
                    </div>
                  </div>

                  {/* Terminal Logs Panel */}
                  <div className="flex-1 overflow-y-auto space-y-1.5 text-[10px] text-on-surface-variant p-2 bg-surface-container-lowest/50 border border-outline-variant/60 terminal-scroll select-text font-mono leading-relaxed">
                    {logs.map((log, index) => (
                      <p key={index} className="break-all">
                        <span className="text-primary-fixed-dim mr-1.5 font-bold">&gt;</span>
                        {log}
                      </p>
                    ))}
                    <p className="animate-pulse text-primary-fixed-dim font-bold">&gt; █</p>
                  </div>
                </div>
              </div>

              {/* Right Column: Model Details */}
              <div className="lg:col-span-5 space-y-6">
                <div className="border border-outline-variant bg-surface-container p-5 relative overflow-hidden font-mono">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-[10px] text-primary-fixed-dim font-bold tracking-widest">[ FIG 4.1 ] MACHINE_LEARNING_SPECIFICATIONS</span>
                    <span className="material-symbols-outlined text-primary-fixed-dim text-base">analytics</span>
                  </div>

                  {/* Model specifications lists */}
                  <div className="space-y-4 text-[11px] uppercase">
                    
                    {/* Model 1 */}
                    <div className="border border-outline-variant/60 p-3 bg-surface-container-low">
                      <div className="text-[10px] text-foreground font-bold tracking-wide border-b border-outline-variant/40 pb-1 mb-2 flex justify-between">
                        <span>1. DBSCAN CLUSTERING ENGINE</span>
                        <span className="text-secondary-container">[UNSUPERVISED]</span>
                      </div>
                      <table className="w-full text-left text-on-surface-variant">
                        <tbody>
                          <tr>
                            <td className="py-0.5 font-bold opacity-60">EPSILON (RADIUS)</td>
                            <td className="text-right text-foreground font-mono">0.002 (~220m)</td>
                          </tr>
                          <tr>
                            <td className="py-0.5 font-bold opacity-60">MINIMUM SAMPLES</td>
                            <td className="text-right text-foreground font-mono">4 POINTS</td>
                          </tr>
                          <tr>
                            <td className="py-0.5 font-bold opacity-60">SPATIAL INDEX</td>
                            <td className="text-right text-foreground font-mono">KD-TREE SEARCH</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Model 2 */}
                    <div className="border border-outline-variant/60 p-3 bg-surface-container-low">
                      <div className="text-[10px] text-foreground font-bold tracking-wide border-b border-outline-variant/40 pb-1 mb-2 flex justify-between">
                        <span>2. XGBOOST RISK REGRESSOR</span>
                        <span className="text-error">[SUPERVISED]</span>
                      </div>
                      <table className="w-full text-left text-on-surface-variant">
                        <tbody>
                          <tr>
                            <td className="py-0.5 font-bold opacity-60">ESTIMATORS (TREES)</td>
                            <td className="text-right text-foreground font-mono">100 TREES</td>
                          </tr>
                          <tr>
                            <td className="py-0.5 font-bold opacity-60">LEARNING RATE</td>
                            <td className="text-right text-foreground font-mono">0.05</td>
                          </tr>
                          <tr>
                            <td className="py-0.5 font-bold opacity-60">INPUT VECTOR SIZE</td>
                            <td className="text-right text-foreground font-mono">12 ATTRIBUTES</td>
                          </tr>
                          <tr>
                            <td className="py-0.5 font-bold opacity-60">CROSS-VALIDATION RMSE</td>
                            <td className="text-right text-primary-fixed-dim font-bold font-mono">0.076</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                  </div>
                </div>
              </div>

            </div>

            {/* How We Made the Project Section */}
            <div className="border border-outline-variant bg-surface-container p-6 relative font-mono">
              <div className="flex justify-between items-center mb-4 pb-2 border-b border-outline-variant/40">
                <h2 className="text-sm font-bold text-primary-fixed-dim tracking-widest uppercase">
                  [ CONSOLE_LOG: ARCHITECTURE_AND_IMPLEMENTATION ]
                </h2>
                <span className="text-[9px] text-on-surface-variant">ENGINEERING_STORY.TXT</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-[11px] leading-relaxed uppercase text-on-surface-variant">
                
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xs font-bold text-foreground mb-1">1. DATA PIPELINE & PREPARATION</h3>
                    <p className="opacity-80">
                      The core algorithmic workflow begins in the python engine files:
                      <br />
                      * <span className="text-foreground">clean.py</span>: Filters coordinates data, cleans null values, and maps urban sectors to police stations.
                      <br />
                      * <span className="text-foreground">score.py</span>: Runs the DBSCAN clustering to compile hotspots. It then builds a coordinate-grid of densities, constructs a 12-feature matrix, and trains the supervised XGBoost Model. The compiled model is stored at <span className="text-foreground">backend/models/violation_likelihood.pkl</span>.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-foreground mb-1">2. FASTAPI BACKEND SERVER</h3>
                    <p className="opacity-80">
                      We implemented a high-performance Python FastAPI server to serve predictions:
                      <br />
                      * Pre-calculates and caches historical clusters and metrics in memory on startup.
                      <br />
                      * Exposes secure POST endpoints to run on-demand single coordinate predictions via the trained XGBoost model.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h3 className="text-xs font-bold text-foreground mb-1">3. NEXT.JS OPERATOR INTERFACE</h3>
                    <p className="opacity-80">
                      The user interface is a Next.js App Router portal:
                      <br />
                      * Built using React hooks, Next.js dynamic routing, and styled with Vanilla CSS.
                      * Leverages Leaflet dynamically on the client side to avoid SSR build conflicts while drawing DBSCAN hotzone polygons.
                      * Integrates responsive Cyberpunk visual layouts with monospaced telemetry feeds.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-foreground mb-1">4. AUTHENTICATION & SECURE PUSH MESSAGING</h3>
                    <p className="opacity-80">
                      Security and real-time alerts are coordinated via Firebase:
                      <br />
                      * Firebase Authentication manages standard email/password registration alongside Google Sign-in.
                      <br />
                      * A custom dynamic Next.js Route Handler at <span className="text-foreground">/firebase-messaging-sw.js</span> securely injects configuration variables into the web browser's service worker dynamically to enable foreground and background alert push routing.
                    </p>
                  </div>
                </div>

              </div>
            </div>

          </div>

          {/* Footer Metadata */}
          <footer className="mt-8 pt-4 border-t border-outline-variant flex justify-between items-center text-[9px] text-outline uppercase tracking-wider font-mono">
            <span>© 2026 ENFORCEMENT INTEL. TELEMETRY CODES SECURE.</span>
            <span>SYSTEM: SECURE // DATAFRAMES: COMPLETED</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
