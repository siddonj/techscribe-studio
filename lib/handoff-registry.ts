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
  "outline-generator": [
    {
      label: "Write Article",
      targetSlug: "article-writer",
      fieldMap: { topic: "topic", keywords: "keywords", audience: "audience" },
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
  return `/tool/${action.targetSlug}${qs ? `?${qs}` : ""}`;
}
