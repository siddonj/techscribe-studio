# TechScribe Studio — SQLite Data Persistence and Backup

This document explains what data TechScribe Studio persists, where it lives on disk, what durable storage is required, and how to back it up correctly for a self-hosted install.

For deployment steps, process management, and reverse proxy setup, see **[docs/operations.md](operations.md)**.
For recovery procedures when the database is missing, locked, or corrupt, see **[docs/recovery.md](recovery.md)**.
For upgrade procedures, schema migration details, and rollback steps, see **[docs/upgrade.md](upgrade.md)**.

---

## Table of Contents

1. [The database file](#1-the-database-file)
2. [What is stored](#2-what-is-stored)
3. [Why durable storage matters](#3-why-durable-storage-matters)
4. [Data directory expectations](#4-data-directory-expectations)
5. [Backup guidance](#5-backup-guidance)
6. [Restoring from a backup](#6-restoring-from-a-backup)
7. [Container and ephemeral deployments](#7-container-and-ephemeral-deployments)

---

## 1. The database file

All persistent state lives in a single SQLite file:

```
<project-root>/data/history.db
```

The path is resolved relative to the process working directory at startup (`process.cwd()`), which must be the project root. If the working directory is wrong, the app creates a new empty database in the wrong location and appears to lose all existing data.

### WAL-mode sidecar files

The database is opened in [WAL (Write-Ahead Logging) mode](https://www.sqlite.org/wal.html). While the app is running you will also see:

```
data/history.db-wal
data/history.db-shm
```

These files are managed automatically by SQLite. They are not independent backups and must not be copied in isolation. When the app shuts down cleanly, SQLite checkpoints the WAL and may remove the sidecar files. If they are present when you take a backup, copy all three files together or use the safe online-backup method described in [Section 5](#5-backup-guidance).

### What is not persistent data

| Path | Purpose | Persistent? |
|---|---|---|
| `data/history.db` | All user data | **Yes — back this up** |
| `data/history.db-wal` | WAL sidecar (active transactions) | Managed by SQLite |
| `data/history.db-shm` | WAL sidecar (shared memory) | Managed by SQLite |
| `.next/` | Production build output | No — rebuild with `npm run build` |
| `node_modules/` | Installed packages | No — reinstall with `npm install` |

---

## 2. What is stored

The database contains three tables. Every row in every table is irreplaceable user data that is not recoverable from the application source code or environment variables.

### `history` — generated content archive

| Column | Description |
|---|---|
| `id` | Auto-assigned row identifier |
| `tool_slug`, `tool_name`, `tool_icon`, `category` | Which tool produced this entry |
| `title` | Entry title (user-editable) |
| `fields` | JSON snapshot of the input fields submitted to the tool |
| `output` | Full generated text |
| `word_count` | Computed word count of the output |
| `created_at` | ISO 8601 timestamp when the entry was saved |
| `folder_name` | Folder the entry is assigned to, if any |
| `tags` | JSON array of tags, if any |
| `wp_post_id` | WordPress post ID after a draft is created or updated |
| `wp_status`, `wp_url`, `wp_slug`, `wp_excerpt` | WordPress metadata synced at publish time |
| `wp_publish_state` | Last known publish state (e.g. `Draft Linked`, `Published Live`) |
| `wp_categories`, `wp_tags` | WordPress taxonomy assignments |
| `wp_last_published_at`, `wp_last_sync_action` | Timestamp and action of the last WordPress sync |
| `wp_error_message` | Error detail if the last publish attempt failed |

Every entry a user saves from any tool page is a row here. Deleting this table means losing the entire generated content archive.

### `wordpress_settings` — in-app WordPress credentials

| Column | Description |
|---|---|
| `id` | Always `1` (single-row table) |
| `site_url` | WordPress site root URL |
| `username` | WordPress username |
| `app_password` | WordPress application password |
| `last_test_success` | `1` if the last connection test passed, `0` otherwise |
| `last_tested_at` | Timestamp of the last connection test |
| `updated_at` | Timestamp of the last settings save |

This row is created the first time a user saves credentials on the Settings page. If this row is lost, the user must re-enter and re-test their WordPress credentials before publishing is re-enabled.

Note: this table stores credentials. Treat the database file with the same care as `.env.local` — restrict its filesystem permissions and exclude it from any backups stored in shared or public locations.

### `content_calendar` — editorial planning entries

| Column | Description |
|---|---|
| `id` | Auto-assigned row identifier |
| `title` | Calendar entry title |
| `tool_slug` | Which tool is assigned to generate this piece |
| `status` | Planning status (`planned`, `in_progress`, `done`, `archived`) |
| `scheduled_for` | Target date for the piece (ISO 8601) |
| `brief`, `keywords`, `audience`, `notes` | Editorial planning fields |
| `wp_category`, `wp_tags` | WordPress taxonomy to apply at publish time |
| `publish_intent` | How the post should be sent to WordPress (`draft`, `publish`, `schedule`) |
| `history_id` | Foreign key to the `history` row created when this entry was generated |
| `wp_post_id` | WordPress post ID after a linked draft is created |
| `created_at`, `updated_at` | Timestamps |

Losing this table means losing all planned content, editorial briefs, scheduling intent, and the links between calendar items and their generated drafts.

---

## 3. Why durable storage matters

TechScribe Studio is a **stateful, local-first application**. Unlike a stateless frontend, it accumulates data over time that is not retrievable from any external source:

- Generated content lives only in `history.db`. The Anthropic API does not store responses. If a saved entry is lost, the text must be regenerated manually.
- WordPress credentials are stored in the database. Without them, publishing is disabled until the user reconfigures and re-tests the connection.
- Calendar planning data is not mirrored anywhere. Lost editorial plans, briefs, and scheduling metadata cannot be reconstructed automatically.

The application does **not** currently support an external database, cloud sync, or export-on-write. The single SQLite file is the only copy of all user data.

Treat `data/history.db` like the only copy of the user's work — because it is.

---

## 4. Data directory expectations

### Location

The `data/` directory is always relative to the process working directory:

```
<process.cwd()>/data/history.db
```

The app creates the directory automatically on first start if it does not exist, but it cannot create the directory if the parent path does not exist or is not writable.

### Permissions

The process user must have read and write permission on the `data/` directory and the database file. A quick check:

```bash
# From the project root, as the process user
ls -la data/
touch data/.write-test && rm data/.write-test
```

A failed `touch` means the process will fail to write to the database.

Recommended permissions for a dedicated service user:

```bash
chown -R techscribe:techscribe /opt/techscribe-studio/data
chmod 750 /opt/techscribe-studio/data
```

### Working directory

The correct working directory at startup is the project root. Misconfiguring the working directory is the most common cause of apparent data loss — the app starts without error but creates a new empty database at the wrong path.

For **systemd**, set `WorkingDirectory=` in the unit file:

```ini
WorkingDirectory=/opt/techscribe-studio
```

For **PM2**, use the `--cwd` flag:

```bash
pm2 start "npm run start" --name techscribe-studio --cwd /opt/techscribe-studio
```

Confirm the working directory is correct at any time:

```bash
ls data/history.db   # run from the project root
```

---

## 5. Backup guidance

### Pre-upgrade backups

Always take a named backup before upgrading to a new version of TechScribe Studio. The app applies schema migrations automatically on startup, and while those migrations are non-destructive, a pre-upgrade backup gives you a restore point:

```bash
sqlite3 data/history.db ".backup backups/history-pre-upgrade-$(date +%Y%m%d).db"
```

See **[docs/upgrade.md](upgrade.md)** for the full upgrade procedure and rollback steps.

### Minimum viable backup

Copy the database file on a schedule. Stop the app first if you want the simplest, safest snapshot:

```bash
# Daily backup to a timestamped file
cp data/history.db backups/history-$(date +%Y%m%d).db
```

Stopping the app guarantees the WAL is fully checkpointed before copying.

### Online backup (safe while the app is running)

The `sqlite3` CLI `.backup` command uses the [SQLite Online Backup API](https://www.sqlite.org/backup.html), which produces a consistent snapshot even while the app has the database open and is actively writing:

```bash
sqlite3 data/history.db ".backup backups/history-$(date +%Y%m%d).db"
```

This is the recommended method for production installs where stopping the app during backup is not desirable.

Do **not** copy `data/history.db` with `cp` while the app is running — the WAL sidecar files may be out of sync, and the resulting copy can be corrupt or incomplete.

### Verify a backup

Confirm the backup file is a valid, non-empty SQLite database before relying on it:

```bash
sqlite3 backups/history-$(date +%Y%m%d).db "PRAGMA integrity_check;"
```

Expected output: `ok`. Any other output indicates a problem with the backup.

Check row counts to confirm data is present:

```bash
sqlite3 backups/history-$(date +%Y%m%d).db "
  SELECT 'history',          COUNT(*) FROM history;
  SELECT 'calendar',         COUNT(*) FROM content_calendar;
  SELECT 'wordpress_settings', COUNT(*) FROM wordpress_settings;
"
```

### Retention

Keep at least seven daily backups. Rotate older files with:

```bash
find backups/ -name "history-*.db" -mtime +7 -delete
```

### Cron example (daily at 02:00)

```cron
0 2 * * * cd /opt/techscribe-studio && sqlite3 data/history.db ".backup backups/history-$(date +\%Y\%m\%d).db" && find backups/ -name "history-*.db" -mtime +7 -delete
```

### What to back up — summary

| File | Back up? | Notes |
|---|---|---|
| `data/history.db` | **Yes** | The only file that needs to be backed up |
| `data/history.db-wal` | No | Sidecar managed by SQLite; included automatically by the `.backup` command |
| `data/history.db-shm` | No | Sidecar managed by SQLite |
| `.env.local` | Separately | Contains secrets; back up via a secrets manager, not with the database file |

---

## 6. Restoring from a backup

1. Stop the app.
2. Replace `data/history.db` with your backup file.
3. Start the app.

```bash
sudo systemctl stop techscribe-studio
cp backups/history-20240101.db data/history.db
sudo systemctl start techscribe-studio
```

After restart, verify the data is present:

```bash
sqlite3 data/history.db "SELECT COUNT(*) FROM history;"
```

If the count matches your expectations, the restore was successful.

For a corrupt database where no backup exists, see [Section 2.3 of the recovery guide](recovery.md#23--database-is-corrupt) for the dump-and-rebuild procedure.

---

## 7. Container and ephemeral deployments

Platforms that do not provide persistent storage by default (Docker without a named volume, most serverless environments) will lose all data on every container restart.

### Docker

Mount a named or bind-mount volume at the project root's `data/` path:

```yaml
services:
  techscribe-studio:
    image: your-image
    volumes:
      - /persistent/techscribe/data:/app/data
    environment:
      - NODE_ENV=production
      - ANTHROPIC_API_KEY=sk-ant-YOUR_KEY_HERE
```

Confirm the volume is writable before starting the app:

```bash
touch /persistent/techscribe/data/.write-test && rm /persistent/techscribe/data/.write-test
```

### Serverless

TechScribe Studio is not designed for serverless deployment. The local SQLite storage model is fundamentally incompatible with ephemeral compute environments where the filesystem is discarded between invocations. Use a persistent VM or container platform with durable volume support.
