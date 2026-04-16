import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import {
  CALENDAR_PUBLISH_INTENTS,
  CALENDAR_STATUSES,
  type CalendarEntry,
  type CalendarPublishIntent,
  type CalendarEntryStatus,
  type CalendarQueryOptions,
  type CalendarSummary,
} from "@/lib/calendar";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "history.db");

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let _db: Database.Database | null = null;

function ensureHistorySchema(db: Database.Database) {
  const columns = db.prepare("PRAGMA table_info(history)").all() as Array<{ name: string }>;
  const columnNames = new Set(columns.map((column) => column.name));

  if (!columnNames.has("wp_post_id")) {
    db.exec("ALTER TABLE history ADD COLUMN wp_post_id INTEGER");
  }

  if (!columnNames.has("wp_status")) {
    db.exec("ALTER TABLE history ADD COLUMN wp_status TEXT");
  }

  if (!columnNames.has("wp_url")) {
    db.exec("ALTER TABLE history ADD COLUMN wp_url TEXT");
  }

  if (!columnNames.has("wp_last_published_at")) {
    db.exec("ALTER TABLE history ADD COLUMN wp_last_published_at TEXT");
  }

  if (!columnNames.has("wp_last_sync_action")) {
    db.exec("ALTER TABLE history ADD COLUMN wp_last_sync_action TEXT");
  }

  if (!columnNames.has("folder_name")) {
    db.exec("ALTER TABLE history ADD COLUMN folder_name TEXT");
  }

  if (!columnNames.has("tags")) {
    db.exec("ALTER TABLE history ADD COLUMN tags TEXT");
  }

  if (!columnNames.has("wp_publish_state")) {
    db.exec("ALTER TABLE history ADD COLUMN wp_publish_state TEXT");
  }

  if (!columnNames.has("wp_error_message")) {
    db.exec("ALTER TABLE history ADD COLUMN wp_error_message TEXT");
  }

  if (!columnNames.has("wp_slug")) {
    db.exec("ALTER TABLE history ADD COLUMN wp_slug TEXT");
  }

  if (!columnNames.has("wp_excerpt")) {
    db.exec("ALTER TABLE history ADD COLUMN wp_excerpt TEXT");
  }

  if (!columnNames.has("wp_categories")) {
    db.exec("ALTER TABLE history ADD COLUMN wp_categories TEXT");
  }

  if (!columnNames.has("wp_tags")) {
    db.exec("ALTER TABLE history ADD COLUMN wp_tags TEXT");
  }
}

function ensureSettingsSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS wordpress_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      site_url TEXT,
      username TEXT,
      app_password TEXT,
      last_test_success INTEGER NOT NULL DEFAULT 0,
      last_tested_at TEXT,
      updated_at TEXT NOT NULL
    );
  `);

  const columns = db.prepare("PRAGMA table_info(wordpress_settings)").all() as Array<{ name: string }>;
  const columnNames = new Set(columns.map((column) => column.name));

  if (!columnNames.has("last_test_success")) {
    db.exec("ALTER TABLE wordpress_settings ADD COLUMN last_test_success INTEGER NOT NULL DEFAULT 0");
  }

  if (!columnNames.has("last_tested_at")) {
    db.exec("ALTER TABLE wordpress_settings ADD COLUMN last_tested_at TEXT");
  }
}

function ensureCalendarSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS content_calendar (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      tool_slug TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'planned',
      scheduled_for TEXT,
      brief TEXT,
      keywords TEXT,
      audience TEXT,
      notes TEXT,
      wp_category TEXT,
      wp_tags TEXT,
      publish_intent TEXT NOT NULL DEFAULT 'draft',
      history_id INTEGER,
      wp_post_id INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  const columns = db.prepare("PRAGMA table_info(content_calendar)").all() as Array<{ name: string }>;
  const columnNames = new Set(columns.map((column) => column.name));

  if (!columnNames.has("brief")) {
    db.exec("ALTER TABLE content_calendar ADD COLUMN brief TEXT");
  }

  if (!columnNames.has("keywords")) {
    db.exec("ALTER TABLE content_calendar ADD COLUMN keywords TEXT");
  }

  if (!columnNames.has("audience")) {
    db.exec("ALTER TABLE content_calendar ADD COLUMN audience TEXT");
  }

  if (!columnNames.has("notes")) {
    db.exec("ALTER TABLE content_calendar ADD COLUMN notes TEXT");
  }

  if (!columnNames.has("history_id")) {
    db.exec("ALTER TABLE content_calendar ADD COLUMN history_id INTEGER");
  }

  if (!columnNames.has("wp_post_id")) {
    db.exec("ALTER TABLE content_calendar ADD COLUMN wp_post_id INTEGER");
  }

  if (!columnNames.has("wp_category")) {
    db.exec("ALTER TABLE content_calendar ADD COLUMN wp_category TEXT");
  }

  if (!columnNames.has("wp_tags")) {
    db.exec("ALTER TABLE content_calendar ADD COLUMN wp_tags TEXT");
  }

  if (!columnNames.has("publish_intent")) {
    db.exec("ALTER TABLE content_calendar ADD COLUMN publish_intent TEXT NOT NULL DEFAULT 'draft'");
  }
}

function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.exec(`
      CREATE TABLE IF NOT EXISTS history (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        tool_slug   TEXT NOT NULL,
        tool_name   TEXT NOT NULL,
        tool_icon   TEXT NOT NULL,
        category    TEXT NOT NULL,
        title       TEXT NOT NULL,
        fields      TEXT NOT NULL,
        output      TEXT NOT NULL,
        word_count  INTEGER NOT NULL,
        created_at  TEXT NOT NULL,
        wp_post_id  INTEGER,
        wp_status   TEXT,
        wp_url      TEXT,
        wp_last_published_at TEXT,
        wp_last_sync_action TEXT,
        folder_name TEXT,
        tags TEXT,
        wp_publish_state TEXT,
        wp_error_message TEXT,
        wp_slug TEXT,
        wp_excerpt TEXT,
        wp_categories TEXT,
        wp_tags TEXT
      );
    `);
    ensureHistorySchema(_db);
    ensureSettingsSchema(_db);
    ensureCalendarSchema(_db);
  }
  return _db;
}

export interface WordPressSettingsRow {
  site_url: string;
  username: string;
  app_password: string;
  last_test_success: boolean;
  last_tested_at: string | null;
  updated_at: string;
}

export interface HistoryRow {
  id: number;
  tool_slug: string;
  tool_name: string;
  tool_icon: string;
  category: string;
  title: string;
  fields: string;      // JSON string
  output: string;
  word_count: number;
  created_at: string;  // ISO string
  wp_post_id: number | null;
  wp_status: string | null;
  wp_url: string | null;
  wp_last_published_at: string | null;
  wp_last_sync_action: "created" | "updated" | null;
  folder_name: string | null;
  tags: string | null;
  /**
   * Canonical publish state for this history row.
   *
   * New values (`draft_created`, `draft_updated`, `published`) are written by
   * the current code.  Legacy rows may still hold the old values `"draft"` or
   * `"publish"` — these are normalised at read-time by
   * `lib/publish-state.resolvePublishState`.
   */
  wp_publish_state: "draft_created" | "draft_updated" | "published" | "scheduled" | "failed" | "draft" | "publish" | null;
  wp_error_message: string | null;
  wp_slug: string | null;
  wp_excerpt: string | null;
  /** Comma-separated WordPress category IDs (e.g. "1, 5, 12"). */
  wp_categories: string | null;
  /** Comma-separated WordPress tag IDs (e.g. "3, 7"). */
  wp_tags: string | null;
}

export interface HistoryQueryOptions {
  toolSlug?: string;
  search?: string;
  status?: "all" | "never-published" | "draft-linked" | "draft-updated" | "publish-failed" | "published-live";
  dateFrom?: string;
  dateTo?: string;
  sortBy?: "newest" | "oldest" | "title-az" | "title-za";
  folder?: string;
  tags?: string[];
}

export interface HistoryTagSummary {
  tag: string;
  count: number;
}

export interface HistoryFolderSummary {
  folder: string;
  count: number;
}

function buildCalendarQueryParts(options: CalendarQueryOptions) {
  const whereClauses: string[] = [];
  const params: Array<string | number> = [];

  if (options.status) {
    whereClauses.push("status = ?");
    params.push(options.status);
  }

  if (options.toolSlug) {
    whereClauses.push("tool_slug = ?");
    params.push(options.toolSlug);
  }

  if (options.publishIntent) {
    whereClauses.push("publish_intent = ?");
    params.push(options.publishIntent);
  }

  if (options.scheduledFrom) {
    whereClauses.push("scheduled_for IS NOT NULL AND scheduled_for >= ?");
    params.push(options.scheduledFrom);
  }

  if (options.scheduledTo) {
    whereClauses.push("scheduled_for IS NOT NULL AND scheduled_for <= ?");
    params.push(options.scheduledTo);
  }

  return {
    whereSql: whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "",
    params,
  };
}

function splitHistoryTags(tags: string | null | undefined): string[] {
  return String(tags ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function dedupeHistoryTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const tag of tags) {
    const normalized = tag.toLowerCase();
    if (seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    deduped.push(tag);
  }

  return deduped;
}

function serializeHistoryTags(tags: string[]): string | null {
  const normalized = dedupeHistoryTags(tags.map((tag) => tag.trim()).filter(Boolean));
  return normalized.length > 0 ? normalized.join(",") : null;
}

function tagsContainMatch(tags: string[], targetTag: string): boolean {
  const normalizedTarget = targetTag.trim().toLowerCase();
  return tags.some((tag) => tag.toLowerCase() === normalizedTarget);
}

function folderNamesMatch(folderName: string | null | undefined, targetFolder: string): boolean {
  return String(folderName ?? "").trim().toLowerCase() === targetFolder.trim().toLowerCase();
}

function buildHistoryQueryParts(options: HistoryQueryOptions) {
  const whereClauses: string[] = [];
  const params: Array<string | number> = [];

  if (options.toolSlug) {
    whereClauses.push("tool_slug = ?");
    params.push(options.toolSlug);
  }

  if (options.search) {
    const searchTerm = `%${options.search}%`;
    whereClauses.push(`(
      title LIKE ? COLLATE NOCASE OR
      tool_name LIKE ? COLLATE NOCASE OR
      category LIKE ? COLLATE NOCASE OR
      output LIKE ? COLLATE NOCASE OR
      COALESCE(folder_name, '') LIKE ? COLLATE NOCASE OR
      COALESCE(tags, '') LIKE ? COLLATE NOCASE
    )`);
    params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
  }

  if (options.folder) {
    whereClauses.push("folder_name = ?");
    params.push(options.folder);
  }

  for (const tag of options.tags ?? []) {
    whereClauses.push(`(
      tags = ? COLLATE NOCASE OR
      tags LIKE ? COLLATE NOCASE OR
      tags LIKE ? COLLATE NOCASE OR
      tags LIKE ? COLLATE NOCASE
    )`);
    params.push(tag, `${tag},%`, `%,${tag}`, `%,${tag},%`);
  }

  if (options.status === "never-published") {
    // Rows that have never had a successful publish attempt: no wp_post_id and
    // not in a "failed" state.  Failed rows are intentionally excluded because
    // they represent items that had at least one attempted (but unsuccessful)
    // publish — they belong to the "publish-failed" bucket instead.
    whereClauses.push("(wp_publish_state IS NULL OR wp_publish_state <> 'failed') AND wp_post_id IS NULL");
  } else if (options.status === "draft-linked") {
    // Matches both new ("draft_created") and legacy ("draft" + created action) stored values
    whereClauses.push("wp_post_id IS NOT NULL AND (wp_publish_state = 'draft_created' OR ((wp_publish_state IS NULL OR wp_publish_state = 'draft') AND (wp_last_sync_action IS NULL OR wp_last_sync_action = 'created')))");
  } else if (options.status === "draft-updated") {
    // Matches both new ("draft_updated") and legacy ("draft" + updated action) stored values
    whereClauses.push("wp_post_id IS NOT NULL AND (wp_publish_state = 'draft_updated' OR ((wp_publish_state IS NULL OR wp_publish_state = 'draft') AND wp_last_sync_action = 'updated'))");
  } else if (options.status === "published-live") {
    // Matches both new ("published") and legacy ("publish") stored values
    whereClauses.push("wp_post_id IS NOT NULL AND (wp_publish_state = 'published' OR wp_publish_state = 'publish')");
  } else if (options.status === "publish-failed") {
    whereClauses.push("wp_publish_state = 'failed'");
  }

  if (options.dateFrom) {
    whereClauses.push("created_at >= ?");
    params.push(options.dateFrom);
  }

  if (options.dateTo) {
    whereClauses.push("created_at < ?");
    params.push(options.dateTo);
  }

  const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

  let orderBy = "created_at DESC";
  if (options.sortBy === "oldest") {
    orderBy = "created_at ASC";
  } else if (options.sortBy === "title-az") {
    orderBy = "title ASC, created_at DESC";
  } else if (options.sortBy === "title-za") {
    orderBy = "title DESC, created_at DESC";
  }

  return { whereSql, params, orderBy };
}

export function saveHistory(entry: Omit<HistoryRow, "id">): HistoryRow {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO history (
      tool_slug,
      tool_name,
      tool_icon,
      category,
      title,
      fields,
      output,
      word_count,
      created_at,
      wp_post_id,
      wp_status,
      wp_url,
      wp_last_published_at,
      wp_last_sync_action,
      folder_name,
      tags,
      wp_publish_state,
      wp_error_message,
      wp_slug,
      wp_excerpt,
      wp_categories,
      wp_tags
    )
    VALUES (
      @tool_slug,
      @tool_name,
      @tool_icon,
      @category,
      @title,
      @fields,
      @output,
      @word_count,
      @created_at,
      @wp_post_id,
      @wp_status,
      @wp_url,
      @wp_last_published_at,
      @wp_last_sync_action,
      @folder_name,
      @tags,
      @wp_publish_state,
      @wp_error_message,
      @wp_slug,
      @wp_excerpt,
      @wp_categories,
      @wp_tags
    )
  `);
  const result = stmt.run(entry);
  return { id: result.lastInsertRowid as number, ...entry };
}

