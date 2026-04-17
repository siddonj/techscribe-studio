import { NextRequest, NextResponse } from "next/server";
import { deleteAutomationTemplate } from "@/lib/db";

export const runtime = "nodejs";

function parseId(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await params;
    const id = parseId(rawId);
    if (!id) {
      return NextResponse.json({ error: "Invalid template id" }, { status: 400 });
    }

    const deleted = deleteAutomationTemplate(id);
    if (!deleted) {
      return NextResponse.json({ error: "Automation template not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Automation template DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete automation template" }, { status: 500 });
  }
}