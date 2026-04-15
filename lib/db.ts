import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

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
        tags TEXT
      );
    `);
    ensureHistorySchema(_db);
    ensureSettingsSchema(_db);
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
}

export interface HistoryQueryOptions {
  toolSlug?: string;
  search?: string;
  status?: "all" | "never-published" | "draft-linked" | "draft-updated";
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
    whereClauses.push("wp_post_id IS NULL");
  } else if (options.status === "draft-linked") {
    whereClauses.push("wp_post_id IS NOT NULL AND (wp_last_sync_action IS NULL OR wp_last_sync_action = 'created')");
  } else if (options.status === "draft-updated") {
    whereClauses.push("wp_post_id IS NOT NULL AND wp_last_sync_action = 'updated'");
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
      tags
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
      @tags
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
  }
): HistoryRow | undefined {
  const db = getDb();
  const result = db.prepare(`
    UPDATE history
    SET wp_post_id = @wp_post_id,
        wp_status = @wp_status,
        wp_url = @wp_url,
      wp_last_published_at = @wp_last_published_at,
      wp_last_sync_action = @wp_last_sync_action
    WHERE id = @id
  `).run({ id, ...draft });

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
  }
): HistoryRow | undefined {
  const db = getDb();
  const result = db.prepare(`
    UPDATE history
    SET title = @title,
        folder_name = @folder_name,
        tags = @tags
    WHERE id = @id
  `).run({ id, ...metadata });

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
