# TechScribe Studio

TechScribe Studio is a self-hosted AI writing workspace for content teams, solo publishers, and technical operators who want the speed of AI tooling without giving up control of their prompts, drafts, and publishing flow.

Built with Next.js, Claude, and SQLite, it packages a broad tool library for blog writing, idea generation, SEO support, rewriting, social content, email copy, and video workflows into a single local-first application.

Phase 1 is complete. The product now covers the core content loop end to end: generate, refine, save, organize, and publish drafts to WordPress from one interface.

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
│   │   ├── generate/                 # Streaming generation endpoint
│   │   ├── history/                  # Save, list, filter, organize history
│   │   ├── settings/wordpress/       # WordPress settings + test endpoint
│   │   └── wordpress/draft/          # Draft publish/update endpoint
│   ├── history/                      # History UI
│   ├── settings/                     # Settings UI
│   ├── tool/[slug]/                  # Tool runner UI
│   ├── layout.tsx                    # App shell + sidebar
│   ├── page.tsx                      # Dashboard
│   └── globals.css                   # Design tokens and global styles
├── data/                             # Local SQLite storage at runtime
├── lib/
│   ├── db.ts                         # SQLite schema and data access
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

## Next Phase

Phase 1 is complete. Likely Phase 2 candidates are:

- Content calendar and planning workflows
- Scheduled or automated generation
- External keyword research integrations
- YouTube-to-blog workflows
- Richer publishing workflows beyond draft creation
- Production deployment hardening and operational docs

## License

MIT
