# TechScribe Studio

TechScribe Studio is a self-hosted AI writing workspace for content teams, solo publishers, and technical operators who want the speed of AI tooling without giving up control of their prompts, drafts, and publishing flow.

Built with Next.js, Claude, and SQLite, it packages a broad tool library for blog writing, idea generation, SEO support, rewriting, social content, email copy, video workflows, and editorial planning into a single local-first application.

Phase 1 is complete, and the first Phase 2 planning layer is now in place. The product covers the core content loop end to end: plan, generate, refine, save, organize, and publish drafts to WordPress from one interface.

The current UI uses a darker control-room shell with a persistent tool sidebar, workflow status strips, and linked planning surfaces so the app feels closer to a live editorial system than a loose collection of individual generators.

## What Phase 1 Delivers

Phase 1 establishes the foundation for a usable, self-hosted content system:

- AI generation across 7 content categories
- Real-time streaming output from the generate API
- Dashboard, sidebar navigation, and per-tool pages
- Outline-first flow for long-form article generation
- Local SQLite-backed history storage
- History search, filtering, metadata editing, folders, tags, and bulk actions
- In-app WordPress settings storage with connection testing
- Draft publishing and draft updating to WordPress
- Environment variable fallback for WordPress credentials

## Product Highlights

### Content planning and scheduling

- A dedicated content calendar at `/calendar` for backlog and scheduled work
- Quick planning flow with title, assigned tool, target date, brief, keywords, audience, and notes
- Calendar entries can carry WordPress planning metadata such as target category, tags, and publish intent
- Saving generated output from a planned item links the resulting history entry back into the calendar
- Publishing a linked draft updates the calendar item with the associated WordPress draft ID

### Writing tools

- 25+ focused tools across content creation, planning, SEO, rewriting, social media, email, and video
- One shared tool catalog in `lib/tools.ts`, making the product easy to extend without reworking the UI
- Structured field-driven interfaces generated directly from tool definitions
- Markdown-native output rendering for long-form and short-form content
- Interactive suggestion cards for Blog Post Ideas, including one-click handoff into Article Writer

### Interface refresh

- SoulSync-inspired dark green shell across dashboard, calendar, history, settings, and tool pages
- Shared panel, status-strip, and hover-lift components defined in `app/globals.css`
- Mobile-aware sidebar navigation with grouped tool categories and workflow context
- Consistent control-room layout so planning, writing, archive management, and publishing feel like one system

### Content workflow

- Streaming generation via `app/api/generate/route.ts` so output appears as it is created
- Save generated outputs into local history instead of losing drafts between sessions
- Re-open saved content from the History screen for reuse, editing, or publishing
- Copy, iterate on, and publish saved outputs without leaving the app
- Outline-to-article workflow for long-form article generation
- Open a tool from the calendar with planning fields prefilled into the writing flow
- **YouTube-to-blog**: paste a video transcript and generate a full blog post (with optional outline step)
- **Batch generation API** (`POST /api/generate/batch`): trigger multiple tool jobs programmatically from cron jobs, CI pipelines, or external schedulers
- Send ideas from the Blog Post Ideas tool directly into Article Writer with title, brief, and keywords prefilled

### External research inputs

- **Keyword Research Brief** tool accepts raw data from Ahrefs, SEMrush, Google Keyword Planner, or hand-collected notes and converts it into a structured content brief
- The brief includes a recommended title, primary and secondary keywords, LSI terms, content angle, outline, and word-count guidance
- Handoff buttons open downstream tools (Article Writer, Outline Generator, Headline Generator) pre-filled with the brief title **and** the researched keyword set
- **Plan in Calendar** handoff sends the brief title, keywords, and audience directly to the Content Calendar's Quick Plan form so the piece can be scheduled without re-entering data

### History and organization

- SQLite-backed local storage using `better-sqlite3`
- Filter history by tool, search term, folder, tag, date, and publish status
- Rename, merge, and delete folders and tags to keep the content library usable over time
- Bulk metadata updates, export, delete, and publish actions for batch workflows
- Track WordPress draft linkage and last sync status at the entry level

