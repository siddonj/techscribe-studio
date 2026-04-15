export const CALENDAR_STATUSES = [
  "backlog",
  "planned",
  "in-progress",
  "ready",
  "published",
] as const;

export const CALENDAR_PUBLISH_INTENTS = ["draft", "publish"] as const;

export type CalendarEntryStatus = (typeof CALENDAR_STATUSES)[number];
export type CalendarPublishIntent = (typeof CALENDAR_PUBLISH_INTENTS)[number];

export const CALENDAR_STATUS_LABELS: Record<CalendarEntryStatus, string> = {
  backlog: "Backlog",
  planned: "Planned",
  "in-progress": "In Progress",
  ready: "Ready",
  published: "Published",
};

export interface CalendarEntry {
  id: number;
  title: string;
  tool_slug: string;
  status: CalendarEntryStatus;
  scheduled_for: string | null;
  brief: string | null;
  keywords: string | null;
  audience: string | null;
  notes: string | null;
  wp_category: string | null;
  wp_tags: string | null;
  publish_intent: CalendarPublishIntent;
  history_id: number | null;
  wp_post_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface CalendarQueryOptions {
  status?: CalendarEntryStatus;
  toolSlug?: string;
  scheduledFrom?: string;
  scheduledTo?: string;
}

export interface CalendarSummary {
  total: number;
  overdue: number;
  dueThisWeek: number;
  unscheduled: number;
  byStatus: Record<CalendarEntryStatus, number>;
}

export function isCalendarStatus(value: string): value is CalendarEntryStatus {
  return CALENDAR_STATUSES.includes(value as CalendarEntryStatus);
}

export function isCalendarPublishIntent(value: string): value is CalendarPublishIntent {
  return CALENDAR_PUBLISH_INTENTS.includes(value as CalendarPublishIntent);
}