export function updateHistoryWordPressDraft(
  id: number,
  draft: {
    wp_post_id: number;
    wp_status: string;
    wp_url: string;
    wp_last_published_at: string;
    wp_last_sync_action: "created" | "updated";
    wp_publish_state: "draft_created" | "draft_updated" | "published" | "scheduled";
  }
): HistoryRow | undefined {
  const db = getDb();
  const result = db.prepare(`
    UPDATE history
    SET wp_post_id = @wp_post_id,
        wp_status = @wp_status,
        wp_url = @wp_url,
      wp_last_published_at = @wp_last_published_at,
      wp_last_sync_action = @wp_last_sync_action,
      wp_publish_state = @wp_publish_state,
      wp_error_message = NULL
    WHERE id = @id
  `).run({ id, ...draft });

  if (result.changes === 0) {
    return undefined;
  }

  return getHistoryById(id);
}

export function markHistoryPublishFailed(
  id: number,
  errorMessage: string
): HistoryRow | undefined {
  const db = getDb();
  const result = db.prepare(`
    UPDATE history
    SET wp_publish_state = 'failed',
        wp_error_message = ?
    WHERE id = ?
  `).run(errorMessage, id);

  if (result.changes === 0) {
    return undefined;
  }

  return getHistoryById(id);
}

