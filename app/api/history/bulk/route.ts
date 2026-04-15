import { NextRequest, NextResponse } from "next/server";
import { bulkAssignHistoryMetadata } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const ids = Array.isArray(body.ids)
      ? body.ids
          .map((id: unknown) => Number(id))
          .filter((id: number) => Number.isInteger(id) && id > 0)
      : [];

    if (ids.length === 0) {
      return NextResponse.json({ error: "At least one valid id is required" }, { status: 400 });
    }

    const folderName = body.folder_name === undefined ? undefined : String(body.folder_name ?? "").trim();
    const clearFolder = Boolean(body.clear_folder);
    const appendTags = Array.isArray(body.append_tags)
      ? body.append_tags.map((tag: unknown) => String(tag).trim()).filter(Boolean)
      : String(body.append_tags ?? "")
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean);

    const updated = bulkAssignHistoryMetadata(ids, {
      folder_name: folderName === undefined ? undefined : folderName || null,
      clear_folder: clearFolder,
      append_tags: appendTags,
    });

    return NextResponse.json({ rows: updated, count: updated.length });
  } catch (error) {
    console.error("History bulk PATCH error:", error);
    return NextResponse.json({ error: "Failed to update selected history entries" }, { status: 500 });
  }
}