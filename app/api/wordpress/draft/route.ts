import { NextRequest, NextResponse } from "next/server";
import {
  getHistoryById,
  getWordPressSettings,
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { content, title, historyId, calendarId } = body as {
      content?: string;
      title?: string;
      historyId?: number;
      calendarId?: number;
    };

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

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: buildWordPressAuthHeader(username, appPassword),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: finalTitle,
        content: htmlContent,
        status: "draft",
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      const message = await response.text();
      return NextResponse.json(
        { error: `WordPress publish failed: ${message}` },
        { status: response.status }
      );
    }

    const draft = await response.json();
    let updatedHistory = null;

    if (typeof historyId === "number") {
      if (existingHistory) {
        updatedHistory = updateHistoryWordPressDraft(historyId, {
          wp_post_id: draft.id,
          wp_status: draft.status,
          wp_url: draft.link,
          wp_last_published_at: new Date().toISOString(),
          wp_last_sync_action: syncAction,
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
      url: draft.link,
      title: draft.title?.rendered || finalTitle,
      history: updatedHistory,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to publish draft";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}