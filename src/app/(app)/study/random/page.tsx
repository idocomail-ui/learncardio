"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { cn, classBadgeVariant, loeBadgeVariant } from "@/lib/utils";

type Mode = "figure" | "recommendation";

interface RandomFigure {
  id: string;
  figure_number: number;
  image_url: string;
  caption_original: string;
  page_number: number;
  guidelines: { id: string; name: string; slug: string };
}

interface RandomRec {
  id: string;
  recommendation_number: number;
  class: string;
  loe: string;
  original_text: string;
  rephrased_text: string;
  explanation: string;
  mini_vignette: string;
  guidelines: { id: string; name: string; slug: string };
}

type Item = RandomFigure | RandomRec;

function isFigure(item: Item): item is RandomFigure {
  return "figure_number" in item;
}

export default function RandomStudyPage() {
  const [mode, setMode] = useState<Mode>("figure");
  const [current, setCurrent] = useState<Item | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<Item[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [progress, setProgress] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<"explanation" | null>(null);

  const fetchRandom = useCallback(async (m: Mode) => {
    setLoading(true);
    setExpanded(null);
    try {
      const res = await fetch(`/api/random/${m === "figure" ? "figure" : "recommendation"}`);
      const data = await res.json();
      setCurrent(data);
      setHistory((h) => [...h.slice(0, historyIndex + 1), data]);
      setHistoryIndex((i) => i + 1);
    } finally {
      setLoading(false);
    }
  }, [historyIndex]);

  useEffect(() => { fetchRandom("figure"); }, []); // eslint-disable-line

  function switchMode(m: Mode) {
    setMode(m);
    setHistory([]);
    setHistoryIndex(-1);
    fetchRandom(m);
  }

  function goBack() {
    if (historyIndex <= 0) return;
    const prev = history[historyIndex - 1];
    setHistoryIndex((i) => i - 1);
    setCurrent(prev);
    setExpanded(null);
  }

  const markStatus = useCallback(async (status: "known" | "needs_review") => {
    if (!current) return;
    const supabase = createClient();
    const itemType = isFigure(current) ? "figure" : "recommendation";
    await supabase.from("user_progress").upsert(
      {
        item_type: itemType,
        item_id: current.id,
        status,
        last_seen_at: new Date().toISOString(),
        next_review_at: status === "known"
          ? new Date(Date.now() + 7 * 86400000).toISOString()
          : new Date(Date.now() + 86400000).toISOString(),
      },
      { onConflict: "user_id,item_type,item_id" }
    );
    setProgress((p) => ({ ...p, [current.id]: status }));
    window.dispatchEvent(new Event("progress-updated"));
    fetchRandom(mode);
  }, [current, mode, fetchRandom]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key) {
        case " ": case "k": case "K":
          e.preventDefault(); markStatus("known"); break;
        case "r": case "R":
          markStatus("needs_review"); break;
        case "ArrowRight":
          fetchRandom(mode); break;
        case "ArrowLeft":
          goBack(); break;
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [markStatus, fetchRandom, mode]); // eslint-disable-line

  const itemStatus = current ? (progress[current.id] ?? "unseen") : "unseen";

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Dashboard
        </Link>
        <span className="text-sm text-slate-400">{historyIndex + 1} seen</span>
      </div>

      {/* Mode toggle */}
      <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        {(["figure", "recommendation"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => mode !== m && switchMode(m)}
            className={cn(
              "flex-1 py-2 text-sm font-medium transition-colors",
              mode === m ? "bg-blue-600 text-white" : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
            )}
          >
            {m === "figure" ? "🖼️ Figures" : "📋 Recommendations"}
          </button>
        ))}
      </div>

      {/* Card */}
      {loading || !current ? (
        <div className="card p-12 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : isFigure(current) ? (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-slate-50 dark:bg-slate-800/50">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">Figure {current.figure_number}</span>
              <span className="text-xs text-slate-400">{current.guidelines.name}</span>
              {itemStatus !== "unseen" && (
                <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium",
                  itemStatus === "known" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                )}>
                  {itemStatus === "known" ? "Known" : "Review"}
                </span>
              )}
            </div>
            <Link href={`/study/figures/${current.guidelines.slug}?start=${current.figure_number}`} className="text-xs text-blue-600 hover:underline">
              Browse guideline →
            </Link>
          </div>
          {current.image_url && (
            <Image src={current.image_url} alt={`Figure ${current.figure_number}`} width={800} height={600} className="w-full h-auto" priority />
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-slate-50 dark:bg-slate-800/50">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn("text-xs px-2.5 py-1 rounded-full font-semibold", classBadgeVariant((current as RandomRec).class))}>
                Class {(current as RandomRec).class}
              </span>
              <span className={cn("text-xs px-2.5 py-1 rounded-full font-semibold", loeBadgeVariant((current as RandomRec).loe))}>
                LOE {(current as RandomRec).loe}
              </span>
              {itemStatus !== "unseen" && (
                <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium",
                  itemStatus === "known" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                )}>
                  {itemStatus === "known" ? "Known" : "Review"}
                </span>
              )}
            </div>
            <span className="text-xs text-slate-400">{(current as RandomRec).guidelines.name}</span>
          </div>
          <div className="px-4 py-4 space-y-3">
            <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
              {(current as RandomRec).rephrased_text || (current as RandomRec).original_text}
            </p>
            {(current as RandomRec).explanation && (
              <div className="border-t pt-3">
                <button
                  onClick={() => setExpanded(expanded === "explanation" ? null : "explanation")}
                  className="flex items-center justify-between w-full text-left py-1"
                >
                  <span className="text-sm font-medium text-blue-600 dark:text-blue-400">Clinical reasoning</span>
                  <svg className={cn("w-4 h-4 text-slate-400 transition-transform", expanded === "explanation" && "rotate-180")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {expanded === "explanation" && (
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3 mt-1">
                    {(current as RandomRec).explanation}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={() => markStatus("needs_review")} disabled={loading || !current} className="flex-1 btn-secondary text-sm disabled:opacity-30">
          Needs Review <span className="text-xs opacity-50">[R]</span>
        </button>
        <button onClick={() => markStatus("known")} disabled={loading || !current} className="flex-1 btn-primary text-sm disabled:opacity-30">
          Got it → <span className="text-xs opacity-60">[Space]</span>
        </button>
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button onClick={goBack} disabled={historyIndex <= 0 || loading} className="text-sm text-slate-400 hover:text-slate-600 disabled:opacity-30 transition-colors">
          ← Previous
        </button>
        <button onClick={() => fetchRandom(mode)} disabled={loading} className="text-sm text-slate-400 hover:text-slate-600 disabled:opacity-30 transition-colors">
          Skip →
        </button>
      </div>
    </div>
  );
}
