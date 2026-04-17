import { NextResponse } from "next/server";
import { listAutomationRuns } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json({ runs: listAutomationRuns() });
  } catch (error) {
    console.error("Automation runs GET error:", error);
    return NextResponse.json({ error: "Failed to load automation runs" }, { status: 500 });
  }
}