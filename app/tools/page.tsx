"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Search,
  FileText,
  Lightbulb,
  TrendingUp,
  Pencil,
  Share2,
  Mail,
  Video,
  ArrowRight,
} from "lucide-react";
import { TOOLS, CATEGORIES } from "@/lib/tools";

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  "Content Creation": FileText,
  "Ideas & Planning": Lightbulb,
  "SEO & Keywords": TrendingUp,
  "Editing & Rewriting": Pencil,
  "Social Media": Share2,
  "Email & Marketing": Mail,
  "Video Content": Video,
};

const CATEGORY_COLORS: Record<string, string> = {
  "Content Creation": "text-teal-400 bg-teal-400/10",
  "Ideas & Planning": "text-amber-400 bg-amber-400/10",
  "SEO & Keywords": "text-sky-400 bg-sky-400/10",
  "Editing & Rewriting": "text-violet-400 bg-violet-400/10",
  "Social Media": "text-pink-400 bg-pink-400/10",
  "Email & Marketing": "text-orange-400 bg-orange-400/10",
  "Video Content": "text-red-400 bg-red-400/10",
};

export default function ToolsPage() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("All");

  const filtered = useMemo(() => {
    return TOOLS.filter((tool) => {
      const matchesCategory =
        activeCategory === "All" || tool.category === activeCategory;
      const query = search.toLowerCase();
      const matchesSearch =
        !query ||
        tool.name.toLowerCase().includes(query) ||
        tool.description.toLowerCase().includes(query) ||
        tool.category.toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [search, activeCategory]);

  const groupedByCategory = useMemo(() => {
    if (activeCategory !== "All") return null;
    return CATEGORIES.reduce<Record<string, typeof TOOLS>>(
      (acc, cat) => {
        const tools = filtered.filter((t) => t.category === cat);
        if (tools.length > 0) acc[cat] = tools;
        return acc;
      },
      {}
    );
  }, [filtered, activeCategory]);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-8 py-8">
        <div className="max-w-5xl mx-auto">
          <p className="text-[11px] font-mono tracking-[0.24em] uppercase text-accent mb-1">
            Workspace
          </p>
          <h1
            className="text-3xl font-semibold text-slate-900 mb-1"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Tool Library
          </h1>
          <p className="text-slate-500 text-sm">
            {TOOLS.length} AI writing tools across {CATEGORIES.length} categories
          </p>

          {/* Search */}
          <div className="mt-6 relative max-w-lg">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search tools…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
            />
          </div>

          {/* Category filters */}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => setActiveCategory("All")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all border ${
                activeCategory === "All"
                  ? "bg-accent text-white border-accent/30 shadow-sm"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:text-slate-900"
              }`}
            >
              All tools
            </button>
            {CATEGORIES.map((cat) => {
              const Icon = CATEGORY_ICONS[cat];
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all border ${
                    activeCategory === cat
                      ? "bg-accent text-white border-accent/30 shadow-sm"
                      : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:text-slate-900"
                  }`}
                >
                  {Icon && <Icon className="h-3 w-3" />}
                  {cat}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tool grid */}
      <div className="px-8 py-8 max-w-5xl mx-auto">
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-slate-400 text-sm">No tools match &ldquo;{search}&rdquo;</p>
            <button
              onClick={() => { setSearch(""); setActiveCategory("All"); }}
              className="mt-3 text-accent text-sm hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : activeCategory !== "All" ? (
          <ToolGrid tools={filtered} />
        ) : (
          <div className="space-y-10">
            {groupedByCategory &&
              Object.entries(groupedByCategory).map(([cat, tools]) => {
                const Icon = CATEGORY_ICONS[cat];
                const colorClass = CATEGORY_COLORS[cat] ?? "text-slate-400 bg-slate-400/10";
                return (
                  <section key={cat}>
                    <div className="flex items-center gap-2.5 mb-4">
                      {Icon && (
                        <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${colorClass}`}>
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                      )}
                      <h2 className="text-sm font-semibold text-slate-700">{cat}</h2>
                      <span className="text-xs text-slate-400 ml-1">{tools.length}</span>
                    </div>
                    <ToolGrid tools={tools} />
                  </section>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}

function ToolGrid({ tools }: { tools: typeof TOOLS }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {tools.map((tool) => {
        const colorClass = CATEGORY_COLORS[tool.category] ?? "text-slate-400 bg-slate-400/10";
        const Icon = CATEGORY_ICONS[tool.category];
        return (
          <Link
            key={tool.slug}
            href={`/tool/${tool.slug}`}
            className="group flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 hover:border-accent/40 hover:shadow-md transition-all"
          >
            <div className="flex items-start justify-between gap-2">
              <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${colorClass}`}>
                {Icon && <Icon className="h-4 w-4" />}
              </div>
              <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-accent group-hover:translate-x-0.5 transition-all mt-0.5 shrink-0" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800 mb-0.5">{tool.name}</p>
              <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{tool.description}</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
