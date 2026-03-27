"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface Guideline {
  id: string;
  slug: string;
  name: string;
  figureCount: number;
  recCount: number;
}

type Mode = "figures" | "recs";
type Order = "ordered" | "random";

export default function SessionLauncher({ guidelines }: { guidelines: Guideline[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<Mode>("figures");
  const [order, setOrder] = useState<Order>("ordered");

  const allSelected = selected.size === guidelines.length;
  const multipleSelected = selected.size > 1;

  // When multiple selected, force random
  const effectiveOrder = multipleSelected ? "random" : order;

  function toggleGuideline(slug: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(guidelines.map((g) => g.slug)));
  }

  function clearAll() {
    setSelected(new Set());
  }

  function startSession() {
    const slugs = Array.from(selected);
    const isAll = slugs.length === guidelines.length;

    // Single guideline + ordered → existing browser pages
    if (slugs.length === 1 && effectiveOrder === "ordered") {
      const slug = slugs[0];
      if (mode === "figures") {
        router.push(`/study/figures/${slug}`);
      } else {
        router.push(`/study/recommendations/${slug}`);
      }
      return;
    }

    // Random mode or multi-guideline → random page with params
    const params = new URLSearchParams();
    params.set("mode", mode === "figures" ? "figure" : "recommendation");
    if (!isAll) {
      params.set("slugs", slugs.join(","));
    }
    router.push(`/study/random?${params.toString()}`);
  }

  const canStart = selected.size > 0;

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
      {/* Guideline selection */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Guidelines</p>
          <div className="flex items-center gap-3">
            <button
              onClick={selectAll}
              disabled={allSelected}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-40"
            >
              Select all
            </button>
            <button
              onClick={clearAll}
              disabled={selected.size === 0}
              className="text-xs text-slate-400 hover:text-slate-600 hover:underline disabled:opacity-40"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="card divide-y dark:divide-slate-700 overflow-hidden p-0 max-h-[50vh] overflow-y-auto">
          {guidelines.map((g) => {
            const isSelected = selected.has(g.slug);
            const hasContent = mode === "figures" ? g.figureCount > 0 : g.recCount > 0;
            return (
              <label
                key={g.slug}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors select-none",
                  isSelected
                    ? "bg-blue-50 dark:bg-blue-950/40"
                    : "hover:bg-slate-50 dark:hover:bg-slate-800/50",
                  !hasContent && "opacity-40 cursor-not-allowed"
                )}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  disabled={!hasContent}
                  onChange={() => hasContent && toggleGuideline(g.slug)}
                  className="w-4 h-4 rounded accent-blue-600 shrink-0"
                />
                <span className="flex-1 text-sm text-slate-800 dark:text-slate-200 truncate">
                  {g.name}
                </span>
                <span className="text-xs text-slate-400 shrink-0">
                  {mode === "figures" ? `${g.figureCount} figs` : `${g.recCount} recs`}
                </span>
              </label>
            );
          })}
        </div>

      </div>

      {/* Mode selection */}
      <div className="space-y-2">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Content</p>
        <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          {(["figures", "recs"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "flex-1 py-2.5 text-sm font-medium transition-colors",
                mode === m
                  ? "bg-blue-600 text-white"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
              )}
            >
              {m === "figures" ? "🖼️ Figures" : "📋 Recommendations"}
            </button>
          ))}
          <button
            disabled
            className="flex-1 py-2.5 text-sm font-medium text-slate-300 dark:text-slate-600 cursor-not-allowed"
            title="Coming soon"
          >
            ❓ MCQ
          </button>
        </div>
      </div>

      {/* Order selection */}
      <div className="space-y-2">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Order</p>
        <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          <button
            onClick={() => setOrder("ordered")}
            disabled={multipleSelected}
            className={cn(
              "flex-1 py-2.5 text-sm font-medium transition-colors",
              effectiveOrder === "ordered" && !multipleSelected
                ? "bg-blue-600 text-white"
                : multipleSelected
                ? "text-slate-300 dark:text-slate-600 cursor-not-allowed"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
            )}
          >
            📖 In order
          </button>
          <button
            onClick={() => setOrder("random")}
            className={cn(
              "flex-1 py-2.5 text-sm font-medium transition-colors",
              effectiveOrder === "random"
                ? "bg-blue-600 text-white"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
            )}
          >
            🎲 Random
          </button>
        </div>
        {multipleSelected && (
          <p className="text-xs text-slate-400">Random mode when multiple guidelines selected</p>
        )}
      </div>

      {/* Start button */}
      <button
        onClick={startSession}
        disabled={!canStart}
        className="w-full btn-primary py-3 text-base font-semibold disabled:opacity-40"
      >
        Start Session
        {selected.size > 0 && (
          <span className="ml-2 text-sm font-normal opacity-80">
            ({selected.size} guideline{selected.size !== 1 ? "s" : ""})
          </span>
        )}
      </button>
    </div>
  );
}
