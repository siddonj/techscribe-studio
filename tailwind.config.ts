import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#08090e",
        surface: "#0f1018",
        card: "#13141f",
        "card-alt": "#191b2c",
        border: "#2a2d40",
        accent: "#00e5ff",
        "accent-dim": "#00b8cc",
        purple: "#7c3aed",
        muted: "#64748b",
        subtle: "#252840",
        // Semantic status colors
        status: {
          success: "#4ade80",   // green-400  — content ready / linked
          warning: "#fbbf24",   // amber-400  — in-progress / due soon
          error: "#f87171",     // red-400    — failed / overdue
          info: "#38bdf8",      // sky-400    — planned / info
          draft: "#94a3b8",     // slate-400  — backlog / unpublished
          published: "#e879f9", // fuchsia-400 — live content
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      // Typography scale — each step pairs a font-size with a consistent line-height.
      // Minimum rendered size is 12px (text-xs) to meet readability standards.
      fontSize: {
        // Meta / chips / decorative labels — 12px / 16px
        xs:   ["0.75rem",  { lineHeight: "1rem" }],
        // Field labels, secondary UI, compact body — 14px / 20px
        sm:   ["0.875rem", { lineHeight: "1.25rem" }],
        // Primary body copy — 16px / 26px (slightly looser for prose comfort)
        base: ["1rem",     { lineHeight: "1.625rem" }],
        // Large body / intro paragraphs — 18px / 28px
        lg:   ["1.125rem", { lineHeight: "1.75rem" }],
        // Card / section subheadings — 20px / 28px
        xl:   ["1.25rem",  { lineHeight: "1.75rem" }],
        // Card / modal headings — 24px / 32px
        "2xl": ["1.5rem",  { lineHeight: "2rem" }],
        // Section headings (dashboard) — 30px / 38px
        "3xl": ["1.875rem", { lineHeight: "2.375rem" }],
        // Page hero titles — 36px / 44px
        "4xl": ["2.25rem", { lineHeight: "2.75rem" }],
        // Display / marketing titles — 48px / 56px
        "5xl": ["3rem",    { lineHeight: "3.5rem" }],
      },
    },
  },
  plugins: [],
};
export default config;
