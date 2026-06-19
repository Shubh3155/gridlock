'use client';

import React, { useState, useEffect, Suspense } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Stats,
  ZoneFeatureCollection,
  ViolationPoint,
  ZoneFeature,
  UserSession,
} from "../../lib/types";
import { api } from "../../lib/api";
import {
  loginWithGoogle,
  auth,
  requestNotificationPermission,
  onForegroundMessage,
} from "../../lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";

// Import Components
import Navbar from "../../components/Navbar";
import Sidebar from "../../components/Sidebar";
import StatsBar from "../../components/StatsBar";
import IntelPanel from "../../components/IntelPanel";
import ZoneDetailPanel from "../../components/ZoneDetailPanel";
import Toast from "../../components/Toast";

// Dynamically import Map component to prevent SSR issues with Leaflet
const Map = dynamic(() => import("../../components/Map"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-surface-container-lowest text-primary font-mono text-xs">
      [ INITIALIZING_SATELLITE_LINK... ]
    </div>
  ),
});

// Realistic Mock Data for robust fallback
const MOCK_STATS: Stats = {
  total_violations: 14205,
  total_zones: 8,
  top_station: "Koramangala PS",
  peak_hour: "18:00",
  avg_risk_score: 6.45,
};

const MOCK_ZONES: ZoneFeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      id: "zone_0",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [77.6200, 12.9340],
            [77.6250, 12.9340],
            [77.6250, 12.9380],
            [77.6200, 12.9380],
            [77.6200, 12.9340],
          ],
        ],
      },
      properties: {
        zone_id: "cluster_0",
        priority_score: 9.4,
        violation_count: 512,
        avg_violation_weight: 1.8,
        top_violations: ["No Parking", "Wrong Way", "Double Parking"],
        peak_hour: "18:00",
        police_station: "Koramangala PS",
        junction_ratio: 0.85,
        peak_hour_ratio: 0.90,
        center: { lat: 12.9360, lng: 77.6225 },
        enforcement_brief: "High density congestion around Forum Mall. DBSCAN predicts active violation clusters. Deploy Unit 9 to control parking lines.",
      },
    },
    {
      type: "Feature",
      id: "zone_1",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [77.5900, 12.9700],
            [77.5950, 12.9700],
            [77.5950, 12.9750],
            [77.5900, 12.9750],
            [77.5900, 12.9700],
          ],
        ],
      },
      properties: {
        zone_id: "cluster_1",
        priority_score: 7.2,
        violation_count: 320,
        avg_violation_weight: 1.5,
        top_violations: ["Blocked Pedestrian Crossing", "No Parking"],
        peak_hour: "09:00",
        police_station: "Cubbon Park PS",
        junction_ratio: 0.72,
        peak_hour_ratio: 0.68,
        center: { lat: 12.9725, lng: 77.5925 },
        enforcement_brief: "Morning congestion peak detected near MG Road Metro. Enforce bus lane clearing rules between 08:30 and 10:30.",
      },
    },
    {
      type: "Feature",
      id: "zone_2",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [77.6350, 12.9750],
            [77.6400, 12.9750],
            [77.6400, 12.9800],
            [77.6350, 12.9800],
            [77.6350, 12.9750],
          ],
        ],
      },
      properties: {
        zone_id: "cluster_2",
        priority_score: 6.8,
        violation_count: 288,
        avg_violation_weight: 1.4,
        top_violations: ["Double Parking", "No Parking"],
        peak_hour: "20:00",
        police_station: "Indiranagar PS",
        junction_ratio: 0.68,
        peak_hour_ratio: 0.75,
        center: { lat: 12.9775, lng: 77.6375 },
        enforcement_brief: "Commercial zone peak. Double parking offenses high near food hubs on 100 Feet Road. Recommend immediate dispatch.",
      },
    },
  ],
};

const MOCK_HISTORICAL_POINTS: ViolationPoint[] = [
  { latitude: 12.9360, longitude: 77.6225, violation_weight: 0.9 },
  { latitude: 12.9355, longitude: 77.6230, violation_weight: 0.8 },
  { latitude: 12.9725, longitude: 77.5925, violation_weight: 0.75 },
  { latitude: 12.9730, longitude: 77.5920, violation_weight: 0.85 },
  { latitude: 12.9775, longitude: 77.6375, violation_weight: 0.7 },
  { latitude: 12.9780, longitude: 77.6380, violation_weight: 0.6 },
];

