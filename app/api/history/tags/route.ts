import { NextRequest, NextResponse } from "next/server";
import {
  deleteHistoryTag,
  listHistoryTags,
  mergeHistoryTags,
  renameHistoryTag,
} from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const tags = listHistoryTags();
    return NextResponse.json({ tags });
  } catch (error) {
    console.error("History tags GET error:", error);
    return NextResponse.json({ error: "Failed to load tags" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const action = String(body.action ?? "").trim();
    const tag = String(body.tag ?? "").trim();
    const targetTag = String(body.targetTag ?? "").trim();

    if (!tag) {
      return NextResponse.json({ error: "Tag is required" }, { status: 400 });
    }

    let updatedCount = 0;

    if (action === "rename") {
      if (!targetTag) {
        return NextResponse.json({ error: "New tag name is required" }, { status: 400 });
      }
      updatedCount = renameHistoryTag(tag, targetTag);
    } else if (action === "merge") {
      if (!targetTag) {
        return NextResponse.json({ error: "Target tag is required" }, { status: 400 });
      }
      updatedCount = mergeHistoryTags(tag, targetTag);
    } else if (action === "delete") {
      updatedCount = deleteHistoryTag(tag);
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({
      updatedCount,
      tags: listHistoryTags(),
    });
  } catch (error) {
    console.error("History tags PATCH error:", error);
    return NextResponse.json({ error: "Failed to update tags" }, { status: 500 });
  }
}
