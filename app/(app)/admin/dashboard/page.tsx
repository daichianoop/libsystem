import { requireRole } from "@/lib/server/auth";
import { getOccupancyStats, listStudents } from "@/lib/server/students";
import {
  Users,
  Library,
  Clock,
  ShieldCheck,
  TrendingUp,
  UserPlus,
  QrCode,
  Download,
  ArrowRight,
  Activity,
  Layers,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

export default async function AdminDashboardPage() {
  await requireRole(["admin"]);
  const stats = await getOccupancyStats();
  const studentsList = await listStudents({ page: 1, pageSize: 6 });

  const total = stats.totalStudents;
  const inLibrary = stats.inLibraryCount;
  const outside = stats.outsideCount;
  const occupancyPercentage = total > 0 ? Math.round((inLibrary / total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse" />
            <h1 className="text-2xl font-bold text-whitesmoke tracking-tight">
              Library Overview & Live Activity
            </h1>
          </div>
          <p className="text-xs text-ash mt-1">
            Current occupancy, live student check-ins, and digital pass tracking
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/scanner"
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-surface-raised border border-border text-xs font-semibold text-whitesmoke hover:bg-border transition-colors"
          >
            <QrCode className="w-4 h-4 text-sand" />
            <span>Open Scanner</span>
          </Link>

          <Link
            href="/admin/students"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-bg font-bold text-xs hover:bg-accent-hover transition-colors shadow-lg shadow-accent/10"
          >
            <UserPlus className="w-4 h-4" />
            <span>Manage Students</span>
          </Link>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* In Library Live */}
        <div className="bg-surface border border-accent/40 p-5 rounded-xl relative overflow-hidden shadow-lg">
          <div className="absolute top-0 right-0 w-20 h-20 bg-accent/5 rounded-bl-full pointer-events-none" />
          <div className="flex items-center justify-between text-ash">
            <span className="text-xs font-bold uppercase tracking-wider text-accent flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
              In Library Now
            </span>
            <Library className="w-5 h-5 text-accent" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-accent font-mono">{inLibrary}</span>
            <span className="text-xs text-ash">students</span>
          </div>
          <div className="mt-2 text-xs text-sand flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>{occupancyPercentage}% current capacity</span>
          </div>
        </div>

        {/* Total Students */}
        <div className="bg-surface border border-border p-5 rounded-xl shadow-sm">
          <div className="flex items-center justify-between text-ash">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Enrolled</span>
            <Users className="w-5 h-5 text-sand" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-whitesmoke font-mono">{total}</span>
            <span className="text-xs text-ash">active</span>
          </div>
          <p className="text-xs text-ash mt-2">Across 1st Year to 4th Year</p>
        </div>

        {/* Outside Students */}
        <div className="bg-surface border border-border p-5 rounded-xl shadow-sm">
          <div className="flex items-center justify-between text-ash">
            <span className="text-xs font-semibold uppercase tracking-wider">Outside Library</span>
            <Clock className="w-5 h-5 text-ash" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-whitesmoke font-mono">{outside}</span>
            <span className="text-xs text-ash">students</span>
          </div>
          <p className="text-xs text-ash mt-2">In Hostels or Off-Campus</p>
        </div>

        {/* Security State */}
        <div className="bg-surface border border-border p-5 rounded-xl shadow-sm">
          <div className="flex items-center justify-between text-ash">
            <span className="text-xs font-semibold uppercase tracking-wider">Security State</span>
            <ShieldCheck className="w-5 h-5 text-green-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-xl font-bold text-green-400 font-mono">ENFORCED</span>
          </div>
          <p className="text-xs text-ash mt-2">Rotating QR • Single Token Mode</p>
        </div>
      </div>

      {/* Charts & Breakdown Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Category Occupancy Distribution (7 cols) */}
        <div className="lg:col-span-7 bg-surface border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-accent" />
              <h3 className="text-sm font-bold text-whitesmoke uppercase tracking-wider">
                Occupancy by Year Category
              </h3>
            </div>
            <span className="text-xs text-ash">Live breakdown</span>
          </div>

          <div className="space-y-3.5 pt-1">
            {Object.entries(stats.categoryBreakdown).map(([year, count]) => {
              const pct = total > 0 ? Math.round((count / Math.max(1, inLibrary)) * 100) : 0;
              return (
                <div key={year} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-whitesmoke">{year}</span>
                    <span className="font-mono text-sand font-medium">
                      {count} inside ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-bg rounded-full overflow-hidden border border-border">
                    <div
                      className="h-full bg-accent rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(5, (count / 10) * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Info Callout */}
          <div className="pt-3 border-t border-border flex items-center justify-between text-xs text-ash">
            <span>Access Window: <strong>17:00 – 23:30 IST</strong></span>
            <Link
              href="/admin/access-windows"
              className="text-sand hover:text-accent font-semibold flex items-center gap-1 transition-colors"
            >
              <span>Manage Windows</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Live Recent Scans Feed (5 cols) */}
        <div className="lg:col-span-5 bg-surface border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-sand" />
              <h3 className="text-sm font-bold text-whitesmoke uppercase tracking-wider">
                Live Movement Feed
              </h3>
            </div>
            <Link
              href="/admin/students"
              className="text-xs text-sand hover:text-accent font-semibold transition-colors"
            >
              View All
            </Link>
          </div>

          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {stats.recentEvents.length > 0 ? (
              stats.recentEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="p-3 rounded-lg bg-bg border border-border flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-semibold text-whitesmoke">{ev.studentName}</div>
                    <div className="text-[10px] text-ash font-mono">
                      {ev.rollNumber} • {ev.checkpointName}
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        ev.eventType === "LIBRARY_ENTRY"
                          ? "bg-accent/15 text-accent border border-accent/30"
                          : "bg-surface-raised text-sand border border-border"
                      }`}
                    >
                      {ev.eventType === "LIBRARY_ENTRY" ? "Entry" : "Exit"}
                    </span>
                    <div className="text-[10px] text-ash font-mono mt-0.5">
                      {new Date(ev.recordedAt).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-xs text-ash space-y-1">
                <Clock className="w-6 h-6 text-ash/40 mx-auto" />
                <p className="font-semibold text-whitesmoke">No scans recorded yet this shift</p>
                <p>Scans performed from the Scanner view will appear live here.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Students Directory Glance */}
      <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-whitesmoke uppercase tracking-wider">
              Enrolled Students Directory Snapshot
            </h3>
            <p className="text-xs text-ash">
              Filtered snapshot of students across all year groups
            </p>
          </div>

          <Link
            href="/admin/students"
            className="flex items-center gap-1.5 text-xs text-accent hover:text-accent-hover font-semibold transition-colors"
          >
            <span>Open Full Directory</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-surface-raised text-ash font-semibold uppercase text-[10px] tracking-wider border-b border-border">
                <th className="py-2.5 px-3">Student</th>
                <th className="py-2.5 px-3">Roll Number</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Department</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {studentsList.students.map((std) => (
                <tr key={std.id} className="hover:bg-surface-raised/50 transition-colors">
                  <td className="py-2.5 px-3 font-semibold text-whitesmoke">{std.fullName}</td>
                  <td className="py-2.5 px-3 font-mono text-sand">{std.rollNumber}</td>
                  <td className="py-2.5 px-3 text-ash">{std.category}</td>
                  <td className="py-2.5 px-3 text-ash truncate max-w-[140px]">{std.department}</td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        std.inLibrary === 1
                          ? "bg-accent/20 border-accent/40 text-accent"
                          : "bg-bg border-border text-ash"
                      }`}
                    >
                      {std.inLibrary === 1 ? "1 • In Library" : "0 • Outside"}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <Link
                      href={`/admin/students?q=${encodeURIComponent(std.rollNumber)}`}
                      className="text-sand hover:text-accent font-semibold text-[11px] transition-colors"
                    >
                      Inspect
                    </Link>
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