function DashboardContent() {
  const router = useRouter();

  // App States
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
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const searchParams = useSearchParams();

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab) {
      if (["dashboard", "assets", "logs"].includes(tab)) {
        setActiveTab(tab);
      }
    }
  }, [searchParams]);
  const [activeLayer, setActiveLayer] = useState<"historical" | "predicted">("predicted");
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>("cluster_0");
  const [isDetailPanelExpanded, setIsDetailPanelExpanded] = useState<boolean>(true);
  const [inputSequence, setInputSequence] = useState<string>("");

  // Backend Data States
  const [stats, setStats] = useState<Stats | null>(null);
  const [zones, setZones] = useState<ZoneFeatureCollection | null>(null);
  const [historicalPoints, setHistoricalPoints] = useState<ViolationPoint[]>([]);
  const [predictedPoints, setPredictedPoints] = useState<ZoneFeature[]>([]);

  // Console Prompt States
  const [cmdValue, setCmdValue] = useState<string>("");
  const [logs, setLogs] = useState<string[]>([
    "[SYSTEM] Enforcement Intel Boot sequence initialized.",
    "[SYSTEM] Satellite communications linked successfully.",
    "[DATA] XGBoost regressor version v2.1 loaded.",
    "[DATA] DBSCAN cluster polygons compiled.",
  ]);

  // Toast States
  const [toast, setToast] = useState<{
    visible: boolean;
    title: string;
    body: string;
    zoneId?: string;
  }>({
    visible: false,
    title: "",
    body: "",
  });

  // 1. Listen for Firebase Auth changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const idToken = await firebaseUser.getIdToken();
          const session = await api.verifyAuthToken(idToken);
          const sessionWithPhoto = { ...session, photo_url: firebaseUser.photoURL || (session as any).photo_url || null };
          setUser(sessionWithPhoto);
          localStorage.setItem("gridlock_session", JSON.stringify(sessionWithPhoto));
          addLog(`[AUTH] User session authorized: ${sessionWithPhoto.display_name || sessionWithPhoto.email}`);
          requestNotificationPermission(idToken, api.registerFCMToken);
        } catch (e) {
          const localSession = {
            session_id: "local-session",
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            display_name: firebaseUser.displayName,
            photo_url: firebaseUser.photoURL,
          };
          setUser(localSession);
          localStorage.setItem("gridlock_session", JSON.stringify(localSession));
          addLog(`[AUTH] Client auth active (Local session): ${firebaseUser.displayName || firebaseUser.email}`);
        }
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
          addLog("[AUTH] Session terminated. Operator is offline.");
          router.push("/login");
        }
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 2. Fetch Backend Data or Load Mock fallback
  useEffect(() => {
    async function loadData() {
      addLog("[DATA] Connecting to backend server...");
      try {
        const statsData = await api.getStats();
        setStats(statsData);

        const zonesData = await api.getZones();
        setZones(zonesData);

        const histData = await api.getHistoricalHeatmap();
        setHistoricalPoints(histData.points);

        const predData = await api.getPredictedHeatmap(8, 1);
        setPredictedPoints(predData.features);

        addLog("[DATA] Connected to backend. In-memory analytics synced.");
      } catch (err) {
        console.warn("Backend connection failed. Loading local mock database...", err);
        setStats(MOCK_STATS);
        setZones(MOCK_ZONES);
        setHistoricalPoints(MOCK_HISTORICAL_POINTS);
        setPredictedPoints(MOCK_ZONES.features);
        addLog("[WARNING] Backend connection timeout. Operating in OFFLINE DEMO mode.");
      }
    }
    loadData();
  }, []);

  // 3. Register foreground notification listener
  useEffect(() => {
    onForegroundMessage((payload) => {
      const zoneId = payload.data?.zone_id;
      setToast({
        visible: true,
        title: payload.notification?.title || "🚨 HIGH RISK ALERT",
        body: payload.notification?.body || "Critical hotspot violation probability detected.",
        zoneId: zoneId,
      });
      addLog(`[ALERT] FCM Notification: ${payload.notification?.title}`);
    });
  }, []);

  // 4. Keyboard Shortcuts: Press 'z' to toggle bottom panel
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key.toLowerCase() === "z") {
        setIsDetailPanelExpanded((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // 4b. Global window keyboard listener for detecting 'snake' typing easter egg
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

  // 5. Simulated Log Stream Interval
  useEffect(() => {
    const logsPool = [
      "[DATA] Refreshing spatial prediction matrix...",
      "[SYSTEM] Node grid synchronizing with sector sensors.",
      "[ALGORITHM] Recalculating haversine coordinates. Eps parameter stable.",
      "[FCM] Server notification pipe checked... Active.",
      "[LOG_STREAM] Running prediction cycle... Success. All nodes stable.",
      "[SYSTEM] Operator terminal telemetry validated.",
    ];

    const interval = setInterval(() => {
      const randomLog = logsPool[Math.floor(Math.random() * logsPool.length)];
      const timestamp = Math.floor(Date.now() / 1000);
      addLog(`${randomLog} [TS: ${timestamp}]`);
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  // Helper to add logs
  function addLog(text: string) {
    setLogs((prev) => [...prev.slice(-40), text]);
  }

  // Handle Authentication Login Redirect
  async function handleLogin() {
    router.push("/login");
  }

  // Handle Authentication Logout
  async function handleLogout() {
    addLog("[AUTH] Terminating session...");
    try {
      await signOut(auth);
      if (user && user.session_id !== "demo-session-id" && user.session_id !== "local-session") {
        await api.logout(user.session_id);
      }
    } catch (e) {
      console.warn("Logout error:", e);
    } finally {
      localStorage.removeItem("gridlock_session");
      setUser(null);
      router.push("/login");
    }
  }

  // Handle Console command submit
  function handleCmdSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!cmdValue.trim()) return;

    const cmd = cmdValue.trim().toLowerCase();
    addLog(`> ${cmdValue}`);
    setCmdValue("");

    if (cmd === "help") {
      addLog("Available commands: [predict, alert, layer, clear, select <zone_id>, snake]");
    } else if (cmd === "snake") {
      router.push("/system?start=true");
    } else if (cmd === "scan" || cmd === "alert") {
      handleSendAlert();
    } else if (cmd === "clear") {
      setLogs([]);
    } else if (cmd.startsWith("select ")) {
      const targetId = cmd.replace("select ", "");
      const found = zones?.features.find((f) => f.properties.zone_id === targetId);
      if (found) {
        setSelectedZoneId(targetId);
        setIsDetailPanelExpanded(true);
        addLog(`[SYSTEM] Focus shifted to ${targetId.toUpperCase()}`);
      } else {
        addLog(`[ERROR] Zone ${targetId} not found.`);
      }
    } else if (cmd === "layer") {
      const next = activeLayer === "predicted" ? "historical" : "predicted";
      setActiveLayer(next);
      addLog(`[SYSTEM] Layer toggle command executed. Active: ${next.toUpperCase()}`);
    } else {
      addLog(`[ERROR] Unknown command: '${cmd}'. Type 'help' for command list.`);
    }
  }

  // Dispatch push alert to highest violation area users
  async function handleSendAlert() {
    addLog("[DISPATCH] Querying highest violation area...");
    try {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) {
        addLog("[WARNING] No active Firebase operator session. Simulating alert dispatch...");
        setTimeout(() => {
          setToast({
            visible: true,
            title: "🚨 MOCK ALERT: CRITICAL RISK DETECTED",
            body: "UPPARPET PS (cluster_2) has critical activity: 67798 violations (Score: 10.0/10)",
            zoneId: "cluster_2",
          });
          addLog("[ALERT] Mock alert dispatched to sector operators.");
        }, 1500);
        return;
      }
      
      const token = await firebaseUser.getIdToken();
      addLog("[DISPATCH] Contacting push messaging service...");
      const res = await api.dispatchAlert(token);
      
      if (res.status === "ok") {
        addLog(`[DISPATCH] Alert sent to ${res.success_count} operators at ${res.police_station}.`);
      } else {
        addLog(`[WARNING] Dispatch completed: ${res.message}`);
      }
    } catch (err: any) {
      console.error(err);
      addLog(`[ERROR] Alert dispatch failed: ${err.message || err}`);
    }
  }

  // Handle Deploy enforcer unit
  function handleDeployUnit(zoneId: string) {
    addLog(`[DISPATCH] Deploying Tactical Enforcement Unit to ${zoneId.toUpperCase()}...`);
    setTimeout(() => {
      addLog(`[DISPATCH] Tactical Unit status: ARRIVED AT SECTOR ${zoneId.toUpperCase()}.`);
    }, 3000);
  }

  function handleTabChange(tab: string) {
    setActiveTab(tab);
    if (tab === "enforcement") {
      router.push("/live-predictor");
    } else if (tab === "system") {
      router.push("/system");
    } else if (tab === "logs") {
      router.push("/dashboard/features/logs-archive");
    } else {
      router.push(`/dashboard?tab=${tab}`);
    }
  }

  const selectedZone =
    zones?.features.find((f) => f.properties.zone_id === selectedZoneId) || null;

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
      {/* Top Banner Navigation */}
      <Navbar
        user={user}
        onLogin={handleLogin}
        onLogout={handleLogout}
        cmdValue={cmdValue}
        onCmdChange={setCmdValue}
        onCmdSubmit={handleCmdSubmit}
      />

      {/* Numerical Stats Summary Bar */}
      <StatsBar stats={stats} />

      {/* Main operational UI columns */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Control Sidebar */}
        <Sidebar
          user={user}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onSendAlert={handleSendAlert}
        />

        {/* Content Area */}
        <main className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
          
          {/* Main Map Box */}
          <section className="flex-1 h-full relative">
            <Map
              zones={zones}
              selectedZoneId={selectedZoneId}
              onSelectZone={(id) => {
                setSelectedZoneId(id);
                setIsDetailPanelExpanded(true);
                addLog(`[SYSTEM] Focus shifted to ${id.toUpperCase()}`);
              }}
              activeLayer={activeLayer}
              historicalPoints={historicalPoints}
              predictedPoints={predictedPoints}
            />

            {/* In-Map Floating Toggles */}
            <div className="absolute top-6 left-6 z-20 flex flex-col gap-3 font-mono">
              <div className="bg-surface-container/90 backdrop-blur-md border border-outline-variant p-1 flex">
                <button
                  onClick={() => {
                    setActiveLayer("predicted");
                    addLog("[SYSTEM] Render layer updated: PREDICTED");
                  }}
                  className={`px-4 py-1 text-[10px] font-bold transition-all ${
                    activeLayer === "predicted"
                      ? "bg-primary-fixed-dim text-on-primary"
                      : "text-on-surface-variant hover:bg-surface-container-high"
                  }`}
                >
                  PREDICTED
                </button>
                <button
                  onClick={() => {
                    setActiveLayer("historical");
                    addLog("[SYSTEM] Render layer updated: HISTORICAL");
                  }}
                  className={`px-4 py-1 text-[10px] font-bold transition-all ${
                    activeLayer === "historical"
                      ? "bg-primary-fixed-dim text-on-primary"
                      : "text-on-surface-variant hover:bg-surface-container-high"
                  }`}
                >
                  HISTORICAL
                </button>
              </div>

              {/* Map Legend Overlay */}
              <div className="bg-surface-container/90 backdrop-blur-md border border-outline-variant p-3 flex flex-col gap-2">
                <div className="text-[9px] text-on-surface-variant border-b border-outline-variant/50 pb-1 font-bold">
                  LAYER_INTENSITY
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-error block"></span>
                  <span className="text-[9px] uppercase text-on-surface-variant">Tier 1: High</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-secondary-container block"></span>
                  <span className="text-[9px] uppercase text-on-surface-variant">Tier 2: Med</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-tertiary-fixed-dim block"></span>
                  <span className="text-[9px] uppercase text-on-surface-variant">Tier 3: Low</span>
                </div>
              </div>
            </div>

            {/* Slide-in Zone Detail Panel */}
            <ZoneDetailPanel
              selectedZone={selectedZone}
              onDeploy={handleDeployUnit}
              onDismiss={() => setSelectedZoneId(null)}
              isExpanded={isDetailPanelExpanded}
              onToggleExpand={() => setIsDetailPanelExpanded((prev) => !prev)}
            />
          </section>

          {/* Right Side Intelligence Panel */}
          <IntelPanel
            zones={zones?.features || []}
            selectedZoneId={selectedZoneId}
            onSelectZone={(id) => {
              setSelectedZoneId(id);
              setIsDetailPanelExpanded(true);
              addLog(`[SYSTEM] Focus shifted to ${id.toUpperCase()}`);
            }}
            logs={logs}
          />
        </main>
      </div>

      {/* Push Notification alerts */}
      <Toast
        visible={toast.visible}
        title={toast.title}
        body={toast.body}
        onClose={() => setToast((prev) => ({ ...prev, visible: false }))}
        onClick={() => {
          if (toast.zoneId) {
            setSelectedZoneId(toast.zoneId);
            setIsDetailPanelExpanded(true);
          }
          setToast((prev) => ({ ...prev, visible: false }));
        }}
      />
    </div>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background text-primary font-mono text-xs select-none animate-pulse">
        <div className="scanline z-50 pointer-events-none"></div>
        [ SECURING_OPERATOR_TUNNEL... ]
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
