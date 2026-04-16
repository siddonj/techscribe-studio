export type FieldType = "text" | "textarea" | "select" | "number";

export interface ToolField {
  name: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  options?: string[];
  required?: boolean;
  rows?: number;
}

export interface Tool {
  slug: string;
  name: string;
  category: string;
  description: string;
  icon: string;
  fields: ToolField[];
  systemPrompt: string;
  userPromptTemplate: string;
  /** If set, this tool uses a two-step outline-then-article flow */
  outlineSystemPrompt?: string;
  outlineUserPromptTemplate?: string;
  /** Used for the second step when generating the article from an approved outline */
  articleWithOutlinePromptTemplate?: string;
  /** When true, the Input Studio shows an "+ Add Knowledge" research panel */
  supportsResearch?: boolean;
}

export const CATEGORIES = [
  "Content Creation",
  "Ideas & Planning",
  "SEO & Keywords",
  "Editing & Rewriting",
  "Social Media",
  "Email & Marketing",
  "Video Content",
] as const;

export const TOOLS: Tool[] = [
  // ── CONTENT CREATION ─────────────────────────────────────────
  {
    slug: "article-writer",
    name: "Article Writer",
    category: "Content Creation",
    description: "Generate a full SEO-optimized blog post from a topic and keywords.",
    icon: "📝",
    fields: [
      { name: "topic", label: "Article Topic", type: "text", placeholder: "e.g. Best JavaScript frameworks in 2025", required: true },
      { name: "keywords", label: "Target Keywords (comma-separated)", type: "text", placeholder: "e.g. JS frameworks, React, Vue, frontend" },
      { name: "context", label: "Context / Brief", type: "textarea", placeholder: "Key angle, summary, or editorial brief for the article", rows: 3 },
      { name: "tone", label: "Tone", type: "select", options: ["Informative", "Conversational", "Professional", "Enthusiastic", "Authoritative"] },
      { name: "length", label: "Length", type: "select", options: ["Short (~800 words)", "Medium (~1500 words)", "Long (~2500 words)"] },
      { name: "audience", label: "Target Audience", type: "text", placeholder: "e.g. Beginner developers, tech enthusiasts" },
    ],
    systemPrompt: `You are an expert SEO content writer for a tech blog called TechScribe. Write comprehensive, well-structured blog articles that are informative, engaging, and optimized for search engines. Use clear headings (H2, H3), short paragraphs, and include practical examples. Format output in Markdown.`,
    userPromptTemplate: `Write a {length} blog article about: {topic}\n\nTarget keywords: {keywords}\nTone: {tone}\nTarget audience: {audience}{contextSection}\n\nInclude: compelling intro, structured body with H2/H3 headings, practical tips, and a strong conclusion with a CTA.`,
    outlineSystemPrompt: `You are an expert content strategist for a tech blog called TechScribe. Your job is to produce a clear, well-structured article outline using Markdown headings. Return ONLY the outline — no article body, no explanations, just the structure.`,
    outlineUserPromptTemplate: `Create a detailed blog article outline for:\nTopic: {topic}\nTarget keywords: {keywords}\nTone: {tone}\nLength: {length}\nAudience: {audience}{contextSection}\n\nStructure the outline as:\n# Suggested Article Title\n## Introduction\n## [Main Section 1] (4-6 main sections total)\n### [Subsection]\n### [Subsection]\n## [Main Section 2]\n...\n## Conclusion\n\nReturn only the outline — no body content.`,
    articleWithOutlinePromptTemplate: `Write a {length} blog article about: {topic}\n\nTarget keywords: {keywords}\nTone: {tone}\nTarget audience: {audience}{contextSection}\n\nFollow this outline exactly:\n{outline}\n\nExpand every section with full paragraphs. Include a compelling introduction, practical examples throughout, and a strong conclusion with a CTA. Format in Markdown.`,
    supportsResearch: true,
  },
  {
    slug: "listicle-writer",
    name: "Listicle Writer",
    category: "Content Creation",
    description: "Create a numbered list-style article perfect for high engagement.",
    icon: "🔢",
    fields: [
      { name: "topic", label: "Listicle Topic", type: "text", placeholder: "e.g. 10 best VS Code extensions for developers", required: true },
      { name: "count", label: "Number of Items", type: "select", options: ["5", "7", "10", "15", "20"] },
      { name: "tone", label: "Tone", type: "select", options: ["Informative", "Conversational", "Enthusiastic", "Professional"] },
    ],
    systemPrompt: `You are an expert content writer specializing in listicle articles for a tech blog. Create well-researched, engaging numbered lists with detailed explanations for each item. Format in Markdown.`,
    userPromptTemplate: `Write a {count}-item listicle article about: {topic}\nTone: {tone}\n\nFor each item include a bold title, 2-3 sentence description, and why it matters to the reader.`,
  },
  {
    slug: "intro-writer",
    name: "Introduction Writer",
    category: "Content Creation",
    description: "Write a compelling hook introduction for any blog post.",
    icon: "🚀",
    fields: [
      { name: "topic", label: "Blog Post Topic", type: "text", placeholder: "e.g. Getting started with Docker", required: true },
      { name: "style", label: "Hook Style", type: "select", options: ["Question hook", "Statistic hook", "Story hook", "Bold statement", "Pain point hook"] },
      { name: "audience", label: "Target Audience", type: "text", placeholder: "e.g. DevOps beginners" },
    ],
    systemPrompt: `You are a master blog copywriter who specializes in writing irresistible introductions that keep readers hooked. Write introductions in Markdown with a clear hook, brief context, and a preview of what the reader will learn.`,
    userPromptTemplate: `Write a compelling blog introduction for a post about: {topic}\nHook style: {style}\nAudience: {audience}\n\nKeep it to 2-3 short paragraphs. End with a clear transition sentence into the body.`,
  },
  {
    slug: "conclusion-writer",
    name: "Conclusion Writer",
    category: "Content Creation",
    description: "Craft a strong conclusion with a call-to-action for your post.",
    icon: "🎯",
    fields: [
      { name: "topic", label: "Blog Post Topic", type: "text", placeholder: "e.g. Python vs JavaScript for beginners", required: true },
      { name: "keyPoints", label: "Key Points Covered", type: "textarea", placeholder: "Briefly list 2-3 main points from your article", rows: 3 },
      { name: "cta", label: "Call-to-Action Goal", type: "select", options: ["Subscribe to newsletter", "Leave a comment", "Read related article", "Try a tool/product", "Share the post"] },
    ],
    systemPrompt: `You are an expert blog writer who crafts memorable conclusions that summarize key insights and motivate readers to take action. Format in Markdown.`,
    userPromptTemplate: `Write a conclusion for a blog post about: {topic}\nKey points covered: {keyPoints}\nDesired CTA: {cta}\n\nSummarize insights, provide a memorable takeaway, and include a natural CTA.`,
  },
  {
    slug: "paragraph-writer",
    name: "Paragraph Writer",
    category: "Content Creation",
    description: "Expand a heading or idea into a full, detailed paragraph.",
    icon: "✍️",
    fields: [
      { name: "heading", label: "Section Heading or Idea", type: "text", placeholder: "e.g. Why TypeScript improves code quality", required: true },
      { name: "context", label: "Article Context", type: "text", placeholder: "e.g. Article about TypeScript for React developers" },
      { name: "length", label: "Paragraph Length", type: "select", options: ["Short (2-3 sentences)", "Medium (4-6 sentences)", "Long (7-10 sentences)"] },
    ],
    systemPrompt: `You are a tech blog writer who expands ideas into clear, insightful paragraphs. Write in plain Markdown prose (no bullet points unless specifically needed).`,
    userPromptTemplate: `Write a {length} paragraph expanding on this heading/idea: "{heading}"\nArticle context: {context}\n\nBe specific, insightful, and write in a natural, engaging voice.`,
  },
  {
    slug: "content-expander",
    name: "Content Expander",
    category: "Content Creation",
    description: "Take a short piece of content and expand it into something richer.",
    icon: "🔭",
    fields: [
      { name: "content", label: "Original Content", type: "textarea", placeholder: "Paste your short content here...", required: true, rows: 5 },
      { name: "targetLength", label: "Expand To", type: "select", options: ["150% of original", "200% of original", "300% of original"] },
      { name: "addElements", label: "Add Elements", type: "select", options: ["Examples & analogies", "Statistics & data", "Step-by-step detail", "Expert insights", "Practical tips"] },
    ],
    systemPrompt: `You are an expert content editor who expands drafts into richer, more detailed pieces without losing the original voice. Format in Markdown.`,
    userPromptTemplate: `Expand this content to approximately {targetLength}:\n\n{content}\n\nFocus on adding: {addElements}. Maintain the original voice and tone.`,
  },

  // ── IDEAS & PLANNING ─────────────────────────────────────────
  {
    slug: "blog-post-ideas",
    name: "Blog Post Ideas",
    category: "Ideas & Planning",
    description: "Generate a list of blog post ideas based on your niche and topic.",
    icon: "💡",
    fields: [
      { name: "niche", label: "Blog Niche", type: "text", placeholder: "e.g. Web development, AI tools, DevOps", required: true },
      { name: "topic", label: "Specific Topic / Angle (optional)", type: "text", placeholder: "e.g. beginner-friendly tutorials" },
      { name: "count", label: "Number of Ideas", type: "select", options: ["5", "10", "15", "20"] },
      { name: "format", label: "Preferred Post Formats", type: "select", options: ["Mixed", "How-to guides", "Listicles", "Comparisons", "Opinion pieces", "Case studies"] },
    ],
    systemPrompt: `You are a content strategist for a tech blog. Generate compelling, specific blog post ideas with clear audience appeal and SEO potential. Format each idea with a title, brief description, and suggested keywords.`,
    userPromptTemplate: `Generate {count} blog post ideas for a {niche} blog.\nSpecific angle: {topic}\nPreferred formats: {format}\n\nFor each idea provide:\n1. A catchy title\n2. A 1-sentence description\n3. 3 target keywords`,
  },
  {
    slug: "headline-generator",
    name: "Headline Generator",
    category: "Ideas & Planning",
    description: "Generate multiple headline options for any blog post topic.",
    icon: "📰",
    fields: [
      { name: "topic", label: "Blog Post Topic", type: "text", placeholder: "e.g. How to use GitHub Copilot effectively", required: true },
      { name: "style", label: "Headline Styles", type: "select", options: ["Mixed styles", "How-to", "Listicle numbers", "Question-based", "Power words", "SEO-focused"] },
      { name: "count", label: "Number of Headlines", type: "select", options: ["5", "10", "15"] },
    ],
    systemPrompt: `You are a world-class headline writer for a tech blog. Write headlines that are specific, curiosity-provoking, and SEO-friendly. Vary the formulas.`,
    userPromptTemplate: `Generate {count} {style} headlines for a blog post about: {topic}\n\nMake each one distinct. Include power words, numbers where relevant, and clear benefit/value for the reader.`,
  },
  {
    slug: "outline-generator",
    name: "Outline Generator",
    category: "Ideas & Planning",
    description: "Build a detailed, structured outline for any blog post.",
    icon: "🗂️",
    fields: [
      { name: "topic", label: "Blog Post Topic", type: "text", placeholder: "e.g. Complete guide to REST APIs", required: true },
      { name: "keywords", label: "Target Keywords", type: "text", placeholder: "e.g. REST API, API design, HTTP methods" },
      { name: "audience", label: "Target Audience", type: "text", placeholder: "e.g. Junior developers" },
      { name: "depth", label: "Outline Depth", type: "select", options: ["Basic (H2 only)", "Detailed (H2 + H3)", "Comprehensive (H2 + H3 + bullet points)"] },
    ],
    systemPrompt: `You are a content strategist who creates clear, SEO-optimized blog post outlines. Include intro, body sections with logical flow, and a conclusion. Format as a clean Markdown outline.`,
    userPromptTemplate: `Create a {depth} outline for a blog post about: {topic}\nTarget keywords: {keywords}\nAudience: {audience}\n\nEnsure logical flow, natural keyword placement, and clear value in each section.`,
  },

  // ── SEO & KEYWORDS ───────────────────────────────────────────
  {
    slug: "meta-title",
    name: "Meta Title Generator",
    category: "SEO & Keywords",
    description: "Generate SEO-optimized meta titles under 60 characters.",
    icon: "🏷️",
    fields: [
      { name: "topic", label: "Page/Post Topic", type: "text", placeholder: "e.g. Python web scraping tutorial", required: true },
      { name: "keyword", label: "Primary Keyword", type: "text", placeholder: "e.g. Python web scraping" },
      { name: "count", label: "Number of Options", type: "select", options: ["3", "5", "8"] },
    ],
    systemPrompt: `You are an SEO specialist. Write compelling meta titles that are under 60 characters, include the primary keyword near the front, and have strong click-through appeal.`,
    userPromptTemplate: `Generate {count} meta title options for: {topic}\nPrimary keyword: {keyword}\n\nEach title must be under 60 characters. Include character count for each. Vary the formulas (How-to, listicle, question, benefit-focused).`,
  },
  {
    slug: "meta-description",
    name: "Meta Description Generator",
    category: "SEO & Keywords",
    description: "Write compelling meta descriptions that boost click-through rates.",
    icon: "📋",
    fields: [
      { name: "topic", label: "Page/Post Topic", type: "text", placeholder: "e.g. Beginner's guide to Docker containers", required: true },
      { name: "keyword", label: "Primary Keyword", type: "text", placeholder: "e.g. Docker for beginners" },
      { name: "cta", label: "CTA Action", type: "select", options: ["Learn more", "Discover", "Find out", "See how", "Get started"] },
    ],
    systemPrompt: `You are an SEO copywriter. Write meta descriptions that are 150-160 characters, include the target keyword, clearly state the content's value, and have a soft CTA.`,
    userPromptTemplate: `Write 3 meta description options for: {topic}\nPrimary keyword: {keyword}\nCTA style: {cta}\n\nEach should be 150-160 characters. Include character count. Use active voice and be specific about what the reader will get.`,
  },
  {
    slug: "keyword-cluster",
    name: "Keyword Cluster Generator",
    category: "SEO & Keywords",
    description: "Group related keywords into topical clusters for your content strategy.",
    icon: "🔑",
    fields: [
      { name: "seedKeyword", label: "Seed Keyword", type: "text", placeholder: "e.g. machine learning", required: true },
      { name: "niche", label: "Blog Niche", type: "text", placeholder: "e.g. tech tutorials for beginners" },
    ],
    systemPrompt: `You are an SEO content strategist. Generate keyword clusters organized by search intent (informational, commercial, navigational) with suggested article angles for each cluster.`,
    userPromptTemplate: `Generate a keyword cluster strategy for seed keyword: "{seedKeyword}"\nBlog niche: {niche}\n\nOrganize into:\n1. Primary keywords\n2. Long-tail variations\n3. Related questions (People Also Ask)\n4. Suggested article titles for each cluster\n\nFormat as a clear Markdown table or organized list.`,
  },
  {
    slug: "faq-writer",
    name: "FAQ Writer",
    category: "SEO & Keywords",
    description: "Generate SEO-rich FAQ sections for any blog post.",
    icon: "❓",
    fields: [
      { name: "topic", label: "Article Topic", type: "text", placeholder: "e.g. Using Tailwind CSS with Next.js", required: true },
      { name: "count", label: "Number of FAQs", type: "select", options: ["5", "8", "10"] },
    ],
    systemPrompt: `You are an SEO writer who crafts FAQ sections targeting featured snippets and voice search queries. Write natural questions and concise, complete answers. Format as Markdown H3 questions with paragraph answers.`,
    userPromptTemplate: `Generate {count} FAQ questions and answers for a blog post about: {topic}\n\nFocus on real questions people search for. Answers should be 2-4 sentences, clear, and complete enough for a featured snippet.`,
  },

  {
    slug: "keyword-research-brief",
    name: "Keyword Research Brief",
    category: "SEO & Keywords",
    description: "Transform external keyword research data into an actionable content brief.",
    icon: "🔬",
    fields: [
      { name: "topic", label: "Content Topic", type: "text", placeholder: "e.g. Python web scraping", required: true },
      { name: "researchNotes", label: "Keyword Research Data", type: "textarea", placeholder: "Paste keyword data from Ahrefs, SEMrush, Google Keyword Planner, or your own research notes. Include keywords, search volumes, difficulties, and any competitor insights...", required: true, rows: 8 },
      { name: "audience", label: "Target Audience", type: "text", placeholder: "e.g. Beginner Python developers" },
      { name: "intent", label: "Primary Search Intent", type: "select", options: ["Informational", "Commercial", "Navigational", "Transactional"] },
    ],
    systemPrompt: `You are an expert SEO content strategist. Analyze raw keyword research data and produce a structured, actionable content brief that guides a writer to produce a high-ranking article. Synthesize the research into a clear strategy with primary keyword, secondary keywords, content angle, recommended title, outline structure, and internal linking opportunities. Format the brief in clean Markdown.`,
    userPromptTemplate: `Create a detailed SEO content brief from this keyword research data.\n\nContent Topic: {topic}\nTarget Audience: {audience}\nPrimary Search Intent: {intent}\n\nKeyword Research Data:\n{researchNotes}\n\nDeliver a complete content brief including:\n1. **Recommended Title** (SEO-optimized, under 60 chars)\n2. **Primary Keyword** and monthly search volume\n3. **Secondary Keywords** (5-10 supporting terms)\n4. **LSI Keywords** (semantic variations to include naturally)\n5. **Content Angle** — the unique positioning or hook\n6. **Recommended Word Count** based on keyword difficulty\n7. **Content Outline** (H2/H3 structure)\n8. **Key Points to Cover** (what top-ranking pages include)\n9. **CTA Recommendation**\n\nFormat clearly so a writer can act on it immediately.`,
  },

  // ── EDITING & REWRITING ──────────────────────────────────────
  {
    slug: "rewriter",
    name: "Content Rewriter",
    category: "Editing & Rewriting",
    description: "Rewrite existing content to improve quality, clarity, or uniqueness.",
    icon: "🔄",
    fields: [
      { name: "content", label: "Original Content", type: "textarea", placeholder: "Paste your content here...", required: true, rows: 6 },
      { name: "goal", label: "Rewrite Goal", type: "select", options: ["Improve clarity", "Make more engaging", "Simplify language", "Increase authority", "Make more concise", "Full rewrite (unique)"] },
      { name: "tone", label: "Target Tone", type: "select", options: ["Keep original", "More conversational", "More professional", "More enthusiastic"] },
    ],
    systemPrompt: `You are an expert editor and rewriter for tech blog content. Rewrite content to achieve the specified goal while maintaining accuracy and improving readability. Format in Markdown.`,
    userPromptTemplate: `Rewrite this content with goal: {goal}\nTarget tone: {tone}\n\nOriginal:\n{content}`,
  },
  {
    slug: "content-shortener",
    name: "Content Shortener",
    category: "Editing & Rewriting",
    description: "Condense long content while keeping all the key information.",
    icon: "✂️",
    fields: [
      { name: "content", label: "Content to Shorten", type: "textarea", placeholder: "Paste your content here...", required: true, rows: 6 },
      { name: "targetLength", label: "Target Length", type: "select", options: ["50% of original", "30% of original", "One paragraph summary", "3 bullet point summary"] },
    ],
    systemPrompt: `You are an expert editor who condenses content without losing key information or meaning. Prioritize the most important points and eliminate filler. Format in Markdown.`,
    userPromptTemplate: `Shorten this content to {targetLength}:\n\n{content}\n\nKeep all essential facts, remove filler, and maintain the original voice.`,
  },
  {
    slug: "summarizer",
    name: "Summarizer",
    category: "Editing & Rewriting",
    description: "Summarize any article, text, or content into key takeaways.",
    icon: "📄",
    fields: [
      { name: "content", label: "Content to Summarize", type: "textarea", placeholder: "Paste your article or content...", required: true, rows: 6 },
      { name: "format", label: "Summary Format", type: "select", options: ["3-5 bullet points", "One paragraph", "TLDR (1-2 sentences)", "Executive summary"] },
    ],
    systemPrompt: `You are an expert at distilling complex content into clear, accurate summaries. Extract key insights and present them concisely. Format in Markdown.`,
    userPromptTemplate: `Summarize the following content as a {format}:\n\n{content}`,
  },
  {
    slug: "explain-like-five",
    name: "Explain Like I'm 5",
    category: "Editing & Rewriting",
    description: "Simplify complex tech concepts into plain, easy-to-understand language.",
    icon: "🧸",
    fields: [
      { name: "concept", label: "Complex Concept or Content", type: "textarea", placeholder: "Enter a complex concept or paste technical content...", required: true, rows: 4 },
      { name: "audience", label: "Simplify For", type: "select", options: ["Complete beginner", "Non-technical person", "Child (age 8-10)", "High school student"] },
    ],
    systemPrompt: `You are a brilliant explainer who can make complex tech concepts understandable to anyone. Use simple words, real-world analogies, and short sentences. Avoid jargon entirely.`,
    userPromptTemplate: `Explain this in simple terms for a {audience}:\n\n{concept}\n\nUse an analogy from everyday life to make it click. Keep it friendly and encouraging.`,
  },

  // ── SOCIAL MEDIA ─────────────────────────────────────────────
  {
    slug: "tweet-ideas",
    name: "Tweet / X Post Ideas",
    category: "Social Media",
    description: "Create tweet threads or standalone posts from your blog content.",
    icon: "🐦",
    fields: [
      { name: "topic", label: "Blog Post Topic or Content", type: "textarea", placeholder: "Paste your blog post URL/title or content...", required: true, rows: 3 },
      { name: "type", label: "Post Type", type: "select", options: ["Standalone tweets (5 options)", "Tweet thread (5-8 tweets)", "Quote / insight tweet"] },
    ],
    systemPrompt: `You are a social media expert for tech content. Write engaging Twitter/X posts that provide genuine value, use hooks, and drive traffic back to the blog. Keep each tweet under 280 characters (note length). No hashtag spam — max 2 relevant tags.`,
    userPromptTemplate: `Create {type} based on this blog content:\n\n{topic}\n\nMake each post punchy, valuable, and end with a CTA or curiosity hook. Include character counts.`,
  },
  {
    slug: "linkedin-post",
    name: "LinkedIn Post",
    category: "Social Media",
    description: "Write a professional LinkedIn post to promote your blog content.",
    icon: "💼",
    fields: [
      { name: "topic", label: "Blog Post Topic or Summary", type: "textarea", placeholder: "What's your blog post about?", required: true, rows: 3 },
      { name: "angle", label: "Post Angle", type: "select", options: ["Share insight/lesson", "Contrarian take", "Story-based", "Stats & data", "Quick tips list"] },
    ],
    systemPrompt: `You are a LinkedIn content strategist for tech professionals. Write posts that perform well with a strong hook first line, valuable body, and engagement CTA. Use line breaks for readability. Professional but human.`,
    userPromptTemplate: `Write a LinkedIn post promoting this blog content:\n{topic}\nAngle: {angle}\n\nHook first line, short punchy paragraphs, end with a question or CTA. 150-300 words ideal.`,
  },
  {
    slug: "facebook-post",
    name: "Facebook Post",
    category: "Social Media",
    description: "Write an engaging Facebook post to share your latest blog article.",
    icon: "📘",
    fields: [
      { name: "topic", label: "Blog Post Topic / Summary", type: "text", placeholder: "e.g. My new guide on AI tools for writers", required: true },
      { name: "tone", label: "Tone", type: "select", options: ["Friendly & casual", "Informative", "Exciting announcement", "Community-focused"] },
    ],
    systemPrompt: `You are a social media manager for a tech blog. Write Facebook posts that feel authentic, drive clicks, and encourage shares/comments. Keep it conversational and under 200 words.`,
    userPromptTemplate: `Write a Facebook post promoting a blog post about: {topic}\nTone: {tone}\n\nInclude an emoji or two, a teaser of the value, and a link placeholder [LINK].`,
  },
  {
    slug: "pinterest-pin",
    name: "Pinterest Pin Description",
    category: "Social Media",
    description: "Write keyword-rich Pinterest pin descriptions to drive blog traffic.",
    icon: "📌",
    fields: [
      { name: "topic", label: "Blog Post Topic", type: "text", placeholder: "e.g. 15 best tools for remote developers", required: true },
      { name: "keywords", label: "Target Keywords", type: "text", placeholder: "e.g. remote work tools, developer productivity" },
    ],
    systemPrompt: `You are a Pinterest SEO specialist. Write pin descriptions that are keyword-rich (for Pinterest search), compelling, and drive clicks to the blog. 100-200 words, include keywords naturally.`,
    userPromptTemplate: `Write a Pinterest pin description for a blog post about: {topic}\nKeywords to include: {keywords}\n\nMake it scannable, benefit-focused, and end with a soft CTA.`,
  },

  // ── EMAIL & MARKETING ────────────────────────────────────────
  {
    slug: "email-subject-line",
    name: "Email Subject Line",
    category: "Email & Marketing",
    description: "Write high-open-rate email subject lines for your newsletter.",
    icon: "📧",
    fields: [
      { name: "topic", label: "Email Content / Blog Post", type: "text", placeholder: "e.g. New post: 10 AI tools every developer needs", required: true },
      { name: "style", label: "Subject Line Style", type: "select", options: ["Mixed", "Curiosity gap", "Benefit-focused", "Numbered list", "Urgency", "Personal/conversational"] },
      { name: "count", label: "Number of Options", type: "select", options: ["5", "8", "10"] },
    ],
    systemPrompt: `You are an email marketing expert with deep knowledge of what drives opens. Write subject lines that are specific, not clickbait, and create genuine curiosity or value. Under 50 characters when possible. Include preview text suggestions.`,
    userPromptTemplate: `Write {count} email subject line options for: {topic}\nStyle: {style}\n\nInclude a suggested preview text (40-90 chars) for each. Note the character count per subject line.`,
  },
  {
    slug: "cta-writer",
    name: "Call-to-Action Writer",
    category: "Email & Marketing",
    description: "Write compelling CTAs for blog posts, landing pages, and emails.",
    icon: "👆",
    fields: [
      { name: "goal", label: "CTA Goal", type: "select", options: ["Subscribe to newsletter", "Download resource", "Read related post", "Share the article", "Leave a comment", "Try a product/tool"], required: true },
      { name: "context", label: "Page / Content Context", type: "text", placeholder: "e.g. End of a tutorial on Python web scraping" },
      { name: "count", label: "Number of Options", type: "select", options: ["3", "5"] },
    ],
    systemPrompt: `You are a conversion copywriter. Write CTAs that are action-oriented, benefit-clear, and create urgency without being pushy. Provide button text AND surrounding copy.`,
    userPromptTemplate: `Write {count} CTA variations for goal: {goal}\nContext: {context}\n\nFor each provide:\n1. Button text (2-5 words)\n2. Surrounding sentence (1-2 lines)\n3. Why it works`,
  },
  {
    slug: "aida-copy",
    name: "AIDA Copywriter",
    category: "Email & Marketing",
    description: "Write persuasive copy using the Attention-Interest-Desire-Action framework.",
    icon: "📣",
    fields: [
      { name: "product", label: "Product, Service, or Blog Post", type: "text", placeholder: "e.g. My new eBook on freelance web development", required: true },
      { name: "audience", label: "Target Audience", type: "text", placeholder: "e.g. Freelancers looking to scale their income" },
    ],
    systemPrompt: `You are a direct response copywriter using the AIDA framework. Write persuasive copy that grabs attention, builds interest, creates desire, and compels action. Label each section clearly.`,
    userPromptTemplate: `Write AIDA copy for: {product}\nAudience: {audience}\n\nStructure:\n**Attention** — Grab them immediately\n**Interest** — Build curiosity about the problem/solution\n**Desire** — Paint the outcome they want\n**Action** — Clear, specific CTA`,
  },

  // ── VIDEO CONTENT ────────────────────────────────────────────
  {
    slug: "youtube-to-blog",
    name: "YouTube to Blog Post",
    category: "Video Content",
    description: "Convert a YouTube video transcript or description into a full blog post.",
    icon: "▶️",
    fields: [
      { name: "videoTitle", label: "Video Title", type: "text", placeholder: "e.g. Building a REST API with Node.js and Express", required: true },
      { name: "transcript", label: "Transcript or Description", type: "textarea", placeholder: "Paste the video transcript, auto-captions, or a detailed description of the video content...", required: true, rows: 8 },
      { name: "keywords", label: "Target Keywords (optional)", type: "text", placeholder: "e.g. Node.js API, Express tutorial, REST API" },
      { name: "tone", label: "Blog Tone", type: "select", options: ["Informative", "Conversational", "Professional", "Enthusiastic"] },
      { name: "length", label: "Post Length", type: "select", options: ["Short (~800 words)", "Medium (~1500 words)", "Long (~2500 words)"] },
    ],
    systemPrompt: `You are an expert content repurposing specialist who transforms video content into high-quality blog posts. Convert transcripts or descriptions into well-structured, SEO-friendly articles that read naturally as written content — not a transcript. Expand on ideas, add context, and format as proper Markdown with headings, subheadings, and clear sections. Preserve all key insights from the original video but present them in a blog-native format.`,
    userPromptTemplate: `Convert the following YouTube video content into a {length} blog post.\n\nVideo Title: {videoTitle}\nTarget Keywords: {keywords}\nTone: {tone}\n\nVideo Content:\n{transcript}\n\nWrite a complete blog post that:\n1. Starts with a compelling introduction (not "In this video...")\n2. Uses clear H2/H3 headings to structure the content\n3. Expands on key points with additional context and examples\n4. Integrates the target keywords naturally\n5. Ends with a strong conclusion and CTA\n\nFormat in Markdown. Do not reference the video directly — write as original blog content.`,
    outlineSystemPrompt: `You are a content strategist who creates blog post outlines from video content. Analyse the video transcript and produce a well-structured Markdown outline that captures all key points and organises them logically for a written article. Return ONLY the outline.`,
    outlineUserPromptTemplate: `Create a blog post outline from this YouTube video content.\n\nVideo Title: {videoTitle}\nTarget Keywords: {keywords}\nTarget Length: {length}\n\nVideo Content:\n{transcript}\n\nStructure the outline as:\n# Blog Post Title (SEO-optimised, not the video title)\n## Introduction\n## [Main Section 1]\n### [Subsection if needed]\n## [Main Section 2]\n...\n## Conclusion\n\nReturn only the outline — no body content.`,
    articleWithOutlinePromptTemplate: `Write a {length} blog post based on this YouTube video content.\n\nVideo Title: {videoTitle}\nTarget Keywords: {keywords}\nTone: {tone}\n\nVideo Content:\n{transcript}\n\nFollow this outline exactly:\n{outline}\n\nWrite as original blog content — do not reference "the video" directly. Expand every section with full paragraphs, examples, and insights. Format in Markdown.`,
  },
  {
    slug: "video-title",
    name: "Video Title Generator",
    category: "Video Content",
    description: "Generate click-worthy YouTube titles for tech video content.",
    icon: "🎬",
    fields: [
      { name: "topic", label: "Video Topic", type: "text", placeholder: "e.g. Setting up a Raspberry Pi home server", required: true },
      { name: "count", label: "Number of Options", type: "select", options: ["5", "8", "10"] },
    ],
    systemPrompt: `You are a YouTube SEO and title specialist for tech channels. Write titles that are curiosity-driving, searchable, and follow proven YouTube title formulas. Under 70 characters when possible.`,
    userPromptTemplate: `Generate {count} YouTube title options for a video about: {topic}\n\nVary formulas (how-to, tutorial, beginner guide, comparison, etc). Include titles optimized for search and titles optimized for clicks.`,
  },
  {
    slug: "video-description",
    name: "Video Description",
    category: "Video Content",
    description: "Write a full YouTube video description with timestamps and links.",
    icon: "🎥",
    fields: [
      { name: "title", label: "Video Title", type: "text", placeholder: "e.g. Docker Tutorial for Beginners 2025", required: true },
      { name: "summary", label: "Video Summary / Key Points", type: "textarea", placeholder: "What does the video cover?", rows: 4 },
    ],
    systemPrompt: `You are a YouTube content strategist. Write SEO-optimized video descriptions with a compelling intro (first 2 lines visible before "more"), full content overview, timestamp placeholders, and a CTA section. Format cleanly.`,
    userPromptTemplate: `Write a YouTube video description for:\nTitle: {title}\nContent: {summary}\n\nInclude:\n- Hook first 2 lines\n- Content overview\n- Timestamps (use [00:00] placeholders)\n- Subscribe/like CTA\n- Links section placeholder`,
  },
  {
    slug: "video-script-outline",
    name: "Video Script Outline",
    category: "Video Content",
    description: "Create a structured script outline for your YouTube or tutorial video.",
    icon: "🎞️",
    fields: [
      { name: "topic", label: "Video Topic", type: "text", placeholder: "e.g. How to deploy a Next.js app to Vercel", required: true },
      { name: "duration", label: "Target Duration", type: "select", options: ["5-7 minutes", "10-12 minutes", "15-20 minutes", "30+ minutes"] },
      { name: "style", label: "Video Style", type: "select", options: ["Tutorial / walkthrough", "Explainer / educational", "Review / opinion", "Listicle / countdown"] },
    ],
    systemPrompt: `You are a YouTube video scriptwriter for tech content. Create detailed script outlines with hooks, section transitions, talking points, and engagement cues. Include timing estimates per section.`,
    userPromptTemplate: `Create a {duration} {style} video script outline for: {topic}\n\nInclude:\n- Hook (first 30 seconds)\n- Intro section\n- Main sections with talking points\n- Transitions\n- Outro with CTA\n- Estimated timing for each section`,
  },
];

export function getToolBySlug(slug: string): Tool | undefined {
  return TOOLS.find((t) => t.slug === slug);
}

export function getToolsByCategory(category: string): Tool[] {
  return TOOLS.filter((t) => t.category === category);
}

export function getAllCategories(): string[] {
  return [...new Set(TOOLS.map((t) => t.category))];
}
