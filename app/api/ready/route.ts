import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export function GET() {
  try {
    const db = getDb();
    db.prepare("SELECT 1 as ok").get();

    return NextResponse.json({
      status: "ready",
      checks: {
        database: "ok",
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "not_ready",
        checks: {
          database: "failed",
        },
        error: error instanceof Error ? error.message : "Readiness check failed",
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
