/**
 * Batch generation API endpoint.
 *
 * Accepts an array of generation requests and processes each one sequentially,
 * returning a JSON array of results. This endpoint is designed to be called by
 * external schedulers (cron jobs, GitHub Actions, CI pipelines, etc.) to
 * support automated content generation workflows.
 *
 * Request body:
 * ```json
 * {
 *   "jobs": [
 *     {
 *       "slug": "article-writer",
 *       "fields": { "topic": "...", "tone": "Informative" },
 *       "save": true,
 *       "calendar_id": 42,
 *       "folder": "automation",
 *       "tags": ["auto", "weekly"]
 *     },
 *     { "slug": "meta-title", "fields": { "topic": "...", "keyword": "..." } }
 *   ]
 * }
 * ```
 *
 * Per-job optional fields:
 * - `save` (boolean, default false) — when true, the generated output is
 *   persisted to the history database and `history_id` is returned in the result.
 * - `calendar_id` (number) — when provided alongside `save: true`, links the
 *   saved history entry back to the specified content calendar item and advances
 *   its status from `planned`/`backlog` to `in-progress`.
 * - `folder` (string) — assigns the saved history entry to the named folder.
 * - `tags` (string[]) — assigns the given tags to the saved history entry.
 *
 * Response (200 OK):
 * ```json
 * {
 *   "results": [
 *     { "slug": "article-writer", "status": "success", "output": "...", "history_id": 7 },
 *     { "slug": "meta-title", "status": "error", "error": "Tool not found" }
 *   ]
 * }
 * ```
 *
 * Each job result includes `status: "success"` with the full generated `output`,
 * or `status: "error"` with an `error` message. A per-job failure does not
 * abort remaining jobs — all jobs are always attempted.
 *
 * Authentication: Requests must include the `BATCH_API_SECRET` environment
 * variable value as a Bearer token in the `Authorization` header when that
 * variable is set. If `BATCH_API_SECRET` is not configured the endpoint is
 * disabled and returns 503.
 *
 * Rate / safety: The endpoint caps batch size at MAX_BATCH_SIZE jobs to
 * prevent accidental runaway API usage.
 */

import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { getToolBySlug } from "@/lib/tools";
import { rateLimit, getRequestIp } from "@/lib/rate-limit";
import {
  createAutomationRun,
  getAutomationTemplateById,
  saveHistory,
  linkCalendarEntryToHistory,
  getCalendarEntryById,
} from "@/lib/db";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MAX_BATCH_SIZE = 20;

interface BatchJob {
  slug: string;
  fields: Record<string, string>;
  /** When true, persist the generated output to the history database. */
  save?: boolean;
  /**
   * Content calendar entry ID to link after saving. Only used when `save` is
   * true. Advances the calendar item from `planned`/`backlog` to `in-progress`
   * and associates the new history entry with it.
   */
  calendar_id?: number;
  /** Folder name to assign to the saved history entry. */
  folder?: string;
  /** Tags to assign to the saved history entry. */
  tags?: string[];
}

interface BatchRequestBody {
  jobs?: unknown[];
  template_id?: number;
  trigger_source?: string;
}

interface BatchJobResult {
  slug: string;
  status: "success" | "error";
  output?: string;
  /** History row ID when the job was saved (`save: true`). */
  history_id?: number;
  error?: string;
}

/** Validates that a raw request job value has the required shape and returns it as a typed BatchJob. */
function parseJob(raw: unknown, index: number): { job: BatchJob } | { error: string } {
  if (
    typeof raw !== "object" ||
    raw === null ||
    typeof (raw as Record<string, unknown>).slug !== "string" ||
    typeof (raw as Record<string, unknown>).fields !== "object" ||
    (raw as Record<string, unknown>).fields === null ||
    Array.isArray((raw as Record<string, unknown>).fields)
  ) {
    return { error: `Job at index ${index} must have a string "slug" and an object "fields"` };
  }

  const r = raw as Record<string, unknown>;

  if (r.save !== undefined && typeof r.save !== "boolean") {
    return { error: `Job at index ${index}: "save" must be a boolean` };
  }

  if (r.calendar_id !== undefined && typeof r.calendar_id !== "number") {
    return { error: `Job at index ${index}: "calendar_id" must be a number` };
  }

  if (r.folder !== undefined && typeof r.folder !== "string") {
    return { error: `Job at index ${index}: "folder" must be a string` };
  }

  if (
    r.tags !== undefined &&
    (!Array.isArray(r.tags) || (r.tags as unknown[]).some((t) => typeof t !== "string"))
  ) {
    return { error: `Job at index ${index}: "tags" must be an array of strings` };
  }

  return {
    job: {
      slug: r.slug as string,
      fields: r.fields as Record<string, string>,
      save: r.save as boolean | undefined,
      calendar_id: r.calendar_id as number | undefined,
      folder: r.folder as string | undefined,
      tags: r.tags as string[] | undefined,
    },
  };
}

/** Build the user prompt for a single-step tool generation. */
function buildPrompt(template: string, fields: Record<string, string>): string {
  let prompt = template;
  for (const [key, value] of Object.entries(fields)) {
    prompt = prompt.replaceAll(`{${key}}`, String(value ?? ""));
  }
  return prompt;
}

