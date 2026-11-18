import { requireRole } from "@/lib/server/auth";
import { UserMenu } from "@/components/layout/user-menu";
import { AdminNav } from "@/components/layout/admin-nav";
import Link from "next/link";
import { ExternalLink, QrCode } from "lucide-react";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireRole(["admin"]);

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-bg">
      {/* Desktop Sidebar */}
      <aside className="w-full md:w-64 bg-surface border-r border-border flex flex-col justify-between shrink-0">
        <div>
          {/* Logo & Header */}
          <div className="p-5 border-b border-border flex items-center justify-between">
            <Link href="/" className="group flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-surface-raised border border-border flex items-center justify-center font-mono font-bold text-accent text-sm group-hover:border-accent transition-colors">
                LP
              </div>
              <div>
                <h2 className="text-sm font-bold text-whitesmoke tracking-tight group-hover:text-accent transition-colors">
                  Library Admin
                </h2>
                <p className="text-[11px] text-ash">Hostel & Library Pass System</p>
              </div>
            </Link>
            <div className="md:hidden">
              <UserMenu fullName={admin.fullName} role={admin.role} />
            </div>
          </div>

          {/* Quick Scanner Launch Pill */}
          <div className="p-3 pb-1">
            <Link
              href="/scanner"
              className="w-full py-2 px-3 rounded-lg bg-surface-raised border border-border hover:border-accent/60 text-xs font-semibold text-whitesmoke flex items-center justify-between transition-colors group"
            >
              <div className="flex items-center gap-2">
                <QrCode className="w-3.5 h-3.5 text-accent" />
                <span>Open Pass Scanner</span>
              </div>
              <ExternalLink className="w-3 h-3 text-ash group-hover:text-whitesmoke" />
            </Link>
          </div>

          {/* Navigation Links with Active State */}
          <AdminNav />
        </div>

        {/* User Footer */}
        <div className="hidden md:flex p-4 border-t border-border items-center justify-between bg-surface-raised">
          <UserMenu fullName={admin.fullName} role={admin.role} />
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl">
        {children}
      </main>
    </div>
  );
}