export function updateHistoryMetadata(
  id: number,
  metadata: {
    title: string;
    folder_name: string | null;
    tags: string | null;
    wp_slug?: string | null;
    wp_excerpt?: string | null;
    wp_categories?: string | null;
    wp_tags?: string | null;
  }
): HistoryRow | undefined {
  const db = getDb();
  const result = db.prepare(`
    UPDATE history
    SET title = @title,
        folder_name = @folder_name,
        tags = @tags,
        wp_slug = @wp_slug,
        wp_excerpt = @wp_excerpt,
        wp_categories = @wp_categories,
        wp_tags = @wp_tags
    WHERE id = @id
  `).run({
    id,
    title: metadata.title,
    folder_name: metadata.folder_name,
    tags: metadata.tags,
    wp_slug: metadata.wp_slug ?? null,
    wp_excerpt: metadata.wp_excerpt ?? null,
    wp_categories: metadata.wp_categories ?? null,
    wp_tags: metadata.wp_tags ?? null,
  });

  if (result.changes === 0) {
    return undefined;
  }

  return getHistoryById(id);
}

export function bulkAssignHistoryMetadata(
  ids: number[],
  changes: {
    folder_name?: string | null;
    clear_folder?: boolean;
    append_tags?: string[];
    replace_tags?: string[];
  }
): HistoryRow[] {
  const db = getDb();
  const updatedRows: HistoryRow[] = [];

  const transaction = db.transaction((targetIds: number[]) => {
    for (const id of targetIds) {
      const current = getHistoryById(id);
      if (!current) {
        continue;
      }

      const currentTags = splitHistoryTags(current.tags);

      const nextTags = changes.replace_tags
        ? dedupeHistoryTags(changes.replace_tags.map((tag) => tag.trim()).filter(Boolean))
        : dedupeHistoryTags([
            ...currentTags,
            ...(changes.append_tags ?? []).map((tag) => tag.trim()).filter(Boolean),
          ]);

      const nextFolderName = changes.clear_folder
        ? null
        : changes.folder_name !== undefined
          ? changes.folder_name
          : current.folder_name;

      db.prepare(`
        UPDATE history
        SET folder_name = @folder_name,
            tags = @tags
        WHERE id = @id
      `).run({
        id,
        folder_name: nextFolderName,
        tags: serializeHistoryTags(nextTags),
      });

      const updated = getHistoryById(id);
      if (updated) {
        updatedRows.push(updated);
      }
    }
  });

  transaction(ids);
  return updatedRows;
}

