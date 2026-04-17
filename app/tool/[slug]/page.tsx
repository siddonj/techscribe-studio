"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getToolBySlug, Tool, ToolField } from "@/lib/tools";
import { getHandoffActions } from "@/lib/handoff-registry";
import { parseToolOutput, ParsedToolOutput } from "@/lib/output-parsers";
import HandoffCard from "@/components/HandoffCard";
import type { PublishState, PublishFailureCategory } from "@/lib/publish-state";
import {
  normalizePublishState,
  classifyPublishFailure,
  getPublishFailureHint,
  PUBLISH_FAILURE_CATEGORY_LABELS,
} from "@/lib/publish-state";

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

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: ToolField;
  value: string;
  onChange: (v: string) => void;
}) {
  const base = "w-full input-base";

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

  // Output tab state (ARTICLE = rendered, EDITOR = editable textarea)
  type OutputTab = "article" | "editor";
  const [outputTab, setOutputTab] = useState<OutputTab>("article");

  const editorTextareaClassName = "w-full h-full min-h-[400px] bg-transparent text-white text-sm font-mono leading-relaxed resize-none focus:outline-none placeholder-muted";

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
        body: JSON.stringify({ slug: tool.slug, fields, mode }),
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
        body: JSON.stringify({ slug: tool.slug, fields, mode: "article", outline: editableOutline }),
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
      {/* Top bar */}
      <header className="border-b border-border px-8 py-4 flex items-center gap-4">
        <Link href="/" className="text-muted hover:text-white text-sm transition-colors">
          ← Dashboard
        </Link>
        <span className="text-border">|</span>
        <span className="text-xl">{tool.icon}</span>
        <h1 className="text-white font-medium">{tool.name}</h1>
        <span className="ml-auto font-mono text-xs text-muted bg-subtle px-2 py-1 rounded">
          {tool.category}
        </span>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Input panel */}
        <div className="w-96 border-r border-border p-6 flex flex-col gap-4 overflow-y-auto">
          <div>
            <p className="text-slate-200 text-sm mb-6">{tool.description}</p>
            {Number.isFinite(calendarId) && (
              <div className="bg-card-alt border border-border rounded-lg px-4 py-3 text-sm mb-4">
                <p className="text-muted text-xs font-mono uppercase tracking-wider mb-1">Calendar Linked</p>
                <p className="text-white/90">Saving this draft will link the result back to the planned calendar item.</p>
              </div>
            )}
          </div>

          {/* Outline-editing phase: show summary + outline actions */}
          {isOutlineMode && articleStep === "outline-editing" ? (
            <>
              <div className="bg-card-alt border border-border rounded-lg px-4 py-3 text-sm">
                <p className="text-muted text-xs font-mono uppercase tracking-wider mb-1">Topic</p>
                <p className="text-white">{fields.topic || "—"}</p>
              </div>
              <p className="text-muted text-xs leading-relaxed">
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
                className="w-full bg-accent text-bg font-semibold py-3 rounded-lg text-sm hover:bg-accent-dim transition-colors disabled:opacity-50 disabled:cursor-not-allowed pulse-glow mt-2"
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
                className="w-full text-muted text-xs border border-border py-2 rounded-lg hover:text-white hover:border-white/20 transition-colors"
              >
                ← Edit Inputs
              </button>
            </>
          ) : (
            <>
              {tool.fields.map((field) => (
                <div key={field.name}>
                  <label className="block text-xs font-mono text-muted uppercase tracking-wider mb-1.5">
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

              {error && (
                <div className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={loading}
                className="w-full bg-accent text-bg font-semibold py-3 rounded-lg text-sm hover:bg-accent-dim transition-colors disabled:opacity-50 disabled:cursor-not-allowed pulse-glow mt-2"
              >
                {loading
                  ? isOutlineMode ? "Generating Outline…" : "Generating…"
                  : isOutlineMode ? "Generate Outline ✦" : "Generate with Claude ✦"}
              </button>

              {output && (
                <button
                  onClick={handleClear}
                  className="w-full text-muted text-xs border border-border py-2 rounded-lg hover:text-white hover:border-white/20 transition-colors"
                >
                  Clear output
                </button>
              )}
            </>
          )}
        </div>

        {/* Output panel */}
        <div className="flex-1 flex flex-col">
          {/* Output toolbar — shown when output is ready and not in outline-editing */}
          {output && articleStep !== "outline-editing" && (
            <div className="px-6 py-3 border-b border-border">
              {/* Tab row + action buttons */}
              <div className="flex items-center justify-between gap-4">
                {/* ARTICLE / EDITOR tabs (only when article is fully done) */}
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
                  <span className="font-mono text-xs text-muted">OUTPUT</span>
                )}

                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted">
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
                  <p className="text-[11px] text-amber-300/90">
                    Publish Draft is disabled until your saved WordPress settings pass a successful connection test in Settings.
                  </p>
                  <Link
                    href="/settings"
                    className="text-[11px] font-mono text-accent hover:text-white transition-colors whitespace-nowrap"
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
                        <p className="text-[11px] text-red-300/90">
                          <span className="font-semibold text-red-300">{categoryLabel}:</span>{" "}
                          {publishError}
                        </p>
                        <p className="text-[11px] text-red-300/60">{hint}</p>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {/* Outline toolbar */}
          {articleStep === "outline-editing" && (
            <div className="flex items-center justify-between px-6 py-3 border-b border-border">
              <span className="font-mono text-xs text-muted">OUTLINE — Edit below, then generate</span>
              <button
                onClick={() => navigator.clipboard.writeText(editableOutline)}
                className="font-mono text-xs px-3 py-1.5 rounded-md border border-border text-muted hover:text-white hover:border-accent/40 transition-colors"
              >
                Copy
              </button>
            </div>
          )}

          {/* Output content */}
          <div
            ref={outputRef}
            className="flex-1 overflow-y-auto p-8"
          >
            {!output && !loading && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="text-5xl mb-4 opacity-30">{tool.icon}</div>
                <p className="text-muted text-sm max-w-xs">
                  Fill in the fields and click{" "}
                  <span className="text-accent">
                    {isOutlineMode ? "Generate Outline" : "Generate"}
                  </span>{" "}
                  to see your content here.
                </p>
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

            {/* Article output — EDITOR tab (editable textarea) */}
            {(articleStep === "article-streaming" || articleStep === "article-done") && output && outputTab === "editor" && (
              <textarea
                className={editorTextareaClassName}
                value={output}
                onChange={(e) => setOutput(e.target.value)}
                placeholder="Your article will appear here…"
              />
            )}

            {/* Non-outline-mode output — ARTICLE tab (rendered) */}
            {!isOutlineMode && (output || loading) && outputTab === "article" && (
              <div
                className={`markdown-output max-w-3xl ${loading && !output ? "cursor-blink" : ""} ${loading && output ? "cursor-blink" : ""}`}
                dangerouslySetInnerHTML={{ __html: renderMarkdown(output) }}
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
        </div>
      </div>
    </div>
  );
}
