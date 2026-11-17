"use client";

import React, { useState, useEffect } from "react";
import {
  Camera,
  QrCode,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Shield,
  Volume2,
  VolumeX,
  History,
  RotateCcw,
  Search,
  Sparkles,
  Loader2,
  ArrowRightLeft,
  Users,
} from "lucide-react";
import Link from "next/link";

interface ScanResult {
  status: "ACCEPTED" | "DUPLICATE" | "REJECTED";
  message: string;
  eventType?: string;
  targetInLibrary?: 0 | 1;
  student?: {
    fullName: string;
    rollNumber: string;
    category: string;
    department: string;
    inLibrary: 0 | 1;
  };
  reasonCode?: string;
  timestamp: string;
}

const CHECKPOINTS = [
  { id: "cp-main", name: "Central Library Main Gate (Both)", type: "LIBRARY_BOTH" },
  { id: "cp-north", name: "North Turnstile (Entry Only)", type: "LIBRARY_ENTRY" },
  { id: "cp-south", name: "South Turnstile (Exit Only)", type: "LIBRARY_EXIT" },
];

export default function ScannerView() {
  const [selectedCheckpoint, setSelectedCheckpoint] = useState("cp-main");
  const [scanMode, setScanMode] = useState<"AUTO" | "ENTRY_ONLY" | "EXIT_ONLY">("AUTO");
  const [rollInput, setRollInput] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [lastResult, setLastResult] = useState<ScanResult | null>(null);
  const [history, setHistory] = useState<ScanResult[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Shift counters
  const [counters, setCounters] = useState({
    entries: 0,
    exits: 0,
    rejections: 0,
  });

  const handleScanSubmit = async (payload: { rollNumber?: string; token?: string }) => {
    setIsScanning(true);
    try {
      const res = await fetch("/api/scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkpointId: selectedCheckpoint,
          mode: scanMode,
          rollNumber: payload.rollNumber || undefined,
          token: payload.token || undefined,
        }),
      });

      const data = await res.json();
      const result: ScanResult = {
        status: data.status || "REJECTED",
        message: data.message || "Unknown scan status",
        eventType: data.eventType,
        targetInLibrary: data.targetInLibrary,
        student: data.student,
        reasonCode: data.reasonCode,
        timestamp: new Date().toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      };

      setLastResult(result);
      setHistory((prev) => [result, ...prev.slice(0, 19)]);

      // Update counters
      if (result.status === "ACCEPTED") {
        if (result.eventType === "LIBRARY_ENTRY") {
          setCounters((c) => ({ ...c, entries: c.entries + 1 }));
        } else {
          setCounters((c) => ({ ...c, exits: c.exits + 1 }));
        }
      } else {
        setCounters((c) => ({ ...c, rejections: c.rejections + 1 }));
      }
    } catch (err: any) {
      setLastResult({
        status: "REJECTED",
        message: err.message || "Scan communication failure",
        reasonCode: "NETWORK_ERROR",
        timestamp: new Date().toLocaleTimeString(),
      });
    } finally {
      setIsScanning(false);
      setRollInput("");
      setTokenInput("");
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rollInput.trim() && !tokenInput.trim()) return;
    handleScanSubmit({
      rollNumber: rollInput.trim() || undefined,
      token: tokenInput.trim() || undefined,
    });
  };

  return (
    <div className="min-h-screen bg-bg text-whitesmoke flex flex-col justify-between selection:bg-accent selection:text-black">
      {/* Scanner Header */}
      <header className="bg-surface border-b border-border px-4 py-3 sticky top-0 z-30 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-accent text-bg flex items-center justify-center font-bold">
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-whitesmoke">Library Checkpoint Scanner</h1>
            <p className="text-[11px] text-ash">Transactional Movement Verification</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 rounded-lg bg-surface-raised border border-border text-ash hover:text-whitesmoke transition-colors"
            title={soundEnabled ? "Mute audio" : "Enable audio"}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-accent" /> : <VolumeX className="w-4 h-4" />}
          </button>
          <Link
            href="/admin/dashboard"
            className="px-3 py-1.5 rounded-lg bg-surface-raised border border-border text-xs text-sand hover:text-whitesmoke transition-colors"
          >
            Admin View
          </Link>
        </div>
      </header>

      {/* Main Scanner Workspace */}
      <main className="flex-1 p-4 max-w-4xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Viewfinder & Configuration (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Controls Bar: Checkpoint & Mode */}
          <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-ash uppercase tracking-wider block mb-1">
                  Active Checkpoint
                </label>
                <select
                  value={selectedCheckpoint}
                  onChange={(e) => setSelectedCheckpoint(e.target.value)}
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-xs text-whitesmoke focus:outline-none focus:border-accent"
                >
                  {CHECKPOINTS.map((cp) => (
                    <option key={cp.id} value={cp.id}>
                      {cp.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-medium text-ash uppercase tracking-wider block mb-1">
                  Scanner Mode
                </label>
                <select
                  value={scanMode}
                  onChange={(e) => setScanMode(e.target.value as any)}
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-xs text-whitesmoke focus:outline-none focus:border-accent"
                >
                  <option value="AUTO">Auto Toggle (Entry & Exit)</option>
                  <option value="ENTRY_ONLY">Entry Gate Only</option>
                  <option value="EXIT_ONLY">Exit Turnstile Only</option>
                </select>
              </div>
            </div>
          </div>

          {/* Interactive Camera Viewfinder Frame */}
          <div className="bg-surface border border-border rounded-2xl p-6 text-center space-y-4 relative overflow-hidden">
            <div className="aspect-square max-w-xs mx-auto bg-black rounded-2xl border-2 border-border relative flex flex-col items-center justify-center overflow-hidden shadow-2xl">
              {/* Scan target reticle */}
              <div className="absolute inset-8 border-2 border-dashed border-accent/70 rounded-xl pointer-events-none animate-pulse" />

              {/* Laser line animation */}
              <div className="absolute left-6 right-6 h-0.5 bg-accent shadow-[0_0_12px_#F28C28] animate-bounce" />

              <QrCode className="w-16 h-16 text-ash/60 mb-2" />
              <p className="text-xs font-semibold text-whitesmoke">Optical Scanner Active</p>
              <p className="text-[10px] text-ash max-w-[200px] mt-1">
                Align student rotating QR token within this target box
              </p>
            </div>

            {/* Quick Demo Scan Buttons */}
            <div className="space-y-2 pt-2">
              <span className="text-[11px] text-ash uppercase tracking-wider block font-semibold">
                Instant Test Barcodes (Click to Scan)
              </span>
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  onClick={() => handleScanSubmit({ rollNumber: "23CS1001" })}
                  disabled={isScanning}
                  className="px-3 py-1.5 rounded-lg bg-surface-raised border border-border hover:border-accent text-xs text-whitesmoke font-mono transition-colors flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-accent" />
                  <span>Aarav (23CS1001)</span>
                </button>
                <button
                  onClick={() => handleScanSubmit({ rollNumber: "23CS1002" })}
                  disabled={isScanning}
                  className="px-3 py-1.5 rounded-lg bg-surface-raised border border-border hover:border-accent text-xs text-whitesmoke font-mono transition-colors flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-sand" />
                  <span>Aditi (23CS1002)</span>
                </button>
                <button
                  onClick={() => handleScanSubmit({ rollNumber: "24CS1021" })}
                  disabled={isScanning}
                  className="px-3 py-1.5 rounded-lg bg-surface-raised border border-border hover:border-accent text-xs text-whitesmoke font-mono transition-colors flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-accent" />
                  <span>Gaurav (24CS1021)</span>
                </button>
              </div>
            </div>

            {/* Manual Roll Number Fallback */}
            <form onSubmit={handleManualSubmit} className="pt-3 border-t border-border flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-ash absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={rollInput}
                  onChange={(e) => setRollInput(e.target.value)}
                  placeholder="Or enter Roll Number manually (e.g. 23CS1001)..."
                  className="w-full bg-bg border border-border rounded-lg pl-9 pr-3 py-2 text-xs text-whitesmoke font-mono focus:outline-none focus:border-accent"
                />
              </div>
              <button
                type="submit"
                disabled={isScanning || !rollInput.trim()}
                className="px-4 py-2 rounded-lg bg-accent text-bg font-bold text-xs hover:bg-accent-hover disabled:opacity-40 transition-colors flex items-center gap-1.5"
              >
                {isScanning && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Validate</span>
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Scan Result & Live Shift History (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Shift Counters */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="bg-surface border border-border p-3 rounded-xl text-center">
              <span className="text-[10px] text-ash uppercase font-semibold">Entries</span>
              <div className="text-xl font-bold text-accent font-mono mt-0.5">{counters.entries}</div>
            </div>
            <div className="bg-surface border border-border p-3 rounded-xl text-center">
              <span className="text-[10px] text-ash uppercase font-semibold">Exits</span>
              <div className="text-xl font-bold text-sand font-mono mt-0.5">{counters.exits}</div>
            </div>
            <div className="bg-surface border border-border p-3 rounded-xl text-center">
              <span className="text-[10px] text-ash uppercase font-semibold">Rejections</span>
              <div className="text-xl font-bold text-red-400 font-mono mt-0.5">{counters.rejections}</div>
            </div>
          </div>

          {/* Dynamic Result Card */}
          {lastResult ? (
            <div
              className={`p-5 rounded-2xl border shadow-xl animate-in fade-in duration-200 ${
                lastResult.status === "ACCEPTED"
                  ? "bg-green-500/10 border-green-500/40 text-whitesmoke"
                  : lastResult.status === "DUPLICATE"
                  ? "bg-amber-500/10 border-amber-500/40 text-amber-200"
                  : "bg-red-500/10 border-red-500/40 text-red-200"
              }`}
            >
              <div className="flex items-start gap-3">
                {lastResult.status === "ACCEPTED" ? (
                  <CheckCircle2 className="w-6 h-6 text-green-400 shrink-0 mt-0.5" />
                ) : lastResult.status === "DUPLICATE" ? (
                  <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-6 h-6 text-red-400 shrink-0 mt-0.5" />
                )}

                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider">
                      {lastResult.status === "ACCEPTED"
                        ? lastResult.eventType === "LIBRARY_ENTRY"
                          ? "✓ Entry Granted (0 → 1)"
                          : "✓ Exit Recorded (1 → 0)"
                        : lastResult.status === "DUPLICATE"
                        ? "⚠ Duplicate Debounce (10s)"
                        : "✕ Scan Rejected"}
                    </span>
                    <span className="text-[10px] font-mono text-ash">{lastResult.timestamp}</span>
                  </div>

                  <p className="text-sm font-semibold">{lastResult.message}</p>

                  {lastResult.student && (
                    <div className="mt-3 pt-3 border-t border-border/40 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-ash uppercase block">Student</span>
                        <span className="font-bold text-whitesmoke">{lastResult.student.fullName}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-ash uppercase block">Roll Number</span>
                        <span className="font-mono text-sand font-bold">
                          {lastResult.student.rollNumber}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-ash uppercase block">Category</span>
                        <span>{lastResult.student.category}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-ash uppercase block">New Status</span>
                        <span
                          className={`font-semibold ${
                            lastResult.targetInLibrary === 1 ? "text-accent" : "text-ash"
                          }`}
                        >
                          {lastResult.targetInLibrary === 1 ? "1 • In Library" : "0 • Outside"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 bg-surface border border-border rounded-2xl text-center text-xs text-ash space-y-2">
              <Shield className="w-8 h-8 text-ash/40 mx-auto" />
              <p className="font-semibold text-whitesmoke">Waiting for Card Scan</p>
              <p>Scan a live rotating QR ID tag or use the test barcodes on the left.</p>
            </div>
          )}

          {/* Shift Scan Log Feed */}
          <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-whitesmoke flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-sand" />
                <span>Shift Scan Log</span>
              </h3>
              <span className="text-[10px] text-ash font-mono">{history.length} scans</span>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1 text-xs">
              {history.length > 0 ? (
                history.map((h, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-bg border border-border flex items-center justify-between"
                  >
                    <div>
                      <div className="font-semibold text-whitesmoke">
                        {h.student?.fullName || "Unregistered Card"}
                      </div>
                      <div className="text-[10px] text-ash font-mono">
                        {h.student?.rollNumber || "Unknown"} • {h.eventType || h.status}
                      </div>
                    </div>
                    <div className="text-right">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          h.status === "ACCEPTED"
                            ? "bg-green-500/15 text-green-400 border border-green-500/30"
                            : "bg-red-500/15 text-red-400 border border-red-500/30"
                        }`}
                      >
                        {h.status}
                      </span>
                      <div className="text-[10px] text-ash font-mono mt-0.5">{h.timestamp}</div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-ash text-[11px] py-4">No scans logged this shift yet.</p>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-surface border-t border-border px-4 py-2.5 text-center text-xs text-ash flex items-center justify-between">
        <span>Central Library Movement Terminal • Checkpoint: {selectedCheckpoint}</span>
        <span className="text-sand font-mono">Realtime Postgres State Machine Active</span>
      </footer>
    </div>
  );
}