export function listHistory(limit = 100, options: HistoryQueryOptions = {}, offset = 0): HistoryRow[] {
  const db = getDb();
  const { whereSql, params, orderBy } = buildHistoryQueryParts(options);
  return db
    .prepare(`SELECT * FROM history ${whereSql} ORDER BY ${orderBy} LIMIT ? OFFSET ?`)
    .all(...params, limit, offset) as HistoryRow[];
}

export function listHistoryTags(): HistoryTagSummary[] {
  const db = getDb();
  const rows = db.prepare("SELECT tags FROM history WHERE tags IS NOT NULL AND TRIM(tags) <> ''").all() as Array<{ tags: string }>;
  const counts = new Map<string, HistoryTagSummary>();

  for (const row of rows) {
    for (const tag of dedupeHistoryTags(splitHistoryTags(row.tags))) {
      const normalized = tag.toLowerCase();
      const existing = counts.get(normalized);

      if (existing) {
        existing.count += 1;
        continue;
      }

      counts.set(normalized, { tag, count: 1 });
    }
  }

  return Array.from(counts.values()).sort((left, right) => left.tag.localeCompare(right.tag));
}

export function listHistoryFolders(): HistoryFolderSummary[] {
  const db = getDb();
  const rows = db.prepare("SELECT folder_name FROM history WHERE folder_name IS NOT NULL AND TRIM(folder_name) <> ''").all() as Array<{
    folder_name: string;
  }>;
  const counts = new Map<string, HistoryFolderSummary>();

  for (const row of rows) {
    const folder = row.folder_name.trim();
    const normalized = folder.toLowerCase();
    const existing = counts.get(normalized);

    if (existing) {
      existing.count += 1;
      continue;
    }

    counts.set(normalized, { folder, count: 1 });
  }

  return Array.from(counts.values()).sort((left, right) => left.folder.localeCompare(right.folder));
}

