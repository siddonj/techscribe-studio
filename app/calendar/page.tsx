"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CALENDAR_PUBLISH_INTENTS,
  CALENDAR_PUBLISH_INTENT_LABELS,
  CALENDAR_STATUSES,
  CALENDAR_STATUS_LABELS,
  type CalendarEntry,
  type CalendarEntryStatus,
  type CalendarPublishIntent,
  type CalendarSummary,
} from "@/lib/calendar";
import { TOOLS, getToolBySlug } from "@/lib/tools";

interface CalendarResponse {
  rows: CalendarEntry[];
  summary: CalendarSummary;
}

interface CalendarDraft {
  title: string;
  tool_slug: string;
  status: CalendarEntryStatus;
  scheduled_for: string;
  brief: string;
  keywords: string;
  audience: string;
  notes: string;
}

const inputClassName =
  "w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-muted focus:outline-none focus:border-accent/60 transition-colors";

function createEmptyDraft(): CalendarDraft {
  return {
    title: "",
    tool_slug: "article-writer",
    status: "planned",
    scheduled_for: "",
    brief: "",
    keywords: "",
    audience: "",
    notes: "",
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
      return "border-white/10 text-slate-300";
    case "planned":
      return "border-sky-400/20 text-sky-300";
    case "in-progress":
      return "border-amber-400/20 text-amber-300";
    case "ready":
      return "border-emerald-400/20 text-emerald-300";
    case "published":
      return "border-fuchsia-400/20 text-fuchsia-300";
  }
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
    brief: entry.brief ?? "",
    keywords: entry.keywords ?? "",
    audience: entry.audience ?? "",
    notes: entry.notes ?? "",
  };
}

