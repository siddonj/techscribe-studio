import { NextResponse } from "next/server";
import { TOOLS, CATEGORIES } from "@/lib/tools";

export const runtime = "nodejs";

/**
 * GET /api/tools
 *
 * Returns the full TechScribe Studio tool catalogue, optionally filtered by
 * category. Used by the MCP server to expose tool metadata to AI assistants.
 */
export async function GET() {
  const tools = TOOLS.map((tool) => ({
    slug: tool.slug,
    name: tool.name,
    category: tool.category,
    description: tool.description,
    icon: tool.icon,
    fields: tool.fields,
    supportsOutlineFlow: Boolean(tool.outlineSystemPrompt),
  }));

  return NextResponse.json({ tools, categories: CATEGORIES });
}