function mutateHistoryTags(
  targetTag: string,
  updater: (tags: string[]) => string[]
): number {
  const normalizedTarget = targetTag.trim().toLowerCase();

  if (!normalizedTarget) {
    return 0;
  }

  const db = getDb();
  const rows = db.prepare("SELECT id, tags FROM history WHERE tags IS NOT NULL AND TRIM(tags) <> ''").all() as Array<{
    id: number;
    tags: string;
  }>;
  let updatedCount = 0;

  const transaction = db.transaction(() => {
    for (const row of rows) {
      const currentTags = splitHistoryTags(row.tags);
      if (!currentTags.some((tag) => tag.toLowerCase() === normalizedTarget)) {
        continue;
      }

      const nextTags = serializeHistoryTags(updater(currentTags));
      db.prepare("UPDATE history SET tags = ? WHERE id = ?").run(nextTags, row.id);
      updatedCount += 1;
    }
  });

  transaction();
  return updatedCount;
}

export function renameHistoryTag(currentTag: string, nextTag: string): number {
  const trimmedNextTag = nextTag.trim();
  if (!trimmedNextTag) {
    return 0;
  }

  return mutateHistoryTags(currentTag, (tags) =>
    dedupeHistoryTags(
      tags.map((tag) => (tag.toLowerCase() === currentTag.trim().toLowerCase() ? trimmedNextTag : tag))
    )
  );
}

export function mergeHistoryTags(sourceTag: string, targetTag: string): number {
  const trimmedTargetTag = targetTag.trim();
  if (!trimmedTargetTag) {
    return 0;
  }

  return mutateHistoryTags(sourceTag, (tags) =>
    dedupeHistoryTags(
      tags.map((tag) => (tag.toLowerCase() === sourceTag.trim().toLowerCase() ? trimmedTargetTag : tag))
    )
  );
}

export function deleteHistoryTag(tagToDelete: string): number {
  return mutateHistoryTags(tagToDelete, (tags) =>
    tags.filter((tag) => !tagsContainMatch([tag], tagToDelete))
  );
}

function mutateHistoryFolders(
  targetFolder: string,
  updater: (folderName: string) => string | null
): number {
  const trimmedTarget = targetFolder.trim();
  if (!trimmedTarget) {
    return 0;
  }

  const db = getDb();
  const rows = db.prepare("SELECT id, folder_name FROM history WHERE folder_name IS NOT NULL AND TRIM(folder_name) <> ''").all() as Array<{
    id: number;
    folder_name: string;
  }>;
  let updatedCount = 0;

  const transaction = db.transaction(() => {
    for (const row of rows) {
      if (!folderNamesMatch(row.folder_name, trimmedTarget)) {
        continue;
      }

      const nextFolderName = updater(row.folder_name.trim());
      db.prepare("UPDATE history SET folder_name = ? WHERE id = ?").run(nextFolderName, row.id);
      updatedCount += 1;
    }
  });

  transaction();
  return updatedCount;
}

export function renameHistoryFolder(currentFolder: string, nextFolder: string): number {
  const trimmedNextFolder = nextFolder.trim();
  if (!trimmedNextFolder) {
    return 0;
  }

  return mutateHistoryFolders(currentFolder, () => trimmedNextFolder);
}

export function mergeHistoryFolders(sourceFolder: string, targetFolder: string): number {
  const trimmedTargetFolder = targetFolder.trim();
  if (!trimmedTargetFolder) {
    return 0;
  }

  return mutateHistoryFolders(sourceFolder, () => trimmedTargetFolder);
}

export function deleteHistoryFolder(folderToDelete: string): number {
  return mutateHistoryFolders(folderToDelete, () => null);
}

export function countHistory(options: HistoryQueryOptions = {}): number {
  const db = getDb();
  const { whereSql, params } = buildHistoryQueryParts(options);
  const row = db.prepare(`SELECT COUNT(*) as count FROM history ${whereSql}`).get(...params) as { count: number };
  return row.count;
}

