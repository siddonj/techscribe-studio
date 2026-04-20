import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { TOOLS, getAllCategories } from "@/lib/tools";
import { STARTER_TEMPLATES, WORKFLOW_PRESETS } from "@/lib/workflow-presets";
import SeoScoreTrendCard from "@/components/SeoScoreTrendCard";

const CATEGORY_ICONS: Record<string, string> = {
  "Content Creation": "✍️",
  "Ideas & Planning": "💡",
  "SEO & Keywords": "🔍",
  "Editing & Rewriting": "🔄",
  "Social Media": "📱",
  "Email & Marketing": "📣",
  "Video Content": "🎬",
};

const SEO_PRESET_DEFAULTS: Record<string, { stage: string; keyword: string }> = {
  "idea-to-ranked-post": { stage: "Idea", keyword: "developer productivity" },
  "youtube-repurpose-loop": { stage: "Drafting", keyword: "content repurposing" },
  "refresh-existing-content": { stage: "Optimization", keyword: "content refresh" },
};

function getSeoWorkspacePresetHref(presetId: string): string {
  const defaults = SEO_PRESET_DEFAULTS[presetId] ?? { stage: "Optimization", keyword: "seo workflow" };
  return `/seo?${new URLSearchParams({ preset: presetId, stage: defaults.stage, keyword: defaults.keyword })}`;
}

function greeting(name: string | null | undefined) {
  const hour = new Date().getHours();
  const time = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return name ? `${time}, ${name.split(" ")[0]}` : time;
}

async function getDashboardStats(isAdmin: boolean) {
  try {
    const db = getDb();
    const recentSaves = (db.prepare(
      "SELECT COUNT(*) as count FROM history WHERE created_at >= datetime('now', '-7 days')"
    ).get() as { count: number }).count;

    const todayItems = (db.prepare(
      "SELECT COUNT(*) as count FROM calendar WHERE scheduled_for = date('now') AND status != 'published'"
    ).get() as { count: number }).count;

    const failedPublishes = (db.prepare(
      "SELECT COUNT(*) as count FROM history WHERE wp_publish_state = 'failed'"
    ).get() as { count: number }).count;

    const pendingUsers = isAdmin
      ? (db.prepare("SELECT COUNT(*) as count FROM users WHERE status = 'pending'").get() as { count: number }).count
      : 0;

    const recentHistory = db.prepare(
      "SELECT id, title, tool_name, tool_icon, created_at FROM history ORDER BY created_at DESC LIMIT 4"
    ).all() as { id: number; title: string; tool_name: string; tool_icon: string; created_at: string }[];

    const upcomingItems = db.prepare(
      "SELECT id, title, scheduled_for, status FROM calendar WHERE scheduled_for >= date('now') AND status != 'published' ORDER BY scheduled_for ASC LIMIT 4"
    ).all() as { id: number; title: string; scheduled_for: string; status: string }[];

    return { recentSaves, todayItems, failedPublishes, pendingUsers, recentHistory, upcomingItems };
  } catch {
    return { recentSaves: 0, todayItems: 0, failedPublishes: 0, pendingUsers: 0, recentHistory: [], upcomingItems: [] };
  }
}

const QUICK_ACTIONS = [
  { href: "/calendar", label: "Calendar", title: "Editorial calendar", description: "Plan backlog, schedule approved pieces, and keep publishing dates visible across the team.", icon: "🗓️" },
  { href: "/history", label: "History", title: "Content archive", description: "Inspect saved generations, reopen drafts, and organise content by folder or tag.", icon: "🕒" },
  { href: "/seo", label: "SEO", title: "SEO workspace", description: "Run keyword-based checks, track checklist progress, and save SEO signals to each draft.", icon: "📈" },
  { href: "/automation", label: "Automation", title: "Batch & automation", description: "Monitor reusable jobs, recent runs, and scheduler-ready automation payloads.", icon: "🤖" },
  { href: "/settings", label: "Settings", title: "WordPress & integrations", description: "Check credentials, confirm draft publishing, and keep the publishing pipeline ready.", icon: "⚙️" },
];

