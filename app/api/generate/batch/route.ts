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
 *     { "slug": "article-writer", "fields": { "topic": "...", "tone": "Informative" } },
 *     { "slug": "meta-title", "fields": { "topic": "...", "keyword": "..." } }
 *   ]
 * }
 * ```
 *
 * Response (200 OK):
 * ```json
 * {
 *   "results": [
 *     { "slug": "article-writer", "status": "success", "output": "..." },
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

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MAX_BATCH_SIZE = 20;

interface BatchJob {
  slug: string;
  fields: Record<string, string>;
}

interface BatchJobResult {
  slug: string;
  status: "success" | "error";
  output?: string;
  error?: string;
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

    return { slug, status: "success", output };
  } catch (err) {
    return { slug, status: "error", error: String(err) };
  }
}

export async function POST(req: NextRequest) {
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

  let body: { jobs?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.jobs) || body.jobs.length === 0) {
    return NextResponse.json(
      { error: "Request body must include a non-empty `jobs` array" },
      { status: 400 }
    );
  }

  if (body.jobs.length > MAX_BATCH_SIZE) {
    return NextResponse.json(
      {
        error: `Batch size exceeds the maximum of ${MAX_BATCH_SIZE} jobs per request`,
      },
      { status: 400 }
    );
  }

  // Validate each job has required shape.
  const jobs: BatchJob[] = [];
  for (let i = 0; i < body.jobs.length; i++) {
    const job = body.jobs[i];
    if (
      typeof job !== "object" ||
      job === null ||
      typeof (job as Record<string, unknown>).slug !== "string" ||
      typeof (job as Record<string, unknown>).fields !== "object" ||
      (job as Record<string, unknown>).fields === null ||
      Array.isArray((job as Record<string, unknown>).fields)
    ) {
      return NextResponse.json(
        {
          error: `Job at index ${i} must have a string "slug" and an object "fields"`,
        },
        { status: 400 }
      );
    }
    jobs.push(job as BatchJob);
  }

  // Process jobs sequentially to avoid overwhelming the upstream API.
  const results: BatchJobResult[] = [];
  for (const job of jobs) {
    const result = await runJob(job);
    results.push(result);
  }

  return NextResponse.json({ results });
}