export function deleteHistory(id: number): boolean {
  const db = getDb();
  const result = db.prepare("DELETE FROM history WHERE id = ?").run(id);
  return result.changes > 0;
}

export function getHistoryById(id: number): HistoryRow | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM history WHERE id = ?").get(id) as HistoryRow | undefined;
}

export function getWordPressSettings(): WordPressSettingsRow | undefined {
  const db = getDb();
  const row = db.prepare(
    "SELECT site_url, username, app_password, last_test_success, last_tested_at, updated_at FROM wordpress_settings WHERE id = 1"
  ).get() as {
    site_url: string;
    username: string;
    app_password: string;
    last_test_success: number;
    last_tested_at: string | null;
    updated_at: string;
  } | undefined;

  if (!row) {
    return undefined;
  }

  return {
    ...row,
    last_test_success: Boolean(row.last_test_success),
  };
}

export function saveWordPressSettings(settings: {
  site_url: string;
  username: string;
  app_password: string;
  last_test_success?: boolean;
  last_tested_at?: string | null;
}): WordPressSettingsRow {
  const db = getDb();
  const updated_at = new Date().toISOString();

  db.prepare(`
    INSERT INTO wordpress_settings (
      id,
      site_url,
      username,
      app_password,
      last_test_success,
      last_tested_at,
      updated_at
    )
    VALUES (
      1,
      @site_url,
      @username,
      @app_password,
      @last_test_success,
      @last_tested_at,
      @updated_at
    )
    ON CONFLICT(id) DO UPDATE SET
      site_url = excluded.site_url,
      username = excluded.username,
      app_password = excluded.app_password,
      last_test_success = excluded.last_test_success,
      last_tested_at = excluded.last_tested_at,
      updated_at = excluded.updated_at
  `).run({
    ...settings,
    last_test_success: settings.last_test_success ? 1 : 0,
    last_tested_at: settings.last_tested_at ?? null,
    updated_at,
  });

  return getWordPressSettings() as WordPressSettingsRow;
}

export function listCalendarEntries(options: CalendarQueryOptions = {}): CalendarEntry[] {
  const db = getDb();
  const { whereSql, params } = buildCalendarQueryParts(options);

  return db.prepare(`
    SELECT *
    FROM content_calendar
    ${whereSql}
    ORDER BY
      CASE WHEN scheduled_for IS NULL THEN 1 ELSE 0 END ASC,
      scheduled_for ASC,
      updated_at DESC
  `).all(...params) as CalendarEntry[];
}

export function getCalendarEntryById(id: number): CalendarEntry | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM content_calendar WHERE id = ?").get(id) as CalendarEntry | undefined;
}

export function createCalendarEntry(entry: Omit<CalendarEntry, "id" | "created_at" | "updated_at">): CalendarEntry {
  const db = getDb();
  const now = new Date().toISOString();
  const result = db.prepare(`
    INSERT INTO content_calendar (
      title,
      tool_slug,
      status,
      scheduled_for,
      brief,
      keywords,
      audience,
      notes,
      wp_category,
      wp_tags,
      publish_intent,
      history_id,
      wp_post_id,
      created_at,
      updated_at
    ) VALUES (
      @title,
      @tool_slug,
      @status,
      @scheduled_for,
      @brief,
      @keywords,
      @audience,
      @notes,
      @wp_category,
      @wp_tags,
      @publish_intent,
      @history_id,
      @wp_post_id,
      @created_at,
      @updated_at
    )
  `).run({
    ...entry,
    created_at: now,
    updated_at: now,
  });

  return getCalendarEntryById(result.lastInsertRowid as number) as CalendarEntry;
}

