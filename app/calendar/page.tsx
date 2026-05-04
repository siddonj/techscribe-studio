"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, Search } from "lucide-react";
import {
  CALENDAR_APPROVAL_STATUSES,
  CALENDAR_APPROVAL_STATUS_LABELS,
  CALENDAR_PUBLISH_INTENTS,
  CALENDAR_PUBLISH_INTENT_LABELS,
  CALENDAR_STATUSES,
  CALENDAR_STATUS_LABELS,
  type CalendarApprovalStatus,
  type CalendarChecklistItem,
  type CalendarEntry,
  type CalendarEntryStatus,
  type CalendarPublishIntent,
  type CalendarSummary,
} from "@/lib/calendar";
import { TOOLS, getToolBySlug } from "@/lib/tools";
import { ControlBar, EmptyState, PageContainer, PageHeader, SectionHeader, StatusStrip, SurfaceNotice } from "@/components/DashboardPrimitives";

interface CalendarResponse {
  rows: CalendarEntry[];
  summary: CalendarSummary;
}

interface CalendarDraft {
  title: string;
  tool_slug: string;
  status: CalendarEntryStatus;
  scheduled_for: string;
  review_due_at: string;
  brief: string;
  keywords: string;
  audience: string;
  notes: string;
  checklist_text: string;
  owner: string;
  reviewer: string;
  approval_status: CalendarApprovalStatus;
  blocked_reason: string;
  wp_category: string;
  wp_tags: string;
}

const CALENDAR_VIEW_PREFS_KEY = "techscribe-calendar-view-prefs";

const inputClassName =
  "shell-input w-full rounded-2xl px-3.5 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none transition-colors";

function createEmptyDraft(): CalendarDraft {
  return {
    title: "",
    tool_slug: "article-writer",
    status: "planned",
    scheduled_for: "",
    review_due_at: "",
    brief: "",
    keywords: "",
    audience: "",
    notes: "",
    checklist_text: "",
    owner: "",
    reviewer: "",
    approval_status: "not_requested",
    blocked_reason: "",
    wp_category: "",
    wp_tags: "",
  };
}

function getTodayValue() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
}

function getFutureDateValue(days: number) {
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + days);
  return new Date(nextDate.getTime() - nextDate.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
}

function getWeekDates(offset: number): string[] {
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(now.getDate() - now.getDay() + offset * 7);
  startDate.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  });
}

interface MonthCell {
  dateValue: string;
  isCurrentMonth: boolean;
}

function getMonthCells(offset: number): MonthCell[] {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const targetMonth = target.getMonth();
  const targetYear = target.getFullYear();
  const startDate = new Date(target);
  startDate.setDate(1 - target.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    return {
      dateValue: new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10),
      isCurrentMonth: d.getMonth() === targetMonth && d.getFullYear() === targetYear,
    };
  });
}

