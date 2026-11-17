"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, User } from "lucide-react";

interface UserMenuProps {
  fullName?: string;
  role?: string;
}

export function UserMenu({ fullName, role }: UserMenuProps) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    } catch {
      window.location.href = "/";
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-surface-raised border border-border flex items-center justify-center text-xs font-bold text-accent font-mono">
          {fullName ? fullName.slice(0, 2).toUpperCase() : <User className="w-4 h-4 text-ash" />}
        </div>
        {fullName && (
          <div className="hidden sm:flex flex-col text-left">
            <span className="text-xs font-semibold text-whitesmoke leading-tight">{fullName}</span>
            {role && (
              <span className="text-[10px] text-accent uppercase font-mono tracking-wider">
                {role}
              </span>
            )}
          </div>
        )}
      </div>

      <button
        onClick={handleLogout}
        disabled={loggingOut}
        title="Sign Out"
        className="p-1.5 rounded-lg bg-surface-raised hover:bg-border text-ash hover:text-danger border border-border transition-colors text-xs flex items-center gap-1.5"
      >
        <LogOut className="w-3.5 h-3.5" />
        <span className="hidden md:inline text-[11px] font-medium">Sign Out</span>
      </button>
    </div>
  );
}
