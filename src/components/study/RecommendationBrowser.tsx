"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { cn, classBadgeVariant, loeBadgeVariant } from "@/lib/utils";
import BookmarkButton from "@/components/BookmarkButton";

interface Recommendation {
  id: string;
  recommendation_number: number;
  class: string;
  loe: string;
  original_text: string;
  rephrased_text: string;
  explanation: string;
  mini_vignette: string;
}

interface Props {
  guideline: { id: string; name: string; slug: string };
  recommendations: Recommendation[];
  initialProgress: Record<string, string>;
  initialIndex?: number;
}

type FilterClass = "all" | "I" | "IIa" | "IIb" | "III";

export default function RecommendationBrowser({ guideline, recommendations, initialProgress, initialIndex = 0 }: Props) {
  const [current, setCurrent] = useState(initialIndex);
  const [progress, setProgress] = useState<Record<string, string>>(initialProgress);
  const [expanded, setExpanded] = useState<"rephrased" | "explanation" | "vignette" | null>(null);
  const [filterClass, setFilterClass] = useState<FilterClass>("all");

  const filtered = filterClass === "all"
    ? recommendations
    : recommendations.filter((r) => r.class === filterClass);

  const rec = filtered[current];

  async function markStatus(status: "known" | "needs_review") {
    if (!rec) return;
    const supabase = createClient();
    await supabase.from("user_progress").upsert(
      {
        item_type: "recommendation",
        item_id: rec.id,
        status,
        last_seen_at: new Date().toISOString(),
        next_review_at:
          status === "known"
            ? new Date(Date.now() + 7 * 86400000).toISOString()
            : new Date(Date.now() + 86400000).toISOString(),
      },
      { onConflict: "user_id,item_type,item_id" }
    );
    setProgress((p) => ({ ...p, [rec.id]: status }));
    if (current < filtered.length - 1) {
      setCurrent((c) => c + 1);
      setExpanded(null);
    }
  }

  const CLASS_FILTERS: FilterClass[] = ["all", "I", "IIa", "IIb", "III"];

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 flex flex-col min-h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Link
          href={`/guidelines/${guideline.slug}`}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {guideline.name}
        </Link>
        <span className="text-sm text-slate-400">
          {filtered.length > 0 ? current + 1 : 0} / {filtered.length}
        </span>
      </div>

      {/* Class filter */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
        {CLASS_FILTERS.map((cls) => (
          <button
            key={cls}
            onClick={() => { setFilterClass(cls); setCurrent(0); setExpanded(null); }}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
              filterClass === cls
                ? "bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
            )}
          >
            {cls === "all" ? "All classes" : `Class ${cls}`}
          </button>
        ))}
      </div>

      {/* Progress bar */}
      {filtered.length > 0 && (
        <div className="h-1 bg-slate-100 dark:bg-slate-800 rounded-full mb-4">
          <div
            className="h-full bg-blue-500 rounded-full transition-all"
            style={{ width: `${((current + 1) / filtered.length) * 100}%` }}
          />
        </div>
      )}

      {!rec ? (
        <div className="card flex-1 flex items-center justify-center text-slate-400 text-sm">
          No recommendations found for this filter.
        </div>
      ) : (
        <div className="card flex-1 overflow-y-auto">
          {/* Badges + bookmark */}
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <div className="flex items-center gap-2">
              <span className={cn("text-xs px-2.5 py-1 rounded-full font-semibold", classBadgeVariant(rec.class))}>
                Class {rec.class}
              </span>
              <span className={cn("text-xs px-2.5 py-1 rounded-full font-semibold", loeBadgeVariant(rec.loe))}>
                LOE {rec.loe}
              </span>
            </div>
            <BookmarkButton itemType="recommendation" itemId={rec.id} />
          </div>

          {/* Original text */}
          <div className="px-4 py-3">
            <p className="text-slate-800 dark:text-slate-200 text-sm leading-relaxed font-medium">
              {rec.original_text}
            </p>
          </div>

          {/* Expandable sections */}
          <div className="px-4 pb-4 space-y-2 border-t pt-3">
            {[
              { key: "rephrased" as const, label: "Plain English", content: rec.rephrased_text },
              { key: "explanation" as const, label: "Clinical reasoning", content: rec.explanation },
              { key: "vignette" as const, label: "Clinical vignette", content: rec.mini_vignette },
            ].map(({ key, label, content }) =>
              content ? (
                <div key={key}>
                  <button
                    onClick={() => setExpanded(expanded === key ? null : key)}
                    className="flex items-center justify-between w-full text-left py-2"
                  >
                    <span className="text-sm font-medium text-blue-600 dark:text-blue-400">{label}</span>
                    <svg
                      className={cn("w-4 h-4 text-slate-400 transition-transform", expanded === key && "rotate-180")}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {expanded === key && (
                    <div className="pb-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3">
                      {content}
                    </div>
                  )}
                </div>
              ) : null
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 mt-4">
        <button onClick={() => markStatus("needs_review")} className="flex-1 btn-secondary">
          Needs Review
        </button>
        <button onClick={() => markStatus("known")} className="flex-1 btn-primary">
          Got it →
        </button>
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-3">
        <button
          onClick={() => { setCurrent((c) => Math.max(0, c - 1)); setExpanded(null); }}
          disabled={current === 0}
          className="text-sm text-slate-400 hover:text-slate-600 disabled:opacity-30 transition-colors"
        >
          ← Previous
        </button>
        <button
          onClick={() => { setCurrent((c) => Math.min(filtered.length - 1, c + 1)); setExpanded(null); }}
          disabled={current >= filtered.length - 1}
          className="text-sm text-slate-400 hover:text-slate-600 disabled:opacity-30 transition-colors"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
