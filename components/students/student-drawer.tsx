"use client";

import React, { useEffect, useState } from "react";
import {
  X,
  User,
  KeyRound,
  ShieldCheck,
  ShieldAlert,
  Clock,
  History,
  Building,
  Calendar,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { StudentRecord } from "@/lib/server/students";

interface StudentDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  student: StudentRecord | null;
  onCredentialsReset: (credentials: { username: string; hashCode: string }) => void;
  onStatusUpdated: (updatedStudent: StudentRecord) => void;
}

export function StudentDrawer({
  isOpen,
  onClose,
  student,
  onCredentialsReset,
  onStatusUpdated,
}: StudentDrawerProps) {
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyData, setHistoryData] = useState<any>(null);
  const [resetting, setResetting] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (!isOpen || !student) {
      setHistoryData(null);
      setConfirmReset(false);
      return;
    }

    async function fetchHistory() {
      setHistoryLoading(true);
      try {
        const res = await fetch(`/api/students/${student?.id}/history`);
        if (res.ok) {
          const json = await res.json();
          setHistoryData(json);
        }
      } catch {
        // Fallback gracefully
      } finally {
        setHistoryLoading(false);
      }
    }

    fetchHistory();
  }, [isOpen, student]);

  if (!isOpen || !student) return null;

  const handleResetCredentials = async () => {
    setResetting(true);
    try {
      const res = await fetch(`/api/students/${student.id}/reset-credentials`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to reset credentials.");
      }
      setConfirmReset(false);
      onCredentialsReset(data.credentials);
    } catch (err: any) {
      alert(err.message || "Credential reset failed.");
    } finally {
      setResetting(false);
    }
  };

  const handleToggleActive = async () => {
    setTogglingActive(true);
    try {
      const res = await fetch(`/api/students/${student.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !student.isActive }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to update status.");
      }
      onStatusUpdated(data.student);
    } catch (err: any) {
      alert(err.message || "Status toggle failed.");
    } finally {
      setTogglingActive(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-surface border-l border-border w-full max-w-md h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-5 border-b border-border flex items-start justify-between bg-surface-raised">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-bg border border-border text-sand font-medium">
                {student.rollNumber}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  student.inLibrary === 1
                    ? "bg-accent/20 text-accent border border-accent/40"
                    : "bg-surface text-ash border border-border"
                }`}
              >
                {student.inLibrary === 1 ? "1 • In Library" : "0 • Outside"}
              </span>
            </div>
            <h2 className="text-lg font-bold text-whitesmoke mt-1.5">{student.fullName}</h2>
            <p className="text-xs text-ash font-mono mt-0.5">@{student.username}</p>
          </div>
          <button
            onClick={onClose}
            className="text-ash hover:text-whitesmoke p-1.5 rounded-lg hover:bg-surface transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Quick Info Grid */}
          <div className="grid grid-cols-2 gap-3 bg-bg/60 p-4 rounded-xl border border-border">
            <div>
              <span className="text-[11px] text-ash uppercase tracking-wider block font-medium">
                Category
              </span>
              <span className="text-sm font-semibold text-sand mt-0.5 block">
                {student.category}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-ash uppercase tracking-wider block font-medium">
                Account Status
              </span>
              <span
                className={`text-xs font-semibold mt-0.5 inline-flex items-center gap-1.5 ${
                  student.isActive ? "text-green-400" : "text-red-400"
                }`}
              >
                {student.isActive ? (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5" /> Active
                  </>
                ) : (
                  <>
                    <ShieldAlert className="w-3.5 h-3.5" /> Suspended
                  </>
                )}
              </span>
            </div>
            <div className="col-span-2 pt-2 border-t border-border">
              <span className="text-[11px] text-ash uppercase tracking-wider block font-medium">
                Department
              </span>
              <span className="text-xs text-whitesmoke mt-0.5 block">{student.department}</span>
            </div>
            <div className="col-span-2">
              <span className="text-[11px] text-ash uppercase tracking-wider block font-medium">
                Hostel
              </span>
              <span className="text-xs text-whitesmoke mt-0.5 block">
                {student.hostel || "Day Scholar"}
              </span>
            </div>
            {student.phone && (
              <div className="col-span-2">
                <span className="text-[11px] text-ash uppercase tracking-wider block font-medium">
                  Contact
                </span>
                <span className="text-xs text-whitesmoke mt-0.5 block">{student.phone}</span>
              </div>
            )}
          </div>

          {/* Administrative Actions */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-whitesmoke uppercase tracking-wider">
              Student Actions
            </h4>

            {confirmReset ? (
              <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2.5">
                <p className="text-xs text-amber-200">
                  Generate a new high-entropy password for <strong>{student.username}</strong>? The current password will stop working immediately.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleResetCredentials}
                    disabled={resetting}
                    className="flex-1 px-3 py-1.5 bg-accent text-bg font-semibold text-xs rounded-lg hover:bg-accent-hover transition-colors flex items-center justify-center gap-1.5"
                  >
                    {resetting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Confirm Reset</span>
                  </button>
                  <button
                    onClick={() => setConfirmReset(false)}
                    disabled={resetting}
                    className="px-3 py-1.5 bg-surface-raised border border-border text-xs rounded-lg text-ash hover:text-whitesmoke transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={() => setConfirmReset(true)}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-surface-raised border border-border text-xs font-medium text-whitesmoke hover:border-accent/60 transition-colors"
                >
                  <KeyRound className="w-4 h-4 text-accent" />
                  <span>Reset Password</span>
                </button>

                <button
                  onClick={handleToggleActive}
                  disabled={togglingActive}
                  className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-xs font-medium transition-colors ${
                    student.isActive
                      ? "bg-red-500/10 border-red-500/30 text-red-300 hover:bg-red-500/20"
                      : "bg-green-500/10 border-green-500/30 text-green-300 hover:bg-green-500/20"
                  }`}
                >
                  {togglingActive ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : student.isActive ? (
                    <ShieldAlert className="w-4 h-4" />
                  ) : (
                    <ShieldCheck className="w-4 h-4" />
                  )}
                  <span>{student.isActive ? "Deactivate" : "Activate"}</span>
                </button>
              </div>
            )}
          </div>

          {/* Movement & Timeline History */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-whitesmoke uppercase tracking-wider flex items-center gap-2">
                <History className="w-3.5 h-3.5 text-sand" />
                <span>Movement History</span>
              </h4>
              {historyData && (
                <span className="text-[11px] text-ash">
                  Avg stay: {historyData.averageStayMinutes} mins
                </span>
              )}
            </div>

            {historyLoading ? (
              <div className="p-8 text-center text-ash text-xs flex flex-col items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-accent" />
                <span>Loading movement records...</span>
              </div>
            ) : historyData?.timeline && historyData.timeline.length > 0 ? (
              <div className="space-y-3 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-border">
                {historyData.timeline.map((ev: any, idx: number) => (
                  <div key={idx} className="relative flex items-start gap-3 pl-8">
                    <span
                      className={`absolute left-2 top-1.5 w-3 h-3 rounded-full border-2 border-surface ${
                        ev.eventType === "LIBRARY_ENTRY"
                          ? "bg-accent"
                          : "bg-sand"
                      }`}
                    />
                    <div className="bg-bg/80 border border-border p-3 rounded-lg flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-whitesmoke">
                          {ev.eventType === "LIBRARY_ENTRY" ? "Library Entry" : "Library Exit"}
                        </span>
                        <span className="text-[10px] text-ash font-mono">
                          {new Date(ev.recordedAt).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="text-[11px] text-ash">{ev.checkpointName}</p>
                      {ev.durationMinutes && (
                        <div className="flex items-center gap-1 text-[11px] text-sand pt-0.5">
                          <Clock className="w-3 h-3" />
                          <span>Duration: {ev.durationMinutes} mins</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 bg-bg/40 border border-dashed border-border rounded-lg text-center text-xs text-ash">
                No recent scans recorded for this student yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
