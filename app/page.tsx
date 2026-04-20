import Link from "next/link";
import { TOOLS, getAllCategories } from "@/lib/tools";
import { STARTER_TEMPLATES, WORKFLOW_PRESETS } from "@/lib/workflow-presets";
import SeoScoreTrendCard from "@/components/SeoScoreTrendCard";

const PHASE_TWO_PILLARS = [
  {
    title: "Planner-first workflow",
    description: "Build the queue, attach context, and hand the brief into a writing tool without re-entering details.",
  },
  {
    title: "Draft publishing loop",
    description: "Push generated output into WordPress drafts and keep the planning record synced to publishing state.",
  },
  {
    title: "Centralized control room",
    description: "Move between planning, generation history, and configuration from the same dashboard shell.",
  },
];

const QUICK_ACTIONS = [
  {
    href: "/seo",
    label: "SEO",
    title: "Score optimization readiness",
    description: "Run keyword-based checks, track checklist progress, and save SEO signals to each draft.",
    icon: "📈",
  },
  {
    href: "/calendar",
    label: "Calendar",
    title: "Manage the editorial calendar",
    description: "Plan backlog, schedule approved pieces, and keep publishing dates visible across the team.",
    icon: "🗓️",
  },
  {
    href: "/history",
    label: "History",
    title: "Review content output",
    description: "Inspect saved generations, reopen drafts, and organize content by folder or tag.",
    icon: "🕒",
  },
  {
    href: "/settings",
    label: "Integrations",
    title: "Verify WordPress publishing",
    description: "Check credentials, confirm draft publishing, and keep the publishing pipeline ready.",
    icon: "⚙️",
  },
  {
    href: "/automation",
    label: "Automation",
    title: "Track templates and run logs",
    description: "Monitor reusable jobs, recent runs, and scheduler-ready automation payloads.",
    icon: "🤖",
  },
];

const DASHBOARD_METRICS = [
  { label: "Tool Library", value: TOOLS.length, meta: "available workflows" },
  { label: "Categories", value: getAllCategories().length, meta: "organized groups" },
  { label: "Publishing", value: "Live", meta: "WordPress ready" },
];

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
  const defaults = SEO_PRESET_DEFAULTS[presetId] ?? {
    stage: "Optimization",
    keyword: "seo workflow",
  };

  const query = new URLSearchParams({
    preset: presetId,
    stage: defaults.stage,
    keyword: defaults.keyword,
  });

  return `/seo?${query.toString()}`;
}

