import { NextResponse } from "next/server";
import { listAutomationRuns } from "@/lib/db";
import { requireApprovedSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireApprovedSession();
  if ("error" in auth) return auth.error;

  try {
    return NextResponse.json({ runs: listAutomationRuns() });
  } catch (error) {
    console.error("Automation runs GET error:", error);
    return NextResponse.json({ error: "Failed to load automation runs" }, { status: 500 });
  }
}