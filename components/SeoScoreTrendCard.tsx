"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

interface HistoryRowLite {
  id: number;
  created_at: string;
  seo_score?: number | null;
}

interface HistoryListResponse {
  rows: HistoryRowLite[];
}

function toDayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function SeoScoreTrendCard() {
  const [rows, setRows] = useState<HistoryRowLite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/history?limit=250");
        if (!res.ok) {
          throw new Error("Failed to load history");
        }

        const data = (await res.json()) as HistoryListResponse;
        setRows(data.rows ?? []);
      } catch {
        setRows([]);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const summary = useMemo(() => {
    const scoredRows = rows
      .filter((row) => typeof row.seo_score === "number")
      .sort((left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime());

    if (scoredRows.length === 0) {
      return {
        average: null as number | null,
        trendDelta: null as number | null,
        trendLabel: "No data",
        sparkPoints: [] as number[],
        latestLabel: "No scored drafts yet",
      };
    }

    const scores = scoredRows.map((row) => row.seo_score as number);
    const average = Math.round(scores.reduce((acc, score) => acc + score, 0) / scores.length);
    const splitIndex = Math.max(1, Math.floor(scores.length / 2));
    const firstHalf = scores.slice(0, splitIndex);
    const secondHalf = scores.slice(splitIndex);
    const firstAvg = Math.round(firstHalf.reduce((acc, score) => acc + score, 0) / firstHalf.length);
    const secondAvg = secondHalf.length
      ? Math.round(secondHalf.reduce((acc, score) => acc + score, 0) / secondHalf.length)
      : firstAvg;
    const trendDelta = secondAvg - firstAvg;

    return {
      average,
      trendDelta,
      trendLabel: trendDelta > 0 ? "Improving" : trendDelta < 0 ? "Declining" : "Stable",
      sparkPoints: scores.slice(-10),
      latestLabel: `${toDayLabel(scoredRows[scoredRows.length - 1].created_at)} latest score`,
    };
  }, [rows]);

  const sparklinePath = useMemo(() => {
    const points = summary.sparkPoints;
    if (points.length < 2) {
      return "";
    }

    const width = 220;
    const height = 60;
    const max = Math.max(...points, 100);
    const min = Math.min(...points, 0);
    const spread = Math.max(1, max - min);

    return points
      .map((point, index) => {
        const x = (index / (points.length - 1)) * width;
        const y = height - ((point - min) / spread) * height;
        return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [summary.sparkPoints]);

  return (
    <div className="shell-panel rounded-[1.75rem] p-5">
      <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-slate-500">SEO Score Trend</p>
      {loading ? (
        <p className="text-sm text-slate-500 mt-3">Loading score trend...</p>
      ) : summary.average === null ? (
        <p className="text-sm text-slate-500 mt-3">Run SEO analysis on at least one draft to populate trend data.</p>
      ) : (
        <>
          <div className="mt-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-4xl text-white" style={{ fontFamily: "var(--font-display)" }}>
                {summary.average}
              </p>
              <p className="text-xs text-slate-500 mt-1">Average score across scored drafts</p>
            </div>
            <div className="text-right">
              <p className={`text-sm font-semibold ${summary.trendDelta && summary.trendDelta < 0 ? "text-amber-600" : "text-emerald-500"}`}>
                {summary.trendDelta && summary.trendDelta > 0 ? "+" : ""}{summary.trendDelta ?? 0} pts
              </p>
              <p className="text-xs text-slate-500">{summary.trendLabel}</p>
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-border bg-white/[0.03] p-3">
            {sparklinePath ? (
              <svg viewBox="0 0 220 60" className="w-full h-14">
                <path d={sparklinePath} fill="none" stroke="currentColor" strokeWidth="2" className="text-accent" />
              </svg>
            ) : (
              <p className="text-xs text-slate-500">Need at least two scores to draw a trend line.</p>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-[11px] text-slate-500">{summary.latestLabel}</p>
            <Link
              href="/history?status=seo-scored&sort=newest"
              className="text-xs font-mono text-accent hover:text-accent-dim transition-colors"
            >
              Open scored history
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
