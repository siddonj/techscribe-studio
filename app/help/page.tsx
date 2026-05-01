"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { TOOLS, getAllCategories } from "@/lib/tools";
import { PageContainer, PageHeader, SectionCard, SectionHeader } from "@/components/DashboardPrimitives";

const CATEGORY_ICONS: Record<string, string> = {
  "Content Creation": "✍️",
  "Ideas & Planning": "💡",
  "SEO & Keywords": "🔍",
  "Editing & Rewriting": "🔄",
  "Social Media": "📱",
  "Email & Marketing": "📣",
  "Video Content": "🎬",
};

const FEATURE_SECTIONS = [
  {
    id: "getting-started",
    title: "Getting Started",
    icon: "🚀",
    content: [
      {
        heading: "What is TechScribe Studio?",
        body: "TechScribe Studio is a self-hosted AI writing workspace. It gives content teams and solo publishers a full editorial system: generate content with AI, organise it in a calendar, archive it in history, and publish drafts directly to WordPress — all from one interface.",
      },
      {
        heading: "Core workflow",
        body: "The typical flow is: pick a tool from the sidebar → fill in the brief → generate → save to History → link to a Calendar entry → publish to WordPress when ready. Each step is optional — you can use tools standalone without saving or publishing.",
      },
      {
        heading: "Setting up WordPress publishing",
        body: "Go to Settings and enter your WordPress site URL, username, and application password. Run the connection test before publishing. If the test passes, the Publish button becomes available on all tool and history pages.",
      },
      {
        heading: "API key",
        body: "TechScribe Studio requires an Anthropic API key to generate content. Set ANTHROPIC_API_KEY in your .env.local file or deployment environment. Without it, the generate endpoint returns an error.",
      },
    ],
  },
  {
    id: "tools",
    title: "Writing Tools",
    icon: "🔧",
    content: [
      {
        heading: "How tools work",
        body: "Each tool has a form (the Input Studio) and an output panel. Fill in the fields, click Generate, and content streams in real time. Once generation is complete, you can copy, save to History, or publish directly to WordPress.",
      },
      {
        heading: "Outline-first flow",
        body: "Article Writer, Listicle Writer, and a few others support a two-step flow. Click the Outline button to generate a structure first, review and edit it, then click Generate Article to write the full post from your approved outline.",
      },
      {
        heading: "Research / knowledge inputs",
        body: "Article Writer supports an '+ Add Knowledge' panel where you can paste reference material, competitor content, or research notes. The AI incorporates the context into the output without verbatim copying.",
      },
      {
        heading: "Handoffs between tools",
        body: "After generation, supported tools show a handoff card with action buttons. These open a downstream tool pre-filled with relevant data — for example, Outline Generator → Article Writer carries over the outline title, keywords, and audience.",
      },
    ],
  },
  {
    id: "calendar",
    title: "Content Calendar",
    icon: "🗓️",
    content: [
      {
        heading: "Views",
        body: "The calendar has three views: List (grouped by overdue / today / upcoming / later / unscheduled), Week (7-column board with a backlog lane), and Month (full month grid). Switch between them with the toggle in the top-left of the calendar panel.",
      },
      {
        heading: "Quick rescheduling",
        body: "In List view, use the inline date input on each card to reschedule without opening the editor. In Week and Month views, select an item then click a different day to move it. Changes apply immediately with optimistic UI.",
      },
      {
        heading: "Planning metadata",
        body: "Each calendar entry carries a production checklist, owner, reviewer, approval status, and WordPress publishing metadata (target category, tags, publish intent). Open an entry in the right-hand editor panel to fill these in.",
      },
      {
        heading: "Linking to tools",
        body: "Click 'Open in Tool' on a calendar entry to open its assigned writing tool with all planning fields pre-filled. Saving the generated output links the history entry back to the calendar item automatically.",
      },
    ],
  },
  {
    id: "history",
    title: "History & Archive",
    icon: "📁",
    content: [
      {
        heading: "What gets saved",
        body: "Every piece of content you explicitly save gets stored in a local SQLite database. History entries store the tool used, the output, metadata (folder, tags, title), and WordPress publish state.",
      },
      {
        heading: "Filtering and search",
        body: "Use the filter bar to narrow history by tool, status, folder, tag, date range, or publish state. The search box matches against title and output content. Filters can be combined.",
      },
      {
        heading: "Folders and tags",
        body: "Assign folders and tags when saving, or edit them later in the history detail panel. Use the Folders/Tags management view to rename, merge, or delete labels across your whole archive.",
      },
      {
        heading: "Bulk actions",
        body: "Select multiple history entries with the checkboxes to bulk-export, bulk-delete, bulk-tag, or bulk-retry failed WordPress publishes. Bulk retry is useful when a WordPress connection issue caused multiple publish failures.",
      },
    ],
  },
  {
    id: "publishing",
    title: "WordPress Publishing",
    icon: "🌐",
    content: [
      {
        heading: "Publish states",
        body: "Each history entry tracks one of five publish states: Draft Linked (WordPress draft created), Draft Updated (existing draft updated), Scheduled (queued for future publication on WordPress), Published Live (post is live), or Publish Failed (last attempt failed, retry available).",
      },
      {
        heading: "Scheduling model",
        body: "TechScribe Studio uses a WordPress-owned scheduling model. Set the publish intent to Schedule and a target date in the Calendar entry. When you trigger the publish action, the app sends the date to WordPress as the intended publish time — WordPress then owns the exact timing.",
      },
      {
        heading: "Editable metadata",
        body: "Before publishing, you can set a custom URL slug, excerpt, target categories, and tags in the History detail panel. These are sent to WordPress alongside the content.",
      },
      {
        heading: "Retrying failed publishes",
        body: "Failed publish attempts are retryable from the History screen without regenerating. Select the failed entry and click Retry Publish, or use bulk retry to retry multiple failures at once.",
      },
    ],
  },
  {
    id: "automation",
    title: "Automation",
    icon: "⚙️",
    content: [
      {
        heading: "Batch generation API",
        body: "POST /api/generate/batch accepts an array of jobs, each specifying a tool slug and field values. Results are returned in order. Set BATCH_API_SECRET in your environment and include it as a Bearer token in every request.",
      },
      {
        heading: "Saved templates",
        body: "Save a reusable batch definition in the Automation page as a named template. Reference it by template_id in a batch request instead of repeating the full jobs array — useful for recurring scheduled jobs.",
      },
      {
        heading: "Linking to calendar",
        body: "Each batch job can include a calendar_id to link the saved output back to a planned calendar entry. The calendar item status advances to in-progress automatically when the job completes.",
      },
      {
        heading: "Run history",
        body: "The Automation page shows a log of recent batch runs with success and error counts, trigger source, and template linkage. Use it to verify scheduled jobs are running and producing output.",
      },
    ],
  },
];