export default function Dashboard() {
  const categories = getAllCategories();

  return (
    <div className="p-5 md:p-8 max-w-7xl mx-auto space-y-8">
      <section className="shell-panel shell-hero-grid rounded-[2rem] p-6 md:p-8 overflow-hidden relative">
        <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute bottom-0 right-16 h-28 w-28 rounded-full bg-slate-200/70 blur-2xl" />

        <div className="relative grid gap-8 xl:grid-cols-[1.2fr_0.8fr] items-start">
          <div>
            <div className="inline-flex items-center gap-2 shell-badge rounded-full px-3 py-1.5 text-[11px] font-mono tracking-[0.24em] uppercase text-accent">
              Editorial Workspace
            </div>
            <h1
              className="mt-5 text-4xl md:text-5xl text-white max-w-3xl leading-tight"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Run planning, content generation, and publishing from one CRM-style dashboard.
            </h1>
            <p className="mt-4 text-slate-300 text-base md:text-lg max-w-2xl leading-relaxed">
              The UI now follows the same visual language as ResiQ CRM: a structured sidebar, light canvas, clean cards, and teal-driven status cues that keep operations easy to scan.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/calendar"
                className="rounded-2xl bg-accent text-white px-5 py-3 text-sm font-semibold hover:bg-accent-dim transition-colors"
              >
                Open Calendar
              </Link>
              <Link
                href="/history"
                className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-900 hover:border-accent/30 hover:text-accent transition-colors"
              >
                Review History
              </Link>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 xl:grid-cols-1 gap-3">
            {DASHBOARD_METRICS.map((stat) => (
              <div key={stat.label} className="shell-stat-card rounded-3xl p-5">
                <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-slate-500">{stat.label}</p>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <div className="text-3xl font-semibold text-white" style={{ fontFamily: "var(--font-display)" }}>
                    {stat.value}
                  </div>
                  <span className="text-xs text-accent">{stat.meta}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="shell-panel rounded-[2rem] p-6 md:p-7">
          <p className="font-mono text-[11px] text-accent uppercase tracking-[0.24em] mb-3">
            Workspace Snapshot
          </p>
          <h2 className="text-2xl md:text-3xl text-white max-w-2xl" style={{ fontFamily: "var(--font-display)" }}>
            The dashboard is organized like an operations hub: a consistent sidebar for navigation, action cards for core workflows, and clean overview panels that surface what needs attention next.
            </h2>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {PHASE_TWO_PILLARS.map((pillar) => (
              <div key={pillar.title} className="shell-panel-soft rounded-3xl p-4">
                <p className="text-white font-semibold">{pillar.title}</p>
                <p className="text-sm text-slate-400 mt-2 leading-relaxed">{pillar.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3">
          {QUICK_ACTIONS.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="group shell-panel rounded-[1.75rem] p-5 shell-hover-lift transition-colors"
            >
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
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <SeoScoreTrendCard />
        <div className="shell-panel rounded-[2rem] p-6 md:p-7">
          <p className="font-mono text-[11px] text-accent uppercase tracking-[0.24em] mb-3">
            Guided Workflow Presets
          </p>
          <h2 className="text-2xl md:text-3xl text-white" style={{ fontFamily: "var(--font-display)" }}>
            Launch repeatable pipelines without rebuilding prompts from scratch.
          </h2>
          <div className="mt-5 space-y-3">
            {WORKFLOW_PRESETS.map((preset) => (
              <Link
                key={preset.id}
                href={getSeoWorkspacePresetHref(preset.id)}
                className="group block shell-panel-soft rounded-3xl p-4 border border-transparent hover:border-accent/30 transition-colors"
              >
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
                    <span key={step} className="text-[11px] font-mono rounded-full border border-border px-2 py-1 text-slate-500">
                      {step}
                    </span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="shell-panel rounded-[2rem] p-6 md:p-7">
          <p className="font-mono text-[11px] text-accent uppercase tracking-[0.24em] mb-3">
            Starter Templates
          </p>
          <h2 className="text-2xl md:text-3xl text-white" style={{ fontFamily: "var(--font-display)" }}>
            Onboard teams with pre-structured first-week operating patterns.
          </h2>
          <div className="mt-5 grid gap-3">
            {STARTER_TEMPLATES.map((template) => (
              <Link
                key={template.id}
                href={template.href}
                className="group shell-panel-soft rounded-3xl p-4 border border-transparent hover:border-accent/30 transition-colors"
              >
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
              <h2
                className="text-xl text-white"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {cat}
              </h2>
              <span className="font-mono text-xs text-slate-400 shell-badge px-2.5 py-1 rounded-full">
                {tools.length} tools
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {tools.map((tool) => (
                <Link
                  key={tool.slug}
                  href={`/tool/${tool.slug}`}
                  className="group shell-panel-soft rounded-[1.5rem] p-4 md:p-5 transition-colors hover:border-accent/30"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-2xl mb-3">{tool.icon}</div>
                      <div className="text-base font-medium text-white group-hover:text-accent transition-colors mb-2">
                        {tool.name}
                      </div>
                    </div>
                    <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-slate-500">Tool</span>
                  </div>
                  <div className="text-sm text-slate-400 line-clamp-2 leading-relaxed">
                    {tool.description}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
