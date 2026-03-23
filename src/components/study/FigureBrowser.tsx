"use client";

import { useState } from "react";
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
}

export default function FigureBrowser({ guideline, figures, initialProgress }: Props) {
  const [current, setCurrent] = useState(0);
  const [progress, setProgress] = useState<Record<string, string>>(initialProgress);

  const figure = figures[current];

  if (!figure) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-slate-500">No figures found for this guideline.</p>
        <Link href={`/guidelines/${guideline.slug}`} className="btn-primary mt-4 inline-block">
          Back to guideline
        </Link>
      </div>
    );
  }

  async function markStatus(status: "known" | "needs_review") {
    const supabase = createClient();
    await supabase.from("user_progress").upsert(
      {
        item_type: "figure",
        item_id: figure.id,
        status,
        last_seen_at: new Date().toISOString(),
        next_review_at:
          status === "known"
            ? new Date(Date.now() + 7 * 86400000).toISOString()
            : new Date(Date.now() + 86400000).toISOString(),
      },
      { onConflict: "user_id,item_type,item_id" }
    );
    setProgress((p) => ({ ...p, [figure.id]: status }));
    if (current < figures.length - 1) {
      setCurrent((c) => c + 1);
    }
  }

  const figureStatus = progress[figure.id] ?? "unseen";

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
        <span className="text-sm text-slate-400">{current + 1} / {figures.length}</span>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-slate-100 rounded-full">
        <div
          className="h-full bg-blue-500 rounded-full transition-all"
          style={{ width: `${((current + 1) / figures.length) * 100}%` }}
        />
      </div>

      {/* Figure card */}
      <div className="card overflow-hidden">
        {/* Title bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-slate-50">
          <span className="font-semibold text-slate-800 text-sm">Figure {figure.figure_number}</span>
          <div className="flex items-center gap-2">
            {figureStatus !== "unseen" && (
              <span className={cn(
                "text-xs px-2 py-0.5 rounded-full font-medium",
                figureStatus === "known" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
              )}>
                {figureStatus === "known" ? "Known" : "Review"}
              </span>
            )}
            <BookmarkButton itemType="figure" itemId={figure.id} />
          </div>
        </div>

        {/* AI Explanation — primary content */}
        {figure.caption_explanation ? (
          <div className="px-4 py-4">
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">AI Explanation</p>
            <p className="text-sm text-slate-700 leading-relaxed">{figure.caption_explanation}</p>
          </div>
        ) : (
          <div className="px-4 py-4">
            <p className="text-sm text-slate-400 italic">No explanation available.</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={() => markStatus("needs_review")} className="flex-1 btn-secondary">
          Needs Review
        </button>
        <button onClick={() => markStatus("known")} className="flex-1 btn-primary">
          Got it →
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
          onClick={() => setCurrent((c) => Math.min(figures.length - 1, c + 1))}
          disabled={current === figures.length - 1}
          className="text-sm text-slate-400 hover:text-slate-600 disabled:opacity-30 transition-colors"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
