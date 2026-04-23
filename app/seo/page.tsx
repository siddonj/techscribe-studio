"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { TrendingUp } from "lucide-react";
import { PageHeader, StatusStrip } from "@/components/DashboardPrimitives";
import type { HistoryRow } from "@/lib/db";
import { WORKFLOW_PRESETS } from "@/lib/workflow-presets";

interface HistoryListResponse {
  rows: HistoryRow[];
}

interface SeoAnalyzeResponse {
  score: number;
  checks: Array<{
    id: string;
    label: string;
    passed: boolean;
    detail: string;
    weight: number;
  }>;
  suggestions: string[];
  wordCount?: number;
  readabilityScore?: number;
  readabilityGrade?: string;
  analyzedAt: string;
}

function scoreLabel(score: number): string {
  if (score >= 85) return "Excellent";
  if (score >= 65) return "Good";
  if (score >= 40) return "Fair";
  return "Needs Work";
}

function scoreColorClass(score: number): string {
  if (score >= 85) return "text-emerald-500";
  if (score >= 65) return "text-teal-400";
  if (score >= 40) return "text-amber-500";
  return "text-red-500";
}

function scoreBgBarClass(score: number): string {
  if (score >= 85) return "bg-emerald-500";
  if (score >= 65) return "bg-teal-400";
  if (score >= 40) return "bg-amber-500";
  return "bg-red-500";
}

function estimateReadingTime(wordCount: number): string {
  const minutes = Math.ceil(wordCount / 200);
  return minutes === 1 ? "1 min read" : `${minutes} min read`;
}

const WORKFLOW_STAGES = ["Idea", "Drafting", "Optimization", "Review", "Ready to Publish"];
const COLLABORATION_STATUSES = ["Not started", "In review", "Needs changes", "Approved"];

