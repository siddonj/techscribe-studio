# TechScribe Studio — Pre-Release Smoke-Test Checklist

Run this checklist before every release and after deploying to a new environment. It covers the full critical path end-to-end and should take under five minutes to complete.

---

## 1. Infrastructure

- [ ] `http://localhost:3000` (or your domain) loads the dashboard without errors
- [ ] No JavaScript console errors on the dashboard page

## 2. AI Generation

- [ ] Navigate to any tool (e.g. **Blog Post Ideas** at `/tool/blog-post-ideas`)
- [ ] Fill in the required field and submit the form
- [ ] Output streams progressively into the page (no blank page or unresolved spinner)
- [ ] Output renders as formatted text when generation completes

## 3. Save and History

- [ ] After a successful generation, click **Save**
- [ ] Navigate to `/history` and confirm the saved entry appears in the list
- [ ] Open the entry and confirm the full content is intact

## 4. Content Planner Linkage

- [ ] Navigate to `/calendar`
- [ ] Create a new calendar entry with a title and planned date
- [ ] Confirm the entry appears in the calendar view
- [ ] Open the entry and click **Open in Tool** — confirm the tool page pre-fills with the entry data

## 5. Draft Publishing

- [ ] Navigate to `/settings` and click **Test Connection** — confirm it returns a success state
- [ ] From a saved history entry, trigger **Publish as Draft**
- [ ] Confirm the history entry status changes to `Draft Linked`
- [ ] Open the WordPress admin and confirm the draft post was created

## 6. Settings Persistence

- [ ] Save WordPress credentials on the Settings page
- [ ] Restart the app (`npm run start` or via your process manager)
- [ ] Navigate back to `/settings` and confirm the credentials are still present

---

> **Sections 5 and 6** require a configured WordPress instance. Skip them if WordPress is not set up in your test environment; all other sections must pass.

For detailed recovery steps when any check fails, see **[docs/recovery.md](recovery.md)**.
