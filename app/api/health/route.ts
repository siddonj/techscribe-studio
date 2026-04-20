import { NextResponse } from "next/server";
import { checkDbHealth } from "@/lib/db";

export const dynamic = "force-dynamic";

export function GET() {
  const dbOk = checkDbHealth();

  if (!dbOk) {
    return NextResponse.json(
      { status: "error", db: "unreachable" },
      { status: 503 }
    );
  }

  return NextResponse.json({
    status: "ok",
    db: "ok",
    uptime: process.uptime(),
  });
}
