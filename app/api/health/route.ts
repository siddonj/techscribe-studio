import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Lightweight liveness probe — no DB dependency so the healthcheck
// never fails due to a cold DB or missing native bindings at startup.
export function GET() {
  return NextResponse.json({ status: "ok", uptime: process.uptime() });
}
