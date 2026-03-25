"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

interface Stats {
  figuresSeen: number;
  figuresKnown: number;
  figuresReview: number;
  totalFigures: number;
  questionsAnswered: number;
  questionsCorrect: number;
  totalQuestions: number;
  recsSeen: number;
  recsKnown: number;
  totalRecs: number;
}

export default function ProgressSidebar() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [resetting, setResetting] = useState(false);

  const fetchStats = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [
      { count: totalFigures },
      { count: totalQuestions },
      { count: totalRecs },
      { data: progress },
      { data: sessions },
    ] = await Promise.all([
      supabase.from("figures").select("*", { count: "exact", head: true }),
      supabase.from("questions").select("*", { count: "exact", head: true }),
      supabase.from("recommendations").select("*", { count: "exact", head: true }),
      supabase.from("user_progress").select("item_type, status").eq("user_id", user.id),
      supabase.from("sessions").select("questions_answered, correct_count").eq("user_id", user.id),
    ]);

    const figureRows = (progress ?? []).filter((p) => p.item_type === "figure");
    const recRows = (progress ?? []).filter((p) => p.item_type === "recommendation");

    const totalAnswered = (sessions ?? []).reduce((s, r) => s + (r.questions_answered ?? 0), 0);
    const totalCorrect = (sessions ?? []).reduce((s, r) => s + (r.correct_count ?? 0), 0);

    setStats({
      figuresSeen: figureRows.length,
      figuresKnown: figureRows.filter((p) => p.status === "known").length,
      figuresReview: figureRows.filter((p) => p.status === "needs_review").length,
      totalFigures: totalFigures ?? 0,
      questionsAnswered: totalAnswered,
      questionsCorrect: totalCorrect,
      totalQuestions: totalQuestions ?? 0,
      recsSeen: recRows.length,
      recsKnown: recRows.filter((p) => p.status === "known").length,
      totalRecs: totalRecs ?? 0,
    });
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  async function resetProgress() {
    if (!confirm("Reset all progress? This cannot be undone.")) return;
    setResetting(true);
    const res = await fetch("/api/reset-progress", { method: "DELETE" });
    if (res.ok) {
      await fetchStats();
    }
    setResetting(false);
  }

  if (!stats) {
    return (
      <aside className="hidden md:flex flex-col w-52 shrink-0 border-r bg-white dark:bg-slate-900 min-h-full px-4 py-6 gap-4">
        <div className="animate-pulse space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-4 bg-slate-200 dark:bg-slate-700 rounded" />
          ))}
        </div>
      </aside>
    );
  }

  const correctPct = stats.questionsAnswered > 0
    ? Math.round((stats.questionsCorrect / stats.questionsAnswered) * 100)
    : null;

  return (
    <aside className="hidden md:flex flex-col w-52 shrink-0 border-r bg-white dark:bg-slate-900 min-h-full px-4 py-6 gap-5">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">My Progress</p>

      {/* Figures */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Figures</p>
        <Row label="Seen" value={`${stats.figuresSeen} / ${stats.totalFigures}`} />
        <Row label="Known" value={stats.figuresKnown} color="text-green-600" />
        <Row label="Review" value={stats.figuresReview} color="text-amber-600" />
        <Row label="Unseen" value={stats.totalFigures - stats.figuresSeen} color="text-slate-400" />
        <ProgressBar value={stats.figuresSeen} max={stats.totalFigures} />
      </div>

      <div className="border-t dark:border-slate-700" />

      {/* Recommendations */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Recommendations</p>
        <Row label="Seen" value={`${stats.recsSeen} / ${stats.totalRecs}`} />
        <Row label="Known" value={stats.recsKnown} color="text-green-600" />
        <Row label="Unseen" value={stats.totalRecs - stats.recsSeen} color="text-slate-400" />
        <ProgressBar value={stats.recsSeen} max={stats.totalRecs} />
      </div>

      <div className="border-t dark:border-slate-700" />

      {/* Questions */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Questions</p>
        <Row label="Answered" value={`${stats.questionsAnswered} / ${stats.totalQuestions}`} />
        {correctPct !== null && (
          <Row
            label="Correct"
            value={`${correctPct}%`}
            color={correctPct >= 70 ? "text-green-600" : correctPct >= 50 ? "text-amber-600" : "text-red-500"}
          />
        )}
        <ProgressBar value={stats.questionsAnswered} max={stats.totalQuestions} />
      </div>

      <div className="mt-auto border-t dark:border-slate-700 pt-4">
        <button
          onClick={resetProgress}
          disabled={resetting}
          className="w-full text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 disabled:opacity-50 transition-colors text-left"
        >
          {resetting ? "Resetting…" : "↺ Reset all progress"}
        </button>
      </div>
    </aside>
  );
}

function Row({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
      <span className={`text-xs font-semibold ${color ?? "text-slate-700 dark:text-slate-300"}`}>{value}</span>
    </div>
  );
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-1 bg-slate-100 dark:bg-slate-700 rounded-full">
      <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}