### WordPress integration

- Save WordPress site URL, username, and app password in-app
- Test the connection before enabling publishing, so failures happen before the publish action
- Publish new drafts from generated content
- Update previously linked drafts from saved history
- Fallback to `WORDPRESS_*` environment variables when saved settings do not exist

## Tool Categories

| Category | Included tools |
|---|---|
| Content Creation | Article Writer, Listicle Writer, Introduction Writer, Conclusion Writer, Paragraph Writer, Content Expander |
| Ideas & Planning | Blog Post Ideas, Headline Generator, Outline Generator |
| SEO & Keywords | Meta Title Generator, Meta Description Generator, Keyword Cluster Generator, FAQ Writer, Keyword Research Brief |
| Editing & Rewriting | Content Rewriter, Content Shortener, Summarizer, Explain Like I'm 5 |
| Social Media | Tweet / X Post Ideas, LinkedIn Post, Facebook Post, Pinterest Pin Description |
| Email & Marketing | Email Subject Line, Call-to-Action Writer, AIDA Copywriter |
| Video Content | YouTube to Blog Post, Video Title Generator, Video Description, Video Script Outline |

## Quick Start

### Prerequisites

- Node.js 20+
- npm
- An Anthropic API key
- Optional: a WordPress site with an application password for draft publishing

### 1. Clone the repo

```bash
git clone https://github.com/siddonj/techscribe-studio.git
cd techscribe-studio
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp .env.local.example .env.local
```

Set at least:

```env
ANTHROPIC_API_KEY=sk-ant-YOUR_KEY_HERE
```

Optional WordPress fallback variables:

```env
WORDPRESS_SITE_URL=https://your-site.com
WORDPRESS_USERNAME=your-wordpress-username
WORDPRESS_APP_PASSWORD=xxxx xxxx xxxx xxxx xxxx xxxx
```

Optional batch generation secret (required to enable the batch API):

```env
BATCH_API_SECRET=your-secret-token-here
```

### 4. Start the app

```bash
npm run dev
```

Then open http://localhost:3000.

## MCP Server

