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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match the first numbered idea: "1. **Title**" or "1. Title"
    const titleMatch = line.match(/^1\.\s+(?:\*\*)?(.+?)(?:\*\*)?$/);
    if (!titleMatch) continue;

    title = titleMatch[1].trim();

    // Search the following lines for description and keywords.
    // Stop only when a new numbered item is encountered.
    for (let j = i + 1; j < lines.length; j++) {
      const next = lines[j];

      // Stop if we hit the next numbered item
      if (/^\d+\.\s/.test(next)) break;

      // Keyword line: "Keywords: kw1, kw2, kw3" (case-insensitive)
      const kwMatch = next.match(/^keywords?:?\s*(.+)/i);
      if (kwMatch) {
        keywords.push(
          ...kwMatch[1]
            .split(/[,;]+/)
            .map((k) => k.trim().replace(/^\*+|\*+$/, ""))
            .filter(Boolean)
        );
        continue;
      }

      // First non-title, non-keyword line is the description
      if (!summary) {
        summary = next.replace(/^[-*]\s*/, "").trim();
      }
    }

    break; // Only parse the first idea
  }

  return {
    title,
    summary,
    keywords,
    prefill: {
      // "niche" matches the source key in the blog-post-ideas fieldMap so
      // that buildHandoffUrl can forward the specific idea title as the
      // "topic" parameter in downstream tools (e.g. article-writer).
      niche: title,
    },
  };
}

// ── Registry ──────────────────────────────────────────────────────────────────

type OutputParser = (raw: string) => ParsedToolOutput;

const PARSER_REGISTRY: Partial<Record<string, OutputParser>> = {
  "blog-post-ideas": parseBlogPostIdeas,
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
