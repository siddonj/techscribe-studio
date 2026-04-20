"use client";

import { useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Sparkles, Clock, LogOut } from "lucide-react";

export default function PendingPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();

  // Poll every 6 s — the jwt callback re-reads the DB on each session update,
  // so approval takes effect on the next poll without a sign-out/sign-in cycle.
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }

    const interval = setInterval(async () => {
      await update();
    }, 6000);

    return () => clearInterval(interval);
  }, [status, update, router]);

  useEffect(() => {
    if (session?.user?.status === "approved") {
      router.replace("/");
    }
  }, [session, router]);

  const isRejected = session?.user?.status === "rejected";

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{
        background: "radial-gradient(circle at top left, rgba(15,168,130,0.12), transparent 32%), linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%)",
      }}
    >
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-3xl bg-[#0D1F40] shell-glow-ring mb-2">
          <Sparkles className="h-7 w-7 text-accent" />
        </div>

        <div className="shell-panel rounded-3xl p-8 space-y-4">
          {isRejected ? (
            <>
              <div className="h-12 w-12 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center mx-auto">
                <span className="text-xl">✕</span>
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900 mb-1">Access not granted</h2>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Your request to access TechScribe Studio was not approved. Contact an admin if you think this is a mistake.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="h-12 w-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto">
                <Clock className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900 mb-1">Awaiting approval</h2>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Your account has been created and is pending review. An admin will approve your access shortly.
                </p>
              </div>
              {session?.user?.email && (
                <div className="rounded-xl bg-subtle border border-border px-4 py-2.5 text-sm text-slate-600 text-left">
                  <p className="text-xs font-mono text-muted uppercase tracking-wider mb-0.5">Signed in as</p>
                  <p className="font-medium text-slate-900 truncate">{session.user.email}</p>
                </div>
              )}
              <p className="text-xs text-muted">
                This page checks automatically — you&apos;ll be redirected as soon as access is granted.
              </p>
            </>
          )}

          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm text-slate-500 hover:text-slate-900 hover:border-accent/40 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
