#!/usr/bin/env node
/**
 * TechScribe Studio MCP Server
 *
 * Exposes TechScribe Studio functionality as MCP (Model Context Protocol) tools
 * so AI assistants like Claude Desktop, Cursor, and other MCP clients can
 * generate content, browse history, and manage the content calendar.
 *
 * Usage:
 *   npm run mcp-server
 *
 * Configuration:
 *   TECHSCRIBE_URL — base URL of the running TechScribe Studio app (default: http://localhost:3000)
 *   BATCH_API_SECRET — required when the batch endpoint has authentication enabled
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";

const BASE_URL = (process.env.TECHSCRIBE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const BATCH_API_SECRET = process.env.BATCH_API_SECRET ?? "";

// ── HTTP helpers ────────────────────────────────────────────────────────────

async function apiFetch(path: string, options: RequestInit = {}): Promise<unknown> {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string> | undefined),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`API error ${response.status}: ${body}`);
  }

  return response.json();
}

// ── Tool definitions ────────────────────────────────────────────────────────

const TOOLS: Tool[] = [
  {
    name: "list_writing_tools",
    description:
      "List all available TechScribe Studio writing tools with their slugs, names, categories, descriptions, and input fields. Use this to discover which tools are available before calling generate_content.",
    inputSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description:
            "Optional category filter. One of: 'Content Creation', 'Ideas & Planning', 'SEO & Keywords', 'Editing & Rewriting', 'Social Media', 'Email & Marketing', 'Video Content'.",
        },
      },
    },
  },
  {
    name: "generate_content",
    description:
      "Generate content using one of the TechScribe Studio writing tools. Returns the full generated text. Optionally saves the result to the history database.",
    inputSchema: {
      type: "object",
      required: ["slug", "fields"],
      properties: {
        slug: {
          type: "string",
          description:
            "The tool slug (e.g. 'article-writer', 'meta-description', 'tweet-thread'). Use list_writing_tools to discover available slugs.",
        },
        fields: {
          type: "object",
          description:
            "Key-value pairs for the tool's input fields. Use list_writing_tools to see which fields each tool requires.",
          additionalProperties: { type: "string" },
        },
        save: {
          type: "boolean",
          description: "When true, the generated output is saved to history. Defaults to false.",
        },
        folder: {
          type: "string",
          description: "Optional folder name to assign when saving to history (requires save: true).",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Optional tags to assign when saving to history (requires save: true).",
        },
        calendar_id: {
          type: "number",
          description:
            "Optional content calendar entry ID to link after saving (requires save: true).",
        },
      },
    },
  },
  {
    name: "save_to_history",
    description:
      "Save a piece of generated content to TechScribe Studio's history database so it can be viewed, edited, and published from the app.",
    inputSchema: {
      type: "object",
      required: ["slug", "fields", "output"],
      properties: {
        slug: {
          type: "string",
          description: "The tool slug that was used to generate the content.",
        },
        fields: {
          type: "object",
          description: "The field values that were used to generate the content.",
          additionalProperties: { type: "string" },
        },
        output: {
          type: "string",
          description: "The generated content to save.",
        },
        calendar_id: {
          type: "number",
          description: "Optional content calendar entry ID to link this history entry to.",
        },
      },
    },
  },
  {
    name: "list_history",
    description:
      "List saved history entries from TechScribe Studio. Returns entries with their metadata, tool info, word count, and WordPress publish status.",
    inputSchema: {
      type: "object",
      properties: {
        search: {
          type: "string",
          description: "Full-text search query across title, tool name, category, output, folder, and tags.",
        },
        tool: {
          type: "string",
          description: "Filter by tool slug (e.g. 'article-writer').",
        },
        folder: {
          type: "string",
          description: "Filter by folder name.",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Filter by one or more tags.",
        },
        status: {
          type: "string",
          enum: ["all", "never-published", "draft-linked", "draft-updated", "publish-failed", "published-live"],
          description: "Filter by WordPress publish status. Defaults to 'all'.",
        },
        sort: {
          type: "string",
          enum: ["newest", "oldest", "title-az", "title-za"],
          description: "Sort order. Defaults to 'newest'.",
        },
        limit: {
          type: "number",
          description: "Maximum number of entries to return (1–100). Defaults to 20.",
        },
        offset: {
          type: "number",
          description: "Pagination offset. Defaults to 0.",
        },
      },
    },
  },
  {
    name: "get_history_entry",
    description:
      "Retrieve a single TechScribe Studio history entry by its numeric ID, including the full generated output and all metadata.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: {
          type: "number",
          description: "The numeric ID of the history entry.",
        },
      },
    },
  },
  {
    name: "list_calendar_entries",
    description:
      "List content calendar entries from TechScribe Studio. Returns planned and scheduled pieces with their brief, keywords, audience, and WordPress metadata.",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["planned", "backlog", "in-progress", "done"],
          description: "Filter by calendar entry status.",
        },
        tool: {
          type: "string",
          description: "Filter by assigned tool slug.",
        },
        publish_intent: {
          type: "string",
          enum: ["draft", "publish"],
          description: "Filter by publish intent.",
        },
        from: {
          type: "string",
          description: "Filter entries scheduled on or after this date (YYYY-MM-DD).",
        },
        to: {
          type: "string",
          description: "Filter entries scheduled on or before this date (YYYY-MM-DD).",
        },
      },
    },
  },
  {
    name: "create_calendar_entry",
    description:
      "Create a new content calendar entry in TechScribe Studio to plan an upcoming piece of content.",
    inputSchema: {
      type: "object",
      required: ["title", "tool_slug"],
      properties: {
        title: {
          type: "string",
          description: "The content title or working headline.",
        },
        tool_slug: {
          type: "string",
          description: "The writing tool to use for generating this piece (e.g. 'article-writer').",
        },
        status: {
          type: "string",
          enum: ["planned", "backlog", "in-progress", "done"],
          description: "Initial status. Defaults to 'planned'.",
        },
        scheduled_for: {
          type: "string",
          description: "Optional target date in YYYY-MM-DD format.",
        },
        brief: {
          type: "string",
          description: "Brief description or notes about the planned content.",
        },
        keywords: {
          type: "string",
          description: "Target keywords (comma-separated).",
        },
        audience: {
          type: "string",
          description: "Target audience description.",
        },
        notes: {
          type: "string",
          description: "Additional notes.",
        },
        publish_intent: {
          type: "string",
          enum: ["draft", "publish"],
          description: "Whether to publish as a draft or live post when sent to WordPress. Defaults to 'draft'.",
        },
      },
    },
  },
];

// ── Tool handlers ───────────────────────────────────────────────────────────

type TextContent = { type: "text"; text: string };

function ok(value: unknown): { content: TextContent[] } {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

function err(message: string): { content: TextContent[]; isError: true } {
  return { content: [{ type: "text", text: message }], isError: true };
}

// list_writing_tools
async function handleListWritingTools(args: Record<string, unknown>) {
  const data = await apiFetch("/api/tools") as { tools: unknown[] };
  let tools = data.tools as Array<{ category: string }>;
  if (args.category && typeof args.category === "string") {
    tools = tools.filter((t) => t.category === args.category);
  }
  return ok(tools);
}

// generate_content
async function handleGenerateContent(args: Record<string, unknown>) {
  const slug = String(args.slug ?? "");
  const fields = (args.fields ?? {}) as Record<string, string>;
  const save = Boolean(args.save);
  const folder = args.folder ? String(args.folder) : undefined;
  const tags = Array.isArray(args.tags) ? args.tags.map(String) : undefined;
  const calendarId = typeof args.calendar_id === "number" ? args.calendar_id : undefined;

  const jobs: Array<Record<string, unknown>> = [
    {
      slug,
      fields,
      save,
      ...(folder ? { folder } : {}),
      ...(tags ? { tags } : {}),
      ...(calendarId !== undefined ? { calendar_id: calendarId } : {}),
    },
  ];

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (BATCH_API_SECRET) {
    headers["Authorization"] = `Bearer ${BATCH_API_SECRET}`;
  }

  const response = await fetch(`${BASE_URL}/api/generate/batch`, {
    method: "POST",
    headers,
    body: JSON.stringify({ jobs }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Batch API error ${response.status}: ${body}`);
  }

  const result = (await response.json()) as {
    results: Array<{
      slug: string;
      status: "success" | "error";
      output?: string;
      history_id?: number;
      error?: string;
    }>;
  };

  const job = result.results[0];
  if (!job || job.status === "error") {
    return err(job?.error ?? "Generation failed");
  }

  return ok({
    output: job.output,
    ...(job.history_id !== undefined ? { history_id: job.history_id } : {}),
  });
}

// save_to_history
async function handleSaveToHistory(args: Record<string, unknown>) {
  const data = await apiFetch("/api/history", {
    method: "POST",
    body: JSON.stringify({
      slug: args.slug,
      fields: args.fields,
      output: args.output,
      ...(typeof args.calendar_id === "number" ? { calendarId: args.calendar_id } : {}),
    }),
  });
  return ok(data);
}

// list_history
async function handleListHistory(args: Record<string, unknown>) {
  const params = new URLSearchParams();
  if (args.search) params.set("q", String(args.search));
  if (args.tool) params.set("tool", String(args.tool));
  if (args.folder) params.set("folder", String(args.folder));
  if (Array.isArray(args.tags)) {
    for (const tag of args.tags) params.append("tag", String(tag));
  }
  if (args.status) params.set("status", String(args.status));
  if (args.sort) params.set("sort", String(args.sort));
  const limit = typeof args.limit === "number" ? Math.min(args.limit, 100) : 20;
  params.set("limit", String(limit));
  if (args.offset) params.set("offset", String(args.offset));

  const data = await apiFetch(`/api/history?${params.toString()}`);
  return ok(data);
}

// get_history_entry
async function handleGetHistoryEntry(args: Record<string, unknown>) {
  const id = args.id as number;
  const data = await apiFetch(`/api/history/${id}`);
  return ok(data);
}

// list_calendar_entries
async function handleListCalendarEntries(args: Record<string, unknown>) {
  const params = new URLSearchParams();
  if (args.status) params.set("status", String(args.status));
  if (args.tool) params.set("tool", String(args.tool));
  if (args.publish_intent) params.set("publish_intent", String(args.publish_intent));
  if (args.from) params.set("from", String(args.from));
  if (args.to) params.set("to", String(args.to));

  const data = await apiFetch(`/api/calendar?${params.toString()}`);
  return ok(data);
}

// create_calendar_entry
async function handleCreateCalendarEntry(args: Record<string, unknown>) {
  const data = await apiFetch("/api/calendar", {
    method: "POST",
    body: JSON.stringify(args),
  });
  return ok(data);
}

// ── Server setup ─────────────────────────────────────────────────────────────

const server = new Server(
  { name: "techscribe-studio", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    switch (name) {
      case "list_writing_tools":
        return await handleListWritingTools(args as Record<string, unknown>);
      case "generate_content":
        return await handleGenerateContent(args as Record<string, unknown>);
      case "save_to_history":
        return await handleSaveToHistory(args as Record<string, unknown>);
      case "list_history":
        return await handleListHistory(args as Record<string, unknown>);
      case "get_history_entry":
        return await handleGetHistoryEntry(args as Record<string, unknown>);
      case "list_calendar_entries":
        return await handleListCalendarEntries(args as Record<string, unknown>);
      case "create_calendar_entry":
        return await handleCreateCalendarEntry(args as Record<string, unknown>);
      default:
        return err(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return err(message);
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("MCP server error:", error);
  process.exit(1);
});
