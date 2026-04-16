/**
 * Reusable output parsers for structured tool results.
 *
 * Each parser converts the raw AI-generated text output for a specific tool
 * into a `ParsedToolOutput` – a normalised shape that can be used for
 * handoffs, prefilling downstream tools, and display purposes without
 * scattering ad-hoc string manipulation across the rendering path.
 *
 * Adding a new parser:
 *   1. Write a function `(raw: string) => ParsedToolOutput`.
 *   2. Register it in PARSER_REGISTRY under the upstream tool's slug.
 *   3. The public `parseToolOutput` helper will call it safely (errors are
 *      caught and the caller receives `null` so rendering never breaks).
 */

/** Normalised shape returned by every tool output parser. */
export interface ParsedToolOutput {
  /** Primary title or heading extracted from the output. */
  title: string;
  /** One-sentence description or summary of the first result. */
  summary: string;
  /** Keywords found in the output (may be empty). */
  keywords: string[];
  /**
   * Key/value pairs that can pre-fill fields in a downstream tool.
   * Keys should match the source field names used in the upstream tool's
   * HandoffAction fieldMap so that buildHandoffUrl can forward them.
   */
  prefill: Record<string, string>;
}

// ── Individual parsers ────────────────────────────────────────────────────────

/**
 * Parser for the "blog-post-ideas" tool.
 *
 * Expected output structure (one block per idea):
 *
 *   1. **Catchy Title**
 *      One-sentence description.
 *      Keywords: kw1, kw2, kw3
 *
 *   2. **Another Title**
 *      …
 *
 * The parser extracts the first idea's title, description, and keywords so
 * they can be forwarded to downstream tools like "article-writer".
 */
function parseBlogPostIdeas(raw: string): ParsedToolOutput {
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);

  let title = "";
  let summary = "";
  const keywords: string[] = [];

  // Find the line for the first idea ("1. …") and extract its content.
  // Lines before item 1 (e.g. an intro paragraph) are skipped via continue;
  // the outer loop terminates with break as soon as item 1 is fully parsed.
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match the first numbered idea: "1. **Title**" (bold) or "1. Title" (plain).
    // The bold pattern is tried first so the capture group returns the raw text
    // inside the markers; the plain fallback handles unformatted output.
    const titleMatch = line.match(/^1\.\s+\*\*(.+)\*\*$/) ?? line.match(/^1\.\s+(.+)$/);
    if (!titleMatch) continue;

    // Strip any residual leading/trailing asterisks from the plain-text branch
    // (defensive – the bold branch already extracts clean text via the regex).
    title = titleMatch[1].replace(/^\*+|\*+$/g, "").trim();

    // Scan the lines that belong to this idea (until the next numbered item).
    for (let j = i + 1; j < lines.length; j++) {
      const next = lines[j];

      // Stop if we hit the next numbered item
      if (/^\d+\.\s/.test(next)) break;

      // Keyword line – e.g. "Keywords: kw1, kw2, kw3" (case-insensitive).
      // Asterisks are stripped defensively in case the AI wraps individual
      // keywords in bold markers.
      const kwMatch = next.match(/^keywords?:?\s*(.+)/i);
      if (kwMatch) {
        keywords.push(
          ...kwMatch[1]
            .split(/[,;]+/)
            .map((k) => k.trim().replace(/^\*+|\*+$/g, ""))
            .filter(Boolean)
        );
        continue;
      }

      // First non-title, non-keyword line is the description
      if (!summary) {
        summary = next.replace(/^[-*]\s*/, "").trim();
      }
    }

    break; // First idea fully parsed – no need to continue the outer loop
  }

  return {
    title,
    summary,
    keywords,
    prefill: {
      // "niche" is the source field name declared in the blog-post-ideas
      // HANDOFF_REGISTRY entry (lib/handoff-registry.ts).  Keep this in sync
      // with that fieldMap if the registry entry is ever updated.
      niche: title,
    },
  };
}

/**
 * Parser for the "outline-generator" tool.
 *
 * Expected output structure (Markdown outline):
 *
 *   # Complete Guide to REST APIs
 *
 *   ## Introduction
 *   - What is REST?
 *   - Why it matters
 *
 *   ## Core Concepts
 *   ### HTTP Methods
 *   …
 *
 * The parser extracts the H1 as the title, the first H2 section heading as
 * the summary, and all H2/H3 headings as display keywords so they can be
 * shown in the HandoffCard chips and forwarded to Article Writer.
 */
function parseOutlineGenerator(raw: string): ParsedToolOutput {
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);

  let title = "";
  let summary = "";
  const keywords: string[] = [];

  for (const line of lines) {
    // H1 → main title.
    // Asterisks are stripped defensively in case the AI wraps the heading
    // text in bold markers (e.g. "# **Title**").
    if (!title) {
      const h1Match = line.match(/^#\s+(.+)$/);
      if (h1Match) {
        title = h1Match[1].replace(/^\*+|\*+$/g, "").trim();
        continue;
      }
    }

    // H2/H3 headings → keyword chips.
    // The first H2 is also used as the summary (a one-line preview of the
    // outline's opening section).  Subsequent H2/H3s are collected only as
    // chips so the summary stays focused on the main entry point.
    const headingMatch = line.match(/^(#{2,3})\s+(.+)$/);
    if (headingMatch) {
      // Asterisks are stripped defensively (same reason as H1 above).
      const heading = headingMatch[2].replace(/^\*+|\*+$/g, "").trim();
      if (!summary && headingMatch[1] === "##") {
        summary = heading;
      }
      if (heading && !keywords.includes(heading)) {
        keywords.push(heading);
      }
    }
  }

  return {
    title,
    summary,
    keywords,
    prefill: {
      // "topic" is the source field name declared in the outline-generator
      // HANDOFF_REGISTRY entry (lib/handoff-registry.ts).  Keep this in sync
      // with that fieldMap if the registry entry is ever updated.
      topic: title,
    },
  };
}

// ── Registry ──────────────────────────────────────────────────────────────────

type OutputParser = (raw: string) => ParsedToolOutput;

const PARSER_REGISTRY: Partial<Record<string, OutputParser>> = {
  "blog-post-ideas": parseBlogPostIdeas,
  "outline-generator": parseOutlineGenerator,
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Attempts to parse the raw output of a tool into a `ParsedToolOutput`.
 *
 * Returns `null` when:
 * - No parser is registered for the given slug.
 * - The registered parser throws an error.
 *
 * Callers should treat `null` as "no structured data available" and fall back
 * to plain rendering without interrupting the user experience.
 */
export function parseToolOutput(
  slug: string,
  raw: string
): ParsedToolOutput | null {
  const parser = PARSER_REGISTRY[slug];
  if (!parser) return null;
  try {
    return parser(raw);
  } catch {
    return null;
  }
}
