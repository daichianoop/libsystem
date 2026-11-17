import { getAdminSupabase } from "@/lib/server/supabase";
import { Users, Library, ShieldCheck, Clock } from "lucide-react";

export default async function AdminDashboardPage() {
  const supabase = getAdminSupabase();

  // Load overview metrics
  const [{ count: totalStudents }, { count: inLibraryCount }, { count: openSessionsCount }] = await Promise.all([
    supabase.from("students").select("*", { count: "exact", head: true }),
    supabase.from("students").select("*", { count: "exact", head: true }).eq("in_library", 1),
    supabase.from("library_sessions").select("*", { count: "exact", head: true }).eq("status", "OPEN"),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-whitesmoke tracking-tight">System Overview</h1>
        <p className="text-sm text-ash mt-1">Live occupancy, student movements, and pass status.</p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface border border-border p-5 rounded-card">
          <div className="flex items-center justify-between text-ash">
            <span className="text-xs font-medium uppercase tracking-wider">In Library Right Now</span>
            <Library className="w-5 h-5 text-accent" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-accent font-mono">{inLibraryCount ?? 0}</span>
            <span className="text-xs text-ash">students</span>
          </div>
          <p className="text-xs text-sand mt-2">Active library occupancy</p>
        </div>

        <div className="bg-surface border border-border p-5 rounded-card">
          <div className="flex items-center justify-between text-ash">
            <span className="text-xs font-medium uppercase tracking-wider">Total Registered</span>
            <Users className="w-5 h-5 text-sand" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-whitesmoke font-mono">{totalStudents ?? 0}</span>
            <span className="text-xs text-ash">students</span>
          </div>
          <p className="text-xs text-ash mt-2">Across Year 1 to Year 4</p>
        </div>

        <div className="bg-surface border border-border p-5 rounded-card">
          <div className="flex items-center justify-between text-ash">
            <span className="text-xs font-medium uppercase tracking-wider">Open Sessions</span>
            <Clock className="w-5 h-5 text-warning" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-whitesmoke font-mono">{openSessionsCount ?? 0}</span>
            <span className="text-xs text-ash">active</span>
          </div>
          <p className="text-xs text-ash mt-2">Currently inside study halls</p>
        </div>

        <div className="bg-surface border border-border p-5 rounded-card">
          <div className="flex items-center justify-between text-ash">
            <span className="text-xs font-medium uppercase tracking-wider">Security State</span>
            <ShieldCheck className="w-5 h-5 text-success" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-xl font-bold text-success font-mono">ENFORCED</span>
          </div>
          <p className="text-xs text-ash mt-2">RLS & Rotating QR Active</p>
        </div>
      </div>

      {/* Quick Status Notice */}
      <div className="bg-surface border border-border rounded-card p-6">
        <h2 className="text-base font-semibold text-whitesmoke mb-2">Phase 1 Foundation Operational</h2>
        <p className="text-sm text-ash leading-relaxed">
          The database schema, RLS policies, role-gating middleware, CSPRNG credential generators,
          and seed scripts have been initialized. You can register students, assign checkpoints,
          and monitor access windows.
        </p>
      </div>
    </div>
  );
}
