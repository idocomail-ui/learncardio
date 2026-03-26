"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import BookmarkButton from "@/components/BookmarkButton";

interface Figure {
  id: string;
  figure_number: number;
  image_url: string;
  caption_original: string;
  caption_explanation: string;
  page_number: number;
}

interface Props {
  guideline: { id: string; name: string; slug: string };
  figures: Figure[];
  initialProgress: Record<string, string>;
  initialIndex?: number;
}

type StatusFilter = "all" | "unseen" | "needs_review" | "known";

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unseen", label: "Unseen" },
  { key: "needs_review", label: "Review" },
  { key: "known", label: "Known" },
];

export default function FigureBrowser({ guideline, figures, initialProgress, initialIndex = 0 }: Props) {
  const [progress, setProgress] = useState<Record<string, string>>(initialProgress);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sessionCounts, setSessionCounts] = useState({ known: 0, review: 0 });
  const [showSummary, setShowSummary] = useState(false);

  const filtered = figures.filter((fig) => {
    if (statusFilter === "all") return true;
    return (progress[fig.id] ?? "unseen") === statusFilter;
  });

  const [current, setCurrent] = useState(() => {
    const idx = filtered.findIndex((f) => f === figures[initialIndex]);
    return Math.max(0, idx);
  });

  const figure = filtered[current];
  const figureStatus = figure ? (progress[figure.id] ?? "unseen") : "unseen";

  const markStatus = useCallback(async (status: "known" | "needs_review") => {
    if (!figure) return;
    const supabase = createClient();
    await supabase.from("user_progress").upsert(
      {
        item_type: "figure",
        item_id: figure.id,
        status,
        last_seen_at: new Date().toISOString(),
        next_review_at: status === "known"
          ? new Date(Date.now() + 7 * 86400000).toISOString()
          : new Date(Date.now() + 86400000).toISOString(),
      },
      { onConflict: "user_id,item_type,item_id" }
    );
    setProgress((p) => ({ ...p, [figure.id]: status }));
    setSessionCounts((s) => ({
      known: s.known + (status === "known" ? 1 : 0),
      review: s.review + (status === "needs_review" ? 1 : 0),
    }));
    window.dispatchEvent(new Event("progress-updated"));
    if (current < filtered.length - 1) {
      setCurrent((c) => c + 1);
    } else {
      setShowSummary(true);
    }
  }, [figure, current, filtered.length]);

  async function resetItem() {
    if (!figure) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("user_progress")
      .delete()
      .eq("item_type", "figure")
      .eq("item_id", figure.id)
      .eq("user_id", user.id);
    setProgress((p) => { const n = { ...p }; delete n[figure.id]; return n; });
    window.dispatchEvent(new Event("progress-updated"));
  }

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key) {
        case "ArrowRight": case "ArrowDown":
          setCurrent((c) => Math.min(filtered.length - 1, c + 1)); break;
        case "ArrowLeft": case "ArrowUp":
          setCurrent((c) => Math.max(0, c - 1)); break;
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
          {sessionCounts.known + sessionCounts.review} figures reviewed
        </p>
        <div className="flex justify-center gap-6 text-sm">
          <span className="text-green-600 font-semibold">{sessionCounts.known} known</span>
          <span className="text-amber-600 font-semibold">{sessionCounts.review} needs review</span>
        </div>
        <div className="flex gap-3 justify-center pt-2">
          <button onClick={() => { setShowSummary(false); setCurrent(0); setSessionCounts({ known: 0, review: 0 }); }} className="btn-secondary text-sm px-4 py-2">
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
    <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          href={`/guidelines/${guideline.slug}`}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {guideline.name}
        </Link>
        <span className="text-sm text-slate-400">{filtered.length > 0 ? current + 1 : 0} / {filtered.length}</span>
      </div>

      {/* Status filter */}
      <div className="flex gap-1.5">
        {STATUS_FILTERS.map(({ key, label }) => {
          const count = key === "all"
            ? figures.length
            : figures.filter((f) => (progress[f.id] ?? "unseen") === key).length;
          return (
            <button
              key={key}
              onClick={() => { setStatusFilter(key); setCurrent(0); }}
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

      {/* Progress bar */}
      <div className="h-1 bg-slate-100 rounded-full">
        <div
          className="h-full bg-blue-500 rounded-full transition-all"
          style={{ width: filtered.length > 0 ? `${((current + 1) / filtered.length) * 100}%` : "0%" }}
        />
      </div>

      {!figure ? (
        <div className="card flex items-center justify-center py-16 text-slate-400 text-sm">
          No figures in this filter.
        </div>
      ) : (
        <div className="card overflow-hidden">
          {/* Title bar */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-slate-50 dark:bg-slate-800/50">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">Figure {figure.figure_number}</span>
              {figureStatus !== "unseen" && (
                <span className={cn(
                  "text-xs px-2 py-0.5 rounded-full font-medium",
                  figureStatus === "known" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                )}>
                  {figureStatus === "known" ? "Known" : "Review"}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {figureStatus !== "unseen" && (
                <button
                  onClick={resetItem}
                  title="Reset progress for this figure"
                  className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                >
                  ↺
                </button>
              )}
              <BookmarkButton itemType="figure" itemId={figure.id} />
            </div>
          </div>

          {/* Figure image */}
          {figure.image_url && (
            <div className="bg-white">
              <Image
                src={figure.image_url}
                alt={`Figure ${figure.figure_number}`}
                width={800}
                height={600}
                className="w-full h-auto"
                priority
              />
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={() => markStatus("needs_review")} className="flex-1 btn-secondary text-sm">
          <span className="hidden sm:inline">Needs Review </span><span className="text-xs opacity-50">[R]</span>
        </button>
        <button onClick={() => markStatus("known")} className="flex-1 btn-primary text-sm">
          Got it → <span className="text-xs opacity-60">[Space]</span>
        </button>
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={() => setCurrent((c) => Math.max(0, c - 1))}
          disabled={current === 0}
          className="text-sm text-slate-400 hover:text-slate-600 disabled:opacity-30 transition-colors"
        >
          ← Previous
        </button>
        <button
          onClick={() => setCurrent((c) => Math.min(filtered.length - 1, c + 1))}
          disabled={current >= filtered.length - 1}
          className="text-sm text-slate-400 hover:text-slate-600 disabled:opacity-30 transition-colors"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
