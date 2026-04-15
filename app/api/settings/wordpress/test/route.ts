import { NextRequest, NextResponse } from "next/server";
import { resolveWordPressConfig, testWordPressConnection } from "@/lib/wordpress";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const config = resolveWordPressConfig({
      siteUrl: String(body.site_url ?? "").trim().replace(/\/$/, "") || undefined,
      username: String(body.username ?? "").trim() || undefined,
      appPassword: String(body.app_password ?? "").trim() || undefined,
    });

    const result = await testWordPressConnection(config);

    return NextResponse.json({
      success: true,
      site_url: config.siteUrl,
      username: config.username,
      user_name: result.userName,
      user_id: result.userId,
      message: `Connected as ${result.userName}.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to connect to WordPress";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}