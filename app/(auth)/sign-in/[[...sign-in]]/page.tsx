import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { ArrowLeft, Shield, QrCode, Camera } from "lucide-react";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-bg text-whitesmoke">
      {/* Back to Landing Link */}
      <div className="w-full max-w-md mb-4 flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-ash hover:text-whitesmoke transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Portals Overview</span>
        </Link>
        <span className="text-[11px] font-mono text-sand bg-sand-muted px-2 py-0.5 rounded border border-sand/20">
          Restricted Access
        </span>
      </div>

      {/* Header */}
      <div className="w-full max-w-md mb-6 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-surface border border-border mb-3 text-accent font-mono font-bold text-xl shadow-sm">
          LP
        </div>
        <h1 className="text-xl font-bold text-whitesmoke tracking-tight">Central Library Sign In</h1>
        <p className="text-xs text-ash mt-1">Hostel & Student Movement Management System</p>
      </div>

      {/* Role Guide Pills */}
      <div className="w-full max-w-md mb-5 grid grid-cols-3 gap-2 text-center text-[11px]">
        <div className="bg-surface border border-border rounded-lg p-2">
          <QrCode className="w-3.5 h-3.5 text-accent mx-auto mb-1" />
          <span className="font-semibold text-whitesmoke block">Student Pass</span>
          <span className="text-[10px] text-ash">Roll & Hash Code</span>
        </div>
        <div className="bg-surface border border-border rounded-lg p-2">
          <Camera className="w-3.5 h-3.5 text-sand mx-auto mb-1" />
          <span className="font-semibold text-whitesmoke block">Scanner Desk</span>
          <span className="text-[10px] text-ash">Checkpoint Staff</span>
        </div>
        <div className="bg-surface border border-border rounded-lg p-2">
          <Shield className="w-3.5 h-3.5 text-success mx-auto mb-1" />
          <span className="font-semibold text-whitesmoke block">Admin Console</span>
          <span className="text-[10px] text-ash">Central Authority</span>
        </div>
      </div>

      {/* Clerk SignIn Component */}
      <SignIn
        appearance={{
          elements: {
            rootBox: "w-full max-w-md",
            card: "bg-surface border border-border shadow-2xl rounded-card p-6",
            headerTitle: "text-whitesmoke text-lg font-semibold",
            headerSubtitle: "text-ash text-sm",
            formButtonPrimary:
              "bg-accent hover:bg-accent-hover text-black font-semibold transition-colors py-2.5 rounded-lg text-sm",
            formFieldInput:
              "bg-surface-raised border-border text-whitesmoke focus:ring-accent focus:border-accent rounded-lg",
            footerAction: "hidden", // No public sign up allowed
          },
        }}
      />

      <p className="mt-6 text-[11px] text-ash text-center max-w-xs leading-relaxed">
        Credentials are issued exclusively by Central Library Administration.
        If you have not received your initial hash code, contact the librarian.
      </p>
    </div>
  );
}
