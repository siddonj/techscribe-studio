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
        bg: "#f3f4f6",
        surface: "#ffffff",
        "card-alt": "#f8fafc",
        card: "#ffffff",
        border: "#d7dee7",
        accent: "#14b8a6",
        "accent-dim": "#0f766e",
        purple: "#7c3aed",
        muted: "#64748b",
        subtle: "#e2e8f0",
        status: {
          success: "#22c55e",
          warning: "#f59e0b",
          error: "#ef4444",
          info: "#0ea5e9",
          draft: "#64748b",
          published: "#8b5cf6",
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
