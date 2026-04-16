# TechScribe Studio — Automated Generation Requirements and Design

This document defines the requirements for automated and scheduled content generation in TechScribe Studio and explains how the automation layer integrates with the existing planner (content calendar) and publish state models.

---

## Table of Contents

1. [Purpose and Scope](#1-purpose-and-scope)
2. [Requirements](#2-requirements)
3. [API Contract](#3-api-contract)
4. [Integration with the Planner Model](#4-integration-with-the-planner-model)
5. [Integration with the Publish State Model](#5-integration-with-the-publish-state-model)
6. [Security Model](#6-security-model)
7. [Usage Patterns](#7-usage-patterns)
8. [Limitations and Non-Goals](#8-limitations-and-non-goals)

---

## 1. Purpose and Scope

Automated generation allows external schedulers — cron jobs, GitHub Actions, CI pipelines, and similar orchestration tools — to trigger content generation jobs without a human present in the browser UI. This is useful for teams that want to:

- Generate a set of articles or assets on a recurring schedule (e.g. weekly content drops)
- Pre-populate the content library as part of a CI workflow
- Drive generation from an external CMS or content planning system

The automation layer is intentionally minimal. It exposes one HTTP endpoint (`POST /api/generate/batch`) that accepts a list of generation jobs, runs them sequentially against the same AI models used by the interactive UI, and returns the results. Optionally, results can be persisted to the history database and linked back to existing content calendar entries.

---

## 2. Requirements

### Functional requirements

| # | Requirement |
|---|---|
| F-1 | The system must accept multiple generation jobs in a single request. |
| F-2 | Each job must specify the tool slug and field values to drive generation. |
| F-3 | A per-job failure must not abort the remaining jobs in the batch. |
| F-4 | Each job result must indicate success or failure, and include the generated output on success. |
| F-5 | Jobs may optionally request persistence — saving the generated output to the history database. |
| F-6 | When persistence is requested, the job may specify an existing content calendar entry to link to. Linking must advance the calendar entry's status from `planned` or `backlog` to `in-progress`, consistent with how the interactive UI handles manual saves. |
| F-7 | When persistence is requested, the job may specify a folder name and tag list for organizational metadata. |
| F-8 | When a job is linked to a calendar entry that carries WordPress planning metadata (category, tags), the saved history entry must inherit that metadata — consistent with how the interactive UI propagates calendar metadata. |
| F-9 | The batch size must be capped to prevent runaway API usage. The current cap is **20 jobs per request**. |
| F-10 | All jobs within a request must be processed sequentially to avoid overwhelming the upstream AI API. |

### Non-functional requirements

| # | Requirement |
|---|---|
| N-1 | The endpoint must be disabled (returns `503`) when `BATCH_API_SECRET` is not set, so that production deployments without automation configured are not silently exposed. |
| N-2 | Every request must include the secret as a `Bearer` token in the `Authorization` header. |
| N-3 | The endpoint must return clear error messages for malformed requests before processing any jobs. |
| N-4 | The endpoint must not block the app UI — it runs in the same Next.js Node.js runtime and shares the SQLite connection but does not lock the UI. |

---

## 3. API Contract

### Endpoint

```
POST /api/generate/batch
Authorization: Bearer <BATCH_API_SECRET>
Content-Type: application/json
```

### Request body

```json
{
  "jobs": [
    {
      "slug": "article-writer",
      "fields": {
        "topic": "10 best VS Code extensions in 2025",
        "tone": "Conversational",
        "length": "Medium (~1500 words)",
        "keywords": "VS Code, extensions, developer tools",
        "audience": "Web developers"
      },
      "save": true,
      "calendar_id": 42,
      "folder": "automation",
      "tags": ["auto", "weekly"]
    },
    {
      "slug": "meta-title",
      "fields": {
        "topic": "VS Code extensions for developers",
        "keyword": "VS Code extensions",
        "count": "5"
      }
    }
  ]
}
```

#### Per-job fields

| Field | Type | Required | Description |
|---|---|---|---|
| `slug` | string | **Yes** | Tool slug (must match a slug in `lib/tools.ts`). |
| `fields` | object | **Yes** | Key-value map of tool field values. Keys match the `name` property of each tool field. |
| `save` | boolean | No (default `false`) | When `true`, persist the generated output to the history database. |
| `calendar_id` | number | No | ID of an existing content calendar entry to link after saving. Only used when `save` is `true`. |
| `folder` | string | No | Folder name to assign to the saved history entry. Only used when `save` is `true`. |
| `tags` | string[] | No | Tags to assign to the saved history entry. Only used when `save` is `true`. |

### Response body

```json
{
  "results": [
    {
      "slug": "article-writer",
      "status": "success",
      "output": "# 10 Best VS Code Extensions in 2025\n\n...",
      "history_id": 7
    },
    {
      "slug": "meta-title",
      "status": "success",
      "output": "1. Best VS Code Extensions for Developers (2025) — 54 chars\n..."
    }
  ]
}
```

#### Per-job result fields

| Field | Type | Present when |
|---|---|---|
| `slug` | string | Always |
| `status` | `"success"` \| `"error"` | Always |
| `output` | string | `status === "success"` |
| `history_id` | number | `status === "success"` and `save === true` |
| `error` | string | `status === "error"` |

### Error responses

| Status | Condition |
|---|---|
| `503` | `BATCH_API_SECRET` is not set in the environment. |
| `401` | Authorization header is missing or the token does not match `BATCH_API_SECRET`. |
| `400` | Request body is not valid JSON, `jobs` array is absent or empty, batch size exceeds 20, or a job has an invalid shape. |
| `200` | All jobs were attempted (individual job failures appear as `status: "error"` entries in the results array). |

---

## 4. Integration with the Planner Model

The content calendar is the planning layer in TechScribe Studio. Calendar entries move through the following status progression:

```
backlog → planned → in-progress → ready → published
```

Automation integrates at the **generation step** — the transition from `planned` to `in-progress`. This mirrors what happens when a user manually opens a calendar item in the interactive UI and saves the generated output.

### Rules

- `calendar_id` is only honoured when `save: true`. Linking without saving is not supported because there is no history entry to link to.
- If the referenced calendar entry does not exist, the job still succeeds and saves to history; the linkage step is silently skipped.
- The status transition (`planned`/`backlog` → `in-progress`) is the same logic used by `linkCalendarEntryToHistory` in `lib/db.ts`. Calendar entries that are already `in-progress`, `ready`, or `published` are not regressed.
- WordPress planning metadata (`wp_category`, `wp_tags`) is copied from the calendar entry into the saved history row, so that the history entry arrives pre-configured for publishing — exactly as it would be if a user had opened the calendar item manually.

### Effect on calendar state after a batch job

| Calendar entry status before | Status after (with `calendar_id` + `save: true`) |
|---|---|
| `backlog` | `in-progress` |
| `planned` | `in-progress` |
| `in-progress` | `in-progress` (unchanged) |
| `ready` | `ready` (unchanged) |
| `published` | `published` (unchanged) |

---

## 5. Integration with the Publish State Model

Generated content starts with no publish state (`wp_publish_state = null`). Automated generation does not publish content — it only generates and optionally saves it. The publish state model is left entirely to manual publish actions triggered from the History screen or the tool page.

### Why automation does not auto-publish

TechScribe Studio uses a **WordPress-owned scheduling** model (see [README.md — Publish Scheduling Ownership Model](../README.md#publish-scheduling-ownership-model)). The app sends content to WordPress only when a human explicitly triggers a publish action. Automated generation deliberately stops at the content-creation step to preserve this model.

### Publish state after a batch job

| Condition | `wp_publish_state` on saved history entry |
|---|---|
| Job completed, `save: true` | `null` (never published) |
| Job failed | Not saved; no history row created |
| `save: false` (default) | Not saved; no history row created |

After a batch job, a human can visit the History screen to find the newly saved entry (identified by folder, tags, or creation date) and trigger a publish action from there. The publish state then progresses normally: `null` → `draft_created` → `draft_updated` / `published` / `scheduled` / `failed`.

---

## 6. Security Model

| Concern | Mitigation |
|---|---|
| Unauthenticated access | Endpoint disabled (`503`) unless `BATCH_API_SECRET` is set. Every request must supply the secret as a Bearer token. |
| Secret strength | Use a long random string (32+ characters). Generate one with: `openssl rand -hex 32` |
| Secret rotation | Update `BATCH_API_SECRET` in the environment and restart the app. Old tokens are immediately invalidated. |
| Runaway API usage | Batch size is capped at 20 jobs per request. Jobs are processed sequentially, not in parallel. |
| Prompt injection | Fields are interpolated into tool prompt templates using positional substitution, not `eval`. No shell expansion occurs. |
| Credential exposure | `BATCH_API_SECRET` lives only in the server environment. It is never written to the database or returned in any API response. |

---

## 7. Usage Patterns

### GitHub Actions — weekly content generation

```yaml
name: Weekly content generation
on:
  schedule:
    - cron: "0 8 * * 1"   # Every Monday at 08:00 UTC

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - name: Run batch generation
        run: |
          curl -sf -X POST https://your-techscribe.example.com/api/generate/batch \
            -H "Authorization: Bearer ${{ secrets.BATCH_API_SECRET }}" \
            -H "Content-Type: application/json" \
            -d '{
              "jobs": [
                {
                  "slug": "blog-post-ideas",
                  "fields": { "niche": "DevOps", "count": "10", "format": "Mixed" },
                  "save": true,
                  "folder": "weekly-ideas",
                  "tags": ["auto", "devops"]
                }
              ]
            }'
```

### Linking a planned calendar item

If you have a calendar entry with ID `42` in `planned` status, the following call generates the content, saves it to history, and advances the calendar item to `in-progress`:

```bash
curl -sf -X POST https://your-techscribe.example.com/api/generate/batch \
  -H "Authorization: Bearer $BATCH_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "jobs": [
      {
        "slug": "article-writer",
        "fields": {
          "topic": "Introduction to Kubernetes",
          "tone": "Informative",
          "length": "Medium (~1500 words)"
        },
        "save": true,
        "calendar_id": 42
      }
    ]
  }'
```

The response includes the new history ID:

```json
{
  "results": [
    {
      "slug": "article-writer",
      "status": "success",
      "output": "# Introduction to Kubernetes\n\n...",
      "history_id": 15
    }
  ]
}
```

You can then visit `/history` in the app and find the saved entry to review and publish.

### Handling per-job errors

Individual job failures do not abort the batch. Always check `status` for each result:

```bash
RESPONSE=$(curl -sf -X POST ... -d '{"jobs":[...]}')
echo "$RESPONSE" | jq '.results[] | select(.status == "error") | {slug, error}'
```

---

## 8. Limitations and Non-Goals

- **No built-in scheduler**: TechScribe Studio does not include a built-in cron runner. Use an external scheduler (system cron, GitHub Actions, a CI pipeline, or a task queue) to trigger the batch endpoint on a schedule.
- **No auto-publish**: Automation stops at generation. Publishing to WordPress always requires a manual action from the app UI. See [Section 5](#5-integration-with-the-publish-state-model).
- **Sequential processing only**: Jobs within a single request are always processed one at a time. There is no parallel job execution in the current design.
- **No two-step outline flow**: The batch endpoint uses the single-step generation path for all tools. The outline-then-article two-step flow available in the interactive UI is not supported in batch jobs.
- **No retry logic**: If a job fails (e.g. due to a transient upstream API error), the batch endpoint reports the failure and moves on. The caller is responsible for retry logic.
