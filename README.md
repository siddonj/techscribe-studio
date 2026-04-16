# TechScribe Studio

TechScribe Studio is a self-hosted AI writing workspace for content teams, solo publishers, and technical operators who want the speed of AI tooling without giving up control of their prompts, drafts, and publishing flow.

Built with Next.js, Claude, and SQLite, it packages a broad tool library for blog writing, idea generation, SEO support, rewriting, social content, email copy, video workflows, and editorial planning into a single local-first application.

Phase 1 is complete, and the first Phase 2 planning layer is now in place. The product covers the core content loop end to end: plan, generate, refine, save, organize, and publish drafts to WordPress from one interface.

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

### Content workflow

- Streaming generation via `app/api/generate/route.ts` so output appears as it is created
- Save generated outputs into local history instead of losing drafts between sessions
- Re-open saved content from the History screen for reuse, editing, or publishing
- Copy, iterate on, and publish saved outputs without leaving the app
- Outline-to-article workflow for long-form article generation
- Open a tool from the calendar with planning fields prefilled into the writing flow

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
| SEO & Keywords | Meta Title Generator, Meta Description Generator, Keyword Cluster Generator, FAQ Writer |
| Editing & Rewriting | Content Rewriter, Content Shortener, Summarizer, Explain Like I'm 5 |
| Social Media | Tweet / X Post Ideas, LinkedIn Post, Facebook Post, Pinterest Pin Description |
| Email & Marketing | Email Subject Line, Call-to-Action Writer, AIDA Copywriter |
| Video Content | Video Title Generator, Video Description, Video Script Outline |

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

### 4. Start the app

```bash
npm run dev
```

Then open http://localhost:3000.

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
├── lib/
│   ├── calendar.ts                   # Calendar types and shared constants
│   ├── db.ts                         # SQLite schema and data access
│   ├── handoff-registry.ts           # Upstream → downstream handoff definitions
│   ├── output-parsers.ts             # Structured parsers for handoff-enabled tools
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

### Fallback rendering

When output parsing fails or no parser is registered for a tool, the tool page silently falls back to plain markdown rendering. The handoff result card and action buttons are not shown. Fallback rendering never blocks or interrupts output display — `null` from the parser is treated as "no structured data available".

### Extending the handoff system

To add a new upstream-to-downstream handoff:

1. **Register the handoff** in `lib/handoff-registry.ts`. Add an entry to `HANDOFF_REGISTRY` keyed by the upstream tool's slug. Each `HandoffAction` needs:
   - `label` — button text shown in the UI
   - `targetSlug` — slug of the downstream tool to open
   - `fieldMap` — maps source input field names to destination query parameter names used for pre-filling

2. **Add an output parser** in `lib/output-parsers.ts` if the upstream tool does not already have one. Write a `(raw: string) => ParsedToolOutput` function and register it in `PARSER_REGISTRY` under the upstream tool's slug. The `prefill` keys returned by the parser must match the source field names declared in the `fieldMap` so that `buildHandoffUrl` can forward them correctly.

3. No routing or page-level changes are needed. The tool page reads the registry automatically and renders the appropriate action buttons once output is fully generated.

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

## Phase 2 Status

Completed so far in Phase 2:

- Content calendar planning and scheduling flow
- Tool prefill handoff from calendar items into generation pages
- Calendar-to-history linkage when planned drafts are saved
- Calendar sync when linked WordPress drafts are created or updated
- WordPress planning metadata on calendar items, including target category, tags, and publish intent

Still open for later:

- Richer weekly board or month-grid calendar views
- Scheduled or automated generation jobs
- External keyword research integrations
- YouTube-to-blog workflows
- Richer publishing workflows beyond draft creation
- Production deployment hardening and operational docs

## License

MIT
