import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { getToolBySlug } from "@/lib/tools";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const { slug, fields, mode, outline } = await req.json();

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

    let systemPrompt: string;
    let userPrompt: string;

    if (mode === "outline" && tool.outlineSystemPrompt && tool.outlineUserPromptTemplate) {
      // Step 1: generate the outline
      systemPrompt = tool.outlineSystemPrompt;
      userPrompt = tool.outlineUserPromptTemplate;
      for (const [key, value] of Object.entries(fields)) {
        userPrompt = userPrompt.replaceAll(`{${key}}`, String(value || ""));
      }
    } else if (mode === "article" && outline && tool.articleWithOutlinePromptTemplate) {
      // Step 2: generate the full article using the approved outline
      systemPrompt = tool.systemPrompt;
      userPrompt = tool.articleWithOutlinePromptTemplate;
      for (const [key, value] of Object.entries(fields)) {
        userPrompt = userPrompt.replaceAll(`{${key}}`, String(value || ""));
      }
      userPrompt = userPrompt.replaceAll("{outline}", String(outline));
    } else {
      // Default: single-step generation
      systemPrompt = tool.systemPrompt;
      userPrompt = tool.userPromptTemplate;
      for (const [key, value] of Object.entries(fields)) {
        userPrompt = userPrompt.replaceAll(`{${key}}`, String(value || ""));
      }
    }

    // Stream the response
    const stream = await client.messages.stream({
      model: "claude-opus-4-5",
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