TechScribe Studio ships a built-in [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that lets AI assistants like **Claude Desktop**, **Cursor**, and other MCP clients interact with the app directly.

### What the MCP server exposes

| Tool | Description |
|---|---|
| `list_writing_tools` | List all available writing tools with their slugs, fields, and descriptions |
| `generate_content` | Generate content using any TechScribe tool and optionally save to history |
| `save_to_history` | Save a piece of content to the history database |
| `list_history` | List saved history entries with optional search, filter, and sort |
| `get_history_entry` | Retrieve a single history entry by ID |
| `list_calendar_entries` | List content calendar entries |
| `create_calendar_entry` | Create a new content calendar entry |

### Running the MCP server

The MCP server communicates over stdio, which is the standard transport for desktop MCP clients. The app must be running before the MCP server can handle requests.

```bash
# In one terminal — start the app
npm run dev

# In another terminal — start the MCP server (or let your client start it)
npm run mcp-server
```

**Environment variables:**

| Variable | Default | Description |
|---|---|---|
| `TECHSCRIBE_URL` | `http://localhost:3000` | Base URL of the running TechScribe Studio app |
| `BATCH_API_SECRET` | _(empty)_ | Must match the app's `BATCH_API_SECRET` if that is set |

### Claude Desktop setup

Add the following to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "techscribe-studio": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/techscribe-studio/mcp-server/index.ts"],
      "env": {
        "TECHSCRIBE_URL": "http://localhost:3000"
      }
    }
  }
}
```

### Cursor setup

Add the following to your Cursor MCP settings (`.cursor/mcp.json` or the global MCP config):

```json
{
  "mcpServers": {
    "techscribe-studio": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/techscribe-studio/mcp-server/index.ts"],
      "env": {
        "TECHSCRIBE_URL": "http://localhost:3000"
      }
    }
  }
}
```

### Example prompts with MCP

Once connected, you can use natural language with your AI assistant:

- *"List all the SEO tools available in TechScribe Studio."*
- *"Generate a 1500-word article about React Server Components using the article-writer tool and save it to history."*
- *"Show me my last 5 history entries."*
- *"Create a calendar entry for a listicle about TypeScript tips, scheduled for next Monday."*

## Publish Scheduling Ownership Model

TechScribe Studio uses a **WordPress-owned scheduling** model. The app does not auto-publish or schedule posts on a timer. Publishing is always triggered manually from the tool page or the history archive.

### What the app controls

- **Publish intent** — set per calendar entry to one of three modes:
  - `Draft` — sends the content to WordPress as a draft for review before publishing.
  - `Publish` — makes the post live on WordPress immediately when the publish action is triggered.
  - `Schedule` — sends the post to WordPress with `status: future` and the calendar entry's planned date. WordPress then owns the exact publish time.

- **"Scheduled For" date** — an editorial planning date used to organise your content calendar. When publish intent is `Schedule`, this date is passed to WordPress as the intended publish date (defaulting to noon UTC on that day). The app does not poll or enforce this date itself.

### What WordPress controls

When publish intent is `Schedule`, WordPress receives the planned date and takes ownership of when the post actually goes live. If you change the timing after sending to WordPress, do so inside WordPress — the in-app date is only used at the moment the publish action is triggered.

### Publish state tracking

After a publish action the app records one of the following states:

| State | Meaning |
|---|---|
| `Draft Linked` | A WordPress draft was created for the first time |
| `Draft Updated` | An existing WordPress draft was updated |
| `Scheduled` | The post is queued for future publication on WordPress (`future` status) |
| `Published Live` | The post is live on WordPress |
| `Publish Failed` | The last publish attempt failed; the action can be retried |

## WordPress Setup

There are two supported ways to configure WordPress publishing:

1. Preferred: use the in-app Settings page and save credentials locally in SQLite.
2. Optional fallback: define `WORDPRESS_SITE_URL`, `WORDPRESS_USERNAME`, and `WORDPRESS_APP_PASSWORD` in `.env.local`.

Important behavior:

- Draft publishing is enabled only after saved in-app settings pass a successful connection test.
- If no saved settings exist, the server can still resolve WordPress credentials from environment variables.
- The Settings page is the operational source of truth for day-to-day publishing because it exposes connection status and verification state in the UI.

## Project Structure

```text
techscribe-studio/
├── app/
│   ├── api/
│   │   ├── calendar/                 # Content calendar CRUD endpoints
│   │   ├── generate/                 # Streaming generation endpoint
│   │   │   └── batch/                # Batch / automated generation endpoint
│   │   ├── history/                  # Save, list, filter, organize history
│   │   ├── settings/wordpress/       # WordPress settings + test endpoint
│   │   └── wordpress/draft/          # Draft publish/update endpoint
│   ├── calendar/                     # Calendar UI and planning workflow
│   ├── history/                      # History UI
│   ├── settings/                     # Settings UI
│   ├── tool/[slug]/                  # Tool runner UI
│   ├── layout.tsx                    # App shell + sidebar
│   ├── page.tsx                      # Dashboard
│   └── globals.css                   # Design tokens and global styles
├── data/                             # Local SQLite storage at runtime
├── components/
│   └── HandoffCard.tsx               # Result card with downstream launch actions
├── docs/
│   ├── automation.md                 # Automated generation requirements and design
│   ├── data-persistence.md           # SQLite storage reference and backup guide
│   ├── operations.md                 # Deployment, process management, reverse proxy
│   ├── recovery.md                   # Failure recovery procedures
│   ├── smoke-test.md                 # Pre-release smoke-test checklist
│   └── upgrade.md                   # Upgrade and migration reference
├── lib/
│   ├── calendar.ts                   # Calendar types and shared constants
│   ├── db.ts                         # SQLite schema and data access
│   ├── handoff-registry.ts           # Upstream → downstream handoff definitions
│   ├── output-parsers.ts             # Structured parsers for handoff-enabled tools
│   ├── publish-state.ts              # Publish state model constants and helpers
│   ├── tools.ts                      # Tool catalog and prompts
│   └── wordpress.ts                  # WordPress helpers and config resolution
├── .env.local.example
├── next.config.mjs
├── package.json
└── tailwind.config.ts
```

## Development Commands

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Deployment

TechScribe Studio is designed for self-hosted deployment where you control the runtime, filesystem, and secrets.

### Local development

```bash
npm run dev
```

### Production build

```bash
npm run build
npm run start
```

Deployment notes:

- The app uses a local SQLite database under `data/`, so persistent disk storage matters in production.
- `better-sqlite3` requires the Node.js runtime, which is already configured in the Next.js app for the relevant API routes.
- If you deploy to a platform with ephemeral storage, saved history and in-app WordPress settings will not persist unless you mount durable storage.
- Set `ANTHROPIC_API_KEY` in the deployment environment even if you also use a local `.env.local` during development.
- For a production install, treat the app as a stateful service rather than a static frontend deployment.

### Full operations guide

For step-by-step instructions covering process management, reverse proxy setup, backups, and failure recovery, see **[docs/operations.md](docs/operations.md)**.

For the pre-release smoke-test checklist that covers generate, save, history, planner linkage, settings verification, and draft publishing, see **[docs/smoke-test.md](docs/smoke-test.md)**.

For a complete reference on what SQLite data matters, where it lives, data directory requirements, and backup procedures, see **[docs/data-persistence.md](docs/data-persistence.md)**.

For upgrade and migration guidance — including how schema migrations work, how to handle persistence-sensitive releases, and rollback procedures — see **[docs/upgrade.md](docs/upgrade.md)**.

## Data and Security Notes

- `.env.local` is ignored and should never be committed.
- Runtime SQLite files in `data/` are ignored and stay local.
- Saved WordPress settings are stored locally for this self-hosted app.
- The Anthropic API key is only used server-side.
- If WordPress credentials were exposed outside your local environment, rotate the application password.

## Tool Handoffs

TechScribe Studio supports structured handoffs between tools. When a supported upstream tool finishes generating output, the tool page parses the result and displays a result card with action buttons that open downstream tools pre-filled with data from the current output.

### Supported handoffs

| Upstream tool | Downstream tool | Pre-filled in downstream |
|---|---|---|
| Blog Post Ideas | Article Writer | First idea title → topic |
| Blog Post Ideas | Headline Generator | First idea title → topic |
| Blog Post Ideas | Outline Generator | First idea title → topic |
| Headline Generator | Article Writer | First headline → topic |
| Headline Generator | Outline Generator | First headline → topic |
| Outline Generator | Article Writer | Outline title → topic; input keywords → keywords; input audience → audience |
| YouTube to Blog Post | Headline Generator | Blog post title → topic |
| YouTube to Blog Post | Outline Generator | Blog post title → topic; input keywords → keywords |
| YouTube to Blog Post | Content Calendar | Blog post title → title; input keywords → keywords |
| YouTube to Blog Post | Meta Title Generator | Video title → topic; keywords → keyword |
| YouTube to Blog Post | Meta Description Generator | Video title → topic; keywords → keyword |
| YouTube to Blog Post | Tweet / X Post Ideas | Video title → topic |
| YouTube to Blog Post | LinkedIn Post | Video title → topic |
| Keyword Research Brief | Article Writer | Brief title → topic; researched keywords → keywords |
| Keyword Research Brief | Outline Generator | Brief title → topic; researched keywords → keywords |
| Keyword Research Brief | Headline Generator | Brief title → topic |
| Keyword Research Brief | Content Calendar | Brief title → title; researched keywords → keywords; input audience → audience |

### Fallback rendering

When output parsing fails or no parser is registered for a tool, the tool page silently falls back to plain markdown rendering. The handoff result card and action buttons are not shown. Fallback rendering never blocks or interrupts output display — `null` from the parser is treated as "no structured data available".

### Extending the handoff system

To add a new upstream-to-downstream handoff:

1. **Register the handoff** in `lib/handoff-registry.ts`. Add an entry to `HANDOFF_REGISTRY` keyed by the upstream tool's slug. Each `HandoffAction` needs:
   - `label` — button text shown in the UI
   - `targetSlug` — slug of the downstream tool to open (also used as the URL path segment by default)
   - `fieldMap` — maps source input field names to destination query parameter names used for pre-filling
   - `targetPath` _(optional)_ — override the destination URL path when the target is not a tool page (e.g. `/calendar`)

2. **Add an output parser** in `lib/output-parsers.ts` if the upstream tool does not already have one. Write a `(raw: string) => ParsedToolOutput` function and register it in `PARSER_REGISTRY` under the upstream tool's slug. The `prefill` keys returned by the parser must match the source field names declared in the `fieldMap` so that `buildHandoffUrl` can forward them correctly.

3. No routing or page-level changes are needed for tool-to-tool handoffs. The tool page reads the registry automatically and renders the appropriate action buttons once output is fully generated.  For handoffs that target non-tool pages (e.g. `/calendar`), the destination page must read the relevant query parameters and apply them to its own form state.

## Adding New Tools

Tools are configured in `lib/tools.ts`. Each tool definition controls:

- slug and route
- category and display metadata
- form fields
- system prompt and user prompt template
- optional outline-first generation flow

Example:

```ts
{
  slug: "my-new-tool",
  name: "My New Tool",
  category: "Content Creation",
  description: "What this tool does",
  icon: "🔧",
  fields: [
    {
      name: "topic",
      label: "Topic",
      type: "text",
      placeholder: "Enter topic...",
      required: true,
    },
  ],
  systemPrompt: `You are an expert writer.`,
  userPromptTemplate: `Write about {topic}.`,
}
```

## Batch Generation API

The `POST /api/generate/batch` endpoint enables automated content generation from external schedulers, CI pipelines, or cron jobs.

For the full requirements specification, design rationale, and integration details, see **[docs/automation.md](docs/automation.md)**.

### Setup

1. Set `BATCH_API_SECRET` in your environment to a long random string. The endpoint returns `503` if this variable is not set.

2. Include the secret as a Bearer token in every request:
   ```
   Authorization: Bearer your-secret-token-here
   ```

### Request format

```json
POST /api/generate/batch
Content-Type: application/json
Authorization: Bearer your-secret-token-here

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

