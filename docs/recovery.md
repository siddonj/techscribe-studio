# TechScribe Studio — Failure Recovery Guide

This guide covers the most common runtime and integration failures an operator will encounter in practice, with specific steps to diagnose and resolve each one.

---

## Table of Contents

1. [Missing or Invalid Environment Variables](#1-missing-or-invalid-environment-variables)
2. [SQLite Persistence Problems](#2-sqlite-persistence-problems)
3. [WordPress Connection Verification Failures](#3-wordpress-connection-verification-failures)
4. [WordPress Publish Failures](#4-wordpress-publish-failures)

---

## 1. Missing or Invalid Environment Variables

### 1.1 — `ANTHROPIC_API_KEY` is not set

**Symptom:** Every generation attempt returns an error. Server logs contain a message like `AnthropicError: API key is required` or a 401 response from the Anthropic API.

**Diagnosis:**
```bash
# In a shell with the same environment as the running process
echo $ANTHROPIC_API_KEY
```
An empty result means the variable is not set for that process.

**Recovery:**

1. If you use `.env.local`, confirm the file is present in the project root and contains the key:
   ```bash
   grep ANTHROPIC_API_KEY .env.local
   ```
   The value must start with `sk-ant-`.

2. If you manage the process with **systemd**, confirm the `Environment=` or `EnvironmentFile=` directive is correct:
   ```bash
   sudo systemctl cat techscribe-studio | grep ANTHROPIC
   sudo systemctl restart techscribe-studio
   ```

3. If you manage the process with **PM2**, set the variable in the ecosystem file or via the environment:
   ```bash
   pm2 set techscribe-studio:ANTHROPIC_API_KEY sk-ant-YOUR_KEY_HERE
   pm2 restart techscribe-studio
   ```

4. Confirm the key is valid by checking the [Anthropic Console](https://console.anthropic.com/). An expired or revoked key must be rotated there before the app will generate successfully.

---

### 1.2 — `.env.local` is not loaded in production

**Symptom:** The app works in `npm run dev` but AI generation fails in `npm run start`, even though `.env.local` exists.

**Cause:** Next.js loads `.env.local` automatically, but only when the working directory at startup is the project root. If a process manager starts the app from a different directory, Next.js cannot locate the file.

**Diagnosis:**
```bash
# Confirm the working directory of the running process
ls -la /proc/$(pgrep -f "next start")/cwd 2>/dev/null || pwdx $(pgrep -f "next start") 2>/dev/null
```

**Recovery:**

- For **systemd**, set `WorkingDirectory=` to the project root in the unit file:
  ```ini
  WorkingDirectory=/opt/techscribe-studio
  ```
  Then reload and restart:
  ```bash
  sudo systemctl daemon-reload
  sudo systemctl restart techscribe-studio
  ```

- For **PM2**, use the `--cwd` flag or configure `cwd` in the ecosystem file:
  ```bash
  pm2 start "npm run start" --name techscribe-studio --cwd /opt/techscribe-studio
  ```

- Alternatively, set all required environment variables directly in the process manager configuration rather than relying on `.env.local`.

---

### 1.3 — WordPress environment variables are not recognised

**Symptom:** Publishing fails with "Missing WordPress configuration" even though the `WORDPRESS_*` variables appear to be set.

**Note:** The app prefers **saved in-app settings** over environment variables. If saved settings exist and pass a connection test, those take precedence. Environment variables are a fallback for cases where no saved settings are present.

**Diagnosis:**
1. Go to **Settings** in the app and check whether credentials are saved there. If they are, fix the problem in the UI rather than in the environment.

2. If you are relying on env vars (no saved settings), check for common quoting problems:
   ```bash
   # Bad — quoted values include the quote characters in the variable
   WORDPRESS_APP_PASSWORD="xxxx xxxx xxxx xxxx xxxx xxxx"

   # Correct — unquoted in a shell or correctly handled by the process manager
   WORDPRESS_APP_PASSWORD=xxxx xxxx xxxx xxxx xxxx xxxx
   ```

3. Confirm the `WORDPRESS_SITE_URL` does not have a trailing slash:
   ```bash
   echo $WORDPRESS_SITE_URL   # must NOT end with /
   ```
   The app strips a trailing slash automatically when resolving from env vars, but a double-slash (`//wp-json/`) in the final URL can still cause failures with some WordPress configurations.

---

## 2. SQLite Persistence Problems

The database file is located at:
```
data/history.db
```
relative to the project root. All history, calendar entries, and saved WordPress settings live in this single file.

### 2.1 — Database file is missing or not found

**Symptom:** API calls return 500 errors; server logs show something like `SQLITE_CANTOPEN` or `no such file or directory`.

**Diagnosis:**
```bash
ls -lh data/history.db
```

**Recovery:**

1. The app auto-creates the database on first startup. If the file is missing, confirm the process has write access to `data/` and restart:
   ```bash
   mkdir -p data
   chmod 755 data
   sudo systemctl restart techscribe-studio   # or pm2 restart techscribe-studio
   ```

2. If the app is starting from the wrong working directory, the `data/` path resolves incorrectly. Confirm the working directory:
   ```bash
   ls data/history.db   # run from the project root
   ```
   Set the correct `WorkingDirectory` or `--cwd` in your process manager (see [Section 1.2](#12--envlocal-is-not-loaded-in-production) above).

---

### 2.2 — Database is locked (`SQLITE_BUSY`)

**Symptom:** API calls return 500 errors; server logs contain `SQLITE_BUSY` or `database is locked`.

**Cause:** Only one process should open `data/history.db` at a time. Running multiple instances of the app against the same data directory causes lock contention.

**Diagnosis:**
```bash
# Find all processes that have the database open
lsof data/history.db
```

**Recovery:**

1. Stop all but one instance of the app:
   ```bash
   # List running processes
   pm2 list                        # if using PM2
   sudo systemctl status techscribe-studio   # if using systemd
   ```

2. Ensure there is exactly one process running, then restart it:
   ```bash
   sudo systemctl restart techscribe-studio
   ```

---

### 2.3 — Database is corrupt

**Symptom:** API calls return 500 errors; server logs contain `SQLITE_CORRUPT` or `malformed database schema`.

**Cause:** Uncommon but possible after an unclean shutdown during a write (power loss, SIGKILL during a transaction).

**Recovery:**

1. Stop the app:
   ```bash
   sudo systemctl stop techscribe-studio
   ```

2. Attempt to dump the database to SQL:
   ```bash
   sqlite3 data/history.db .dump > /tmp/history-dump.sql
   ```

3. If the dump succeeds, rebuild the database from the dump:
   ```bash
   mv data/history.db data/history.db.bak
   sqlite3 data/history.db < /tmp/history-dump.sql
   ```

4. Start the app and verify history is intact:
   ```bash
   sudo systemctl start techscribe-studio
   ```

5. If the dump fails (sqlite3 exits non-zero or produces errors), the file is too damaged to recover directly. Restore from the most recent backup:
   ```bash
   cp backups/history-20240101.db data/history.db
   sudo systemctl start techscribe-studio
   ```
   See the [Data Persistence and Backup](operations.md#6-data-persistence-and-backup) section of the operations guide for backup setup.

---

### 2.4 — History or calendar data is missing after a restart

**Symptom:** The History or Calendar page shows no entries even though content was saved before the restart.

**Possible causes and checks:**

| Check | Command |
|---|---|
| Database file exists | `ls -lh data/history.db` |
| File is not empty | `du -h data/history.db` (should be > 0 bytes) |
| App is using the correct working directory | `pwd` from the project root; compare to process manager config |
| Entries actually exist in the database | `sqlite3 data/history.db "SELECT COUNT(*) FROM history;"` |

**Recovery:**

- If the file exists and contains rows but the UI is blank, restart the app. A stale in-memory connection can sometimes be cleared this way.
- If the file is zero-length or missing, see [Section 2.1](#21--database-file-is-missing-or-not-found).
- If data was lost because the deployment uses ephemeral storage (Docker without a volume, a serverless platform), mount a persistent volume at the `data/` path before the next restart. Data that has already been lost cannot be recovered without a backup.

---

### 2.5 — Database write errors on a container or cloud deployment

**Symptom:** The app starts but saving history or WordPress settings fails silently, or logs show permission errors on `data/`.

**Cause:** The `data/` directory is on read-only or ephemeral storage.

**Recovery:**

1. Mount a persistent volume at `<project-root>/data/`. In a Docker deployment:
   ```yaml
   volumes:
     - /persistent/techscribe/data:/app/data
   ```

2. Confirm the volume is writable by the process user:
   ```bash
   touch /persistent/techscribe/data/.write-test && rm /persistent/techscribe/data/.write-test
   ```

---

## 3. WordPress Connection Verification Failures

Publishing is blocked until saved settings pass a successful connection test. The test calls `GET /wp-json/wp/v2/users/me` with your credentials.

### 3.1 — "Test Connection" returns an authentication error (401/403)

**Symptom:** The Settings page shows a test failure with a message containing "unauthorized", "forbidden", or "application password".

**Recovery:**

1. Confirm the **Application Password** was generated under **Users → Profile → Application Passwords** in the WordPress admin, not the regular account password.

2. Copy the application password exactly as WordPress displayed it (including spaces) — it is displayed only once. If you cannot retrieve it, revoke it in the WordPress admin and generate a new one.

3. Check that the **username** in the Settings page matches the WordPress username (not the display name or email address). You can confirm the username at **Users → All Users** in the admin.

4. Save the updated credentials and run the test again.

---

### 3.2 — "Test Connection" fails with a network or connection error

**Symptom:** Settings page shows a test failure with a message containing "ECONNREFUSED", "ENOTFOUND", "timeout", or a generic "fetch failed".

**Recovery:**

1. Confirm the **Site URL** field uses `https://` (or `http://` for local installs) and does not have a trailing slash.

2. Verify the WordPress REST API is reachable from the server running TechScribe Studio:
   ```bash
   curl -s https://your-site.com/wp-json/wp/v2/posts | head -c 200
   ```
   A JSON response confirms the API is reachable. An error page or no output indicates a network, DNS, or firewall issue.

3. If the API is blocked, check:
   - Firewall rules between the TechScribe Studio server and the WordPress server.
   - WordPress security plugins (Wordfence, iThemes Security) that restrict REST API access by IP or disable it entirely. Temporarily disable them to isolate the issue.
   - Whether the WordPress server is behind a proxy that strips or rewrites authentication headers.

---

### 3.3 — "Test Connection" passes but publishing is still blocked

**Symptom:** The Settings page shows the last test as successful, but clicking **Publish as Draft** returns "WordPress draft publishing is disabled until your saved WordPress settings pass a successful connection test."

**Cause:** The saved settings in the database do not have `last_test_success = 1`. This can happen if settings were saved without running a test first, or if the database was restored from a backup taken before the test.

**Recovery:**

1. Go to **Settings**, confirm the saved credentials are correct, and click **Test Connection**.
2. If the test passes, publishing will be re-enabled immediately.
3. If the test fails, resolve the underlying connection issue (Sections [3.1](#31--test-connection-returns-an-authentication-error-401403) or [3.2](#32--test-connection-fails-with-a-network-or-connection-error) above) before retrying.

---

## 4. WordPress Publish Failures

Publish failures are recorded on the history entry so they can be retried without re-generating content. The history row stores the error message; the failure category (credential, connection, payload, or unknown) drives the badge shown in the UI.

### 4.1 — Credential error (401/403)

**Symptom:** Publish action fails; history entry shows a credential-type error badge. Error message contains "401", "403", "unauthorized", or "application password".

**Recovery:**

1. Go to **Settings** and run **Test Connection**. If the test fails, the credentials have changed (e.g. the application password was revoked or the user account was modified).
2. Regenerate the application password in the WordPress admin and update the Settings page.
3. After a successful test, retry the publish from the History screen using the retry button on the failed entry.

---

### 4.2 — Connection error (network unreachable)

**Symptom:** Publish action fails; error message contains "ECONNREFUSED", "ENOTFOUND", "timeout", or "fetch failed".

**Recovery:**

1. Confirm the WordPress site is up:
   ```bash
   curl -sI https://your-site.com | head -n 1
   ```

2. Run **Test Connection** from the Settings page to isolate whether the issue is transient. A transient outage (WordPress maintenance mode, brief downtime) will resolve on its own.

3. Once the site is reachable, retry the publish from the History screen.

---

### 4.3 — Payload error (400/422)

**Symptom:** Publish action fails; error message contains "400", "422", "rest_invalid", or "invalid post".

**Cause:** WordPress rejected the post payload. Common reasons:
- A scheduled post (`publish_intent: schedule`) has a `scheduled_for` date in the past.
- The WordPress category or tag IDs stored on the history entry do not exist on the target site.
- A required custom field is enforced by a plugin that rejects posts without it.

**Recovery:**

1. For **scheduled posts with a past date**: open the linked calendar entry, update the scheduled date to a future date, and retry the publish.

2. For **invalid term IDs**: open the history entry detail panel, clear the categories and tags fields, and retry. The post will be created without taxonomy assignments, which you can set in the WordPress editor after publishing.

3. For **plugin-enforced fields**: check the WordPress server logs (`wp-content/debug.log` or the server error log) for the specific REST API rejection reason.

---

### 4.4 — Unknown publish error

**Symptom:** Publish action fails with a message that does not match any of the above categories.

**Recovery:**

1. Check the TechScribe Studio server logs for the full error message:
   ```bash
   journalctl -u techscribe-studio -n 50 --no-pager   # systemd
   pm2 logs techscribe-studio --lines 50               # PM2
   ```

2. Check the WordPress server error log for a corresponding entry near the time of the failure.

3. Run **Test Connection** from the Settings page. If the test fails, resolve the connection issue first.

4. After addressing the root cause, retry from the History screen. The history entry retains the content, so no regeneration is required.
