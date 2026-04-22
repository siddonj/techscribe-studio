"use client";

import { X, BookOpen, Lightbulb, FileText } from "lucide-react";
import Link from "next/link";
import type { Tool } from "@/lib/tools";

// Per-tool practical tips. Falls back to CATEGORY_TIPS when not set.
const TOOL_TIPS: Partial<Record<string, string[]>> = {
  "article-writer": [
    "Fill in both keywords and audience before generating — the AI uses them to shape headings and distribute terms naturally.",
    "Use the Context/Brief field to set the editorial angle. A single sentence brief cuts revision time significantly.",
    "Use the outline-first flow for long articles — reviewing structure before writing saves time if the direction needs adjustment.",
  ],
  "listicle-writer": [
    "Odd numbers (7, 9, 11) tend to perform better in search than round numbers.",
    "Give the topic specificity — '10 VS Code extensions for React devs' generates more useful output than '10 VS Code extensions'.",
  ],
  "keyword-research-brief": [
    "Paste raw export data directly from Ahrefs, SEMrush, or Google Keyword Planner — the tool parses it automatically.",
    "Use the Plan in Calendar handoff to queue the resulting brief without re-entering the title and keywords.",
  ],
  "youtube-to-blog": [
    "Remove timestamps and speaker labels from the transcript before pasting — they confuse the structure.",
    "Use the outline-first option when the transcript is long or loosely structured.",
  ],
  "outline-generator": [
    "After generating, open the result in Article Writer via the handoff button — the outline, keywords, and audience carry over automatically.",
  ],
  "meta-title": [
    "Generate 5–10 options, then pick the one with the best keyword placement and click-worthy angle.",
    "Aim for titles under 60 characters so they render fully in Google search results.",
  ],
  "meta-description": [
    "Keep descriptions between 120–160 characters — too short wastes space, too long gets truncated.",
    "Include a clear action phrase ('Learn how to…', 'Discover…') to improve click-through rate.",
  ],
  "schema-markup": [
    "Choose the schema type that matches your content: Article or BlogPosting for blog posts, FAQPage for FAQ sections, HowTo for step-by-step guides.",
    "Paste the generated JSON-LD into a <script type=\"application/ld+json\"> tag in your page's <head> — or use your CMS's structured data field.",
    "Test your schema using Google's Rich Results Test (search.google.com/test/rich-results) to verify it qualifies for rich snippets.",
    "For FAQPage schemas, list each question on a new line in the 'Additional Details' field so the AI formats them correctly.",
  ],
  "og-meta-tags": [
    "Set the social image to at least 1200×630px for best display on Facebook and LinkedIn.",
    "The og:description should be different from your meta description — write it to be more conversational and engaging for social sharing.",
    "Twitter card type 'summary_large_image' shows a large image preview — use it when you have a high-quality cover image.",
    "Paste the generated tags into the <head> section of your HTML, or into your CMS's Custom HTML / SEO settings.",
  ],
  "content-rewriter": [
    "Paste the section you want changed, not the whole article — more focused input yields better rewrites.",
  ],
  "explain-like-five": [
    "Works well for onboarding docs, tooltips, and introductory blog sections where jargon is a barrier.",
  ],
  "aida-copy": [
    "AIDA (Attention, Interest, Desire, Action) is best suited for landing pages, email campaigns, and product descriptions.",
  ],
};

const CATEGORY_TIPS: Record<string, string[]> = {
  "Content Creation": [
    "Be specific with your topic — the more focused the input, the more useful the output.",
    "Set your target audience to shape tone and assumed knowledge level.",
    "Save generated output to History immediately so you can revisit and iterate without regenerating.",
  ],
  "Ideas & Planning": [
    "Generate a batch of ideas, then use the handoff buttons to send the best ones directly into Article Writer or Outline Generator.",
    "Link a planning session to a Calendar entry so the idea stays connected to your editorial schedule.",
  ],
  "SEO & Keywords": [
    "Pair keyword tools with Article Writer — use the handoff buttons to carry researched terms into your draft.",
    "Run Meta Title and Meta Description generation after the article is written, using the final title as input.",
  ],
  "Editing & Rewriting": [
    "Feed in a focused section rather than the full article for more targeted results.",
    "Use Content Shortener before publishing to web pages or email where space is tight.",
  ],
  "Social Media": [
    "Generate 5–10 variations, then pick the one that fits your brand voice best.",
    "For LinkedIn and Twitter, leave room for a link or media attachment when counting characters.",
  ],
  "Email & Marketing": [
    "Test two subject line variations (A/B) — generate a batch and pick the strongest contrasting pair.",
    "AIDA Copy works well for landing pages as well as email.",
  ],
  "Video Content": [
    "For YouTube to Blog Post, paste the full transcript — the longer the input, the richer the output.",
    "Video titles and descriptions can be generated together in sequence for consistency.",
  ],
};

