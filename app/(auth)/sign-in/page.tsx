"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Shield,
  QrCode,
  Camera,
  LogIn,
  AlertCircle,
  KeyRound,
  User,
  Zap,
} from "lucide-react";

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect_url") || "";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e?: React.FormEvent, customUser?: string, customPass?: string) => {
    if (e) e.preventDefault();
    setError(null);
    setLoading(true);

    const userToSubmit = customUser || username;
    const passToSubmit = customPass || password;

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: userToSubmit, password: passToSubmit }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error?.message || "Invalid credentials");
      }

      // Route to destination
      const destination = redirectUrl || data.redirectUrl || "/";
      router.push(destination);
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Failed to sign in. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (role: "admin" | "scanner" | "student") => {
    if (role === "admin") {
      setUsername("admin");
      setPassword("admin123");
      handleLogin(undefined, "admin", "admin123");
    } else if (role === "scanner") {
      setUsername("scanner");
      setPassword("scanner123");
      handleLogin(undefined, "scanner", "scanner123");
    } else {
      setUsername("student");
      setPassword("student123");
      handleLogin(undefined, "student", "student123");
    }
  };

  return (
    <div className="w-full max-w-md bg-surface border border-border shadow-2xl rounded-card p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="text-center space-y-1.5">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-surface-raised border border-border mb-1 text-accent font-mono font-bold text-xl shadow-sm">
          LP
        </div>
        <h1 className="text-xl font-bold text-whitesmoke tracking-tight">Institutional Sign In</h1>
        <p className="text-xs text-ash">Central Library & Hostel Digital Pass System</p>
      </div>

      {/* Quick Demo 1-Click Buttons */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-sand font-medium">
          <span className="flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-accent" />
            <span>Instant 1-Click Demo Login</span>
          </span>
          <span className="text-[10px] text-ash">Pre-configured</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => handleQuickLogin("student")}
            className="p-2.5 rounded-lg bg-surface-raised hover:bg-border border border-border hover:border-accent/50 text-left transition-all group"
          >
            <QrCode className="w-4 h-4 text-accent mb-1 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-semibold text-whitesmoke block">Student</span>
            <span className="text-[10px] text-ash font-mono">student123</span>
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => handleQuickLogin("scanner")}
            className="p-2.5 rounded-lg bg-surface-raised hover:bg-border border border-border hover:border-sand/50 text-left transition-all group"
          >
            <Camera className="w-4 h-4 text-sand mb-1 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-semibold text-whitesmoke block">Scanner</span>
            <span className="text-[10px] text-ash font-mono">scanner123</span>
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => handleQuickLogin("admin")}
            className="p-2.5 rounded-lg bg-surface-raised hover:bg-border border border-border hover:border-success/50 text-left transition-all group"
          >
            <Shield className="w-4 h-4 text-success mb-1 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-semibold text-whitesmoke block">Admin</span>
            <span className="text-[10px] text-ash font-mono">admin123</span>
          </button>
        </div>
      </div>

      <div className="relative flex items-center justify-center">
        <div className="border-t border-border w-full" />
        <span className="bg-surface px-3 text-[11px] text-ash uppercase font-mono tracking-wider absolute">
          or enter credentials
        </span>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-danger text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Standard Form */}
      <form onSubmit={handleLogin} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-ash flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-sand" />
            <span>Username or Roll Number</span>
          </label>
          <input
            type="text"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. admin, scanner, or student"
            className="w-full bg-surface-raised border border-border text-whitesmoke rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-all font-mono"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-ash flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5 text-sand" />
            <span>Password or Hash Code</span>
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••••"
            className="w-full bg-surface-raised border border-border text-whitesmoke rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-all font-mono"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 px-4 rounded-lg bg-accent hover:bg-accent-hover text-black font-semibold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-md mt-2"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
              <span>Verifying...</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-2">
              <LogIn className="w-4 h-4" />
              <span>Sign In Securely</span>
            </span>
          )}
        </button>
      </form>
    </div>
  );
}

export default function SignInPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-bg text-whitesmoke">
      {/* Back to Landing Link */}
      <div className="w-full max-w-md mb-4 flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-ash hover:text-whitesmoke transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Portals Overview</span>
        </Link>
        <span className="text-[11px] font-mono text-sand bg-sand-muted px-2 py-0.5 rounded border border-sand/20">
          Campus Portal
        </span>
      </div>

      <Suspense
        fallback={
          <div className="w-full max-w-md bg-surface border border-border rounded-card p-8 text-center text-ash text-xs">
            Loading sign in...
          </div>
        }
      >
        <SignInForm />
      </Suspense>

      <p className="mt-6 text-[11px] text-ash text-center max-w-xs leading-relaxed">
        Offline-ready authentication. Passwords and initial hash codes are validated against local records.
      </p>
    </div>
  );
}
