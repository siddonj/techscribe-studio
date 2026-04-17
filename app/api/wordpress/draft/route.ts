import { NextRequest, NextResponse } from "next/server";
import {
  getCalendarEntryById,
  getHistoryById,
  getWordPressSettings,
  markHistoryPublishFailed,
  syncCalendarEntryWordPressDraft,
  updateHistoryWordPressDraft,
} from "@/lib/db";
import {
  buildWordPressAuthHeader,
  getWordPressConfig,
  markdownToWordPressHtml,
} from "@/lib/wordpress";

export const runtime = "nodejs";

function deriveTitle(content: string, fallbackTitle?: string) {
  const heading = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
  return heading || fallbackTitle || "Untitled Draft";
}

/** Parse a comma-separated string of term IDs into an integer array. */
function parseTermIds(value: string | null | undefined): number[] {
  if (!value?.trim()) return [];
  return value
    .split(",")
    .map((id) => parseInt(id.trim(), 10))
    .filter((id) => !isNaN(id) && id > 0);
}

export async function POST(req: NextRequest) {
  let requestHistoryId: number | undefined;
  try {
    const body = await req.json();
    const { content, title, historyId, calendarId } = body as {
      content?: string;
      title?: string;
      historyId?: number;
      calendarId?: number;
    };
    requestHistoryId = historyId;

    if (!content?.trim()) {
      return NextResponse.json({ error: "Missing content" }, { status: 400 });
    }

    const settings = getWordPressSettings();
    if (!settings || !settings.last_test_success) {
      return NextResponse.json(
        {
          error:
            "WordPress draft publishing is disabled until your saved WordPress settings pass a successful connection test.",
        },
        { status: 400 }
      );
    }

    const { siteUrl, username, appPassword } = getWordPressConfig();
    const finalTitle = deriveTitle(content, title);
    const htmlContent = markdownToWordPressHtml(content);

    const existingHistory = typeof historyId === "number" ? getHistoryById(historyId) : undefined;
    const existingPostId = existingHistory?.wp_post_id;
    const syncAction = existingPostId ? "updated" : "created";
    const endpoint = existingPostId
      ? `${siteUrl}/wp-json/wp/v2/posts/${existingPostId}`
      : `${siteUrl}/wp-json/wp/v2/posts`;

    // Resolve publish intent and metadata from linked calendar entry
    const resolvedCalendarEntry =
      typeof calendarId === "number"
        ? getCalendarEntryById(calendarId)
        : undefined;

    const publishIntent = resolvedCalendarEntry?.publish_intent ?? "draft";

    // Determine the WordPress post status.
    // - "publish" intent → "publish" (live immediately, WordPress-owned)
    // - "schedule" intent → "future" (WordPress-owned scheduled publish using
    //   the calendar entry's scheduled_for date; WordPress controls when it goes live)
    // - "draft" intent (default) → "draft"
    let wpStatus: string;
    if (publishIntent === "publish") {
      wpStatus = "publish";
    } else if (publishIntent === "schedule") {
      wpStatus = "future";
    } else {
      wpStatus = "draft";
    }

    // Build the post payload including optional publish metadata.
    // slug and excerpt are sent as plain strings when present.
    // categories and tags require resolved WP term IDs; the user enters
    // these as comma-separated integers in the history detail panel or the
    // calendar entry editor.
    // When the history row has no categories/tags, fall back to the calendar
    // entry's reference values (also parsed as IDs).
    const postPayload: Record<string, unknown> = {
      title: finalTitle,
      content: htmlContent,
      status: wpStatus,
    };

    // When scheduling, pass the calendar entry's planned date to WordPress so it
    // owns the exact publish time. WordPress requires the date in ISO 8601 format.
    // We use noon UTC (T12:00:00Z) to avoid WordPress silently shifting the date
    // due to timezone differences.
    if (wpStatus === "future" && resolvedCalendarEntry?.scheduled_for) {
      postPayload.date = `${resolvedCalendarEntry.scheduled_for}T12:00:00Z`;
    }

    const wpSlug = existingHistory?.wp_slug?.trim();
    if (wpSlug) {
      postPayload.slug = wpSlug;
    }

    const wpExcerpt = existingHistory?.wp_excerpt?.trim();
    if (wpExcerpt) {
      postPayload.excerpt = wpExcerpt;
    }

    const categoryIds = parseTermIds(
      existingHistory?.wp_categories ?? resolvedCalendarEntry?.wp_category
    );
    if (categoryIds.length > 0) {
      postPayload.categories = categoryIds;
    }

    const tagIds = parseTermIds(
      existingHistory?.wp_tags ?? resolvedCalendarEntry?.wp_tags
    );
    if (tagIds.length > 0) {
      postPayload.tags = tagIds;
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: buildWordPressAuthHeader(username, appPassword),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(postPayload),
      cache: "no-store",
    });

    if (!response.ok) {
      const message = await response.text();
      const errorMessage = `WordPress publish failed: ${message}`;

      // Record the failure on the history row so it is retryable
      let failedHistory = null;
      if (typeof historyId === "number") {
        failedHistory = markHistoryPublishFailed(historyId, errorMessage) ?? null;
      }

      return NextResponse.json(
        { error: errorMessage, history: failedHistory },
        { status: response.status }
      );
    }

    const draft = await response.json();
    const resolvedPublishState: "draft_created" | "draft_updated" | "published" | "scheduled" =
      draft.status === "publish"
        ? "published"
        : draft.status === "future"
          ? "scheduled"
          : syncAction === "updated"
            ? "draft_updated"
            : "draft_created";
    let updatedHistory = null;

    if (typeof historyId === "number") {
      if (existingHistory) {
        updatedHistory = updateHistoryWordPressDraft(historyId, {
          wp_post_id: draft.id,
          wp_status: draft.status,
          wp_url: draft.link,
          wp_last_published_at: new Date().toISOString(),
          wp_last_sync_action: syncAction,
          wp_publish_state: resolvedPublishState,
        }) ?? null;
      }
    }

    syncCalendarEntryWordPressDraft({
      calendarId: typeof calendarId === "number" ? calendarId : null,
      historyId: typeof historyId === "number" ? historyId : null,
      wpPostId: draft.id,
    });

    return NextResponse.json({
      success: true,
      action: syncAction,
      postId: draft.id,
      status: draft.status,
      publishState: resolvedPublishState,
      url: draft.link,
      title: draft.title?.rendered || finalTitle,
      history: updatedHistory,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to publish draft";
    const failedHistory = typeof requestHistoryId === "number"
      ? markHistoryPublishFailed(requestHistoryId, message) ?? null
      : null;
    return NextResponse.json({ error: message, history: failedHistory }, { status: 500 });
  }
}