/** Generate content for a single job, collecting the full streamed output. */
async function runJob(job: BatchJob): Promise<BatchJobResult> {
  const { slug, fields } = job;

  const tool = getToolBySlug(slug);
  if (!tool) {
    return { slug, status: "error", error: "Tool not found" };
  }

  const systemPrompt = tool.systemPrompt;
  const userPrompt = buildPrompt(tool.userPromptTemplate, fields);

  try {
    const stream = await client.messages.stream({
      model: "claude-opus-4-5",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    let output = "";
    for await (const chunk of stream) {
      if (
        chunk.type === "content_block_delta" &&
        chunk.delta.type === "text_delta"
      ) {
        output += chunk.delta.text;
      }
    }

    // Persist to history when requested.
    if (job.save) {
      const title =
        (fields.topic as string) ||
        (fields.subject as string) ||
        (fields.headline as string) ||
        (fields.keyword as string) ||
        (fields.videoTitle as string) ||
        "Untitled";

      // Inherit wp_categories / wp_tags from a linked calendar entry when present.
      const linkedCalendar =
        typeof job.calendar_id === "number"
          ? getCalendarEntryById(job.calendar_id)
          : undefined;

      const tags =
        Array.isArray(job.tags) && job.tags.length > 0
          ? job.tags.map((t) => t.trim()).filter(Boolean).join(",")
          : null;

      const entry = saveHistory({
        tool_slug: tool.slug,
        tool_name: tool.name,
        tool_icon: tool.icon,
        category: tool.category,
        title: String(title).slice(0, 200),
        fields: JSON.stringify(fields),
        output,
        word_count: output.trim().split(/\s+/).length,
        created_at: new Date().toISOString(),
        wp_post_id: null,
        wp_status: null,
        wp_url: null,
        wp_last_published_at: null,
        wp_last_sync_action: null,
        folder_name: job.folder?.trim() || null,
        tags,
        wp_publish_state: null,
        wp_error_message: null,
        wp_slug: null,
        wp_excerpt: null,
        wp_categories: linkedCalendar?.wp_category ?? null,
        wp_tags: linkedCalendar?.wp_tags ?? null,
      });

      if (typeof job.calendar_id === "number") {
        linkCalendarEntryToHistory(job.calendar_id, entry.id);
      }

      return { slug, status: "success", output, history_id: entry.id };
    }

    return { slug, status: "success", output };
  } catch (err) {
    return { slug, status: "error", error: String(err) };
  }
}

export async function POST(req: NextRequest) {
  const ip = getRequestIp(req.headers);
  if (!rateLimit(`batch:${ip}`, 10, 5 * 60_000)) {
    return NextResponse.json(
      { error: "Too many batch requests. Limit is 10 per 5 minutes." },
      { status: 429, headers: { "Retry-After": "300" } }
    );
  }

  // Require BATCH_API_SECRET to be configured; disable endpoint if not set.
  const secret = process.env.BATCH_API_SECRET;
  if (!secret) {
    return NextResponse.json(
      {
        error:
          "Batch generation is disabled. Set the BATCH_API_SECRET environment variable to enable it.",
      },
      { status: 503 }
    );
  }

  // Validate Bearer token.
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (token !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: BatchRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let rawJobs = body.jobs;
  let templateId: number | null = null;
  if (!rawJobs && typeof body.template_id === "number") {
    const template = getAutomationTemplateById(body.template_id);
    if (!template) {
      return NextResponse.json({ error: "Automation template not found" }, { status: 404 });
    }

    try {
      const parsedJobs = JSON.parse(template.jobs_json) as unknown;
      if (!Array.isArray(parsedJobs)) {
        return NextResponse.json({ error: "Saved automation template has invalid jobs payload" }, { status: 500 });
      }
      rawJobs = parsedJobs;
      templateId = template.id;
    } catch {
      return NextResponse.json({ error: "Saved automation template could not be parsed" }, { status: 500 });
    }
  }

  if (!Array.isArray(rawJobs) || rawJobs.length === 0) {
    return NextResponse.json(
      { error: "Request body must include a non-empty `jobs` array" },
      { status: 400 }
    );
  }

  if (rawJobs.length > MAX_BATCH_SIZE) {
    return NextResponse.json(
      {
        error: `Batch size exceeds the maximum of ${MAX_BATCH_SIZE} jobs per request`,
      },
      { status: 400 }
    );
  }

  // Validate each job has required shape.
  const jobs: BatchJob[] = [];
  for (let i = 0; i < rawJobs.length; i++) {
    const parsed = parseJob(rawJobs[i], i);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    jobs.push(parsed.job);
  }

  const startedAt = new Date().toISOString();
  // Process jobs sequentially to avoid overwhelming the upstream API.
  const results: BatchJobResult[] = [];
  for (const job of jobs) {
    const result = await runJob(job);
    results.push(result);
  }

  const successCount = results.filter((result) => result.status === "success").length;
  const errorCount = results.length - successCount;
  const status = errorCount === 0 ? "success" : successCount === 0 ? "error" : "partial";

  const run = createAutomationRun({
    template_id: templateId,
    trigger_source: String(body.trigger_source ?? (templateId ? "template" : "manual")).slice(0, 80),
    job_count: jobs.length,
    success_count: successCount,
    error_count: errorCount,
    status,
    request_summary: JSON.stringify({ slugs: jobs.map((job) => job.slug) }),
    results_json: JSON.stringify(results),
    started_at: startedAt,
    finished_at: new Date().toISOString(),
  });

  return NextResponse.json({ results, run });
}
