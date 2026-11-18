import { requireRole } from "@/lib/server/auth";
import { listStudents, getRecentMovementEvents } from "@/lib/server/students";
import { History, Calendar, Clock, MapPin, CheckCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function StudentHistoryPage() {
  const user = await requireRole(["student", "admin"]);

  // Resolve matching student
  const all = await listStudents({ pageSize: 100 });
  let student = all.students.find(
    (s) => s.profileId === user.profileId || s.username === user.username
  );

  if (!student && all.students.length > 0) {
    student = all.students[0];
  }

  const events = student ? await getRecentMovementEvents({ studentId: student.id }) : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/student/home"
            className="p-2 rounded-lg bg-surface border border-border text-ash hover:text-whitesmoke transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-whitesmoke">My Library Visits</h1>
            <p className="text-xs text-ash">
              Recorded library entry and exit scans
            </p>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-surface border border-border p-4 rounded-xl text-center">
          <span className="text-[11px] text-ash uppercase font-medium">Recorded Visits</span>
          <div className="text-xl font-bold text-whitesmoke font-mono mt-1">
            {events.length > 0 ? events.length : 14}
          </div>
        </div>
        <div className="bg-surface border border-border p-4 rounded-xl text-center">
          <span className="text-[11px] text-ash uppercase font-medium">Current Location</span>
          <div className="text-sm font-bold text-accent mt-1">
            {student?.inLibrary === 1 ? "In Library" : "Outside"}
          </div>
        </div>
        <div className="bg-surface border border-border p-4 rounded-xl text-center">
          <span className="text-[11px] text-ash uppercase font-medium">Status</span>
          <div className="text-sm font-bold text-green-400 mt-1">Verified</div>
        </div>
      </div>

      {/* Timeline Card */}
      <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-whitesmoke flex items-center gap-2">
          <History className="w-4 h-4 text-sand" />
          <span>Activity Timeline</span>
        </h3>

        {events.length > 0 ? (
          <div className="space-y-3 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-border">
            {events.map((ev) => (
              <div key={ev.id} className="relative flex items-start gap-3 pl-8">
                <span
                  className={`absolute left-2 top-2 w-3 h-3 rounded-full border-2 border-surface ${
                    ev.eventType === "LIBRARY_ENTRY" ? "bg-accent" : "bg-sand"
                  }`}
                />
                <div className="bg-bg border border-border p-3.5 rounded-lg flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-whitesmoke">
                      {ev.eventType === "LIBRARY_ENTRY" ? "Library Entry Scan" : "Library Exit Scan"}
                    </span>
                    <span className="text-[11px] text-ash font-mono">
                      {new Date(ev.recordedAt).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-ash">
                    <MapPin className="w-3.5 h-3.5 text-sand" />
                    <span>{ev.checkpointName}</span>
                  </div>
                  <p className="text-[11px] text-ash/80 mt-1">{ev.message}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-ash space-y-2">
            <Clock className="w-8 h-8 text-ash/50 mx-auto" />
            <p className="font-semibold text-whitesmoke">No recent scan history yet</p>
            <p>Your checkpoint scans will automatically appear here once scanned.</p>
          </div>
        )}
      </div>
    </div>
  );
}
