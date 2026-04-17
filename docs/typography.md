# Typography System

TechScribe Studio uses a three-family, eight-level typography system.
All text in the UI must be **at least 12 px** (the `text-xs` step) to meet
readability standards.

---

## Font Families

| Token            | Family              | Usage                                  |
|------------------|---------------------|----------------------------------------|
| `font-display`   | Playfair Display    | Page titles, section headings, cards   |
| `font-body`      | DM Sans             | Body copy, descriptions, labels        |
| `font-mono`      | JetBrains Mono      | Field labels, tags, badges, code       |

CSS variables (set in `:root` in `globals.css`):

```css
--font-display: 'Playfair Display', serif;
--font-body:    'DM Sans', sans-serif;
--font-mono:    'JetBrains Mono', monospace;
```

Use the Tailwind utilities `font-display`, `font-body`, and `font-mono` — not
inline `style` props — so the font choice is visible in the class list and
trivially searchable.

---

## Type Scale

The scale is defined in `tailwind.config.ts` under `theme.extend.fontSize`.
Each step pairs a size with a consistent line-height.

| Tailwind class | Size    | Line-height | Notes                        |
|----------------|---------|-------------|------------------------------|
| `text-xs`      | 12 px   | 16 px       | Minimum. Below this is off-limits. |
| `text-sm`      | 14 px   | 20 px       | Field labels, card secondary |
| `text-base`    | 16 px   | 26 px       | Primary prose                |
| `text-lg`      | 18 px   | 28 px       | Intro / hero sub-copy        |
| `text-xl`      | 20 px   | 28 px       | Card / section subheadings   |
| `text-2xl`     | 24 px   | 32 px       | Card / modal headings        |
| `text-3xl`     | 30 px   | 38 px       | Dashboard section headings   |
| `text-4xl`     | 36 px   | 44 px       | Page hero titles             |
| `text-5xl`     | 48 px   | 56 px       | Marketing / display only     |

---

## Semantic Utility Classes

Rather than composing raw Tailwind utilities everywhere, prefer these
semantic classes (defined in `globals.css` under `@layer components`).
They lock in the correct font-family, size, and line-height together.

| Class             | Family    | Size  | Typical usage                      |
|-------------------|-----------|-------|------------------------------------|
| `.type-display`   | Display   | 36 px | Page hero titles (`<h1>`)          |
| `.type-heading`   | Display   | 24 px | Card / modal headings (`<h2>`)     |
| `.type-subheading`| Display   | 20 px | Section / sidebar headings (`<h3>`)|
| `.type-body`      | Body      | 16 px | Primary prose paragraphs           |
| `.type-body-sm`   | Body      | 14 px | Card descriptions, secondary text  |
| `.type-label`     | Mono      | 12 px | Field labels, section caps (ALL CAPS + tracking) |
| `.type-meta`      | Body      | 12 px | Timestamps, word counts, hints     |
| `.type-chip`      | Mono      | 12 px | Tag chips, status badges           |

### Example usage

```tsx
<h1 className="type-display mb-5">TechScribe Studio</h1>

<h2 className="type-heading mb-4">Content Calendar</h2>

<label className="type-label mb-1.5">Site URL</label>

<p className="type-body-sm text-slate-200">
  Organize backlog ideas and scheduled drafts in one place.
</p>

<span className="type-chip border border-accent/20 text-accent/80 bg-accent/10 px-2 py-0.5 rounded-full">
  keyword
</span>
```

---

## Rules & Constraints

1. **Minimum size is 12 px.** Never use `text-[9px]`, `text-[10px]`, or
   `text-[11px]`. Use `text-xs` instead.
2. **No inline font-family styles.** Use `font-display`, `font-body`, or
   `font-mono` Tailwind utilities.
3. **Headings use `font-display`** (Playfair Display). Regular body text and
   UI labels do not.
4. **All-caps labels and badges use `font-mono`** with `tracking-wider` or
   `tracking-widest`.
5. **Extend via the scale** — if a new step is needed, add it to the
   `fontSize` block in `tailwind.config.ts` and document it here.

---

## Markdown Output

The `.markdown-output` class in `globals.css` adds prose styles for
AI-generated content. It follows the same family rules:
- Headings (`h1`–`h3`) → `font-family: var(--font-display)`
- Code blocks → `font-family: var(--font-mono)`
- Body text → default body font

---

## Zoom & Mobile Readability

- All interactive text is `≥ 14 px` (`text-sm`).
- The minimum 12 px (`text-xs`) is reserved for decorative / non-interactive
  labels and badges.
- At 200% zoom the scale remains readable because line-heights scale with
  `rem` units.
- On mobile, font sizes are unchanged — the layout shifts to a single column
  which provides sufficient line width without needing to increase sizes.
