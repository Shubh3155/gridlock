'use client';

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth } from "../../../lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { UserSession } from "../../../lib/types";
import { api } from "../../../lib/api";

// Import Components
import Navbar from "../../../components/Navbar";
import Sidebar from "../../../components/Sidebar";

export default function FeaturesDirectoryPage() {
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

  function handleTabChange(tab: string) {
    if (tab === "enforcement") {
      router.push("/live-predictor");
    } else if (tab === "system") {
      router.push("/system");
    } else if (tab === "logs") {
      router.push("/dashboard/features/logs-archive");
    } else if (tab === "assets") {
      router.push("/dashboard?tab=assets");
    } else {
      router.push(`/dashboard?tab=${tab}`);
    }
  }

  async function handleSendAlert() {
    try {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) {
        alert("Alert dispatch simulated. Connect Firebase for actual delivery.");
        return;
      }
      const token = await firebaseUser.getIdToken();
      const res = await api.dispatchAlert(token);
      alert(res.message);
    } catch (err: any) {
      console.error(err);
      alert(`Alert dispatch failed: ${err.message || err}`);
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-primary font-mono text-xs select-none animate-pulse">
        <div className="scanline z-50 pointer-events-none"></div>
        [ SECURING_OPERATOR_TUNNEL... ]
      </div>
    );
  }

  const features = [
    {
      title: "Network Visualizer",
      description: "GIS interactive mapping portal (Leaflet-powered). Automatically aggregates spatial coordinates of municipal infractions into high-priority hot zones using DBSCAN density clustering algorithm.",
      link: "/dashboard?tab=dashboard",
      btnText: "Launch Map Control",
      icon: "map",
      colorClass: "text-primary-fixed-dim",
      badge: "LIVE SATELLITE",
    },
    {
      title: "Fleet Assets & telemetries",
      description: "Asset dashboard monitors active patrol dispatch vectors, operator workloads, and real-time station parameters. Cross-references database status queues to determine station assignments.",
      link: "/dashboard?tab=assets",
      btnText: "Inspect Fleet Assets",
      icon: "radar",
      colorClass: "text-secondary-container",
      badge: "Fleet Active",
    },
    {
      title: "Threat Predictor (Enforcement)",
      description: "Runs real-time spatial and temporal inputs through trained XGBoost regressor models. Calculates dynamic density scores to predict upcoming infraction likelihood parameters across urban nodes.",
      link: "/live-predictor",
      btnText: "Run Threat Predictions",
      icon: "gavel",
      colorClass: "text-error",
      badge: "XGBoost Engine",
    },
    {
      title: "Logs & telemetries Archive",
      description: "Centralized logging stream tracking verified dispatch operations, patrol responses, and database updates. Logs transaction payloads and registers FCM client browser push tokens.",
      link: "/dashboard/features/logs-archive",
      btnText: "Open Logs Registry",
      icon: "inventory_2",
      colorClass: "text-outline",
      badge: "ARCHIVE STREAM",
    },
    {
      title: "System Diagnostics",
      description: "Diagnostics panel displaying API gateway latency, database connection health, and processor load. Includes a capability test subsystem (diagnostic Snake Game) for system telemetry verification.",
      link: "/system",
      btnText: "Initialize Diagnostics",
      icon: "developer_board",
      colorClass: "text-tertiary-fixed-dim",
      badge: "WATCHDOG SECURE",
    },
  ];

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
          onSendAlert={handleSendAlert}
        />

        {/* Operational Area */}
        <main className="flex-1 relative overflow-y-auto p-6 flex flex-col justify-between">
          <div>
            {/* Page Header */}
            <div className="mb-6 border-b border-outline-variant pb-3 flex justify-between items-end">
              <div>
                <h1 className="text-xl font-bold text-on-surface tracking-tighter uppercase font-mono">
                  FEATURES_DIRECTORY (05)
                </h1>
                <p className="text-[10px] text-on-surface-variant uppercase mt-1 opacity-70">
                  SYSTEM_DOCUMENTATION_AND_TELEMETRY_MAP
                </p>
              </div>
              <div className="text-right font-mono text-[9px] text-primary-fixed-dim leading-snug">
                STATUS: SYNCED
                <br />
                DOCS_VER: v4.2
              </div>
            </div>

            {/* Features Grid layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 font-mono">
              {features.map((feature, idx) => (
                <div key={idx} className="border border-outline-variant hover:border-primary-fixed-dim transition-all bg-surface-container overflow-hidden flex flex-col justify-between min-h-72.5 relative group hover:shadow-[0_0_15px_rgba(0,219,233,0.08)]">
                  <div>
                    {/* Card Header */}
                    <div className="px-4 py-2 border-b border-outline-variant flex justify-between items-center text-[9px] bg-surface-container-high font-bold tracking-widest">
                      <span>[ FIG. 0{idx + 1} ]</span>
                      <span className={`${feature.colorClass} border border-outline-variant/60 px-2 py-0.5 text-[8px]`}>
                        {feature.badge}
                      </span>
                    </div>

                    {/* Card Body */}
                    <div className="p-5 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 border border-outline-variant flex items-center justify-center bg-surface-container-lowest text-primary-fixed-dim group-hover:border-primary-fixed-dim transition-colors`}>
                          <span className="material-symbols-outlined text-base">
                            {feature.icon}
                          </span>
                        </div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                          {feature.title}
                        </h3>
                      </div>
                      <p className="text-[10px] text-on-surface-variant leading-relaxed uppercase opacity-85">
                        {feature.description}
                      </p>
                    </div>
                  </div>

                  {/* Card Button */}
                  <div className="p-5 pt-0">
                    <Link
                      href={feature.link}
                      className="w-full py-2 border border-primary-fixed-dim/40 text-primary-fixed-dim text-[10px] font-bold tracking-widest uppercase hover:bg-primary-fixed-dim hover:text-surface transition-all flex items-center justify-center gap-2 group-hover:border-primary-fixed-dim"
                    >
                      <span>{feature.btnText}</span>
                      <span className="material-symbols-outlined text-xs">
                        chevron_right
                      </span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Metadata */}
          <footer className="mt-8 pt-4 border-t border-outline-variant flex justify-between items-center text-[9px] text-outline uppercase tracking-wider font-mono">
            <span>© 2026 ENFORCEMENT INTEL. TELEMETRY CODES SECURE.</span>
            <span>DIRECTORY_SECTORS: 05 // SYSTEM: OPERATIONAL</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
