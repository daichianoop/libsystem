import { requireRole } from "@/lib/server/auth";
import { listStudents } from "@/lib/server/students";
import { IdTag } from "@/components/id-tag";
import {
  MapPin,
  Clock,
  BookOpen,
  Calendar,
  AlertCircle,
  ShieldCheck,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";

export default async function StudentHomePage() {
  const user = await requireRole(["student", "admin"]);

  // Resolve matching student profile
  const all = await listStudents({ pageSize: 100 });
  let student = all.students.find(
    (s) => s.profileId === user.profileId || s.username === user.username
  );

  if (!student && all.students.length > 0) {
    student = all.students[0]; // Fallback for admin previewing student surface
  }

  const inLibrary = student ? student.inLibrary === 1 : false;

  return (
    <div className="space-y-6">
      {/* Top Welcome Card */}
      <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse" />
              <h2 className="text-xl font-bold text-whitesmoke">
                Hello, {student?.fullName || user.fullName}
              </h2>
            </div>
            <p className="text-xs text-ash mt-0.5 font-mono">
              Roll No: <span className="text-sand font-semibold">{student?.rollNumber || "23CS1001"}</span> •{" "}
              {student?.category || "1st Year"} • {student?.department || "Computer Science"}
            </p>
          </div>

          {/* Status Badge */}
          <div
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border self-start sm:self-auto ${
              inLibrary
                ? "bg-accent/15 border-accent text-accent"
                : "bg-surface-raised border-border text-ash"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                inLibrary ? "bg-accent animate-ping" : "bg-ash"
              }`}
            />
            <span>{inLibrary ? "Inside Library" : "Outside Library"}</span>
          </div>
        </div>

        {/* Location & Last Scan Info */}
        <div className="mt-4 pt-3.5 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-ash">
          <div className="flex items-center gap-1.5 text-whitesmoke">
            <MapPin className="w-4 h-4 text-accent" />
            <span>
              {inLibrary
                ? "Present in Central Library (Main Study Floor)"
                : "Checked out of Central Library"}
            </span>
          </div>

          <div className="flex items-center gap-1 font-mono text-[11px]">
            <Clock className="w-3.5 h-3.5 text-sand" />
            <span>
              {student?.lastScanAt
                ? `Last scan: ${new Date(student.lastScanAt).toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}`
                : "No scans recorded today"}
            </span>
          </div>
        </div>
      </div>

      {/* Primary Pass Showcase */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-sand" />
            <h3 className="text-sm font-bold text-whitesmoke uppercase tracking-wider">
              Digital Student Pass
            </h3>
          </div>
          <span className="text-[11px] text-ash">
            Refreshes automatically (30s)
          </span>
        </div>

        {student && <IdTag student={student} />}
      </div>

      {/* Quick Summary Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-surface border border-border p-4 rounded-xl">
          <div className="flex items-center gap-2 text-xs text-ash">
            <BookOpen className="w-4 h-4 text-accent" />
            <span>Library Visits</span>
          </div>
          <div className="mt-2 text-2xl font-bold text-whitesmoke font-mono">14</div>
          <p className="text-[11px] text-ash mt-0.5">This semester</p>
        </div>

        <div className="bg-surface border border-border p-4 rounded-xl">
          <div className="flex items-center gap-2 text-xs text-ash">
            <TrendingUp className="w-4 h-4 text-sand" />
            <span>Total Study Hours</span>
          </div>
          <div className="mt-2 text-2xl font-bold text-sand font-mono">38.5 hrs</div>
          <p className="text-[11px] text-ash mt-0.5">Recorded study time</p>
        </div>
      </div>

      {/* Access Windows Reminder */}
      <div className="bg-surface-raised border border-border rounded-xl p-4 flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-whitesmoke flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-accent" />
            <span>Daily Access Timings (Asia/Kolkata)</span>
          </h4>
          <p className="text-xs text-ash">
            Student entry window: <strong>17:00 – 23:30 IST</strong>. Auto sign-out occurs at window close.
          </p>
        </div>

        <Link
          href="/student/history"
          className="text-xs text-sand hover:text-accent font-semibold flex items-center gap-1 shrink-0 pt-0.5 transition-colors"
        >
          <span>View History</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