Maximum batch size is 20 jobs per request. Jobs are processed sequentially.

#### Optional per-job fields

| Field | Type | Description |
|---|---|---|
| `save` | boolean | When `true`, persist the generated output to the history database. |
| `calendar_id` | number | Content calendar entry to link after saving. Advances the entry from `planned`/`backlog` to `in-progress`. Only used when `save` is `true`. |
| `folder` | string | Folder name to assign to the saved history entry. Only used when `save` is `true`. |
| `tags` | string[] | Tags to assign to the saved history entry. Only used when `save` is `true`. |

### Response format

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

`history_id` is present in a result when `save: true` was set for that job. A per-job failure (unknown slug, upstream error) sets `status: "error"` and adds an `error` field. It does not abort remaining jobs.

### Example: GitHub Actions cron workflow

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
              "jobs": [{
                "slug": "blog-post-ideas",
                "fields": { "niche": "DevOps", "count": "10", "format": "Mixed" },
                "save": true,
                "folder": "weekly-ideas",
                "tags": ["auto", "devops"]
              }]
            }'
```

## Phase 2 Status

Completed so far in Phase 2:

- Content calendar planning and scheduling flow
- Tool prefill handoff from calendar items into generation pages
- Calendar-to-history linkage when planned drafts are saved
- Calendar sync when linked WordPress drafts are created or updated
- WordPress planning metadata on calendar items, including target category, tags, and publish intent
- Production deployment hardening and operational documentation ([docs/operations.md](docs/operations.md))
- YouTube-to-blog workflow — convert any video transcript or description into a full blog post with the outline-first option; blog planning handoffs (Headline Generator, Outline Generator, Content Calendar) let the generated post title drive downstream planning without re-entering the topic
- External keyword research inputs — Keyword Research Brief tool accepts Ahrefs/SEMrush/Google Keyword Planner data and produces actionable content briefs; briefs now forward researched keywords to Article Writer and Outline Generator, and a "Plan in Calendar" handoff lets users queue the planned content directly from the brief result
- Automated generation API — `POST /api/generate/batch` endpoint for scheduler-driven content jobs (requires `BATCH_API_SECRET`); supports optional history persistence, content calendar linkage, folder, and tag assignment per job — see [docs/automation.md](docs/automation.md) for full requirements and design

## Phase 2 Implementation Roadmap

### Sprint 1: Structured Handoffs

Goal: turn the current Blog Post Ideas handoff into a reusable workflow system.

- Ticket 1: create a structured handoff registry so upstream tools and downstream targets are configured in one place
- Ticket 2: extract reusable parsing utilities so structured results are normalized outside the page UI
- Ticket 3: build a shared handoff card UI for parsed results and downstream actions
- Ticket 4: add a second supported handoff, with Outline Generator to Article Writer as the recommended next path
- Ticket 5: document supported handoffs in the README

Sprint 1 exit criteria:

- At least 3 total handoff paths are live
- Parsed results use shared registry and parser logic
- Raw output still renders as a fallback when parsing fails

### Sprint 2: Calendar Workspace Expansion

Goal: upgrade planning from a queue view into a true calendar workspace.

- Ticket 1: add planner view modes so list and week views can coexist
- Ticket 2: implement a weekly board layout with day columns and an unscheduled backlog lane
- Ticket 3: add quick rescheduling interactions so items can move without opening each card in the editor
- Ticket 4: add shared planner filters that work consistently across all planner views

Sprint 2 exit criteria:

- The planner supports at least list and week modes
- Rescheduling works faster than manual per-item editing
- Filters and summary counts stay consistent across views

### Sprint 3: Publishing Workflow Expansion

Goal: turn draft sync into a fuller publishing workflow.

- Ticket 1: define a richer publishing state model across tool, calendar, and history views
- Ticket 2: expand editable publish metadata such as slug, excerpt, categories, and tags
- Ticket 3: add retry and recovery UX for WordPress publish failures
- Ticket 4: decide whether publish scheduling is controlled in-app or remains WordPress-owned, then implement that model clearly

Sprint 3 exit criteria:

- Publishing state is visible across the main workflow surfaces
- Failed publish attempts are retryable without re-generation
- The scheduling model is explicit in the product and docs

### Sprint 4: Deployment and Operations Hardening

Goal: make the app easier to deploy and run as a real self-hosted service.

- Ticket 1: write a deployment guide covering local development, production build, persistence, and secrets
- Ticket 2: add operations and recovery notes for common failures such as missing env vars, SQLite persistence issues, and WordPress connection errors
- Ticket 3: define backup and persistence expectations for the SQLite data directory
- Ticket 4: add a short manual smoke-test checklist for the critical product path

Sprint 4 exit criteria:

- A new operator can deploy the app without reading implementation code
- Persistence and recovery expectations are documented clearly
- The critical workflow can be validated quickly before release

### Backlog After Phase 2 Core

<<<<<<< HEAD
- Richer weekly board or month-grid calendar views
- Richer publishing workflows beyond draft creation
=======
- Scheduled or automated generation jobs
- External keyword research integrations
- YouTube-to-blog workflows

### Recommended Delivery Order

- Shared handoff framework
- Calendar workspace expansion
- Publishing workflow expansion
- Deployment and operations hardening
>>>>>>> ee57193 (Approved)

## License

MIT
