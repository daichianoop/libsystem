"use client";

import React, { useState, useEffect, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  ShieldCheck,
  RefreshCw,
  Sun,
  Download,
  Clock,
  MapPin,
  Sparkles,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";

interface IdTagProps {
  student: {
    id: string;
    fullName: string;
    rollNumber: string;
    category: string;
    department: string;
    hostel?: string | null;
    inLibrary: 0 | 1;
    lastScanAt?: string | null;
  };
  initialToken?: string;
  showSimulateScan?: boolean;
  onScanSimulated?: () => void;
}

export function IdTag({
  student,
  initialToken,
  showSimulateScan = true,
  onScanSimulated,
}: IdTagProps) {
  const [token, setToken] = useState(initialToken || `v1.${student.id}.demo.active_token`);
  const [timeLeft, setTimeLeft] = useState(30);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [brightnessBoost, setBrightnessBoost] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  // Fetch new token
  const fetchNewToken = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/tag/token");
      if (res.ok) {
        const data = await res.json();
        setToken(data.token);
        setTimeLeft(data.expiresInSeconds || 30);
      }
    } catch {
      // Keep existing token
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          fetchNewToken();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [fetchNewToken]);

  // Initial fetch
  useEffect(() => {
    fetchNewToken();
  }, [fetchNewToken]);

  // Instant simulate scan handler
  const handleSimulateScan = async () => {
    setScanMessage("Sending scan request...");
    try {
      const res = await fetch("/api/scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          rollNumber: student.rollNumber,
          checkpointId: "cp-main",
          mode: "AUTO",
        }),
      });
      const data = await res.json();
      if (res.ok && data.status === "ACCEPTED") {
        setScanMessage(`Success: ${data.message}`);
        if (onScanSimulated) onScanSimulated();
      } else {
        setScanMessage(data.message || "Scan simulation responded with non-200");
      }
    } catch (err: any) {
      setScanMessage(err.message || "Scan error");
    }
    setTimeout(() => setScanMessage(null), 4000);
  };

  const progressPercent = ((30 - timeLeft) / 30) * 100;

  return (
    <div
      className={`relative rounded-2xl border transition-all duration-300 max-w-sm mx-auto overflow-hidden shadow-2xl ${
        brightnessBoost ? "bg-white text-black border-white" : "bg-surface border-border text-whitesmoke"
      }`}
    >
      {/* Institutional Top Header */}
      <div
        className={`px-5 py-4 border-b flex items-center justify-between ${
          brightnessBoost ? "bg-neutral-100 border-neutral-300" : "bg-surface-raised border-border"
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-accent text-bg font-extrabold flex items-center justify-center text-xs tracking-wider font-mono">
            CL
          </div>
          <div>
            <h3
              className={`text-xs font-bold uppercase tracking-wider ${
                brightnessBoost ? "text-neutral-900" : "text-whitesmoke"
              }`}
            >
              Central Library
            </h3>
            <p className={`text-[10px] ${brightnessBoost ? "text-neutral-600" : "text-ash"}`}>
              Digital ID Pass & Movement Tag
            </p>
          </div>
        </div>

        {/* Live Status Pill */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
            student.inLibrary === 1
              ? "bg-accent/20 border-accent/50 text-accent"
              : brightnessBoost
              ? "bg-neutral-200 border-neutral-400 text-neutral-700"
              : "bg-bg border-border text-ash"
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              student.inLibrary === 1 ? "bg-accent animate-ping" : "bg-ash"
            }`}
          />
          <span>{student.inLibrary === 1 ? "1 • In Library" : "0 • Outside"}</span>
        </div>
      </div>

      {/* Pass Body */}
      <div className="p-6 text-center space-y-5">
        {/* Student Identification */}
        <div>
          <span
            className={`inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-full border mb-1.5 ${
              brightnessBoost
                ? "bg-amber-100 border-amber-300 text-amber-900"
                : "bg-sand-muted border-sand/30 text-sand"
            }`}
          >
            {student.category}
          </span>
          <h2
            className={`text-xl font-extrabold tracking-tight ${
              brightnessBoost ? "text-neutral-900" : "text-whitesmoke"
            }`}
          >
            {student.fullName}
          </h2>
          <p
            className={`font-mono text-xs font-semibold mt-0.5 ${
              brightnessBoost ? "text-amber-800" : "text-sand"
            }`}
          >
            {student.rollNumber}
          </p>
          <p className={`text-xs mt-1 ${brightnessBoost ? "text-neutral-600" : "text-ash"}`}>
            {student.department}
          </p>
        </div>

        {/* QR Code Container with High-Contrast White Background for Scanners */}
        <div className="relative inline-block p-4 bg-white rounded-2xl shadow-xl border border-neutral-300">
          <QRCodeSVG
            value={token}
            size={180}
            level="H"
            includeMargin={false}
            fgColor="#000000"
            bgColor="#ffffff"
          />

          {/* Central Security Logo Overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-10 h-10 rounded-full bg-accent border-2 border-white flex items-center justify-center shadow-md">
              <ShieldCheck className="w-5 h-5 text-bg" />
            </div>
          </div>
        </div>

        {/* Rotating Progress Indicator */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] px-2 font-mono">
            <span
              className={`flex items-center gap-1 ${
                brightnessBoost ? "text-neutral-600" : "text-ash"
              }`}
            >
              <Clock className="w-3 h-3 text-accent" />
              <span>Token rotates in:</span>
            </span>
            <span
              className={`font-bold ${
                timeLeft <= 5 ? "text-red-500 animate-pulse" : "text-accent"
              }`}
            >
              {timeLeft}s
            </span>
          </div>

          <div
            className={`w-full h-1.5 rounded-full overflow-hidden ${
              brightnessBoost ? "bg-neutral-200" : "bg-bg border border-border"
            }`}
          >
            <div
              className="h-full bg-accent transition-all duration-1000 ease-linear rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Live Token Hash Pill */}
        <div
          className={`p-2.5 rounded-lg border text-left flex items-center justify-between ${
            brightnessBoost ? "bg-neutral-50 border-neutral-200" : "bg-bg border-border"
          }`}
        >
          <div className="overflow-hidden">
            <div
              className={`text-[10px] uppercase font-mono tracking-wider ${
                brightnessBoost ? "text-neutral-500" : "text-ash"
              }`}
            >
              Anti-Screenshot Cryptographic Payload
            </div>
            <div
              className={`text-[11px] font-mono font-medium truncate max-w-[240px] mt-0.5 ${
                brightnessBoost ? "text-neutral-800" : "text-whitesmoke"
              }`}
            >
              {token}
            </div>
          </div>
          <button
            onClick={fetchNewToken}
            disabled={isRefreshing}
            className={`p-1.5 rounded-md hover:bg-surface-raised transition-colors ${
              brightnessBoost ? "text-neutral-700" : "text-ash hover:text-whitesmoke"
            }`}
            title="Force refresh token"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-accent" : ""}`} />
          </button>
        </div>

        {/* Scan Simulation Feedback Banner */}
        {scanMessage && (
          <div className="p-2.5 bg-accent/15 border border-accent/40 rounded-lg text-xs text-whitesmoke font-medium animate-in fade-in">
            {scanMessage}
          </div>
        )}

        {/* ID Tag Actions */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={() => setBrightnessBoost(!brightnessBoost)}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
              brightnessBoost
                ? "bg-neutral-900 text-white border-neutral-800"
                : "bg-surface-raised border-border text-whitesmoke hover:bg-border"
            }`}
          >
            <Sun className="w-3.5 h-3.5 text-accent" />
            <span>{brightnessBoost ? "Dark Display" : "Boost Contrast"}</span>
          </button>

          {showSimulateScan && (
            <button
              onClick={handleSimulateScan}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-accent text-bg hover:bg-accent-hover transition-colors shadow-md"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Simulate Scan</span>
            </button>
          )}
        </div>
      </div>

      {/* Footer Notice */}
      <div
        className={`px-4 py-2.5 border-t text-center text-[10px] ${
          brightnessBoost ? "bg-neutral-100 border-neutral-300 text-neutral-600" : "bg-surface-raised border-border text-ash"
        }`}
      >
        Valid only at authorized checkpoint terminals • Non-transferable
      </div>
    </div>
  );
}
