"use client";

import React, { useState } from "react";
import {
  Sliders,
  Shield,
  Clock,
  RotateCcw,
  Save,
  Check,
  AlertTriangle,
  Lock,
} from "lucide-react";

export default function SettingsAdminPage() {
  const [duplicateWindow, setDuplicateWindow] = useState("10");
  const [tokenRotation, setTokenRotation] = useState("30");
  const [maxStayHours, setMaxStayHours] = useState("6");
  const [closingTime, setClosingTime] = useState("23:30");
  const [lockdown, setLockdown] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-whitesmoke tracking-tight">
          System Settings & Rules
        </h1>
        <p className="text-xs text-ash mt-1">
          Scanner timing rules, duplicate scan prevention, and library operating limits
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* Anti-Fraud & Token Parameters */}
        <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-whitesmoke uppercase tracking-wider flex items-center gap-2">
            <Shield className="w-4 h-4 text-accent" />
            <span>Pass Security & Scan Protection</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-ash uppercase tracking-wider block mb-1">
                Duplicate Scan Delay
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={duplicateWindow}
                  onChange={(e) => setDuplicateWindow(e.target.value)}
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-whitesmoke font-mono focus:outline-none focus:border-accent"
                />
                <span className="text-xs text-ash font-medium">seconds</span>
              </div>
              <p className="text-[11px] text-ash/80 mt-1">
                Prevents accidental double scans if the same student pass is shown twice in a row.
              </p>
            </div>

            <div>
              <label className="text-xs font-medium text-ash uppercase tracking-wider block mb-1">
                Digital Pass Code Refresh Time
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={tokenRotation}
                  onChange={(e) => setTokenRotation(e.target.value)}
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-whitesmoke font-mono focus:outline-none focus:border-accent"
                />
                <span className="text-xs text-ash font-medium">seconds</span>
              </div>
              <p className="text-[11px] text-ash/80 mt-1">
                Prevents photo sharing. The barcode updates automatically so screenshots cannot be reused.
              </p>
            </div>
          </div>
        </div>

        {/* Operating Timings & Stay Limits */}
        <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-whitesmoke uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-4 h-4 text-sand" />
            <span>Library Operating Limits</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-ash uppercase tracking-wider block mb-1">
                Library Closing Time (IST)
              </label>
              <input
                type="text"
                value={closingTime}
                onChange={(e) => setClosingTime(e.target.value)}
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-whitesmoke font-mono focus:outline-none focus:border-accent"
              />
              <p className="text-[11px] text-ash/80 mt-1">
                Unclosed sessions at this time are flagged for administrative review.
              </p>
            </div>

            <div>
              <label className="text-xs font-medium text-ash uppercase tracking-wider block mb-1">
                Maximum Single Stay Duration
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={maxStayHours}
                  onChange={(e) => setMaxStayHours(e.target.value)}
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-whitesmoke font-mono focus:outline-none focus:border-accent"
                />
                <span className="text-xs text-ash font-medium">hours</span>
              </div>
              <p className="text-[11px] text-ash/80 mt-1">
                Flags sessions exceeding continuous stay limits.
              </p>
            </div>
          </div>
        </div>

        {/* Emergency Gate Controls */}
        <div className="bg-surface border border-red-500/30 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <h3 className="text-sm font-bold text-red-300 uppercase tracking-wider">
                Emergency Gate Lockdown Mode
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setLockdown(!lockdown)}
              className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
                lockdown
                  ? "bg-red-500 text-white border-red-400"
                  : "bg-surface-raised text-ash border-border hover:text-whitesmoke"
              }`}
            >
              {lockdown ? "LOCKDOWN ACTIVE" : "Normal Operation"}
            </button>
          </div>
          <p className="text-xs text-ash leading-relaxed">
            When lockdown is active, all entry checkpoints are locked and scanner terminals will reject entry scans with an emergency notice.
          </p>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-accent text-bg font-bold text-sm hover:bg-accent-hover transition-colors shadow-lg shadow-accent/15"
          >
            {saved ? <Check className="w-4 h-4 text-bg" /> : <Save className="w-4 h-4" />}
            <span>{saved ? "Settings Saved Successfully" : "Save Changes"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
