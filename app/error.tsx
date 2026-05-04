"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route error:", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="shell-panel rounded-3xl p-8 max-w-xl w-full text-center space-y-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-red-600">Application Error</p>
        <h2 className="text-2xl text-slate-900" style={{ fontFamily: "var(--font-display)" }}>
          Something went wrong
        </h2>
        <p className="text-sm text-slate-600">
          The page hit an unexpected error. You can try again, or use diagnostics for proxy/runtime context.
        </p>
        {error.digest ? (
          <p className="text-xs font-mono text-slate-500">Digest: {error.digest}</p>
        ) : null}
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => reset()} className="btn-primary">
            Try again
          </button>
          <a href="/api/diagnostics" target="_blank" rel="noreferrer" className="btn-secondary">
            Open diagnostics
          </a>
        </div>
      </div>
    </div>
  );
}
