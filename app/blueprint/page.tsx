"use client";

import Link from "next/link";
import {
  ArrowRight,
  FileText,
  Layers,
  Megaphone,
  Share2,
  Video,
  Zap,
} from "lucide-react";

interface BlueprintStep {
  toolSlug: string;
  label: string;
  description: string;
}

interface Blueprint {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  accent: string;
  time: string;
  steps: BlueprintStep[];
}

const BLUEPRINTS: Blueprint[] = [
  {
    id: "blog-from-keyword",
    title: "Blog Post from Keyword",
    description: "Start with raw keyword research and produce a fully-optimised article, meta tags, and social posts — all in sequence.",
    icon: <FileText className="w-5 h-5" />,
    color: "from-teal-500/10 to-sky-500/10 border-teal-500/20",
    accent: "text-teal-600",
    time: "~25 min",
    steps: [
      { toolSlug: "keyword-research-brief", label: "Keyword Research Brief", description: "Turn raw keyword data into an actionable content brief." },
      { toolSlug: "keyword-cluster", label: "Keyword Cluster", description: "Group related keywords by intent." },
      { toolSlug: "headline-generator", label: "Headline Generator", description: "Write 10 title options and pick the best." },
      { toolSlug: "outline-generator", label: "Outline Generator", description: "Build the H2/H3 structure." },
      { toolSlug: "article-writer", label: "Article Writer", description: "Generate the full SEO-optimised post." },
      { toolSlug: "faq-writer", label: "FAQ Writer", description: "Add an FAQ section for featured snippets." },
      { toolSlug: "meta-title", label: "Meta Title", description: "Write a click-worthy title under 60 chars." },
      { toolSlug: "meta-description", label: "Meta Description", description: "Write the 150-char search snippet." },
    ],
  },
  {
    id: "video-repurpose",
    title: "Video → Full Content Pack",
    description: "Take a YouTube video or podcast transcript and repurpose it into a blog post, social captions, and an email newsletter.",
    icon: <Video className="w-5 h-5" />,
    color: "from-purple-500/10 to-pink-500/10 border-purple-500/20",
    accent: "text-purple-600",
    time: "~15 min",
    steps: [
      { toolSlug: "youtube-to-blog", label: "YouTube → Blog Post", description: "Convert the transcript into a full article." },
      { toolSlug: "key-takeaways", label: "Key Takeaways", description: "Extract the 5 most shareable insights." },
      { toolSlug: "tweet-ideas", label: "Tweet / X Thread", description: "Turn the post into a tweet thread." },
      { toolSlug: "linkedin-post", label: "LinkedIn Post", description: "Write a professional post for LinkedIn." },
      { toolSlug: "instagram-caption", label: "Instagram Caption", description: "Short caption + hashtag pack." },
      { toolSlug: "newsletter-writer", label: "Newsletter Issue", description: "Package the content as an email newsletter." },
    ],
  },
  {
    id: "seo-full-stack",
    title: "SEO Content Sprint",
    description: "Close content gaps, build keyword clusters, write the article, and generate all the technical SEO metadata in one go.",
    icon: <Layers className="w-5 h-5" />,
    color: "from-amber-500/10 to-orange-500/10 border-amber-500/20",
    accent: "text-amber-600",
    time: "~30 min",
    steps: [
      { toolSlug: "content-gap", label: "Content Gap Analyzer", description: "Find the topics competitors cover that you don't." },
      { toolSlug: "keyword-cluster", label: "Keyword Cluster", description: "Group target keywords by search intent." },
      { toolSlug: "outline-generator", label: "Outline Generator", description: "Structure the article to cover every angle." },
      { toolSlug: "article-writer", label: "Article Writer", description: "Generate the full long-form post." },
      { toolSlug: "schema-markup", label: "Schema Markup", description: "Add JSON-LD for rich results." },
      { toolSlug: "og-meta-tags", label: "OG & Twitter Tags", description: "Control how the post looks on social." },
      { toolSlug: "permalink-generator", label: "URL / Permalink", description: "Generate a clean, keyword-rich slug." },
    ],
  },
  {
    id: "social-campaign",
    title: "Social Media Campaign",
    description: "Write an article then fan it out across every social channel — Twitter, LinkedIn, Instagram, TikTok — plus an email blast.",
    icon: <Share2 className="w-5 h-5" />,
    color: "from-sky-500/10 to-indigo-500/10 border-sky-500/20",
    accent: "text-sky-600",
    time: "~20 min",
    steps: [
      { toolSlug: "article-writer", label: "Article Writer", description: "Create the source article to repurpose." },
      { toolSlug: "key-takeaways", label: "Key Takeaways", description: "Distil the core insights." },
      { toolSlug: "tweet-ideas", label: "Tweet / X Thread", description: "High-engagement thread or standalone posts." },
      { toolSlug: "linkedin-post", label: "LinkedIn Post", description: "Professional long-form post." },
      { toolSlug: "instagram-caption", label: "Instagram Caption", description: "Visual-first caption + hashtags." },
      { toolSlug: "tiktok-caption", label: "TikTok Ideas & Caption", description: "Short-form video concepts from the post." },
      { toolSlug: "email-subject-line", label: "Email Subject Line", description: "High-open-rate subject line options." },
      { toolSlug: "newsletter-writer", label: "Newsletter Issue", description: "Full email newsletter body." },
    ],
  },
  {
    id: "launch-campaign",
    title: "Product / Content Launch",
    description: "Announce something new with a press release, email campaign, and a full social push — all co-ordinated in one workflow.",
    icon: <Megaphone className="w-5 h-5" />,
    color: "from-rose-500/10 to-red-500/10 border-rose-500/20",
    accent: "text-rose-600",
    time: "~20 min",
    steps: [
      { toolSlug: "press-release", label: "Press Release", description: "Write a newswire-ready announcement." },
      { toolSlug: "aida-copy", label: "AIDA Copy", description: "Persuasive copy for the landing page or email." },
      { toolSlug: "email-subject-line", label: "Email Subject Lines", description: "10 options to A/B test the launch email." },
      { toolSlug: "cta-writer", label: "CTA Writer", description: "Write the button text and surrounding copy." },
      { toolSlug: "tweet-ideas", label: "Launch Tweets", description: "Thread to announce on X / Twitter." },
      { toolSlug: "linkedin-post", label: "LinkedIn Announcement", description: "Professional launch post." },
    ],
  },
  {
    id: "quick-wins",
    title: "Quick Wins Sprint",
    description: "Three fast standalone tasks: fix a draft, generate social captions, and optimise meta tags. Each takes under 2 minutes.",
    icon: <Zap className="w-5 h-5" />,
    color: "from-green-500/10 to-emerald-500/10 border-green-500/20",
    accent: "text-green-600",
    time: "~5 min",
    steps: [
      { toolSlug: "grammar-fixer", label: "Grammar & Style Fixer", description: "Proofread a draft before publishing." },
      { toolSlug: "content-shortener", label: "Content Shortener", description: "Tighten a section that's running long." },
      { toolSlug: "paraphrase", label: "Paraphrase Tool", description: "Reword a section that feels repetitive." },
      { toolSlug: "meta-title", label: "Meta Title", description: "Quick SEO title refresh." },
      { toolSlug: "meta-description", label: "Meta Description", description: "Write or update the search snippet." },
    ],
  },
];

