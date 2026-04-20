import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

interface SeoCheck {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
  weight: number;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function countHeadings(text: string): number {
  return text.split("\n").filter((line) => /^#{1,3}\s+/.test(line.trim())).length;
}

function countParagraphs(text: string): number {
  return text.split(/\n\s*\n/).map((chunk) => chunk.trim()).filter(Boolean).length;
}

function countMatches(content: string, needle: string): number {
  if (!needle.trim()) {
    return 0;
  }

  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`\\b${escaped}\\b`, "gi");
  return (content.match(regex) || []).length;
}

function buildChecks(title: string, output: string, focusKeyword: string): SeoCheck[] {
  const wordCount = countWords(output);
  const headingCount = countHeadings(output);
  const paragraphCount = countParagraphs(output);
  const keywordMatches = countMatches(output, focusKeyword);
  const titleMatches = countMatches(title, focusKeyword);
  const keywordDensity = wordCount > 0 ? (keywordMatches / wordCount) * 100 : 0;

  return [
    {
      id: "title-keyword",
      label: "Focus keyword appears in title",
      passed: !focusKeyword || titleMatches > 0,
      detail: focusKeyword
        ? titleMatches > 0
          ? "Great: title aligns with target keyword intent."
          : "Add the focus keyword to the title for stronger relevance."
        : "No focus keyword provided yet.",
      weight: 18,
    },
    {
      id: "keyword-usage",
      label: "Focus keyword appears in article body",
      passed: !focusKeyword || keywordMatches >= 3,
      detail: focusKeyword
        ? keywordMatches >= 3
          ? `Keyword used ${keywordMatches} times.`
          : `Keyword appears only ${keywordMatches} time(s). Target at least 3 natural mentions.`
        : "Set a focus keyword to score keyword usage.",
      weight: 20,
    },
    {
      id: "keyword-density",
      label: "Keyword density stays in safe range",
      passed: !focusKeyword || (keywordDensity >= 0.5 && keywordDensity <= 2.5),
      detail: focusKeyword
        ? `Current density: ${keywordDensity.toFixed(2)}% (recommended 0.5% - 2.5%).`
        : "Density check skipped until a focus keyword is set.",
      weight: 12,
    },
    {
      id: "word-count",
      label: "Word count supports ranking depth",
      passed: wordCount >= 900,
      detail: wordCount >= 900
        ? `Word count is ${wordCount}, which is suitable for long-form ranking.`
        : `Word count is ${wordCount}. Expand with examples and FAQs toward 900+ words.`,
      weight: 15,
    },
    {
      id: "heading-coverage",
      label: "Clear heading structure",
      passed: headingCount >= 4,
      detail: headingCount >= 4
        ? `Detected ${headingCount} headings.`
        : `Only ${headingCount} headings detected. Add more H2/H3 sections for scanability.`,
      weight: 12,
    },
    {
      id: "paragraph-flow",
      label: "Readable paragraph flow",
      passed: paragraphCount >= 8,
      detail: paragraphCount >= 8
        ? `Detected ${paragraphCount} paragraph blocks.`
        : `Only ${paragraphCount} paragraphs detected. Break long sections into smaller chunks.`,
      weight: 9,
    },
    {
      id: "cta-presence",
      label: "Conclusion includes CTA language",
      passed: /(subscribe|comment|share|read next|try|download|book|contact)/i.test(output),
      detail: /(subscribe|comment|share|read next|try|download|book|contact)/i.test(output)
        ? "CTA language detected."
        : "Add a stronger CTA in the final section.",
      weight: 14,
    },
  ];
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      title?: string;
      output?: string;
      focusKeyword?: string;
    };

    const title = String(body.title ?? "").trim();
    const output = String(body.output ?? "").trim();
    const focusKeyword = String(body.focusKeyword ?? "").trim();

    if (!title || !output) {
      return NextResponse.json({ error: "Title and output are required" }, { status: 400 });
    }

    const checks = buildChecks(title, output, focusKeyword);
    const score = Math.max(
      0,
      Math.min(
        100,
        Math.round(checks.reduce((total, check) => total + (check.passed ? check.weight : 0), 0))
      )
    );

    const failingChecks = checks.filter((check) => !check.passed);

    return NextResponse.json({
      score,
      checks,
      suggestions: failingChecks.map((check) => check.detail),
      analyzedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("SEO analyze error:", error);
    return NextResponse.json({ error: "Failed to analyze content" }, { status: 500 });
  }
}
