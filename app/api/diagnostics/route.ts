import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const FORWARDED_HEADER_KEYS = [
  "host",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-forwarded-for",
  "x-forwarded-port",
  "x-real-ip",
  "x-request-id",
  "x-original-uri",
  "x-original-host",
  "x-original-forwarded-for",
  "via",
  "cf-ray",
  "cf-connecting-ip",
] as const;

export function GET(req: NextRequest) {
  const headers = Object.fromEntries(
    FORWARDED_HEADER_KEYS.map((key) => [key, req.headers.get(key) ?? null])
  );

  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    runtime: {
      node: process.version,
      environment: process.env.NODE_ENV ?? "unknown",
      uptime: process.uptime(),
    },
    request: {
      method: req.method,
      url: req.url,
      pathname: req.nextUrl.pathname,
      headers,
    },
  });
}
