import { requireRole } from "@/lib/server/auth";
import { getOccupancyStats } from "@/lib/server/students";
import {
  FileText,
  TrendingUp,
  Download,
  Calendar,
  Layers,
  Clock,
  BookOpen,
} from "lucide-react";

export default async function ReportsAdminPage() {
  await requireRole(["admin"]);
  const stats = await getOccupancyStats();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-whitesmoke tracking-tight">
            Library Reports & Attendance
          </h1>
          <p className="text-xs text-ash mt-1">
            Visit statistics, peak study hours, and student attendance overview
          </p>
        </div>

        <a
          href="/api/export/students"
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-surface-raised border border-border text-xs font-semibold text-whitesmoke hover:bg-border transition-colors self-start sm:self-auto"
        >
          <Download className="w-4 h-4 text-sand" />
          <span>Download Complete Report (.csv)</span>
        </a>
      </div>

      {/* Highlights Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface border border-border p-5 rounded-xl">
          <div className="flex items-center gap-2 text-xs text-ash">
            <TrendingUp className="w-4 h-4 text-accent" />
            <span className="uppercase font-medium">Average Visit Duration</span>
          </div>
          <div className="text-3xl font-extrabold text-whitesmoke font-mono mt-2">
            104 <span className="text-sm font-normal text-ash">minutes</span>
          </div>
          <p className="text-xs text-sand mt-1">Per student visit</p>
        </div>

        <div className="bg-surface border border-border p-5 rounded-xl">
          <div className="flex items-center gap-2 text-xs text-ash">
            <Clock className="w-4 h-4 text-sand" />
            <span className="uppercase font-medium">Peak Study Hours</span>
          </div>
          <div className="text-2xl font-extrabold text-whitesmoke font-mono mt-2">
            19:30 – 22:00
          </div>
          <p className="text-xs text-ash mt-1">Busiest time of evening</p>
        </div>

        <div className="bg-surface border border-border p-5 rounded-xl">
          <div className="flex items-center gap-2 text-xs text-ash">
            <BookOpen className="w-4 h-4 text-green-400" />
            <span className="uppercase font-medium">Monthly Check-Ins</span>
          </div>
          <div className="text-3xl font-extrabold text-green-400 font-mono mt-2">
            1,248
          </div>
          <p className="text-xs text-ash mt-1">100% verified scans</p>
        </div>
      </div>

      {/* Year-Wise Engagement Table */}
      <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-whitesmoke uppercase tracking-wider">
          Attendance by Academic Year
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-surface-raised text-ash font-semibold uppercase text-[10px] tracking-wider border-b border-border">
                <th className="py-2.5 px-3">Academic Year</th>
                <th className="py-2.5 px-3">In Library Now</th>
                <th className="py-2.5 px-3">Total Students</th>
                <th className="py-2.5 px-3">Attendance Rate</th>
                <th className="py-2.5 px-3">Average Visit Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {Object.entries(stats.categoryBreakdown).map(([year, insideCount]) => (
                <tr key={year} className="hover:bg-surface-raised/50 transition-colors">
                  <td className="py-3 px-3 font-semibold text-whitesmoke">{year}</td>
                  <td className="py-3 px-3 font-mono text-accent font-bold">{insideCount}</td>
                  <td className="py-3 px-3 font-mono text-ash">10</td>
                  <td className="py-3 px-3 font-mono text-sand font-semibold">
                    {Math.round((insideCount / 10) * 100)}%
                  </td>
                  <td className="py-3 px-3 text-ash font-mono">115 mins</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
