import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { TOOLS } from "@/lib/tools";
import {
  ArrowRight,
  CalendarDays,
  History,
  PenLine,
  AlertTriangle,
  Users,
} from "lucide-react";
import SeoScoreTrendCard from "@/components/SeoScoreTrendCard";

function greeting(name: string | null | undefined) {
  const hour = new Date().getHours();
  const time = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return name ? `${time}, ${name.split(" ")[0]}` : time;
}

async function getDashboardData(isAdmin: boolean) {
  try {
    const db = getDb();

    const recentSaves = (db.prepare(
      "SELECT COUNT(*) as count FROM history WHERE created_at >= datetime('now', '-7 days')"
    ).get() as { count: number }).count;

    const todayItems = (db.prepare(
      "SELECT COUNT(*) as count FROM content_calendar WHERE scheduled_for = date('now') AND status != 'published'"
    ).get() as { count: number }).count;

    const failedPublishes = (db.prepare(
      "SELECT COUNT(*) as count FROM history WHERE wp_publish_state = 'failed'"
    ).get() as { count: number }).count;

    const pendingUsers = isAdmin
      ? (db.prepare("SELECT COUNT(*) as count FROM users WHERE status = 'pending'").get() as { count: number }).count
      : 0;

    const recentHistory = db.prepare(
      "SELECT id, title, tool_name, tool_icon, created_at FROM history ORDER BY created_at DESC LIMIT 5"
    ).all() as { id: number; title: string; tool_name: string; tool_icon: string; created_at: string }[];

    const upcomingItems = db.prepare(
      "SELECT id, title, scheduled_for, status FROM content_calendar WHERE scheduled_for >= date('now') AND status != 'published' ORDER BY scheduled_for ASC LIMIT 5"
    ).all() as { id: number; title: string; scheduled_for: string; status: string }[];

    return { recentSaves, todayItems, failedPublishes, pendingUsers, recentHistory, upcomingItems };
  } catch {
    return { recentSaves: 0, todayItems: 0, failedPublishes: 0, pendingUsers: 0, recentHistory: [], upcomingItems: [] };
  }
}

