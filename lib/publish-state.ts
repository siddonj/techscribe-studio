/**
 * Canonical publish state model shared across all workflow surfaces
 * (tool page, history view, calendar view).
 *
 * These values are stored in the `wp_publish_state` column of the history
 * table.  Legacy rows may contain the old values `"draft"` (maps to either
 * `"draft_created"` or `"draft_updated"` depending on `wp_last_sync_action`)
 * and `"publish"` (maps to `"published"`); those are normalised at read-time
 * by `resolvePublishState`.
 */

import type { HistoryRow } from "@/lib/db";

// ─── Canonical state values ───────────────────────────────────────────────────

/** All recognised publish-state values stored in the database. */
export const PUBLISH_STATES = [
  "draft_created",
  "draft_updated",
  "published",
  "failed",
] as const;

/**
 * A richer publish state that clearly distinguishes every step of the
 * WordPress publishing workflow:
 *
 * - `draft_created`  — a WordPress draft was created for the first time
 * - `draft_updated`  — an existing WordPress draft was updated
 * - `published`      — the post is live on WordPress
 * - `failed`         — the last publish attempt failed; can be retried via the
 *                      "Retry Publish" action in the history view
 *
 * `null` (the absence of a state) means the item has never been published
 * to WordPress ("unpublished").
 */
export type PublishState = (typeof PUBLISH_STATES)[number];

// ─── Display labels ───────────────────────────────────────────────────────────

/** Human-readable badge label for each publish state. */
export const PUBLISH_STATE_LABELS: Record<PublishState, string> = {
  draft_created: "Draft Linked",
  draft_updated: "Draft Updated",
  published: "Published Live",
  failed: "Publish Failed",
};

// ─── Tailwind CSS class helpers ───────────────────────────────────────────────

/** CSS classes for the small pill/badge shown in list rows. */
export const PUBLISH_STATE_BADGE_CLASSES: Record<PublishState, string> = {
  draft_created: "text-green-300 border-green-400/20",
  draft_updated: "text-green-300 border-green-400/20",
  published: "text-fuchsia-300 border-fuchsia-400/20",
  failed: "text-red-300 border-red-400/20",
};

/** CSS classes for inline text annotations (slightly dimmed). */
export const PUBLISH_STATE_INLINE_CLASSES: Record<PublishState, string> = {
  draft_created: "text-green-300/75",
  draft_updated: "text-green-300/75",
  published: "text-fuchsia-300/75",
  failed: "text-red-300/75",
};

/** CSS classes for detail-panel text (slightly less dimmed than inline). */
export const PUBLISH_STATE_DETAIL_CLASSES: Record<PublishState, string> = {
  draft_created: "text-green-300/90",
  draft_updated: "text-green-300/90",
  published: "text-fuchsia-300/90",
  failed: "text-red-300/90",
};

// ─── State derivation ─────────────────────────────────────────────────────────

/**
 * Normalise a raw `wp_publish_state` value from the database.
 *
 * Handles legacy values (`"draft"` and `"publish"`) produced before the
 * richer model was introduced, so that all display code can rely on the
 * canonical `PublishState` union.
 *
 * Pass `syncAction` when resolving the legacy `"draft"` value so the
 * function can distinguish `"draft_created"` from `"draft_updated"`.
 */
export function normalizePublishState(
  raw: string | null | undefined,
  syncAction?: "created" | "updated" | null
): PublishState | null {
  switch (raw) {
    case "draft_created":
    case "draft_updated":
    case "published":
    case "failed":
      return raw;
    // Legacy values
    case "draft":
      return syncAction === "updated" ? "draft_updated" : "draft_created";
    case "publish":
      return "published";
    default:
      return null;
  }
}

/**
 * Derive the canonical `PublishState` from a full `HistoryRow`.
 * Returns `null` when the item has never been published ("unpublished").
 */
export function resolvePublishState(row: HistoryRow): PublishState | null {
  return normalizePublishState(row.wp_publish_state, row.wp_last_sync_action);
}

// ─── Per-row display utilities ────────────────────────────────────────────────

/** Returns the badge CSS class for a history row, or the "no-state" default. */
export function getPublishStateBadgeClass(row: HistoryRow): string {
  const state = resolvePublishState(row);
  if (!state) return "text-green-300 border-green-400/20";
  return PUBLISH_STATE_BADGE_CLASSES[state];
}

/** Returns the inline text CSS class for a history row. */
export function getPublishStateInlineClass(row: HistoryRow): string {
  const state = resolvePublishState(row);
  if (!state) return "text-green-300/75";
  return PUBLISH_STATE_INLINE_CLASSES[state];
}

/** Returns the detail-panel text CSS class for a history row. */
export function getPublishStateDetailClass(row: HistoryRow): string {
  const state = resolvePublishState(row);
  if (!state) return "text-muted/70";
  return PUBLISH_STATE_DETAIL_CLASSES[state];
}

