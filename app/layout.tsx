"use client";

import "./globals.css";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useSession, signOut, SessionProvider } from "next-auth/react";
import { ToastProvider } from "@/components/Toast";
import {
  BarChart3,
  CalendarRange,
  ChevronDown,
  ChevronRight,
  FolderKanban,
  HelpCircle,
  History,
  Home,
  Layers,
  Library,
  LogOut,
  Menu,
  Mic2,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Users,
  Wrench,
  X,
} from "lucide-react";

const PRIMARY_NAV = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/tools", label: "Tools", icon: Wrench },
  { href: "/blueprint", label: "Blueprints", icon: Layers },
  { href: "/seo", label: "SEO Workspace", icon: BarChart3 },
  { href: "/history", label: "History", icon: History },
  { href: "/calendar", label: "Calendar", icon: CalendarRange },
  { href: "/help", label: "Help & Docs", icon: HelpCircle },
  { href: "/settings", label: "Settings", icon: Settings },
];

const CUSTOMIZATION_NAV = [
  { href: "/customization/projects", label: "Projects", icon: FolderKanban },
  { href: "/customization/mytone", label: "MyTone", icon: Mic2 },
  { href: "/customization/knowledge", label: "Knowledge", icon: Library },
];

function SidebarUserCard() {
  const { data: session } = useSession();
  const user = session?.user;
  const isAdmin = (user as Record<string, unknown> | undefined)?.role === "admin";

  if (!user) return null;

  return (
    <div className="px-4 pb-4 relative">
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-3 space-y-3">
        <div className="flex items-center gap-3 min-w-0">
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.image} alt="" className="h-9 w-9 rounded-full border border-white/20 shrink-0" />
          ) : (
            <div className="h-9 w-9 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-sm font-semibold text-white shrink-0">
              {(user.name ?? user.email ?? "?").slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white truncate">{user.name ?? "User"}</p>
            <p className="text-xs text-slate-400 truncate">{user.email}</p>
          </div>
        </div>

        <div className="flex gap-2">
          {isAdmin && (
            <Link
              href="/admin/users"
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-white/10 py-1.5 text-xs text-slate-300 hover:text-white hover:border-white/20 transition-colors"
            >
              <Users className="h-3 w-3" />
              Users
            </Link>
          )}
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-white/10 py-1.5 text-xs text-slate-300 hover:text-white hover:border-white/20 transition-colors"
          >
            <LogOut className="h-3 w-3" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

function Sidebar() {
  const pathname = usePathname();
  const [customizationOpen, setCustomizationOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobile = () => setMobileOpen(false);

  const navigationContent = (
    <>
      <div className="px-6 pt-6 pb-5 border-b border-white/10 relative">
        <Link href="/" className="block" onClick={closeMobile}>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-11 w-11 rounded-2xl bg-white/10 shell-glow-ring flex items-center justify-center text-accent">
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
          <p className="text-sm text-slate-300 leading-relaxed max-w-[16rem]">
            Editorial operations workspace with a CRM-style shell, shared queue visibility, and publishing controls.
          </p>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-6 relative">
        <div className="space-y-1.5">
          {PRIMARY_NAV.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(item.href + "/");

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeMobile}
                data-active={active}
                className={`shell-nav-link flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                  active
                    ? "bg-accent text-white border border-accent/30 shadow-[0_10px_24px_rgba(20,184,166,0.2)]"
                    : "text-slate-300 border border-transparent hover:text-white hover:border-white/5 hover:bg-white/[0.03]"
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? "text-white" : "text-slate-400"}`} />
                <span className="relative z-10">{item.label}</span>
              </Link>
            );
          })}
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-3">
          <button
            onClick={() => setCustomizationOpen((prev) => !prev)}
            className="w-full flex items-center justify-between px-2 pb-2"
          >
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400" />
              <p className="text-[11px] font-mono tracking-[0.24em] uppercase text-slate-400">
                Customization
              </p>
            </div>
            {customizationOpen ? (
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
            )}
          </button>

          {customizationOpen && (
            <div className="space-y-1">
              {CUSTOMIZATION_NAV.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={closeMobile}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                      active
                        ? "bg-white/10 text-white border border-white/10"
                        : "text-slate-300 border border-transparent hover:text-white hover:bg-white/[0.04]"
                    }`}
                  >
                    <Icon className={`h-4 w-4 shrink-0 ${active ? "text-white" : "text-slate-400"}`} />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

      </nav>

      <SidebarUserCard />
    </>
  );

  return (
    <>
      <div className="lg:hidden fixed top-0 inset-x-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-3" onClick={closeMobile}>
            <div className="h-10 w-10 rounded-2xl bg-slate-900 flex items-center justify-center text-accent">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.24em] text-accent font-mono">TechScribe</div>
              <div className="text-slate-900 font-semibold" style={{ fontFamily: "var(--font-display)" }}>Studio</div>
            </div>
          </Link>
          <button
            onClick={() => setMobileOpen((current) => !current)}
            className="h-10 w-10 rounded-2xl border border-slate-200 bg-slate-50 text-slate-700 flex items-center justify-center"
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
        <div className="lg:hidden fixed inset-0 z-30 bg-slate-950/45 backdrop-blur-sm" onClick={closeMobile}>
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
        <SessionProvider>
          <ToastProvider>
            <Sidebar />
            <main className="shell-main flex-1 overflow-y-auto pt-16 lg:pt-0">{children}</main>
          </ToastProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
