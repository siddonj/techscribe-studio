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
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-12">
        <div className="font-mono text-accent text-xs tracking-widest uppercase mb-3">
          Welcome back
        </div>
        <h1
          className="text-4xl text-white mb-4"
          style={{ fontFamily: "var(--font-display)" }}
        >
          TechScribe Studio
        </h1>
        <p className="text-slate-400 text-lg max-w-xl">
          Your personal AI writing studio for{" "}
          <span className="text-accent">techscribe.org</span>. All tools,
          no limits, self-hosted.
        </p>

        {/* Stats bar */}
        <div className="flex gap-6 mt-6">
          {[
            { label: "Total Tools", value: TOOLS.length },
            { label: "Categories", value: categories.length },
            { label: "Model", value: "Claude" },
          ].map((s) => (
            <div key={s.label} className="bg-card border border-border rounded-lg px-5 py-3">
              <div className="text-2xl font-mono text-accent">{s.value}</div>
              <div className="text-xs text-muted mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="bg-card border border-border rounded-2xl p-6">
            <p className="font-mono text-accent text-xs tracking-widest uppercase mb-3">
              Phase 2 Focus
            </p>
            <h2
              className="text-2xl text-white mb-3"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Content Calendar & Scheduling
            </h2>
            <p className="text-slate-400 text-sm max-w-2xl">
              Plan article ideas, assign tools, schedule publishing dates, and move directly from a planned item into a prefilled writing workflow.
            </p>
          </div>

          <Link
            href="/calendar"
            className="group bg-card border border-border hover:border-accent/40 rounded-2xl p-6 transition-all duration-200 hover:bg-accent/5"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs text-muted uppercase tracking-wider mb-3">
                  Open Planner
                </p>
                <h3
                  className="text-xl text-white group-hover:text-accent transition-colors"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  Build Your Editorial Queue
                </h3>
                <p className="text-sm text-slate-400 mt-3">
                  Organize backlog ideas, this-week priorities, and scheduled drafts in one place.
                </p>
              </div>
              <span className="text-3xl shrink-0">🗓️</span>
            </div>
          </Link>
        </div>
      </div>

      {/* Tool categories */}
      {categories.map((cat) => {
        const tools = TOOLS.filter((t) => t.category === cat);
        return (
          <section key={cat} className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xl">{CATEGORY_ICONS[cat] || "🔧"}</span>
              <h2
                className="text-lg text-white"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {cat}
              </h2>
              <span className="font-mono text-xs text-muted bg-subtle px-2 py-0.5 rounded-full">
                {tools.length} tools
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {tools.map((tool) => (
                <Link
                  key={tool.slug}
                  href={`/tool/${tool.slug}`}
                  className="group bg-card border border-border hover:border-accent/40 rounded-xl p-4 transition-all duration-200 hover:bg-accent/5"
                >
                  <div className="text-2xl mb-2">{tool.icon}</div>
                  <div className="text-sm font-medium text-white group-hover:text-accent transition-colors mb-1">
                    {tool.name}
                  </div>
                  <div className="text-xs text-muted line-clamp-2">
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
