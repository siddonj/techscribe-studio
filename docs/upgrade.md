# TechScribe Studio — Upgrade and Migration Guide

This guide covers how to safely upgrade a self-hosted TechScribe Studio install, what happens to the database during an upgrade, and how to recover if something goes wrong.

For the full backup reference, see **[Data Persistence and Backup](data-persistence.md)**.
For runtime failure recovery, see **[Failure Recovery Guide](recovery.md)**.
For first-time deployment, see **[Operations Guide](operations.md)**.

---

## Table of Contents

1. [How schema migrations work](#1-how-schema-migrations-work)
2. [Before every upgrade](#2-before-every-upgrade)
3. [Standard upgrade procedure](#3-standard-upgrade-procedure)
4. [Persistence-sensitive changes](#4-persistence-sensitive-changes)
5. [Rolling back an upgrade](#5-rolling-back-an-upgrade)
6. [Verifying the upgrade](#6-verifying-the-upgrade)

---

## 1. How schema migrations work

TechScribe Studio manages its own schema using an **additive, column-level migration** strategy. On every startup, the app:

1. Creates all three core tables (`history`, `wordpress_settings`, `content_calendar`) if they do not exist.
2. Inspects the live schema of each table using `PRAGMA table_info`.
3. Adds any columns that are missing from the table definition using `ALTER TABLE … ADD COLUMN`.

This approach has two important properties:

**Non-destructive.** Existing data is never altered, deleted, or moved. A column addition cannot change or remove the values in existing rows. All previously saved history entries, WordPress credentials, and calendar items survive the migration unchanged.

**Automatic.** You do not need to run any migration commands manually. Starting the app after a code update is sufficient to apply the schema changes. The migration completes before the first request is served.

### What automatic migrations cover

| Schema change | Handled automatically? |
|---|---|
| New column added to an existing table | **Yes** |
| New column with a `DEFAULT` value | **Yes** — existing rows receive the default |
| New column without a default | **Yes** — existing rows receive `NULL` |
| Table renamed or dropped | **No** — would require manual intervention |
| Column renamed or removed | **No** — would require manual intervention |

Non-additive schema changes (renames, drops, table restructuring) are not part of the current migration strategy and would be called out explicitly in release notes as **persistence-sensitive changes** requiring special handling. See [Section 4](#4-persistence-sensitive-changes) for what that means and how to prepare.

---

## 2. Before every upgrade

### Step 1 — Back up the database

Always take a backup of `data/history.db` before pulling new code. This gives you a restore point if anything goes wrong during the upgrade or migration.

**Online backup (safe while the app is running):**

```bash
sqlite3 data/history.db ".backup backups/history-pre-upgrade-$(date +%Y%m%d).db"
```

**Verify the backup before proceeding:**

```bash
sqlite3 backups/history-pre-upgrade-$(date +%Y%m%d).db "PRAGMA integrity_check;"
```

Expected output: `ok`. Do not proceed if the output is anything else — your existing database may already have issues that should be resolved before upgrading.

### Step 2 — Check the release notes

Before upgrading, review the release notes for the version you are installing. Look for:

- Any entry marked **persistence-sensitive** or **schema change** — these require extra care; see [Section 4](#4-persistence-sensitive-changes).
- Dependency changes that affect the native `better-sqlite3` addon (see [Section 3, Step 3](#step-3--install-dependencies)).
- New required environment variables — listed in [Section 3 of the operations guide](operations.md#3-environment-configuration-reference).

---

## 3. Standard upgrade procedure

Follow these steps in order. Do not skip the backup step.

### Step 1 — Stop the app

```bash
# systemd
sudo systemctl stop techscribe-studio

# PM2
pm2 stop techscribe-studio
```

Stopping the app before pulling code avoids running a mismatched version where new API routes are served against an old build.

### Step 2 — Back up the database

```bash
sqlite3 data/history.db ".backup backups/history-pre-upgrade-$(date +%Y%m%d).db"
```

If you already did this in [Section 2](#2-before-every-upgrade), you can skip this step, but a second backup immediately before the upgrade is a belt-and-suspenders precaution.

### Step 3 — Pull the latest code

```bash
git pull origin main
```

### Step 4 — Install dependencies

```bash
npm install
```

`better-sqlite3` includes a native Node.js addon compiled against the Node.js version in use. If the Node.js version changed between your previous install and now, `npm install` rebuilds the addon automatically. If you see errors like `NODE_MODULE_VERSION mismatch`, ensure your Node.js version meets the requirement (≥ 20) and run `npm install` again.

### Step 5 — Rebuild the production bundle

```bash
npm run build
```

This regenerates the `.next/` directory against the updated code. The build output is not persistent data and does not contain any user data — it is safe to rebuild at any time.

### Step 6 — Start the app

```bash
# systemd
sudo systemctl start techscribe-studio

# PM2
pm2 start techscribe-studio
```

On first startup after the upgrade, the app automatically applies any schema migrations before serving traffic. Check the logs to confirm it started cleanly:

```bash
journalctl -u techscribe-studio -n 20 --no-pager   # systemd
pm2 logs techscribe-studio --lines 20               # PM2
```

No schema migration log output is expected under normal conditions. The migration is silent unless an error occurs.

### Step 7 — Run the smoke-test checklist

Confirm the upgrade succeeded by running the full smoke-test:

**[docs/smoke-test.md](smoke-test.md)**

Pay particular attention to:
- History page loads and existing entries are present.
- Settings page shows previously saved WordPress credentials.
- Calendar page shows previously saved entries.

If any of these are missing, see [Section 5 — Rolling back an upgrade](#5-rolling-back-an-upgrade).

---

## 4. Persistence-sensitive changes

A **persistence-sensitive change** is any update that touches how existing data is stored, interpreted, or queried in ways that could affect correctness or continuity for existing rows. Examples:

| Type | Example | Risk |
|---|---|---|
| New required column, no default | Adding a `NOT NULL` column without a default | Existing rows receive `NULL`, which may break queries that expect a value |
| Column default value change | Changing what a status column defaults to | New rows behave differently from old rows |
| Data format change | Storing a field as JSON instead of plain text | Existing plain-text rows are misread by new code |
| Table rename or restructure | Renaming `content_calendar` to `calendar` | Existing rows appear missing; old backups incompatible with new schema |

The current migration strategy (column additions only) means that **schema changes in normal releases are non-destructive** and existing data is preserved. The cases listed above would represent out-of-ordinary changes that would be explicitly flagged in release notes.

### How to identify persistence-sensitive releases

Look for any of the following in the release notes or commit history:

- "Breaking change" or "migration required"
- "Schema change" or "data format change"
- Any mention of changes to `lib/db.ts` that involve more than `ALTER TABLE … ADD COLUMN`

### What to do when a persistence-sensitive release is available

1. **Back up before upgrading** — as described in [Section 2](#2-before-every-upgrade).
2. Read the specific migration notes for that release carefully before proceeding.
3. Follow any manual steps described in the release notes in the order given.
4. After the upgrade, run [Section 6 — Verifying the upgrade](#6-verifying-the-upgrade) with additional attention to the data affected by the migration.

---

## 5. Rolling back an upgrade

If the upgrade introduces a problem that cannot be resolved by restarting or re-running the smoke test, restore from the pre-upgrade backup.

### Roll back the database

```bash
# Stop the app
sudo systemctl stop techscribe-studio      # or: pm2 stop techscribe-studio

# Replace the database with the pre-upgrade backup
cp backups/history-pre-upgrade-$(date +%Y%m%d).db data/history.db

# Verify the restored file
sqlite3 data/history.db "PRAGMA integrity_check;"
```

### Roll back the code

```bash
# Find the previous commit hash
git log --oneline -5

# Check out the previous version
git checkout <previous-commit-hash>

# Reinstall and rebuild against the rolled-back code
npm install
npm run build
```

### Restart the app

```bash
sudo systemctl start techscribe-studio     # or: pm2 start techscribe-studio
```

Confirm history, calendar, and settings are intact before declaring the rollback complete.

> **Note on schema rollback:** If the upgrade added new columns to the database and the rollback reverts the code to a version that does not know about those columns, the extra columns are silently ignored. This is safe — SQLite does not reject queries against tables with unknown columns, and the older code only reads the columns it expects. The extra empty columns can be left in place without consequence.

---

## 6. Verifying the upgrade

After starting the upgraded app, confirm the following before considering the upgrade complete:

### Database integrity

```bash
sqlite3 data/history.db "PRAGMA integrity_check;"
```

Expected: `ok`.

### Row counts match pre-upgrade expectations

```bash
sqlite3 data/history.db "
  SELECT 'history rows',           COUNT(*) FROM history;
  SELECT 'calendar rows',          COUNT(*) FROM content_calendar;
  SELECT 'settings rows',          COUNT(*) FROM wordpress_settings;
"
```

Compare these counts to what you had before the upgrade. A drop in row count indicates data was lost and you should roll back.

### Schema reflects the new version

After a release that adds new columns, confirm the columns are present:

```bash
sqlite3 data/history.db "PRAGMA table_info(history);"
sqlite3 data/history.db "PRAGMA table_info(content_calendar);"
sqlite3 data/history.db "PRAGMA table_info(wordpress_settings);"
```

### Application smoke test

Run the full smoke-test checklist at **[docs/smoke-test.md](smoke-test.md)** to confirm all subsystems are functioning correctly after the upgrade.
