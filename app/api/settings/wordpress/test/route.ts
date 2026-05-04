import { NextRequest, NextResponse } from "next/server";
import { resolveWordPressConfig, testWordPressConnection } from "@/lib/wordpress";
import { getWordPressSettings, saveWordPressSettings } from "@/lib/db";
import { requireApprovedSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = await requireApprovedSession();
  if ("error" in auth) return auth.error;

  try {
    const body = await req.json();

    const config = resolveWordPressConfig({
      siteUrl: String(body.site_url ?? "").trim().replace(/\/$/, "") || undefined,
      username: String(body.username ?? "").trim() || undefined,
      appPassword: String(body.app_password ?? "").trim() || undefined,
    });

    const result = await testWordPressConnection(config);

    const testedAt = new Date().toISOString();

    // Persist the test success to the database when the tested credentials match
    // the saved settings. This ensures publishing is enabled immediately after a
    // successful test without requiring an extra "Save" click.
    const savedSettings = getWordPressSettings();
    if (
      savedSettings &&
      config.siteUrl === savedSettings.site_url &&
      config.username === savedSettings.username &&
      config.appPassword === savedSettings.app_password
    ) {
      saveWordPressSettings({
        site_url: savedSettings.site_url,
        username: savedSettings.username,
        app_password: savedSettings.app_password,
        last_test_success: true,
        last_tested_at: testedAt,
      });
    }

    return NextResponse.json({
      success: true,
      site_url: config.siteUrl,
      username: config.username,
      user_name: result.userName,
      user_id: result.userId,
      message: `Connected as ${result.userName}.`,
      has_successful_test: true,
      last_tested_at: testedAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to connect to WordPress";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}