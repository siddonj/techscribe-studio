import { NextRequest, NextResponse } from "next/server";
import {
  createCalendarEntry,
  getCalendarSummary,
  listCalendarEntries,
  normalizeCalendarPublishIntent,
} from "@/lib/db";
import { isCalendarPublishIntent, isCalendarStatus } from "@/lib/calendar";
import { getToolBySlug } from "@/lib/tools";

export const runtime = "nodejs";

function normalizeOptionalString(value: unknown) {
  const nextValue = String(value ?? "").trim();
  return nextValue ? nextValue : null;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get("status")?.trim() ?? "";
    const toolSlug = searchParams.get("tool")?.trim() || undefined;
    const scheduledFrom = searchParams.get("from")?.trim() || undefined;
    const scheduledTo = searchParams.get("to")?.trim() || undefined;

    const rows = listCalendarEntries({
      status: isCalendarStatus(statusParam) ? statusParam : undefined,
      toolSlug,
      scheduledFrom,
      scheduledTo,
    });

    return NextResponse.json({
      rows,
      summary: getCalendarSummary(),
    });
  } catch (error) {
    console.error("Calendar GET error:", error);
    return NextResponse.json({ error: "Failed to load calendar" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>;
    const title = String(body.title ?? "").trim();
    const toolSlug = String(body.tool_slug ?? "").trim();
    const statusValue = String(body.status ?? "planned").trim();
    const publishIntent = String(body.publish_intent ?? "draft").trim();

    if (!title || !toolSlug) {
      return NextResponse.json({ error: "Title and tool are required" }, { status: 400 });
    }

    if (!getToolBySlug(toolSlug)) {
      return NextResponse.json({ error: "Tool not found" }, { status: 404 });
    }

    if (!isCalendarStatus(statusValue)) {
      return NextResponse.json({ error: "Invalid calendar status" }, { status: 400 });
    }

    if (!isCalendarPublishIntent(publishIntent)) {
      return NextResponse.json({ error: "Invalid publish intent" }, { status: 400 });
    }

    const entry = createCalendarEntry({
      title,
      tool_slug: toolSlug,
      status: statusValue,
      scheduled_for: normalizeOptionalString(body.scheduled_for),
      brief: normalizeOptionalString(body.brief),
      keywords: normalizeOptionalString(body.keywords),
      audience: normalizeOptionalString(body.audience),
      notes: normalizeOptionalString(body.notes),
      wp_category: normalizeOptionalString(body.wp_category),
      wp_tags: normalizeOptionalString(body.wp_tags),
      publish_intent: normalizeCalendarPublishIntent(publishIntent),
      history_id: typeof body.history_id === "number" ? body.history_id : null,
      wp_post_id: typeof body.wp_post_id === "number" ? body.wp_post_id : null,
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    console.error("Calendar POST error:", error);
    return NextResponse.json({ error: "Failed to create calendar entry" }, { status: 500 });
  }
}
