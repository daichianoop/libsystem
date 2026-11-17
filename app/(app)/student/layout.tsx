import { requireRole } from "@/lib/server/auth";
import Link from "next/link";
import { UserMenu } from "@/components/layout/user-menu";
import { QrCode, History, Maximize2, ShieldCheck } from "lucide-react";

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const student = await requireRole(["student", "admin"]);

  return (
    <div className="min-h-screen bg-bg flex flex-col justify-between">
      {/* Top Header */}
      <header className="bg-surface border-b border-border px-4 py-3 sticky top-0 z-30 flex items-center justify-between">
        <Link href="/student/home" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-surface-raised border border-border flex items-center justify-center text-accent font-mono font-bold text-sm group-hover:border-accent transition-colors">
            ID
          </div>
          <div>
            <h1 className="text-sm font-bold text-whitesmoke tracking-tight group-hover:text-accent transition-colors">
              Student Digital Pass
            </h1>
            <p className="text-[11px] text-ash">Central Library Movement</p>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href="/student/tag"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-raised border border-border text-xs text-sand hover:text-whitesmoke transition-colors"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Kiosk Tag</span>
          </Link>
          <UserMenu fullName={student.fullName} role={student.role} />
        </div>
      </header>

      {/* Main Surface */}
      <main className="flex-1 p-4 md:p-6 max-w-2xl mx-auto w-full">
        {children}
      </main>

      {/* Mobile-Friendly Bottom Nav */}
      <nav className="bg-surface border-t border-border px-6 py-2 sticky bottom-0 z-30 flex items-center justify-around">
        <Link
          href="/student/home"
          className="flex flex-col items-center gap-1 text-xs text-accent font-medium hover:text-accent-hover transition-colors"
        >
          <QrCode className="w-5 h-5" />
          <span>My Pass</span>
        </Link>
        <Link
          href="/student/tag"
          className="flex flex-col items-center gap-1 text-xs text-ash hover:text-whitesmoke transition-colors"
        >
          <Maximize2 className="w-5 h-5" />
          <span>Kiosk Tag</span>
        </Link>
        <Link
          href="/student/history"
          className="flex flex-col items-center gap-1 text-xs text-ash hover:text-whitesmoke transition-colors"
        >
          <History className="w-5 h-5" />
          <span>History</span>
        </Link>
      </nav>
    </div>
  );
}