function getFieldHint(fieldName: string, placeholder?: string): string {
  if (placeholder) return placeholder;
  const hints: Record<string, string> = {
    topic: "The main subject of the content.",
    keywords: "Comma-separated terms to target in the output.",
    audience: "Who the content is written for.",
    tone: "The writing style and register.",
    length: "Target word count or format size.",
    context: "Any brief, angle, or background the AI should know.",
    transcript: "The full text or auto-generated transcript of the video.",
    content: "The existing text you want to transform.",
    niche: "The industry or topic area.",
    count: "How many items or options to generate.",
  };
  return hints[fieldName] ?? "Input for this field.";
}

export default function HelpDrawer({
  tool,
  open,
  onClose,
}: {
  tool: Tool;
  open: boolean;
  onClose: () => void;
}) {
  const tips =
    TOOL_TIPS[tool.slug] ?? CATEGORY_TIPS[tool.category] ?? [];

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <aside
        className={`fixed top-0 right-0 z-50 h-full w-96 flex flex-col shell-panel border-l border-border shadow-2xl transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-2xl shrink-0">{tool.icon}</span>
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent">Help</p>
              <p className="text-sm font-semibold text-slate-900 truncate">{tool.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-xl border border-border flex items-center justify-center text-slate-400 hover:text-slate-900 hover:border-accent/40 transition-colors shrink-0"
            aria-label="Close help"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* About */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="h-3.5 w-3.5 text-accent shrink-0" />
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent">About</p>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">{tool.description}</p>
            <span className="inline-block mt-2 text-xs font-mono border border-border rounded-full px-2.5 py-0.5 text-muted">
              {tool.category}
            </span>
          </section>

          {/* Fields guide */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <FileText className="h-3.5 w-3.5 text-accent shrink-0" />
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent">Fields</p>
            </div>
            <div className="space-y-3">
              {tool.fields.map((field) => (
                <div key={field.name} className="rounded-xl border border-border bg-card-alt p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <p className="text-xs font-semibold text-slate-900">{field.label}</p>
                    {field.required && (
                      <span className="text-[10px] font-mono text-accent border border-accent/30 rounded px-1 leading-tight">
                        required
                      </span>
                    )}
                    {field.type === "select" && (
                      <span className="text-[10px] font-mono text-muted border border-border rounded px-1 leading-tight">
                        select
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {getFieldHint(field.name, field.placeholder)}
                  </p>
                  {field.type === "select" && field.options && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {field.options.map((opt) => (
                        <span
                          key={opt}
                          className="text-[10px] font-mono bg-subtle border border-border rounded px-1.5 py-0.5 text-muted"
                        >
                          {opt}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Tips */}
          {tips.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="h-3.5 w-3.5 text-accent shrink-0" />
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent">Tips</p>
              </div>
              <ul className="space-y-2.5">
                {tips.map((tip, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-slate-600 leading-relaxed">
                    <span className="text-accent mt-0.5 shrink-0 text-xs font-mono">→</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Outline flow note */}
          {tool.outlineSystemPrompt && (
            <section className="rounded-xl border border-accent/20 bg-accent/5 p-3">
              <p className="text-xs font-semibold text-accent mb-1">Outline-first flow available</p>
              <p className="text-xs text-slate-500 leading-relaxed">
                This tool supports a two-step flow: generate an outline first, review and edit it, then write the full article. Toggle it with the Outline button above the generate action.
              </p>
            </section>
          )}

          {/* Research note */}
          {tool.supportsResearch && (
            <section className="rounded-xl border border-accent/20 bg-accent/5 p-3">
              <p className="text-xs font-semibold text-accent mb-1">Research inputs supported</p>
              <p className="text-xs text-slate-500 leading-relaxed">
                Use &ldquo;+ Add Knowledge&rdquo; in the Input Studio to paste in reference material, competitor content, or raw research. The AI incorporates it into the output.
              </p>
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border shrink-0">
          <Link
            href={`/help#${tool.slug}`}
            onClick={onClose}
            className="flex items-center justify-between w-full rounded-xl border border-border px-4 py-2.5 text-sm text-slate-600 hover:text-slate-900 hover:border-accent/40 transition-colors group"
          >
            <span>Full documentation</span>
            <span className="text-accent group-hover:translate-x-0.5 transition-transform">→</span>
          </Link>
        </div>
      </aside>
    </>
  );
}
