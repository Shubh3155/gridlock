'use client';

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../lib/firebase";

export default function SignupPage() {
  const router = useRouter();
  const [time, setTime] = useState<string>("00:00:00");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [statusText, setStatusText] = useState<string>("Enter registry data to request credentials");
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

  // Submit request access form
  async function handleSignupSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setStatusText("ERROR: ALL FIELDS ARE REQUIRED");
      return;
    }

    setIsPending(true);
    setStatusText("TRANSMITTING_REGISTRY_REQUEST...");

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      setStatusText("REGISTRY_CREATED_SUCCESS");

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
      console.error("Signup error:", err);
      let errMsg = "REGISTRY_FAILED: " + (err.message || "UNKNOWN ERROR");
      if (err.code === "auth/email-already-in-use") {
        errMsg = "ERROR: EMAIL ALREADY REGISTERED";
      } else if (err.code === "auth/invalid-email") {
        errMsg = "ERROR: INVALID EMAIL FORMAT";
      } else if (err.code === "auth/weak-password") {
        errMsg = "ERROR: PASSWORD TOO WEAK";
      }
      setStatusText(errMsg);
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
                <span className="text-[10px] text-primary-fixed-dim">[ FIG. 02 ]</span>
                <h2 className="text-xs uppercase tracking-[0.2em] font-bold">REGISTRY_GATE</h2>
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

              <form onSubmit={handleSignupSubmit} className="space-y-4">
                
                {/* Email input */}
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
                    ACCESS_CODE (PASSWORD)
                  </label>
                  <div className="relative flex items-center border border-outline-variant focus-within:border-primary-fixed-dim transition-all bg-surface-container-low focus-within:shadow-[0_0_10px_rgba(0,240,255,0.15)]">
                    <span className="pl-3 text-primary-fixed-dim font-bold text-xs">&gt;</span>
                    <input
                      className="w-full bg-transparent border-none outline-none focus:ring-0 text-xs py-2.5 px-2 text-foreground font-mono"
                      placeholder="••••••••"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Submit Actions */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isPending}
                    className="w-full bg-primary-fixed-dim text-surface py-2.5 font-bold uppercase text-xs tracking-widest hover:bg-primary-container transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <span>INITIALIZE_REGISTRY</span>
                    <span className="material-symbols-outlined text-sm">send</span>
                  </button>
                </div>
              </form>

              {/* Card Links */}
              <div className="pt-4 flex flex-col items-center gap-2 border-t border-outline-variant/30 text-[10px] tracking-wide uppercase">
                <p className="text-outline">
                  AWAITING_ACTIVATION?{" "}
                  <Link href="/login" className="text-primary-fixed-dim hover:underline font-bold">
                    LOGIN_HERE
                  </Link>
                </p>
              </div>
            </div>

            {/* Card Footer */}
            <div className="px-4 py-2 bg-surface-container-low border-t border-outline-variant flex justify-between text-[9px] text-outline uppercase tracking-wider">
              <span>REGISTRY_TUNNEL_ACTIVE</span>
              <span>v4.2.0-STABLE</span>
            </div>
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
