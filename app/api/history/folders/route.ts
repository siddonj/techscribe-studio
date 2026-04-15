import { NextRequest, NextResponse } from "next/server";
import {
  deleteHistoryFolder,
  listHistoryFolders,
  mergeHistoryFolders,
  renameHistoryFolder,
} from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const folders = listHistoryFolders();
    return NextResponse.json({ folders });
  } catch (error) {
    console.error("History folders GET error:", error);
    return NextResponse.json({ error: "Failed to load folders" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const action = String(body.action ?? "").trim();
    const folder = String(body.folder ?? "").trim();
    const targetFolder = String(body.targetFolder ?? "").trim();

    if (!folder) {
      return NextResponse.json({ error: "Folder is required" }, { status: 400 });
    }

    let updatedCount = 0;

    if (action === "rename") {
      if (!targetFolder) {
        return NextResponse.json({ error: "New folder name is required" }, { status: 400 });
      }
      updatedCount = renameHistoryFolder(folder, targetFolder);
    } else if (action === "merge") {
      if (!targetFolder) {
        return NextResponse.json({ error: "Target folder is required" }, { status: 400 });
      }
      updatedCount = mergeHistoryFolders(folder, targetFolder);
    } else if (action === "delete") {
      updatedCount = deleteHistoryFolder(folder);
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({
      updatedCount,
      folders: listHistoryFolders(),
    });
  } catch (error) {
    console.error("History folders PATCH error:", error);
    return NextResponse.json({ error: "Failed to update folders" }, { status: 500 });
  }
}