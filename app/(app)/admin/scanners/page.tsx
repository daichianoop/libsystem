import { requireRole } from "@/lib/server/auth";
import { getCheckpoints } from "@/lib/server/students";
import {
  QrCode,
  MapPin,
  ShieldCheck,
  Radio,
  ExternalLink,
  Plus,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

export default async function ScannersAdminPage() {
  await requireRole(["admin"]);
  const checkpoints = await getCheckpoints();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-whitesmoke tracking-tight">
            Scanner Stations & Checkpoints
          </h1>
          <p className="text-xs text-ash mt-1">
            Library gates, entry checkpoints, and camera scanner stations
          </p>
        </div>

        <Link
          href="/scanner"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-bg font-bold text-xs hover:bg-accent-hover transition-colors shadow-lg shadow-accent/10"
        >
          <QrCode className="w-4 h-4" />
          <span>Open Pass Scanner</span>
        </Link>
      </div>

      {/* Checkpoints Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {checkpoints.map((cp) => (
          <div
            key={cp.id}
            className="bg-surface border border-border hover:border-accent/50 rounded-xl p-5 space-y-4 transition-all"
          >
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-lg bg-surface-raised border border-border flex items-center justify-center text-accent">
                <MapPin className="w-5 h-5" />
              </div>
              <span className="flex items-center gap-1.5 text-xs text-green-400 font-semibold px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                Online
              </span>
            </div>

            <div>
              <h3 className="text-base font-bold text-whitesmoke">{cp.name}</h3>
              <p className="text-xs font-mono text-sand mt-0.5">Station ID: {cp.id}</p>
            </div>

            <div className="pt-3 border-t border-border flex items-center justify-between text-xs">
              <span className="text-ash">Direction:</span>
              <span className="font-semibold text-whitesmoke bg-bg px-2 py-0.5 rounded border border-border">
                {cp.type === "LIBRARY_BOTH"
                  ? "Bi-directional (Entry & Exit)"
                  : cp.type === "LIBRARY_ENTRY"
                  ? "Entry Only"
                  : "Exit Only"}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Assigned Scanner Accounts Card */}
      <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-whitesmoke uppercase tracking-wider">
              Staff Scanner Accounts
            </h3>
            <p className="text-xs text-ash">
              Assigned credentials for library entrance staff and security guards
            </p>
          </div>
          <span className="text-xs text-sand font-mono">1 Active Staff Account</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-surface-raised text-ash font-semibold uppercase text-[10px] tracking-wider border-b border-border">
                <th className="py-2.5 px-3">Staff Member</th>
                <th className="py-2.5 px-3">Username</th>
                <th className="py-2.5 px-3">Role</th>
                <th className="py-2.5 px-3">Assigned Checkpoint</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Terminal Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr className="hover:bg-surface-raised/50 transition-colors">
                <td className="py-3 px-3 font-semibold text-whitesmoke">
                  Main Gate Security Staff
                </td>
                <td className="py-3 px-3 font-mono text-sand">scanner</td>
                <td className="py-3 px-3 text-ash">Terminal Scanner</td>
                <td className="py-3 px-3 text-whitesmoke">Central Library Main Gate</td>
                <td className="py-3 px-3">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/30">
                    Active
                  </span>
                </td>
                <td className="py-3 px-3 text-right">
                  <Link
                    href="/scanner"
                    className="inline-flex items-center gap-1 text-accent hover:text-accent-hover font-semibold text-xs transition-colors"
                  >
                    <span>Launch</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
