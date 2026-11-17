import { requireRole } from "@/lib/server/auth";
import { listStudents } from "@/lib/server/students";
import { IdTag } from "@/components/id-tag";
import { ArrowLeft, ShieldCheck, Sun } from "lucide-react";
import Link from "next/link";

export default async function FullscreenTagPage() {
  const user = await requireRole(["student", "admin"]);

  // Resolve matching student profile
  const all = await listStudents({ pageSize: 100 });
  let student = all.students.find(
    (s) => s.profileId === user.profileId || s.username === user.username
  );

  if (!student && all.students.length > 0) {
    student = all.students[0];
  }

  return (
    <div className="space-y-5 max-w-sm mx-auto">
      <div className="flex items-center justify-between">
        <Link
          href="/student/home"
          className="flex items-center gap-1.5 text-xs text-ash hover:text-whitesmoke px-3 py-1.5 rounded-lg bg-surface border border-border transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Dashboard</span>
        </Link>

        <span className="text-[11px] font-mono text-sand font-semibold">
          Kiosk Display Mode
        </span>
      </div>

      <div className="text-center space-y-1">
        <h1 className="text-lg font-bold text-whitesmoke">Checkpoint ID Pass</h1>
        <p className="text-xs text-ash">
          Present this barcode to the scanner turnstile camera
        </p>
      </div>

      {student && <IdTag student={student} showSimulateScan={true} />}
    </div>
  );
}
