import { NextRequest, NextResponse } from "next/server";
import { countHistory, getCalendarEntryById, linkCalendarEntryToHistory, saveHistory, listHistory } from "@/lib/db";
import { getToolBySlug } from "@/lib/tools";

export const runtime = "nodejs";

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
  const { searchParams } = new URL(req.url);
  const toolSlug = searchParams.get("tool") ?? undefined;
  const folder = searchParams.get("folder")?.trim() || undefined;
  const tags = searchParams.getAll("tag").map((tag) => tag.trim()).filter(Boolean);
  const search = searchParams.get("q")?.trim() || undefined;
  const status = searchParams.get("status") ?? "all";
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
      status: status as "all" | "never-published" | "draft-linked" | "draft-updated",
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

    return NextResponse.json(entry, { status: 201 });
  } catch (err) {
    console.error("History POST error:", err);
    return NextResponse.json({ error: "Failed to save history" }, { status: 500 });
  }
}
