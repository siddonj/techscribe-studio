"use client";

import "./globals.css";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { TOOLS, getAllCategories } from "@/lib/tools";

const CATEGORY_ICONS: Record<string, string> = {
  "Content Creation": "✍️",
  "Ideas & Planning": "💡",
  "SEO & Keywords": "🔍",
  "Editing & Rewriting": "🔄",
  "Social Media": "📱",
  "Email & Marketing": "📣",
  "Video Content": "🎬",
};

function Sidebar({
  mobileOpen,
  onClose,
}: {
  mobileOpen: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const categories = getAllCategories();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggle = (cat: string) =>
    setCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }));

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        role={mobileOpen ? "dialog" : undefined}
        aria-modal={mobileOpen ? true : undefined}
        aria-label="Sidebar navigation"
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 min-h-screen bg-surface border-r border-border flex flex-col transition-transform duration-300 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Brand */}
        <div className="px-5 py-5 border-b border-border">
          <Link href="/" className="block" onClick={onClose}>
            <div className="text-accent font-mono text-xs tracking-widest uppercase mb-1">
              TechScribe
            </div>
            <div className="font-display text-white text-xl leading-tight">
              Studio
            </div>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3">
          {/* Top-level nav links */}
          <div className="px-3 mb-3 space-y-0.5">
            <Link
              href="/"
              onClick={onClose}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                pathname === "/"
                  ? "text-accent bg-accent/10 font-medium"
                  : "text-muted hover:text-white hover:bg-white/5"
              }`}
            >
              <span>⚡</span> Dashboard
            </Link>
            <Link
              href="/history"
              onClick={onClose}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                pathname === "/history"
                  ? "text-accent bg-accent/10 font-medium"
                  : "text-muted hover:text-white hover:bg-white/5"
              }`}
            >
              <span>🕒</span> History
            </Link>
            <Link
              href="/calendar"
              onClick={onClose}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                pathname === "/calendar"
                  ? "text-accent bg-accent/10 font-medium"
                  : "text-muted hover:text-white hover:bg-white/5"
              }`}
            >
              <span>🗓️</span> Calendar
            </Link>
            <Link
              href="/settings"
              onClick={onClose}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                pathname === "/settings"
                  ? "text-accent bg-accent/10 font-medium"
                  : "text-muted hover:text-white hover:bg-white/5"
              }`}
            >
              <span>⚙️</span> Settings
            </Link>
          </div>

          {/* Tool Library section label */}
          <div className="px-4 pt-1 pb-2 mb-1 border-t border-border/50">
            <p className="text-xs font-mono tracking-widest uppercase text-muted/60 mt-2">
              Tool Library
            </p>
          </div>

          {/* Category sections */}
          <div className="px-2 space-y-1">
            {categories.map((cat) => {
              const tools = TOOLS.filter((t) => t.category === cat);
              const isCatOpen = !collapsed[cat];
              return (
                <div key={cat} className="rounded-md overflow-hidden">
                  <button
                    onClick={() => toggle(cat)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-mono tracking-wider uppercase transition-colors rounded-md ${
                      isCatOpen
                        ? "text-white bg-card-alt"
                        : "text-muted hover:text-white bg-card-alt/50 hover:bg-card-alt"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-sm">{CATEGORY_ICONS[cat] || "🔧"}</span>
                      <span>{cat}</span>
                    </span>
                    <span
                      className={`text-base leading-none transition-transform duration-200 ${
                        isCatOpen ? "rotate-90" : ""
                      }`}
                    >
                      ›
                    </span>
                  </button>

                  {isCatOpen && (
                    <div className="mt-0.5 mb-1 mx-1 space-y-0.5">
                      {tools.map((tool) => {
                        const active = pathname === `/tool/${tool.slug}`;
                        return (
                          <Link
                            key={tool.slug}
                            href={`/tool/${tool.slug}`}
                            onClick={onClose}
                            className={`flex items-center gap-2.5 pl-7 pr-3 py-2 text-sm font-medium rounded-md transition-colors ${
                              active
                                ? "text-accent bg-accent/10"
                                : "text-slate-300 hover:text-white hover:bg-white/5"
                            }`}
                          >
                            <span className="text-base leading-none shrink-0">
                              {tool.icon}
                            </span>
                            <span className="truncate">{tool.name}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border">
          <p className="text-muted text-xs font-mono">techscribe.org</p>
          <p className="text-muted/50 text-xs mt-0.5">Powered by Claude</p>
        </div>
      </aside>
    </>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <html lang="en">
      <body className="flex min-h-screen">
        <Sidebar
          mobileOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <div className="flex-1 flex flex-col min-w-0">
          {/* Mobile header */}
          <header className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-surface shrink-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-muted hover:text-white transition-colors p-1"
              aria-label="Open sidebar"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            <span className="text-accent font-mono text-xs tracking-widest uppercase">
              TechScribe Studio
            </span>
          </header>
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </body>
    </html>
  );
}
