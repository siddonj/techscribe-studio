import { NextRequest, NextResponse } from "next/server";
import { requireApprovedSession } from "@/lib/auth";

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

function countLinks(text: string): number {
  // Count all URLs (both markdown and bare) by matching the protocol prefix.
  // This avoids backtracking-prone nested quantifiers while still giving an
  // accurate count for the SEO check.
  return (text.match(/https?:\/\//g) ?? []).length;
}

function countSyllables(word: string): number {
  // Syllable count uses a vowel-group heuristic — results are approximations
  // and may be off for irregular English words (e.g. words ending in '-le',
  // compound words, or words with silent vowel clusters).
  const cleaned = word.toLowerCase().replace(/[^a-z]/g, "");
  if (cleaned.length === 0) return 0;
  if (cleaned.length <= 3) return 1;
  // Remove silent trailing 'e'
  const withoutSilentE = cleaned.replace(/e$/, "");
  // Count vowel groups
  const groups = withoutSilentE.match(/[aeiouy]+/g);
  return Math.max(1, groups ? groups.length : 1);
}

function countSentences(text: string): number {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  return Math.max(1, sentences.length);
}

function computeFleschKincaid(text: string): { score: number; grade: string } {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const sentenceCount = countSentences(text);
  const syllableCount = words.reduce((sum, w) => sum + countSyllables(w), 0);

  if (wordCount === 0) return { score: 0, grade: "N/A" };

  const asl = wordCount / sentenceCount;
  const asw = syllableCount / wordCount;
  const raw = 206.835 - 1.015 * asl - 84.6 * asw;
  const score = Math.max(0, Math.min(100, Math.round(raw)));

  let grade: string;
  if (score >= 90) grade = "Very Easy";
  else if (score >= 80) grade = "Easy";
  else if (score >= 70) grade = "Fairly Easy";
  else if (score >= 60) grade = "Standard";
  else if (score >= 50) grade = "Fairly Difficult";
  else if (score >= 30) grade = "Difficult";
  else grade = "Very Difficult";

  return { score, grade };
}

function getFirstNWords(text: string, n: number): string {
  return text.trim().split(/\s+/).slice(0, n).join(" ");
}

function buildChecks(title: string, output: string, focusKeyword: string): SeoCheck[] {
  const wordCount = countWords(output);
  const headingCount = countHeadings(output);
  const paragraphCount = countParagraphs(output);
  const keywordMatches = countMatches(output, focusKeyword);
  const titleMatches = countMatches(title, focusKeyword);
  const keywordDensity = wordCount > 0 ? (keywordMatches / wordCount) * 100 : 0;
  const titleLength = title.length;
  const introText = getFirstNWords(output, 100);
  const introKeywordMatches = countMatches(introText, focusKeyword);
  const linkCount = countLinks(output);
  const hasCta = /(subscribe|comment|share|read next|try|download|book|contact)/i.test(output);
  const { score: readabilityScore, grade: readabilityGrade } = computeFleschKincaid(output);

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
      weight: 14,
    },
    {
      id: "title-length",
      label: "Title length is optimal (50–60 characters)",
      passed: titleLength >= 50 && titleLength <= 60,
      detail:
        titleLength < 50
          ? `Title is ${titleLength} characters. Aim for 50–60 to maximize SERP visibility.`
          : titleLength > 60
            ? `Title is ${titleLength} characters. Trim to 60 or fewer to avoid truncation in search results.`
            : `Title is ${titleLength} characters — well within the optimal range.`,
      weight: 8,
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
      weight: 16,
    },
    {
      id: "keyword-intro",
      label: "Focus keyword appears in the introduction",
      passed: !focusKeyword || introKeywordMatches > 0,
      detail: focusKeyword
        ? introKeywordMatches > 0
          ? "Keyword found in the first 100 words — strong signal for search engines."
          : "Add the focus keyword within the first 100 words to establish early relevance."
        : "Set a focus keyword to check intro placement.",
      weight: 8,
    },
    {
      id: "keyword-density",
      label: "Keyword density stays in safe range",
      passed: !focusKeyword || (keywordDensity >= 0.5 && keywordDensity <= 2.5),
      detail: focusKeyword
        ? `Current density: ${keywordDensity.toFixed(2)}% (recommended 0.5% - 2.5%).`
        : "Density check skipped until a focus keyword is set.",
      weight: 10,
    },
    {
      id: "word-count",
      label: "Word count supports ranking depth",
      passed: wordCount >= 900,
      detail: wordCount >= 900
        ? `Word count is ${wordCount}, which is suitable for long-form ranking.`
        : `Word count is ${wordCount}. Expand with examples and FAQs toward 900+ words.`,
      weight: 13,
    },
    {
      id: "heading-coverage",
      label: "Clear heading structure",
      passed: headingCount >= 4,
      detail: headingCount >= 4
        ? `Detected ${headingCount} headings.`
        : `Only ${headingCount} headings detected. Add more H2/H3 sections for scanability.`,
      weight: 10,
    },
    {
      id: "paragraph-flow",
      label: "Readable paragraph flow",
      passed: paragraphCount >= 8,
      detail: paragraphCount >= 8
        ? `Detected ${paragraphCount} paragraph blocks.`
        : `Only ${paragraphCount} paragraphs detected. Break long sections into smaller chunks.`,
      weight: 7,
    },
    {
      id: "has-links",
      label: "Article contains outbound links",
      passed: linkCount >= 1,
      detail: linkCount >= 1
        ? `Found ${linkCount} link(s). Outbound links to authoritative sources help build credibility.`
        : "No outbound links detected. Add at least one link to a credible source.",
      weight: 4,
    },
    {
      id: "cta-presence",
      label: "Conclusion includes CTA language",
      passed: hasCta,
      detail: hasCta
        ? "CTA language detected."
        : "Add a stronger CTA in the final section.",
      weight: 10,
    },
    {
      id: "readability",
      label: "Content is readable (Flesch-Kincaid ≥ 50)",
      passed: readabilityScore >= 50,
      detail: `Flesch-Kincaid reading ease: ${readabilityScore}/100 — ${readabilityGrade}. ${
        readabilityScore >= 50
          ? "Content is accessible to a broad audience."
          : "Simplify sentences and use shorter words to improve readability."
      }`,
      weight: 8,
    },
  ];
}

export async function POST(req: NextRequest) {
  const auth = await requireApprovedSession();
  if ("error" in auth) return auth.error;

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
    const wordCount = countWords(output);
    const { score: readabilityScore, grade: readabilityGrade } = computeFleschKincaid(output);

    return NextResponse.json({
      score,
      checks,
      suggestions: failingChecks.map((check) => check.detail),
      wordCount,
      readabilityScore,
      readabilityGrade,
      analyzedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("SEO analyze error:", error);
    return NextResponse.json({ error: "Failed to analyze content" }, { status: 500 });
  }
}