/** Returns the badge label for a history row, or `null` when no state exists. */
export function getPublishStateBadgeLabel(row: HistoryRow): string | null {
  const state = resolvePublishState(row);
  if (!state) return null;
  if (state === "failed") return PUBLISH_STATE_LABELS.failed;
  if (!row.wp_post_id) return null;
  return PUBLISH_STATE_LABELS[state];
}

/** Returns a full human-readable status description for a history row. */
export function getPublishStateStatusText(row: HistoryRow, formatIsoDate: (iso: string) => string): string {
  const state = resolvePublishState(row);

  if (state === "failed") {
    return row.wp_error_message
      ? `Publish failed: ${row.wp_error_message}`
      : "Last publish attempt failed";
  }

  if (!row.wp_post_id) {
    return "Never published to WordPress";
  }

  if (state === "published") {
    return row.wp_last_published_at
      ? `Published live ${formatIsoDate(row.wp_last_published_at)}`
      : "Published live";
  }

  if (state === "draft_updated") {
    return row.wp_last_published_at
      ? `Draft updated ${formatIsoDate(row.wp_last_published_at)}`
      : "Draft updated";
  }

  // state === "draft_created" or any unrecognised value with a post ID
  return row.wp_last_published_at
    ? `Draft linked ${formatIsoDate(row.wp_last_published_at)}`
    : "Draft linked";
}

// ─── Failure classification ───────────────────────────────────────────────────

/**
 * Broad failure categories that help users understand what to fix next:
 *
 * - `credential` — auth / permission problem (401, 403, or auth-related text)
 * - `connection` — network or URL problem (fetch failure, ECONNREFUSED, etc.)
 * - `payload`    — the post data was rejected by WordPress (400, 422, etc.)
 * - `unknown`    — could not determine a more specific category
 */
export type PublishFailureCategory = "credential" | "connection" | "payload" | "unknown";

/**
 * Classify a raw publish error message (stored in `wp_error_message`) or an
 * HTTP status code into one of the broad `PublishFailureCategory` values.
 *
 * Pass `httpStatus` when available for more reliable detection of auth errors.
 */
export function classifyPublishFailure(
  errorMessage: string | null | undefined,
  httpStatus?: number | null
): PublishFailureCategory {
  if (httpStatus === 401 || httpStatus === 403) return "credential";
  if (httpStatus === 400 || httpStatus === 422) return "payload";

  const msg = (errorMessage ?? "").trim().toLowerCase();

  if (
    msg.includes("401") ||
    msg.includes("403") ||
    msg.includes("unauthorized") ||
    msg.includes("forbidden") ||
    msg.includes("invalid username") ||
    msg.includes("invalid password") ||
    msg.includes("application password") ||
    msg.includes("authentication")
  ) {
    return "credential";
  }

  if (
    msg.includes("econnrefused") ||
    msg.includes("enotfound") ||
    msg.includes("etimedout") ||
    msg.includes("network") ||
    msg.includes("fetch failed") ||
    msg.includes("failed to fetch") ||
    msg.includes("connect") ||
    msg.includes("dns") ||
    msg.includes("timeout") ||
    msg.includes("unreachable") ||
    msg.includes("socket")
  ) {
    return "connection";
  }

  if (
    msg.includes("400") ||
    msg.includes("422") ||
    msg.includes("invalid_param") ||
    msg.includes("invalid param") ||
    msg.includes("rest_invalid") ||
    msg.includes("unprocessable") ||
    msg.includes("bad request") ||
    msg.includes("invalid post")
  ) {
    return "payload";
  }

  return "unknown";
}

/** Human-readable label for each failure category. */
export const PUBLISH_FAILURE_CATEGORY_LABELS: Record<PublishFailureCategory, string> = {
  credential: "Credential error",
  connection: "Connection error",
  payload: "Payload error",
  unknown: "Publish error",
};

/**
 * Returns a short, actionable hint for the given failure category to guide the
 * user toward a fix.
 */
export function getPublishFailureHint(category: PublishFailureCategory): string {
  switch (category) {
    case "credential":
      return "Check your WordPress username and application password in Settings.";
    case "connection":
      return "Check your WordPress site URL and ensure the site is reachable.";
    case "payload":
      return "Review your post metadata (slug, category IDs, tag IDs) for invalid values.";
    default:
      return "Retry the publish action. If the error persists, check your WordPress settings.";
  }
}

// ─── Type guard ───────────────────────────────────────────────────────────────

/** Returns `true` when `value` is a valid canonical `PublishState`. */
export function isPublishState(value: string): value is PublishState {
  return (PUBLISH_STATES as readonly string[]).includes(value);
}
