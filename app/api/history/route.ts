import { NextRequest, NextResponse } from "next/server";
import { countHistory, getCalendarEntryById, linkCalendarEntryToHistory, saveHistory, listHistory, type HistoryRow } from "@/lib/db";
import { getToolBySlug } from "@/lib/tools";
import { requireApprovedSession } from "@/lib/auth";

export const runtime = "nodejs";

const STOP_WORDS = new Set(["a","an","the","and","or","but","in","on","at","to","for","of","with","by","from","is","are","was","were","be","been","has","have","had","do","does","did","will","would","could","should","may","might","i","you","he","she","it","we","they","this","that","these","those","how","what","when","where","why","which","who","about","like","just","not","can","get","use","make","into"]);

function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s,;|/\\+\-–—]+/)
    .map((w) => w.replace(/[^a-z0-9]/g, ""))
    .filter((w) => w.length > 3 && !STOP_WORDS.has(w));
}

function checkCannibalization(
  title: string,
  keywords: string,
  excludeId: number
): Array<{ id: number; title: string }> | null {
  try {
    const newKeywords = new Set([...extractKeywords(title), ...extractKeywords(keywords)]);
    if (newKeywords.size === 0) return null;

    // Search recent history for any entry whose title shares 2+ significant keywords
    const recent = listHistory(200, {}, 0) as HistoryRow[];
    const matches: Array<{ id: number; title: string }> = [];

    for (const row of recent) {
      if (row.id === excludeId) continue;
      const rowKeywords = new Set([
        ...extractKeywords(row.title),
        ...extractKeywords(JSON.parse(row.fields as string)?.keywords ?? ""),
      ]);
      const overlap = [...newKeywords].filter((kw) => rowKeywords.has(kw));
      if (overlap.length >= 2) {
        matches.push({ id: row.id, title: row.title });
      }
    }

    return matches.length > 0 ? matches.slice(0, 3) : null;
  } catch {
    return null;
  }
}

function toIsoStart(date: string | null) {
  if (!date) return undefined;
  return `${date}T00:00:00.000Z`;
}

function toIsoExclusiveEnd(date: string | null) {
  if (!date) return undefined;
  const nextDay = new Date(`${date}T00:00:00.000Z`);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  return nextDay.toISOString();
}

// GET /api/history — list saved generations
export async function GET(req: NextRequest) {
  const auth = await requireApprovedSession();
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const toolSlug = searchParams.get("tool") ?? undefined;
  const folder = searchParams.get("folder")?.trim() || undefined;
  const tags = searchParams.getAll("tag").map((tag) => tag.trim()).filter(Boolean);
  const search = searchParams.get("q")?.trim() || undefined;
  const status = searchParams.get("status") ?? "all";
  const collaborationStatus = searchParams.get("collaborationStatus")?.trim() || undefined;
  const assignee = searchParams.get("assignee")?.trim() || undefined;
  const sortBy = searchParams.get("sort") ?? "newest";
  const dateFrom = toIsoStart(searchParams.get("dateFrom"));
  const dateTo = toIsoExclusiveEnd(searchParams.get("dateTo"));
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "100", 10), 500);
  const offset = Math.max(parseInt(searchParams.get("offset") ?? "0", 10), 0);

  try {
    const query = {
      toolSlug,
      folder,
      tags,
      search,
      status: status as "all" | "never-published" | "draft-linked" | "draft-updated" | "publish-failed" | "published-live" | "seo-scored",
      collaborationStatus,
      assignee,
      dateFrom,
      dateTo,
      sortBy: sortBy as "newest" | "oldest" | "title-az" | "title-za",
    };

    const rows = listHistory(limit, query, offset);
    const total = countHistory(query);
    return NextResponse.json({
      rows,
      total,
      offset,
      limit,
      hasMore: offset + rows.length < total,
    });
  } catch (err) {
    console.error("History GET error:", err);
    return NextResponse.json({ error: "Failed to load history" }, { status: 500 });
  }
}

// POST /api/history — save a generation
export async function POST(req: NextRequest) {
  const auth = await requireApprovedSession();
  if ("error" in auth) return auth.error;

  try {
    const body = await req.json();
    const { slug, fields, output, calendarId } = body;

    if (!slug || !fields || !output) {
      return NextResponse.json({ error: "Missing slug, fields, or output" }, { status: 400 });
    }

    const tool = getToolBySlug(slug);
    if (!tool) {
      return NextResponse.json({ error: "Tool not found" }, { status: 404 });
    }

    // Derive a human-readable title from the most relevant field
    const title =
      (fields.topic as string) ||
      (fields.subject as string) ||
      (fields.headline as string) ||
      (fields.keyword as string) ||
      (fields.videoTitle as string) ||
      "Untitled";

    // Carry over publish metadata from a linked calendar entry so that the
    // history row inherits the pre-planned wp_category / wp_tags reference values.
    const linkedCalendar = typeof calendarId === "number" ? getCalendarEntryById(calendarId) : undefined;

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
      folder_name: null,
      tags: "",
      wp_publish_state: null,
      wp_error_message: null,
      wp_slug: null,
      wp_excerpt: null,
      wp_categories: linkedCalendar?.wp_category ?? null,
      wp_tags: linkedCalendar?.wp_tags ?? null,
    });

    if (typeof calendarId === "number") {
      linkCalendarEntryToHistory(calendarId, entry.id);
    }

    // Cannibalization check: find existing history entries that share keywords/topic
    const cannibalizationWarning = checkCannibalization(
      String(title),
      String(fields.keywords ?? fields.keyword ?? fields.seedKeyword ?? ""),
      entry.id
    );

    return NextResponse.json({ ...entry, cannibalizationWarning }, { status: 201 });
  } catch (err) {
    console.error("History POST error:", err);
    return NextResponse.json({ error: "Failed to save history" }, { status: 500 });
  }
}
