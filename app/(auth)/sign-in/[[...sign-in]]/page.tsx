import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-bg">
      <div className="w-full max-w-md mb-6 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-surface border border-border mb-3 text-accent font-mono font-bold text-xl">
          LP
        </div>
        <h1 className="text-xl font-bold text-whitesmoke tracking-tight">Central Library Pass</h1>
        <p className="text-sm text-ash mt-1">Hostel & Student Movement System</p>
      </div>

      <SignIn
        appearance={{
          elements: {
            rootBox: "w-full max-w-md",
            card: "bg-surface border border-border shadow-2xl rounded-card p-6",
            headerTitle: "text-whitesmoke text-lg font-semibold",
            headerSubtitle: "text-ash text-sm",
            formButtonPrimary:
              "bg-accent hover:bg-accent-hover text-black font-semibold transition-colors py-2.5 rounded-lg",
            formFieldInput:
              "bg-surface-raised border-border text-whitesmoke focus:ring-accent focus:border-accent rounded-lg",
            footerAction: "hidden", // No public sign up allowed
          },
        }}
      />

      <p className="mt-8 text-xs text-ash text-center max-w-xs">
        Restricted Portal. Accounts are issued exclusively by Central Library Administration.
      </p>
    </div>
  );
}
