import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { requireApprovedSession } from "@/lib/auth";
import { getHistoryById } from "@/lib/db";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface MetadataSuggestions {
  tags: string[];
  wp_slug: string;
  wp_excerpt: string;
  wp_category_names: string[];
  wp_tag_names: string[];
}

export async function POST(req: NextRequest) {
  const auth = await requireApprovedSession();
  if ("error" in auth) return auth.error;

  try {
    const { historyId } = await req.json() as { historyId: number };

    if (!historyId) {
      return NextResponse.json({ error: "Missing historyId" }, { status: 400 });
    }

    const row = getHistoryById(Number(historyId));
    if (!row) {
      return NextResponse.json({ error: "History entry not found" }, { status: 404 });
    }

    // Truncate content to avoid excessive token usage
    const content = row.output.slice(0, 6000);
    const title = row.title;

    const systemPrompt =
      "You are an expert content strategist and SEO specialist. " +
      "Given an article title and content, suggest concise and relevant metadata. " +
      "Always respond with a single valid JSON object and nothing else.";

    const userPrompt =
      `Suggest metadata for this article.\n\nTitle: ${title}\n\nContent:\n${content}\n\n` +
      "Return a JSON object with exactly these keys:\n" +
      '- "tags": array of 3-8 short content tags (lowercase, no hash symbol)\n' +
      '- "wp_slug": a URL-friendly slug (lowercase, hyphens only, no spaces)\n' +
      '- "wp_excerpt": a concise 1-2 sentence excerpt under 160 characters\n' +
      '- "wp_category_names": array of 1-3 suggested WordPress category names\n' +
      '- "wp_tag_names": array of 3-8 suggested WordPress tag names\n\n' +
      "Return only the JSON object, no markdown fences or other text.";

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text.trim() : "";

    // Strip any accidental markdown code fences
    const stripped = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    const jsonMatch = stripped.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "AI did not return valid JSON suggestions" },
        { status: 500 }
      );
    }

    const suggestions = JSON.parse(jsonMatch[0]) as MetadataSuggestions;

    // Normalize the result to ensure expected shape
    const result: MetadataSuggestions = {
      tags: Array.isArray(suggestions.tags) ? suggestions.tags.map(String) : [],
      wp_slug: typeof suggestions.wp_slug === "string" ? suggestions.wp_slug : "",
      wp_excerpt: typeof suggestions.wp_excerpt === "string" ? suggestions.wp_excerpt : "",
      wp_category_names: Array.isArray(suggestions.wp_category_names)
        ? suggestions.wp_category_names.map(String)
        : [],
      wp_tag_names: Array.isArray(suggestions.wp_tag_names)
        ? suggestions.wp_tag_names.map(String)
        : [],
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Suggest metadata error:", error);
    return NextResponse.json(
      { error: "Failed to generate suggestions", details: String(error) },
      { status: 500 }
    );
  }
}
