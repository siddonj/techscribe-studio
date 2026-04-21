import { NextRequest, NextResponse } from "next/server";
import { deleteHistory, getHistoryById, updateHistoryMetadata, updateHistoryOutput } from "@/lib/db";
import { requireApprovedSession } from "@/lib/auth";

export const runtime = "nodejs";

// DELETE /api/history/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApprovedSession();
  if ("error" in auth) return auth.error;

  const { id: rawId } = await params;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const deleted = deleteHistory(id);
  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}

// GET /api/history/[id] — fetch a single entry (for the full output view)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApprovedSession();
  if ("error" in auth) return auth.error;

  const { id: rawId } = await params;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const row = getHistoryById(id);
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(row);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApprovedSession();
  if ("error" in auth) return auth.error;

  const { id: rawId } = await params;
  const id = parseInt(rawId, 10);

  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const body = await req.json();

    // If only output is being updated, handle that separately
    if (body.output !== undefined && body.title === undefined) {
      const updated = updateHistoryOutput(id, String(body.output));
      if (!updated) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return NextResponse.json(updated);
    }

    const title = String(body.title ?? "").trim();
    const folderName = String(body.folder_name ?? "").trim();
    const tags = Array.isArray(body.tags)
      ? body.tags
          .map((tag: unknown) => String(tag).trim())
          .filter(Boolean)
          .join(",")
      : String(body.tags ?? "")
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean)
          .join(",");

    const wpSlug = String(body.wp_slug ?? "").trim() || null;
    const wpExcerpt = String(body.wp_excerpt ?? "").trim() || null;
    const wpCategories = String(body.wp_categories ?? "").trim() || null;
    const wpTags = String(body.wp_tags ?? "").trim() || null;
    const seoFocusKeyword = String(body.seo_focus_keyword ?? "").trim() || null;
    const seoScore = body.seo_score === undefined || body.seo_score === null
      ? null
      : Number.isFinite(Number(body.seo_score))
        ? Number(body.seo_score)
        : null;
    const seoChecklistItems = Array.isArray(body.seo_checklist_items)
      ? body.seo_checklist_items.map((item: unknown) => String(item).trim()).filter(Boolean)
      : [];
    const workflowStage = String(body.workflow_stage ?? "").trim() || null;
    const presetId = String(body.preset_id ?? "").trim() || null;
    const collaborationStatus = String(body.collaboration_status ?? "").trim() || null;
    const assignee = String(body.assignee ?? "").trim() || null;
    const collaborationComments = Array.isArray(body.collaboration_comments)
      ? body.collaboration_comments
          .map((comment: unknown) => {
            if (!comment || typeof comment !== "object") {
              return null;
            }

            const record = comment as Record<string, unknown>;
            const id = String(record.id ?? "").trim();
            const author = String(record.author ?? "").trim();
            const message = String(record.message ?? "").trim();
            const created_at = String(record.created_at ?? "").trim();

            if (!id || !author || !message || !created_at) {
              return null;
            }

            return { id, author, message, created_at };
          })
          .filter((comment: { id: string; author: string; message: string; created_at: string } | null): comment is { id: string; author: string; message: string; created_at: string } => Boolean(comment))
      : [];

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const updated = updateHistoryMetadata(id, {
      title,
      folder_name: folderName || null,
      tags,
      wp_slug: wpSlug,
      wp_excerpt: wpExcerpt,
      wp_categories: wpCategories,
      wp_tags: wpTags,
      seo_focus_keyword: seoFocusKeyword,
      seo_score: seoScore,
      seo_checklist_items: seoChecklistItems,
      workflow_stage: workflowStage,
      preset_id: presetId,
      collaboration_status: collaborationStatus,
      assignee,
      collaboration_comments: collaborationComments,
    });

    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("History PATCH error:", error);
    return NextResponse.json({ error: "Failed to update history entry" }, { status: 500 });
  }
}
