import Link from "next/link";
import { getCurrentUser } from "@/lib/server/auth";
import { UserMenu } from "@/components/layout/user-menu";
import {
  QrCode,
  Camera,
  ShieldCheck,
  Clock,
  ArrowRight,
  Lock,
  Layers,
  Sparkles,
  CheckCircle2,
} from "lucide-react";

export default async function LandingPage() {
  const user = await getCurrentUser();

  return (
    <div className="min-h-screen bg-bg text-whitesmoke flex flex-col justify-between selection:bg-accent selection:text-black">
      {/* Top Navigation Bar */}
      <header className="border-b border-border bg-surface/80 backdrop-blur-md sticky top-0 z-40 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-surface-raised border border-border flex items-center justify-center font-mono font-bold text-accent text-lg shadow-sm">
              LP
            </div>
            <div>
              <h1 className="text-base font-bold text-whitesmoke tracking-tight flex items-center gap-2">
                Central Library Movement Portal
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-normal px-2 py-0.5 rounded-full bg-sand-muted text-sand border border-sand/30">
                  Campus SafePass v1.0
                </span>
              </h1>
              <p className="text-xs text-ash">Digital Pass & Movement Management System</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 text-xs text-ash px-3 py-1.5 rounded-lg bg-surface-raised border border-border">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span>Standard Window: <strong>17:00 – 23:30 IST</strong></span>
            </div>

            {user ? (
              <div className="flex items-center gap-3">
                <Link
                  href={
                    user.role === "admin"
                      ? "/admin/dashboard"
                      : user.role === "scanner"
                      ? "/scanner"
                      : "/student/home"
                  }
                  className="px-3.5 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-black text-xs font-semibold transition-colors flex items-center gap-1.5"
                >
                  <span>My Portal</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <UserMenu fullName={user.fullName} role={user.role} />
              </div>
            ) : (
              <Link
                href="/sign-in"
                className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-black text-xs font-semibold transition-colors shadow-sm"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-12 md:py-16 px-6 max-w-7xl mx-auto w-full text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface border border-border text-xs text-sand font-medium">
          <Sparkles className="w-3.5 h-3.5 text-accent" />
          <span>Modernizing Central Library Paper Passes with Secure Digital ID Cards</span>
        </div>

        <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-whitesmoke max-w-3xl mx-auto leading-tight">
          One Institutional Pass. <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent via-sand to-accent-hover">
            Instant Scan. Safe & Simple Movement.
          </span>
        </h2>

        <p className="text-sm md:text-base text-ash max-w-2xl mx-auto leading-relaxed">
          Select your portal below to sign in. The system keeps live student counts,
          prevents screenshot sharing with refreshing pass codes, and manages library study hours.
        </p>

        {/* 3 Portal Selection Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 text-left">
          {/* Card 1: Student View */}
          <div className="bg-surface border border-border hover:border-accent/60 rounded-card p-6 flex flex-col justify-between transition-all group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-28 h-28 bg-accent/5 rounded-bl-full pointer-events-none transition-transform group-hover:scale-110" />
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-surface-raised border border-border flex items-center justify-center text-accent group-hover:bg-accent group-hover:text-black transition-colors">
                  <QrCode className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-sand-muted text-sand border border-sand/20 font-semibold uppercase">
                  Students (Y1–Y4)
                </span>
              </div>

              <div>
                <h3 className="text-lg font-bold text-whitesmoke group-hover:text-accent transition-colors">
                  Student Digital Pass
                </h3>
                <p className="text-xs text-ash mt-1.5 leading-relaxed">
                  Display your digital library card, check your current status (In Library or Outside),
                  see how long you've been studying, and view your visit history.
                </p>
              </div>

              <div className="bg-surface-raised border border-border rounded-lg p-3 space-y-1.5 text-[11px] text-ash">
                <div className="flex items-center justify-between">
                  <span>Demo Login:</span>
                  <strong className="text-accent font-mono">student / student123</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span>Study Window:</span>
                  <span className="text-whitesmoke font-semibold">17:00 – 23:30 Daily</span>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <Link
                href="/sign-in?redirect_url=/student/home"
                className="w-full py-2.5 px-4 rounded-lg bg-surface-raised hover:bg-accent text-whitesmoke hover:text-black text-xs font-semibold border border-border hover:border-accent transition-all flex items-center justify-center gap-2 group-hover:shadow-md"
              >
                <span>Enter Student Portal</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Card 2: Scanner Terminal */}
          <div className="bg-surface border border-border hover:border-sand/70 rounded-card p-6 flex flex-col justify-between transition-all group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-28 h-28 bg-sand/5 rounded-bl-full pointer-events-none transition-transform group-hover:scale-110" />
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-surface-raised border border-border flex items-center justify-center text-sand group-hover:bg-sand group-hover:text-black transition-colors">
                  <Camera className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-surface-raised text-ash border border-border font-semibold uppercase">
                  Library Staff
                </span>
              </div>

              <div>
                <h3 className="text-lg font-bold text-whitesmoke group-hover:text-sand transition-colors">
                  Scanner Terminal
                </h3>
                <p className="text-xs text-ash mt-1.5 leading-relaxed">
                  Fast camera scanner for entry and exit gates. Features instant sound confirmation,
                  torch light toggle, front/back camera switch, and roll number search.
                </p>
              </div>

              <div className="bg-surface-raised border border-border rounded-lg p-3 space-y-1.5 text-[11px] text-ash">
                <div className="flex items-center justify-between">
                  <span>Demo Login:</span>
                  <strong className="text-sand font-mono">scanner / scanner123</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span>Scanner Mode:</span>
                  <span className="text-success font-semibold">Automatic In & Out</span>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <Link
                href="/sign-in?redirect_url=/scanner"
                className="w-full py-2.5 px-4 rounded-lg bg-surface-raised hover:bg-sand text-whitesmoke hover:text-black text-xs font-semibold border border-border hover:border-sand transition-all flex items-center justify-center gap-2 group-hover:shadow-md"
              >
                <span>Launch Scanner Desk</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Card 3: Admin Console */}
          <div className="bg-surface border border-border hover:border-accent/60 rounded-card p-6 flex flex-col justify-between transition-all group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-28 h-28 bg-accent/5 rounded-bl-full pointer-events-none transition-transform group-hover:scale-110" />
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-surface-raised border border-border flex items-center justify-center text-accent group-hover:bg-accent group-hover:text-black transition-colors">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-sand-muted text-accent border border-accent/20 font-semibold uppercase">
                  Central Authority
                </span>
              </div>

              <div>
                <h3 className="text-lg font-bold text-whitesmoke group-hover:text-accent transition-colors">
                  Admin Management
                </h3>
                <p className="text-xs text-ash mt-1.5 leading-relaxed">
                  Real-time occupancy numbers, student directory with filters, register new students,
                  delete unwanted students, reset credentials, and download reports.
                </p>
              </div>

              <div className="bg-surface-raised border border-border rounded-lg p-3 space-y-1.5 text-[11px] text-ash">
                <div className="flex items-center justify-between">
                  <span>Demo Login:</span>
                  <strong className="text-accent font-mono">admin / admin123</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span>Access:</span>
                  <span className="text-whitesmoke font-semibold">24/7 Full Control</span>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <Link
                href="/sign-in?redirect_url=/admin/dashboard"
                className="w-full py-2.5 px-4 rounded-lg bg-surface-raised hover:bg-accent text-whitesmoke hover:text-black text-xs font-semibold border border-border hover:border-accent transition-all flex items-center justify-center gap-2 group-hover:shadow-md"
              >
                <span>Access Admin Console</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Security Architecture Invariants Section */}
      <section className="py-12 px-6 border-t border-border bg-surface/40">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <h3 className="text-xl font-bold text-whitesmoke tracking-tight">Key System Safeguards</h3>
            <p className="text-xs text-ash">Designed for campus safety, student convenience, and reliable gate verification.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-surface border border-border p-5 rounded-card space-y-2.5">
              <div className="flex items-center gap-2 text-accent font-semibold text-xs">
                <Lock className="w-4 h-4" />
                <span>Anti-Screenshot Pass</span>
              </div>
              <p className="text-xs text-ash leading-relaxed">
                Pass codes refresh automatically every 30 seconds. Screenshots quickly expire, making it impossible to share passes with friends.
              </p>
            </div>

            <div className="bg-surface border border-border p-5 rounded-card space-y-2.5">
              <div className="flex items-center gap-2 text-sand font-semibold text-xs">
                <Clock className="w-4 h-4" />
                <span>Scheduled Study Hours</span>
              </div>
              <p className="text-xs text-ash leading-relaxed">
                Library hours are clearly displayed. The system shows when gates are open and reminds students before closing time.
              </p>
            </div>

            <div className="bg-surface border border-border p-5 rounded-card space-y-2.5">
              <div className="flex items-center gap-2 text-success font-semibold text-xs">
                <Layers className="w-4 h-4" />
                <span>Accurate Headcount</span>
              </div>
              <p className="text-xs text-ash leading-relaxed">
                Smart scan verification prevents accidental double scans at the gates and ensures the live library count is always accurate.
              </p>
            </div>

            <div className="bg-surface border border-border p-5 rounded-card space-y-2.5">
              <div className="flex items-center gap-2 text-warning font-semibold text-xs">
                <CheckCircle2 className="w-4 h-4" />
                <span>Complete Activity History</span>
              </div>
              <p className="text-xs text-ash leading-relaxed">
                Every entry, exit, and administrative action is safely recorded so staff and students have a clear log of library visits.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-surface px-6 py-6 text-center text-xs text-ash">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} Central Library & Hostel Board. All rights reserved.</p>
          <div className="flex items-center gap-4 text-[11px]">
            <span>Secure Campus System</span>
            <span>•</span>
            <Link href="/api/health" className="hover:text-whitesmoke underline underline-offset-4">
              System Status Check
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
