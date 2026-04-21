import { NextRequest, NextResponse } from "next/server";
import { createAutomationTemplate, listAutomationTemplates } from "@/lib/db";
import { requireApprovedSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireApprovedSession();
  if ("error" in auth) return auth.error;

  try {
    return NextResponse.json({ templates: listAutomationTemplates() });
  } catch (error) {
    console.error("Automation templates GET error:", error);
    return NextResponse.json({ error: "Failed to load automation templates" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireApprovedSession();
  if ("error" in auth) return auth.error;

  try {
    const body = await req.json() as Record<string, unknown>;
    const name = String(body.name ?? "").trim();
    const description = String(body.description ?? "").trim() || null;
    const jobs = body.jobs;

    if (!name) {
      return NextResponse.json({ error: "Template name is required" }, { status: 400 });
    }

    if (!Array.isArray(jobs) || jobs.length === 0) {
      return NextResponse.json({ error: "Template must include a non-empty jobs array" }, { status: 400 });
    }

    const template = createAutomationTemplate({
      name,
      description,
      jobs_json: JSON.stringify(jobs),
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error("Automation templates POST error:", error);
    return NextResponse.json({ error: "Failed to create automation template" }, { status: 500 });
  }
}