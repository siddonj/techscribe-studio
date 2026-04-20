"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
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
  analyzedAt: string;
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

  return (
    <div className="p-5 md:p-8 max-w-7xl mx-auto space-y-6">
      <PageHeader
        eyebrow="Optimization"
        title="SEO Workspace"
        description="Run a unified SEO scoring pass, apply guided workflow metadata, and keep review ownership visible on each draft."
        stats={[
          { label: "Analyzable Drafts", value: rows.length, meta: "history entries" },
          { label: "Workflow Presets", value: WORKFLOW_PRESETS.length, meta: "guided flows" },
          { label: "Focus", value: selectedRow ? "Active" : "Idle", meta: "workspace state" },
        ]}
      />

      <StatusStrip
        items={[
          { label: "Selected Draft", value: selectedRow ? `#${selectedRow.id}` : "None" },
          { label: "SEO Score", value: analysis ? analysis.score : "Not scored" },
          { label: "Workflow Stage", value: workflowStage },
          { label: "Review Status", value: collaborationStatus },
          { label: "Assignee", value: assignee || "Unassigned" },
        ]}
      />

      <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="shell-panel rounded-[2rem] p-5 space-y-4">
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
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-slate-500 mb-2">Workflow Stage</p>
              <select
                className="w-full input-base"
                value={workflowStage}
                onChange={(event) => setWorkflowStage(event.target.value)}
                disabled={!selectedRow}
              >
                {WORKFLOW_STAGES.map((stage) => (
                  <option key={stage} value={stage}>
                    {stage}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="shell-panel-soft rounded-3xl p-4 space-y-3">
            <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-slate-500">Collaboration</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Review Status</label>
                <select
                  className="w-full input-base"
                  value={collaborationStatus}
                  onChange={(event) => setCollaborationStatus(event.target.value)}
                  disabled={!selectedRow}
                >
                  {COLLABORATION_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Assignee</label>
                <input
                  className="w-full input-base"
                  value={assignee}
                  onChange={(event) => setAssignee(event.target.value)}
                  placeholder="Owner or reviewer name"
                  disabled={!selectedRow}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[0.3fr_0.7fr_auto] gap-2">
              <input
                className="input-base"
                value={commentAuthor}
                onChange={(event) => setCommentAuthor(event.target.value)}
                placeholder="Author"
                disabled={!selectedRow}
              />
              <input
                className="input-base"
                value={commentDraft}
                onChange={(event) => setCommentDraft(event.target.value)}
                placeholder="Add collaboration note"
                disabled={!selectedRow}
              />
              <button
                onClick={handleAddComment}
                className="btn-secondary"
                disabled={!selectedRow}
              >
                Add
              </button>
            </div>

            <div className="space-y-2 max-h-40 overflow-y-auto">
              {comments.length === 0 && <p className="text-xs text-slate-500">No comments yet.</p>}
              {comments.map((comment) => (
                <div key={comment.id} className="rounded-2xl border border-border bg-white/[0.04] px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-900">{comment.author}</span>
                    <span className="text-[11px] text-slate-500">{formatDate(comment.created_at)}</span>
                  </div>
                  <p className="text-sm text-slate-700 mt-1">{comment.message}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={handleAnalyze} disabled={!selectedRow || analyzing} className="btn-primary">
              {analyzing ? "Analyzing..." : "Run SEO Analysis"}
            </button>
            <button onClick={handleSave} disabled={!selectedRow || saving} className="btn-secondary">
              {saving ? "Saving..." : "Save Metadata"}
            </button>
          </div>
          {saveMessage && <p className="text-sm text-slate-600">{saveMessage}</p>}
        </div>

        <div className="shell-panel rounded-[2rem] p-5">
          {!selectedRow ? (
            <p className="text-slate-500 text-sm">Select a draft to view score, checklist, and optimization guidance.</p>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-slate-500">Selected Draft</p>
                <h2 className="text-2xl text-white mt-2" style={{ fontFamily: "var(--font-display)" }}>
                  {selectedRow.title}
                </h2>
                <p className="text-sm text-slate-400 mt-2">
                  {selectedRow.tool_name} · {selectedRow.word_count} words
                </p>
              </div>

              <div className="shell-status-strip rounded-3xl p-4">
                <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-slate-500">SEO Score</p>
                <div className="mt-2 text-4xl text-white" style={{ fontFamily: "var(--font-display)" }}>
                  {analysis ? analysis.score : selectedRow.seo_score ?? "--"}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {analysis?.analyzedAt ? `Last analyzed ${formatDate(analysis.analyzedAt)}` : "Run analysis to populate checklist recommendations."}
                </p>
              </div>

              <div>
                <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-slate-500 mb-2">Checklist</p>
                <div className="space-y-2">
                  {(analysis?.checks ?? []).map((check) => (
                    <div key={check.id} className="rounded-2xl border border-border px-3 py-2 bg-white/[0.03]">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm text-slate-900">{check.label}</p>
                        <span className={`text-xs font-mono ${check.passed ? "text-emerald-500" : "text-amber-600"}`}>
                          {check.passed ? "Pass" : "Needs work"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">{check.detail}</p>
                    </div>
                  ))}
                  {analysis && analysis.checks.length === 0 && (
                    <p className="text-xs text-slate-500">No checklist items yet.</p>
                  )}
                  {!analysis && (
                    <p className="text-xs text-slate-500">Run SEO analysis to generate checks and recommendations.</p>
                  )}
                </div>
              </div>

              {analysis && analysis.suggestions.length > 0 && (
                <div>
                  <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-slate-500 mb-2">Suggestions</p>
                  <ul className="space-y-1">
                    {analysis.suggestions.map((suggestion, index) => (
                      <li key={`${suggestion}-${index}`} className="text-sm text-slate-700">
                        • {suggestion}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
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
