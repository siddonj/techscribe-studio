"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Suspense } from "react";

function LoginContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";

  return (
    <div className="min-h-screen flex items-center justify-center p-6"
      style={{
        background: "radial-gradient(circle at top left, rgba(15,168,130,0.12), transparent 32%), linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%)",
      }}
    >
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-3xl bg-[#0D1F40] shell-glow-ring mb-5">
            <Sparkles className="h-7 w-7 text-accent" />
          </div>
          <div className="text-[11px] text-accent font-mono tracking-[0.28em] uppercase mb-1">
            TechScribe
          </div>
          <h1 className="text-3xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-display)" }}>
            Studio
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Sign in to access your editorial workspace.
          </p>
        </div>

        {/* Card */}
        <div className="shell-panel rounded-3xl p-8 space-y-5">
          <div>
            <h2 className="text-base font-semibold text-slate-900 mb-1">Welcome back</h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              Use your Google account to sign in. New accounts are reviewed before access is granted.
            </p>
          </div>

          <button
            onClick={() => signIn("google", { callbackUrl })}
            className="btn-secondary w-full rounded-2xl border-border bg-white px-4 py-3 text-sm font-medium text-slate-900 hover:border-accent/40"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <p className="text-xs text-center text-slate-400">
            Access is restricted. Your account will be reviewed by an admin before you can use the workspace.
          </p>

          {process.env.NODE_ENV === "development" && (
            <>
              <div className="relative flex items-center gap-3">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-xs text-slate-400 shrink-0">dev only</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>
              <button
                onClick={() => signIn("dev-login", { callbackUrl })}
                className="btn-secondary w-full rounded-2xl border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600 hover:border-accent/50 hover:text-accent"
              >
                Skip auth — Dev login
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
