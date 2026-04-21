import { NextRequest, NextResponse } from "next/server";
import { getWordPressSettings, saveWordPressSettings } from "@/lib/db";
import { requireApprovedSession } from "@/lib/auth";

export const runtime = "nodejs";

function getEnvFallback() {
  const siteUrl = process.env.WORDPRESS_SITE_URL?.replace(/\/$/, "") ?? "";
  const username = process.env.WORDPRESS_USERNAME ?? "";
  const appPassword = process.env.WORDPRESS_APP_PASSWORD ?? "";

  return {
    site_url: siteUrl,
    username,
    has_app_password: Boolean(appPassword),
    has_successful_test: false,
    last_tested_at: null,
    updated_at: null,
    source: appPassword && siteUrl && username ? "env" : "none",
  } as const;
}

export async function GET() {
  const auth = await requireApprovedSession();
  if ("error" in auth) return auth.error;

  try {
    const saved = getWordPressSettings();

    if (saved) {
      return NextResponse.json({
        site_url: saved.site_url,
        username: saved.username,
        has_app_password: Boolean(saved.app_password),
        has_successful_test: saved.last_test_success,
        last_tested_at: saved.last_tested_at,
        updated_at: saved.updated_at,
        source: "database",
      });
    }

    return NextResponse.json(getEnvFallback());
  } catch (error) {
    console.error("WordPress settings GET error:", error);
    return NextResponse.json({ error: "Failed to load WordPress settings" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireApprovedSession();
  if ("error" in auth) return auth.error;

  try {
    const body = await req.json();
    const siteUrl = String(body.site_url ?? "").trim().replace(/\/$/, "");
    const username = String(body.username ?? "").trim();
    const incomingPassword = String(body.app_password ?? "").trim();
    const hasSuccessfulTest = Boolean(body.has_successful_test);
    const lastTestedAt = hasSuccessfulTest ? String(body.last_tested_at ?? new Date().toISOString()) : null;
    const existing = getWordPressSettings();
    const appPassword = incomingPassword || existing?.app_password || "";

    if (!siteUrl || !username || !appPassword) {
      return NextResponse.json(
        { error: "Site URL, username, and application password are required" },
        { status: 400 }
      );
    }

    const saved = saveWordPressSettings({
      site_url: siteUrl,
      username,
      app_password: appPassword,
      last_test_success: hasSuccessfulTest,
      last_tested_at: lastTestedAt,
    });

    return NextResponse.json({
      site_url: saved.site_url,
      username: saved.username,
      has_app_password: Boolean(saved.app_password),
      has_successful_test: saved.last_test_success,
      last_tested_at: saved.last_tested_at,
      updated_at: saved.updated_at,
      source: "database",
    });
  } catch (error) {
    console.error("WordPress settings POST error:", error);
    return NextResponse.json({ error: "Failed to save WordPress settings" }, { status: 500 });
  }
}