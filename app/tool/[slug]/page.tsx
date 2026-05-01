"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getToolBySlug, Tool, ToolField } from "@/lib/tools";
import { getHandoffActions } from "@/lib/handoff-registry";
import { parseToolOutput, ParsedToolOutput } from "@/lib/output-parsers";
import HandoffCard from "@/components/HandoffCard";
import AddKnowledgeModal, { ResearchItem } from "@/components/AddKnowledgeModal";
import { BookOpen, FileText, Link2, Pencil, SearchX, Sparkles } from "lucide-react";
import { ControlBar, EmptyState, PageContainer, PageHeader, SectionHeader } from "@/components/DashboardPrimitives";
import { useToast } from "@/components/Toast";
import { useKnowledgeBase } from "@/lib/use-knowledge-base";
import { useMyTone, buildToneInstruction } from "@/lib/use-my-tone";
import HelpDrawer from "@/components/HelpDrawer";
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
  const escapeHtmlAttribute = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const sanitizeHttpUrl = (value: string): string | null => {
    try {
      const parsed = new URL(value);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return null;
      }
      return parsed.toString();
    } catch {
      return null;
    }
  };

  // Named set of block-level tag prefixes that should never be wrapped in <p>.
  // Checked via startsWith so the pattern stays readable and easy to extend.
  const BLOCK_TAGS = ["<h1", "<h2", "<h3", "<h4", "<h5", "<h6",
    "<ul", "<ol", "<li", "<hr", "<p", "<pre", "<figure", "<figcaption",
    "<blockquote", "</h", "</ul", "</ol", "</p", "</pre", "</figure",
    "</figcaption", "</blockquote"];

  return text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/```[\w]*\n([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Render markdown images before headings so URLs aren't double-escaped
    .replace(
      /!\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g,
      (_match, alt, src) => {
        const safeSrc = sanitizeHttpUrl(String(src).trim());
        if (!safeSrc) {
          return `<p>${alt || "Image removed: invalid URL"}</p>`;
        }
        const safeAlt = escapeHtmlAttribute(String(alt).trim());
        const safeSrcAttr = escapeHtmlAttribute(safeSrc);
        return `<figure class="article-photo"><img src="${safeSrcAttr}" alt="${safeAlt}" loading="lazy" /><figcaption><a href="${safeSrcAttr}" target="_blank" rel="noopener noreferrer">${safeAlt || "Photo"}</a></figcaption></figure>`;
      }
    )
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
    // Wrap bare text lines in <p>; skip lines that already start with a block tag
    .replace(/^.+$/gm, (m) =>
      BLOCK_TAGS.some((tag) => m.startsWith(tag)) ? m : `<p>${m}</p>`)
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

function WorkflowStepper({
  steps,
  currentStep,
  hint,
}: {
  steps: string[];
  currentStep: number;
  hint?: string;
}) {
  return (
    <div className="flex items-center gap-4 px-6 py-3 border-b border-white/5 bg-white/[0.02]">
      <div className="flex items-center">
        {steps.map((step, i) => {
          const done = i < currentStep;
          const active = i === currentStep;
          return (
            <span key={step} className="flex items-center">
              <span className={`flex items-center gap-1.5 text-xs font-medium px-1.5 py-1 rounded-lg transition-all ${
                done ? "text-emerald-400" : active ? "text-white" : "text-slate-600"
              }`}>
                <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold border shrink-0 transition-all ${
                  done
                    ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                    : active
                      ? "bg-accent/15 border-accent/60 text-accent"
                      : "bg-transparent border-white/15 text-slate-600"
                }`}>
                  {done ? "✓" : i + 1}
                </span>
                <span className={active ? "font-semibold" : ""}>{step}</span>
              </span>
              {i < steps.length - 1 && (
                <span className={`w-8 h-px mx-1 block transition-all ${
                  i < currentStep ? "bg-emerald-500/30" : "bg-white/10"
                }`} />
              )}
            </span>
          );
        })}
      </div>
      {hint && (
        <span className="text-xs text-slate-500 border-l border-white/10 pl-4 hidden sm:block">{hint}</span>
      )}
    </div>
  );
}

function ToolPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params?.slug as string;
  const tool: Tool | undefined = getToolBySlug(slug);
  const calendarIdParam = searchParams.get("calendarId");
  const calendarId = calendarIdParam ? Number.parseInt(calendarIdParam, 10) : null;
  const handoffActions = getHandoffActions(slug);

  const { toast } = useToast();
  const { entries: knowledgeEntries } = useKnowledgeBase();
  const { config: toneConfig } = useMyTone();

  const [fields, setFields] = useState<Record<string, string>>({});
  const [output, setOutput] = useState("");
  const [parsedOutput, setParsedOutput] = useState<ParsedToolOutput | null>(null);
  const [loading, setLoading] = useState(false);
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
  const hideRawMarkdown = isBlogPostIdeas && blogIdeaSuggestions.length > 0 && !loading;

  // Research / knowledge sources state
  const [researchItems, setResearchItems] = useState<ResearchItem[]>([]);
  const [showKnowledgeModal, setShowKnowledgeModal] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  // Photos option state — rendered for all tools but only displayed when tool.supportsPhotos is true
  const [includePhotos, setIncludePhotos] = useState(false);
  const [includeKnowledge, setIncludeKnowledge] = useState(false);

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

    setHistoryId(null);
    setDraftPostId(null);
    setPublishedDraftUrl(null);
    setPublishState(null);
    setPublishError(null);
    setPublishErrorCategory(null);
    setArticleStep("input");
    setEditableOutline("");
    setResearchItems([]);
    setIncludePhotos(false);
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

  const generateFnRef = useRef<() => void>(() => {});
  const saveFnRef = useRef<() => void>(() => {});
  const copyFnRef = useRef<() => void>(() => {});
  const [draftOutput, setDraftOutput] = useState<string | null>(null);
  const [draftHistory, setDraftHistory] = useState<Array<{ output: string; timestamp: number }>>([]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        generateFnRef.current?.();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveFnRef.current?.();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        copyFnRef.current?.();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    setDraftOutput(null);
    setDraftHistory([]);
    try {
      const raw = localStorage.getItem(`techscribe_draft_${slug}`);
      if (!raw) return;
      const parsed = JSON.parse(raw) as
        | { output: string; timestamp: number }
        | { history: Array<{ output: string; timestamp: number }> };
      const history = "history" in parsed
        ? parsed.history
        : [parsed];
      const freshHistory = history
        .filter((item) => Date.now() - item.timestamp < 48 * 60 * 60 * 1000 && item.output)
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 10);
      if (freshHistory.length > 0) {
        setDraftOutput(freshHistory[0].output);
        setDraftHistory(freshHistory);
      }
    } catch { /* ignore */ }
  }, [slug]);

  useEffect(() => {
    if (!output || !slug) return;
    const timer = setTimeout(() => {
      try {
        const raw = localStorage.getItem(`techscribe_draft_${slug}`);
        const parsed = raw
          ? (JSON.parse(raw) as
              | { output: string; timestamp: number }
              | { history: Array<{ output: string; timestamp: number }> })
          : null;
        const previous = parsed
          ? ("history" in parsed ? parsed.history : [parsed])
          : [];
        const nextSnapshot = { output, timestamp: Date.now() };
        const nextHistory = [nextSnapshot, ...previous]
          .filter((item, index, arr) => {
            const firstIndex = arr.findIndex((entry) => entry.output === item.output);
            return firstIndex === index;
          })
          .slice(0, 10);
        localStorage.setItem(`techscribe_draft_${slug}`, JSON.stringify({ history: nextHistory }));
        setDraftHistory(nextHistory);
      } catch { /* ignore */ }
    }, 2000);
    return () => clearTimeout(timer);
  }, [output, slug]);

  if (!tool) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <SearchX className="w-10 h-10 mx-auto mb-4 text-slate-500 opacity-50" />
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
        body: JSON.stringify({
          slug: tool.slug,
          fields,
          mode,
          research: [
            ...researchItems,
            ...(includeKnowledge ? knowledgeEntries.map((e) => ({ id: e.id, type: e.type === "url" ? "url" : "text" as const, label: e.title, content: e.content })) : []),
          ],
          includePhotos: isOutlineMode ? false : includePhotos,
          toneInstruction: buildToneInstruction(toneConfig),
          model: localStorage.getItem("techscribe_model") ?? "claude-sonnet-4-6",
        }),
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
        body: JSON.stringify({
          slug: tool.slug,
          fields,
          mode: "article",
          outline: editableOutline,
          research: [
            ...researchItems,
            ...(includeKnowledge ? knowledgeEntries.map((e) => ({ id: e.id, type: e.type === "url" ? "url" : "text" as const, label: e.title, content: e.content })) : []),
          ],
          includePhotos,
          toneInstruction: buildToneInstruction(toneConfig),
          model: localStorage.getItem("techscribe_model") ?? "claude-sonnet-4-6",
        }),
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
    toast("Copied to clipboard");
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
        setHistoryId(entry.id);
        toast("Saved to history");
        try { localStorage.removeItem(`techscribe_draft_${slug}`); } catch { /* ignore */ }
        setDraftOutput(null);
        if (entry.cannibalizationWarning?.length) {
          const titles = entry.cannibalizationWarning.map((e: { title: string }) => `"${e.title}"`).join(", ");
          toast(`Keyword overlap detected with ${titles}`, "info");
        }
        return entry.id as number;
      }
      toast("Save failed — please try again", "error");
    } catch {
      toast("Save failed — please try again", "error");
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
      toast("Published to WordPress", "success");
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
    setIncludePhotos(false);
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

  generateFnRef.current = loading ? () => {} : articleStep === "outline-editing" ? handleGenerateArticle : handleGenerate;
  saveFnRef.current = output ? () => { void handleSave(); } : () => {};
  copyFnRef.current = output ? () => { void handleCopy(); } : () => {};

  return (
    <div className="min-h-screen flex flex-col">
      <PageContainer maxWidthClassName="max-w-[1600px]" className="flex-1 flex flex-col gap-6 min-h-0">
        <PageHeader
          eyebrow={tool.category}
          title={tool.name}
          description={tool.description}
          icon={tool.icon}
          stats={[
            { label: "Mode", value: isOutlineMode ? "Outline → Article" : "Direct generation" },
            { label: "Calendar", value: Number.isFinite(calendarId) ? "Linked" : "Standalone" },
            { label: "Publish", value: publishAllowed ? "Enabled" : "Restricted" },
          ]}
        />

        {isOutlineMode ? (
          <WorkflowStepper
            steps={["Brief", "Outline", "Article", "Save"]}
            currentStep={
              articleStep === "input" ? 0
              : articleStep === "outline-streaming" || articleStep === "outline-editing" ? 1
              : articleStep === "article-streaming" ? 2
              : historyId !== null ? 3
              : 2
            }
            hint={
              articleStep === "input" ? "Fill in the brief, then generate an outline"
              : articleStep === "outline-streaming" ? "Generating your outline…"
              : articleStep === "outline-editing" ? "Review and edit the outline, then generate the full article"
              : articleStep === "article-streaming" ? "Writing your article…"
              : articleStep === "article-done" && !historyId ? "Article ready — save or publish to finish"
              : "Saved to history"
            }
          />
        ) : (
          <WorkflowStepper
            steps={["Brief", "Generate", "Save"]}
            currentStep={
              !output && !loading ? 0
              : loading ? 1
              : historyId !== null ? 2
              : 1
            }
            hint={
              !output && !loading ? "Fill in the brief and click Generate"
              : loading ? "Generating with Claude…"
              : historyId !== null ? "Saved to history"
              : "Output ready — save or copy to finish"
            }
          />
        )}

        <div className="flex flex-1 overflow-hidden gap-6 min-h-0">
          <aside className="w-96 shell-panel rounded-[2rem] p-6 flex flex-col gap-4 overflow-y-auto shrink-0">
            <div>
              <div className="flex items-start justify-between gap-3 mb-2">
                <SectionHeader
                  eyebrow="Input Studio"
                  title="Prompt configuration"
                  description="Shape the brief, tone, and constraints before you generate."
                  className="flex-1"
                />
                <button
                  onClick={() => setHelpOpen(true)}
                  className="h-6 w-6 rounded-lg border border-border flex items-center justify-center text-muted hover:text-slate-900 hover:border-accent/40 transition-colors"
                  aria-label="Open help"
                  title="Help for this tool"
                >
                  <span className="text-xs font-mono leading-none">?</span>
                </button>
              </div>
              {Number.isFinite(calendarId) && (
                <div className="shell-panel-soft rounded-2xl px-4 py-3 text-sm mb-4">
                  <p className="text-slate-500 text-xs font-mono uppercase tracking-wider mb-1">Calendar Linked</p>
                <p className="text-white/90">Saving this draft will link the result back to the planned calendar item.</p>
              </div>
              )}
            </div>

          {draftOutput && (
            <div className="shell-panel-soft rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-amber-300/90">Unsaved draft recovered</p>
                {draftHistory.length > 1 && (
                  <p className="text-[11px] text-slate-500 mt-1">{draftHistory.length} snapshots available</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {draftHistory.length > 1 && (
                  <select
                    className="input-base text-xs py-1.5 px-2 min-w-[12rem]"
                    onChange={(event) => {
                      const timestamp = Number(event.target.value);
                      const snapshot = draftHistory.find((item) => item.timestamp === timestamp);
                      if (snapshot) {
                        setOutput(snapshot.output);
                        setDraftOutput(snapshot.output);
                      }
                    }}
                    value={draftHistory[0]?.timestamp ?? ""}
                  >
                    {draftHistory.map((item) => (
                      <option key={item.timestamp} value={item.timestamp}>
                        {new Date(item.timestamp).toLocaleString()}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  onClick={() => { setOutput(draftOutput); setDraftOutput(null); }}
                  className="text-xs text-accent hover:text-white transition-colors font-medium"
                >
                  Restore
                </button>
                <button
                  onClick={() => {
                    try { localStorage.removeItem(`techscribe_draft_${slug}`); } catch { /* ignore */ }
                    setDraftOutput(null);
                    setDraftHistory([]);
                  }}
                  className="text-xs text-muted hover:text-white transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

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
                          <span className="mt-0.5 shrink-0 text-accent">
                            {item.type === "url" ? <Link2 className="w-3.5 h-3.5" /> : item.type === "file" ? <FileText className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
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

              {/* Photos toggle — shown for tools with supportsPhotos */}
              {tool.supportsPhotos && (
                <label className="flex items-center justify-between gap-3 shell-panel-soft rounded-2xl px-4 py-3 cursor-pointer select-none">
                  <div>
                    <p className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-0.5">Auto-insert Photos</p>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Embed royalty-free images from Unsplash at natural break points in the article.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={includePhotos}
                    onClick={() => setIncludePhotos((v) => !v)}
                    className={`relative shrink-0 h-6 w-11 rounded-full border transition-colors focus:outline-none ${
                      includePhotos
                        ? "bg-accent border-accent"
                        : "bg-subtle border-border"
                    }`}
                  >
                    <span
                      className={`block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                        includePhotos ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </label>
              )}

              {/* Knowledge base toggle — always visible when entries exist */}
              {knowledgeEntries.length > 0 && (
                <label className="flex items-center justify-between gap-3 shell-panel-soft rounded-2xl px-4 py-3 cursor-pointer select-none">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <BookOpen className="w-4 h-4 text-accent shrink-0" />
                    <div>
                      <p className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-0.5">Knowledge Base</p>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Include {knowledgeEntries.length} saved source{knowledgeEntries.length !== 1 ? "s" : ""} from your library.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={includeKnowledge}
                    onClick={() => setIncludeKnowledge((v) => !v)}
                    className={`relative shrink-0 h-6 w-11 rounded-full border transition-colors focus:outline-none ${
                      includeKnowledge ? "bg-accent border-accent" : "bg-subtle border-border"
                    }`}
                  >
                    <span className={`block h-4 w-4 rounded-full bg-white shadow transition-transform ${includeKnowledge ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                </label>
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
            <ControlBar className="rounded-none border-0 border-b border-white/5 px-6 py-4 bg-white/[0.02]">
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
                    Copy
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
                      Save
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
            </ControlBar>
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
                  icon={<Sparkles />}
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
                {!hideRawMarkdown && (
                  <div
                    className={`markdown-output max-w-3xl ${loading && !output ? "cursor-blink" : ""} ${loading && output ? "cursor-blink" : ""}`}
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(output) }}
                  />
                )}
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
      </PageContainer>

      {/* Add Knowledge modal */}
      {showKnowledgeModal && (
        <AddKnowledgeModal
          onClose={() => setShowKnowledgeModal(false)}
          onAdd={(item) => setResearchItems((prev) => [...prev, item])}
        />
      )}

      <HelpDrawer
        tool={tool}
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
      />
    </div>
  );
}

export default function ToolPage() {
  return (
    <Suspense>
      <ToolPageContent />
    </Suspense>
  );
}
