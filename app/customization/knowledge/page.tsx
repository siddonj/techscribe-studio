"use client";

import { useState } from "react";
import { Library, Plus, Trash2, FileText, Link as LinkIcon } from "lucide-react";
import { PageHeader, SectionCard, EmptyState, SurfaceNotice } from "@/components/DashboardPrimitives";

type SourceType = "text" | "url";

function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

interface KnowledgeEntry {
  id: string;
  title: string;
  type: SourceType;
  content: string;
  createdAt: string;
}

export default function KnowledgePage() {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [sourceType, setSourceType] = useState<SourceType>("text");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleAdd = () => {
    if (!title.trim() || !content.trim()) {
      setError("Please fill in both the title and content fields.");
      return;
    }
    if (sourceType === "url" && !isSafeUrl(content.trim())) {
      setError("Please enter a valid URL starting with http:// or https://.");
      return;
    }
    setError(null);
    const entry: KnowledgeEntry = {
      id: crypto.randomUUID(),
      title: title.trim(),
      type: sourceType,
      content: sourceType === "url" ? new URL(content.trim()).href : content.trim(),
      createdAt: new Date().toISOString(),
    };
    setEntries((prev) => [entry, ...prev]);
    setTitle("");
    setContent("");
    setShowForm(false);
  };

  const handleDelete = (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const inputClassName =
    "shell-input w-full rounded-2xl px-3.5 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none transition-colors";

  return (
    <div className="min-h-screen flex flex-col">
      <div className="p-5 md:p-8 max-w-5xl w-full mx-auto space-y-6">
        <PageHeader
          eyebrow="Customization"
          title="Knowledge Library"
          description="Store background context, brand guidelines, research snippets, and reference URLs. The AI uses these sources to ground generated content in your specific knowledge."
          backHref="/"
          backLabel="Back to dashboard"
          icon={<Library className="h-8 w-8 text-accent" />}
          stats={[
            { label: "Sources", value: entries.length },
            { label: "Text entries", value: entries.filter((e) => e.type === "text").length },
            { label: "URL sources", value: entries.filter((e) => e.type === "url").length },
          ]}
          actions={
            <button
              onClick={() => setShowForm((prev) => !prev)}
              className="inline-flex items-center gap-2 rounded-2xl bg-accent text-white px-5 py-3 text-sm font-semibold hover:bg-accent-dim transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add Source
            </button>
          }
        />

        {showForm && (
          <SectionCard className="space-y-5">
            <p className="font-mono text-xs text-slate-500 uppercase tracking-wider">Add Knowledge Source</p>

            <div>
              <label className="block text-xs font-mono text-slate-500 uppercase tracking-wider mb-2">
                Source Type
              </label>
              <div className="flex gap-2">
                {(["text", "url"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setSourceType(type)}
                    className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
                      sourceType === type
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-white/10 text-slate-400 hover:border-white/20 hover:text-white"
                    }`}
                  >
                    {type === "text" ? <FileText className="h-4 w-4" /> : <LinkIcon className="h-4 w-4" />}
                    {type === "text" ? "Text / Paste" : "URL"}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-500 uppercase tracking-wider mb-1.5">
                Title
              </label>
              <input
                type="text"
                className={inputClassName}
                value={title}
                placeholder={sourceType === "text" ? "e.g. Brand Voice Guidelines" : "e.g. Company About Page"}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-500 uppercase tracking-wider mb-1.5">
                {sourceType === "text" ? "Content" : "URL"}
              </label>
              {sourceType === "text" ? (
                <textarea
                  className={`${inputClassName} resize-none`}
                  value={content}
                  placeholder="Paste your text, guidelines, or background information here..."
                  rows={5}
                  onChange={(e) => setContent(e.target.value)}
                />
              ) : (
                <input
                  type="url"
                  className={inputClassName}
                  value={content}
                  placeholder="https://example.com/page"
                  onChange={(e) => setContent(e.target.value)}
                />
              )}
            </div>

            {error && <SurfaceNotice tone="error">{error}</SurfaceNotice>}

            <div className="flex gap-3">
              <button
                onClick={handleAdd}
                className="bg-accent text-white font-semibold px-5 py-3 rounded-2xl text-sm hover:bg-accent-dim transition-colors"
              >
                Add to Library
              </button>
              <button
                onClick={() => {
                  setShowForm(false);
                  setTitle("");
                  setContent("");
                  setError(null);
                }}
                className="border border-white/10 text-slate-300 font-semibold px-5 py-3 rounded-2xl text-sm hover:text-white hover:border-white/20 transition-colors"
              >
                Cancel
              </button>
            </div>
          </SectionCard>
        )}

        {entries.length === 0 ? (
          <EmptyState
            icon={<Library />}
            eyebrow="No sources yet"
            description="Add text snippets, brand guidelines, or URLs to build a knowledge base that grounds your AI-generated content."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {entries.map((entry) => (
              <SectionCard key={entry.id} className="flex flex-col gap-3 relative group">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
                      {entry.type === "text" ? (
                        <FileText className="h-4 w-4 text-accent" />
                      ) : (
                        <LinkIcon className="h-4 w-4 text-accent" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-white font-medium text-sm truncate">{entry.title}</p>
                      <p className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">
                        {entry.type === "text" ? "Text" : "URL"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(entry.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-400/10 shrink-0"
                    aria-label="Delete entry"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-slate-400 text-sm leading-relaxed line-clamp-3">
                  {entry.type === "url" ? (
                    isSafeUrl(entry.content) ? (
                      <a
                        href={entry.content}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent hover:text-accent-dim transition-colors truncate block"
                      >
                        {entry.content}
                      </a>
                    ) : (
                      <span className="truncate block">{entry.content}</span>
                    )
                  ) : (
                    entry.content
                  )}
                </p>
                <p className="text-xs text-slate-500 font-mono mt-auto pt-2 border-t border-white/5">
                  Added {new Date(entry.createdAt).toLocaleDateString()}
                </p>
              </SectionCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
