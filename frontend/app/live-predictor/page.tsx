'use client';

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../lib/api";
import { auth } from "../../lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { UserSession } from "../../lib/types";

// Import Components
import Navbar from "../../components/Navbar";
import Sidebar from "../../components/Sidebar";

export default function LivePredictorPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserSession | null>(null);
  const [activeTab, setActiveTab] = useState<string>("enforcement");
  const [inputSequence, setInputSequence] = useState<string>("");
  
  // Predictor Parameters
  const [latitude, setLatitude] = useState<string>("12.9360");
  const [longitude, setLongitude] = useState<string>("77.6225");
  const [hour, setHour] = useState<number>(22);
  const [dayOfWeek, setDayOfWeek] = useState<number>(4); // Default Friday (0=Mon, 4=Fri)

  // Simulation & Gauge Outputs
  const [probability, setProbability] = useState<number>(0.88);
  const [riskTier, setRiskTier] = useState<string>("HIGH RISK DETECTED");
  const [riskStatusText, setRiskStatusText] = useState<string>("Query suggests high temporal-spatial correlation with historical infraction patterns in Sector 7G.");
  const [confidenceText, setConfidenceText] = useState<string>("94.22%");
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  // Terminal Input & Logs
  const [cmdValue, setCmdValue] = useState<string>("");
  const [predictorLogs, setPredictorLogs] = useState<string[]>([
    "INITIALIZING_PREDICTOR_INSTANCE_01...",
    "LOADING_HISTORICAL_INFRACTION_MODELS...",
    "DATABASE_CONNECTED_SUCCESSFULLY.",
    "WAITING_FOR_USER_PARAM_INJECTION...",
    "IDLE_STATE_ACTIVE...",
  ]);

  // Handle user authentication state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          session_id: "local-session",
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          display_name: firebaseUser.displayName,
        });
      } else {
        setUser(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Periodic log heartbeat
  useEffect(() => {
    const pings = ["WATCHDOG_PING", "MEMORY_CLEANUP", "SENSOR_RECALIBRATION", "ENCRYPT_STREAM_01"];
    const interval = setInterval(() => {
      const ping = pings[Math.floor(Math.random() * pings.length)];
      const time = new Date().toLocaleTimeString("en-GB", { hour12: false });
      addLog(`[${time}] ${ping}_ACK`);
    }, 12000);
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

  function addLog(text: string) {
    setPredictorLogs((prev) => [...prev.slice(-30), text]);
  }

  // Handle command console submit
  function handleCmdSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!cmdValue.trim()) return;
    const cmd = cmdValue.trim().toLowerCase();
    addLog(`> ${cmdValue}`);
    setCmdValue("");

    if (cmd === "help") {
      addLog("Available commands: [predict, clear, back, snake]");
    } else if (cmd === "snake") {
      router.push("/system?start=true");
    } else if (cmd === "predict") {
      handleRunPrediction();
    } else if (cmd === "clear") {
      setPredictorLogs([]);
    } else if (cmd === "back") {
      router.push("/dashboard");
    } else {
      addLog(`[ERROR] Unknown command: '${cmd}'`);
    }
  }

  // Run the XGBoost Prediction Simulation
  async function handleRunPrediction() {
    setIsSimulating(true);
    addLog("PARSING_COORDINATE_GRID_7G...");
    
    const steps = [
      `WEIGHTING_HOUR_${hour}_TEMPORAL_DENSITY...`,
      `CROSS_REFERENCING_DAY_INDEX_${dayOfWeek}_PATTERNS...`,
      "RUNNING_XGBOOST_REGRESSION_INFERENCE...",
      "PREDICTION_COMPLETE: VIOLATION_LIKELIHOOD_CALCULATED."
    ];

    let stepIdx = 0;
    const interval = setInterval(async () => {
      if (stepIdx < steps.length) {
        addLog(steps[stepIdx]);
        stepIdx++;
      } else {
        clearInterval(interval);
        try {
          // Fetch prediction from actual backend regressor
          const result = await api.predictSingle({
            lat: parseFloat(latitude),
            lng: parseFloat(longitude),
            hour: hour,
            day_of_week: dayOfWeek,
          });

          const score = result.likelihood_score;
          setProbability(score);
          setRiskTier(`${result.risk_tier.toUpperCase()} RISK DETECTED`);
          setConfidenceText(`${(score * 100).toFixed(2)}%`);
          
          if (score >= 0.7) {
            setRiskStatusText(`Critical temporal-spatial correlation found in sector. High priority enforcement deployment required.`);
          } else if (score >= 0.4) {
            setRiskStatusText(`Medium violation risk. Routine sector monitoring recommended.`);
          } else {
            setRiskStatusText(`Low risk index. Sector is currently operating within stable parameters.`);
          }
          addLog(`[RESULT] Probability: ${score.toFixed(4)} // Risk Tier: ${result.risk_tier.toUpperCase()}`);
        } catch (err) {
          // Offline simulated calculation if backend is missing
          console.warn("Prediction API failed, using simulated calculations:", err);
          const mockScore = parseFloat((0.2 + Math.random() * 0.75).toFixed(2));
          setProbability(mockScore);
          const tier = mockScore >= 0.7 ? "HIGH" : mockScore >= 0.4 ? "MEDIUM" : "LOW";
          setRiskTier(`${tier} RISK DETECTED`);
          setConfidenceText(`${(mockScore * 100).toFixed(2)}%`);
          setRiskStatusText(`[SIMULATED] Density scan returns likelihood index of ${mockScore}. Recommendation queued.`);
          addLog(`[RESULT] Simulated Probability: ${mockScore}`);
        } finally {
          setIsSimulating(false);
        }
      }
    }, 400);
  }

  function handleTabChange(tab: string) {
    setActiveTab(tab);
    if (tab === "dashboard") {
      router.push("/dashboard");
    } else if (tab === "system") {
      router.push("/system");
    }
  }

  // Calculate circular gauge offset: circumfrance = 2 * PI * r = 2 * 3.14159 * 70 = 439.82
  const circ = 439.82;
  const strokeOffset = circ - (circ * probability);

  return (
    <div className="flex flex-col h-screen overflow-hidden select-none bg-background text-foreground font-mono-data">
      <div className="scanline z-50 pointer-events-none"></div>

      {/* Top Banner Navigation */}
      <Navbar
        user={user}
        onLogin={() => router.push("/login")}
        onLogout={async () => {
          await signOut(auth);
          router.push("/login");
        }}
        cmdValue={cmdValue}
        onCmdChange={setCmdValue}
        onCmdSubmit={handleCmdSubmit}
      />

      <div className="flex flex-1 overflow-hidden relative pt-0">
        {/* Left Control Sidebar */}
        <Sidebar
          user={user}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onTriggerScan={handleRunPrediction}
        />

        {/* Operational Area */}
        <main className="flex-1 relative overflow-y-auto p-6 flex flex-col justify-between">
          <div>
            {/* Page Header */}
            <div className="mb-6 border-b border-outline-variant pb-3 flex justify-between items-end">
              <div>
                <h1 className="text-xl font-bold text-on-surface tracking-tighter uppercase font-mono">
                  PREDICTOR_PORTAL (01)
                </h1>
                <p className="text-[10px] text-on-surface-variant uppercase mt-1 opacity-70">
                  LIVE_ENFORCEMENT_SIMULATION_ENGINE_v9.1
                </p>
              </div>
              <div className="text-right font-mono text-[9px] text-primary-fixed-dim leading-snug">
                STABILITY: 99.8%
                <br />
                LATENCY: 14ms
              </div>
            </div>

            {/* Dashboard Grid */}
            <div className="grid grid-cols-12 gap-6">
              
              {/* Left Column: Parameter Form & Result Gauge */}
              <div className="col-span-12 lg:col-span-7 space-y-6">
                
                {/* Form Input parameters */}
                <div className="border border-outline-variant bg-surface-container p-4 relative font-mono">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-[10px] text-on-surface-variant font-bold">
                      [ FIG. 01 ] INPUT_PARAMETERS
                    </span>
                    <span className="material-symbols-outlined text-on-surface-variant text-lg">
                      settings_input_component
                    </span>
                  </div>

                  <form className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] text-on-surface-variant block uppercase font-bold">
                        LATITUDE
                      </label>
                      <div className="relative flex items-center border border-outline-variant focus-within:border-primary-fixed-dim transition-all bg-surface-container-low">
                        <span className="absolute left-2 text-primary-fixed-dim text-xs font-bold">&gt;</span>
                        <input
                          className="w-full bg-transparent border-none outline-none focus:ring-0 text-xs pl-6 py-2 text-foreground font-mono"
                          type="text"
                          value={latitude}
                          onChange={(e) => setLatitude(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-on-surface-variant block uppercase font-bold">
                        LONGITUDE
                      </label>
                      <div className="relative flex items-center border border-outline-variant focus-within:border-primary-fixed-dim transition-all bg-surface-container-low">
                        <span className="absolute left-2 text-primary-fixed-dim text-xs font-bold">&gt;</span>
                        <input
                          className="w-full bg-transparent border-none outline-none focus:ring-0 text-xs pl-6 py-2 text-foreground font-mono"
                          type="text"
                          value={longitude}
                          onChange={(e) => setLongitude(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-on-surface-variant block uppercase font-bold">
                        HOUR_OF_DAY (0-23)
                      </label>
                      <div className="relative flex items-center border border-outline-variant focus-within:border-primary-fixed-dim transition-all bg-surface-container-low">
                        <span className="absolute left-2 text-primary-fixed-dim text-xs font-bold">&gt;</span>
                        <input
                          className="w-full bg-transparent border-none outline-none focus:ring-0 text-xs pl-6 py-2 text-foreground font-mono"
                          type="number"
                          min="0"
                          max="23"
                          value={hour}
                          onChange={(e) => setHour(parseInt(e.target.value) || 0)}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-on-surface-variant block uppercase font-bold">
                        DAY_OF_WEEK
                      </label>
                      <div className="relative flex items-center border border-outline-variant focus-within:border-primary-fixed-dim transition-all bg-surface-container-low">
                        <span className="absolute left-2 text-primary-fixed-dim text-xs font-bold">&gt;</span>
                        <select
                          className="w-full bg-transparent border-none outline-none focus:ring-0 text-xs pl-6 py-2 text-foreground font-mono appearance-none uppercase"
                          value={dayOfWeek}
                          onChange={(e) => setDayOfWeek(parseInt(e.target.value))}
                        >
                          <option value={0}>MONDAY</option>
                          <option value={1}>TUESDAY</option>
                          <option value={2}>WEDNESDAY</option>
                          <option value={3}>THURSDAY</option>
                          <option value={4}>FRIDAY</option>
                          <option value={5}>SATURDAY</option>
                          <option value={6}>SUNDAY</option>
                        </select>
                      </div>
                    </div>

                    <div className="col-span-full pt-2">
                      <button
                        onClick={handleRunPrediction}
                        disabled={isSimulating}
                        type="button"
                        className="w-full py-3.5 bg-primary-fixed-dim text-surface font-extrabold text-xs uppercase tracking-widest flex items-center justify-center gap-2 group active:scale-[0.98] transition-all disabled:opacity-50"
                      >
                        <span>{isSimulating ? "RUNNING_SIMULATION..." : "RUN PREDICTION"}</span>
                        <span className="material-symbols-outlined text-sm group-hover:translate-x-0.5 transition-transform">
                          bolt
                        </span>
                      </button>
                    </div>
                  </form>
                </div>

                {/* Output Gauge Results */}
                <div className="border border-outline-variant bg-surface-container p-4 relative overflow-hidden font-mono">
                  <div className="absolute top-0 right-0 p-2 opacity-10">
                    <span className="material-symbols-outlined text-[100px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      warning
                    </span>
                  </div>

                  <div className="flex justify-between items-center mb-4 relative z-10">
                    <span className="text-[10px] text-primary-fixed-dim font-bold">
                      [ FIG. 02 ] OUTPUT_RESULTS
                    </span>
                    <span className="px-2 py-0.5 bg-error-container text-on-error-container text-[8px] font-bold">
                      CRITICAL_THREAT
                    </span>
                  </div>

                  <div className="flex flex-col md:flex-row items-center gap-8 py-2 relative z-10">
                    {/* SVG Radial Gauge */}
                    <div className="relative w-40 h-40 flex items-center justify-center">
                      <svg className="w-full h-full -rotate-90">
                        <circle cx="80" cy="80" fill="none" r="70" stroke="#1A2634" strokeWidth="4"></circle>
                        <circle
                          className="transition-all duration-1000 ease-out"
                          cx="80"
                          cy="80"
                          fill="none"
                          id="gauge-circle"
                          r="70"
                          stroke={probability >= 0.7 ? "#ffb4ab" : probability >= 0.4 ? "#feb700" : "#8fdb00"}
                          strokeDasharray={circ.toString()}
                          strokeDashoffset={strokeOffset.toString()}
                          strokeWidth="4"
                        ></circle>
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-4xl font-extrabold text-primary-fixed-dim tracking-tight">
                          {probability.toFixed(2)}
                        </span>
                        <span className="text-[8px] text-on-surface-variant font-bold mt-1">PROBABILITY</span>
                      </div>
                    </div>

                    <div className="flex-1 space-y-4 w-full">
                      <div className="bg-surface-container-highest border border-outline-variant p-4">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[9px] text-on-surface-variant font-bold">STATUS_REPORT</span>
                          <div className="flex gap-1">
                            <div className="w-1.5 h-1.5 bg-primary-fixed-dim"></div>
                            <div className="w-1.5 h-1.5 bg-primary-fixed-dim"></div>
                            <div className="w-1.5 h-1.5 bg-primary-fixed-dim animate-pulse"></div>
                          </div>
                        </div>
                        <div className={`text-sm font-bold tracking-tight ${probability >= 0.7 ? "text-error" : probability >= 0.4 ? "text-secondary-container" : "text-tertiary-fixed-dim"}`}>
                          {riskTier}
                        </div>
                        <p className="text-xs text-on-surface-variant leading-relaxed mt-2 italic uppercase">
                          {riskStatusText}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="border border-outline-variant p-2 text-center">
                          <div className="text-[8px] text-on-surface-variant font-bold uppercase">VECTOR_ID</div>
                          <div className="text-xs text-foreground mt-0.5">{latitude.slice(0, 5)}//XF-PRED</div>
                        </div>
                        <div className="border border-outline-variant p-2 text-center">
                          <div className="text-[8px] text-on-surface-variant font-bold uppercase">CONFIDENCE</div>
                          <div className="text-xs text-foreground mt-0.5">{confidenceText}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Right Column: Visual Telemetry Map & Feed Logs */}
              <div className="col-span-12 lg:col-span-5 space-y-6">
                
                {/* Visual Radar Mock Map */}
                <div className="border border-outline-variant bg-surface-container relative h-[240px] md:h-[260px] overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 p-2.5 bg-surface/85 backdrop-blur-sm z-20 flex justify-between items-center border-b border-outline-variant font-mono">
                    <span className="text-[9px] text-on-surface-variant font-bold">
                      [ MAP_COORD_VISUALIZER ]
                    </span>
                    <div className="flex gap-2">
                      <span className="material-symbols-outlined text-xs cursor-pointer hover:text-primary">
                        zoom_in
                      </span>
                      <span className="material-symbols-outlined text-xs cursor-pointer hover:text-primary">
                        zoom_out
                      </span>
                    </div>
                  </div>

                  <div className="w-full h-full relative group">
                    <div
                      className="w-full h-full bg-cover bg-center grayscale brightness-[0.3] contrast-125 scale-105 group-hover:scale-100 transition-transform duration-1000"
                      style={{
                        backgroundImage:
                          "url('https://lh3.googleusercontent.com/aida-public/AB6AXuC2vLaaeXOiDabb9NCNIXQnKhSxv0dhSpa1Rw_PzXp_-iH9f3RQfLTFUYBr_Q_ILiQDxCLe9bngHnFZDIq-9RGSgG-Hc_KsLPdA_LnJp6258e9e1tW0Zzbw1epJOaByjvFPKSO8F2f-TQcyTcc0ffeVXLbGer_lyRdd4uIraKBe_L1cGuDFSD91rkO2nFFB6hoSRa8B1yZQKrub2vpWPWzzGrYd-iSi7nsi0YBo8AHXcICXfhxeE2Xm7snLcsaL9RUnIH604g70pwLU')",
                      }}
                    ></div>

                    {/* Tactical ping lines */}
                    <div className="absolute inset-0 pointer-events-none border-2 border-primary-fixed-dim/20">
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 border border-primary-fixed-dim/30 rounded-full animate-ping opacity-25"></div>
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-full bg-primary-fixed-dim"></div>
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-px bg-primary-fixed-dim"></div>
                      </div>
                    </div>

                    <div className="absolute bottom-4 left-4 right-4 bg-surface-container/90 backdrop-blur-md border border-outline-variant p-3 font-mono text-[9px]">
                      <div className="text-primary-fixed-dim mb-1 font-bold">REALTIME_TELEMETRY</div>
                      <div className="flex justify-between">
                        <span>COORD: {latitude}, {longitude}</span>
                        <span>ALT: 914m</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* System Log Feed */}
                <div className="border border-outline-variant bg-surface-container p-4 h-[256px] overflow-hidden flex flex-col font-mono">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[10px] text-on-surface-variant font-bold">[ SYSTEM_LOG_FEED ]</span>
                    <div className="w-2 h-2 rounded-full bg-tertiary-fixed-dim animate-pulse"></div>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-1 text-[10px] text-on-surface-variant terminal-scroll">
                    {predictorLogs.map((log, index) => {
                      const isResult = log.includes("[RESULT]");
                      const isErr = log.includes("[ERROR]");
                      const colorClass = isResult
                        ? "text-primary-fixed-dim font-bold"
                        : isErr
                        ? "text-error"
                        : "";
                      return (
                        <div key={index} className={`flex gap-2 ${colorClass}`}>
                          <span>{log}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 pt-3 border-t border-outline-variant flex gap-2 items-center text-[9px] text-on-surface-variant opacity-60">
                    <span className="text-primary-fixed-dim font-bold">&gt;</span>
                    <span className="caret"></span>
                    <span>AWAITING INSTRUCTION_</span>
                  </div>
                </div>

              </div>

            </div>
          </div>

          {/* Footer Metadata */}
          <footer className="mt-6 pt-4 border-t border-outline-variant flex justify-between items-center text-[9px] text-outline uppercase tracking-wider font-mono">
            <span>© 2026 ENFORCEMENT INTEL. ENGINE CODES SECURE.</span>
            <span>SHAP_KERNEL: ACTIVE // XGB_TREES: 100</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