export default async function Dashboard() {
  const session = await getServerSession(authOptions);
  const user = session?.user as ({ name?: string | null; email?: string | null; image?: string | null; role?: string }) | undefined;
  const isAdmin = user?.role === "admin";
  const data = await getDashboardData(isAdmin);

  const hasAttention = data.failedPublishes > 0 || (isAdmin && data.pendingUsers > 0);

  const stats = [
    { label: "Saves this week", value: data.recentSaves, sub: "history entries" },
    { label: "Scheduled today", value: data.todayItems, sub: "on calendar" },
    { label: "Failed publishes", value: data.failedPublishes, sub: data.failedPublishes > 0 ? "need retry" : "all clear", warn: data.failedPublishes > 0 },
    { label: "Tools available", value: TOOLS.length, sub: "in library" },
  ];

  return (
    <div className="min-h-screen">

      {/* Hero */}
      <div className="border-b border-slate-200 bg-white px-8 py-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
            <div>
              <p className="text-[11px] font-mono tracking-[0.24em] uppercase text-accent mb-1">
                Editorial Workspace
              </p>
              <h1
                className="text-3xl font-semibold text-slate-900"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {greeting(user?.name)}
              </h1>
              <p className="mt-1.5 text-slate-500 text-sm">
                {data.todayItems > 0
                  ? `You have ${data.todayItems} item${data.todayItems > 1 ? "s" : ""} scheduled for today.`
                  : "Your editorial workspace is ready."}
              </p>
            </div>
            <Link
              href="/tools"
              className="inline-flex items-center gap-2 rounded-2xl bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-dim transition-colors shrink-0"
            >
              <PenLine className="h-4 w-4" />
              Start creating
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Stats row */}
          <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
            {stats.map((s) => (
              <div key={s.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-400">{s.label}</p>
                <div className="mt-2 flex items-end justify-between gap-2">
                  <span className="text-2xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-display)" }}>
                    {s.value}
                  </span>
                  <span className={`text-xs pb-0.5 ${s.warn ? "text-red-500" : "text-accent"}`}>{s.sub}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="px-8 py-8 max-w-5xl mx-auto space-y-6">

        {/* Attention alerts */}
        {hasAttention && (
          <div className="flex flex-wrap gap-3">
            {isAdmin && data.pendingUsers > 0 && (
              <Link
                href="/admin/users"
                className="flex-1 min-w-[200px] flex items-center justify-between gap-4 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-3.5 hover:border-amber-400 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <Users className="h-4 w-4 text-amber-600 shrink-0" />
                  <div>
                    <p className="text-[11px] font-mono uppercase tracking-wider text-amber-600">Access Requests</p>
                    <p className="text-sm font-medium text-slate-800 mt-0.5">
                      {data.pendingUsers} user{data.pendingUsers > 1 ? "s" : ""} awaiting approval
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-amber-500 group-hover:translate-x-0.5 transition-transform shrink-0" />
              </Link>
            )}
            {data.failedPublishes > 0 && (
              <Link
                href="/history?publish_state=failed"
                className="flex-1 min-w-[200px] flex items-center justify-between gap-4 rounded-2xl border border-red-300 bg-red-50 px-5 py-3.5 hover:border-red-400 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                  <div>
                    <p className="text-[11px] font-mono uppercase tracking-wider text-red-600">Publish Failures</p>
                    <p className="text-sm font-medium text-slate-800 mt-0.5">
                      {data.failedPublishes} draft{data.failedPublishes > 1 ? "s" : ""} failed to publish
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-red-500 group-hover:translate-x-0.5 transition-transform shrink-0" />
              </Link>
            )}
          </div>
        )}

        {/* Recent work + Upcoming */}
        <div className="grid gap-4 lg:grid-cols-2">

          {/* Recent saves */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-slate-400" />
                <p className="text-sm font-semibold text-slate-700">Recent work</p>
              </div>
              <Link href="/history" className="text-xs text-accent hover:underline">View all</Link>
            </div>
            {data.recentHistory.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-slate-400">No saved content yet.</p>
                <Link href="/tools" className="mt-2 inline-block text-xs text-accent hover:underline">
                  Use a tool to generate your first piece →
                </Link>
              </div>
            ) : (
              <div className="space-y-1">
                {data.recentHistory.map((entry) => (
                  <Link
                    key={entry.id}
                    href="/history"
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-slate-50 transition-colors group"
                  >
                    <span className="text-base shrink-0">{entry.tool_icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800 truncate group-hover:text-accent transition-colors">
                        {entry.title}
                      </p>
                      <p className="text-xs text-slate-400">
                        {entry.tool_name} · {new Date(entry.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming calendar */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-slate-400" />
                <p className="text-sm font-semibold text-slate-700">Up next</p>
              </div>
              <Link href="/calendar" className="text-xs text-accent hover:underline">Open calendar</Link>
            </div>
            {data.upcomingItems.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-slate-400">Nothing scheduled.</p>
                <Link href="/calendar" className="mt-2 inline-block text-xs text-accent hover:underline">
                  Plan content on the calendar →
                </Link>
              </div>
            ) : (
              <div className="space-y-1">
                {data.upcomingItems.map((item) => {
                  const d = new Date(`${item.scheduled_for}T00:00:00`);
                  return (
                    <Link
                      key={item.id}
                      href="/calendar"
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-slate-50 transition-colors group"
                    >
                      <div className="h-10 w-10 rounded-xl bg-accent/10 flex flex-col items-center justify-center shrink-0">
                        <span className="text-[9px] font-mono text-accent uppercase leading-none">
                          {d.toLocaleDateString(undefined, { month: "short" })}
                        </span>
                        <span className="text-sm font-bold text-accent leading-none">{d.getDate()}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800 truncate group-hover:text-accent transition-colors">
                          {item.title}
                        </p>
                        <p className="text-xs text-slate-400 capitalize">{item.status.replace(/-/g, " ")}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* SEO trend */}
        <SeoScoreTrendCard />

      </div>
    </div>
  );
}
