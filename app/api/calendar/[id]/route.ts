import { NextRequest, NextResponse } from "next/server";
import {
  deleteCalendarEntry,
  getCalendarEntryById,
  normalizeCalendarApprovalStatus,
  normalizeCalendarPublishIntent,
  updateCalendarEntry,
} from "@/lib/db";
import { type CalendarChecklistItem, isCalendarApprovalStatus, isCalendarPublishIntent, isCalendarStatus } from "@/lib/calendar";
import { getToolBySlug } from "@/lib/tools";
import { requireApprovedSession } from "@/lib/auth";

export const runtime = "nodejs";

function normalizeOptionalString(value: unknown) {
  const nextValue = String(value ?? "").trim();
  return nextValue ? nextValue : null;
}

function normalizeChecklistItems(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (typeof item === "string") {
        const text = item.trim();
        return text ? { text, completed: false } : null;
      }

      if (typeof item === "object" && item !== null) {
        const record = item as Record<string, unknown>;
        const text = String(record.text ?? "").trim();
        if (!text) {
          return null;
        }

        return { text, completed: Boolean(record.completed) };
      }

      return null;
    })
    .filter((item): item is CalendarChecklistItem => Boolean(item));
}

function parseId(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApprovedSession();
  if ("error" in auth) return auth.error;

  try {
    const { id: rawId } = await params;
    const id = parseId(rawId);
    if (!id) {
      return NextResponse.json({ error: "Invalid calendar entry id" }, { status: 400 });
    }

    const existing = getCalendarEntryById(id);
    if (!existing) {
      return NextResponse.json({ error: "Calendar entry not found" }, { status: 404 });
    }

    const body = await req.json() as Record<string, unknown>;
    const title = String(body.title ?? "").trim();
    const toolSlug = String(body.tool_slug ?? "").trim();
    const statusValue = String(body.status ?? existing.status).trim();
    const publishIntent = String(body.publish_intent ?? existing.publish_intent).trim();
    const approvalStatus = String(body.approval_status ?? existing.approval_status).trim();

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

    if (!isCalendarApprovalStatus(approvalStatus)) {
      return NextResponse.json({ error: "Invalid approval status" }, { status: 400 });
    }

    const updated = updateCalendarEntry(id, {
      title,
      tool_slug: toolSlug,
      status: statusValue,
      scheduled_for: normalizeOptionalString(body.scheduled_for),
      review_due_at: normalizeOptionalString(body.review_due_at),
      brief: normalizeOptionalString(body.brief),
      keywords: normalizeOptionalString(body.keywords),
      audience: normalizeOptionalString(body.audience),
      notes: normalizeOptionalString(body.notes),
      checklist_items: normalizeChecklistItems(body.checklist_items),
      owner: normalizeOptionalString(body.owner),
      reviewer: normalizeOptionalString(body.reviewer),
      approval_status: normalizeCalendarApprovalStatus(approvalStatus),
      blocked_reason: approvalStatus === "blocked" ? normalizeOptionalString(body.blocked_reason) : null,
      wp_category: normalizeOptionalString(body.wp_category),
      wp_tags: normalizeOptionalString(body.wp_tags),
      publish_intent: normalizeCalendarPublishIntent(publishIntent),
      history_id: typeof body.history_id === "number" ? body.history_id : null,
      wp_post_id: typeof body.wp_post_id === "number" ? body.wp_post_id : null,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Calendar PATCH error:", error);
    return NextResponse.json({ error: "Failed to update calendar entry" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApprovedSession();
  if ("error" in auth) return auth.error;

  try {
    const { id: rawId } = await params;
    const id = parseId(rawId);
    if (!id) {
      return NextResponse.json({ error: "Invalid calendar entry id" }, { status: 400 });
    }

    const deleted = deleteCalendarEntry(id);
    if (!deleted) {
      return NextResponse.json({ error: "Calendar entry not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Calendar DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete calendar entry" }, { status: 500 });
  }
}