export default function BlueprintPage() {
  return (
    <div className="min-h-screen">
      <div className="p-5 md:p-8 max-w-6xl w-full mx-auto space-y-8">

        {/* Hero */}
        <div className="shell-panel rounded-[2rem] p-8 relative overflow-hidden">
          <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-accent/10 blur-3xl" />
          <div className="relative">
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-accent mb-3">Guided Workflows</p>
            <h1 className="text-3xl md:text-4xl text-slate-900 mb-3" style={{ fontFamily: "var(--font-display)" }}>
              Content Blueprints
            </h1>
            <p className="text-slate-500 max-w-xl leading-relaxed">
              End-to-end workflows that chain the right tools in the right order. Pick a blueprint, follow the steps, and ship complete content — no guesswork.
            </p>
          </div>
        </div>

        {/* Blueprint cards */}
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {BLUEPRINTS.map((bp) => (
            <BlueprintCard key={bp.id} blueprint={bp} />
          ))}
        </div>
      </div>
    </div>
  );
}

function BlueprintCard({ blueprint: bp }: { blueprint: Blueprint }) {
  const firstTool = bp.steps[0];

  return (
    <div className={`shell-panel rounded-[2rem] p-6 flex flex-col gap-5 bg-gradient-to-br ${bp.color} border`}>
      <div>
        <div className={`inline-flex items-center gap-2 mb-3 ${bp.accent}`}>
          {bp.icon}
          <span className="font-mono text-[11px] uppercase tracking-[0.18em]">{bp.time}</span>
        </div>
        <h2 className="text-lg font-semibold text-slate-900 mb-2" style={{ fontFamily: "var(--font-display)" }}>
          {bp.title}
        </h2>
        <p className="text-sm text-slate-500 leading-relaxed">{bp.description}</p>
      </div>

      {/* Step list */}
      <ol className="flex flex-col gap-1.5">
        {bp.steps.map((step, i) => (
          <li key={step.toolSlug} className="flex items-center gap-2.5">
            <span className={`shrink-0 w-5 h-5 rounded-full border text-[10px] font-mono font-semibold flex items-center justify-center ${bp.accent} border-current opacity-60`}>
              {i + 1}
            </span>
            <Link
              href={`/tool/${step.toolSlug}`}
              className="text-sm text-slate-600 hover:text-slate-900 hover:underline underline-offset-2 transition-colors truncate"
              title={step.description}
            >
              {step.label}
            </Link>
          </li>
        ))}
      </ol>

      {/* CTA */}
      <Link
        href={`/tool/${firstTool.toolSlug}`}
        className={`mt-auto flex items-center justify-between gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors hover:opacity-80 ${bp.accent} border-current bg-white/60`}
      >
        <span>Start with {firstTool.label}</span>
        <ArrowRight className="w-4 h-4 shrink-0" />
      </Link>
    </div>
  );
}
