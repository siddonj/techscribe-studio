"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

interface AutomationTemplate {
  id: number;
  name: string;
  description: string | null;
  jobs_json: string;
  created_at: string;
  updated_at: string;
}

interface AutomationRun {
  id: number;
  template_id: number | null;
  trigger_source: string;
  job_count: number;
  success_count: number;
  error_count: number;
  status: "success" | "partial" | "error";
  request_summary: string | null;
  results_json: string | null;
  started_at: string;
  finished_at: string | null;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getRunStatusClass(status: AutomationRun["status"]) {
  switch (status) {
    case "success":
      return "border-emerald-400/30 bg-emerald-400/10 text-emerald-300";
    case "partial":
      return "border-amber-400/30 bg-amber-400/10 text-amber-300";
    case "error":
      return "border-red-400/30 bg-red-400/10 text-red-300";
  }
}

export default function AutomationPage() {
  const inputClassName = "shell-input w-full rounded-2xl px-3.5 py-3 text-sm text-white placeholder-muted focus:outline-none transition-colors";
  const [templates, setTemplates] = useState<AutomationTemplate[]>([]);
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [jobsText, setJobsText] = useState(`[
  {
    "slug": "article-writer",
    "fields": {
      "topic": "Weekly DevOps roundup",
      "audience": "engineering leaders"
    },
    "save": true,
    "folder": "automation"
  }
]`);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchAutomation = useCallback(async () => {
    setLoading(true);
    try {
      const [templatesRes, runsRes] = await Promise.all([
        fetch("/api/automation/templates"),
        fetch("/api/automation/runs"),
      ]);

      if (!templatesRes.ok || !runsRes.ok) {
        throw new Error("Failed to load automation data");
      }

      const templatesData = await templatesRes.json() as { templates: AutomationTemplate[] };
      const runsData = await runsRes.json() as { runs: AutomationRun[] };
      setTemplates(templatesData.templates);
      setRuns(runsData.runs);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load automation data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAutomation();
  }, [fetchAutomation]);

  const parsedJobs = useMemo(() => {
    try {
      const parsed = JSON.parse(jobsText) as unknown;
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }, [jobsText]);

  async function handleSaveTemplate() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      if (!parsedJobs || parsedJobs.length === 0) {
        throw new Error("Jobs JSON must be a non-empty array");
      }

      const res = await fetch("/api/automation/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, jobs: parsedJobs }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create template");
      }

      setName("");
      setDescription("");
      setMessage("Automation template saved.");
      await fetchAutomation();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save template");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteTemplate(id: number) {
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(`/api/automation/templates/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete template");
      }
      setMessage("Automation template deleted.");
      await fetchAutomation();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete template");
    }
  }

  return (
    <div className="p-5 md:p-8 max-w-7xl mx-auto space-y-6">
      <section className="shell-panel rounded-[2rem] p-6 md:p-8">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
          <span>←</span>
          <span>Back to dashboard</span>
        </Link>
        <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.24em] text-accent">Automation</p>
        <h1 className="mt-3 text-3xl md:text-4xl text-white" style={{ fontFamily: "var(--font-display)" }}>
          Saved batch templates and run history
        </h1>
        <p className="mt-3 text-slate-400 max-w-3xl leading-relaxed">
          Store reusable batch payloads for external schedulers, then inspect the latest automation runs without digging through logs.
        </p>
      </section>

      {(error || message) && (
        <section className="space-y-2">
          {error && <div className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</div>}
          {message && <div className="text-green-300 text-sm bg-green-400/10 border border-green-400/20 rounded-lg px-3 py-2">{message}</div>}
        </section>
      )}

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="shell-panel rounded-[2rem] p-5 md:p-6 space-y-4">
          <div>
            <p className="font-mono text-xs text-accent uppercase tracking-widest">New Template</p>
            <p className="text-sm text-slate-400 mt-1">Save a reusable jobs array for cron, CI, or MCP-driven calls.</p>
          </div>
          <input className={inputClassName} value={name} onChange={(event) => setName(event.target.value)} placeholder="Weekly SEO batch" />
          <input className={inputClassName} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Optional description" />
          <textarea className={`${inputClassName} resize-none font-mono text-xs`} rows={14} value={jobsText} onChange={(event) => setJobsText(event.target.value)} />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">{parsedJobs ? `${parsedJobs.length} jobs parsed` : "Invalid JSON"}</p>
            <button onClick={handleSaveTemplate} disabled={saving || !name.trim() || !parsedJobs} className="bg-accent text-[#08100c] font-semibold px-4 py-2 rounded-2xl text-sm hover:bg-accent-dim transition-colors disabled:opacity-50">
              {saving ? "Saving..." : "Save Template"}
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="shell-panel rounded-[2rem] p-5 md:p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <p className="font-mono text-xs text-accent uppercase tracking-widest">Templates</p>
                <p className="text-sm text-slate-400 mt-1">Use template IDs with /api/generate/batch and a trigger_source label.</p>
              </div>
              <span className="text-xs text-slate-500">{templates.length} saved</span>
            </div>
            <div className="space-y-3">
              {!loading && templates.length === 0 && <p className="text-sm text-slate-500">No templates saved yet.</p>}
              {templates.map((template) => {
                let jobCount = 0;
                try {
                  const parsed = JSON.parse(template.jobs_json) as unknown[];
                  jobCount = Array.isArray(parsed) ? parsed.length : 0;
                } catch {
                  jobCount = 0;
                }
                return (
                  <div key={template.id} className="shell-panel-soft rounded-2xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-white font-medium">{template.name}</p>
                        {template.description && <p className="text-sm text-slate-400 mt-1">{template.description}</p>}
                      </div>
                      <button onClick={() => void handleDeleteTemplate(template.id)} className="text-xs text-red-300/80 hover:text-red-200 transition-colors">Delete</button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                      <span>Template #{template.id}</span>
                      <span>{jobCount} jobs</span>
                      <span>Updated {formatDate(template.updated_at)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="shell-panel rounded-[2rem] p-5 md:p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <p className="font-mono text-xs text-accent uppercase tracking-widest">Recent Runs</p>
                <p className="text-sm text-slate-400 mt-1">Logged automatically whenever the batch endpoint executes.</p>
              </div>
              <span className="text-xs text-slate-500">{runs.length} recent</span>
            </div>
            <div className="space-y-3">
              {!loading && runs.length === 0 && <p className="text-sm text-slate-500">No automation runs recorded yet.</p>}
              {runs.map((run) => (
                <div key={run.id} className="shell-panel-soft rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-white font-medium">Run #{run.id}</p>
                      <p className="text-sm text-slate-400 mt-1">{run.trigger_source} • {run.job_count} jobs • {run.success_count} success / {run.error_count} errors</p>
                    </div>
                    <span className={`text-[11px] font-mono border rounded-full px-2.5 py-1 ${getRunStatusClass(run.status)}`}>{run.status}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                    {run.template_id && <span>Template #{run.template_id}</span>}
                    <span>Started {formatDate(run.started_at)}</span>
                    {run.finished_at && <span>Finished {formatDate(run.finished_at)}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}