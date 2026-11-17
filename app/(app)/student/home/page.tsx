import { requireRole } from "@/lib/server/auth";
import { getAdminSupabase } from "@/lib/server/supabase";
import { MapPin, ShieldCheck, Clock } from "lucide-react";

export default async function StudentHomePage() {
  const user = await requireRole(["student", "admin"]);
  const supabase = getAdminSupabase();

  const { data: student } = await supabase
    .from("students")
    .select("*")
    .eq("profile_id", user.profileId)
    .single();

  const inLibrary = student?.in_library === 1;

  return (
    <div className="space-y-6">
      {/* Greeting & Status Card */}
      <div className="bg-surface border border-border rounded-card p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-whitesmoke">
              Welcome, {student?.full_name || user.fullName || "Student"}
            </h2>
            <p className="text-xs text-ash mt-0.5 font-mono">
              Roll No: {student?.roll_number || "N/A"} • Category: {student?.category || "N/A"}
            </p>
          </div>

          {/* Status Pill */}
          <div
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${
              inLibrary
                ? "bg-sand-muted border-accent text-accent"
                : "bg-surface-raised border-ash text-ash"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                inLibrary ? "bg-accent animate-ping" : "bg-ash"
              }`}
            />
            {inLibrary ? "1 / In Library" : "0 / Outside"}
          </div>
        </div>

        {/* Live location badge */}
        <div className="mt-5 pt-4 border-t border-border flex items-center justify-between text-xs text-ash">
          <div className="flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-sand" />
            <span>{inLibrary ? "Currently present in Central Library" : "Checked out of Central Library"}</span>
          </div>
          {student?.last_scan_at && (
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>Last scan: {new Date(student.last_scan_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
          )}
        </div>
      </div>

      {/* Rotating QR ID Tag Section Placeholder */}
      <div className="bg-surface border border-border rounded-card p-6 text-center space-y-4">
        <div className="flex items-center justify-center gap-2 text-xs font-semibold text-sand uppercase tracking-wider">
          <ShieldCheck className="w-4 h-4 text-accent" />
          <span>Dynamic Student ID Pass</span>
        </div>

        <div className="w-64 h-64 mx-auto bg-surface-raised border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center p-4">
          <div className="w-16 h-16 rounded-full bg-surface flex items-center justify-center text-accent mb-3 font-mono font-bold text-xl">
            QR
          </div>
          <p className="text-xs text-whitesmoke font-medium">Rotating QR ID Tag</p>
          <p className="text-[11px] text-ash mt-1 max-w-[180px]">
            Security tokens rotate automatically every 30 seconds to prevent screenshot sharing.
          </p>
        </div>

        <p className="text-xs text-ash">
          Present this live QR code at the library entrance/exit checkpoint scanner.
        </p>
      </div>
    </div>
  );
}
