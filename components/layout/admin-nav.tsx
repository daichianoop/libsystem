"use client";

import React from "react";
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
} from "lucide-react";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Students", href: "/admin/students", icon: Users },
  { label: "Scanners", href: "/admin/scanners", icon: QrCode },
  { label: "Access Windows", href: "/admin/access-windows", icon: Clock },
  { label: "Logs & Audit", href: "/admin/logs", icon: ShieldAlert },
  { label: "Reports", href: "/admin/reports", icon: FileText },
  { label: "Settings", href: "/admin/settings", icon: Sliders },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="p-3 space-y-1">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href || (item.href !== "/admin/dashboard" && pathname.startsWith(item.href));

        return (
          <Link
            key={item.href}
            href={item.href}
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
  );
}
