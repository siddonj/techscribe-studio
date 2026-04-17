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
    },
  },
  plugins: [],
};
export default config;
