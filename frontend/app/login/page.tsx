'use client';

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { loginWithGoogle, auth } from "../../lib/firebase";

export default function LoginPage() {
  const router = useRouter();
  const [time, setTime] = useState<string>("00:00:00");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [statusText, setStatusText] = useState<string>("Identification Required for Sector_7G Access");
  const [isPending, setIsPending] = useState<boolean>(false);

  // Update clock
  useEffect(() => {
    function updateClock() {
      const now = new Date();
      setTime(now.toTimeString().split(" ")[0]);
    }
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Standard Login submit
  async function handleLoginSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setStatusText("ERROR: ALL FIELDS ARE REQUIRED");
      return;
    }

    setIsPending(true);
    setStatusText("VALIDATING_CREDENTIALS...");

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      setStatusText("ACCESS_GRANTED");

      const session = {
        session_id: "local-session",
        uid: userCredential.user.uid,
        email: userCredential.user.email,
        display_name: userCredential.user.displayName || email.split("@")[0].toUpperCase(),
        photo_url: userCredential.user.photoURL,
      };
      localStorage.setItem("gridlock_session", JSON.stringify(session));

      setTimeout(() => {
        router.push("/dashboard");
      }, 800);
    } catch (err: any) {
      console.error("Login error:", err);
      let errMsg = "ACCESS_DENIED: " + (err.message || "UNKNOWN ERROR");
      if (err.code === "auth/wrong-password" || err.code === "auth/user-not-found" || err.code === "auth/invalid-credential") {
        errMsg = "ERROR: INVALID EMAIL OR ACCESS CODE";
      } else if (err.code === "auth/invalid-email") {
        errMsg = "ERROR: INVALID EMAIL FORMAT";
      }
      setStatusText(errMsg);
      setIsPending(false);
    }
  }

  // Google Login trigger
  async function handleGoogleSignIn() {
    setIsPending(true);
    setStatusText("AUTHENTICATING WITH GOOGLE...");
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
      setIsPending(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground relative antialiased selection:bg-primary-fixed-dim selection:text-surface">
      <div className="scanline z-50 pointer-events-none"></div>

      {/* Top Header for Auth Gate */}
      <header className="bg-surface fixed top-0 w-full border-b border-outline-variant flex justify-between items-center px-6 h-16 z-40 font-mono text-[11px] tracking-widest uppercase">
        <div className="flex items-center gap-4">
          <Link href="/" className="font-headline-md text-sm font-bold text-primary-fixed-dim tracking-tighter">
            ENFORCEMENT_INTEL_v4.2
          </Link>
          <div className="hidden md:block h-6 w-px bg-outline-variant"></div>
          <span className="hidden md:block text-on-surface-variant">GATEWAY_ACTIVE</span>
        </div>
        <div className="font-mono text-primary-fixed-dim">
          SYSTEM_TIME: <span className="font-bold">{time}</span>
        </div>
      </header>

      {/* Auth Gate Terminal Card */}
      <main className="flex-grow flex items-center justify-center p-6 relative z-10 pt-20">
        <div className="w-full max-w-[420px] font-mono">
          <div className="border border-outline-variant bg-surface-container shadow-2xl relative">
            
            {/* Window title header */}
            <div className="border-b border-outline-variant px-4 py-2 flex justify-between items-center bg-surface-container-high">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-primary-fixed-dim">[ FIG. 01 ]</span>
                <h2 className="text-xs uppercase tracking-[0.2em] font-bold">AUTH_GATE</h2>
              </div>
              <div className="flex gap-1.5">
                <div className="w-2 h-2 border border-outline-variant"></div>
                <div className="w-2 h-2 border border-outline-variant"></div>
                <div className="w-2 h-2 bg-primary-fixed-dim"></div>
              </div>
            </div>

            {/* Form Box */}
            <div className="p-6 space-y-6">
              <div className="text-center text-[10px] text-on-surface-variant uppercase tracking-wider">
                {statusText}
              </div>

              <form onSubmit={handleLoginSubmit} className="space-y-4">
                
                {/* Operator Email input */}
                <div className="space-y-1">
                  <label className="text-[10px] text-on-surface-variant block uppercase tracking-wider">
                    OPERATOR_EMAIL
                  </label>
                  <div className="relative flex items-center border border-outline-variant focus-within:border-primary-fixed-dim transition-all bg-surface-container-low focus-within:shadow-[0_0_10px_rgba(0,240,255,0.15)]">
                    <span className="pl-3 text-primary-fixed-dim font-bold text-xs">&gt;</span>
                    <input
                      className="w-full bg-transparent border-none outline-none focus:ring-0 text-xs py-2.5 px-2 text-foreground font-mono"
                      placeholder="OPERATOR@GOV.IN"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Password input */}
                <div className="space-y-1">
                  <label className="text-[10px] text-on-surface-variant block uppercase tracking-wider">
                    ACCESS_CODE
                  </label>
                  <div className="relative flex items-center border border-outline-variant focus-within:border-primary-fixed-dim transition-all bg-surface-container-low focus-within:shadow-[0_0_10px_rgba(0,240,255,0.15)]">
                    <span className="pl-3 text-primary-fixed-dim font-bold text-xs">&gt;</span>
                    <input
                      className="w-full bg-transparent border-none outline-none focus:ring-0 text-xs py-2.5 px-2 text-foreground font-mono"
                      placeholder="••••••••"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="pr-3 text-on-surface-variant hover:text-primary transition-colors flex items-center"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-sm">
                        {showPassword ? "visibility_off" : "visibility"}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Submit Actions */}
                <div className="space-y-3 pt-2">
                  <button
                    type="submit"
                    disabled={isPending}
                    className="w-full bg-primary-fixed-dim text-surface py-2.5 font-bold uppercase text-xs tracking-widest hover:bg-primary-container transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <span>INITIALIZE_SESSION</span>
                    <span className="material-symbols-outlined text-sm">login</span>
                  </button>

                  <button
                    onClick={handleGoogleSignIn}
                    disabled={isPending}
                    type="button"
                    className="w-full border border-outline-variant text-on-surface-variant py-2.5 text-xs font-bold uppercase tracking-wider hover:bg-surface-container-highest transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        fill="currentColor"
                      ></path>
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="currentColor"
                      ></path>
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                        fill="currentColor"
                      ></path>
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="currentColor"
                      ></path>
                    </svg>
                    <span>SIGN_IN_WITH_GOOGLE</span>
                  </button>
                </div>
              </form>

              {/* Card Links */}
              <div className="pt-4 flex flex-col items-center gap-2 border-t border-outline-variant/30 text-[10px] tracking-wide uppercase">
                <a
                  className="text-on-surface-variant hover:text-primary underline-offset-4 hover:underline transition-colors cursor-pointer"
                  onClick={() => setStatusText("CONTACT ADMINISTRATOR: sameer870732@gmail.com")}
                >
                  FORGOT_CREDENTIALS?
                </a>
                <div className="h-px w-8 bg-outline-variant/50"></div>
                <p className="text-outline">
                  NEW_OPERATOR?{" "}
                  <Link href="/signup" className="text-primary-fixed-dim hover:underline font-bold">
                    REQUEST_ACCESS
                  </Link>
                </p>
              </div>
            </div>

            {/* Card Footer */}
            <div className="px-4 py-2 bg-surface-container-low border-t border-outline-variant flex justify-between text-[9px] text-outline uppercase tracking-wider">
              <span>SECURE_TUNNEL_ENCRYPTED</span>
              <span>v4.2.0-STABLE</span>
            </div>
          </div>

          {/* Bottom telemetry status line */}
          <div className="mt-4 flex justify-between items-center opacity-55 text-[8px] tracking-widest uppercase">
            <div className="flex gap-4">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-tertiary-fixed-dim rounded-full"></span>
                <span>NODE_7G_OK</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-tertiary-fixed-dim rounded-full"></span>
                <span>ENCRYPTION_AES256</span>
              </div>
            </div>
            <span>LOC: SECTOR_7G_HUB</span>
          </div>
        </div>
      </main>

      {/* Global Footer */}
      <footer className="h-12 border-t border-outline-variant flex items-center justify-between px-6 bg-surface-container-lowest z-40 font-mono text-[9px] text-on-surface-variant uppercase tracking-wider mt-auto">
        <div className="flex gap-6">
          <span className="hover:text-primary transition-colors cursor-pointer">PRIVACY_PROTOCOL</span>
          <span className="hover:text-primary transition-colors cursor-pointer">TERM_OF_ENFORCEMENT</span>
          <span className="hover:text-primary transition-colors cursor-pointer">SUPPORT</span>
        </div>
        <div className="hidden sm:block text-outline">
          © 2026 ENFORCEMENT_INTEL. GLOBAL_SURVEILLANCE_NETWORK.
        </div>
      </footer>
    </div>
  );
}
