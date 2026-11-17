import { requireRole } from "@/lib/server/auth";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { LayoutDashboard, Users, QrCode, Sliders, Clock, ShieldAlert, FileText } from "lucide-react";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireRole(["admin"]);

  const navItems = [
    { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
    { label: "Students", href: "/admin/students", icon: Users },
    { label: "Scanners", href: "/admin/scanners", icon: QrCode },
    { label: "Access Windows", href: "/admin/access-windows", icon: Clock },
    { label: "Logs & Audit", href: "/admin/logs", icon: ShieldAlert },
    { label: "Reports", href: "/admin/reports", icon: FileText },
    { label: "Settings", href: "/admin/settings", icon: Sliders },
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-bg">
      {/* Desktop Sidebar */}
      <aside className="w-full md:w-64 bg-surface border-r border-border flex flex-col justify-between shrink-0">
        <div>
          {/* Logo & Header */}
          <div className="p-5 border-b border-border flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse" />
                <h2 className="text-base font-bold text-whitesmoke tracking-tight">Library Admin</h2>
              </div>
              <p className="text-xs text-ash mt-0.5">Hostel & Library Movement</p>
            </div>
            <div className="md:hidden">
              <UserButton />
            </div>
          </div>

          {/* Nav links */}
          <nav className="p-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium text-ash hover:text-whitesmoke hover:bg-surface-raised transition-colors"
                >
                  <Icon className="w-4 h-4 text-sand" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Footer */}
        <div className="hidden md:flex p-4 border-t border-border items-center justify-between">
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-semibold text-whitesmoke truncate">{admin.fullName || admin.username}</span>
            <span className="text-[11px] text-accent uppercase font-mono tracking-wider">Admin</span>
          </div>
          <UserButton />
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl">
        {children}
      </main>
    </div>
  );
}
