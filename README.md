# TechScribe Studio

Your personal, self-hosted AI writing studio — a RightBlogger-style tool built with **Next.js** and **Claude**.

---

## ✨ Features

- **25+ AI writing tools** across 7 categories
- **Streaming output** — see content generate in real-time
- **Dark, editorial UI** designed for writers
- **100% self-hosted** — your data, your server, your API key
- **Extensible** — add tools by editing a single `lib/tools.ts` file

### Tool Categories
| Category | Tools |
|---|---|
| ✍️ Content Creation | Article Writer, Listicle Writer, Intro, Conclusion, Paragraph, Expander |
| 💡 Ideas & Planning | Blog Post Ideas, Headline Generator, Outline Generator |
| 🔍 SEO & Keywords | Meta Title, Meta Description, Keyword Cluster, FAQ Writer |
| 🔄 Editing & Rewriting | Rewriter, Shortener, Summarizer, Explain Like I'm 5 |
| 📱 Social Media | Twitter/X, LinkedIn, Facebook, Pinterest |
| 📣 Email & Marketing | Subject Lines, CTA Writer, AIDA Copy |
| 🎬 Video Content | Video Title, Video Description, Script Outline |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed
- An [Anthropic API key](https://console.anthropic.com)
- Git + VSCode

### 1. Clone the repo
```bash
git clone https://github.com/YOUR_USERNAME/techscribe-studio.git
cd techscribe-studio
```

### 2. Install dependencies
```bash
npm install
```

### 3. Set up your API key
```bash
cp .env.local.example .env.local
```
Then open `.env.local` in VSCode and add your Anthropic API key:
```
ANTHROPIC_API_KEY=sk-ant-YOUR_KEY_HERE
```

### 4. Run the development server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you're running!

---

## 🏗️ Project Structure

```
techscribe-studio/
├── app/
│   ├── api/generate/route.ts   # Anthropic API endpoint (streaming)
│   ├── tool/[slug]/page.tsx    # Individual tool page
│   ├── page.tsx                # Dashboard home
│   ├── layout.tsx              # Root layout + sidebar
│   └── globals.css             # Styles & design tokens
├── lib/
│   └── tools.ts                # ← ALL TOOL DEFINITIONS HERE
└── ...
```

---

## ➕ Adding New Tools

Everything lives in `lib/tools.ts`. To add a tool, append to the `TOOLS` array:

```typescript
{
  slug: "my-new-tool",          // URL: /tool/my-new-tool
  name: "My New Tool",
  category: "Content Creation", // Must match an existing category
  description: "What this tool does",
  icon: "🔧",
  fields: [
    {
      name: "topic",
      label: "Topic",
      type: "text",              // "text" | "textarea" | "select"
      placeholder: "Enter topic...",
      required: true,
    },
    {
      name: "tone",
      label: "Tone",
      type: "select",
      options: ["Casual", "Professional", "Funny"],
    },
  ],
  systemPrompt: `You are an expert writer. Write in Markdown.`,
  userPromptTemplate: `Write about {topic} in a {tone} tone.`,
  // {fieldName} placeholders are replaced with user input
},
```

---

## 🗺️ Roadmap (Phase 2)

- [ ] **WordPress integration** — publish posts directly to techscribe.org
- [ ] **Save history** — store generated content to SQLite database
- [ ] **Content calendar** — plan and schedule blog posts
- [ ] **Keyword research** — integrate DataForSEO or SerpAPI
- [ ] **YouTube-to-blog** — convert videos to articles via YouTube API
- [ ] **Autoblogging** — schedule automated post generation

---

## 🔒 Security Notes

- **Never commit `.env.local`** — it's in `.gitignore` by default
- For production hosting, use environment variables from your host (e.g. Railway, Vercel, DigitalOcean)
- The API key is only used server-side — never exposed to the browser

---

## 🌐 Deployment Options

### Local only (simplest)
Just run `npm run dev` — perfect for personal use.

### Self-hosted on a VPS
```bash
npm run build
npm start
# Or use PM2: pm2 start npm -- start
```

### Vercel (free tier)
```bash
npm i -g vercel
vercel
# Set ANTHROPIC_API_KEY in Vercel environment variables
```

### Railway / Render
Connect your GitHub repo and set the `ANTHROPIC_API_KEY` env variable.

---

## 📝 License

MIT — use freely for personal or commercial projects.
