/**
 * Structured handoff registry.
 *
 * Defines which upstream tools can emit structured results and which
 * downstream tools they can launch, along with how to map source input
 * fields into destination pre-fill query parameters.
 *
 * To add a new handoff:
 *   1. Add an entry to HANDOFF_REGISTRY keyed by the upstream tool slug.
 *   2. Provide one or more HandoffAction entries. Each action needs:
 *      - label       – button text shown in the UI
 *      - targetSlug  – slug of the downstream tool to navigate to
 *      - fieldMap    – maps source input field names → destination field names
 *                      used to construct the pre-fill query string
 *
 * No page-local routing logic is needed; the tool page reads this registry
 * and renders the appropriate "Launch with…" buttons automatically.
 */

import type { ParsedToolOutput } from "@/lib/output-parsers";

export interface HandoffAction {
  /** Text displayed on the launch button. */
  label: string;
  /** Slug of the downstream tool to open. */
  targetSlug: string;
  /**
   * Maps source (upstream) input field names to destination (downstream)
   * field names used as URL query parameters for pre-filling the target tool.
   */
  fieldMap: Record<string, string>;
  /**
   * Optional override for the destination URL path.  When set, this path is
   * used instead of the default `/tool/{targetSlug}` pattern.  Use this for
   * handoffs that target non-tool pages such as `/calendar`.
   */
  targetPath?: string;
}

/** Registry: upstream tool slug → list of available handoff actions. */
export type HandoffRegistry = Record<string, HandoffAction[]>;

export const HANDOFF_REGISTRY: HandoffRegistry = {
  "blog-post-ideas": [
    {
      label: "Write Article",
      targetSlug: "article-writer",
      fieldMap: { niche: "topic" },
    },
    {
      label: "Generate Headlines",
      targetSlug: "headline-generator",
      fieldMap: { niche: "topic" },
    },
    {
      label: "Build Outline",
      targetSlug: "outline-generator",
      fieldMap: { niche: "topic" },
    },
  ],
  "headline-generator": [
    {
      label: "Write Article",
      targetSlug: "article-writer",
      fieldMap: { topic: "topic" },
    },
    {
      label: "Build Outline",
      targetSlug: "outline-generator",
      fieldMap: { topic: "topic" },
    },
    {
      label: "Generate Meta Title",
      targetSlug: "meta-title",
      fieldMap: { topic: "topic" },
    },
  ],
  "outline-generator": [
    {
      label: "Write Article",
      targetSlug: "article-writer",
      fieldMap: { topic: "topic", keywords: "keywords", audience: "audience" },
    },
  ],
  "article-writer": [
    {
      label: "Generate Meta Title",
      targetSlug: "meta-title",
      fieldMap: { topic: "topic", keywords: "keyword" },
    },
    {
      label: "Write Meta Description",
      targetSlug: "meta-description",
      fieldMap: { topic: "topic", keywords: "keyword" },
    },
    {
      label: "Generate Schema Markup",
      targetSlug: "schema-markup",
      fieldMap: { topic: "title" },
    },
    {
      label: "Generate OG Tags",
      targetSlug: "og-meta-tags",
      fieldMap: { topic: "title" },
    },
  ],
  "meta-title": [
    {
      label: "Write Meta Description",
      targetSlug: "meta-description",
      fieldMap: { topic: "topic", keyword: "keyword" },
    },
    {
      label: "Generate OG Tags",
      targetSlug: "og-meta-tags",
      fieldMap: { topic: "title" },
    },
  ],
  "meta-description": [
    {
      label: "Generate Meta Title",
      targetSlug: "meta-title",
      fieldMap: { topic: "topic", keyword: "keyword" },
    },
    {
      label: "Generate OG Tags",
      targetSlug: "og-meta-tags",
      fieldMap: { topic: "title" },
    },
  ],
  "youtube-to-blog": [
    {
      label: "Generate Headlines",
      targetSlug: "headline-generator",
      // "topic" comes from parsedOutput.prefill (the blog post H1 extracted by
      // parseYoutubeToBlog) so downstream receives the SEO-optimised post title
      // rather than the original video title.
      fieldMap: { topic: "topic" },
    },
    {
      label: "Build Outline",
      targetSlug: "outline-generator",
      // "topic" from parsedOutput.prefill; "keywords" from raw input fields.
      fieldMap: { topic: "topic", keywords: "keywords" },
    },
    {
      label: "Plan in Calendar",
      targetSlug: "calendar",
      targetPath: "/calendar",
      // "topic" from parsedOutput.prefill becomes the calendar item title;
      // "keywords" from raw input fields are forwarded for content planning.
      fieldMap: { topic: "title", keywords: "keywords" },
    },
    {
      label: "Generate Meta Title",
      targetSlug: "meta-title",
      fieldMap: { videoTitle: "topic", keywords: "keyword" },
    },
    {
      label: "Write Meta Description",
      targetSlug: "meta-description",
      fieldMap: { videoTitle: "topic", keywords: "keyword" },
    },
    {
      label: "Create Tweet Posts",
      targetSlug: "tweet-ideas",
      fieldMap: { videoTitle: "topic" },
    },
    {
      label: "Write LinkedIn Post",
      targetSlug: "linkedin-post",
      fieldMap: { videoTitle: "topic" },
    },
  ],
  "keyword-research-brief": [
    {
      label: "Write Article",
      targetSlug: "article-writer",
      fieldMap: { topic: "topic", keywords: "keywords" },
    },
    {
      label: "Build Outline",
      targetSlug: "outline-generator",
      fieldMap: { topic: "topic", keywords: "keywords" },
    },
    {
      label: "Generate Headlines",
      targetSlug: "headline-generator",
      fieldMap: { topic: "topic" },
    },
    {
      label: "Plan in Calendar",
      targetSlug: "calendar",
      targetPath: "/calendar",
      // "topic" and "keywords" come from parsedOutput.prefill (the brief's
      // extracted title and researched keyword set).  "audience" comes from
      // the raw input fields (what the user typed into the brief tool's
      // "Target Audience" field).  buildHandoffUrl merges both sources so
      // all three values are forwarded correctly.
      fieldMap: { topic: "title", keywords: "keywords", audience: "audience" },
    },
  ],
};

