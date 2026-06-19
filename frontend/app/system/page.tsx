'use client';

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { auth } from "../../lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { UserSession } from "../../lib/types";

// Import Components
import Navbar from "../../components/Navbar";
import Sidebar from "../../components/Sidebar";

// Audio Synth Beep Helper (pure Web Audio API, no external files)
function playBeep(type: "eat" | "die" | "turn") {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === "eat") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } else if (type === "die") {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else if (type === "turn") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.02);
      osc.start();
      osc.stop(ctx.currentTime + 0.02);
    }
  } catch (e) {
    console.error("Audio synth error:", e);
  }
}

export default function SystemPage() {
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
  const [activeTab, setActiveTab] = useState<string>("system");
  const [cmdValue, setCmdValue] = useState<string>("");
  const [logs, setLogs] = useState<string[]>([
    "[SYSTEM] Diagnostic Mode Engaged.",
    "[SYSTEM] Watchdog daemon active on node_7G.",
    "[SYSTEM] Awaiting diagnostic parameters...",
    "[INFO] Easter Egg: Type 'snake' anywhere on this window to run diagnostic game.",
  ]);

  // Snake Game States
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [snake, setSnake] = useState<{ x: number; y: number }[]>([]);
  const [food, setFood] = useState<{ x: number; y: number }>({ x: 5, y: 5 });
  const [direction, setDirection] = useState<"UP" | "DOWN" | "LEFT" | "RIGHT">("RIGHT");
  const [score, setScore] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(0);
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [inputSequence, setInputSequence] = useState<string>("");

  const gameIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const directionRef = useRef(direction);

  // Sync ref with state to prevent React closure stale states in interval
  useEffect(() => {
    directionRef.current = direction;
  }, [direction]);

  // 1. Auth synchronization
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const session = {
          session_id: "local-session",
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          display_name: firebaseUser.displayName,
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
            setUser(null);
          }
        } else {
          setUser(null);
        }
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 1b. Check for start query parameter to launch snake game
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("start") === "true") {
        initializeGame();
        const newUrl = window.location.pathname;
        window.history.replaceState({}, "", newUrl);
      }
    }
  }, []);

  // 1c. Auto-start game for unauthenticated users
  useEffect(() => {
    if (!isLoading && !user && !isPlaying && !isGameOver) {
      initializeGame();
    }
  }, [isLoading, user, isPlaying, isGameOver]);


  // 2. Global window keyboard listener for detecting 'snake' typing easter egg
  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if (isPlaying) {
        // Game active, capture steering controls
        const key = e.key;
        if ((key === "ArrowUp" || key === "w") && directionRef.current !== "DOWN") {
          e.preventDefault();
          setDirection("UP");
          playBeep("turn");
        } else if ((key === "ArrowDown" || key === "s") && directionRef.current !== "UP") {
          e.preventDefault();
          setDirection("DOWN");
          playBeep("turn");
        } else if ((key === "ArrowLeft" || key === "a") && directionRef.current !== "RIGHT") {
          e.preventDefault();
          setDirection("LEFT");
          playBeep("turn");
        } else if ((key === "ArrowRight" || key === "d") && directionRef.current !== "LEFT") {
          e.preventDefault();
          setDirection("RIGHT");
          playBeep("turn");
        } else if (key === "Escape") {
          e.preventDefault();
          endGame();
        } else if (key === "Enter" && isGameOver) {
          e.preventDefault();
          restartGame();
        }
        return;
      }

      // Check easter egg typing
      const char = e.key.toLowerCase();
      if (char.length === 1 && /[a-z]/.test(char)) {
        setInputSequence((prev) => {
          const next = (prev + char).slice(-5);
          if (next === "snake") {
            initializeGame();
            return "";
          }
          return next;
        });
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [isPlaying, isGameOver]);

  // 3. Main Game Loop interval
  useEffect(() => {
    if (isPlaying && !isGameOver) {
      gameIntervalRef.current = setInterval(moveSnake, 120);
    }
    return () => {
      if (gameIntervalRef.current) clearInterval(gameIntervalRef.current);
    };
  }, [isPlaying, isGameOver, snake, food]);

  function addLog(text: string) {
    setLogs((prev) => [...prev.slice(-30), text]);
  }

  // Handle sidebar clicks
  function handleTabChange(tab: string) {
    setActiveTab(tab);
    if (tab === "dashboard") {
      router.push("/dashboard");
    } else if (tab === "enforcement") {
      router.push("/live-predictor");
    }
  }

  // Handle command console input
  function handleCmdSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!cmdValue.trim()) return;
    const cmd = cmdValue.trim().toLowerCase();
    addLog(`&gt; ${cmdValue}`);
    setCmdValue("");

    if (cmd === "help") {
      addLog("Available commands: [snake, exit, clear]");
    } else if (cmd === "snake") {
      initializeGame();
    } else if (cmd === "exit") {
      endGame();
    } else if (cmd === "clear") {
      setLogs([]);
    } else {
      addLog(`[ERROR] Command failed: '${cmd}'`);
    }
  }

  // Snake Game Operations
  function initializeGame() {
    setIsPlaying(true);
    setIsGameOver(false);
    setScore(0);
    setDirection("RIGHT");
    // Start with 3 blocks
    setSnake([
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
    ]);
    spawnFood();
    addLog("[SYSTEM] Initiating Console Diagnostic Subsystem: SNAKE_GAME v1.0");
  }

  function restartGame() {
    setIsGameOver(false);
    setScore(0);
    setDirection("RIGHT");
    setSnake([
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
    ]);
    spawnFood();
  }

  function endGame() {
    setIsPlaying(false);
    setIsGameOver(false);
    if (gameIntervalRef.current) clearInterval(gameIntervalRef.current);
    addLog("[SYSTEM] Diagnostic Subsystem terminated. Normal telemetry resumed.");
  }

  function spawnFood() {
    // 20x20 grid (0 to 19 coordinates)
    const newFood = {
      x: Math.floor(Math.random() * 20),
      y: Math.floor(Math.random() * 20),
    };
    setFood(newFood);
  }

  function moveSnake() {
    if (snake.length === 0) return;

    // Calculate next head coordinate
    const head = snake[0];
    let nextHead = { ...head };

    switch (directionRef.current) {
      case "UP":
        nextHead.y -= 1;
        break;
      case "DOWN":
        nextHead.y += 1;
        break;
      case "LEFT":
        nextHead.x -= 1;
        break;
      case "RIGHT":
        nextHead.x += 1;
        break;
    }

    // Border Collision Check (warp snake to opposite border or end game, Stitch noir defaults to game over)
    if (nextHead.x < 0 || nextHead.x >= 20 || nextHead.y < 0 || nextHead.y >= 20) {
      triggerGameOver();
      return;
    }

    // Self Collision Check
    for (let i = 0; i < snake.length; i++) {
      if (snake[i].x === nextHead.x && snake[i].y === nextHead.y) {
        triggerGameOver();
        return;
      }
    }

    const newSnake = [nextHead, ...snake];

    // Food Collision Check
    if (nextHead.x === food.x && nextHead.y === food.y) {
      playBeep("eat");
      const newScore = score + 10;
      setScore(newScore);
      if (newScore > highScore) {
        setHighScore(newScore);
      }
      spawnFood();
    } else {
      newSnake.pop(); // remove tail
    }

    setSnake(newSnake);
  }

  function triggerGameOver() {
    playBeep("die");
    setIsGameOver(true);
    addLog(`[SYSTEM] GAME OVER // FINAL_DIAGNOSTIC_SCORE: ${score}`);
  }

  // Render Grid
  const gridCells = [];
  for (let y = 0; y < 20; y++) {
    for (let x = 0; x < 20; x++) {
      const isSnakePart = snake.some((segment) => segment.x === x && segment.y === y);
      const isSnakeHead = snake.length > 0 && snake[0].x === x && snake[0].y === y;
      const isFood = food.x === x && food.y === y;

      gridCells.push(
        <div
          key={`${x}-${y}`}
          className={`h-full w-full border border-surface/20 transition-all ${
            isSnakeHead
              ? "bg-primary-fixed-dim shadow-[0_0_8px_#00dbe9]"
              : isSnakePart
              ? "bg-primary-fixed-dim/60"
              : isFood
              ? "bg-secondary-container animate-pulse shadow-[0_0_8px_#feb700]"
              : "bg-surface-container-lowest/30"
          }`}
        />
      );
    }
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
        {user && (
          <Sidebar
            user={user}
            activeTab={activeTab}
            onTabChange={handleTabChange}
            onTriggerScan={initializeGame}
          />
        )}

        {/* Diagnostic Panel operational content */}
        <main className="flex-1 relative overflow-y-auto p-6 flex flex-col justify-between font-mono">
          <div>
            {/* Header */}
            <div className="mb-6 border-b border-outline-variant pb-3 flex justify-between items-end">
              <div>
                <h1 className="text-xl font-bold tracking-tighter uppercase font-mono">
                  SYSTEM_DIAGNOSTICS (02)
                </h1>
                <p className="text-[10px] text-on-surface-variant uppercase mt-1 opacity-70">
                  KERNEL_STATUS: ACTIVE // STACK: DEPLOYED
                </p>
              </div>
              <div className="text-right text-[9px] text-primary-fixed-dim">
                TIME: <span className="font-bold">2026-06-19</span>
                <br />
                DIAG_LEVEL: FULL
              </div>
            </div>

            {/* Grid display layout */}
            <div className={user ? "grid grid-cols-12 gap-6" : "flex flex-col items-center justify-center my-8"}>
              
              {/* Left Column: Diagnostics monitor block */}
              <div className={user ? "col-span-12 lg:col-span-7" : "col-span-12 w-full max-w-xl mx-auto"}>
                <div className="border border-outline-variant bg-surface-container p-4 relative min-h-[460px] flex flex-col justify-between">
                  <div className="border-b border-outline-variant pb-2 mb-4 flex justify-between items-center bg-surface-container-high -mx-4 -mt-4 px-4 py-2">
                    <span className="text-[10px] text-primary-fixed-dim font-bold uppercase tracking-wider">
                      SYS_MONITOR_0.1 // {isPlaying ? "CONSOLE_DIAGNOSTIC_ACTIVE" : "CONSOLE_TELEMETRY"}
                    </span>
                    {isPlaying && (
                      <span className="text-[9px] text-secondary-container font-bold tracking-widest animate-pulse">
                        [ SCORE: {score} // HI_SCORE: {highScore} ]
                      </span>
                    )}
                  </div>

                  {isPlaying ? (
                    /* The Active Snake Game Board */
                    <div className="flex-1 flex flex-col items-center justify-center relative">
                      {isGameOver ? (
                        <div className="absolute inset-0 bg-black/80 backdrop-blur-xs z-20 flex flex-col items-center justify-center text-center p-4">
                          <h2 className="text-xl font-extrabold text-error tracking-widest mb-3 animate-pulse">
                            DIAGNOSTIC FAILURE // GAME OVER
                          </h2>
                          <p className="text-xs text-on-surface-variant max-w-xs leading-relaxed mb-6 uppercase">
                            Snake crashed into sector boundary or body segment. 
                            Diagnostic Score: {score}.
                          </p>
                          <div className="flex gap-4">
                            <button
                              onClick={restartGame}
                              className="bg-primary-container text-on-primary-container px-6 py-2 text-xs font-bold uppercase tracking-widest hover:opacity-85"
                            >
                              [ENTER] RESTART
                            </button>
                            <button
                              onClick={endGame}
                              className="border border-outline-variant text-on-surface-variant px-6 py-2 text-xs font-bold uppercase hover:bg-surface-container-high"
                            >
                              [ESC] EXIT
                            </button>
                          </div>
                        </div>
                      ) : null}

                      {/* 20x20 Snake Board grid container */}
                      <div className="w-[340px] h-[340px] md:w-[380px] md:h-[380px] grid grid-cols-20 grid-rows-20 border border-outline-variant bg-black/60 p-0.5">
                        {gridCells}
                      </div>

                      <div className="text-[9px] text-on-surface-variant mt-4 uppercase opacity-60">
                        Steer with arrow keys or WASD // ESC to exit diagnostics
                      </div>
                    </div>
                  ) : (
                    /* Idle Diagnostic Console view showing telemetry logs */
                    <div className="flex-grow flex flex-col justify-between py-12">
                      <div className="max-w-md mx-auto text-center space-y-4">
                        <div className="w-12 h-12 border border-primary-fixed-dim/30 flex items-center justify-center mx-auto bg-primary-fixed-dim/5 text-primary-fixed-dim animate-pulse">
                          <span className="material-symbols-outlined text-2xl">developer_board</span>
                        </div>
                        <h2 className="text-sm font-bold text-primary-fixed-dim uppercase tracking-widest">
                          System Diagnostic Console
                        </h2>
                        <p className="text-xs text-on-surface-variant leading-relaxed uppercase">
                          Console is currently idling. Telemetry pipelines are scanning sectors correctly. 
                          Type "snake" on your keyboard to run terminal capability game scans.
                        </p>
                        <button
                          onClick={initializeGame}
                          className="px-6 py-2 border border-primary-fixed-dim text-primary-fixed-dim text-xs font-bold hover:bg-primary-fixed-dim/10 transition-colors uppercase tracking-widest"
                        >
                          [ INITIALIZE_SCAN ]
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="border-t border-outline-variant pt-2 mt-4 flex justify-between text-[9px] text-outline uppercase tracking-wider">
                    <span>SECTOR_SURVEILLANCE_ONLINE</span>
                    <span>DIAGNOSTIC_v1.0</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Diagnostic Logs and Sector parameters */}
              {user && (
                <div className="col-span-12 lg:col-span-5 space-y-6">
                  
                  {/* Sector health indicators */}
                  <div className="border border-outline-variant bg-surface-container p-4 font-mono text-xs">
                    <div className="text-[10px] text-primary-fixed-dim uppercase font-bold mb-3 tracking-wider">
                      SECTOR_NODE_HEALTH
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between border-b border-outline-variant/40 pb-1">
                        <span className="text-on-surface-variant">NODE_7G (Central)</span>
                        <span className="text-tertiary-fixed-dim font-bold">100% OPERATIONAL</span>
                      </div>
                      <div className="flex justify-between border-b border-outline-variant/40 pb-1">
                        <span className="text-on-surface-variant">NODE_5B (East)</span>
                        <span className="text-tertiary-fixed-dim font-bold">100% OPERATIONAL</span>
                      </div>
                      <div className="flex justify-between border-b border-outline-variant/40 pb-1">
                        <span className="text-on-surface-variant">XGB_SERVER_POOL</span>
                        <span className="text-primary-fixed-dim font-bold">SYNCED (14ms)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-on-surface-variant">DB_MUTATION_WRITE</span>
                        <span className="text-secondary-container font-bold">ALLOWED</span>
                      </div>
                    </div>
                  </div>

                  {/* Log feed */}
                  <div className="border border-outline-variant bg-surface-container p-4 h-[260px] overflow-hidden flex flex-col font-mono">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-[10px] text-on-surface-variant font-bold">[ TELEMETRY_STREAM ]</span>
                      <div className="w-2 h-2 rounded-full bg-tertiary-fixed-dim animate-pulse"></div>
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-1 text-[10px] text-on-surface-variant terminal-scroll">
                      {logs.map((log, index) => (
                        <div key={index} className="leading-snug">
                          {log}
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 pt-3 border-t border-outline-variant flex gap-2 items-center text-[9px] text-on-surface-variant opacity-60">
                      <span className="text-primary-fixed-dim font-bold">&gt;</span>
                      <span className="caret"></span>
                      <span>AWAITING INSTRUCTION_</span>
                    </div>
                  </div>

                </div>
              )}

            </div>
          </div>

          <footer className="mt-6 pt-4 border-t border-outline-variant flex justify-between items-center text-[9px] text-outline uppercase tracking-wider font-mono">
            <span>© 2026 ENFORCEMENT INTEL. ENGINE DIAGNOSTICS SECURE.</span>
            <span>KERNEL_PINGS: OK // MEMORY: STABLE</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
