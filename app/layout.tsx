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

function Sidebar() {
  const pathname = usePathname();
  const categories = getAllCategories();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggle = (cat: string) =>
    setCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }));

  return (
    <aside className="w-64 min-h-screen bg-surface border-r border-border flex flex-col">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-border">
        <Link href="/" className="block">
          <div className="text-accent font-mono text-xs tracking-widest uppercase mb-1">
            TechScribe
          </div>
          <div
            className="text-white text-xl leading-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Studio
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4">
        <Link
          href="/"
          className={`flex items-center gap-2 px-5 py-2 text-sm transition-colors ${
            pathname === "/"
              ? "text-accent bg-accent/5 border-r-2 border-accent"
              : "text-muted hover:text-white"
          }`}
        >
          <span>⚡</span> Dashboard
        </Link>
        <Link
          href="/history"
          className={`flex items-center gap-2 px-5 py-2 text-sm transition-colors ${
            pathname === "/history"
              ? "text-accent bg-accent/5 border-r-2 border-accent"
              : "text-muted hover:text-white"
          }`}
        >
          <span>🕒</span> History
        </Link>
        <Link
          href="/calendar"
          className={`flex items-center gap-2 px-5 py-2 text-sm transition-colors ${
            pathname === "/calendar"
              ? "text-accent bg-accent/5 border-r-2 border-accent"
              : "text-muted hover:text-white"
          }`}
        >
          <span>🗓️</span> Calendar
        </Link>
        <Link
          href="/settings"
          className={`flex items-center gap-2 px-5 py-2 text-sm transition-colors ${
            pathname === "/settings"
              ? "text-accent bg-accent/5 border-r-2 border-accent"
              : "text-muted hover:text-white"
          }`}
        >
          <span>⚙️</span> Settings
        </Link>

        <div className="mt-4 space-y-1">
          {categories.map((cat) => {
            const tools = TOOLS.filter((t) => t.category === cat);
            const isOpen = !collapsed[cat];
            return (
              <div key={cat}>
                <button
                  onClick={() => toggle(cat)}
                  className="w-full flex items-center justify-between px-5 py-2 text-xs font-mono tracking-wider text-muted hover:text-white uppercase transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <span>{CATEGORY_ICONS[cat] || "🔧"}</span>
                    {cat}
                  </span>
                  <span className="text-[10px]">{isOpen ? "▾" : "▸"}</span>
                </button>

                {isOpen && (
                  <div className="ml-2">
                    {tools.map((tool) => {
                      const active = pathname === `/tool/${tool.slug}`;
                      return (
                        <Link
                          key={tool.slug}
                          href={`/tool/${tool.slug}`}
                          className={`flex items-center gap-2 pl-8 pr-4 py-1.5 text-sm transition-colors ${
                            active
                              ? "text-accent bg-accent/5 border-r-2 border-accent"
                              : "text-slate-200 hover:text-white"
                          }`}
                        >
                          <span className="text-base leading-none">
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
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </body>
    </html>
  );
}
