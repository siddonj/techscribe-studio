# TechScribe Studio — Operations Guide

This guide covers everything needed to deploy, operate, and recover TechScribe Studio as a self-hosted production service. A new operator should be able to go from zero to a running instance without reading any implementation code.

For detailed recovery procedures covering missing env vars, SQLite problems, and WordPress failures, see the companion **[Failure Recovery Guide](recovery.md)**.
For a full reference on SQLite storage, data directory requirements, and backup procedures, see **[Data Persistence and Backup](data-persistence.md)**.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [First-Time Deployment](#2-first-time-deployment)
3. [Environment Configuration Reference](#3-environment-configuration-reference)
4. [Process Management](#4-process-management)
5. [Reverse Proxy Setup](#5-reverse-proxy-setup)
6. [Data Persistence and Backup](#6-data-persistence-and-backup)
7. [Failure Recovery](#7-failure-recovery)
8. [Smoke-Test Checklist](#8-smoke-test-checklist)
9. [Upgrading](#9-upgrading)

---

## 1. Prerequisites

| Requirement | Notes |
|---|---|
| Node.js 20+ | Use [nvm](https://github.com/nvm-sh/nvm) or a system package manager |
| npm 10+ | Bundled with Node.js 20 |
| Persistent disk | The `data/` directory must survive process restarts |
| Anthropic API key | Required for all AI generation features |
| WordPress (optional) | Application password required; see [WordPress Setup](../README.md#wordpress-setup) |

Confirm your Node.js version before proceeding:

```bash
node --version   # must be >= 20.0.0
npm --version    # must be >= 10.0.0
```

---

## 2. First-Time Deployment

### Step 1 — Clone the repository

```bash
git clone https://github.com/siddonj/techscribe-studio.git
cd techscribe-studio
```

### Step 2 — Install dependencies

```bash
npm install
```

`better-sqlite3` includes a native addon. If you see build errors here, ensure you have a C/C++ build toolchain installed (`build-essential` on Debian/Ubuntu, `xcode-select --install` on macOS).

### Step 3 — Configure environment variables

```bash
cp .env.local.example .env.local
```

Open `.env.local` and set your Anthropic API key:

```env
ANTHROPIC_API_KEY=sk-ant-YOUR_KEY_HERE
```

Optionally add WordPress fallback credentials (you can also configure these in-app later):

```env
WORDPRESS_SITE_URL=https://your-site.com
WORDPRESS_USERNAME=your-wordpress-username
WORDPRESS_APP_PASSWORD=xxxx xxxx xxxx xxxx xxxx xxxx
```

### Step 4 — Create the data directory

The app auto-creates the SQLite database on first run, but the directory must exist and be writable:

```bash
mkdir -p data
```

### Step 5 — Build the production bundle

```bash
npm run build
```

This creates an optimised Next.js build under `.next/`. Expect this to take 30–90 seconds.

### Step 6 — Start the production server

```bash
npm run start
```

The app listens on `http://localhost:3000` by default. To change the port:

```bash
PORT=8080 npm run start
```

### Step 7 — Verify the deployment

Open `http://localhost:3000` (or your configured port) in a browser. The dashboard should load. Run the [Smoke-Test Checklist](#8-smoke-test-checklist) to confirm all subsystems are working.

---

## 3. Environment Configuration Reference

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | **Yes** | API key for Claude. All generation requests fail without this. |
| `WORDPRESS_SITE_URL` | No | Full root URL of your WordPress site (e.g. `https://example.com`). Fallback for publishing when no saved in-app settings exist. |
| `WORDPRESS_USERNAME` | No | WordPress username with author or editor role. |
| `WORDPRESS_APP_PASSWORD` | No | Application password created in WordPress under User → Security. Spaces are allowed. |
| `PORT` | No | HTTP port for `npm run start`. Defaults to `3000`. |

**Important:** `.env.local` is loaded automatically by Next.js in development and production. For process-manager-managed deployments (systemd, PM2), set environment variables in the unit configuration file rather than relying on `.env.local`, or ensure the working directory is the project root so that Next.js can locate the file.

---

## 4. Process Management

Running `npm run start` directly means the process terminates when your shell closes. Use a process manager to keep the app running across restarts and reboots.

### Option A — systemd (Linux, recommended)

Create a unit file at `/etc/systemd/system/techscribe-studio.service`:

```ini
[Unit]
Description=TechScribe Studio
After=network.target

[Service]
Type=simple
User=techscribe
WorkingDirectory=/opt/techscribe-studio
ExecStart=/usr/bin/node node_modules/.bin/next start
Restart=on-failure
RestartSec=5s
Environment=NODE_ENV=production
Environment=ANTHROPIC_API_KEY=sk-ant-YOUR_KEY_HERE
# Add other variables here, or use EnvironmentFile= to point at a file

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable techscribe-studio
sudo systemctl start techscribe-studio
sudo systemctl status techscribe-studio
```

View logs:

```bash
journalctl -u techscribe-studio -f
```

### Option B — PM2

Install PM2 globally and start the app:

```bash
npm install -g pm2
pm2 start "npm run start" --name techscribe-studio
pm2 save
pm2 startup    # follow the printed command to register PM2 at boot
```

View logs:

```bash
pm2 logs techscribe-studio
```

Restart after an update:

```bash
pm2 restart techscribe-studio
```

---

## 5. Reverse Proxy Setup

Running the app behind nginx or Caddy allows you to serve it on port 80/443 with TLS.

### nginx

```nginx
server {
    listen 80;
    server_name techscribe.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name techscribe.example.com;

    ssl_certificate     /etc/letsencrypt/live/techscribe.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/techscribe.example.com/privkey.pem;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_cache_bypass $http_upgrade;
        # Streaming generation responses — disable buffering
        proxy_buffering    off;
        proxy_read_timeout 120s;
    }
}
```

> **Streaming note:** The generate endpoint streams output using server-sent events. `proxy_buffering off` and an adequate `proxy_read_timeout` are required for the output to appear incrementally in the browser.

### Caddy

```caddy
techscribe.example.com {
    reverse_proxy 127.0.0.1:3000 {
        flush_interval -1
    }
}
```

Caddy manages TLS automatically via Let's Encrypt.

---

## 6. Data Persistence and Backup

All persistent state lives in a single SQLite database file at `data/history.db`. This file holds every saved history entry, content calendar entry, and in-app WordPress credential. There are no other data files to track. The `.next/` directory is a build artifact and can be regenerated with `npm run build`.

For the full reference — including a per-table breakdown of what is stored, data directory permission requirements, WAL-mode sidecar files, online backup instructions, backup verification, and container volume configuration — see **[docs/data-persistence.md](data-persistence.md)**.

### Quick-reference backup

**Online backup (safe while the app is running):**

```bash
sqlite3 data/history.db ".backup backups/history-$(date +%Y%m%d).db"
```

**Cron example (daily at 02:00, with 7-day retention):**

```cron
0 2 * * * cd /opt/techscribe-studio && sqlite3 data/history.db ".backup backups/history-$(date +\%Y\%m\%d).db" && find backups/ -name "history-*.db" -mtime +7 -delete
```

**Recovery:**

```bash
sudo systemctl stop techscribe-studio
cp backups/history-20240101.db data/history.db
sudo systemctl start techscribe-studio
```

---

## 7. Failure Recovery

For full, step-by-step recovery procedures covering missing environment variables, SQLite persistence problems, and WordPress verification and publish failures, see **[docs/recovery.md](recovery.md)**.

The sections below cover the most urgent triage steps for getting a stopped or degraded instance back online quickly.

### App does not start

**Symptom:** `npm run start` exits immediately or the process manager shows the service as failed.

1. Check for missing environment variables:
   ```bash
   grep ANTHROPIC_API_KEY .env.local 2>/dev/null || echo "Not in .env.local — check process manager config"
   ```
   Confirm `ANTHROPIC_API_KEY` starts with `sk-ant-`.

2. Check for port conflicts:
   ```bash
   lsof -i :3000
   ```
   Kill the conflicting process or change the `PORT` variable.

3. Check build artifacts exist:
   ```bash
   ls .next/
   ```
   If the directory is empty or missing, run `npm run build` again.

4. Check the `data/` directory is writable:
   ```bash
   ls -la data/
   touch data/.write-test && rm data/.write-test
   ```

### Generation returns an error

**Symptom:** The generate page shows an error banner or the stream ends with an error message.

- Verify the `ANTHROPIC_API_KEY` is valid and has available credits.
- Check server logs for `AnthropicError` entries.
- Confirm the app is running with the correct environment (`NODE_ENV=production` for production builds).

See [Section 1 of the recovery guide](recovery.md#1-missing-or-invalid-environment-variables) for detailed diagnosis steps.

### WordPress publishing fails

**Symptom:** Publish action shows a failure badge on the history entry.

1. Go to **Settings** and use the **Test Connection** button. This isolates whether the issue is credentials versus a transient WordPress error.
2. If the test passes, retry the publish from the History screen using the retry button on the failed entry.
3. If the test fails, see [Section 3 of the recovery guide](recovery.md#3-wordpress-connection-verification-failures) for detailed diagnosis by error type.

### Database is locked or corrupt

**Symptom:** API calls return 500 errors with SQLite error messages in the logs.

**Locked (`SQLITE_BUSY`):** Only one process should open `data/history.db` at a time. If you run multiple instances of the app against the same `data/` directory, you will see lock errors. Ensure only one process is running.

**Corrupt:** See [Section 2.3 of the recovery guide](recovery.md#23--database-is-corrupt) for the dump-and-rebuild procedure.

### History or calendar data appears missing

- Confirm the `data/history.db` file exists and is not empty: `ls -lh data/history.db`.
- Confirm the running process has the correct working directory — the database path is relative to the project root.
- If you recently restored a backup, check that the backup file was not zero-length.

---

## 8. Smoke-Test Checklist

The full pre-release checklist lives in its own document so it can be used quickly without navigating the entire operations guide:

**[docs/smoke-test.md](smoke-test.md)**

It covers infrastructure, AI generation, save and history, content planner linkage, draft publishing, and settings persistence — and should take under five minutes to complete.

---

## 9. Upgrading

1. Pull the latest code:
   ```bash
   git pull origin main
   ```

2. Install any new dependencies:
   ```bash
   npm install
   ```

3. Rebuild the production bundle:
   ```bash
   npm run build
   ```

4. Restart the app:
   ```bash
   # systemd
   sudo systemctl restart techscribe-studio

   # PM2
   pm2 restart techscribe-studio
   ```

5. Run the [Smoke-Test Checklist](#8-smoke-test-checklist) to confirm the upgrade succeeded.

**Database migrations:** The app applies schema migrations automatically on startup. You do not need to run any migration commands manually. Back up `data/history.db` before upgrading as a precaution.