export function updateCalendarEntry(
  id: number,
  changes: Omit<CalendarEntry, "id" | "created_at" | "updated_at">
): CalendarEntry | undefined {
  const db = getDb();
  const result = db.prepare(`
    UPDATE content_calendar
    SET title = @title,
        tool_slug = @tool_slug,
        status = @status,
        scheduled_for = @scheduled_for,
        brief = @brief,
        keywords = @keywords,
        audience = @audience,
        notes = @notes,
        wp_category = @wp_category,
        wp_tags = @wp_tags,
        publish_intent = @publish_intent,
        history_id = @history_id,
        wp_post_id = @wp_post_id,
        updated_at = @updated_at
    WHERE id = @id
  `).run({
    id,
    ...changes,
    updated_at: new Date().toISOString(),
  });

  if (result.changes === 0) {
    return undefined;
  }

  return getCalendarEntryById(id);
}

export function deleteCalendarEntry(id: number): boolean {
  const db = getDb();
  const result = db.prepare("DELETE FROM content_calendar WHERE id = ?").run(id);
  return result.changes > 0;
}

/**
 * Computes a CalendarSummary from an arbitrary list of calendar entries.
 * Use this to produce summary metrics that match whatever filtered set of
 * rows the caller already holds, so that summary cards stay aligned with
 * the active view/filter state.
 */
export function computeCalendarSummary(rows: CalendarEntry[]): CalendarSummary {
  const today = new Date().toISOString().slice(0, 10);
  const weekAhead = new Date();
  weekAhead.setUTCDate(weekAhead.getUTCDate() + 7);
  const weekAheadValue = weekAhead.toISOString().slice(0, 10);

  const summary: CalendarSummary = {
    total: rows.length,
    overdue: 0,
    dueThisWeek: 0,
    unscheduled: 0,
    byStatus: {
      backlog: 0,
      planned: 0,
      "in-progress": 0,
      ready: 0,
      published: 0,
    },
  };

  for (const row of rows) {
    if (CALENDAR_STATUSES.includes(row.status)) {
      summary.byStatus[row.status as CalendarEntryStatus] += 1;
    }

    if (!row.scheduled_for) {
      summary.unscheduled += 1;
      continue;
    }

    if (row.status !== "published" && row.scheduled_for < today) {
      summary.overdue += 1;
    }

    if (row.scheduled_for >= today && row.scheduled_for <= weekAheadValue) {
      summary.dueThisWeek += 1;
    }
  }

  return summary;
}

/** Returns a CalendarSummary computed from all (unfiltered) calendar entries. */
export function getCalendarSummary(): CalendarSummary {
  return computeCalendarSummary(listCalendarEntries());
}

export function linkCalendarEntryToHistory(calendarId: number, historyId: number): CalendarEntry | undefined {
  const db = getDb();
  const existing = getCalendarEntryById(calendarId);
  if (!existing) {
    return undefined;
  }

  const nextStatus: CalendarEntryStatus =
    existing.status === "backlog" || existing.status === "planned"
      ? "in-progress"
      : existing.status;

  db.prepare(`
    UPDATE content_calendar
    SET history_id = ?,
        status = ?,
        updated_at = ?
    WHERE id = ?
  `).run(historyId, nextStatus, new Date().toISOString(), calendarId);

  return getCalendarEntryById(calendarId);
}

export function syncCalendarEntryWordPressDraft(options: {
  calendarId?: number | null;
  historyId?: number | null;
  wpPostId: number;
}) {
  const db = getDb();
  const now = new Date().toISOString();

  if (typeof options.calendarId === "number") {
    db.prepare(`
      UPDATE content_calendar
      SET wp_post_id = ?,
          status = CASE WHEN status = 'published' THEN status ELSE 'ready' END,
          updated_at = ?
      WHERE id = ?
    `).run(options.wpPostId, now, options.calendarId);
  }

  if (typeof options.historyId === "number") {
    db.prepare(`
      UPDATE content_calendar
      SET wp_post_id = ?,
          status = CASE WHEN status = 'published' THEN status ELSE 'ready' END,
          updated_at = ?
      WHERE history_id = ?
    `).run(options.wpPostId, now, options.historyId);
  }
}

export function normalizeCalendarPublishIntent(value: string | null | undefined): CalendarPublishIntent {
  if (value && CALENDAR_PUBLISH_INTENTS.includes(value as CalendarPublishIntent)) {
    return value as CalendarPublishIntent;
  }

  return "draft";
}