function toPayload(draft: CalendarDraft) {
  return {
    ...draft,
    scheduled_for: draft.scheduled_for.trim() || null,
    brief: draft.brief.trim() || null,
    keywords: draft.keywords.trim() || null,
    audience: draft.audience.trim() || null,
    notes: draft.notes.trim() || null,
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
  const [viewMode, setViewMode] = useState<"list" | "week">("list");
  const [weekOffset, setWeekOffset] = useState(0);
  const [quickRescheduling, setQuickRescheduling] = useState(false);

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

  const groupedSections = useMemo(() => {
    const todayValue = getTodayValue();
    const thisWeekValue = getFutureDateValue(7);
    const overdue = rows.filter((row) => row.scheduled_for && row.scheduled_for < todayValue && row.status !== "published");
    const today = rows.filter((row) => row.scheduled_for === todayValue);
    const upcomingByDate = new Map<string, CalendarEntry[]>();
    const later: CalendarEntry[] = [];
    const unscheduled = rows.filter((row) => !row.scheduled_for);

    for (const row of rows) {
      if (!row.scheduled_for || row.scheduled_for <= todayValue) {
        continue;
      }

      if (row.scheduled_for <= thisWeekValue) {
        const existing = upcomingByDate.get(row.scheduled_for) ?? [];
        existing.push(row);
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
  }, [rows]);

  const weekDates = useMemo(
    () => (viewMode === "week" ? getWeekDates(weekOffset) : []),
    [viewMode, weekOffset],
  );

  const weekItemsByDate = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const date of weekDates) {
      map.set(date, rows.filter((r) => r.scheduled_for === date));
    }
    return map;
  }, [weekDates, rows]);

  const weekUnscheduled = useMemo(
    () => (viewMode === "week" ? rows.filter((r) => !r.scheduled_for) : []),
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
      <header className="border-b border-border px-8 py-4 flex items-center gap-4">
        <Link href="/" className="text-muted hover:text-white text-sm transition-colors">
          ← Dashboard
        </Link>
        <span className="text-border">|</span>
        <span className="text-xl">🗓️</span>
        <h1 className="text-white font-medium">Content Calendar</h1>
      </header>

      <div className="p-8 max-w-7xl w-full mx-auto flex-1 overflow-hidden flex flex-col gap-6">
        <section className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: "Total Items", value: summary?.total ?? rows.length },
            { label: "Due This Week", value: summary?.dueThisWeek ?? 0 },
            { label: "Overdue", value: summary?.overdue ?? 0 },
            { label: "Unscheduled", value: summary?.unscheduled ?? 0 },
            { label: "Published", value: summary?.byStatus.published ?? 0 },
          ].map((stat) => (
            <div key={stat.label} className="bg-card border border-border rounded-xl px-5 py-4">
              <p className="font-mono text-xs text-muted uppercase tracking-wider">{stat.label}</p>
              <p className="text-3xl text-accent font-mono mt-2">{stat.value}</p>
            </div>
          ))}
        </section>

        <section className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-mono text-xs text-accent uppercase tracking-widest">Quick Plan</p>
              <p className="text-sm text-slate-400 mt-1">Add a topic, assign a tool, and give it a date so the queue stays visible.</p>
              <p className="text-xs text-muted/60 mt-0.5">Dates are planning guides only — publishing to WordPress is always triggered manually.</p>
            </div>
            <Link href={buildToolHref(createDraft)} className="text-sm border border-border rounded-lg px-3 py-2 text-muted hover:text-white hover:border-accent/40 transition-colors">
              Open Tool Draft
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              className={`${inputClassName} md:col-span-2`}
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
            <select
              className={inputClassName}
              value={createDraft.status}
              onChange={(event) => setCreateDraft((current) => ({ ...current, status: event.target.value as CalendarEntryStatus }))}
            >
              {CALENDAR_STATUSES.map((status) => (
                <option key={status} value={status}>{CALENDAR_STATUS_LABELS[status]}</option>
              ))}
            </select>
            <button
              onClick={handleCreateEntry}
              disabled={creating || !createDraft.title.trim()}
              className="bg-accent text-bg font-semibold px-4 py-2.5 rounded-lg text-sm hover:bg-accent-dim transition-colors disabled:opacity-50"
            >
              {creating ? "Adding..." : "Add to Calendar"}
            </button>
          </div>

          <textarea
            className={`${inputClassName} resize-none`}
            rows={2}
            placeholder="Brief or planning note"
            value={createDraft.brief}
            onChange={(event) => setCreateDraft((current) => ({ ...current, brief: event.target.value }))}
          />
        </section>

        {(error || message) && (
          <section className="space-y-2">
            {error && <div className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</div>}
            {message && <div className="text-green-300 text-sm bg-green-400/10 border border-green-400/20 rounded-lg px-3 py-2">{message}</div>}
          </section>
        )}

        <div className="flex-1 min-h-0 flex gap-6 overflow-hidden">
          {/* Left panel: List view or Week view */}
          <div className={`${viewMode === "list" ? "w-[28rem] shrink-0" : "flex-1"} border border-border rounded-2xl bg-card overflow-hidden flex flex-col`}>
            {/* Panel controls */}
            <div className="p-4 border-b border-border space-y-3">
              <div className="flex items-center justify-between gap-3">
                {/* View mode toggle */}
                <div className="flex gap-1 bg-subtle rounded-lg p-0.5">
                  <button
                    onClick={() => setViewMode("list")}
                    className={`px-3 py-1.5 rounded-md text-xs font-mono transition-colors ${viewMode === "list" ? "bg-card text-white shadow-sm" : "text-muted hover:text-white"}`}
                  >
                    List
                  </button>
                  <button
                    onClick={() => setViewMode("week")}
                    className={`px-3 py-1.5 rounded-md text-xs font-mono transition-colors ${viewMode === "week" ? "bg-card text-white shadow-sm" : "text-muted hover:text-white"}`}
                  >
                    Week
                  </button>
                </div>
                {/* Week navigation */}
                {viewMode === "week" && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setWeekOffset((n) => n - 1)}
                      className="text-muted hover:text-white text-sm px-2 py-1 border border-border rounded-lg transition-colors"
                    >
                      ‹
                    </button>
                    <span className="text-xs text-muted font-mono">{formatWeekRange(weekDates)}</span>
                    <button
                      onClick={() => setWeekOffset((n) => n + 1)}
                      className="text-muted hover:text-white text-sm px-2 py-1 border border-border rounded-lg transition-colors"
                    >
                      ›
                    </button>
                    {weekOffset !== 0 && (
                      <button
                        onClick={() => setWeekOffset(0)}
                        className="text-xs text-accent hover:text-accent/80 px-2 py-1 transition-colors"
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
                <p className="text-xs text-muted">View the schedule by due date, then open a card to edit the plan or jump straight into a tool.</p>
              )}
              {viewMode === "week" && selectedEntry && (
                <p className="text-xs text-accent/80">
                  <span className="font-mono">↑ Click any day to instantly move</span> <span className="text-white">{selectedEntry.title}</span> <span className="text-muted">to that date.</span>
                </p>
              )}
            </div>

            {/* List view */}
            {viewMode === "list" && (
              <div className="flex-1 overflow-y-auto">
                {loading && (
                  <div className="p-6 text-sm text-muted font-mono animate-pulse">Loading calendar...</div>
                )}

                {!loading && rows.length === 0 && (statusFilter !== "all" || toolFilter !== "all" || publishIntentFilter !== "all") && (
                  <div className="p-6 text-center">
                    <div className="text-4xl opacity-30 mb-3">🔍</div>
                    <p className="text-sm text-muted">No items match the active filters.</p>
                    <button
                      onClick={() => { setStatusFilter("all"); setToolFilter("all"); setPublishIntentFilter("all"); }}
                      className="text-xs text-accent hover:text-accent/80 mt-2 transition-colors"
                    >
                      Clear filters
                    </button>
                  </div>
                )}

                {!loading && rows.length === 0 && statusFilter === "all" && toolFilter === "all" && publishIntentFilter === "all" && (
                  <div className="p-6 text-center">
                    <div className="text-4xl opacity-30 mb-3">🗓️</div>
                    <p className="text-sm text-muted">No planned content yet.</p>
                    <p className="text-xs text-muted/70 mt-1">Add your first scheduled item above to start building the queue.</p>
                  </div>
                )}

                {!loading && groupedSections.map((section) => (
                  <section key={section.id} className="border-b border-border/60 last:border-b-0">
                    <div className="px-4 py-3 bg-subtle/50 flex items-center justify-between">
                      <p className="font-mono text-xs text-muted uppercase tracking-wider">{section.title}</p>
                      <span className="text-[11px] text-muted">{section.rows.length} items</span>
                    </div>

                    <div className="p-2 space-y-2">
                      {section.rows.map((row) => {
                        const tool = getToolBySlug(row.tool_slug);
                        const selected = row.id === selectedId;

                        return (
                          <div
                            key={row.id}
                            className={`border rounded-xl p-3 transition-colors ${selected ? "border-accent/40 bg-accent/5" : "border-border hover:border-accent/20 hover:bg-subtle/40"}`}
                          >
                            {/* Main selection area */}
                            <button
                              onClick={() => setSelectedId(row.id)}
                              className="w-full text-left"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm text-white font-medium truncate">{row.title}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs">{tool?.icon ?? "📝"}</span>
                                    <span className="text-xs text-muted truncate">{tool?.name ?? row.tool_slug}</span>
                                  </div>
                                </div>
                                <span className={`text-[11px] font-mono border rounded px-2 py-1 shrink-0 ${getStatusBadgeClass(row.status)}`}>
                                  {CALENDAR_STATUS_LABELS[row.status]}
                                </span>
                              </div>
                              {row.keywords && (
                                <p className="text-xs text-muted mt-2 truncate">Keywords: {row.keywords}</p>
                              )}
                              {row.brief && (
                                <p className="text-xs text-muted/80 mt-1 line-clamp-2">{row.brief}</p>
                              )}
                            </button>

                            {/* Inline quick-reschedule */}
                            <div className="mt-2 flex items-center gap-1.5 border-t border-border/40 pt-2">
                              <span className="text-[10px] text-muted">📅</span>
                              <input
                                type="date"
                                aria-label="Reschedule date"
                                value={row.scheduled_for ?? ""}
                                disabled={quickRescheduling}
                                onChange={(e) => {
                                  void handleQuickRescheduleById(row.id, e.target.value);
                                }}
                                className="text-[11px] text-muted bg-transparent border-0 p-0 focus:outline-none focus:ring-1 focus:ring-accent rounded cursor-pointer hover:text-accent transition-colors disabled:opacity-40 [color-scheme:dark]"
                              />
                              {!row.scheduled_for && (
                                <span className="text-[10px] text-muted/50 italic">unscheduled</span>
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

            {/* Week view */}
            {viewMode === "week" && (
              <div className="flex-1 overflow-auto p-3">
                {loading && (
                  <div className="p-6 text-sm text-muted font-mono animate-pulse">Loading calendar...</div>
                )}

                {!loading && rows.length === 0 && (statusFilter !== "all" || toolFilter !== "all" || publishIntentFilter !== "all") && (
                  <div className="p-6 text-center">
                    <div className="text-4xl opacity-30 mb-3">🔍</div>
                    <p className="text-sm text-muted">No items match the active filters.</p>
                    <button
                      onClick={() => { setStatusFilter("all"); setToolFilter("all"); setPublishIntentFilter("all"); }}
                      className="text-xs text-accent hover:text-accent/80 mt-2 transition-colors"
                    >
                      Clear filters
                    </button>
                  </div>
                )}

                {!loading && rows.length === 0 && statusFilter === "all" && toolFilter === "all" && publishIntentFilter === "all" && (
                  <div className="p-6 text-center">
                    <div className="text-4xl opacity-30 mb-3">🗓️</div>
                    <p className="text-sm text-muted">No planned content yet.</p>
                    <p className="text-xs text-muted/70 mt-1">Add your first scheduled item above to start building the queue.</p>
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
                            className={`flex flex-col border rounded-xl overflow-hidden transition-colors ${isToday ? "border-accent/50" : isSelected ? "border-accent/30" : "border-border"}`}
                          >
                            {/* Day header — click to quick-reschedule */}
                            <button
                              type="button"
                              disabled={!canMove || quickRescheduling}
                              onClick={() => canMove && void handleQuickReschedule(dateValue)}
                              className={`w-full p-2 text-center border-b transition-colors
                                ${isToday ? "bg-accent/10 border-accent/30" : "bg-subtle/30 border-border"}
                                ${canMove ? "cursor-pointer hover:bg-accent/20" : "cursor-default"}
                              `}
                            >
                              <p className="text-[10px] font-mono text-muted uppercase">{weekdayLabel}</p>
                              <p className={`text-xl font-bold mt-0.5 ${isToday ? "text-accent" : "text-white"}`}>{dayNumber}</p>
                              {canMove && (
                                <p className="text-[9px] text-accent/60 mt-0.5">Move here</p>
                              )}
                            </button>

                            {/* Items in this day */}
                            <div className="flex-1 p-1.5 space-y-1.5 overflow-y-auto">
                              {dayItems.map((row) => {
                                const tool = getToolBySlug(row.tool_slug);
                                const selected = row.id === selectedId;
                                return (
                                  <button
                                    key={row.id}
                                    onClick={() => setSelectedId(row.id)}
                                    className={`w-full text-left border rounded-lg p-2 transition-colors ${selected ? "border-accent/40 bg-accent/5" : "border-border hover:border-accent/20 hover:bg-subtle/40"}`}
                                  >
                                    <p className="text-[11px] text-white font-medium leading-snug line-clamp-2">{row.title}</p>
                                    <div className="flex items-center justify-between mt-1.5 gap-1">
                                      <span className="text-xs">{tool?.icon ?? "📝"}</span>
                                      <span className={`text-[9px] font-mono border rounded px-1.5 py-0.5 ${getStatusBadgeClass(row.status)}`}>
                                        {CALENDAR_STATUS_LABELS[row.status]}
                                      </span>
                                    </div>
                                  </button>
                                );
                              })}

                              {/* Empty-day drop target when an item is selected */}
                              {canMove && dayItems.length === 0 && (
                                <button
                                  type="button"
                                  disabled={quickRescheduling}
                                  onClick={() => void handleQuickReschedule(dateValue)}
                                  className="w-full text-center text-[10px] text-muted border border-dashed border-border rounded-lg py-4 hover:border-accent/50 hover:text-accent transition-colors disabled:opacity-40"
                                >
                                  + Move here
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Unscheduled row */}
                    {weekUnscheduled.length > 0 && (
                      <div className="mt-4 border border-border rounded-xl overflow-hidden">
                        <div className="px-4 py-2 bg-subtle/50 border-b border-border flex items-center justify-between">
                          <p className="font-mono text-xs text-muted uppercase tracking-wider">Unscheduled</p>
                          <span className="text-[11px] text-muted">{weekUnscheduled.length} items</span>
                        </div>
                        <div className="p-2 flex flex-wrap gap-2">
                          {weekUnscheduled.map((row) => {
                            const tool = getToolBySlug(row.tool_slug);
                            const selected = row.id === selectedId;
                            return (
                              <button
                                key={row.id}
                                onClick={() => setSelectedId(row.id)}
                                className={`text-left border rounded-lg p-2.5 transition-colors w-48 ${selected ? "border-accent/40 bg-accent/5" : "border-border hover:border-accent/20 hover:bg-subtle/40"}`}
                              >
                                <p className="text-xs text-white font-medium truncate">{row.title}</p>
                                <div className="flex items-center justify-between mt-1.5 gap-1">
                                  <span className="text-xs">{tool?.icon ?? "📝"}</span>
                                  <span className={`text-[9px] font-mono border rounded px-1.5 py-0.5 ${getStatusBadgeClass(row.status)}`}>
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
          </div>

          {/* Editor panel */}
          <section className={`${viewMode === "list" ? "flex-1" : "w-80 shrink-0"} border border-border rounded-2xl bg-card overflow-hidden flex flex-col min-w-0`}>
            {!selectedEntry || !editorDraft ? (
              <div className="flex-1 flex items-center justify-center text-center p-8">
                <div>
                  <div className="text-5xl opacity-20 mb-4">🗓️</div>
                  <p className="text-sm text-muted max-w-sm">Select a calendar entry to update scheduling details, refine the brief, or jump into the assigned writing tool.</p>
                </div>
              </div>
            ) : (
              <>
                <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-4">
                  <div>
                    <p className="font-mono text-xs text-accent uppercase tracking-widest">Planned Item</p>
                    <h2 className="text-white text-lg mt-1">{selectedEntry.title}</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={buildToolHref(editorDraft)}
                      className="text-sm border border-border rounded-lg px-3 py-2 text-muted hover:text-white hover:border-accent/40 transition-colors"
                    >
                      Open Tool
                    </Link>
                    <button
                      onClick={handleDeleteSelected}
                      disabled={deleting}
                      className="text-sm border border-red-400/20 rounded-lg px-3 py-2 text-red-300/80 hover:text-red-200 hover:border-red-400/40 transition-colors disabled:opacity-50"
                    >
                      {deleting ? "Deleting..." : "Delete"}
                    </button>
                    <button
                      onClick={handleSaveSelected}
                      disabled={saving}
                      className="bg-accent text-bg font-semibold px-4 py-2 rounded-lg text-sm hover:bg-accent-dim transition-colors disabled:opacity-50"
                    >
                      {saving ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </div>

                <div className="p-6 flex-1 overflow-y-auto space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-mono text-muted uppercase tracking-wider mb-1.5">Title</label>
                      <input
                        className={inputClassName}
                        value={editorDraft.title}
                        onChange={(event) => setEditorDraft((current) => current ? { ...current, title: event.target.value } : current)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-muted uppercase tracking-wider mb-1.5">Tool</label>
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
                      <label className="block text-xs font-mono text-muted uppercase tracking-wider mb-1.5">Status</label>
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
                      <label className="block text-xs font-mono text-muted uppercase tracking-wider mb-1.5">Scheduled For</label>
                      <input
                        type="date"
                        className={inputClassName}
                        value={editorDraft.scheduled_for}
                        onChange={(event) => setEditorDraft((current) => current ? { ...current, scheduled_for: event.target.value } : current)}
                      />
                      <p className="text-[10px] text-muted/60 mt-1">Planning date only — publishing to WordPress must be triggered manually from the tool or archive.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-mono text-muted uppercase tracking-wider mb-1.5">Keywords</label>
                      <input
                        className={inputClassName}
                        placeholder="primary keyword, cluster, search phrase"
                        value={editorDraft.keywords}
                        onChange={(event) => setEditorDraft((current) => current ? { ...current, keywords: event.target.value } : current)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-muted uppercase tracking-wider mb-1.5">Audience</label>
                      <input
                        className={inputClassName}
                        placeholder="who this piece is for"
                        value={editorDraft.audience}
                        onChange={(event) => setEditorDraft((current) => current ? { ...current, audience: event.target.value } : current)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-muted uppercase tracking-wider mb-1.5">Brief</label>
                    <textarea
                      className={`${inputClassName} resize-none`}
                      rows={4}
                      placeholder="Short description of the angle, hook, or desired outcome"
                      value={editorDraft.brief}
                      onChange={(event) => setEditorDraft((current) => current ? { ...current, brief: event.target.value } : current)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-muted uppercase tracking-wider mb-1.5">Notes</label>
                    <textarea
                      className={`${inputClassName} resize-none`}
                      rows={8}
                      placeholder="Research notes, links, CTA ideas, internal reminders, or production steps"
                      value={editorDraft.notes}
                      onChange={(event) => setEditorDraft((current) => current ? { ...current, notes: event.target.value } : current)}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-subtle border border-border rounded-xl p-4">
                      <p className="font-mono text-xs text-muted uppercase tracking-wider">Created</p>
                      <p className="text-sm text-white mt-2">{new Date(selectedEntry.created_at).toLocaleString()}</p>
                    </div>
                    <div className="bg-subtle border border-border rounded-xl p-4">
                      <p className="font-mono text-xs text-muted uppercase tracking-wider">Last Updated</p>
                      <p className="text-sm text-white mt-2">{new Date(selectedEntry.updated_at).toLocaleString()}</p>
                    </div>
                    <div className="bg-subtle border border-border rounded-xl p-4">
                      <p className="font-mono text-xs text-muted uppercase tracking-wider">Current Tool</p>
                      <p className="text-sm text-white mt-2">{getToolBySlug(editorDraft.tool_slug)?.name ?? editorDraft.tool_slug}</p>
                    </div>
                  </div>

                  <div className="bg-subtle border border-border rounded-xl p-4 space-y-3">
                    <p className="font-mono text-xs text-muted uppercase tracking-wider">Publishing</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-mono text-muted uppercase tracking-wider mb-1.5">Publish Intent</label>
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
                              if (!res.ok) {
                                throw new Error(data.error || "Failed to update publish intent");
                              }
                              await fetchCalendar(selectedEntry.id);
                            } catch (intentError) {
                              setError(intentError instanceof Error ? intentError.message : "Failed to update publish intent");
                            }
                          }}
                        >
                          <option value="draft">Draft — send to WordPress as draft</option>
                          <option value="publish">Publish — make live on WordPress immediately</option>
                        </select>
                        <p className="text-[10px] text-muted/60 mt-1">Controls whether the next publish action sends this as a draft or goes live. Triggered manually.</p>
                      </div>
                      <div>
                        <p className="block text-xs font-mono text-muted uppercase tracking-wider mb-1.5">WordPress Status</p>
                        {selectedEntry.wp_post_id ? (
                          <div className="space-y-1">
                            <span className="inline-block text-[11px] font-mono border border-green-400/20 text-green-300 rounded px-2 py-1">
                              Post #{selectedEntry.wp_post_id} synced
                            </span>
                          </div>
                        ) : (
                          <p className="text-sm text-muted/60">Not yet published to WordPress</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
