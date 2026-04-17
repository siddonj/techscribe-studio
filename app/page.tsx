import Link from "next/link";
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

export default function Dashboard() {
  const categories = getAllCategories();

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-16">
        <div className="font-mono text-accent text-xs tracking-widest uppercase mb-3">
          Welcome back
        </div>
        <h1
          className="font-display text-4xl text-white mb-5"
        >
          TechScribe Studio
        </h1>
        <p className="text-slate-200 text-lg max-w-xl">
          Your personal AI writing studio for{" "}
          <span className="text-accent">techscribe.org</span>. All tools,
          no limits, self-hosted.
        </p>

        {/* Stats bar */}
        <div className="flex gap-8 mt-8">
          {[
            { label: "Total Tools", value: TOOLS.length },
            { label: "Categories", value: categories.length },
            { label: "Model", value: "Claude" },
          ].map((s) => (
            <div key={s.label} className="bg-card-alt border border-border rounded-lg px-5 py-3 shadow-card-inset">
              <div className="text-2xl font-mono text-accent">{s.value}</div>
              <div className="text-xs text-muted mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="bg-card border border-border rounded-2xl p-7 md:p-8 shadow-card-elevated">
            <p className="font-mono text-accent text-xs tracking-widest uppercase mb-4">
              Phase 2 Focus
            </p>
            <h2
              className="font-display text-2xl text-white mb-4"
            >
              Content Calendar & Scheduling
            </h2>
            <p className="text-slate-200 text-sm max-w-2xl">
              Plan article ideas, assign tools, schedule publishing dates, and move directly from a planned item into a prefilled writing workflow.
            </p>
          </div>

          <Link
            href="/calendar"
            className="group bg-card border border-border hover:border-accent/40 rounded-2xl p-7 md:p-8 transition-all duration-200 hover:bg-accent/5 shadow-card-elevated"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs text-muted uppercase tracking-wider mb-4">
                  Open Planner
                </p>
                <h3
                  className="font-display text-xl text-white group-hover:text-accent transition-colors"
                >
                  Build Your Editorial Queue
                </h3>
                <p className="text-sm text-slate-200 mt-4">
                  Organize backlog ideas, this-week priorities, and scheduled drafts in one place.
                </p>
              </div>
              <span className="text-3xl shrink-0">🗓️</span>
            </div>
          </Link>
        </div>
      </div>

      {/* Tool categories */}
      <div className="space-y-12">
        {categories.map((cat) => {
          const tools = TOOLS.filter((t) => t.category === cat);
          return (
            <section key={cat}>
              <div className="flex items-center gap-3 mb-6">
                <span className="text-xl">{CATEGORY_ICONS[cat] || "🔧"}</span>
                <h2
                  className="font-display text-lg text-white"
                >
                  {cat}
                </h2>
                <span className="font-mono text-xs text-muted bg-subtle px-2 py-0.5 rounded-full">
                  {tools.length} tools
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
                {tools.map((tool) => (
                  <Link
                    key={tool.slug}
                    href={`/tool/${tool.slug}`}
                    className="group bg-card border border-border hover:border-accent/40 rounded-xl p-6 transition-all duration-200 hover:bg-accent/5 shadow-card-elevated"
                  >
                    <div className="text-2xl mb-3">{tool.icon}</div>
                    <div className="text-sm font-medium text-white group-hover:text-accent transition-colors mb-2">
                      {tool.name}
                    </div>
                    <div className="text-sm text-slate-200 line-clamp-2">
                      {tool.description}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
