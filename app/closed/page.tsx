import Link from "next/link";
import { Clock, ShieldAlert, LogOut } from "lucide-react";

export default function ClosedWindowPage() {
  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-4 text-center">
      <div className="w-full max-w-md bg-surface border border-border rounded-card p-8 shadow-2xl space-y-5">
        <div className="w-14 h-14 rounded-full bg-sand-muted border border-warning/40 flex items-center justify-center mx-auto text-warning">
          <Clock className="w-7 h-7" />
        </div>

        <div>
          <h1 className="text-xl font-bold text-whitesmoke">Portal Currently Closed</h1>
          <p className="text-sm text-ash mt-2">
            In accordance with campus hostel and library policy, student access is restricted outside
            designated study hours.
          </p>
        </div>

        <div className="bg-surface-raised border border-border p-4 rounded-xl text-left space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-sand">
            <ShieldAlert className="w-4 h-4 text-accent" />
            <span>Standard Student Window (IST)</span>
          </div>
          <p className="text-xs text-ash">
            Daily access window: <strong className="text-whitesmoke">17:00 – 23:30 IST</strong>
          </p>
          <p className="text-[11px] text-ash">
            All attempts to access data outside this window are automatically logged.
          </p>
        </div>

        <div className="pt-2">
          <Link
            href="/api/auth/logout"
            className="w-full py-2.5 px-4 bg-surface-raised hover:bg-border text-whitesmoke text-sm font-medium rounded-lg transition-colors border border-border flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4 text-ash" />
            <span>Sign Out Securely</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