/**
 * Returns the handoff actions registered for an upstream tool slug,
 * or an empty array if none are registered.
 */
export function getHandoffActions(slug: string): HandoffAction[] {
  return HANDOFF_REGISTRY[slug] ?? [];
}

/**
 * Builds the URL for a handoff action given the current set of field values
 * from the upstream tool.
 *
 * When `parsedOutput` is provided its `prefill` values are merged with the
 * raw input `fields` before the fieldMap is applied.  The parsed output
 * values take precedence over raw input so that richer, output-derived data
 * (e.g. a specific idea title) is forwarded rather than the original prompt.
 * Only fields present in the action's fieldMap are forwarded; absent or empty
 * values are omitted from the query string.
 */
export function buildHandoffUrl(
  action: HandoffAction,
  fields: Record<string, string | undefined>,
  parsedOutput?: ParsedToolOutput | null
): string {
  const params = new URLSearchParams();
  // Merge input fields with parsed-output prefill values.
  // parsedOutput.prefill takes precedence when both supply the same key.
  const merged: Record<string, string | undefined> = {
    ...fields,
    ...(parsedOutput?.prefill ?? {}),
  };
  for (const [sourceField, targetField] of Object.entries(action.fieldMap)) {
    const value = merged[sourceField]?.trim();
    if (value) {
      params.set(targetField, value);
    }
  }
  const qs = params.toString();
  const base = action.targetPath ?? `/tool/${action.targetSlug}`;
  return `${base}${qs ? `?${qs}` : ""}`;
}
