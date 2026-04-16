"use client";

import "./globals.css";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  CalendarRange,
  ChevronDown,
  ChevronRight,
  History,
  Home,
  Menu,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
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

const PRIMARY_NAV = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/history", label: "History", icon: History },
  { href: "/calendar", label: "Calendar", icon: CalendarRange },
  { href: "/settings", label: "Settings", icon: Settings },
];

function Sidebar() {
  const pathname = usePathname();
  const categories = getAllCategories();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggle = (cat: string) =>
    setCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }));
  const closeMobile = () => setMobileOpen(false);

  const navigationContent = (
    <>
      <div className="px-5 pt-5 pb-4 border-b border-white/5 relative">
        <Link href="/" className="block" onClick={closeMobile}>
          <div className="flex items-center gap-3 mb-3">
            <div className="h-11 w-11 rounded-2xl shell-panel-soft shell-glow-ring flex items-center justify-center text-accent">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[11px] text-accent font-mono tracking-[0.28em] uppercase">
                TechScribe
              </div>
              <div
                className="text-white text-2xl leading-tight font-semibold"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Studio
              </div>
            </div>
          </div>
          <p className="text-sm text-slate-400 leading-relaxed max-w-[16rem]">
            Editorial planning, generation, and publishing in one dark control room.
          </p>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto py-5 px-3 space-y-6 relative">
        <div className="space-y-1.5">
          {PRIMARY_NAV.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeMobile}
                data-active={active}
                className={`shell-nav-link flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition-all ${
                  active
                    ? "bg-white/5 text-white border border-accent/20"
                    : "text-slate-400 border border-transparent hover:text-white hover:border-white/5 hover:bg-white/[0.03]"
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? "text-accent" : "text-slate-500"}`} />
                <span className="relative z-10">{item.label}</span>
              </Link>
            );
          })}
        </div>

        <div className="shell-panel-soft rounded-3xl p-3">
          <div className="flex items-center justify-between px-2 pb-2">
            <p className="text-[11px] font-mono tracking-[0.24em] uppercase text-slate-500">
              Tool Library
            </p>
            <span className="text-[11px] text-slate-500">{TOOLS.length}</span>
          </div>

          <div className="space-y-1">
            {categories.map((cat) => {
              const tools = TOOLS.filter((t) => t.category === cat);
              const isOpen = !collapsed[cat];

              return (
                <div key={cat} className="rounded-2xl border border-white/[0.04] bg-black/10 overflow-hidden">
                  <button
                    onClick={() => toggle(cat)}
                    className="w-full flex items-center justify-between px-4 py-3 text-[11px] font-mono tracking-[0.18em] text-slate-400 hover:text-white uppercase transition-colors"
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <span className="text-base shrink-0">{CATEGORY_ICONS[cat] || "🔧"}</span>
                      <span className="truncate">{cat}</span>
                    </span>
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>

                  {isOpen && (
                    <div className="px-2 pb-2 space-y-1">
                      {tools.map((tool) => {
                        const active = pathname === `/tool/${tool.slug}`;
                        return (
                          <Link
                            key={tool.slug}
                            href={`/tool/${tool.slug}`}
                            onClick={closeMobile}
                            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                              active
                                ? "bg-accent/10 text-white border border-accent/15"
                                : "text-slate-400 border border-transparent hover:text-white hover:bg-white/[0.04]"
                            }`}
                          >
                            <span className="text-base leading-none">{tool.icon}</span>
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
        </div>
      </nav>

      <div className="px-4 pb-4 relative">
        <div className="shell-panel-soft rounded-3xl p-4">
          <p className="text-[11px] font-mono tracking-[0.22em] uppercase text-slate-500 mb-2">
            Phase 2
          </p>
          <p className="text-sm text-white mb-1">Planning Layer Active</p>
          <p className="text-xs text-slate-400 leading-relaxed">
            Calendar scheduling, WordPress draft sync, and tool handoff are all wired into the same workflow.
          </p>
        </div>
      </div>
    </>
  );

  return (
    <>
      <div className="lg:hidden fixed top-0 inset-x-0 z-40 border-b border-white/5 bg-[#0d1511]/90 backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-3" onClick={closeMobile}>
            <div className="h-10 w-10 rounded-2xl shell-panel-soft flex items-center justify-center text-accent">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.24em] text-accent font-mono">TechScribe</div>
              <div className="text-white font-semibold" style={{ fontFamily: "var(--font-display)" }}>Studio</div>
            </div>
          </Link>
          <button
            onClick={() => setMobileOpen((current) => !current)}
            className="h-10 w-10 rounded-2xl shell-panel-soft text-slate-300 flex items-center justify-center"
            aria-label="Toggle navigation"
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <aside className="hidden lg:flex w-72 min-h-screen shell-sidebar relative flex-col">
        {navigationContent}
      </aside>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-30 bg-black/55 backdrop-blur-sm" onClick={closeMobile}>
          <aside
            className="shell-sidebar relative w-[88vw] max-w-sm min-h-screen flex flex-col"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="pt-16 min-h-screen flex flex-col">{navigationContent}</div>
          </aside>
        </div>
      )}
    </>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="app-shell flex min-h-screen">
        <Sidebar />
        <main className="flex-1 overflow-y-auto pt-16 lg:pt-0">{children}</main>
      </body>
    </html>
  );
}
