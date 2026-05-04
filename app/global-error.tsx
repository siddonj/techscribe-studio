"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
        <div className="shell-panel rounded-3xl p-8 max-w-xl w-full text-center space-y-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-red-600">Critical Error</p>
          <h2 className="text-2xl text-slate-900" style={{ fontFamily: "var(--font-display)" }}>
            The app failed to render
          </h2>
          <p className="text-sm text-slate-600">
            Try reloading. If this persists, check runtime and proxy diagnostics.
          </p>
          {error.digest ? <p className="text-xs font-mono text-slate-500">Digest: {error.digest}</p> : null}
          <div className="flex items-center justify-center gap-3">
            <button onClick={() => reset()} className="btn-primary">
              Retry
            </button>
            <a href="/api/diagnostics" target="_blank" rel="noreferrer" className="btn-secondary">
              Diagnostics
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
