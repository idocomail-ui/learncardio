"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  slug: string;
  figureCount: number;
  recCount: number;
}

export default function GuidelineStudyMenu({ slug, figureCount, recCount }: Props) {
  const router = useRouter();
  const [figureStart, setFigureStart] = useState(1);
  const [recStart, setRecStart] = useState(1);
  const [loadingRandom, setLoadingRandom] = useState<"figure" | "rec" | null>(null);

  async function goRandom(type: "figure" | "rec") {
    setLoadingRandom(type);
    const res = await fetch(`/api/random/${type === "figure" ? "figure" : "recommendation"}?guideline=${slug}`);
    const data = await res.json();
    setLoadingRandom(null);
    if (type === "figure") {
      router.push(`/study/figures/${slug}?start=${data.figure_number}`);
    } else {
      router.push(`/study/recommendations/${slug}?start=${data.recommendation_number}`);
    }
  }

  return (
    <div className="space-y-3">
      {/* Figures */}
      {figureCount > 0 && (
        <div className="card p-4 space-y-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Figures</p>

          {/* Browse in order */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Browse in order</span>
              <span className="text-xs text-slate-400">Fig {figureStart} / {figureCount}</span>
            </div>
            <input
              type="range"
              min={1}
              max={figureCount}
              value={figureStart}
              onChange={(e) => setFigureStart(Number(e.target.value))}
              className="w-full accent-blue-600"
            />
            <button
              onClick={() => router.push(`/study/figures/${slug}?start=${figureStart}`)}
              className="w-full btn-primary text-sm py-2"
            >
              Start from Figure {figureStart}
            </button>
          </div>

          <div className="border-t dark:border-slate-700" />

          {/* Random */}
          <button
            onClick={() => goRandom("figure")}
            disabled={loadingRandom === "figure"}
            className="w-full card py-2.5 px-4 flex items-center justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-colors disabled:opacity-50"
          >
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Random figure</span>
            <span className="text-slate-400 text-lg">{loadingRandom === "figure" ? "…" : "🎲"}</span>
          </button>
        </div>
      )}

      {/* Recommendations */}
      {recCount > 0 && (
        <div className="card p-4 space-y-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Recommendations</p>

          {/* Browse in order */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Browse in order</span>
              <span className="text-xs text-slate-400">Rec {recStart} / {recCount}</span>
            </div>
            <input
              type="range"
              min={1}
              max={recCount}
              value={recStart}
              onChange={(e) => setRecStart(Number(e.target.value))}
              className="w-full accent-blue-600"
            />
            <button
              onClick={() => router.push(`/study/recommendations/${slug}?start=${recStart}`)}
              className="w-full btn-primary text-sm py-2"
            >
              Start from Rec {recStart}
            </button>
          </div>

          <div className="border-t dark:border-slate-700" />

          {/* Random */}
          <button
            onClick={() => goRandom("rec")}
            disabled={loadingRandom === "rec"}
            className="w-full card py-2.5 px-4 flex items-center justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-colors disabled:opacity-50"
          >
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Random recommendation</span>
            <span className="text-slate-400 text-lg">{loadingRandom === "rec" ? "…" : "🎲"}</span>
          </button>
        </div>
      )}
    </div>
  );
}
