/**
 * HandoffCard — shared UI for structured tool result cards.
 *
 * Renders the parsed output of an upstream tool (title, summary, keywords)
 * together with a standardised action row that lets the user launch any
 * registered downstream tool pre-filled with data from this result.
 *
 * Props:
 *   parsedOutput  – structured data extracted from the raw tool output.
 *   actions       – list of HandoffAction entries for the upstream tool.
 *   fields        – current raw input field values from the upstream tool form.
 */

import Link from "next/link";
import type { ParsedToolOutput } from "@/lib/output-parsers";
import type { HandoffAction } from "@/lib/handoff-registry";
import { buildHandoffUrl } from "@/lib/handoff-registry";

interface HandoffCardProps {
  parsedOutput: ParsedToolOutput;
  actions: HandoffAction[];
  fields: Record<string, string | undefined>;
}

export default function HandoffCard({
  parsedOutput,
  actions,
  fields,
}: HandoffCardProps) {
  const { title, summary, keywords } = parsedOutput;

  return (
    <div className="mt-6 bg-subtle border border-border rounded-xl p-5 flex flex-col gap-4 max-w-3xl">
      {/* Card header: title + summary */}
      <div className="flex flex-col gap-1">
        <span className="font-mono text-[10px] text-muted uppercase tracking-widest">
          Structured Result
        </span>
        {title && (
          <p className="text-white text-sm font-medium leading-snug">{title}</p>
        )}
        {summary && (
          <p className="text-slate-400 text-sm leading-relaxed">{summary}</p>
        )}
      </div>

      {/* Keyword chips */}
      {keywords.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {keywords.map((kw) => (
            <span
              key={kw}
              className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent/80 border border-accent/20"
            >
              {kw}
            </span>
          ))}
        </div>
      )}

      {/* Action row */}
      {actions.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-border">
          <span className="font-mono text-[10px] text-muted uppercase tracking-widest">
            Launch with:
          </span>
          {actions.map((action) => (
            <Link
              key={action.targetSlug}
              href={buildHandoffUrl(action, fields, parsedOutput)}
              className="font-mono text-[11px] px-2.5 py-1 rounded-md border border-accent/30 text-accent hover:text-white hover:border-accent/60 transition-colors"
            >
              {action.label} →
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
