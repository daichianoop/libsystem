import { requireRole } from "@/lib/server/auth";
import { getAuditLogs } from "@/lib/server/audit";
import {
  ShieldAlert,
  History,
  Download,
  Filter,
  CheckCircle,
  Clock,
  User,
  KeyRound,
  FileSpreadsheet,
} from "lucide-react";

export default async function AuditLogsAdminPage() {
  await requireRole(["admin"]);
  const auditLogs = await getAuditLogs({ limit: 50 });

  // Mock session logs for institutional overview
  const sessionLogs = [
    {
      id: "sess_001",
      user: "admin",
      role: "admin",
      event: "login_success",
      ip: "127.0.0.1",
      timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
    },
    {
      id: "sess_002",
      user: "scanner",
      role: "scanner",
      event: "login_success",
      ip: "192.168.1.45",
      timestamp: new Date(Date.now() - 25 * 60000).toISOString(),
    },
    {
      id: "sess_003",
      user: "student",
      role: "student",
      event: "login_success",
      ip: "10.21.12.148",
      timestamp: new Date(Date.now() - 65 * 60000).toISOString(),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-whitesmoke tracking-tight">
            Activity History & Security Log
          </h1>
          <p className="text-xs text-ash mt-1">
            Complete record of administrative actions, password resets, student updates, and logins
          </p>
        </div>
      </div>

      {/* Admin Audit Logs Table */}
      <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-bold text-whitesmoke uppercase tracking-wider">
              Recent Administrative Actions
            </h3>
          </div>
          <span className="text-xs text-sand font-mono">
            {auditLogs.length} events logged
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-surface-raised text-ash font-semibold uppercase text-[10px] tracking-wider border-b border-border">
                <th className="py-2.5 px-3">Event</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Performed By</th>
                <th className="py-2.5 px-3">Details</th>
                <th className="py-2.5 px-3">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {auditLogs.length > 0 ? (
                auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-surface-raised/50 transition-colors">
                    <td className="py-3 px-3">
                      <span className="font-mono font-bold text-accent text-xs bg-bg px-2 py-0.5 rounded border border-border">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-3 uppercase text-[11px] font-semibold text-sand">
                      {log.entityType}
                    </td>
                    <td className="py-3 px-3 text-ash font-mono">
                      {log.actorProfileId ? "admin" : "system"}
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-whitesmoke max-w-[320px] truncate">
                      {JSON.stringify(log.metadata)}
                    </td>
                    <td className="py-3 px-3 text-ash font-mono">
                      {new Date(log.createdAt).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-ash text-xs">
                    No administrative audit events recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Session Logs Card */}
      <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-sand" />
            <h3 className="text-sm font-bold text-whitesmoke uppercase tracking-wider">
              Recent Authentication & Session Logs
            </h3>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-surface-raised text-ash font-semibold uppercase text-[10px] tracking-wider border-b border-border">
                <th className="py-2.5 px-3">User</th>
                <th className="py-2.5 px-3">Role Claim</th>
                <th className="py-2.5 px-3">Event</th>
                <th className="py-2.5 px-3">Source IP</th>
                <th className="py-2.5 px-3 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sessionLogs.map((sess) => (
                <tr key={sess.id} className="hover:bg-surface-raised/50 transition-colors">
                  <td className="py-2.5 px-3 font-mono font-semibold text-whitesmoke">
                    {sess.user}
                  </td>
                  <td className="py-2.5 px-3 uppercase text-[10px] font-bold text-sand">
                    {sess.role}
                  </td>
                  <td className="py-2.5 px-3 text-green-400 font-medium">
                    {sess.event}
                  </td>
                  <td className="py-2.5 px-3 text-ash font-mono">{sess.ip}</td>
                  <td className="py-2.5 px-3 text-right text-ash font-mono">
                    {new Date(sess.timestamp).toLocaleTimeString("en-IN")}
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
