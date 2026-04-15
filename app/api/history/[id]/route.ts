import { NextRequest, NextResponse } from "next/server";
import { deleteHistory, getHistoryById, updateHistoryMetadata } from "@/lib/db";

export const runtime = "nodejs";

// DELETE /api/history/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
  const { id: rawId } = await params;
  const id = parseInt(rawId, 10);

  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const body = await req.json();
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

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const updated = updateHistoryMetadata(id, {
      title,
      folder_name: folderName || null,
      tags,
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