function formatMonthLabel(offset: number): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + offset, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function formatWeekRange(dates: string[]): string {
  if (dates.length === 0) return "";
  const first = new Date(`${dates[0]}T00:00:00`);
  const last = new Date(`${dates[dates.length - 1]}T00:00:00`);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${first.toLocaleDateString(undefined, opts)} – ${last.toLocaleDateString(undefined, { ...opts, year: "numeric" })}`;
}

function formatDateLabel(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function getStatusBadgeClass(status: CalendarEntryStatus) {
  switch (status) {
    case "backlog":
      return "border-slate-300/60 bg-slate-100/80 text-slate-600";
    case "planned":
      return "border-sky-300/60 bg-sky-50 text-sky-700";
    case "in-progress":
      return "border-amber-300/60 bg-amber-50 text-amber-700";
    case "ready":
      return "border-emerald-300/60 bg-emerald-50 text-emerald-700";
    case "published":
      return "border-fuchsia-300/60 bg-fuchsia-50 text-fuchsia-700";
  }
}

function getApprovalBadgeClass(status: CalendarApprovalStatus) {
  switch (status) {
    case "pending_review":
      return "border-sky-300/60 bg-sky-50 text-sky-700";
    case "changes_requested":
      return "border-amber-300/60 bg-amber-50 text-amber-700";
    case "approved":
      return "border-emerald-300/60 bg-emerald-50 text-emerald-700";
    case "blocked":
      return "border-rose-300/60 bg-rose-50 text-rose-700";
    case "not_requested":
      return "border-slate-300/60 bg-slate-100/80 text-slate-600";
  }
}

function checklistToText(items: CalendarChecklistItem[]) {
  return items.map((item) => `${item.completed ? "[x]" : "[ ]"} ${item.text}`).join("\n");
}

function textToChecklist(value: string): CalendarChecklistItem[] {
  return value
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return null;
      }

      const completed = /^\[x\]\s*/i.test(trimmed);
      const text = trimmed.replace(/^\[(x| )\]\s*/i, "").trim();
      if (!text) {
        return null;
      }

      return { text, completed };
    })
    .filter((item): item is CalendarChecklistItem => Boolean(item));
}

function getChecklistProgress(items: CalendarChecklistItem[]) {
  const total = items.length;
  const completed = items.filter((item) => item.completed).length;
  return { total, completed };
}

function buildToolHref(entry: CalendarDraft | CalendarEntry) {
  const params = new URLSearchParams();
  const title = String(entry.title ?? "").trim();
  const keywords = String(entry.keywords ?? "").trim();
  const audience = String(entry.audience ?? "").trim();
  const brief = String(entry.brief ?? "").trim();

  if (title) {
    params.set("topic", title);
  }
  if (keywords) {
    params.set("keywords", keywords);
  }
  if (audience) {
    params.set("audience", audience);
  }
  if (brief) {
    params.set("context", brief);
  }

  const query = params.toString();
  return query ? `/tool/${entry.tool_slug}?${query}` : `/tool/${entry.tool_slug}`;
}

function toDraft(entry: CalendarEntry): CalendarDraft {
  return {
    title: entry.title,
    tool_slug: entry.tool_slug,
    status: entry.status,
    scheduled_for: entry.scheduled_for ?? "",
    review_due_at: entry.review_due_at ?? "",
    brief: entry.brief ?? "",
    keywords: entry.keywords ?? "",
    audience: entry.audience ?? "",
    notes: entry.notes ?? "",
    checklist_text: checklistToText(entry.checklist_items),
    owner: entry.owner ?? "",
    reviewer: entry.reviewer ?? "",
    approval_status: entry.approval_status,
    blocked_reason: entry.blocked_reason ?? "",
    wp_category: entry.wp_category ?? "",
    wp_tags: entry.wp_tags ?? "",
  };
}

function toPayload(draft: CalendarDraft) {
  return {
    ...draft,
    scheduled_for: draft.scheduled_for.trim() || null,
    review_due_at: draft.review_due_at.trim() || null,
    brief: draft.brief.trim() || null,
    keywords: draft.keywords.trim() || null,
    audience: draft.audience.trim() || null,
    notes: draft.notes.trim() || null,
    checklist_items: textToChecklist(draft.checklist_text),
    owner: draft.owner.trim() || null,
    reviewer: draft.reviewer.trim() || null,
    approval_status: draft.approval_status,
    blocked_reason: draft.approval_status === "blocked"
      ? draft.blocked_reason.trim() || null
      : null,
    wp_category: draft.wp_category.trim() || null,
    wp_tags: draft.wp_tags.trim() || null,
  };
}

export default function CalendarPage() {
  const [rows, setRows] = useState<CalendarEntry[]>([]);
  const [summary, setSummary] = useState<CalendarSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [toolFilter, setToolFilter] = useState<string>("all");
  const [publishIntentFilter, setPublishIntentFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [createDraft, setCreateDraft] = useState<CalendarDraft>(() => ({
    ...createEmptyDraft(),
    scheduled_for: getTodayValue(),
  }));
  const [editorDraft, setEditorDraft] = useState<CalendarDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "week" | "month">("list");
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [quickRescheduling, setQuickRescheduling] = useState(false);
  const [editorTab, setEditorTab] = useState<"details" | "brief" | "workflow" | "publishing">("details");
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(CALENDAR_VIEW_PREFS_KEY);
      if (!raw) return;
      const prefs = JSON.parse(raw) as Partial<{
        statusFilter: string;
        toolFilter: string;
        publishIntentFilter: string;
        viewMode: "list" | "week" | "month";
        weekOffset: number;
        monthOffset: number;
        showAdvanced: boolean;
      }>;
      if (prefs.statusFilter) setStatusFilter(prefs.statusFilter);
      if (prefs.toolFilter) setToolFilter(prefs.toolFilter);
      if (prefs.publishIntentFilter) setPublishIntentFilter(prefs.publishIntentFilter);
      if (prefs.viewMode) setViewMode(prefs.viewMode);
      if (typeof prefs.weekOffset === "number") setWeekOffset(prefs.weekOffset);
      if (typeof prefs.monthOffset === "number") setMonthOffset(prefs.monthOffset);
      if (typeof prefs.showAdvanced === "boolean") setShowAdvanced(prefs.showAdvanced);
    } catch {
      // ignore saved view errors
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        CALENDAR_VIEW_PREFS_KEY,
        JSON.stringify({
          statusFilter,
          toolFilter,
          publishIntentFilter,
          viewMode,
          weekOffset,
          monthOffset,
          showAdvanced,
        })
      );
    } catch {
      // ignore saved view errors
    }
  }, [statusFilter, toolFilter, publishIntentFilter, viewMode, weekOffset, monthOffset, showAdvanced]);

  // When arriving via a "Plan in Calendar" handoff from a keyword research
  // brief, URL params pre-fill the Quick Plan form so the user can schedule
  // the planned content without re-typing the researched title and keywords.
  // window.location.search is read on the client side only (inside useEffect)
  // so no Suspense boundary is required.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const prefillTitle = params.get("title")?.trim() ?? "";
    const prefillKeywords = params.get("keywords")?.trim() ?? "";
    const prefillAudience = params.get("audience")?.trim() ?? "";
    if (prefillTitle || prefillKeywords || prefillAudience) {
      setCreateDraft((current) => ({
        ...current,
        ...(prefillTitle ? { title: prefillTitle } : {}),
        ...(prefillKeywords ? { keywords: prefillKeywords } : {}),
        ...(prefillAudience ? { audience: prefillAudience } : {}),
      }));
    }
  }, []);

  const fetchCalendar = useCallback(async (preferredId?: number | null) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") {
        params.set("status", statusFilter);
      }
      if (toolFilter !== "all") {
        params.set("tool", toolFilter);
      }
      if (publishIntentFilter !== "all") {
        params.set("publish_intent", publishIntentFilter);
      }

      const res = await fetch(`/api/calendar?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Failed to load calendar");
      }

      const data = (await res.json()) as CalendarResponse;
      setRows(data.rows);
      setSummary(data.summary);
      setSelectedId((currentSelectedId) => {
        if (preferredId && data.rows.some((row) => row.id === preferredId)) {
          return preferredId;
        }

        if (currentSelectedId && data.rows.some((row) => row.id === currentSelectedId)) {
          return currentSelectedId;
        }

        return data.rows[0]?.id ?? null;
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load calendar");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, toolFilter, publishIntentFilter]);

  useEffect(() => {
    void fetchCalendar();
  }, [fetchCalendar]);

  const selectedEntry = useMemo(
    () => rows.find((row) => row.id === selectedId) ?? null,
    [rows, selectedId]
  );

  useEffect(() => {
    setEditorDraft(selectedEntry ? toDraft(selectedEntry) : null);
  }, [selectedEntry]);

  const rowsByScheduledDate = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const row of rows) {
      if (!row.scheduled_for) continue;
      const existing = map.get(row.scheduled_for) ?? [];
      existing.push(row);
      map.set(row.scheduled_for, existing);
    }
    return map;
  }, [rows]);

  const groupedSections = useMemo(() => {
    const todayValue = getTodayValue();
    const thisWeekValue = getFutureDateValue(7);
    const overdue = rows.filter((row) => row.scheduled_for && row.scheduled_for < todayValue && row.status !== "published");
    const today = rowsByScheduledDate.get(todayValue) ?? [];
    const upcomingByDate = new Map<string, CalendarEntry[]>();
    const later: CalendarEntry[] = [];
    const unscheduled = rows.filter((row) => !row.scheduled_for);

    for (const row of rows) {
      if (!row.scheduled_for || row.scheduled_for <= todayValue) {
        continue;
      }

      if (row.scheduled_for <= thisWeekValue) {
        const existing = rowsByScheduledDate.get(row.scheduled_for) ?? [];
        upcomingByDate.set(row.scheduled_for, existing);
        continue;
      }

      later.push(row);
    }

    const sections: Array<{ id: string; title: string; rows: CalendarEntry[] }> = [];

    if (overdue.length) {
      sections.push({ id: "overdue", title: "Overdue", rows: overdue });
    }

    if (today.length) {
      sections.push({ id: "today", title: "Today", rows: today });
    }

    for (const [dateValue, dateRows] of Array.from(upcomingByDate.entries()).sort(([left], [right]) => left.localeCompare(right))) {
      sections.push({
        id: dateValue,
        title: formatDateLabel(dateValue),
        rows: dateRows,
      });
    }

    if (later.length) {
      sections.push({ id: "later", title: "Later", rows: later });
    }

    if (unscheduled.length) {
      sections.push({ id: "unscheduled", title: "Unscheduled", rows: unscheduled });
    }

    return sections;
  }, [rows, rowsByScheduledDate]);

  const weekDates = useMemo(
    () => (viewMode === "week" ? getWeekDates(weekOffset) : []),
    [viewMode, weekOffset],
  );

  const weekItemsByDate = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const date of weekDates) {
      map.set(date, rowsByScheduledDate.get(date) ?? []);
    }
    return map;
  }, [weekDates, rowsByScheduledDate]);

  const weekUnscheduled = useMemo(
    () => (viewMode === "week" ? rows.filter((r) => !r.scheduled_for) : []),
    [viewMode, rows],
  );

  const monthCells = useMemo(
    () => (viewMode === "month" ? getMonthCells(monthOffset) : []),
    [viewMode, monthOffset],
  );

  const monthItemsByDate = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const cell of monthCells) {
      map.set(cell.dateValue, rowsByScheduledDate.get(cell.dateValue) ?? []);
    }
    return map;
  }, [monthCells, rowsByScheduledDate]);

  const monthUnscheduled = useMemo(
    () => (viewMode === "month" ? rows.filter((r) => !r.scheduled_for) : []),
    [viewMode, rows],
  );

  async function handleCreateEntry() {
    setCreating(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload(createDraft)),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create calendar entry");
      }

      setCreateDraft({
        ...createEmptyDraft(),
        tool_slug: createDraft.tool_slug,
        scheduled_for: createDraft.scheduled_for,
      });
      setMessage("Calendar entry created.");
      await fetchCalendar(data.id as number);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create calendar entry");
    } finally {
      setCreating(false);
    }
  }

  async function handleSaveSelected() {
    if (!selectedEntry || !editorDraft) {
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(`/api/calendar/${selectedEntry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload(editorDraft)),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update calendar entry");
      }

      setMessage("Calendar entry updated.");
      await fetchCalendar(selectedEntry.id);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update calendar entry");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteSelected() {
    if (!selectedEntry) {
      return;
    }
    if (!window.confirm(`Delete "${selectedEntry.title}" from the calendar?`)) {
      return;
    }

    setDeleting(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(`/api/calendar/${selectedEntry.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete calendar entry");
      }

      setMessage("Calendar entry deleted.");
      await fetchCalendar();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete calendar entry");
    } finally {
      setDeleting(false);
    }
  }

  async function handleQuickRescheduleById(id: number, dateValue: string) {
    const entry = rows.find((r) => r.id === id);
    if (!entry) return;
    const newDate = dateValue.trim() || null;
    setQuickRescheduling(true);
    setError(null);
    setMessage(null);
    // Optimistic update — reflect the new date in the UI immediately
    setRows((current) =>
      current.map((r) => (r.id === id ? { ...r, scheduled_for: newDate } : r))
    );
    setSelectedId(id);
    try {
      const res = await fetch(`/api/calendar/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...toPayload(toDraft(entry)), scheduled_for: newDate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reschedule");
      setMessage(newDate ? `Moved to ${formatDateLabel(newDate)}.` : "Item unscheduled.");
      await fetchCalendar(id);
    } catch (rescheduleError) {
      setError(rescheduleError instanceof Error ? rescheduleError.message : "Failed to reschedule");
      await fetchCalendar();
    } finally {
      setQuickRescheduling(false);
    }
  }

  async function handleQuickReschedule(dateValue: string) {
    if (!selectedEntry) return;
    await handleQuickRescheduleById(selectedEntry.id, dateValue);
  }

  return (
    <div className="min-h-screen flex flex-col">
      <PageContainer maxWidthClassName="max-w-7xl" className="flex flex-1 overflow-hidden flex-col gap-6">
        <PageHeader
          eyebrow="Phase 2 Planner"
          title="Content Calendar"
          description="Prioritize the queue, attach writing context, and move any planned item directly into a prefilled generation workflow."
          stats={[
            { label: "Total", value: summary?.total ?? rows.length },
            { label: "This Week", value: summary?.dueThisWeek ?? 0 },
            { label: "Overdue", value: summary?.overdue ?? 0 },
            { label: "Blocked", value: summary?.blocked ?? 0 },
            { label: "Review Due", value: summary?.reviewDueSoon ?? 0 },
          ]}
        />

        <StatusStrip
          columnsClassName="xl:grid-cols-5"
          items={[
            { label: "Backlog", value: summary?.byStatus.backlog ?? 0 },
            { label: "Planned", value: summary?.byStatus.planned ?? 0 },
            { label: "In Progress", value: summary?.byStatus["in-progress"] ?? 0 },
            { label: "Ready", value: summary?.byStatus.ready ?? 0 },
            { label: "Pending Review", value: summary?.byApprovalStatus.pending_review ?? 0 },
          ]}
        />

        <section className="shell-panel rounded-[2rem] p-5 space-y-4">
          <SectionHeader
            eyebrow="Quick Plan"
            title="Create and queue content"
            description="Add a title, pick a tool, and set a date."
            actions={(
              <Link href={buildToolHref(createDraft)} className="btn-secondary rounded-2xl px-4 py-2.5 text-sm">
                Open Tool
              </Link>
            )}
          />

          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto] gap-3 items-end">
            <input
              className={inputClassName}
              placeholder="Content title or angle"
              value={createDraft.title}
              onChange={(event) => setCreateDraft((current) => ({ ...current, title: event.target.value }))}
            />
            <select
              className={inputClassName}
              value={createDraft.tool_slug}
              onChange={(event) => setCreateDraft((current) => ({ ...current, tool_slug: event.target.value }))}
            >
              {TOOLS.map((tool) => (
                <option key={tool.slug} value={tool.slug}>{tool.icon} {tool.name}</option>
              ))}
            </select>
            <input
              type="date"
              className={inputClassName}
              value={createDraft.scheduled_for}
              onChange={(event) => setCreateDraft((current) => ({ ...current, scheduled_for: event.target.value }))}
            />
            <button
              onClick={handleCreateEntry}
              disabled={creating || !createDraft.title.trim()}
              className="bg-accent text-white font-semibold px-5 py-3 rounded-2xl text-sm hover:bg-accent-dim transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {creating ? "Adding..." : "Add"}
            </button>
          </div>

          <button
            onClick={() => setShowAdvanced((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            <span className={`transition-transform ${showAdvanced ? "rotate-90" : ""}`}>›</span>
            {showAdvanced ? "Hide" : "Advanced"} options
          </button>

          {showAdvanced && (
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  className={inputClassName}
                  placeholder="Keywords"
                  value={createDraft.keywords}
                  onChange={(event) => setCreateDraft((current) => ({ ...current, keywords: event.target.value }))}
                />
                <input
                  className={inputClassName}
                  placeholder="Audience"
                  value={createDraft.audience}
                  onChange={(event) => setCreateDraft((current) => ({ ...current, audience: event.target.value }))}
                />
                <input
                  type="date"
                  className={inputClassName}
                  value={createDraft.review_due_at}
                  onChange={(event) => setCreateDraft((current) => ({ ...current, review_due_at: event.target.value }))}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <input
                  className={inputClassName}
                  placeholder="Owner"
                  value={createDraft.owner}
                  onChange={(event) => setCreateDraft((current) => ({ ...current, owner: event.target.value }))}
                />
                <input
                  className={inputClassName}
                  placeholder="Reviewer"
                  value={createDraft.reviewer}
                  onChange={(event) => setCreateDraft((current) => ({ ...current, reviewer: event.target.value }))}
                />
                <select
                  className={inputClassName}
                  value={createDraft.status}
                  onChange={(event) => setCreateDraft((current) => ({ ...current, status: event.target.value as CalendarEntryStatus }))}
                >
                  {CALENDAR_STATUSES.map((status) => (
                    <option key={status} value={status}>{CALENDAR_STATUS_LABELS[status]}</option>
                  ))}
                </select>
                <select
                  className={inputClassName}
                  value={createDraft.approval_status}
                  onChange={(event) => setCreateDraft((current) => ({
                    ...current,
                    approval_status: event.target.value as CalendarApprovalStatus,
                    blocked_reason: event.target.value === "blocked" ? current.blocked_reason : "",
                  }))}
                >
                  {CALENDAR_APPROVAL_STATUSES.map((status) => (
                    <option key={status} value={status}>{CALENDAR_APPROVAL_STATUS_LABELS[status]}</option>
                  ))}
                </select>
              </div>
              <textarea
                className={`${inputClassName} resize-none`}
                rows={2}
                placeholder="Brief or planning note"
                value={createDraft.brief}
                onChange={(event) => setCreateDraft((current) => ({ ...current, brief: event.target.value }))}
              />
              <textarea
                className={`${inputClassName} resize-none`}
                rows={3}
                placeholder="Checklist items, one per line"
                value={createDraft.checklist_text}
                onChange={(event) => setCreateDraft((current) => ({ ...current, checklist_text: event.target.value }))}
              />
            </div>
          )}
        </section>

        {(error || message) && (
          <section className="space-y-2">
            {error && <SurfaceNotice tone="error">{error}</SurfaceNotice>}
            {message && <SurfaceNotice tone="success">{message}</SurfaceNotice>}
          </section>
        )}

        <div className="flex-1 min-h-0 flex gap-6 overflow-hidden">
          <aside className={`${viewMode === "list" ? "w-[28rem] shrink-0" : "flex-1"} shell-panel rounded-[2rem] overflow-hidden flex flex-col`}>
            <ControlBar className="rounded-none border-0 border-b border-white/5 space-y-3 bg-white/[0.02] sticky top-0 z-10">
              <div className="flex items-center justify-between gap-3">
                <div className="flex gap-1 rounded-2xl bg-black/15 p-1 border border-white/5">
                  <button
                    onClick={() => setViewMode("list")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono transition-colors ${viewMode === "list" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"}`}
                  >
                    List
                  </button>
                  <button
                    onClick={() => setViewMode("week")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono transition-colors ${viewMode === "week" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"}`}
                  >
                    Week
                  </button>
                  <button
                    onClick={() => setViewMode("month")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono transition-colors ${viewMode === "month" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"}`}
                  >
                    Month
                  </button>
                </div>
                {viewMode === "week" && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setWeekOffset((n) => n - 1)}
                      className="text-slate-600 hover:text-slate-900 text-sm px-2 py-1 border border-border rounded-xl transition-colors"
                    >
                      ‹
                    </button>
                    <span className="text-xs text-slate-500 font-mono">{formatWeekRange(weekDates)}</span>
                    <button
                      onClick={() => setWeekOffset((n) => n + 1)}
                      className="text-slate-600 hover:text-slate-900 text-sm px-2 py-1 border border-border rounded-xl transition-colors"
                    >
                      ›
                    </button>
                    {weekOffset !== 0 && (
                      <button
                        onClick={() => setWeekOffset(0)}
                        className="text-xs text-accent hover:text-accent-dim px-2 py-1 transition-colors"
                      >
                        Today
                      </button>
                    )}
                  </div>
                )}
                {viewMode === "month" && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setMonthOffset((n) => n - 1)}
                      className="text-slate-600 hover:text-slate-900 text-sm px-2 py-1 border border-border rounded-xl transition-colors"
                    >
                      ‹
                    </button>
                    <span className="text-xs text-slate-500 font-mono">{formatMonthLabel(monthOffset)}</span>
                    <button
                      onClick={() => setMonthOffset((n) => n + 1)}
                      className="text-slate-600 hover:text-slate-900 text-sm px-2 py-1 border border-border rounded-xl transition-colors"
                    >
                      ›
                    </button>
                    {monthOffset !== 0 && (
                      <button
                        onClick={() => setMonthOffset(0)}
                        className="text-xs text-accent hover:text-accent-dim px-2 py-1 transition-colors"
                      >
                        Today
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <select
                  className={inputClassName}
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <option value="all">All statuses</option>
                  {CALENDAR_STATUSES.map((status) => (
                    <option key={status} value={status}>{CALENDAR_STATUS_LABELS[status]}</option>
                  ))}
                </select>
                <select
                  className={inputClassName}
                  value={toolFilter}
                  onChange={(event) => setToolFilter(event.target.value)}
                >
                  <option value="all">All tools</option>
                  {TOOLS.map((tool) => (
                    <option key={tool.slug} value={tool.slug}>{tool.name}</option>
                  ))}
                </select>
                <select
                  className={inputClassName}
                  value={publishIntentFilter}
                  onChange={(event) => setPublishIntentFilter(event.target.value)}
                >
                  <option value="all">All intents</option>
                  {CALENDAR_PUBLISH_INTENTS.map((intent) => (
                    <option key={intent} value={intent}>{CALENDAR_PUBLISH_INTENT_LABELS[intent]}</option>
                  ))}
                </select>
              </div>
              {viewMode === "list" && (
                <p className="text-xs text-slate-500">View the schedule by due date, then open a card to edit the plan or jump straight into a tool.</p>
              )}
              {viewMode === "week" && selectedEntry && (
                <p className="text-xs text-accent/80">
                  <span className="font-mono">↑ Click any day to instantly move</span> <span className="text-slate-900">{selectedEntry.title}</span> <span className="text-slate-500">to that date.</span>
                </p>
              )}
            </ControlBar>

            {viewMode === "list" && (
              <div className="flex-1 overflow-y-auto">
                {loading && (
                  <div className="p-6 text-sm text-slate-500 font-mono animate-pulse">Loading calendar...</div>
                )}

                {!loading && rows.length === 0 && (statusFilter !== "all" || toolFilter !== "all" || publishIntentFilter !== "all") && (
                  <div className="p-6 text-center">
                    <Search className="w-8 h-8 opacity-30 text-slate-400 mx-auto mb-3" />
                    <p className="text-sm text-slate-400">No items match the active filters.</p>
                    <button
                      onClick={() => { setStatusFilter("all"); setToolFilter("all"); setPublishIntentFilter("all"); }}
                      className="text-xs text-accent hover:text-accent-dim mt-2 transition-colors"
                    >
                      Clear filters
                    </button>
                  </div>
                )}

                {!loading && rows.length === 0 && statusFilter === "all" && toolFilter === "all" && publishIntentFilter === "all" && (
                  <div className="p-6 text-center">
                    <CalendarDays className="w-8 h-8 opacity-30 text-slate-400 mx-auto mb-3" />
                    <p className="text-sm text-slate-400">No planned content yet.</p>
                    <p className="text-xs text-slate-500 mt-1">Add your first scheduled item above to start building the queue.</p>
                  </div>
                )}

                {!loading && groupedSections.map((section) => (
                  <section key={section.id} className="border-b border-white/5 last:border-b-0">
                    <div className="px-4 py-3 bg-white/[0.03] flex items-center justify-between sticky top-0 z-[1]">
                      <p className="font-mono text-xs text-slate-500 uppercase tracking-wider">{section.title}</p>
                      <span className="text-[11px] text-slate-500">{section.rows.length} items</span>
                    </div>

                    <div className="p-2 space-y-2">
                      {section.rows.map((row) => {
                        const tool = getToolBySlug(row.tool_slug);
                        const selected = row.id === selectedId;

                        return (
                          <div
                            key={row.id}
                            className={`surface-interactive p-3 ${selected ? "surface-interactive-selected" : "surface-interactive-default"}`}
                          >
                            <button
                              onClick={() => setSelectedId(row.id)}
                              className="w-full text-left"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm text-slate-900 font-medium truncate">{row.title}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs">{tool?.icon ?? "📝"}</span>
                                    <span className="text-xs text-slate-500 truncate">{tool?.name ?? row.tool_slug}</span>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2 mt-2">
                                    {row.owner && <span className="text-[11px] text-slate-400">Owner: {row.owner}</span>}
                                    {row.approval_status !== "not_requested" && (
                                      <span className={`status-badge ${getApprovalBadgeClass(row.approval_status)}`}>
                                        {CALENDAR_APPROVAL_STATUS_LABELS[row.approval_status]}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <span className={`status-badge shrink-0 ${getStatusBadgeClass(row.status)}`}>
                                  {CALENDAR_STATUS_LABELS[row.status]}
                                </span>
                              </div>
                              {row.keywords && (
                                <p className="text-xs text-slate-400 mt-2 truncate">Keywords: {row.keywords}</p>
                              )}
                              {row.brief && (
                                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{row.brief}</p>
                              )}
                              {(row.review_due_at || row.checklist_items.length > 0) && (
                                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                                  {row.review_due_at && <span>Review: {formatDateLabel(row.review_due_at)}</span>}
                                  {row.checklist_items.length > 0 && (
                                    <span>
                                      {getChecklistProgress(row.checklist_items).completed}/{getChecklistProgress(row.checklist_items).total} checklist done
                                    </span>
                                  )}
                                </div>
                              )}
                            </button>

                            <div className="mt-2 flex items-center gap-1.5 border-t border-white/5 pt-2">
                              <span className="text-xs text-slate-500">📅</span>
                              <input
                                type="date"
                                aria-label="Reschedule date"
                                value={row.scheduled_for ?? ""}
                                disabled={quickRescheduling}
                                onChange={(e) => {
                                  void handleQuickRescheduleById(row.id, e.target.value);
                                }}
                                className="text-xs text-slate-400 bg-transparent border-0 p-0 focus:outline-none focus:ring-1 focus:ring-accent rounded cursor-pointer hover:text-accent transition-colors disabled:opacity-40 [color-scheme:dark]"
                              />
                              {!row.scheduled_for && (
                                <span className="text-xs text-slate-500 italic">unscheduled</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}

            {viewMode === "week" && (
              <div className="flex-1 overflow-auto p-3">
                {loading && (
                  <div className="p-6 text-sm text-slate-500 font-mono animate-pulse">Loading calendar...</div>
                )}

                {!loading && rows.length === 0 && (statusFilter !== "all" || toolFilter !== "all" || publishIntentFilter !== "all") && (
                  <div className="p-6 text-center">
                    <Search className="w-8 h-8 opacity-30 text-slate-400 mx-auto mb-3" />
                    <p className="text-sm text-slate-400">No items match the active filters.</p>
                    <button
                      onClick={() => { setStatusFilter("all"); setToolFilter("all"); setPublishIntentFilter("all"); }}
                      className="text-xs text-accent hover:text-accent-dim mt-2 transition-colors"
                    >
                      Clear filters
                    </button>
                  </div>
                )}

                {!loading && rows.length === 0 && statusFilter === "all" && toolFilter === "all" && publishIntentFilter === "all" && (
                  <div className="p-6 text-center">
                    <CalendarDays className="w-8 h-8 opacity-30 text-slate-400 mx-auto mb-3" />
                    <p className="text-sm text-slate-400">No planned content yet.</p>
                    <p className="text-xs text-slate-500 mt-1">Add your first scheduled item above to start building the queue.</p>
                  </div>
                )}

                {!loading && rows.length > 0 && (
                  <>
                    <div className="grid grid-cols-7 gap-2 min-h-[420px]">
                      {weekDates.map((dateValue) => {
                        const dayItems = weekItemsByDate.get(dateValue) ?? [];
                        const isToday = dateValue === getTodayValue();
                        const isSelected = selectedEntry?.scheduled_for === dateValue;
                        const canMove = !!selectedEntry && dateValue !== selectedEntry.scheduled_for;
                        const dayNumber = new Date(`${dateValue}T00:00:00`).getDate();
                        const weekdayLabel = new Date(`${dateValue}T00:00:00`).toLocaleDateString(undefined, { weekday: "short" });

                        return (
                          <div
                            key={dateValue}
                            className={`flex flex-col border rounded-2xl overflow-hidden transition-colors ${isToday ? "border-accent/50" : isSelected ? "border-accent/30" : "border-white/8"}`}
                          >
                            <button
                              type="button"
                              disabled={!canMove || quickRescheduling}
                              onClick={() => canMove && void handleQuickReschedule(dateValue)}
                              className={`w-full p-2 text-center border-b transition-colors
                                ${isToday ? "bg-accent/10 border-accent/30" : "bg-white/[0.03] border-white/5"}
                                ${canMove ? "cursor-pointer hover:bg-accent/20" : "cursor-default"}
                              `}
                            >
                              <p className="text-xs font-mono text-slate-500 uppercase">{weekdayLabel}</p>
                              <p className={`text-xl font-bold mt-0.5 ${isToday ? "text-accent" : "text-slate-900"}`}>{dayNumber}</p>
                              {canMove && (
                                <p className="text-xs text-accent/60 mt-0.5">Move here</p>
                              )}
                            </button>

                            <div className="flex-1 p-1.5 space-y-1.5 overflow-y-auto">
                              {dayItems.map((row) => {
                                const tool = getToolBySlug(row.tool_slug);
                                const selected = row.id === selectedId;
                                return (
                                  <button
                                    key={row.id}
                                    onClick={() => setSelectedId(row.id)}
                                    className={`w-full text-left border rounded-xl p-2 transition-colors ${selected ? "border-accent/40 bg-accent/8" : "border-white/8 bg-black/10 hover:border-accent/20 hover:bg-white/[0.03]"}`}
                                  >
                                    <p className="text-xs text-slate-900 font-medium leading-snug line-clamp-2">{row.title}</p>
                                    <div className="flex items-center justify-between mt-1.5 gap-1">
                                      <span className="text-xs">{tool?.icon ?? "📝"}</span>
                                      <span className={`status-badge px-1.5 py-0.5 text-xs ${getStatusBadgeClass(row.status)}`}>
                                        {CALENDAR_STATUS_LABELS[row.status]}
                                      </span>
                                    </div>
                                  </button>
                                );
                              })}

                              {canMove && dayItems.length === 0 && (
                                <button
                                  type="button"
                                  disabled={quickRescheduling}
                                  onClick={() => void handleQuickReschedule(dateValue)}
                                  className="w-full text-center text-xs text-slate-500 border border-dashed border-white/10 rounded-xl py-4 hover:border-accent/50 hover:text-accent transition-colors disabled:opacity-40"
                                >
                                  + Move here
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {weekUnscheduled.length > 0 && (
                      <div className="mt-4 border border-white/8 rounded-2xl overflow-hidden">
                        <div className="px-4 py-2 bg-white/[0.03] border-b border-white/5 flex items-center justify-between">
                          <p className="font-mono text-xs text-slate-500 uppercase tracking-wider">Unscheduled</p>
                          <span className="text-xs text-slate-500">{weekUnscheduled.length} items</span>
                        </div>
                        <div className="p-2 flex flex-wrap gap-2">
                          {weekUnscheduled.map((row) => {
                            const tool = getToolBySlug(row.tool_slug);
                            const selected = row.id === selectedId;
                            return (
                              <button
                                key={row.id}
                                onClick={() => setSelectedId(row.id)}
                                className={`text-left border rounded-xl p-2.5 transition-colors w-48 ${selected ? "border-accent/40 bg-accent/8" : "border-white/8 bg-black/10 hover:border-accent/20 hover:bg-white/[0.03]"}`}
                              >
                                <p className="text-xs text-slate-900 font-medium truncate">{row.title}</p>
                                <div className="flex items-center justify-between mt-1.5 gap-1">
                                  <span className="text-xs">{tool?.icon ?? "📝"}</span>
                                  <span className={`status-badge px-1.5 py-0.5 text-xs ${getStatusBadgeClass(row.status)}`}>
                                    {CALENDAR_STATUS_LABELS[row.status]}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {viewMode === "month" && (
              <div className="flex-1 overflow-auto p-3">
                {loading && (
                  <div className="p-6 text-sm text-slate-500 font-mono animate-pulse">Loading calendar...</div>
                )}

                {!loading && rows.length === 0 && (statusFilter !== "all" || toolFilter !== "all" || publishIntentFilter !== "all") && (
                  <div className="p-6 text-center">
                    <Search className="w-8 h-8 opacity-30 text-slate-400 mx-auto mb-3" />
                    <p className="text-sm text-slate-400">No items match the active filters.</p>
                    <button
                      onClick={() => { setStatusFilter("all"); setToolFilter("all"); setPublishIntentFilter("all"); }}
                      className="text-xs text-accent hover:text-accent-dim mt-2 transition-colors"
                    >
                      Clear filters
                    </button>
                  </div>
                )}

                {!loading && rows.length === 0 && statusFilter === "all" && toolFilter === "all" && publishIntentFilter === "all" && (
                  <div className="p-6 text-center">
                    <CalendarDays className="w-8 h-8 opacity-30 text-slate-400 mx-auto mb-3" />
                    <p className="text-sm text-slate-400">No planned content yet.</p>
                    <p className="text-xs text-slate-500 mt-1">Add your first scheduled item above to start building the queue.</p>
                  </div>
                )}

                {!loading && (
                  <>
                    <div className="grid grid-cols-7 gap-px mb-1">
                      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                        <div key={d} className="text-center py-1">
                          <span className="text-xs font-mono text-slate-500 uppercase">{d}</span>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-7 gap-px">
                      {monthCells.map(({ dateValue, isCurrentMonth }) => {
                        const dayItems = monthItemsByDate.get(dateValue) ?? [];
                        const isToday = dateValue === getTodayValue();
                        const canMove = !!selectedEntry && dateValue !== selectedEntry.scheduled_for;
                        const dayNumber = new Date(`${dateValue}T00:00:00`).getDate();

                        return (
                          <div
                            key={dateValue}
                            className={`min-h-[96px] flex flex-col border rounded-xl overflow-hidden transition-colors
                              ${isToday ? "border-accent/50" : "border-white/5"}
                              ${!isCurrentMonth ? "opacity-40" : ""}
                            `}
                          >
                            <button
                              type="button"
                              disabled={!canMove || quickRescheduling}
                              onClick={() => canMove && void handleQuickReschedule(dateValue)}
                              className={`w-full px-2 pt-1.5 pb-1 text-left border-b transition-colors
                                ${isToday ? "bg-accent/10 border-accent/30" : "bg-white/[0.02] border-white/5"}
                                ${canMove ? "cursor-pointer hover:bg-accent/20" : "cursor-default"}
                              `}
                            >
                              <span className={`text-xs font-bold ${isToday ? "text-accent" : isCurrentMonth ? "text-slate-900" : "text-slate-600"}`}>
                                {dayNumber}
                              </span>
                              {canMove && <span className="text-xs text-accent/60 ml-1">+</span>}
                            </button>

                            <div className="flex-1 p-1 space-y-0.5 overflow-y-auto">
                              {dayItems.map((row) => {
                                const selected = row.id === selectedId;
                                return (
                                  <button
                                    key={row.id}
                                    onClick={() => setSelectedId(row.id)}
                                    className={`w-full text-left rounded px-1.5 py-0.5 transition-colors ${selected ? "bg-accent/20 text-accent" : "bg-white/[0.04] hover:bg-white/[0.08] text-slate-900"}`}
                                  >
                                    <p className="text-xs leading-snug truncate">{row.title}</p>
                                    <span className={`status-badge inline-flex px-1 py-0.5 text-xs leading-tight mt-0.5 ${getStatusBadgeClass(row.status)}`}>
                                      {CALENDAR_STATUS_LABELS[row.status]}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {monthUnscheduled.length > 0 && (
                      <div className="mt-4 border border-white/8 rounded-2xl overflow-hidden">
                        <div className="px-4 py-2 bg-white/[0.03] border-b border-white/5 flex items-center justify-between">
                          <p className="font-mono text-xs text-slate-500 uppercase tracking-wider">Unscheduled</p>
                          <span className="text-xs text-slate-500">{monthUnscheduled.length} items</span>
                        </div>
                        <div className="p-2 flex flex-wrap gap-2">
                          {monthUnscheduled.map((row) => {
                            const tool = getToolBySlug(row.tool_slug);
                            const selected = row.id === selectedId;
                            return (
                              <button
                                key={row.id}
                                onClick={() => setSelectedId(row.id)}
                                className={`text-left border rounded-xl p-2.5 transition-colors w-48 ${selected ? "border-accent/40 bg-accent/8" : "border-white/8 bg-black/10 hover:border-accent/20 hover:bg-white/[0.03]"}`}
                              >
                                <p className="text-xs text-slate-900 font-medium truncate">{row.title}</p>
                                <div className="flex items-center justify-between mt-1.5 gap-1">
                                  <span className="text-xs">{tool?.icon ?? "📝"}</span>
                                  <span className={`status-badge px-1.5 py-0.5 text-xs ${getStatusBadgeClass(row.status)}`}>
                                    {CALENDAR_STATUS_LABELS[row.status]}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </aside>

          <section className={`${viewMode === "list" ? "flex-1" : "w-80 shrink-0"} shell-panel rounded-[2rem] overflow-hidden flex flex-col min-w-0`}>
            {!selectedEntry || !editorDraft ? (
              <div className="flex-1 flex items-center justify-center text-center p-8">
                <EmptyState
                  icon={<CalendarDays />}
                  eyebrow="Planned Item"
                  description="Select a calendar entry to update scheduling details, refine the brief, or jump into the assigned writing tool."
                />
              </div>
            ) : (
              <>
                {/* Editor header */}
                <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between gap-3 sticky top-0 z-10 bg-card">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-accent uppercase tracking-widest">Planned Item</p>
                    <h2 className="text-slate-900 text-base font-semibold mt-0.5 truncate">{selectedEntry.title}</h2>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      href={buildToolHref(editorDraft)}
                      className="text-sm border border-border rounded-xl px-3 py-1.5 text-slate-700 hover:text-slate-900 hover:border-accent/40 transition-colors"
                    >
                      Open Tool
                    </Link>
                    <button
                      onClick={handleDeleteSelected}
                      disabled={deleting}
                      className="text-sm border border-red-200 rounded-xl px-3 py-1.5 text-red-600 hover:border-red-300 transition-colors disabled:opacity-50"
                    >
                      {deleting ? "…" : "Delete"}
                    </button>
                    <button
                      onClick={handleSaveSelected}
                      disabled={saving}
                      className="bg-accent text-white font-semibold px-4 py-1.5 rounded-xl text-sm hover:bg-accent-dim transition-colors disabled:opacity-50"
                    >
                      {saving ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>

                {/* Tab bar */}
                <div className="flex border-b border-white/5 px-2 pt-1 shrink-0 sticky top-[73px] z-10 bg-card">
                  {(["details", "brief", "workflow", "publishing"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setEditorTab(tab)}
                      className={`px-3 py-2 text-xs font-mono uppercase tracking-[0.16em] rounded-t-xl transition-colors ${
                        editorTab === tab
                          ? "bg-white/[0.04] text-slate-900 border-b-2 border-accent"
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      {tab === "brief" ? "Brief & Notes" : tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                  ))}
                </div>

                {/* Tab content */}
                <div className="p-5 flex-1 overflow-y-auto space-y-4">

                  {/* Details tab */}
                  {editorTab === "details" && (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                          <label className="block text-xs font-mono text-slate-500 uppercase tracking-wider mb-1.5">Title</label>
                          <input
                            className={inputClassName}
                            value={editorDraft.title}
                            onChange={(event) => setEditorDraft((current) => current ? { ...current, title: event.target.value } : current)}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-mono text-slate-500 uppercase tracking-wider mb-1.5">Tool</label>
                          <select
                            className={inputClassName}
                            value={editorDraft.tool_slug}
                            onChange={(event) => setEditorDraft((current) => current ? { ...current, tool_slug: event.target.value } : current)}
                          >
                            {TOOLS.map((tool) => (
                              <option key={tool.slug} value={tool.slug}>{tool.icon} {tool.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-mono text-slate-500 uppercase tracking-wider mb-1.5">Status</label>
                          <select
                            className={inputClassName}
                            value={editorDraft.status}
                            onChange={(event) => setEditorDraft((current) => current ? { ...current, status: event.target.value as CalendarEntryStatus } : current)}
                          >
                            {CALENDAR_STATUSES.map((status) => (
                              <option key={status} value={status}>{CALENDAR_STATUS_LABELS[status]}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-mono text-slate-500 uppercase tracking-wider mb-1.5">Scheduled For</label>
                          <input
                            type="date"
                            className={inputClassName}
                            value={editorDraft.scheduled_for}
                            onChange={(event) => setEditorDraft((current) => current ? { ...current, scheduled_for: event.target.value } : current)}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-mono text-slate-500 uppercase tracking-wider mb-1.5">Review Due</label>
                          <input
                            type="date"
                            className={inputClassName}
                            value={editorDraft.review_due_at}
                            onChange={(event) => setEditorDraft((current) => current ? { ...current, review_due_at: event.target.value } : current)}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-mono text-slate-500 uppercase tracking-wider mb-1.5">Keywords</label>
                          <input
                            className={inputClassName}
                            placeholder="primary keyword, cluster..."
                            value={editorDraft.keywords}
                            onChange={(event) => setEditorDraft((current) => current ? { ...current, keywords: event.target.value } : current)}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-mono text-slate-500 uppercase tracking-wider mb-1.5">Audience</label>
                          <input
                            className={inputClassName}
                            placeholder="who this piece is for"
                            value={editorDraft.audience}
                            onChange={(event) => setEditorDraft((current) => current ? { ...current, audience: event.target.value } : current)}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3 pt-1">
                        <div className="shell-panel-soft rounded-xl p-3">
                          <p className="font-mono text-[11px] text-slate-500 uppercase tracking-wider">Created</p>
                          <p className="text-xs text-slate-800 mt-1">{new Date(selectedEntry.created_at).toLocaleString()}</p>
                        </div>
                        <div className="shell-panel-soft rounded-xl p-3">
                          <p className="font-mono text-[11px] text-slate-500 uppercase tracking-wider">Updated</p>
                          <p className="text-xs text-slate-800 mt-1">{new Date(selectedEntry.updated_at).toLocaleString()}</p>
                        </div>
                        <div className="shell-panel-soft rounded-xl p-3">
                          <p className="font-mono text-[11px] text-slate-500 uppercase tracking-wider">Tool</p>
                          <p className="text-xs text-slate-800 mt-1">{getToolBySlug(editorDraft.tool_slug)?.name ?? editorDraft.tool_slug}</p>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Brief & Notes tab */}
                  {editorTab === "brief" && (
                    <>
                      <div>
                        <label className="block text-xs font-mono text-slate-500 uppercase tracking-wider mb-1.5">Brief</label>
                        <textarea
                          className={`${inputClassName} resize-none`}
                          rows={4}
                          placeholder="Short description of the angle, hook, or desired outcome"
                          value={editorDraft.brief}
                          onChange={(event) => setEditorDraft((current) => current ? { ...current, brief: event.target.value } : current)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-mono text-slate-500 uppercase tracking-wider mb-1.5">Notes</label>
                        <textarea
                          className={`${inputClassName} resize-none`}
                          rows={7}
                          placeholder="Research notes, links, CTA ideas, internal reminders..."
                          value={editorDraft.notes}
                          onChange={(event) => setEditorDraft((current) => current ? { ...current, notes: event.target.value } : current)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-mono text-slate-500 uppercase tracking-wider mb-1.5">Checklist</label>
                        <textarea
                          className={`${inputClassName} resize-none`}
                          rows={5}
                          placeholder="[ ] Draft outline&#10;[ ] Final review&#10;[x] Keyword research done"
                          value={editorDraft.checklist_text}
                          onChange={(event) => setEditorDraft((current) => current ? { ...current, checklist_text: event.target.value } : current)}
                        />
                        <p className="text-xs text-muted/60 mt-1">Use <code>[ ]</code> and <code>[x]</code> to track completion.</p>
                      </div>
                    </>
                  )}

                  {/* Workflow tab */}
                  {editorTab === "workflow" && (
                    <>
                      <div className="flex items-center justify-between gap-3 mb-1">
                        <p className="text-xs font-mono text-slate-500 uppercase tracking-wider">Approval</p>
                        <span className={`status-badge ${getApprovalBadgeClass(editorDraft.approval_status)}`}>
                          {CALENDAR_APPROVAL_STATUS_LABELS[editorDraft.approval_status]}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-mono text-slate-500 uppercase tracking-wider mb-1.5">Owner</label>
                          <input
                            className={inputClassName}
                            placeholder="Who owns delivery"
                            value={editorDraft.owner}
                            onChange={(event) => setEditorDraft((current) => current ? { ...current, owner: event.target.value } : current)}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-mono text-slate-500 uppercase tracking-wider mb-1.5">Reviewer</label>
                          <input
                            className={inputClassName}
                            placeholder="Who signs off"
                            value={editorDraft.reviewer}
                            onChange={(event) => setEditorDraft((current) => current ? { ...current, reviewer: event.target.value } : current)}
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-xs font-mono text-slate-500 uppercase tracking-wider mb-1.5">Approval Status</label>
                          <select
                            className={inputClassName}
                            value={editorDraft.approval_status}
                            onChange={(event) => setEditorDraft((current) => current ? {
                              ...current,
                              approval_status: event.target.value as CalendarApprovalStatus,
                              blocked_reason: event.target.value === "blocked" ? current.blocked_reason : "",
                            } : current)}
                          >
                            {CALENDAR_APPROVAL_STATUSES.map((status) => (
                              <option key={status} value={status}>{CALENDAR_APPROVAL_STATUS_LABELS[status]}</option>
                            ))}
                          </select>
                        </div>
                        {editorDraft.approval_status === "blocked" && (
                          <div className="md:col-span-2">
                            <label className="block text-xs font-mono text-slate-500 uppercase tracking-wider mb-1.5">Blocked Reason</label>
                            <textarea
                              className={`${inputClassName} resize-none`}
                              rows={3}
                              placeholder="Missing source material, awaiting sign-off, legal review..."
                              value={editorDraft.blocked_reason}
                              onChange={(event) => setEditorDraft((current) => current ? { ...current, blocked_reason: event.target.value } : current)}
                            />
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* Publishing tab */}
                  {editorTab === "publishing" && (
                    <>
                      <div>
                        <label className="block text-xs font-mono text-slate-500 uppercase tracking-wider mb-1.5">Publish Intent</label>
                        <select
                          className={inputClassName}
                          value={selectedEntry.publish_intent}
                          onChange={async (event) => {
                            const newIntent = event.target.value as CalendarPublishIntent;
                            try {
                              const res = await fetch(`/api/calendar/${selectedEntry.id}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ ...toPayload(editorDraft), publish_intent: newIntent }),
                              });
                              const data = await res.json();
                              if (!res.ok) throw new Error(data.error || "Failed to update publish intent");
                              await fetchCalendar(selectedEntry.id);
                            } catch (intentError) {
                              setError(intentError instanceof Error ? intentError.message : "Failed to update publish intent");
                            }
                          }}
                        >
                          <option value="draft">Draft — send to WordPress as draft</option>
                          <option value="publish">Publish — make live immediately</option>
                          <option value="schedule">Schedule — use planned date (WordPress controls timing)</option>
                        </select>
                        <p className="text-xs text-muted/60 mt-1">Publishing is always triggered manually from History.</p>
                      </div>

                      <div>
                        <p className="block text-xs font-mono text-slate-500 uppercase tracking-wider mb-1.5">WordPress Status</p>
                        {selectedEntry.wp_post_id ? (
                          <span className="inline-block text-xs font-mono border border-green-200 text-green-600 rounded-lg px-3 py-1.5 bg-green-50">
                            Post #{selectedEntry.wp_post_id} synced
                          </span>
                        ) : (
                          <p className="text-sm text-muted/60">Not yet published to WordPress</p>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-mono text-slate-500 uppercase tracking-wider mb-1.5">WP Category IDs</label>
                          <input
                            className={inputClassName}
                            placeholder="1, 5, 12"
                            value={editorDraft.wp_category}
                            onChange={(event) => setEditorDraft((current) => current ? { ...current, wp_category: event.target.value } : current)}
                          />
                          <p className="text-xs text-muted/60 mt-1">Comma-separated category IDs.</p>
                        </div>
                        <div>
                          <label className="block text-xs font-mono text-slate-500 uppercase tracking-wider mb-1.5">WP Tag IDs</label>
                          <input
                            className={inputClassName}
                            placeholder="3, 7"
                            value={editorDraft.wp_tags}
                            onChange={(event) => setEditorDraft((current) => current ? { ...current, wp_tags: event.target.value } : current)}
                          />
                          <p className="text-xs text-muted/60 mt-1">Comma-separated tag IDs.</p>
                        </div>
                      </div>
                    </>
                  )}

                </div>
              </>
            )}
          </section>
        </div>
      </PageContainer>
    </div>
  );
}
