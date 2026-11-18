"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  QrCode,
  Sliders,
  Clock,
  ShieldAlert,
  FileText,
  Menu,
  X,
} from "lucide-react";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Students List", href: "/admin/students", icon: Users },
  { label: "Pass Scanner", href: "/scanner", icon: QrCode },
  { label: "Library Timings", href: "/admin/access-windows", icon: Clock },
  { label: "Activity Log", href: "/admin/logs", icon: ShieldAlert },
  { label: "Reports", href: "/admin/reports", icon: FileText },
  { label: "Settings", href: "/admin/settings", icon: Sliders },
];

export function AdminNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile Menu Toggle Button (Visible only on < md screens) */}
      <div className="md:hidden px-3 pt-2">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-surface-raised border border-border text-xs font-semibold text-whitesmoke active:scale-98 transition-all"
        >
          <span className="flex items-center gap-2">
            {mobileOpen ? <X className="w-4 h-4 text-accent" /> : <Menu className="w-4 h-4 text-accent" />}
            <span>{mobileOpen ? "Close Admin Menu" : "Admin Menu"}</span>
          </span>
          <span className="text-[11px] text-sand font-semibold">
            {NAV_ITEMS.find((item) => pathname.startsWith(item.href))?.label || "Navigation"}
          </span>
        </button>
      </div>

      {/* Nav items list: Collapsible on mobile, always visible on tablet/desktop */}
      <nav className={`p-3 space-y-1 ${mobileOpen ? "block" : "hidden md:block"}`}>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/admin/dashboard" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? "bg-accent/15 text-accent border border-accent/40 font-bold shadow-sm"
                  : "text-ash hover:text-whitesmoke hover:bg-surface-raised border border-transparent"
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "text-accent" : "text-sand"}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}