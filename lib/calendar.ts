export const CALENDAR_STATUSES = [
  "backlog",
  "planned",
  "in-progress",
  "ready",
  "published",
] as const;

export const CALENDAR_PUBLISH_INTENTS = ["draft", "publish", "schedule"] as const;
export const CALENDAR_APPROVAL_STATUSES = [
  "not_requested",
  "pending_review",
  "changes_requested",
  "approved",
  "blocked",
] as const;

export type CalendarEntryStatus = (typeof CALENDAR_STATUSES)[number];
export type CalendarPublishIntent = (typeof CALENDAR_PUBLISH_INTENTS)[number];
export type CalendarApprovalStatus = (typeof CALENDAR_APPROVAL_STATUSES)[number];

export interface CalendarChecklistItem {
  text: string;
  completed: boolean;
}

export const CALENDAR_STATUS_LABELS: Record<CalendarEntryStatus, string> = {
  backlog: "Backlog",
  planned: "Planned",
  "in-progress": "In Progress",
  ready: "Ready",
  published: "Published",
};

export const CALENDAR_PUBLISH_INTENT_LABELS: Record<CalendarPublishIntent, string> = {
  draft: "Draft",
  publish: "Publish",
  schedule: "Schedule",
};

export const CALENDAR_APPROVAL_STATUS_LABELS: Record<CalendarApprovalStatus, string> = {
  not_requested: "Not Requested",
  pending_review: "Pending Review",
  changes_requested: "Changes Requested",
  approved: "Approved",
  blocked: "Blocked",
};

export interface CalendarEntry {
  id: number;
  title: string;
  tool_slug: string;
  status: CalendarEntryStatus;
  scheduled_for: string | null;
  review_due_at: string | null;
  brief: string | null;
  keywords: string | null;
  audience: string | null;
  notes: string | null;
  checklist_items: CalendarChecklistItem[];
  owner: string | null;
  reviewer: string | null;
  approval_status: CalendarApprovalStatus;
  blocked_reason: string | null;
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
  publishIntent?: CalendarPublishIntent;
  scheduledFrom?: string;
  scheduledTo?: string;
}

export interface CalendarSummary {
  total: number;
  overdue: number;
  dueThisWeek: number;
  unscheduled: number;
  blocked: number;
  reviewDueSoon: number;
  byStatus: Record<CalendarEntryStatus, number>;
  byPublishIntent: Record<CalendarPublishIntent, number>;
  byApprovalStatus: Record<CalendarApprovalStatus, number>;
}

export function isCalendarStatus(value: string): value is CalendarEntryStatus {
  return CALENDAR_STATUSES.includes(value as CalendarEntryStatus);
}

export function isCalendarPublishIntent(value: string): value is CalendarPublishIntent {
  return CALENDAR_PUBLISH_INTENTS.includes(value as CalendarPublishIntent);
}

export function isCalendarApprovalStatus(value: string): value is CalendarApprovalStatus {
  return CALENDAR_APPROVAL_STATUSES.includes(value as CalendarApprovalStatus);
}
