import { requireRole } from "@/lib/server/auth";
import {
  Clock,
  ShieldAlert,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Plus,
  Lock,
  Sparkles,
} from "lucide-react";

export default async function AccessWindowsPage() {
  await requireRole(["admin"]);

  const windows = [
    {
      role: "student",
      roleLabel: "Student Pass Holders",
      openTime: "17:00",
      closeTime: "23:30",
      isActive: true,
      description: "Evening central library study access window with automatic session close.",
    },
    {
      role: "scanner",
      roleLabel: "Staff & Checkpoint Terminals",
      openTime: "16:00",
      closeTime: "23:59",
      isActive: true,
      description: "Staff desk terminal operational window for scanning and entry management.",
    },
    {
      role: "admin",
      roleLabel: "System Administrators",
      openTime: "00:00",
      closeTime: "23:59",
      isActive: true,
      description: "Permanent 24/7 administrative oversight (admins cannot lock themselves out).",
    },
  ];

  const overrides = [
    {
      date: "2026-11-25",
      role: "All Roles",
      openTime: "14:00",
      closeTime: "23:59",
      reason: "Mid-Semester Examinations Study Extension",
    },
    {
      date: "2026-12-25",
      role: "student",
      isClosed: true,
      reason: "Institute Winter Holiday (Library Closed)",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-whitesmoke tracking-tight">
            Library Opening Hours & Timings
          </h1>
          <p className="text-xs text-ash mt-1">
            Official library access hours for students and staff (Indian Standard Time)
          </p>
        </div>

        {/* Live IST Server Clock */}
        <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-surface border border-accent/40 text-xs font-mono">
          <Clock className="w-4 h-4 text-accent animate-pulse" />
          <span className="text-ash">Current Time:</span>
          <span className="text-whitesmoke font-bold">
            {new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })} IST
          </span>
        </div>
      </div>

      {/* Enforcement Alert Notice */}
      <div className="p-4 bg-accent/10 border border-accent/30 rounded-xl flex items-start gap-3 text-xs text-whitesmoke leading-relaxed">
        <Lock className="w-5 h-5 text-accent shrink-0 mt-0.5" />
        <div>
          <strong className="text-accent font-semibold">Automatic Timing Control:</strong> Outside configured library hours, students and staff will see the "Library Closed" notice showing when the library opens next. System administrators can access the portal at any time.
        </div>
      </div>

      {/* Role Access Windows Table */}
      <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-whitesmoke uppercase tracking-wider">
          Configured Role Time Windows
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-surface-raised text-ash font-semibold uppercase text-[10px] tracking-wider border-b border-border">
                <th className="py-2.5 px-3">Role Group</th>
                <th className="py-2.5 px-3">Open Time</th>
                <th className="py-2.5 px-3">Close Time</th>
                <th className="py-2.5 px-3">Enforcement Mode</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {windows.map((win) => (
                <tr key={win.role} className="hover:bg-surface-raised/50 transition-colors">
                  <td className="py-3 px-3">
                    <div className="font-semibold text-whitesmoke">{win.roleLabel}</div>
                    <div className="text-[10px] text-ash mt-0.5">{win.description}</div>
                  </td>
                  <td className="py-3 px-3 font-mono font-bold text-sand text-sm">{win.openTime}</td>
                  <td className="py-3 px-3 font-mono font-bold text-accent text-sm">{win.closeTime}</td>
                  <td className="py-3 px-3 text-ash">Server Clock (IST)</td>
                  <td className="py-3 px-3">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/30">
                      Active
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Access Overrides (Holidays & Exam Extensions) */}
      <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-whitesmoke uppercase tracking-wider">
              Special Exceptions & Overrides
            </h3>
            <p className="text-xs text-ash">
              Exam study extensions, holidays, and temporary closures
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-surface-raised text-ash font-semibold uppercase text-[10px] tracking-wider border-b border-border">
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Role Target</th>
                <th className="py-2.5 px-3">Override Timings</th>
                <th className="py-2.5 px-3">Reason</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {overrides.map((ov, idx) => (
                <tr key={idx} className="hover:bg-surface-raised/50 transition-colors">
                  <td className="py-3 px-3 font-mono text-sand font-semibold">{ov.date}</td>
                  <td className="py-3 px-3 text-whitesmoke capitalize">{ov.role}</td>
                  <td className="py-3 px-3 font-mono text-whitesmoke">
                    {ov.isClosed ? (
                      <span className="text-red-400 font-bold">Closed All Day</span>
                    ) : (
                      `${ov.openTime} – ${ov.closeTime}`
                    )}
                  </td>
                  <td className="py-3 px-3 text-ash">{ov.reason}</td>
                  <td className="py-3 px-3">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-raised text-whitesmoke border border-border">
                      Scheduled
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
