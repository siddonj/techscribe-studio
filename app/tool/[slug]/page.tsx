"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getToolBySlug, Tool, ToolField } from "@/lib/tools";
import { getHandoffActions } from "@/lib/handoff-registry";
import { parseToolOutput, ParsedToolOutput } from "@/lib/output-parsers";
import HandoffCard from "@/components/HandoffCard";
import AddKnowledgeModal, { ResearchItem } from "@/components/AddKnowledgeModal";
import { EmptyState, PageHeader, StatusStrip } from "@/components/DashboardPrimitives";
import type { PublishState, PublishFailureCategory } from "@/lib/publish-state";
import {
  normalizePublishState,
  classifyPublishFailure,
  getPublishFailureHint,
  PUBLISH_FAILURE_CATEGORY_LABELS,
} from "@/lib/publish-state";

interface BlogIdeaSuggestion {
  title: string;
  description: string;
  keywords: string[];
}

// Simple markdown renderer (no external deps)
function renderMarkdown(text: string): string {
  return text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/```[\w]*\n([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/^---$/gm, '<hr/>')
    .replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
    .replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>')
    .replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>')
    .replace(/<\/ul>\s*<ul>/g, '')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hupol]|<\/[hupol]|<li|<hr)(.+)$/gm, (m) =>
      m.startsWith('<') ? m : `<p>${m}</p>`)
    .replace(/<p><\/p>/g, '');
}

function normalizeSuggestionText(value: string): string {
  return value
    .replace(/^[-*]\s*/, "")
    .replace(/^\d+\.\s*/, "")
    .replace(/^\*\*(.*?)\*\*$/, "$1")
    .trim();
}

function parseBlogIdeaSuggestions(text: string): BlogIdeaSuggestion[] {
  const normalized = text.replace(/\r\n/g, "\n");
  const headingSections = normalized
    .split(/\n(?=##+\s+)/)
    .map((section) => section.trim())
    .filter(Boolean);

  const fromHeadingSections = headingSections
    .map((section) => {
      const lines = section.split("\n").map((line) => line.trim()).filter(Boolean);
      const [heading, ...rest] = lines;
      if (!heading || !/^##+\s+/i.test(heading)) {
        return null;
      }

      const title = normalizeSuggestionText(
        heading.replace(/^##+\s*/i, "").replace(/^Idea\s+\d+\s*:\s*/i, "")
      );
      const body = rest.join("\n");
      const descriptionMatch = body.match(/(?:^|\n)(?:Description|Summary)\s*:\s*([\s\S]+?)(?=\n(?:Keywords?|Description|Summary)\s*:|$)/i);
      const keywordsMatch = body.match(/(?:^|\n)Keywords?\s*:\s*(.+)$/im);
      const description = normalizeSuggestionText(
        descriptionMatch?.[1] ?? rest.find((line) => !/^Keywords?\s*:/i.test(line)) ?? ""
      );
      const keywords = (keywordsMatch?.[1] ?? "")
        .split(",")
        .map((keyword) => normalizeSuggestionText(keyword))
        .filter(Boolean);

      if (!title || (!description && keywords.length === 0)) {
        return null;
      }

      return { title, description, keywords };
    })
    .filter((value): value is BlogIdeaSuggestion => value !== null);

  if (fromHeadingSections.length > 0) {
    return fromHeadingSections;
  }

  const numberedIdeaMatches = Array.from(
    normalized.matchAll(/(?:^|\n)\d+\.\s+\*\*(.+?)\*\*([\s\S]*?)(?=\n\d+\.\s+\*\*|$)/g)
  );

  return numberedIdeaMatches
    .map((match) => {
      const title = normalizeSuggestionText(match[1] ?? "");
      const body = (match[2] ?? "").trim();
      const bodyLines = body.split("\n").map((line) => line.trim()).filter(Boolean);
      const description = normalizeSuggestionText(
        bodyLines.find((line) => !/^Keywords?\s*:/i.test(line)) ?? ""
      );
      const keywordsLine = bodyLines.find((line) => /^Keywords?\s*:/i.test(line)) ?? "";
      const keywords = keywordsLine
        .replace(/^Keywords?\s*:/i, "")
        .split(",")
        .map((keyword) => normalizeSuggestionText(keyword))
        .filter(Boolean);

      if (!title || (!description && keywords.length === 0)) {
        return null;
      }

      return { title, description, keywords };
    })
    .filter((value): value is BlogIdeaSuggestion => value !== null);
}

function buildArticleWriterHrefFromIdea(idea: BlogIdeaSuggestion): string {
  const params = new URLSearchParams();
  params.set("topic", idea.title);

  if (idea.description) {
    params.set("context", idea.description);
  }

  if (idea.keywords.length > 0) {
    params.set("keywords", idea.keywords.join(", "));
  }

  return `/tool/article-writer?${params.toString()}`;
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: ToolField;
  value: string;
  onChange: (v: string) => void;
}) {
  const base =
    "shell-input w-full rounded-2xl px-3.5 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none transition-colors";

  if (field.type === "textarea") {
    return (
      <textarea
        className={`${base} resize-none`}
        rows={field.rows ?? 4}
        placeholder={field.placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (field.type === "select" && field.options) {
    return (
      <select
        className={`${base} cursor-pointer`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {field.options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      type="text"
      className={base}
      placeholder={field.placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export default function ToolPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params?.slug as string;
  const tool: Tool | undefined = getToolBySlug(slug);
  const calendarIdParam = searchParams.get("calendarId");
  const calendarId = calendarIdParam ? Number.parseInt(calendarIdParam, 10) : null;
  const handoffActions = getHandoffActions(slug);

  const [fields, setFields] = useState<Record<string, string>>({});
  const [output, setOutput] = useState("");
  const [parsedOutput, setParsedOutput] = useState<ParsedToolOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [historyId, setHistoryId] = useState<number | null>(null);
  const [draftPostId, setDraftPostId] = useState<number | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishedDraftUrl, setPublishedDraftUrl] = useState<string | null>(null);
  const [publishState, setPublishState] = useState<PublishState | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishErrorCategory, setPublishErrorCategory] = useState<PublishFailureCategory | null>(null);
  const [publishAllowed, setPublishAllowed] = useState(false);
  const [publishStatusLoaded, setPublishStatusLoaded] = useState(false);
  const [error, setError] = useState("");
  const outputRef = useRef<HTMLDivElement>(null);

  // Outline flow state (only used for tools with outlineSystemPrompt)
  type ArticleStep = "input" | "outline-streaming" | "outline-editing" | "article-streaming" | "article-done";
  const [articleStep, setArticleStep] = useState<ArticleStep>("input");
  const [editableOutline, setEditableOutline] = useState("");
  const isOutlineMode = !!tool?.outlineSystemPrompt;
  const workflowStageLabel = isOutlineMode
    ? articleStep === "outline-streaming"
      ? "Generating outline"
      : articleStep === "outline-editing"
        ? "Editing outline"
        : articleStep === "article-streaming"
          ? "Writing article"
          : articleStep === "article-done"
            ? "Article ready"
            : "Ready"
    : loading
      ? "Generating"
      : output
        ? "Output ready"
        : "Ready";
  const saveStateLabel = historyId ? `Saved #${historyId}` : saved ? "Saved" : "Not saved";
  const publishStateLabel = draftPostId
    ? publishedDraftUrl
      ? "Draft linked"
      : "Draft created"
    : publishAllowed
      ? "Publish enabled"
      : publishStatusLoaded
        ? "Publish locked"
        : "Checking publish";
  const isBlogPostIdeas = tool?.slug === "blog-post-ideas";
  const blogIdeaSuggestions = isBlogPostIdeas
    ? parseBlogIdeaSuggestions(output)
    : [];

  // Research / knowledge sources state
  const [researchItems, setResearchItems] = useState<ResearchItem[]>([]);
  const [showKnowledgeModal, setShowKnowledgeModal] = useState(false);

  // Output tab state (ARTICLE = rendered, EDITOR = editable textarea)
  type OutputTab = "article" | "editor";
  const [outputTab, setOutputTab] = useState<OutputTab>("article");

  const editorTextareaClassName = "w-full h-full min-h-[400px] bg-transparent text-slate-900 text-sm font-mono leading-relaxed resize-none focus:outline-none placeholder:text-slate-400";

  // Initialize field defaults
  useEffect(() => {
    if (!tool) return;
    const defaults: Record<string, string> = {};
    tool.fields.forEach((f) => {
      const queryValue = searchParams.get(f.name)?.trim();
      if (f.type === "select" && f.options) {
        defaults[f.name] = queryValue && f.options.includes(queryValue) ? queryValue : f.options[0];
        return;
      }

      defaults[f.name] = queryValue ?? "";
    });
    setFields(defaults);
    setOutput("");
    setParsedOutput(null);
    setError("");
    setSaved(false);
    setHistoryId(null);
    setDraftPostId(null);
    setPublishedDraftUrl(null);
    setPublishState(null);
    setPublishError(null);
    setPublishErrorCategory(null);
    setArticleStep("input");
    setEditableOutline("");
    setResearchItems([]);
  }, [searchParams, slug, tool]);

  // Auto-scroll output
  useEffect(() => {
    if (outputRef.current && loading) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output, loading]);

  useEffect(() => {
    const loadPublishStatus = async () => {
      try {
        const res = await fetch("/api/settings/wordpress");
        const data = await res.json() as { has_successful_test?: boolean };
        setPublishAllowed(Boolean(data.has_successful_test));
      } catch {
        setPublishAllowed(false);
      } finally {
        setPublishStatusLoaded(true);
      }
    };

    void loadPublishStatus();
  }, []);

  if (!tool) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-4xl mb-4">🔍</div>
          <div className="text-white text-lg mb-2">Tool not found</div>
          <Link href="/" className="text-accent text-sm hover:underline">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const handleGenerate = async () => {
    // Check required fields
    const missing = tool.fields
      .filter((f) => f.required && !fields[f.name]?.trim())
      .map((f) => f.label);

    if (missing.length) {
      setError(`Please fill in: ${missing.join(", ")}`);
      return;
    }

    setLoading(true);
    setOutput("");
    setParsedOutput(null);
    setError("");
    setSaved(false);
    setHistoryId(null);
    setDraftPostId(null);
    setPublishedDraftUrl(null);
    setPublishState(null);
    setPublishError(null);
    setPublishErrorCategory(null);

    const mode = isOutlineMode ? "outline" : undefined;
    if (isOutlineMode) setArticleStep("outline-streaming");

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: tool.slug, fields, mode, research: researchItems }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Generation failed");
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error("No stream reader");

      let accumulated = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;
        setOutput((prev) => prev + chunk);
      }

      if (isOutlineMode) {
        setEditableOutline(accumulated);
        setArticleStep("outline-editing");
      } else {
        setParsedOutput(parseToolOutput(tool.slug, accumulated));
      }
    } catch (err) {
      setError(String(err));
      if (isOutlineMode) setArticleStep("input");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateArticle = async () => {
    setLoading(true);
    setOutput("");
    setError("");
    setSaved(false);
    setHistoryId(null);
    setDraftPostId(null);
    setPublishedDraftUrl(null);
    setPublishState(null);
    setPublishError(null);
    setPublishErrorCategory(null);
    setArticleStep("article-streaming");

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: tool.slug, fields, mode: "article", outline: editableOutline, research: researchItems }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Generation failed");
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error("No stream reader");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setOutput((prev) => prev + chunk);
      }

      setArticleStep("article-done");
    } catch (err) {
      setError(String(err));
      setArticleStep("outline-editing");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async (): Promise<number | null> => {
    if (!tool || !output) return null;
    try {
      const res = await fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: tool.slug,
          fields,
          output,
          calendarId: Number.isFinite(calendarId) ? calendarId : null,
        }),
      });
      if (res.ok) {
        const entry = await res.json();
        setSaved(true);
        setHistoryId(entry.id);
        setTimeout(() => setSaved(false), 3000);
        return entry.id as number;
      }
    } catch {
      // silently ignore
    }

    return null;
  };

  const handlePublishDraft = async () => {
    if (!output) return;

    setPublishing(true);
    setError("");
    setPublishError(null);
    setPublishErrorCategory(null);

    try {
      let currentHistoryId = historyId;
      if (!currentHistoryId) {
        currentHistoryId = await handleSave();
      }

      const publishRes = await fetch("/api/wordpress/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: output,
          title: fields.topic || tool?.name,
          historyId: currentHistoryId,
          calendarId: Number.isFinite(calendarId) ? calendarId : null,
        }),
      });

      const publishData = await publishRes.json();
      if (!publishRes.ok) {
        const errMsg = publishData.error || "WordPress publish failed";
        const category = classifyPublishFailure(errMsg, publishRes.status);
        setPublishError(errMsg);
        setPublishErrorCategory(category);
        if (currentHistoryId) {
          setHistoryId(currentHistoryId);
        }
        // Return rather than throw to avoid the generic error path in catch.
        return;
      }

      setPublishError(null);
      setPublishErrorCategory(null);
      setDraftPostId(publishData.postId ?? null);
      setPublishedDraftUrl(publishData.url ?? null);
      // normalizePublishState returns null for missing/unrecognised values, which
      // correctly keeps the UI in an "unset" state until the next publish action.
      setPublishState(normalizePublishState(publishData.publishState));
      if (currentHistoryId) {
        setHistoryId(currentHistoryId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "WordPress publish failed");
    } finally {
      setPublishing(false);
    }
  };

  const handleClear = () => {
    setOutput("");
    setParsedOutput(null);
    setError("");
    setSaved(false);
    setHistoryId(null);
    setDraftPostId(null);
    setPublishedDraftUrl(null);
    setPublishState(null);
    setPublishError(null);
    setPublishErrorCategory(null);
    setArticleStep("input");
    setEditableOutline("");
    setOutputTab("article");
    setResearchItems([]);
  };

  const handleReset = () => {
    handleClear();
    if (!tool) return;
    const defaults: Record<string, string> = {};
    tool.fields.forEach((f) => {
      defaults[f.name] = f.type === "select" && f.options ? f.options[0] : "";
    });
    setFields(defaults);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="p-5 md:p-8 max-w-[1600px] mx-auto w-full flex-1 flex flex-col gap-6">
        <PageHeader
          eyebrow="Writing Workflow"
          title={tool.name}
          description={tool.description}
          icon={tool.icon}
          stats={[
            { label: "Category", value: tool.category },
            { label: "Workflow", value: isOutlineMode ? "Outline" : "Direct" },
            { label: "Calendar", value: Number.isFinite(calendarId) ? "Linked" : "Standalone" },
            { label: "Publish", value: publishAllowed ? "Enabled" : "Restricted" },
          ]}
        />

        <StatusStrip
          items={[
            { label: "Stage", value: workflowStageLabel },
            { label: "Archive", value: saveStateLabel },
            { label: "Draft Publish", value: publishStateLabel },
            { label: "Output", value: output ? `${output.trim().split(/\s+/).filter(Boolean).length} words` : "Waiting for generation" },
          ]}
        />

        <div className="flex flex-1 overflow-hidden gap-6 min-h-0">
          <aside className="w-96 shell-panel rounded-[2rem] p-6 flex flex-col gap-4 overflow-y-auto shrink-0">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent mb-2">Input Studio</p>
              <p className="text-slate-400 text-sm mb-6">Shape the brief, tone, and constraints before you generate.</p>
              {Number.isFinite(calendarId) && (
                <div className="shell-panel-soft rounded-2xl px-4 py-3 text-sm mb-4">
                  <p className="text-slate-500 text-xs font-mono uppercase tracking-wider mb-1">Calendar Linked</p>
                <p className="text-white/90">Saving this draft will link the result back to the planned calendar item.</p>
              </div>
              )}
            </div>

          {/* Outline-editing phase: show summary + outline actions */}
          {isOutlineMode && articleStep === "outline-editing" ? (
            <>
              <div className="shell-panel-soft rounded-2xl px-4 py-3 text-sm">
                <p className="text-slate-500 text-xs font-mono uppercase tracking-wider mb-1">Topic</p>
                <p className="text-white">{fields.topic || "—"}</p>
              </div>
              <p className="text-slate-500 text-xs leading-relaxed">
                Review and edit the outline on the right, then click{" "}
                <span className="text-accent">Generate Article</span> to write the full post.
              </p>
              {error && (
                <div className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}
              <button
                onClick={handleGenerateArticle}
                disabled={loading}
                className="w-full bg-accent text-white font-semibold py-3 rounded-2xl text-sm hover:bg-accent-dim transition-colors disabled:opacity-50 disabled:cursor-not-allowed pulse-glow mt-2"
              >
                {loading ? "Generating Article…" : "Generate Article ✦"}
              </button>
              <button
                onClick={() => {
                  setArticleStep("input");
                  setOutput("");
                  setEditableOutline("");
                  setSaved(false);
                  setHistoryId(null);
                  setPublishedDraftUrl(null);
                  setPublishState(null);
                  setPublishError(null);
                  setPublishErrorCategory(null);
                }}
                className="w-full text-slate-400 text-xs border border-white/10 py-2.5 rounded-2xl hover:text-white hover:border-white/20 transition-colors"
              >
                ← Edit Inputs
              </button>
            </>
          ) : (
            <>
              {tool.fields.map((field) => (
                <div key={field.name}>
                  <label className="block text-xs font-mono text-slate-500 uppercase tracking-wider mb-1.5">
                    {field.label}
                    {field.required && <span className="text-accent ml-1">*</span>}
                  </label>
                  <FieldInput
                    field={field}
                    value={fields[field.name] ?? ""}
                    onChange={(v) =>
                      setFields((prev) => ({ ...prev, [field.name]: v }))
                    }
                  />
                </div>
              ))}

              {/* Research / Knowledge Sources — shown for tools with supportsResearch */}
              {tool.supportsResearch && (
                <div>
                  {researchItems.length > 0 && (
                    <ul className="flex flex-col gap-1.5 mb-2">
                      {researchItems.map((item) => (
                        <li
                          key={item.id}
                          className="flex items-start gap-2 bg-subtle border border-border rounded-lg px-3 py-2 text-xs"
                        >
                          <span className="mt-0.5 shrink-0 font-mono text-accent">
                            {item.type === "url" ? "🔗" : item.type === "file" ? "📄" : "📝"}
                          </span>
                          <span className="flex-1 text-white/80 break-all line-clamp-2" title={item.label}>{item.label}</span>
                          <button
                            onClick={() =>
                              setResearchItems((prev) => prev.filter((r) => r.id !== item.id))
                            }
                            className="shrink-0 text-muted hover:text-red-400 transition-colors leading-none"
                            aria-label="Remove research item"
                          >
                            ✕
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <button
                    onClick={() => setShowKnowledgeModal(true)}
                    className="flex items-center gap-1.5 text-sm text-muted border border-border rounded-full px-4 py-1.5 hover:text-white hover:border-white/30 transition-colors"
                  >
                    <span className="text-base leading-none">+</span> Add Knowledge
                  </button>
                </div>
              )}

              {error && (
                <div className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={loading}
                className="w-full bg-accent text-white font-semibold py-3 rounded-2xl text-sm hover:bg-accent-dim transition-colors disabled:opacity-50 disabled:cursor-not-allowed pulse-glow mt-2"
              >
                {loading
                  ? isOutlineMode ? "Generating Outline…" : "Generating…"
                  : isOutlineMode ? "Generate Outline ✦" : "Generate with Claude ✦"}
              </button>

              {output && (
                <button
                  onClick={handleClear}
                  className="w-full text-slate-400 text-xs border border-white/10 py-2.5 rounded-2xl hover:text-white hover:border-white/20 transition-colors"
                >
                  Clear output
                </button>
              )}
            </>
          )}
          </aside>

          <section className="flex-1 shell-panel rounded-[2rem] overflow-hidden flex flex-col min-w-0">
          {/* Output toolbar */}
          {output && articleStep !== "outline-editing" && (
            <div className="px-6 py-4 border-b border-white/5">
              <div className="flex items-center justify-between gap-4">
                {(articleStep === "article-done" || (!isOutlineMode && !loading)) ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setOutputTab("article")}
                      className={`font-mono text-xs px-3 py-1.5 rounded-md border transition-colors ${
                        outputTab === "article"
                          ? "border-accent text-accent bg-accent/10"
                          : "border-border text-muted hover:text-white hover:border-white/20"
                      }`}
                    >
                      Article
                    </button>
                    <button
                      onClick={() => setOutputTab("editor")}
                      className={`font-mono text-xs px-3 py-1.5 rounded-md border transition-colors ${
                        outputTab === "editor"
                          ? "border-accent text-accent bg-accent/10"
                          : "border-border text-muted hover:text-white hover:border-white/20"
                      }`}
                    >
                      Editor
                    </button>
                  </div>
                ) : (
                  <span className="font-mono text-xs text-slate-500">OUTPUT</span>
                )}
                <div className="flex items-center gap-2">
                  {blogIdeaSuggestions.length > 0 && (
                    <span className="font-mono text-xs text-accent">
                      {blogIdeaSuggestions.length} ideas ready for handoff
                    </span>
                  )}
                  <span className="font-mono text-xs text-slate-500">
                    {output.split(" ").length} words
                  </span>
                  {publishedDraftUrl && (
                    <a
                      href={publishedDraftUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={`flex items-center gap-1.5 font-mono text-xs px-3 py-1.5 rounded-md border transition-colors ${
                        publishState === "published"
                          ? "border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-300 hover:text-fuchsia-200 hover:border-fuchsia-400/50"
                          : "border-emerald-400/30 bg-emerald-400/10 text-emerald-300 hover:text-emerald-200 hover:border-emerald-400/50"
                      }`}
                    >
                      {publishState === "published" ? "View Live" : "View Draft"}
                    </a>
                  )}
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 btn-secondary"
                  >
                    {copied ? "✓ Copied!" : "Copy"}
                  </button>
                  {!loading && (
                    <button
                      onClick={handlePublishDraft}
                      disabled={publishing || !publishAllowed || !publishStatusLoaded}
                      className={`flex items-center gap-1.5 font-mono text-xs px-3 py-1.5 rounded-md border transition-colors disabled:opacity-50 ${
                        publishError
                          ? "border-red-400/30 bg-red-400/10 text-red-300 hover:text-red-200 hover:border-red-400/50"
                          : "border-accent/60 text-accent hover:bg-accent/10"
                      }`}
                    >
                      {publishing
                        ? (draftPostId ? "Updating..." : "Publishing...")
                        : publishError
                          ? "Retry Publish"
                          : draftPostId
                            ? (publishState === "published" ? "Re-publish Live" : "Update Draft")
                            : "Publish Draft"}
                    </button>
                  )}
                  {!loading && (
                    <button
                      onClick={handleSave}
                      className="flex items-center gap-1.5 btn-secondary"
                    >
                      {saved ? "✓ Saved!" : "Save"}
                    </button>
                  )}
                  {/* Edit & Run Again / Reset Form — shown when article is done */}
                  {(articleStep === "article-done" || (!isOutlineMode && !loading && output)) && (
                    <>
                      <button
                        onClick={handleClear}
                        className="flex items-center gap-1.5 font-semibold text-xs px-3 py-1.5 rounded-md border border-accent/60 text-accent hover:bg-accent/10 transition-colors"
                      >
                        Edit &amp; Run Again
                      </button>
                      <button
                        onClick={handleReset}
                        className="flex items-center gap-1.5 font-mono text-xs px-3 py-1.5 rounded-md border border-border text-muted hover:text-white hover:border-white/20 transition-colors"
                      >
                        Reset Form
                      </button>
                    </>
                  )}
                </div>
              </div>
              {!publishAllowed && publishStatusLoaded && (
                <div className="flex items-center gap-3 mt-2">
                  <p className="text-xs text-amber-300/90">
                    Publish Draft is disabled until your saved WordPress settings pass a successful connection test in Settings.
                  </p>
                  <Link
                    href="/settings"
                    className="text-xs font-mono text-accent hover:text-white transition-colors whitespace-nowrap"
                  >
                    Go to Settings →
                  </Link>
                </div>
              )}
              {publishAllowed && publishError && (
                <div className="mt-2">
                  {(() => {
                    const category = publishErrorCategory ?? "unknown" satisfies PublishFailureCategory;
                    const categoryLabel = PUBLISH_FAILURE_CATEGORY_LABELS[category];
                    const hint = getPublishFailureHint(category);
                    return (
                      <div className="flex flex-col gap-0.5 bg-red-400/5 border border-red-400/15 rounded-md px-3 py-2">
                        <p className="text-xs text-red-300/90">
                          <span className="font-semibold text-red-300">{categoryLabel}:</span>{" "}
                          {publishError}
                        </p>
                        <p className="text-xs text-red-300/60">{hint}</p>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {/* Outline toolbar */}
          {articleStep === "outline-editing" && (
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <span className="font-mono text-xs text-slate-500">OUTLINE — Edit below, then generate</span>
              <button
                onClick={() => navigator.clipboard.writeText(editableOutline)}
                className="font-mono text-xs px-3 py-2 rounded-2xl border border-white/10 text-slate-300 hover:text-white hover:border-accent/40 transition-colors"
              >
                Copy
              </button>
            </div>
          )}

          {/* Output section label — always visible when no output yet */}
          {!output && !loading && (
            <div className="px-6 py-2.5 border-b border-border bg-card-alt flex items-center gap-2">
              <span className="font-mono text-xs text-muted uppercase tracking-widest">Output</span>
              <span className="flex-1 border-t border-border/50" />
            </div>
          )}

          {/* Output content */}
          <div
            ref={outputRef}
            className="flex-1 overflow-y-auto p-6 md:p-8"
          >
            {!output && !loading && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <EmptyState
                  icon={tool.icon}
                  eyebrow="Output Bay"
                  description={
                    <>
                      Fill in the fields and click <span className="text-accent">{isOutlineMode ? "Generate Outline" : "Generate"}</span> to see your content here.
                    </>
                  }
                />
              </div>
            )}

            {/* Editable outline */}
            {articleStep === "outline-editing" && (
              <textarea
                className={editorTextareaClassName}
                value={editableOutline}
                onChange={(e) => setEditableOutline(e.target.value)}
                placeholder="Your outline will appear here…"
              />
            )}

            {/* Streaming outline (before editing phase) */}
            {articleStep === "outline-streaming" && (output || loading) && (
              <div
                className={`markdown-output max-w-3xl ${loading && output ? "cursor-blink" : ""}`}
                dangerouslySetInnerHTML={{ __html: renderMarkdown(output) }}
              />
            )}

            {/* Article output — ARTICLE tab (rendered) */}
            {(articleStep === "article-streaming" || articleStep === "article-done") && (output || loading) && outputTab === "article" && (
              <div
                className={`markdown-output max-w-3xl ${loading && !output ? "cursor-blink" : ""} ${loading && output ? "cursor-blink" : ""}`}
                dangerouslySetInnerHTML={{ __html: renderMarkdown(output) }}
              />
            )}

            {!isOutlineMode && (output || loading) && outputTab === "article" && (
              <div className="space-y-6">
                {tool.slug === "blog-post-ideas" && blogIdeaSuggestions.length > 0 && !loading && (
                  <section className="space-y-3">
                    <div>
                      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent">Idea Handoff</p>
                      <p className="text-sm text-slate-400 mt-2">
                        Send any idea directly into Article Writer with the title, brief, and keywords prefilled.
                      </p>
                    </div>
                    <div className="grid gap-3 lg:grid-cols-2">
                      {blogIdeaSuggestions.map((idea) => (
                        <div
                          key={`${idea.title}-${idea.keywords.join("|")}`}
                          className="shell-panel-soft shell-hover-lift rounded-[1.5rem] p-4"
                        >
                          <p className="text-white font-semibold leading-snug">{idea.title}</p>
                          <p className="text-sm text-slate-400 mt-2 leading-relaxed">{idea.description || "No description detected."}</p>
                          {idea.keywords.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-3">
                              {idea.keywords.map((keyword) => (
                                <span
                                  key={keyword}
                                  className="shell-status-pill rounded-full px-2.5 py-1 text-[11px] font-mono text-slate-300"
                                >
                                  {keyword}
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="mt-4 flex gap-2">
                            <Link
                              href={buildArticleWriterHrefFromIdea(idea)}
                              className="shell-hover-lift inline-flex items-center justify-center rounded-2xl bg-accent px-4 py-2.5 text-sm font-semibold text-[#08100c] hover:bg-accent-dim transition-colors"
                            >
                              Send to Article Writer
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
                <div
                  className={`markdown-output max-w-3xl ${loading && !output ? "cursor-blink" : ""} ${loading && output ? "cursor-blink" : ""}`}
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(output) }}
                />
              </div>
            )}

            {(articleStep === "article-streaming" || articleStep === "article-done") && output && outputTab === "editor" && (
              <textarea
                className={editorTextareaClassName}
                value={output}
                onChange={(e) => setOutput(e.target.value)}
                placeholder="Your article will appear here…"
              />
            )}

            {/* Non-outline-mode output — EDITOR tab (editable textarea) */}
            {!isOutlineMode && output && !loading && outputTab === "editor" && (
              <textarea
                className={editorTextareaClassName}
                value={output}
                onChange={(e) => setOutput(e.target.value)}
                placeholder="Your content will appear here…"
              />
            )}

            {/* Structured result card — shown once output is fully generated */}
            {!isOutlineMode && !loading && parsedOutput && handoffActions.length > 0 && outputTab === "article" && (
              <HandoffCard
                parsedOutput={parsedOutput}
                actions={handoffActions}
                fields={fields}
              />
            )}
          </div>
          </section>
        </div>
      </div>

      {/* Add Knowledge modal */}
      {showKnowledgeModal && (
        <AddKnowledgeModal
          onClose={() => setShowKnowledgeModal(false)}
          onAdd={(item) => setResearchItems((prev) => [...prev, item])}
        />
      )}
    </div>
  );
}