export default function HelpPage() {
  const [query, setQuery] = useState("");
  const categories = getAllCategories();
  const lowerQuery = query.toLowerCase().trim();

  const filteredTools = lowerQuery
    ? TOOLS.filter(
        (t) =>
          t.name.toLowerCase().includes(lowerQuery) ||
          t.description.toLowerCase().includes(lowerQuery) ||
          t.category.toLowerCase().includes(lowerQuery)
      )
    : null;

  return (
    <div className="min-h-screen flex flex-col">
      <PageContainer maxWidthClassName="max-w-5xl" className="space-y-8">
        <PageHeader
          eyebrow="Reference"
          title="Help & Documentation"
          description="Guides, feature walkthroughs, and a full tool directory."
          icon="📖"
          stats={[
            { label: "Tools", value: String(TOOLS.length) },
            { label: "Categories", value: String(categories.length) },
            { label: "Features", value: String(FEATURE_SECTIONS.length) },
          ]}
        />

        {/* Feature walkthroughs */}
        <section className="space-y-4">
          <SectionHeader
            eyebrow="Feature Guides"
            title="Browse by workflow area"
            description="Jump to guided docs for each major surface."
          />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {FEATURE_SECTIONS.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="surface-interactive surface-interactive-default shell-hover-lift rounded-2xl p-5 block group"
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">{section.icon}</span>
                <h3 className="font-semibold text-slate-900 group-hover:text-accent transition-colors">
                  {section.title}
                </h3>
              </div>
              <p className="text-sm text-muted leading-relaxed">
                {section.content[0].body.slice(0, 100)}…
              </p>
            </a>
          ))}
        </div>
        </section>

        {/* Feature detail sections */}
        {FEATURE_SECTIONS.map((section) => (
          <section key={section.id} id={section.id} className="scroll-mt-8">
            <SectionHeader
              className="mb-4"
              title={
                <span className="inline-flex items-center gap-3">
                  <span className="text-2xl">{section.icon}</span>
                  <span>{section.title}</span>
                </span>
              }
            />
            <SectionCard className="rounded-2xl divide-y divide-border p-0">
            {section.content.map((item, i) => (
              <div key={i} className="p-5">
                <h3 className="text-sm font-semibold text-slate-900 mb-1.5">{item.heading}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{item.body}</p>
              </div>
            ))}
            </SectionCard>
          </section>
        ))}

        {/* Tool directory */}
        <section id="tool-directory" className="scroll-mt-8">
          <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
            <h2 className="text-xl font-semibold text-slate-900">Tool Directory</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted pointer-events-none" />
              <input
                type="text"
                placeholder="Search tools…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="input-base rounded-xl pl-8 pr-4 py-2 text-sm w-64"
              />
            </div>
          </div>

        {filteredTools !== null ? (
          filteredTools.length === 0 ? (
            <SectionCard className="rounded-2xl p-8 text-center text-sm text-muted">
              No tools match &ldquo;{query}&rdquo;
            </SectionCard>
          ) : (
            <SectionCard className="rounded-2xl divide-y divide-border p-0">
              {filteredTools.map((tool) => (
                <div key={tool.slug} id={tool.slug} className="flex items-start gap-4 p-4 scroll-mt-8">
                  <span className="text-2xl shrink-0 mt-0.5">{tool.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Link
                        href={`/tool/${tool.slug}`}
                          className="text-sm font-semibold text-slate-900 hover:text-accent transition-colors"
                        >
                          {tool.name}
                        </Link>
                      <span className="status-badge text-[10px] px-2 py-0.5 border-border text-muted">
                        {tool.category}
                      </span>
                      {tool.outlineSystemPrompt && (
                        <span className="status-badge text-[10px] px-2 py-0.5 border-accent/30 bg-accent/5 text-accent">
                          outline flow
                        </span>
                      )}
                      {tool.supportsResearch && (
                        <span className="status-badge text-[10px] px-2 py-0.5 border-accent/30 bg-accent/5 text-accent">
                          research inputs
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 leading-relaxed">{tool.description}</p>
                    <p className="text-xs text-muted mt-1.5">
                      Fields: {tool.fields.map((f) => f.label).join(" · ")}
                    </p>
                  </div>
                  <Link
                    href={`/tool/${tool.slug}`}
                    className="btn-secondary shrink-0 text-xs border-accent/30 text-accent hover:border-accent/60 hover:text-accent-dim"
                  >
                    Open →
                  </Link>
                </div>
              ))}
            </SectionCard>
          )
        ) : (
          <div className="space-y-6">
            {categories.map((cat) => {
              const catTools = TOOLS.filter((t) => t.category === cat);
              return (
                <div key={cat}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">{CATEGORY_ICONS[cat] ?? "🔧"}</span>
                    <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-muted">{cat}</h3>
                    <span className="text-xs text-muted">({catTools.length})</span>
                  </div>
                  <SectionCard className="rounded-2xl divide-y divide-border p-0">
                    {catTools.map((tool) => (
                      <div key={tool.slug} id={tool.slug} className="flex items-start gap-4 p-4 scroll-mt-8">
                        <span className="text-2xl shrink-0 mt-0.5">{tool.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <Link
                              href={`/tool/${tool.slug}`}
                              className="text-sm font-semibold text-slate-900 hover:text-accent transition-colors"
                            >
                              {tool.name}
                            </Link>
                            {tool.outlineSystemPrompt && (
                              <span className="status-badge text-[10px] px-2 py-0.5 border-accent/30 bg-accent/5 text-accent">
                                outline flow
                              </span>
                            )}
                            {tool.supportsResearch && (
                              <span className="status-badge text-[10px] px-2 py-0.5 border-accent/30 bg-accent/5 text-accent">
                                research inputs
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-500 leading-relaxed">{tool.description}</p>
                          <p className="text-xs text-muted mt-1.5">
                            Fields: {tool.fields.map((f) => f.label).join(" · ")}
                          </p>
                        </div>
                        <Link
                          href={`/tool/${tool.slug}`}
                          className="btn-secondary shrink-0 text-xs border-accent/30 text-accent hover:border-accent/60 hover:text-accent-dim"
                        >
                          Open →
                        </Link>
                      </div>
                    ))}
                  </SectionCard>
                </div>
              );
            })}
          </div>
        )}
        </section>
      </PageContainer>
    </div>
  );
}