function normalizeStage(stage: string | null): string {
  if (!stage) {
    return WORKFLOW_STAGES[0];
  }

  return WORKFLOW_STAGES.includes(stage) ? stage : WORKFLOW_STAGES[0];
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function SeoWorkspacePageContent() {
  const searchParams = useSearchParams();
  const presetFromQuery = searchParams.get("preset") ?? "";
  const keywordFromQuery = searchParams.get("keyword") ?? "";
  const stageFromQuery = normalizeStage(searchParams.get("stage"));
  const historyIdFromQuery = Number(searchParams.get("historyId"));

  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(
    Number.isFinite(historyIdFromQuery) && historyIdFromQuery > 0 ? historyIdFromQuery : null
  );

  const [focusKeyword, setFocusKeyword] = useState(keywordFromQuery);
  const [presetId, setPresetId] = useState(presetFromQuery);
  const [workflowStage, setWorkflowStage] = useState(stageFromQuery);
  const [collaborationStatus, setCollaborationStatus] = useState(COLLABORATION_STATUSES[0]);
  const [assignee, setAssignee] = useState("");
  const [commentAuthor, setCommentAuthor] = useState("");
  const [commentDraft, setCommentDraft] = useState("");
  const [comments, setComments] = useState<NonNullable<HistoryRow["collaboration_comments"]>>([]);

  const [analysis, setAnalysis] = useState<SeoAnalyzeResponse | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [copyLabel, setCopyLabel] = useState("Copy Report");
  const [metaDescription, setMetaDescription] = useState("");
  const [leftTab, setLeftTab] = useState<"analysis" | "workflow" | "collaboration">("analysis");

  useEffect(() => {
    if (!saveMessage) return;
    const timer = setTimeout(() => setSaveMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [saveMessage]);

  useEffect(() => {
    const load = async () => {
      setLoadingRows(true);
      try {
        const res = await fetch("/api/history?limit=200");
        if (!res.ok) {
          throw new Error("Failed to load history rows");
        }

        const data = (await res.json()) as HistoryListResponse;
        setRows(data.rows ?? []);
      } catch {
        setRows([]);
      } finally {
        setLoadingRows(false);
      }
    };

    void load();
  }, []);

  useEffect(() => {
    if (!rows.length || selectedId) {
      return;
    }

    if (Number.isFinite(historyIdFromQuery) && historyIdFromQuery > 0) {
      const queryMatch = rows.find((row) => row.id === historyIdFromQuery);
      if (queryMatch) {
        setSelectedId(queryMatch.id);
        return;
      }
    }

    setSelectedId(rows[0].id);
  }, [historyIdFromQuery, rows, selectedId]);

  const selectedRow = useMemo(
    () => rows.find((row) => row.id === selectedId) ?? null,
    [rows, selectedId]
  );

  useEffect(() => {
    if (!selectedRow) {
      setFocusKeyword(keywordFromQuery);
      setPresetId(presetFromQuery);
      setWorkflowStage(stageFromQuery);
      setCollaborationStatus(COLLABORATION_STATUSES[0]);
      setAssignee("");
      setComments([]);
      setAnalysis(null);
      return;
    }

    setFocusKeyword(selectedRow.seo_focus_keyword ?? keywordFromQuery);
    setPresetId(selectedRow.preset_id ?? presetFromQuery);
    setWorkflowStage(selectedRow.workflow_stage ?? stageFromQuery);
    setCollaborationStatus(selectedRow.collaboration_status ?? COLLABORATION_STATUSES[0]);
    setAssignee(selectedRow.assignee ?? "");
    setComments(selectedRow.collaboration_comments ?? []);
    if (selectedRow.seo_score !== null && selectedRow.seo_score !== undefined) {
      setAnalysis({
        score: selectedRow.seo_score,
        checks: (selectedRow.seo_checklist_items ?? []).map((item, index) => ({
          id: `saved-${index}`,
          label: item,
          passed: true,
          detail: "Saved checklist item",
          weight: 0,
        })),
        suggestions: [],
        analyzedAt: selectedRow.created_at,
      });
    } else {
      setAnalysis(null);
    }
  }, [keywordFromQuery, presetFromQuery, selectedRow, stageFromQuery]);

  const handleAnalyze = async () => {
    if (!selectedRow) {
      return;
    }

    setAnalyzing(true);
    setSaveMessage(null);

    try {
      const res = await fetch("/api/seo/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: selectedRow.title,
          output: selectedRow.output,
          focusKeyword,
        }),
      });

      const data = (await res.json()) as SeoAnalyzeResponse | { error: string };
      if (!res.ok) {
        throw new Error("error" in data ? data.error : "Analysis failed");
      }

      setAnalysis(data as SeoAnalyzeResponse);
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : "Failed to analyze content");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAddComment = () => {
    const author = commentAuthor.trim();
    const message = commentDraft.trim();
    if (!author || !message) {
      return;
    }

    setComments((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        author,
        message,
        created_at: new Date().toISOString(),
      },
    ]);
    setCommentDraft("");
  };

  const handleSave = async () => {
    if (!selectedRow) {
      return;
    }

    setSaving(true);
    setSaveMessage(null);

    try {
      const checklistItems = analysis
        ? analysis.checks.filter((check) => check.passed).map((check) => check.label)
        : selectedRow.seo_checklist_items ?? [];

      const res = await fetch(`/api/history/${selectedRow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: selectedRow.title,
          folder_name: selectedRow.folder_name ?? "",
          tags: selectedRow.tags ?? "",
          wp_slug: selectedRow.wp_slug ?? "",
          wp_excerpt: selectedRow.wp_excerpt ?? "",
          wp_categories: selectedRow.wp_categories ?? "",
          wp_tags: selectedRow.wp_tags ?? "",
          seo_focus_keyword: focusKeyword || null,
          seo_score: analysis?.score ?? selectedRow.seo_score ?? null,
          seo_checklist_items: checklistItems,
          workflow_stage: workflowStage,
          preset_id: presetId || null,
          collaboration_status: collaborationStatus,
          assignee: assignee || null,
          collaboration_comments: comments,
        }),
      });

      const data = (await res.json()) as HistoryRow | { error: string };
      if (!res.ok) {
        throw new Error("error" in data ? data.error : "Failed to save SEO metadata");
      }

      const updated = data as HistoryRow;
      setRows((current) => current.map((row) => (row.id === updated.id ? updated : row)));
      setSaveMessage("SEO and collaboration metadata saved.");
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : "Failed to save SEO metadata");
    } finally {
      setSaving(false);
    }
  };

  const handleCopyReport = async () => {
    if (!selectedRow || !analysis) return;

    const passing = analysis.checks.filter((c) => c.passed);
    const failing = analysis.checks.filter((c) => !c.passed);

    const lines = [
      `SEO Report — ${selectedRow.title}`,
      `Score: ${analysis.score}/100 (${scoreLabel(analysis.score)})`,
      `Keyword: ${focusKeyword || "Not set"}`,
      `Word Count: ${analysis.wordCount ?? selectedRow.word_count ?? "—"}`,
      `Analyzed: ${formatDate(analysis.analyzedAt)}`,
      "",
      `✅ Passing (${passing.length})`,
      ...passing.map((c) => `  • ${c.label}`),
      "",
      `⚠️ Needs Work (${failing.length})`,
      ...failing.map((c) => `  • ${c.label}: ${c.detail}`),
    ];

    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopyLabel("Copied!");
      setTimeout(() => setCopyLabel("Copy Report"), 2000);
    } catch {
      setCopyLabel("Copy failed");
      setTimeout(() => setCopyLabel("Copy Report"), 2000);
    }
  };

  return (
    <div className="p-5 md:p-8 max-w-7xl mx-auto space-y-6">
      <PageHeader
        eyebrow="Optimization"
        title="SEO Workspace"
        description="Run a unified SEO scoring pass, apply guided workflow metadata, and keep review ownership visible on each draft."
        stats={[
          { label: "Analyzable Drafts", value: rows.length, meta: "history entries" },
          { label: "Workflow Presets", value: WORKFLOW_PRESETS.length, meta: "guided flows" },
          { label: "SEO Score", value: analysis ? `${analysis.score}/100` : selectedRow?.seo_score != null ? `${selectedRow.seo_score}/100` : "—", meta: "current draft" },
          { label: "Focus", value: selectedRow ? "Active" : "Idle", meta: "workspace state" },
        ]}
      />

      <StatusStrip
        items={[
          { label: "Selected Draft", value: selectedRow ? `#${selectedRow.id}` : "None" },
          { label: "SEO Score", value: analysis ? `${analysis.score} — ${scoreLabel(analysis.score)}` : "Not scored" },
          { label: "Workflow Stage", value: workflowStage },
          { label: "Review Status", value: collaborationStatus },
          { label: "Assignee", value: assignee || "Unassigned" },
        ]}
      />

      <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="shell-panel rounded-[2rem] overflow-hidden flex flex-col">
          {/* Tab bar */}
          <div className="flex border-b border-white/10 px-2 pt-2">
            {(["analysis", "workflow", "collaboration"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setLeftTab(tab)}
                className={`px-4 py-2.5 text-xs font-mono uppercase tracking-[0.18em] rounded-t-xl transition-colors ${
                  leftTab === tab
                    ? "bg-white/[0.06] text-white border-b-2 border-accent"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {tab === "analysis" ? "Analysis" : tab === "workflow" ? "Workflow" : "Collaboration"}
              </button>
            ))}
          </div>

          <div className="p-5 space-y-4 flex-1 overflow-y-auto">
            {/* Analysis tab */}
            {leftTab === "analysis" && (
              <>
                <div>
                  <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-slate-500 mb-2">Draft Source</p>
                  <select
                    className="w-full input-base"
                    value={selectedId ?? ""}
                    onChange={(event) => setSelectedId(event.target.value ? Number(event.target.value) : null)}
                    disabled={loadingRows}
                  >
                    <option value="">Select a saved history draft...</option>
                    {rows.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.tool_icon} {row.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-slate-500 mb-2">Focus Keyword</p>
                  <input
                    className="w-full input-base"
                    value={focusKeyword}
                    onChange={(event) => setFocusKeyword(event.target.value)}
                    placeholder="e.g. developer content workflow"
                    disabled={!selectedRow}
                  />
                  {focusKeyword && (
                    <p className="text-[11px] text-slate-500 mt-1">
                      {focusKeyword.length} chars · {focusKeyword.trim().split(/\s+/).filter((w) => w.length > 0).length} word(s)
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <button onClick={handleAnalyze} disabled={!selectedRow || analyzing} className="btn-primary">
                    {analyzing ? "Analyzing..." : "Run SEO Analysis"}
                  </button>
                  <button onClick={handleSave} disabled={!selectedRow || saving} className="btn-secondary">
                    {saving ? "Saving..." : "Save Metadata"}
                  </button>
                </div>
                {saveMessage && <p className="text-sm text-slate-600">{saveMessage}</p>}
              </>
            )}

            {/* Workflow tab */}
            {leftTab === "workflow" && (
              <>
                <div>
                  <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-slate-500 mb-2">Workflow Preset</p>
                  <select
                    className="w-full input-base"
                    value={presetId}
                    onChange={(event) => setPresetId(event.target.value)}
                    disabled={!selectedRow}
                  >
                    <option value="">None</option>
                    {WORKFLOW_PRESETS.map((preset) => (
                      <option key={preset.id} value={preset.id}>{preset.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-slate-500 mb-2">Workflow Stage</p>
                  <div className="flex flex-wrap gap-2">
                    {WORKFLOW_STAGES.map((stage, i) => {
                      const currentIndex = WORKFLOW_STAGES.indexOf(workflowStage);
                      const done = i < currentIndex;
                      const active = i === currentIndex;
                      return (
                        <button
                          key={stage}
                          onClick={() => selectedRow && setWorkflowStage(stage)}
                          disabled={!selectedRow}
                          className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all disabled:opacity-40 ${
                            active
                              ? "bg-accent text-white border-accent/30"
                              : done
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : "bg-white/[0.03] text-slate-500 border-white/10 hover:text-slate-300"
                          }`}
                        >
                          {done ? "✓ " : ""}{stage}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {presetId && (() => {
                  const preset = WORKFLOW_PRESETS.find((p) => p.id === presetId);
                  if (!preset) return null;
                  const currentStageIndex = WORKFLOW_STAGES.indexOf(workflowStage);
                  return (
                    <div className="shell-panel-soft rounded-2xl p-4 space-y-2">
                      <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-slate-500">{preset.name} — Steps</p>
                      <ol className="space-y-1.5 mt-1">
                        {preset.steps.map((step, index) => {
                          const stepStageIndex = preset.steps.length > 1
                            ? Math.round((index / (preset.steps.length - 1)) * (WORKFLOW_STAGES.length - 1))
                            : 0;
                          const done = currentStageIndex > stepStageIndex;
                          const active = currentStageIndex === stepStageIndex;
                          return (
                            <li key={step} className={`flex items-center gap-2 text-xs ${done ? "text-emerald-400" : active ? "text-white" : "text-slate-500"}`}>
                              <span className={`h-4 w-4 rounded-full border flex items-center justify-center shrink-0 text-[9px] ${done ? "border-emerald-500 bg-emerald-500/20" : active ? "border-accent bg-accent/20" : "border-white/20"}`}>
                                {done ? "✓" : active ? "▶" : ""}
                              </span>
                              {step}
                            </li>
                          );
                        })}
                      </ol>
                    </div>
                  );
                })()}

                <div className="flex flex-wrap gap-2 pt-1">
                  <button onClick={handleSave} disabled={!selectedRow || saving} className="btn-secondary">
                    {saving ? "Saving..." : "Save Stage"}
                  </button>
                </div>
                {saveMessage && <p className="text-sm text-slate-600">{saveMessage}</p>}
              </>
            )}

            {/* Collaboration tab */}
            {leftTab === "collaboration" && (
              <>
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-xs font-mono text-slate-500 uppercase tracking-wider mb-1.5">Review Status</label>
                    <select
                      className="w-full input-base"
                      value={collaborationStatus}
                      onChange={(event) => setCollaborationStatus(event.target.value)}
                      disabled={!selectedRow}
                    >
                      {COLLABORATION_STATUSES.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-slate-500 uppercase tracking-wider mb-1.5">Assignee</label>
                    <input
                      className="w-full input-base"
                      value={assignee}
                      onChange={(event) => setAssignee(event.target.value)}
                      placeholder="Owner or reviewer name"
                      disabled={!selectedRow}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-500 uppercase tracking-wider mb-2">Add Note</label>
                  <div className="flex gap-2">
                    <input
                      className="input-base w-28 shrink-0"
                      value={commentAuthor}
                      onChange={(event) => setCommentAuthor(event.target.value)}
                      placeholder="Author"
                      disabled={!selectedRow}
                    />
                    <input
                      className="input-base flex-1"
                      value={commentDraft}
                      onChange={(event) => setCommentDraft(event.target.value)}
                      placeholder="Note"
                      disabled={!selectedRow}
                    />
                    <button onClick={handleAddComment} className="btn-secondary shrink-0" disabled={!selectedRow}>
                      Add
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {comments.length === 0 && (
                    <p className="text-xs text-slate-500 py-4 text-center">No notes yet.</p>
                  )}
                  {comments.map((comment) => (
                    <div key={comment.id} className="rounded-2xl border border-border bg-white/[0.03] px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-semibold text-slate-800">{comment.author}</span>
                        <span className="text-[11px] text-slate-500">{formatDate(comment.created_at)}</span>
                      </div>
                      <p className="text-sm text-slate-700">{comment.message}</p>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <button onClick={handleSave} disabled={!selectedRow || saving} className="btn-secondary">
                    {saving ? "Saving..." : "Save"}
                  </button>
                </div>
                {saveMessage && <p className="text-sm text-slate-600">{saveMessage}</p>}
              </>
            )}
          </div>
        </div>

        <div className="shell-panel rounded-[2rem] p-5">
          {!selectedRow ? (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
              <TrendingUp className="w-10 h-10 opacity-30 text-slate-400" />
              <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-slate-500">No Draft Selected</p>
              <p className="text-sm text-slate-400 max-w-xs">Pick a saved history draft from the left panel to load its SEO score, checklist, and optimization guidance.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-slate-500">Selected Draft</p>
                <h2 className="text-2xl text-white mt-2" style={{ fontFamily: "var(--font-display)" }}>
                  {selectedRow.title}
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  {selectedRow.tool_name} · {selectedRow.word_count ?? "—"} words
                  {selectedRow.word_count ? ` · ${estimateReadingTime(selectedRow.word_count)}` : ""}
                </p>
              </div>

              <div className="shell-status-strip rounded-3xl p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-slate-500">SEO Score</p>
                    <div className={`mt-1 text-4xl font-bold ${analysis ? scoreColorClass(analysis.score) : "text-white"}`} style={{ fontFamily: "var(--font-display)" }}>
                      {analysis ? analysis.score : selectedRow.seo_score ?? "--"}
                    </div>
                  </div>
                  {analysis && (
                    <div className="text-right">
                      <span className={`text-sm font-semibold ${scoreColorClass(analysis.score)}`}>{scoreLabel(analysis.score)}</span>
                      <p className="text-xs text-slate-500 mt-1">{analysis.checks.filter((c) => c.passed).length}/{analysis.checks.length} checks passing</p>
                      {analysis.readabilityScore !== undefined && (
                        <p className="text-xs text-slate-500 mt-1">Readability: {analysis.readabilityScore}/100 — {analysis.readabilityGrade}</p>
                      )}
                    </div>
                  )}
                </div>
                {analysis && (
                  <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all ${scoreBgBarClass(analysis.score)}`}
                      style={{ width: `${analysis.score}%` }}
                    />
                  </div>
                )}
                <p className="text-xs text-slate-500">
                  {analysis?.analyzedAt ? `Last analyzed ${formatDate(analysis.analyzedAt)}` : "Run analysis to populate checklist recommendations."}
                </p>
              </div>

              {selectedRow && (
                <div className="shell-panel-soft rounded-3xl p-4 space-y-3">
                  <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-slate-500">SERP Preview</p>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Meta Description (for preview)</label>
                    <input
                      className="w-full input-base text-xs"
                      value={metaDescription}
                      onChange={(e) => setMetaDescription(e.target.value)}
                      placeholder="Enter your meta description to preview how it appears in Google…"
                      maxLength={160}
                    />
                    {metaDescription && (
                      <p className="text-[11px] text-slate-500 mt-1">{metaDescription.length}/160 characters</p>
                    )}
                  </div>
                  <div className="rounded-xl border border-border bg-white p-4 font-sans text-left">
                    <p className="text-xs text-emerald-700 truncate mb-0.5">techscribstudio.com › blog</p>
                    <p className="text-base text-blue-700 font-medium leading-snug hover:underline cursor-pointer truncate">
                      {selectedRow.title.length > 60 ? `${selectedRow.title.slice(0, 59)}…` : selectedRow.title}
                    </p>
                    {selectedRow.title.length > 60 && (
                      <p className="text-[11px] text-amber-600 mt-0.5">Title exceeds 60 characters — may be truncated in search results.</p>
                    )}
                    <p className="text-sm text-slate-600 mt-1 leading-snug">
                      {metaDescription
                        ? metaDescription.length > 160
                          ? `${metaDescription.slice(0, 157)}…`
                          : metaDescription
                        : <span className="text-slate-400 italic">No meta description set. Search engines will auto-generate one from your content.</span>}
                    </p>
                  </div>
                  <p className="text-[11px] text-slate-500">Use the <strong>Meta Description Generator</strong> and <strong>Meta Title Generator</strong> tools to craft optimized snippets.</p>
                </div>
              )}

              {analysis && (
                <div className="flex justify-end">
                  <button
                    onClick={handleCopyReport}
                    className="btn-secondary text-xs"
                  >
                    {copyLabel}
                  </button>
                </div>
              )}

              <div>
                <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-slate-500 mb-2">Checklist</p>
                {!analysis && (
                  <p className="text-xs text-slate-500">Run SEO analysis to generate checks and recommendations.</p>
                )}
                {analysis && analysis.checks.length === 0 && (
                  <p className="text-xs text-slate-500">No checklist items yet.</p>
                )}
                {analysis && analysis.checks.length > 0 && (() => {
                  const passing = analysis.checks.filter((c) => c.passed);
                  const failing = analysis.checks.filter((c) => !c.passed);
                  return (
                    <div className="space-y-4">
                      {failing.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[11px] font-mono text-amber-600 uppercase tracking-[0.16em]">⚠ Needs Work ({failing.length})</p>
                          {failing.map((check) => (
                            <div key={check.id} className="rounded-2xl border border-amber-200/40 px-3 py-2 bg-amber-50/5">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm text-slate-900">{check.label}</p>
                                <span className="text-xs font-mono text-amber-600 shrink-0">Needs work</span>
                              </div>
                              <p className="text-xs text-slate-600 mt-1">{check.detail}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      {passing.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[11px] font-mono text-emerald-500 uppercase tracking-[0.16em]">✓ Passing ({passing.length})</p>
                          {passing.map((check) => (
                            <div key={check.id} className="rounded-2xl border border-emerald-200/40 px-3 py-2 bg-emerald-50/5">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm text-slate-900">{check.label}</p>
                                <span className="text-xs font-mono text-emerald-500 shrink-0">Pass</span>
                              </div>
                              <p className="text-xs text-slate-600 mt-1">{check.detail}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default function SeoWorkspacePage() {
  return (
    <Suspense>
      <SeoWorkspacePageContent />
    </Suspense>
  );
}
