"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Mode = "figure" | "recommendation";

interface RandomFigure {
  id: string;
  figure_number: number;
  image_url: string;
  caption_original: string;
  caption_explanation: string;
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

export default function RandomStudyPage() {
  const [mode, setMode] = useState<Mode>("figure");
  const [figure, setFigure] = useState<RandomFigure | null>(null);
  const [rec, setRec] = useState<RandomRec | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<(RandomFigure | RandomRec)[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const fetchRandom = useCallback(async (m: Mode) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/random/${m}`);
      const data = await res.json();
      if (m === "figure") {
        setFigure(data);
        setHistory((h) => [...h.slice(0, historyIndex + 1), data]);
        setHistoryIndex((i) => i + 1);
      } else {
        setRec(data);
        setHistory((h) => [...h.slice(0, historyIndex + 1), data]);
        setHistoryIndex((i) => i + 1);
      }
    } finally {
      setLoading(false);
    }
  }, [historyIndex]);

  // Load first item on mount
  useEffect(() => {
    fetchRandom("figure");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (mode === "figure") setFigure(prev as RandomFigure);
    else setRec(prev as RandomRec);
  }

  const current = mode === "figure" ? figure : rec;

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard"
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Dashboard
        </Link>
        <span className="text-sm text-slate-400">{historyIndex + 1} seen</span>
      </div>

      {/* Mode toggle */}
      <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <button
          onClick={() => mode !== "figure" && switchMode("figure")}
          className={cn(
            "flex-1 py-2 text-sm font-medium transition-colors",
            mode === "figure"
              ? "bg-blue-600 text-white"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
          )}
        >
          🖼️ Figures
        </button>
        <button
          onClick={() => mode !== "recommendation" && switchMode("recommendation")}
          className={cn(
            "flex-1 py-2 text-sm font-medium transition-colors",
            mode === "recommendation"
              ? "bg-blue-600 text-white"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
          )}
        >
          📋 Recommendations
        </button>
      </div>

      {/* Card */}
      {loading || !current ? (
        <div className="card p-12 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : mode === "figure" && figure ? (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-slate-50 dark:bg-slate-800/50">
            <div>
              <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                Figure {figure.figure_number}
              </span>
              <span className="text-xs text-slate-400 ml-2">{figure.guidelines.name}</span>
            </div>
            <Link
              href={`/study/figures/${figure.guidelines.slug}?start=${figure.figure_number}`}
              className="text-xs text-blue-600 hover:underline"
            >
              Browse guideline →
            </Link>
          </div>
          {figure.image_url && (
            <div className="bg-white dark:bg-slate-900">
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
      ) : mode === "recommendation" && rec ? (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-slate-50 dark:bg-slate-800/50">
            <div className="flex items-center gap-2">
              <span className={cn(
                "text-xs px-2 py-0.5 rounded-full font-semibold",
                rec.class === "I" ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400" :
                rec.class === "IIa" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400" :
                rec.class === "IIb" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400" :
                "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400"
              )}>
                Class {rec.class}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">LOE {rec.loe}</span>
            </div>
            <span className="text-xs text-slate-400">{rec.guidelines.name}</span>
          </div>
          <div className="px-4 py-4 space-y-3">
            <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
              {rec.rephrased_text || rec.original_text}
            </p>
            {rec.explanation && (
              <div className="border-t pt-3">
                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">Why</p>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{rec.explanation}</p>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Navigation */}
      <div className="flex gap-3">
        <button
          onClick={goBack}
          disabled={historyIndex <= 0 || loading}
          className="flex-1 btn-secondary disabled:opacity-30"
        >
          ← Previous
        </button>
        <button
          onClick={() => fetchRandom(mode)}
          disabled={loading}
          className="flex-1 btn-primary"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
