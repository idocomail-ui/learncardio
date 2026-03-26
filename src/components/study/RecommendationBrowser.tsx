"use client";

import { useState, useEffect, useCallback } from "react";
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

type StatusFilter = "all" | "unseen" | "needs_review" | "known";
type ClassFilter = "all" | "I" | "IIa" | "IIb" | "III";

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unseen", label: "Unseen" },
  { key: "needs_review", label: "Review" },
  { key: "known", label: "Known" },
];

export default function RecommendationBrowser({ guideline, recommendations, initialProgress, initialIndex = 0 }: Props) {
  const [progress, setProgress] = useState<Record<string, string>>(initialProgress);
  const [expanded, setExpanded] = useState<"rephrased" | "explanation" | "vignette" | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [classFilter, setClassFilter] = useState<ClassFilter>("all");
  const [sessionCounts, setSessionCounts] = useState({ known: 0, review: 0 });
  const [showSummary, setShowSummary] = useState(false);

  const filtered = recommendations.filter((r) => {
    const statusMatch = statusFilter === "all" || (progress[r.id] ?? "unseen") === statusFilter;
    const classMatch = classFilter === "all" || r.class === classFilter;
    return statusMatch && classMatch;
  });

  const [current, setCurrent] = useState(initialIndex);
  const rec = filtered[current];

  const markStatus = useCallback(async (status: "known" | "needs_review") => {
    if (!rec) return;
    const supabase = createClient();
    await supabase.from("user_progress").upsert(
      {
        item_type: "recommendation",
        item_id: rec.id,
        status,
        last_seen_at: new Date().toISOString(),
        next_review_at: status === "known"
          ? new Date(Date.now() + 7 * 86400000).toISOString()
          : new Date(Date.now() + 86400000).toISOString(),
      },
      { onConflict: "user_id,item_type,item_id" }
    );
    setProgress((p) => ({ ...p, [rec.id]: status }));
    setSessionCounts((s) => ({
      known: s.known + (status === "known" ? 1 : 0),
      review: s.review + (status === "needs_review" ? 1 : 0),
    }));
    window.dispatchEvent(new Event("progress-updated"));
    if (current < filtered.length - 1) {
      setCurrent((c) => c + 1);
      setExpanded(null);
    } else {
      setShowSummary(true);
    }
  }, [rec, current, filtered.length]);

  async function resetItem() {
    if (!rec) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("user_progress")
      .delete()
      .eq("item_type", "recommendation")
      .eq("item_id", rec.id)
      .eq("user_id", user.id);
    setProgress((p) => { const n = { ...p }; delete n[rec.id]; return n; });
    window.dispatchEvent(new Event("progress-updated"));
  }

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key) {
        case "ArrowRight": case "ArrowDown":
          setCurrent((c) => Math.min(filtered.length - 1, c + 1)); setExpanded(null); break;
        case "ArrowLeft": case "ArrowUp":
          setCurrent((c) => Math.max(0, c - 1)); setExpanded(null); break;
        case " ": case "k": case "K":
          e.preventDefault(); markStatus("known"); break;
        case "r": case "R":
          markStatus("needs_review"); break;
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [markStatus, filtered.length]);

  if (showSummary) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="text-4xl">✓</div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Session complete</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          {sessionCounts.known + sessionCounts.review} recommendations reviewed
        </p>
        <div className="flex justify-center gap-6 text-sm">
          <span className="text-green-600 font-semibold">{sessionCounts.known} known</span>
          <span className="text-amber-600 font-semibold">{sessionCounts.review} needs review</span>
        </div>
        <div className="flex gap-3 justify-center pt-2">
          <button onClick={() => { setShowSummary(false); setCurrent(0); setSessionCounts({ known: 0, review: 0 }); setExpanded(null); }} className="btn-secondary text-sm px-4 py-2">
            Continue
          </button>
          <Link href={`/guidelines/${guideline.slug}`} className="btn-primary text-sm px-4 py-2">
            Back to guideline
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 flex flex-col min-h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
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

      {/* Status filter */}
      <div className="flex gap-1.5 mb-2">
        {STATUS_FILTERS.map(({ key, label }) => {
          const count = key === "all"
            ? recommendations.length
            : recommendations.filter((r) => (progress[r.id] ?? "unseen") === key).length;
          return (
            <button
              key={key}
              onClick={() => { setStatusFilter(key); setCurrent(0); setExpanded(null); }}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
                statusFilter === key
                  ? "bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
              )}
            >
              {label} <span className="opacity-60">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Class filter */}
      <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
        {(["all", "I", "IIa", "IIb", "III"] as ClassFilter[]).map((cls) => (
          <button
            key={cls}
            onClick={() => { setClassFilter(cls); setCurrent(0); setExpanded(null); }}
            className={cn(
              "px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
              classFilter === cls
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
        <div className="h-1 bg-slate-100 dark:bg-slate-800 rounded-full mb-3">
          <div
            className="h-full bg-blue-500 rounded-full transition-all"
            style={{ width: `${((current + 1) / filtered.length) * 100}%` }}
          />
        </div>
      )}

      {!rec ? (
        <div className="card flex-1 flex items-center justify-center text-slate-400 text-sm">
          No recommendations in this filter.
        </div>
      ) : (
        <div className="card flex-1 overflow-y-auto">
          {/* Badges + status + bookmark */}
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn("text-xs px-2.5 py-1 rounded-full font-semibold", classBadgeVariant(rec.class))}>
                Class {rec.class}
              </span>
              <span className={cn("text-xs px-2.5 py-1 rounded-full font-semibold", loeBadgeVariant(rec.loe))}>
                LOE {rec.loe}
              </span>
              {(progress[rec.id] ?? "unseen") !== "unseen" && (
                <span className={cn(
                  "text-xs px-2 py-0.5 rounded-full font-medium",
                  progress[rec.id] === "known" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                )}>
                  {progress[rec.id] === "known" ? "Known" : "Review"}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {(progress[rec.id] ?? "unseen") !== "unseen" && (
                <button onClick={resetItem} title="Reset progress" className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
                  ↺
                </button>
              )}
              <BookmarkButton itemType="recommendation" itemId={rec.id} />
            </div>
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
                    <svg className={cn("w-4 h-4 text-slate-400 transition-transform", expanded === key && "rotate-180")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <button onClick={() => markStatus("needs_review")} className="flex-1 btn-secondary text-sm">
          Needs Review <span className="text-xs opacity-50">[R]</span>
        </button>
        <button onClick={() => markStatus("known")} className="flex-1 btn-primary text-sm">
          Got it → <span className="text-xs opacity-60">[Space]</span>
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
