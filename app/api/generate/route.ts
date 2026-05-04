import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { getToolBySlug } from "@/lib/tools";
import { rateLimit, getRequestIp } from "@/lib/rate-limit";
import { requireApprovedSession } from "@/lib/auth";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface ResearchItem {
  type: "url" | "text" | "file";
  label: string;
  content: string;
}

function buildResearchSection(research: ResearchItem[]): string {
  if (!research || research.length === 0) return "";
  const items = research
    .map((item, i) => {
      if (item.type === "url") return `${i + 1}. [URL] ${item.content}`;
      if (item.type === "file") return `${i + 1}. [File: ${item.label}]\n${item.content}`;
      return `${i + 1}. [Text]\n${item.content}`;
    })
    .join("\n\n");
  return `\n\nResearch Sources:\n${items}`;
}

/**
 * Fetches real Unsplash image URLs when an access key is configured.
 * Falls back to null so the caller can use placeholder instructions.
 */
async function fetchUnsplashPhotos(keyword: string, count: number): Promise<string[] | null> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) return null;

  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(keyword)}&per_page=${count}&orientation=landscape`,
      { headers: { Authorization: `Client-ID ${accessKey}` }, cache: "no-store" }
    );
    if (!res.ok) {
      console.error(`[unsplash] API error ${res.status}: ${await res.text()}`);
      return null;
    }
    const data = (await res.json()) as { results: Array<{ urls: { raw: string } }> };
    return data.results.map((r) => `${r.urls.raw}&w=1200&h=628&fit=crop&q=80`);
  } catch (err) {
    console.error("[unsplash] fetch failed:", err);
    return null;
  }
}

function buildPhotoInstructions(photoUrls: string[] | null): string {
  if (photoUrls && photoUrls.length > 0) {
    return (
      "\n\nPhoto instructions: Embed these royalty-free photos throughout the article at natural break points between sections. " +
      "Use each photo exactly once with this Markdown format on its own line:\n" +
      photoUrls.map((url) => `![Relevant descriptive caption — Photo via Unsplash](${url})`).join("\n") +
      "\n\nDo not cluster photos together; spread them evenly across the article."
    );
  }

  return (
    "\n\nPhoto instructions: Embed 3–5 relevant image placeholders throughout the article at natural break points between sections. " +
    "For each photo use this exact Markdown format on its own line:\n" +
    "![A descriptive caption explaining what the photo shows — Photo needed](https://placehold.co/1200x628?text=Replace+with+real+image)\n" +
    "Set the UNSPLASH_ACCESS_KEY environment variable to automatically inject real Unsplash photo URLs."
  );
}

export async function POST(req: NextRequest) {
  const auth = await requireApprovedSession();
  if ("error" in auth) return auth.error;

  const ip = getRequestIp(req.headers);
  if (!rateLimit(`generate:${ip}`, 60, 60_000)) {
    return new Response(JSON.stringify({ error: "Too many requests. Please wait a moment and try again." }), {
      status: 429,
      headers: { "Content-Type": "application/json", "Retry-After": "60" },
    });
  }

  try {
    const { slug, fields, mode, outline, research, includePhotos, toneInstruction, model } = await req.json() as {
      slug: string;
      fields: Record<string, string>;
      mode?: string;
      outline?: string;
      research?: ResearchItem[];
      includePhotos?: boolean;
      toneInstruction?: string;
      model?: string;
    };

    if (!slug || !fields) {
      return new Response(JSON.stringify({ error: "Missing slug or fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const tool = getToolBySlug(slug);
    if (!tool) {
      return new Response(JSON.stringify({ error: "Tool not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Build the {contextSection} replacement value
    const contextValue = fields.context?.trim() ?? "";
    const contextSection = contextValue ? `\nContext/Brief: ${contextValue}` : "";

    let systemPrompt: string;
    let userPrompt: string;

    if (mode === "outline" && tool.outlineSystemPrompt && tool.outlineUserPromptTemplate) {
      // Step 1: generate the outline
      systemPrompt = tool.outlineSystemPrompt;
      userPrompt = tool.outlineUserPromptTemplate;
      for (const [key, value] of Object.entries(fields)) {
        userPrompt = userPrompt.replaceAll(`{${key}}`, String(value || ""));
      }
      userPrompt = userPrompt.replaceAll("{contextSection}", contextSection);
    } else if (mode === "article" && outline && tool.articleWithOutlinePromptTemplate) {
      // Step 2: generate the full article using the approved outline
      systemPrompt = tool.systemPrompt;
      userPrompt = tool.articleWithOutlinePromptTemplate;
      for (const [key, value] of Object.entries(fields)) {
        userPrompt = userPrompt.replaceAll(`{${key}}`, String(value || ""));
      }
      userPrompt = userPrompt.replaceAll("{contextSection}", contextSection);
      userPrompt = userPrompt.replaceAll("{outline}", String(outline));
    } else {
      // Default: single-step generation
      systemPrompt = tool.systemPrompt;
      userPrompt = tool.userPromptTemplate;
      for (const [key, value] of Object.entries(fields)) {
        userPrompt = userPrompt.replaceAll(`{${key}}`, String(value || ""));
      }
      userPrompt = userPrompt.replaceAll("{contextSection}", contextSection);
    }

    // Append MyTone instructions to the system prompt when provided
    if (toneInstruction?.trim()) {
      systemPrompt += toneInstruction;
    }

    // Append any research sources to the prompt
    if (research && research.length > 0) {
      userPrompt += buildResearchSection(research);
    }

    // Append photo-embedding instructions when the option is enabled.
    if (includePhotos) {
      const keyword = fields.keywords || fields.topic || fields.videoTitle || "technology";
      const photoUrls = await fetchUnsplashPhotos(keyword, 5);
      userPrompt += buildPhotoInstructions(photoUrls);
    }

    const ALLOWED_MODELS = new Set(["claude-haiku-4-5-20251001", "claude-sonnet-4-6", "claude-opus-4-7"]);
    const resolvedModel = (model && ALLOWED_MODELS.has(model)) ? model : "claude-sonnet-4-6";

    // Stream the response
    const stream = await client.messages.stream({
      model: resolvedModel,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (
              chunk.type === "content_block_delta" &&
              chunk.delta.type === "text_delta"
            ) {
              controller.enqueue(encoder.encode(chunk.delta.text));
            }
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("API Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
