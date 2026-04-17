"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import type { HistoryFolderSummary, HistoryRow, HistoryTagSummary } from "@/lib/db";
import { TOOLS } from "@/lib/tools";
import {
  resolvePublishState,
  getPublishStateBadgeClass,
  getPublishStateInlineClass,
  getPublishStateDetailClass,
  getPublishStateBadgeLabel,
  getPublishStateStatusText,
  classifyPublishFailure,
  getPublishFailureHint,
  PUBLISH_FAILURE_CATEGORY_LABELS,
  PUBLISH_STATE_LABELS,
  PUBLISH_STATE_BADGE_CLASSES,
} from "@/lib/publish-state";

// Simple markdown renderer (same as tool page)
function renderMarkdown(text: string): string {
  return text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/```[\w]*\n([\s\S]*?)```/g, "<pre><code>$1</code></pre>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/^---$/gm, "<hr/>")
    .replace(/^\d+\.\s+(.+)$/gm, "<li>$1</li>")
    .replace(/^[-*]\s+(.+)$/gm, "<li>$1</li>")
    .replace(/(<li>[\s\S]*?<\/li>)/g, "<ul>$1</ul>")
    .replace(/<\/ul>\s*<ul>/g, "")
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(?!<[hupol]|<\/[hupol]|<li|<hr)(.+)$/gm, (m) =>
      m.startsWith("<") ? m : `<p>${m}</p>`
    )
    .replace(/<p><\/p>/g, "");
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function parseTagValues(value: string | string[] | undefined | null): string[] {
  const rawTags = Array.isArray(value)
    ? value.map((tag) => String(tag).trim()).filter(Boolean)
    : String(value ?? "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
  const seen = new Set<string>();
  const normalizedTags: string[] = [];

  for (const tag of rawTags) {
    const normalized = tag.toLowerCase();
    if (seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    normalizedTags.push(tag);
  }

  return normalizedTags;
}

function joinTagValues(tags: string[]): string {
  return parseTagValues(tags).join(", ");
}

function getDraftBadgeClassName(row: HistoryRow): string {
  return getPublishStateBadgeClass(row);
}

function getDraftInlineClassName(row: HistoryRow): string {
  return getPublishStateInlineClass(row);
}

function getDraftDetailClassName(row: HistoryRow): string {
  return getPublishStateDetailClass(row);
}

function getDraftBadgeLabel(row: HistoryRow): string | null {
  return getPublishStateBadgeLabel(row);
}

function getDraftStatusText(row: HistoryRow) {
  return getPublishStateStatusText(row, formatDate);
}

const CATEGORY_ICONS: Record<string, string> = {
  "Content Creation": "✍️",
  "Ideas & Planning": "💡",
  "SEO & Keywords": "🔍",
  "Editing & Rewriting": "🔄",
  "Social Media": "📱",
  "Email & Marketing": "📣",
  "Video Content": "🎬",
};

const allSlugs = Array.from(new Set(TOOLS.map((t) => t.slug)));
const HISTORY_PAGE_SIZE = 50;

interface HistoryListResponse {
  rows: HistoryRow[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

interface HistoryFilterPreset {
  id: string;
  name: string;
  filterSlug: string;
  folderFilter: string;
  tagFilters: string[];
  tagFilter?: string;
  searchQuery: string;
  statusFilter: "all" | "never-published" | "draft-linked" | "draft-updated" | "published-live" | "publish-failed";
  dateFrom: string;
  dateTo: string;
  sortBy: "newest" | "oldest" | "title-az" | "title-za";
}

interface HistoryTagsResponse {
  tags: HistoryTagSummary[];
}

interface HistoryFoldersResponse {
  folders: HistoryFolderSummary[];
}

const HISTORY_PRESETS_STORAGE_KEY = "techscribe-history-filter-presets";

export default function HistoryPage() {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filterSlug, setFilterSlug] = useState<string>("all");
  const [folderFilter, setFolderFilter] = useState("");
  const [tagFilters, setTagFilters] = useState<string[]>([]);
  const [tagFilterInput, setTagFilterInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "never-published" | "draft-linked" | "draft-updated" | "published-live" | "publish-failed">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "title-az" | "title-za">("newest");
  const [presetName, setPresetName] = useState("");
  const [presets, setPresets] = useState<HistoryFilterPreset[]>([]);
  const [folderSummaries, setFolderSummaries] = useState<HistoryFolderSummary[]>([]);
  const [folderManagerFolder, setFolderManagerFolder] = useState("");
  const [folderManagerTarget, setFolderManagerTarget] = useState("");
  const [folderActionLoading, setFolderActionLoading] = useState<"rename" | "merge" | "delete" | null>(null);
  const [folderActionMessage, setFolderActionMessage] = useState<string | null>(null);
  const [tagSummaries, setTagSummaries] = useState<HistoryTagSummary[]>([]);
  const [tagManagerTag, setTagManagerTag] = useState("");
  const [tagManagerTarget, setTagManagerTarget] = useState("");
  const [tagActionLoading, setTagActionLoading] = useState<"rename" | "merge" | "delete" | null>(null);
  const [tagActionMessage, setTagActionMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<HistoryRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingFolder, setEditingFolder] = useState("");
  const [editingTags, setEditingTags] = useState("");
  const [editingTagDraft, setEditingTagDraft] = useState("");
  const [editingWpSlug, setEditingWpSlug] = useState("");
  const [editingWpExcerpt, setEditingWpExcerpt] = useState("");
  const [editingWpCategories, setEditingWpCategories] = useState("");
  const [editingWpTags, setEditingWpTags] = useState("");
  const [savingMetadata, setSavingMetadata] = useState(false);
  const [editingOutput, setEditingOutput] = useState("");
  const [savingOutput, setSavingOutput] = useState(false);
  const [detailTab, setDetailTab] = useState<"article" | "editor">("article");
  const [bulkFolderName, setBulkFolderName] = useState("");
  const [bulkTags, setBulkTags] = useState("");
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [publishing, setPublishing] = useState<number | null>(null);
  const [bulkAction, setBulkAction] = useState<"delete" | "publish" | "organize" | null>(null);
  const [publishAllowed, setPublishAllowed] = useState(false);
  const [publishStatusLoaded, setPublishStatusLoaded] = useState(false);
  const [totalRows, setTotalRows] = useState(0);
  const [hasMoreRows, setHasMoreRows] = useState(false);

  const trimmedSearchQuery = searchQuery.trim();
  const trimmedFolderFilter = folderFilter.trim();
  const normalizedTagFilters = tagFilters;

  const fetchTags = useCallback(async () => {
    const res = await fetch("/api/history/tags");
    if (!res.ok) {
      throw new Error("Failed to load tags");
    }

    const data = await res.json() as HistoryTagsResponse;
    setTagSummaries(data.tags);
  }, []);

  const fetchFolders = useCallback(async () => {
    const res = await fetch("/api/history/folders");
    if (!res.ok) {
      throw new Error("Failed to load folders");
    }

    const data = await res.json() as HistoryFoldersResponse;
    setFolderSummaries(data.folders);
  }, []);

  const fetchHistory = useCallback(async (slug?: string, options?: { append?: boolean }) => {
    const append = options?.append ?? false;
    const nextOffset = append ? rows.length : 0;

    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    const params = new URLSearchParams({
      limit: String(HISTORY_PAGE_SIZE),
      offset: String(nextOffset),
      sort: sortBy,
    });

    if (slug && slug !== "all") {
      params.set("tool", slug);
    }

    if (trimmedFolderFilter) {
      params.set("folder", trimmedFolderFilter);
    }

    for (const tag of normalizedTagFilters) {
      params.append("tag", tag);
    }

    if (trimmedSearchQuery) {
      params.set("q", trimmedSearchQuery);
    }

    if (statusFilter !== "all") {
      params.set("status", statusFilter);
    }

    if (dateFrom) {
      params.set("dateFrom", dateFrom);
    }

    if (dateTo) {
      params.set("dateTo", dateTo);
    }

    const url = `/api/history?${params.toString()}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json() as HistoryListResponse;
      setRows((prev) => append ? [...prev, ...data.rows] : data.rows);
      setTotalRows(data.total);
      setHasMoreRows(data.hasMore);
    }
    if (append) {
      setLoadingMore(false);
    } else {
      setLoading(false);
    }
  }, [dateFrom, dateTo, normalizedTagFilters, rows.length, sortBy, statusFilter, trimmedFolderFilter, trimmedSearchQuery]);

  useEffect(() => {
    setSelected(null);
    setSelectedIds([]);
    void fetchHistory(filterSlug === "all" ? undefined : filterSlug);
  }, [dateFrom, dateTo, filterSlug, fetchHistory, sortBy, statusFilter, trimmedFolderFilter, trimmedSearchQuery, normalizedTagFilters]);

  useEffect(() => {
    if (!selected) {
      setEditingTitle("");
      setEditingFolder("");
      setEditingTags("");
      setEditingTagDraft("");
      setEditingWpSlug("");
      setEditingWpExcerpt("");
      setEditingWpCategories("");
      setEditingWpTags("");
      setEditingOutput("");
      setDetailTab("article");
      return;
    }

    setEditingTitle(selected.title);
    setEditingFolder(selected.folder_name ?? "");
    setEditingTags(selected.tags ?? "");
    setEditingTagDraft("");
    setEditingWpSlug(selected.wp_slug ?? "");
    setEditingWpExcerpt(selected.wp_excerpt ?? "");
    setEditingWpCategories(selected.wp_categories ?? "");
    setEditingWpTags(selected.wp_tags ?? "");
    setEditingOutput(selected.output);
    setDetailTab("article");
  }, [selected]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(HISTORY_PRESETS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as HistoryFilterPreset[];
        setPresets(parsed.map((preset) => ({
          ...preset,
          tagFilters: parseTagValues(preset.tagFilters ?? preset.tagFilter ?? []),
        })));
      }
    } catch {
      setPresets([]);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(HISTORY_PRESETS_STORAGE_KEY, JSON.stringify(presets));
    } catch {
      // ignore localStorage failures
    }
  }, [presets]);

  useEffect(() => {
    const loadPublishStatus = async () => {
      try {
        const res = await fetch("/api/settings/wordpress");
        const data = await res.json() as { has_successful_test?: boolean };
        setPublishAllowed(Boolean(data.has_successful_test));
      } catch {
        setPublishAllowed(false);
      } finally {
        setPublishStatusLoaded(true);
      }
    };

    void loadPublishStatus();
  }, []);

  useEffect(() => {
    void fetchTags().catch(() => {
      setTagSummaries([]);
    });
  }, [fetchTags]);

  useEffect(() => {
    void fetchFolders().catch(() => {
      setFolderSummaries([]);
    });
  }, [fetchFolders]);

  const refreshTaxonomyData = useCallback(async () => {
    await Promise.all([fetchTags(), fetchFolders()]);
  }, [fetchFolders, fetchTags]);

  const refreshHistoryState = useCallback(async () => {
    await fetchHistory(filterSlug === "all" ? undefined : filterSlug);

    if (!selected) {
      return;
    }

    const res = await fetch(`/api/history/${selected.id}`);
    if (!res.ok) {
      setSelected(null);
      return;
    }

    const data = await res.json() as HistoryRow;
    setSelected(data);
  }, [fetchHistory, filterSlug, selected]);

  const handleDelete = async (id: number) => {
    setDeleting(id);
    await fetch(`/api/history/${id}`, { method: "DELETE" });
    setRows((prev) => prev.filter((r) => r.id !== id));
    setTotalRows((prev) => Math.max(prev - 1, 0));
    setSelectedIds((prev) => prev.filter((selectedId) => selectedId !== id));
    if (selected?.id === id) setSelected(null);
    setDeleting(null);
    void refreshTaxonomyData().catch(() => {
      // ignore tag refresh failures after delete
    });
  };

  const handleCopy = async () => {
    if (!selected) return;
    await navigator.clipboard.writeText(selected.output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePublishDraft = async () => {
    if (!selected) return;

    setPublishing(selected.id);

    try {
      const res = await fetch("/api/wordpress/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          historyId: selected.id,
          title: selected.title,
          content: selected.output,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        // If the API returned an updated (failed) history row, sync it into the
        // UI so the failure badge and retry button appear immediately.
        if (data.history) {
          const failedRow = data.history as HistoryRow;
          setSelected(failedRow);
          setRows((prev) => prev.map((row) => (row.id === failedRow.id ? failedRow : row)));
        }
        throw new Error(data.error || "WordPress publish failed");
      }

      const nextSelected: HistoryRow = data.history ?? {
        ...selected,
        wp_post_id: data.postId,
        wp_status: data.status,
        wp_url: data.url,
        wp_last_published_at: new Date().toISOString(),
        wp_last_sync_action: data.action ?? null,
      };

      setSelected(nextSelected);
      setRows((prev) => prev.map((row) => (row.id === nextSelected.id ? nextSelected : row)));
    } catch (error) {
      console.error(error);
    } finally {
      setPublishing(null);
    }
  };

  const publishRow = async (row: HistoryRow) => {
    const res = await fetch("/api/wordpress/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        historyId: row.id,
        title: row.title,
        content: row.output,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "WordPress publish failed");
    }

    const updatedRow: HistoryRow = data.history ?? {
      ...row,
      wp_post_id: data.postId,
      wp_status: data.status,
      wp_url: data.url,
      wp_last_published_at: new Date().toISOString(),
      wp_last_sync_action: data.action ?? null,
    };

    setRows((prev) => prev.map((item) => (item.id === updatedRow.id ? updatedRow : item)));
    if (selected?.id === updatedRow.id) {
      setSelected(updatedRow);
    }
  };

  const handleToggleSelection = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((selectedId) => selectedId !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAllVisible = () => {
    const visibleIds = visibleRows.map((row) => row.id);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

    setSelectedIds((prev) => {
      if (allVisibleSelected) {
        return prev.filter((id) => !visibleIds.includes(id));
      }

      return Array.from(new Set([...prev, ...visibleIds]));
    });
  };

  const handleBulkDelete = async () => {
    const idsToDelete = selectedIds;
    if (idsToDelete.length === 0) return;

    setBulkAction("delete");

    try {
      await Promise.all(idsToDelete.map((id) => fetch(`/api/history/${id}`, { method: "DELETE" })));
      setRows((prev) => prev.filter((row) => !idsToDelete.includes(row.id)));
      setTotalRows((prev) => Math.max(prev - idsToDelete.length, 0));
      if (selected && idsToDelete.includes(selected.id)) {
        setSelected(null);
      }
      setSelectedIds([]);
      await refreshTaxonomyData();
    } finally {
      setBulkAction(null);
    }
  };

  const handleBulkPublish = async () => {
    const rowsToPublish = rows.filter((row) => selectedIds.includes(row.id));
    if (rowsToPublish.length === 0) return;

    setBulkAction("organize");

    try {
      for (const row of rowsToPublish) {
        await publishRow(row);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setBulkAction(null);
    }
  };

  const handleBulkAssignMetadata = async (options?: { clearFolder?: boolean; folderName?: string; includeTags?: boolean }) => {
    if (selectedIds.length === 0) return;

    setBulkAction("publish");

    try {
      const res = await fetch("/api/history/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: selectedIds,
          folder_name: options?.folderName ?? bulkFolderName,
          clear_folder: Boolean(options?.clearFolder),
          append_tags: options?.includeTags === false ? "" : bulkTags,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update selected entries");
      }

      const updatedRows = data.rows as HistoryRow[];
      const updatedMap = new Map(updatedRows.map((row) => [row.id, row]));

      setRows((prev) => prev.map((row) => updatedMap.get(row.id) ?? row));
      if (selected && updatedMap.has(selected.id)) {
        setSelected(updatedMap.get(selected.id) ?? selected);
      }
      setBulkFolderName("");
      setBulkTags("");
      await refreshTaxonomyData();
    } catch (error) {
      console.error(error);
    } finally {
      setBulkAction(null);
    }
  };

  const handleSavePreset = () => {
    const trimmedName = presetName.trim();
    if (!trimmedName) {
      return;
    }

    const nextPreset: HistoryFilterPreset = {
      id: crypto.randomUUID(),
      name: trimmedName,
      filterSlug,
      folderFilter,
      tagFilters: normalizedTagFilters,
      searchQuery,
      statusFilter,
      dateFrom,
      dateTo,
      sortBy,
    };

    setPresets((prev) => [nextPreset, ...prev]);
    setPresetName("");
  };

  const applyPreset = (preset: HistoryFilterPreset) => {
    setFilterSlug(preset.filterSlug);
    setFolderFilter(preset.folderFilter);
    setTagFilters(parseTagValues(preset.tagFilters ?? preset.tagFilter ?? []));
    setTagFilterInput("");
    setSearchQuery(preset.searchQuery);
    setStatusFilter(preset.statusFilter);
    setDateFrom(preset.dateFrom);
    setDateTo(preset.dateTo);
    setSortBy(preset.sortBy);
  };

  const deletePreset = (presetId: string) => {
    setPresets((prev) => prev.filter((preset) => preset.id !== presetId));
  };

  const handleLoadMore = async () => {
    if (!hasMoreRows || loadingMore) {
      return;
    }

    await fetchHistory(filterSlug === "all" ? undefined : filterSlug, { append: true });
  };

  const handleSaveMetadata = async () => {
    if (!selected) return;

    setSavingMetadata(true);

    try {
      const res = await fetch(`/api/history/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editingTitle,
          folder_name: editingFolder,
          tags: editingTags,
          wp_slug: editingWpSlug,
          wp_excerpt: editingWpExcerpt,
          wp_categories: editingWpCategories,
          wp_tags: editingWpTags,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update history entry");
      }

      setSelected(data as HistoryRow);
      setRows((prev) => prev.map((row) => (row.id === data.id ? data : row)));
      await refreshTaxonomyData();
    } catch (error) {
      console.error(error);
    } finally {
      setSavingMetadata(false);
    }
  };

  const handleSaveOutput = async () => {
    if (!selected) return;

    setSavingOutput(true);

    try {
      const res = await fetch(`/api/history/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ output: editingOutput }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update content");
      }

      setSelected(data as HistoryRow);
      setRows((prev) => prev.map((row) => (row.id === data.id ? data : row)));
    } catch (error) {
      console.error(error);
    } finally {
      setSavingOutput(false);
    }
  };

  const handleAddEditingTag = (value?: string) => {
    const nextTag = String(value ?? editingTagDraft).trim();
    if (!nextTag) {
      return;
    }

    setEditingTags((current) => joinTagValues([...parseTagValues(current), nextTag]));
    setEditingTagDraft("");
  };

  const handleRemoveEditingTag = (tagToRemove: string) => {
    setEditingTags((current) => joinTagValues(parseTagValues(current).filter((tag) => tag !== tagToRemove)));
  };

  const toggleTagFilter = (tag: string) => {
    setTagFilters((current) => {
      const exists = current.some((currentTag) => currentTag.toLowerCase() === tag.toLowerCase());
      return exists
        ? current.filter((currentTag) => currentTag.toLowerCase() !== tag.toLowerCase())
        : [...current, tag];
    });
    setTagFilterInput("");
  };

  const handleAddTagFilter = (value?: string) => {
    const nextTag = String(value ?? tagFilterInput).trim();
    if (!nextTag) {
      return;
    }

    setTagFilters((current) => parseTagValues([...current, nextTag]));
    setTagFilterInput("");
  };

  const handleFolderAction = async (action: "rename" | "merge" | "delete") => {
    const trimmedFolder = folderManagerFolder.trim();
    const trimmedTargetFolder = folderManagerTarget.trim();

    if (!trimmedFolder) {
      setFolderActionMessage("Choose a folder to manage first.");
      return;
    }

    if ((action === "rename" || action === "merge") && !trimmedTargetFolder) {
      setFolderActionMessage(action === "rename" ? "Enter a new folder name." : "Enter the merge target folder.");
      return;
    }

    setFolderActionLoading(action);
    setFolderActionMessage(null);

    try {
      const res = await fetch("/api/history/folders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          folder: trimmedFolder,
          targetFolder: trimmedTargetFolder,
        }),
      });

      const data = await res.json() as { error?: string; updatedCount?: number; folders?: HistoryFolderSummary[] };
      if (!res.ok) {
        throw new Error(data.error || "Failed to update folder");
      }

      setFolderSummaries(data.folders ?? []);
      setFolderActionMessage(
        action === "delete"
          ? `Removed ${trimmedFolder} from ${data.updatedCount ?? 0} entr${(data.updatedCount ?? 0) === 1 ? "y" : "ies"}.`
          : action === "merge"
            ? `Merged ${trimmedFolder} into ${trimmedTargetFolder} across ${data.updatedCount ?? 0} entr${(data.updatedCount ?? 0) === 1 ? "y" : "ies"}.`
            : `Renamed ${trimmedFolder} to ${trimmedTargetFolder} across ${data.updatedCount ?? 0} entr${(data.updatedCount ?? 0) === 1 ? "y" : "ies"}.`
      );

      if (action !== "delete") {
        setFolderManagerFolder(trimmedTargetFolder);
      }
      setFolderManagerTarget("");

      const nextFolderFilter = trimmedFolderFilter.toLowerCase() === trimmedFolder.toLowerCase()
        ? action === "delete"
          ? ""
          : trimmedTargetFolder
        : trimmedFolderFilter;

      if (selected?.folder_name && selected.folder_name.toLowerCase() === trimmedFolder.toLowerCase()) {
        setEditingFolder(action === "delete" ? "" : trimmedTargetFolder);
      }

      if (nextFolderFilter !== trimmedFolderFilter) {
        setFolderFilter(nextFolderFilter);
      } else {
        await refreshHistoryState();
      }
    } catch (error) {
      console.error(error);
      setFolderActionMessage(error instanceof Error ? error.message : "Failed to update folder.");
    } finally {
      setFolderActionLoading(null);
    }
  };

  const handleTagAction = async (action: "rename" | "merge" | "delete") => {
    const trimmedTag = tagManagerTag.trim();
    const trimmedTargetTag = tagManagerTarget.trim();

    if (!trimmedTag) {
      setTagActionMessage("Choose a tag to manage first.");
      return;
    }

    if ((action === "rename" || action === "merge") && !trimmedTargetTag) {
      setTagActionMessage(action === "rename" ? "Enter a new tag name." : "Enter the merge target tag.");
      return;
    }

    setTagActionLoading(action);
    setTagActionMessage(null);

    try {
      const res = await fetch("/api/history/tags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          tag: trimmedTag,
          targetTag: trimmedTargetTag,
        }),
      });

      const data = await res.json() as { error?: string; updatedCount?: number; tags?: HistoryTagSummary[] };
      if (!res.ok) {
        throw new Error(data.error || "Failed to update tag");
      }

      setTagSummaries(data.tags ?? []);
      setTagActionMessage(
        action === "delete"
          ? `Removed ${trimmedTag} from ${data.updatedCount ?? 0} entr${(data.updatedCount ?? 0) === 1 ? "y" : "ies"}.`
          : action === "merge"
            ? `Merged ${trimmedTag} into ${trimmedTargetTag} across ${data.updatedCount ?? 0} entr${(data.updatedCount ?? 0) === 1 ? "y" : "ies"}.`
            : `Renamed ${trimmedTag} to ${trimmedTargetTag} across ${data.updatedCount ?? 0} entr${(data.updatedCount ?? 0) === 1 ? "y" : "ies"}.`
      );

      if (action !== "delete") {
        setTagManagerTag(trimmedTargetTag);
      }
      setTagManagerTarget("");

      const nextTagFilters = normalizedTagFilters.some((tag) => tag.toLowerCase() === trimmedTag.toLowerCase())
        ? action === "delete"
          ? normalizedTagFilters.filter((tag) => tag.toLowerCase() !== trimmedTag.toLowerCase())
          : normalizedTagFilters.map((tag) => tag.toLowerCase() === trimmedTag.toLowerCase() ? trimmedTargetTag : tag)
        : normalizedTagFilters;

      if (selected) {
        const nextEditingTags = action === "delete"
          ? parseTagValues(editingTags).filter((tag) => tag.toLowerCase() !== trimmedTag.toLowerCase())
          : parseTagValues(editingTags).map((tag) => tag.toLowerCase() === trimmedTag.toLowerCase() ? trimmedTargetTag : tag);
        setEditingTags(joinTagValues(nextEditingTags));
      }

      if (JSON.stringify(nextTagFilters) !== JSON.stringify(normalizedTagFilters)) {
        setTagFilters(parseTagValues(nextTagFilters));
      } else {
        await refreshHistoryState();
      }
    } catch (error) {
      console.error(error);
      setTagActionMessage(error instanceof Error ? error.message : "Failed to update tag.");
    } finally {
      setTagActionLoading(null);
    }
  };

  const handleExportSelected = () => {
    const rowsToExport = rows.filter((row) => selectedIds.includes(row.id));
    if (rowsToExport.length === 0) return;

    const payload = rowsToExport.map((row) => ({
      ...row,
      fields: JSON.parse(row.fields) as Record<string, string>,
      tags: row.tags ? row.tags.split(",").map((tag) => tag.trim()).filter(Boolean) : [],
    }));

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `techscribe-history-export-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const visibleRows = rows;
  const allVisibleSelected = visibleRows.length > 0 && visibleRows.every((row) => selectedIds.includes(row.id));
  const selectedCount = selectedIds.length;
  const availableFolders = folderSummaries.map((summary) => summary.folder);
  const popularTags = [...tagSummaries]
    .sort((left, right) => right.count - left.count || left.tag.localeCompare(right.tag))
    .slice(0, 12);
  const editingTagList = parseTagValues(editingTags);

  const publishStateCounts = useMemo(
    () =>
      rows.reduce(
        (acc, row) => {
          const state = resolvePublishState(row);
          if (!state) {
            acc.unpublished += 1;
          } else {
            acc[state] = (acc[state] ?? 0) + 1;
          }
          return acc;
        },
        { draft_created: 0, draft_updated: 0, published: 0, scheduled: 0, failed: 0, unpublished: 0 }
      ),
    [rows]
  );

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="border-b border-border px-8 py-4 flex items-center gap-4">
        <Link href="/" className="text-muted hover:text-white text-sm transition-colors">
          ← Dashboard
        </Link>
        <span className="text-border">|</span>
        <span className="text-xl">🕒</span>
        <h1 className="text-white font-medium">Generation History</h1>
        <span className="ml-auto font-mono text-xs text-muted bg-subtle px-2 py-1 rounded">
          {rows.length}/{totalRows || rows.length} loaded
        </span>
      </header>

      {/* Publish State Summary */}
      {!loading && rows.length > 0 && (
        <div className="border-b border-border px-8 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
          <p className="font-mono text-xs text-muted uppercase tracking-wider shrink-0">Publish States</p>
          {publishStateCounts.failed > 0 && (
            <span className={`text-xs font-mono border rounded px-2 py-0.5 ${PUBLISH_STATE_BADGE_CLASSES.failed}`}>
              {PUBLISH_STATE_LABELS.failed}: {publishStateCounts.failed}
            </span>
          )}
          {publishStateCounts.published > 0 && (
            <span className={`text-xs font-mono border rounded px-2 py-0.5 ${PUBLISH_STATE_BADGE_CLASSES.published}`}>
              {PUBLISH_STATE_LABELS.published}: {publishStateCounts.published}
            </span>
          )}
          {publishStateCounts.scheduled > 0 && (
            <span className={`text-xs font-mono border rounded px-2 py-0.5 ${PUBLISH_STATE_BADGE_CLASSES.scheduled}`}>
              {PUBLISH_STATE_LABELS.scheduled}: {publishStateCounts.scheduled}
            </span>
          )}
          {publishStateCounts.draft_updated > 0 && (
            <span className={`text-xs font-mono border rounded px-2 py-0.5 ${PUBLISH_STATE_BADGE_CLASSES.draft_updated}`}>
              {PUBLISH_STATE_LABELS.draft_updated}: {publishStateCounts.draft_updated}
            </span>
          )}
          {publishStateCounts.draft_created > 0 && (
            <span className={`text-xs font-mono border rounded px-2 py-0.5 ${PUBLISH_STATE_BADGE_CLASSES.draft_created}`}>
              {PUBLISH_STATE_LABELS.draft_created}: {publishStateCounts.draft_created}
            </span>
          )}
          {publishStateCounts.unpublished > 0 && (
            <span className="text-xs font-mono border rounded px-2 py-0.5 border-slate-400/20 bg-slate-400/5 text-slate-400">
              Never Published: {publishStateCounts.unpublished}
            </span>
          )}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* List panel */}
        <div className="w-96 border-r border-border flex flex-col overflow-hidden">
          {/* Filter bar */}
          <div className="px-4 py-3 border-b border-border space-y-3">
            {selectedCount > 0 && (
              <div className="bg-subtle border border-border rounded-lg p-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-mono text-muted uppercase tracking-wider">
                    {selectedCount} selected
                  </p>
                  <button
                    onClick={() => setSelectedIds([])}
                    className="text-xs text-muted hover:text-white transition-colors"
                  >
                    Clear
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleBulkDelete}
                    disabled={bulkAction !== null}
                    className="flex-1 text-sm border border-red-400/20 rounded-lg py-2 text-red-300/80 hover:text-red-200 hover:border-red-400/40 transition-colors disabled:opacity-50"
                  >
                    {bulkAction === "delete" ? "Deleting..." : "Delete Selected"}
                  </button>
                  <button
                    onClick={handleBulkPublish}
                    disabled={bulkAction !== null || !publishAllowed || !publishStatusLoaded}
                    className="flex-1 text-sm border border-border rounded-lg py-2 text-muted hover:text-white hover:border-accent/40 transition-colors disabled:opacity-50"
                  >
                    {bulkAction === "publish" ? "Publishing..." : "Publish Selected"}
                  </button>
                  <button
                    onClick={handleExportSelected}
                    disabled={bulkAction !== null}
                    className="flex-1 text-sm border border-border rounded-lg py-2 text-muted hover:text-white hover:border-accent/40 transition-colors disabled:opacity-50"
                  >
                    Export Selected
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  <input
                    type="text"
                    list="history-folder-options"
                    className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-muted focus:outline-none focus:border-accent/60"
                    value={bulkFolderName}
                    onChange={(e) => setBulkFolderName(e.target.value)}
                    placeholder="Assign folder to selected"
                  />
                  <input
                    type="text"
                    className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-muted focus:outline-none focus:border-accent/60"
                    value={bulkTags}
                    onChange={(e) => setBulkTags(e.target.value)}
                    placeholder="Add tags to selected (comma-separated)"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleBulkAssignMetadata()}
                      disabled={bulkAction !== null || (!bulkFolderName.trim() && !bulkTags.trim())}
                      className="flex-1 text-sm border border-border rounded-lg py-2 text-muted hover:text-white hover:border-accent/40 transition-colors disabled:opacity-50"
                    >
                      {bulkAction === "organize" ? "Applying..." : "Apply Metadata"}
                    </button>
                    <button
                      onClick={() => handleBulkAssignMetadata({ clearFolder: true, includeTags: false })}
                      disabled={bulkAction !== null}
                      className="flex-1 text-sm border border-border rounded-lg py-2 text-muted hover:text-white hover:border-accent/40 transition-colors disabled:opacity-50"
                    >
                      Clear Folder
                    </button>
                  </div>
                </div>
                {availableFolders.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-mono text-muted uppercase tracking-wider">Quick Folders</p>
                    <div className="flex flex-wrap gap-2">
                      {availableFolders.map((folder) => (
                        <button
                          key={folder}
                          onClick={() => handleBulkAssignMetadata({ folderName: folder, includeTags: false })}
                          disabled={bulkAction !== null}
                          className="text-[11px] font-mono border border-border rounded px-2 py-1 text-muted hover:text-white hover:border-accent/40 transition-colors disabled:opacity-50"
                        >
                          Move to {folder}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {!publishAllowed && publishStatusLoaded && (
                  <div className="flex items-center gap-3">
                    <p className="text-[11px] text-amber-300/90">
                      Bulk publish is disabled until your saved WordPress settings pass a successful connection test.
                    </p>
                    <Link
                      href="/settings"
                      className="text-[11px] font-mono text-accent hover:text-white transition-colors whitespace-nowrap"
                    >
                      Go to Settings →
                    </Link>
                  </div>
                )}
              </div>
            )}

            <select
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/60"
              value={filterSlug}
              onChange={(e) => setFilterSlug(e.target.value)}
            >
              <option value="all">All Tools</option>
              {allSlugs.map((s) => {
                const tool = TOOLS.find((t) => t.slug === s);
                return (
                  <option key={s} value={s}>
                    {tool ? `${tool.icon} ${tool.name}` : s}
                  </option>
                );
              })}
            </select>
            <input
              type="text"
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-muted focus:outline-none focus:border-accent/60"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search titles, tools, or content..."
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                list="history-folder-options"
                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-muted focus:outline-none focus:border-accent/60"
                value={folderFilter}
                onChange={(e) => setFolderFilter(e.target.value)}
                placeholder="Folder"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  list="history-tag-options"
                  className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-muted focus:outline-none focus:border-accent/60"
                  value={tagFilterInput}
                  onChange={(e) => setTagFilterInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddTagFilter();
                    }
                  }}
                  placeholder="Add tag filter"
                />
                <button
                  onClick={() => handleAddTagFilter()}
                  className="px-3 py-2 text-sm border border-border rounded-lg text-muted hover:text-white hover:border-accent/40 transition-colors"
                >
                  Add
                </button>
              </div>
            </div>
            {normalizedTagFilters.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] font-mono text-muted uppercase tracking-wider">Tag Filters</p>
                  <button
                    onClick={() => setTagFilters([])}
                    className="text-[11px] text-muted hover:text-white transition-colors"
                  >
                    Clear tags
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {normalizedTagFilters.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => toggleTagFilter(tag)}
                      className="text-[11px] font-mono border border-accent/40 text-accent rounded px-2 py-1 transition-colors hover:text-white"
                    >
                      #{tag} ✕
                    </button>
                  ))}
                </div>
              </div>
            )}
            {availableFolders.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-mono text-muted uppercase tracking-wider">Folders</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setFolderFilter("")}
                    className={`text-[11px] font-mono border rounded px-2 py-1 transition-colors ${!folderFilter ? "border-accent/40 text-accent" : "border-border text-muted hover:text-white hover:border-accent/40"}`}
                  >
                    All folders
                  </button>
                  {availableFolders.map((folder) => (
                    <button
                      key={folder}
                      onClick={() => setFolderFilter(folder)}
                      className={`text-[11px] font-mono border rounded px-2 py-1 transition-colors ${folderFilter === folder ? "border-accent/40 text-accent" : "border-border text-muted hover:text-white hover:border-accent/40"}`}
                    >
                      {folder}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {popularTags.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-mono text-muted uppercase tracking-wider">Popular Tags</p>
                <div className="flex flex-wrap gap-2">
                  {popularTags.map((tagSummary) => {
                    const active = normalizedTagFilters.some((tag) => tag.toLowerCase() === tagSummary.tag.toLowerCase());
                    return (
                      <button
                        key={tagSummary.tag}
                        onClick={() => toggleTagFilter(tagSummary.tag)}
                        className={`text-[11px] font-mono border rounded px-2 py-1 transition-colors ${active ? "border-accent/40 text-accent" : "border-border text-muted hover:text-white hover:border-accent/40"}`}
                      >
                        #{tagSummary.tag} ({tagSummary.count})
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <select
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/60"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | "never-published" | "draft-linked" | "draft-updated" | "published-live" | "publish-failed")}
            >
              <option value="all">All publish states</option>
              <option value="never-published">Never published</option>
              <option value="draft-linked">Draft linked</option>
              <option value="draft-updated">Draft updated</option>
              <option value="published-live">Published live</option>
              <option value="publish-failed">Publish failed</option>
            </select>

            <div className="bg-subtle border border-border rounded-lg p-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-mono text-muted uppercase tracking-wider">Folder Management</p>
                <span className="text-[11px] font-mono text-muted">{folderSummaries.length} folders</span>
              </div>
              <input
                type="text"
                list="history-folder-options"
                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-muted focus:outline-none focus:border-accent/60"
                value={folderManagerFolder}
                onChange={(e) => setFolderManagerFolder(e.target.value)}
                placeholder="Folder to rename, merge, or delete"
              />
              <input
                type="text"
                list="history-folder-options"
                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-muted focus:outline-none focus:border-accent/60"
                value={folderManagerTarget}
                onChange={(e) => setFolderManagerTarget(e.target.value)}
                placeholder="New name or merge target"
              />
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => handleFolderAction("rename")}
                  disabled={folderActionLoading !== null}
                  className="text-sm border border-border rounded-lg py-2 text-muted hover:text-white hover:border-accent/40 transition-colors disabled:opacity-50"
                >
                  {folderActionLoading === "rename" ? "Renaming..." : "Rename"}
                </button>
                <button
                  onClick={() => handleFolderAction("merge")}
                  disabled={folderActionLoading !== null}
                  className="text-sm border border-border rounded-lg py-2 text-muted hover:text-white hover:border-accent/40 transition-colors disabled:opacity-50"
                >
                  {folderActionLoading === "merge" ? "Merging..." : "Merge"}
                </button>
                <button
                  onClick={() => handleFolderAction("delete")}
                  disabled={folderActionLoading !== null}
                  className="text-sm border border-red-400/20 rounded-lg py-2 text-red-300/80 hover:text-red-200 hover:border-red-400/40 transition-colors disabled:opacity-50"
                >
                  {folderActionLoading === "delete" ? "Deleting..." : "Delete"}
                </button>
              </div>
              {folderActionMessage && (
                <p className="text-xs text-muted">{folderActionMessage}</p>
              )}
              {folderSummaries.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[11px] font-mono text-muted uppercase tracking-wider">Library Folders</p>
                  <div className="flex flex-wrap gap-2">
                    {folderSummaries.map((folderSummary) => (
                      <button
                        key={folderSummary.folder}
                        onClick={() => {
                          setFolderManagerFolder(folderSummary.folder);
                          setFolderFilter(folderSummary.folder);
                        }}
                        className={`text-[11px] font-mono border rounded px-2 py-1 transition-colors ${folderManagerFolder === folderSummary.folder || folderFilter === folderSummary.folder ? "border-accent/40 text-accent" : "border-border text-muted hover:text-white hover:border-accent/40"}`}
                      >
                        {folderSummary.folder} ({folderSummary.count})
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted">No folders saved yet.</p>
              )}
            </div>

            <div className="bg-subtle border border-border rounded-lg p-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-mono text-muted uppercase tracking-wider">Tag Management</p>
                <span className="text-[11px] font-mono text-muted">{tagSummaries.length} tags</span>
              </div>
              <input
                type="text"
                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-muted focus:outline-none focus:border-accent/60"
                value={tagManagerTag}
                onChange={(e) => setTagManagerTag(e.target.value)}
                placeholder="Tag to rename, merge, or delete"
              />
              <input
                type="text"
                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-muted focus:outline-none focus:border-accent/60"
                value={tagManagerTarget}
                onChange={(e) => setTagManagerTarget(e.target.value)}
                placeholder="New name or merge target"
              />
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => handleTagAction("rename")}
                  disabled={tagActionLoading !== null}
                  className="text-sm border border-border rounded-lg py-2 text-muted hover:text-white hover:border-accent/40 transition-colors disabled:opacity-50"
                >
                  {tagActionLoading === "rename" ? "Renaming..." : "Rename"}
                </button>
                <button
                  onClick={() => handleTagAction("merge")}
                  disabled={tagActionLoading !== null}
                  className="text-sm border border-border rounded-lg py-2 text-muted hover:text-white hover:border-accent/40 transition-colors disabled:opacity-50"
                >
                  {tagActionLoading === "merge" ? "Merging..." : "Merge"}
                </button>
                <button
                  onClick={() => handleTagAction("delete")}
                  disabled={tagActionLoading !== null}
                  className="text-sm border border-red-400/20 rounded-lg py-2 text-red-300/80 hover:text-red-200 hover:border-red-400/40 transition-colors disabled:opacity-50"
                >
                  {tagActionLoading === "delete" ? "Deleting..." : "Delete"}
                </button>
              </div>
              {tagActionMessage && (
                <p className="text-xs text-muted">{tagActionMessage}</p>
              )}
              {popularTags.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[11px] font-mono text-muted uppercase tracking-wider">Library Tags</p>
                  <div className="flex flex-wrap gap-2">
                    {popularTags.map((tagSummary) => (
                      <button
                        key={tagSummary.tag}
                        onClick={() => {
                          setTagManagerTag(tagSummary.tag);
                          toggleTagFilter(tagSummary.tag);
                        }}
                        className={`text-[11px] font-mono border rounded px-2 py-1 transition-colors ${tagManagerTag === tagSummary.tag || normalizedTagFilters.some((tag) => tag.toLowerCase() === tagSummary.tag.toLowerCase()) ? "border-accent/40 text-accent" : "border-border text-muted hover:text-white hover:border-accent/40"}`}
                      >
                        #{tagSummary.tag} ({tagSummary.count})
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted">No tags saved yet.</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/60"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
              <input
                type="date"
                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/60"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <select
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/60"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "newest" | "oldest" | "title-az" | "title-za")}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="title-az">Title A-Z</option>
              <option value="title-za">Title Z-A</option>
            </select>

            <div className="bg-subtle border border-border rounded-lg p-3 space-y-3">
              <p className="text-xs font-mono text-muted uppercase tracking-wider">Saved Presets</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-muted focus:outline-none focus:border-accent/60"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="Preset name"
                />
                <button
                  onClick={handleSavePreset}
                  className="px-3 py-2 text-sm border border-border rounded-lg text-muted hover:text-white hover:border-accent/40 transition-colors"
                >
                  Save
                </button>
              </div>
              {presets.length === 0 ? (
                <p className="text-xs text-muted">No saved presets yet.</p>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {presets.map((preset) => (
                    <div key={preset.id} className="flex items-center gap-2">
                      <button
                        onClick={() => applyPreset(preset)}
                        className="flex-1 text-left text-sm border border-border rounded-lg px-3 py-2 text-white/90 hover:border-accent/40 transition-colors"
                      >
                        {preset.name}
                        <span className="block text-[11px] text-muted mt-1 truncate">
                          {[preset.filterSlug !== "all" ? preset.filterSlug : null, preset.folderFilter || null, parseTagValues(preset.tagFilters ?? preset.tagFilter ?? []).join(", ") || null, preset.statusFilter !== "all" ? preset.statusFilter : null]
                            .filter(Boolean)
                            .join(" • ") || "All entries"}
                        </span>
                      </button>
                      <button
                        onClick={() => deletePreset(preset.id)}
                        className="text-xs text-muted hover:text-red-300 transition-colors px-2"
                        title="Delete preset"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center h-32">
                <span className="text-muted text-sm font-mono animate-pulse">Loading…</span>
              </div>
            )}

            {!loading && rows.length === 0 && (
              <div className="flex flex-col items-center justify-center h-48 text-center px-6">
                <div className="text-4xl mb-3 opacity-30">🕒</div>
                <p className="text-muted text-sm">No saved generations yet.</p>
                <p className="text-muted/60 text-xs mt-1">
                  Use a tool and click <span className="text-accent">Save</span> to store results here.
                </p>
              </div>
            )}

            {!loading && rows.length > 0 && visibleRows.length === 0 && (
              <div className="flex flex-col items-center justify-center h-48 text-center px-6">
                <div className="text-4xl mb-3 opacity-30">🔎</div>
                <p className="text-muted text-sm">No history entries match this search.</p>
                <p className="text-muted/60 text-xs mt-1">
                  Try a different keyword or reset one of the active filters.
                </p>
              </div>
            )}

            {!loading && visibleRows.map((row) => {
              const isSelected = selected?.id === row.id;
              const draftBadgeLabel = getDraftBadgeLabel(row);
              return (
                <div
                  key={row.id}
                  className={`w-full text-left px-4 py-3 border-b border-border transition-colors ${
                    isSelected ? "bg-accent/5 border-l-2 border-l-accent" : "hover:bg-subtle"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(row.id)}
                      onChange={() => handleToggleSelection(row.id)}
                      className="mt-1 h-4 w-4 rounded border-border bg-surface text-accent focus:ring-accent/40"
                    />
                    <button
                      onClick={() => setSelected(row)}
                      className="flex-1 min-w-0 text-left"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-base shrink-0">{row.tool_icon}</span>
                          <div className="min-w-0">
                            <p className="text-white text-sm truncate font-medium">{row.title}</p>
                            <p className="text-muted text-xs">{row.tool_name}</p>
                          </div>
                        </div>
                        {draftBadgeLabel && (
                          <span className={`font-mono text-[10px] border rounded px-1.5 py-0.5 ${getDraftBadgeClassName(row)}`}>
                            {draftBadgeLabel}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 ml-7">
                        <span className="font-mono text-xs text-muted/60">{row.word_count} words</span>
                        <span className="font-mono text-xs text-muted/40">
                          {formatDate(row.created_at)}
                        </span>
                        {(row.wp_post_id || row.wp_publish_state === "failed") && (
                          <span className={`font-mono text-xs ${getDraftInlineClassName(row)}`}>
                            {row.wp_publish_state === "failed"
                              ? "Publish failed"
                              : row.wp_publish_state === "publish"
                                ? "Published live"
                                : row.wp_last_sync_action === "updated" ? "Updated draft" : "Draft linked"}
                          </span>
                        )}
                      </div>
                    </button>
                    <button
                      onClick={() => handleDelete(row.id)}
                      disabled={deleting === row.id}
                      className="text-muted hover:text-red-400 text-xs shrink-0 transition-colors disabled:opacity-50"
                      title="Delete"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}

            {!loading && visibleRows.length > 0 && (
              <div className="px-4 py-3 border-t border-border bg-subtle/40">
                <label className="flex items-center gap-2 text-xs text-muted">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={handleToggleSelectAllVisible}
                    className="h-4 w-4 rounded border-border bg-surface text-accent focus:ring-accent/40"
                  />
                  Select all loaded entries
                </label>
              </div>
            )}

            {!loading && hasMoreRows && (
              <div className="p-4 border-t border-border">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="w-full text-sm border border-border rounded-lg py-2.5 text-muted hover:text-white hover:border-accent/40 transition-colors disabled:opacity-50"
                >
                  {loadingMore ? "Loading more..." : `Load More (${rows.length}/${totalRows})`}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Detail panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="text-5xl mb-4 opacity-20">🕒</div>
              <p className="text-muted text-sm max-w-xs">
                Select a saved generation from the list to view its content.
              </p>
            </div>
          ) : (
            <>
              {/* Detail toolbar */}
              <div className="flex items-center justify-between px-6 py-3 border-b border-border shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span>{selected.tool_icon}</span>
                      <span className="text-white text-sm font-medium truncate">{selected.title}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="font-mono text-xs text-muted">{selected.tool_name}</span>
                      <span className="font-mono text-xs text-muted/50">{formatDate(selected.created_at)}</span>
                      <span className="font-mono text-xs text-muted/50">{selected.word_count} words</span>
                      <span className={`font-mono text-xs ${getDraftDetailClassName(selected)}`}>
                        {getDraftStatusText(selected)}
                      </span>
                    </div>
                  </div>
                  {/* Article / Editor tabs */}
                  <div className="flex items-center gap-1 ml-4 shrink-0">
                    <button
                      onClick={() => setDetailTab("article")}
                      className={`font-mono text-xs px-3 py-1.5 rounded-md border transition-colors ${
                        detailTab === "article"
                          ? "border-accent text-accent bg-accent/10"
                          : "border-border text-muted hover:text-white hover:border-white/20"
                      }`}
                    >
                      Article
                    </button>
                    <button
                      onClick={() => setDetailTab("editor")}
                      className={`font-mono text-xs px-3 py-1.5 rounded-md border transition-colors ${
                        detailTab === "editor"
                          ? "border-accent text-accent bg-accent/10"
                          : "border-border text-muted hover:text-white hover:border-white/20"
                      }`}
                    >
                      Editor
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {selected.wp_url && (
                    <a
                      href={selected.wp_url}
                      target="_blank"
                      rel="noreferrer"
                      className={`font-mono text-xs px-3 py-1.5 rounded-md border transition-colors ${
                        resolvePublishState(selected) === "published"
                          ? "border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-300 hover:text-fuchsia-200 hover:border-fuchsia-400/50"
                          : "border-emerald-400/30 bg-emerald-400/10 text-emerald-300 hover:text-emerald-200 hover:border-emerald-400/50"
                      }`}
                    >
                      {resolvePublishState(selected) === "published" ? "View Live" : "View Draft"}
                    </a>
                  )}
                  <Link
                    href={`/tool/${selected.tool_slug}`}
                    className="btn-secondary"
                  >
                    Use Tool
                  </Link>
                  <button
                    onClick={handlePublishDraft}
                    disabled={publishing === selected.id || !publishAllowed || !publishStatusLoaded}
                    className="btn-primary"
                  >
                    {publishing === selected.id
                      ? (selected.wp_post_id ? "Updating..." : "Publishing...")
                      : resolvePublishState(selected) === "failed"
                        ? "Retry Publish"
                        : selected.wp_post_id
                          ? "Update Draft"
                          : "Publish Draft"}
                  </button>
                  <button
                    onClick={handleCopy}
                    className="btn-secondary"
                  >
                    {copied ? "✓ Copied!" : "Copy"}
                  </button>
                  <button
                    onClick={() => handleDelete(selected.id)}
                    disabled={deleting === selected.id}
                    className="btn-danger"
                  >
                    Delete
                  </button>
                </div>
              </div>
              {!publishAllowed && publishStatusLoaded && (
                <div className="px-6 py-2 border-b border-border bg-amber-400/5">
                  <div className="flex items-center gap-3">
                    <p className="text-[11px] text-amber-300/90">
                      Publish Draft is disabled until your saved WordPress settings pass a successful connection test in Settings.
                    </p>
                    <Link
                      href="/settings"
                      className="text-[11px] font-mono text-accent hover:text-white transition-colors whitespace-nowrap"
                    >
                      Go to Settings →
                    </Link>
                  </div>
                </div>
              )}

              {resolvePublishState(selected) === "failed" && (
                <div className="px-6 py-2 border-b border-border bg-red-400/5">
                  {(() => {
                    const category = classifyPublishFailure(selected.wp_error_message);
                    const categoryLabel = PUBLISH_FAILURE_CATEGORY_LABELS[category];
                    const hint = getPublishFailureHint(category);
                    return (
                      <div className="flex flex-col gap-0.5">
                        <p className="text-[11px] text-red-300/90">
                          <span className="font-semibold text-red-300">{categoryLabel}:</span>{" "}
                          {selected.wp_error_message ?? "Last publish attempt failed."}{" "}
                          Click <span className="text-white font-semibold">Retry Publish</span> above to try again without regenerating.
                        </p>
                        <p className="text-[11px] text-red-300/60">{hint}</p>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Inputs summary */}
              <div className="px-6 py-3 border-b border-border bg-subtle shrink-0">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                  <div>
                    <label className="block text-[11px] font-mono text-muted uppercase tracking-wider mb-1">Title</label>
                    <input
                      type="text"
                      className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/60"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono text-muted uppercase tracking-wider mb-1">Folder</label>
                    <input
                      type="text"
                      list="history-folder-options"
                      className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-muted focus:outline-none focus:border-accent/60"
                      value={editingFolder}
                      onChange={(e) => setEditingFolder(e.target.value)}
                      placeholder="e.g. SEO Drafts"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono text-muted uppercase tracking-wider mb-1">Tags</label>
                    <input
                      type="text"
                      className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-muted focus:outline-none focus:border-accent/60"
                      value={editingTags}
                      onChange={(e) => setEditingTags(e.target.value)}
                      placeholder="seo, wordpress, newsletter"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-[11px] font-mono text-muted uppercase tracking-wider mb-1">WP Slug</label>
                    <input
                      type="text"
                      className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-muted focus:outline-none focus:border-accent/60"
                      value={editingWpSlug}
                      onChange={(e) => setEditingWpSlug(e.target.value)}
                      placeholder="my-post-url-slug"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono text-muted uppercase tracking-wider mb-1">WP Excerpt</label>
                    <input
                      type="text"
                      className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-muted focus:outline-none focus:border-accent/60"
                      value={editingWpExcerpt}
                      onChange={(e) => setEditingWpExcerpt(e.target.value)}
                      placeholder="Short post excerpt"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono text-muted uppercase tracking-wider mb-1">WP Category IDs</label>
                    <input
                      type="text"
                      className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-muted focus:outline-none focus:border-accent/60"
                      value={editingWpCategories}
                      onChange={(e) => setEditingWpCategories(e.target.value)}
                      placeholder="1, 5, 12"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono text-muted uppercase tracking-wider mb-1">WP Tag IDs</label>
                    <input
                      type="text"
                      className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-muted focus:outline-none focus:border-accent/60"
                      value={editingWpTags}
                      onChange={(e) => setEditingWpTags(e.target.value)}
                      placeholder="3, 7"
                    />
                  </div>
                </div>
                <div className="mb-3 rounded-lg border border-border bg-surface/50 p-3 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] font-mono text-muted uppercase tracking-wider">Tag Suggestions</p>
                    <span className="text-[11px] text-muted">Add existing tags to keep naming consistent</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      list="history-tag-options"
                      className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-muted focus:outline-none focus:border-accent/60"
                      value={editingTagDraft}
                      onChange={(e) => setEditingTagDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddEditingTag();
                        }
                      }}
                      placeholder="Add tag from library"
                    />
                    <button
                      onClick={() => handleAddEditingTag()}
                      className="px-3 py-2 text-sm border border-border rounded-lg text-muted hover:text-white hover:border-accent/40 transition-colors"
                    >
                      Add Tag
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {popularTags.map((tagSummary) => (
                      <button
                        key={tagSummary.tag}
                        onClick={() => handleAddEditingTag(tagSummary.tag)}
                        className="text-[11px] font-mono border border-border rounded px-2 py-1 text-muted hover:text-white hover:border-accent/40 transition-colors"
                      >
                        #{tagSummary.tag}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex flex-wrap gap-2">
                    {selected.folder_name && (
                      <span className="text-[11px] font-mono text-accent border border-accent/20 rounded px-2 py-1">
                        Folder: {selected.folder_name}
                      </span>
                    )}
                    {editingTagList.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => handleRemoveEditingTag(tag)}
                        className="text-[11px] font-mono text-muted border border-border rounded px-2 py-1 hover:text-white hover:border-accent/40 transition-colors"
                        title="Remove tag"
                      >
                        #{tag} ✕
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={handleSaveMetadata}
                    disabled={savingMetadata}
                    className="text-sm border border-border rounded-lg px-3 py-2 text-muted hover:text-white hover:border-accent/40 transition-colors disabled:opacity-50"
                  >
                    {savingMetadata ? "Saving..." : "Save Metadata"}
                  </button>
                </div>
                <p className="font-mono text-xs text-muted uppercase tracking-wider mb-2">Inputs</p>
                <div className="flex flex-wrap gap-x-6 gap-y-1">
                  {Object.entries(JSON.parse(selected.fields) as Record<string, string>).map(([k, v]) =>
                    v ? (
                      <span key={k} className="text-xs text-muted">
                        <span className="text-muted/50 capitalize">{k}: </span>
                        <span className="text-white/70">{String(v).slice(0, 80)}{String(v).length > 80 ? "…" : ""}</span>
                      </span>
                    ) : null
                  )}
                </div>
              </div>

              {/* Output */}
              <div className="flex-1 overflow-y-auto p-8">
                {detailTab === "article" ? (
                  <div
                    className="markdown-output max-w-3xl"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(selected.output) }}
                  />
                ) : (
                  <div className="flex flex-col h-full gap-3">
                    <textarea
                      className="flex-1 w-full min-h-[400px] bg-transparent text-white text-sm font-mono leading-relaxed resize-none focus:outline-none placeholder-muted"
                      value={editingOutput}
                      onChange={(e) => setEditingOutput(e.target.value)}
                      placeholder="Edit your content here…"
                    />
                    <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
                      <span className="font-mono text-xs text-muted">
                        {editingOutput.split(/\s+/).filter(Boolean).length} words
                      </span>
                      <button
                        onClick={handleSaveOutput}
                        disabled={savingOutput}
                        className="font-semibold text-sm px-4 py-2 rounded-lg border border-accent/60 text-accent hover:bg-accent/10 transition-colors disabled:opacity-50"
                      >
                        {savingOutput ? "Saving..." : "Save Content"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <datalist id="history-tag-options">
        {tagSummaries.map((tagSummary) => (
          <option key={tagSummary.tag} value={tagSummary.tag} />
        ))}
      </datalist>

      <datalist id="history-folder-options">
        {folderSummaries.map((folderSummary) => (
          <option key={folderSummary.folder} value={folderSummary.folder} />
        ))}
      </datalist>
    </div>
  );
}