export default async function Dashboard() {
  const session = await getServerSession(authOptions);
  const user = session?.user as ({ name?: string | null; email?: string | null; image?: string | null; role?: string; status?: string }) | undefined;
  const isAdmin = user?.role === "admin";
  const stats = await getDashboardStats(isAdmin);
  const categories = getAllCategories();
  const hasAttention = stats.failedPublishes > 0 || (isAdmin && stats.pendingUsers > 0);

  return (
    <div className="p-5 md:p-8 max-w-7xl mx-auto space-y-8">

      {/* Personalized hero */}
      <section className="shell-panel shell-hero-grid rounded-[2rem] p-6 md:p-8 overflow-hidden relative">
        <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute bottom-0 right-16 h-28 w-28 rounded-full bg-slate-200/70 blur-2xl" />

        <div className="relative grid gap-8 xl:grid-cols-[1.2fr_0.8fr] items-start">
          <div>
            <div className="inline-flex items-center gap-2 shell-badge rounded-full px-3 py-1.5 text-[11px] font-mono tracking-[0.24em] uppercase text-accent mb-5">
              Editorial Workspace
            </div>
            <h1 className="text-4xl md:text-5xl text-white max-w-3xl leading-tight" style={{ fontFamily: "var(--font-display)" }}>
              {greeting(user?.name)}
            </h1>
            <p className="mt-3 text-slate-300 text-base md:text-lg max-w-2xl leading-relaxed">
              {stats.todayItems > 0
                ? `You have ${stats.todayItems} item${stats.todayItems > 1 ? "s" : ""} scheduled for today.`
                : "Your editorial workspace is ready. Pick a tool or check the calendar to get started."}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/calendar" className="rounded-2xl bg-accent text-white px-5 py-3 text-sm font-semibold hover:bg-accent-dim transition-colors">
                Open Calendar
              </Link>
              <Link href="/history" className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-900 hover:border-accent/30 hover:text-accent transition-colors">
                Review History
              </Link>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 xl:grid-cols-2 gap-3">
            {[
              { label: "Saves this week", value: stats.recentSaves, meta: "history entries" },
              { label: "Today's items", value: stats.todayItems, meta: "on the calendar" },
              { label: "Failed publishes", value: stats.failedPublishes, meta: stats.failedPublishes > 0 ? "need retry" : "all clear" },
              { label: "Tool library", value: TOOLS.length, meta: "available tools" },
            ].map((stat) => (
              <div key={stat.label} className="shell-stat-card rounded-3xl p-5">
                <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-slate-500">{stat.label}</p>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <div className="text-3xl font-semibold text-white" style={{ fontFamily: "var(--font-display)" }}>
                    {stat.value}
                  </div>
                  <span className={`text-xs ${stat.label === "Failed publishes" && stat.value > 0 ? "text-red-400" : "text-accent"}`}>
                    {stat.meta}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Attention strip */}
      {hasAttention && (
        <section className="flex flex-wrap gap-3">
          {isAdmin && stats.pendingUsers > 0 && (
            <Link href="/admin/users" className="flex-1 min-w-[200px] shell-panel rounded-2xl px-5 py-4 border border-amber-400/30 bg-amber-400/5 hover:border-amber-400/50 transition-colors group">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-mono uppercase tracking-wider text-amber-600 mb-1">Access Requests</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {stats.pendingUsers} user{stats.pendingUsers > 1 ? "s" : ""} awaiting approval
                  </p>
                </div>
                <span className="text-amber-500 group-hover:translate-x-0.5 transition-transform text-lg">→</span>
              </div>
            </Link>
          )}
          {stats.failedPublishes > 0 && (
            <Link href="/history?publish_state=failed" className="flex-1 min-w-[200px] shell-panel rounded-2xl px-5 py-4 border border-red-400/30 bg-red-400/5 hover:border-red-400/50 transition-colors group">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-mono uppercase tracking-wider text-red-600 mb-1">Publish Failures</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {stats.failedPublishes} draft{stats.failedPublishes > 1 ? "s" : ""} failed to publish
                  </p>
                </div>
                <span className="text-red-500 group-hover:translate-x-0.5 transition-transform text-lg">→</span>
              </div>
            </Link>
          )}
        </section>
      )}

      {/* Quick actions + recent activity */}
      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="grid gap-3">
          {QUICK_ACTIONS.map((action) => (
            <Link key={action.href} href={action.href} className="group shell-panel rounded-[1.75rem] p-5 shell-hover-lift transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-slate-500">{action.label}</p>
                  <h3 className="text-xl text-white mt-2 group-hover:text-accent transition-colors" style={{ fontFamily: "var(--font-display)" }}>
                    {action.title}
                  </h3>
                  <p className="text-sm text-slate-400 mt-2 leading-relaxed">{action.description}</p>
                </div>
                <span className="text-3xl shrink-0">{action.icon}</span>
              </div>
            </Link>
          ))}
        </div>

        <div className="space-y-4">
          {/* Recent history */}
          <div className="shell-panel rounded-[2rem] p-6">
            <p className="font-mono text-[11px] text-accent uppercase tracking-[0.24em] mb-4">Recent Saves</p>
            {stats.recentHistory.length === 0 ? (
              <p className="text-sm text-slate-400">No saved content yet. Generate something and save it to history.</p>
            ) : (
              <div className="space-y-2">
                {stats.recentHistory.map((entry) => (
                  <Link key={entry.id} href={`/history`} className="flex items-center gap-3 rounded-2xl p-3 hover:bg-black/5 transition-colors group">
                    <span className="text-xl shrink-0">{entry.tool_icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900 truncate group-hover:text-accent transition-colors">{entry.title}</p>
                      <p className="text-xs text-muted">{entry.tool_name} · {new Date(entry.created_at).toLocaleDateString()}</p>
                    </div>
                  </Link>
                ))}
                <Link href="/history" className="block text-xs text-center text-accent hover:text-accent-dim pt-1 transition-colors">View all →</Link>
              </div>
            )}
          </div>

          {/* Upcoming calendar */}
          <div className="shell-panel rounded-[2rem] p-6">
            <p className="font-mono text-[11px] text-accent uppercase tracking-[0.24em] mb-4">Upcoming</p>
            {stats.upcomingItems.length === 0 ? (
              <p className="text-sm text-slate-400">Nothing scheduled. Add items to the calendar to see them here.</p>
            ) : (
              <div className="space-y-2">
                {stats.upcomingItems.map((item) => (
                  <Link key={item.id} href="/calendar" className="flex items-center gap-3 rounded-2xl p-3 hover:bg-black/5 transition-colors group">
                    <div className="h-10 w-10 rounded-xl bg-accent/10 border border-accent/20 flex flex-col items-center justify-center shrink-0">
                      <span className="text-[10px] font-mono text-accent leading-none">
                        {new Date(`${item.scheduled_for}T00:00:00`).toLocaleDateString(undefined, { month: "short" }).toUpperCase()}
                      </span>
                      <span className="text-sm font-bold text-accent leading-none">
                        {new Date(`${item.scheduled_for}T00:00:00`).getDate()}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900 truncate group-hover:text-accent transition-colors">{item.title}</p>
                      <p className="text-xs text-muted capitalize">{item.status}</p>
                    </div>
                  </Link>
                ))}
                <Link href="/calendar" className="block text-xs text-center text-accent hover:text-accent-dim pt-1 transition-colors">Open calendar →</Link>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <SeoScoreTrendCard />
        <div className="shell-panel rounded-[2rem] p-6 md:p-7">
          <p className="font-mono text-[11px] text-accent uppercase tracking-[0.24em] mb-3">Guided Workflow Presets</p>
          <h2 className="text-2xl md:text-3xl text-white" style={{ fontFamily: "var(--font-display)" }}>
            Launch repeatable pipelines without rebuilding prompts from scratch.
          </h2>
          <div className="mt-5 space-y-3">
            {WORKFLOW_PRESETS.map((preset) => (
              <Link key={preset.id} href={getSeoWorkspacePresetHref(preset.id)} className="group block shell-panel-soft rounded-3xl p-4 border border-transparent hover:border-accent/30 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-slate-500">{preset.stage}</p>
                    <h3 className="text-lg text-white mt-1 group-hover:text-accent transition-colors" style={{ fontFamily: "var(--font-display)" }}>
                      {preset.name}
                    </h3>
                    <p className="text-sm text-slate-400 mt-2 leading-relaxed">{preset.description}</p>
                  </div>
                  <span className="text-xs font-mono text-accent mt-1">Launch</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {preset.steps.slice(0, 3).map((step) => (
                    <span key={step} className="text-[11px] font-mono rounded-full border border-border px-2 py-1 text-slate-500">{step}</span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="shell-panel rounded-[2rem] p-6 md:p-7">
          <p className="font-mono text-[11px] text-accent uppercase tracking-[0.24em] mb-3">Starter Templates</p>
          <h2 className="text-2xl md:text-3xl text-white" style={{ fontFamily: "var(--font-display)" }}>
            Onboard teams with pre-structured first-week operating patterns.
          </h2>
          <div className="mt-5 grid gap-3">
            {STARTER_TEMPLATES.map((template) => (
              <Link key={template.id} href={template.href} className="group shell-panel-soft rounded-3xl p-4 border border-transparent hover:border-accent/30 transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-mono uppercase tracking-[0.2em] text-slate-500">{template.persona}</p>
                  <span className="text-xs font-mono text-slate-500">Template</span>
                </div>
                <h3 className="text-xl text-white mt-2 group-hover:text-accent transition-colors" style={{ fontFamily: "var(--font-display)" }}>
                  {template.title}
                </h3>
                <p className="text-sm text-slate-400 mt-2 leading-relaxed">{template.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {categories.map((cat) => {
        const tools = TOOLS.filter((t) => t.category === cat);
        return (
          <section key={cat} className="shell-panel rounded-[2rem] p-5 md:p-6">
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <span className="text-2xl">{CATEGORY_ICONS[cat] || "🔧"}</span>
              <h2 className="text-xl text-white" style={{ fontFamily: "var(--font-display)" }}>{cat}</h2>
              <span className="font-mono text-xs text-slate-400 shell-badge px-2.5 py-1 rounded-full">{tools.length} tools</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {tools.map((tool) => (
                <Link key={tool.slug} href={`/tool/${tool.slug}`} className="group shell-panel-soft rounded-[1.5rem] p-4 md:p-5 transition-colors hover:border-accent/30">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-2xl mb-3">{tool.icon}</div>
                      <div className="text-base font-medium text-white group-hover:text-accent transition-colors mb-2">{tool.name}</div>
                    </div>
                    <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-slate-500">Tool</span>
                  </div>
                  <div className="text-sm text-slate-400 line-clamp-2 leading-relaxed">{tool.description}</div>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
