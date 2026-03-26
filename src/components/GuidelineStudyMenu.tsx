"use client";

import Link from "next/link";

interface Props {
  slug: string;
  figureCount: number;
  recCount: number;
}

export default function GuidelineStudyMenu({ slug, figureCount, recCount }: Props) {
  return (
    <div className="space-y-3">
      {figureCount > 0 && (
        <Link
          href={`/study/figures/${slug}`}
          className="card flex items-center justify-between p-4 hover:border-slate-300 dark:hover:border-slate-700 transition-colors group"
        >
          <div>
            <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">Browse Figures</p>
            <p className="text-xs text-slate-400 mt-0.5">{figureCount} figures in order</p>
          </div>
          <svg className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      )}

      {recCount > 0 && (
        <Link
          href={`/study/recommendations/${slug}`}
          className="card flex items-center justify-between p-4 hover:border-slate-300 dark:hover:border-slate-700 transition-colors group"
        >
          <div>
            <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">Browse Recommendations</p>
            <p className="text-xs text-slate-400 mt-0.5">{recCount} recommendations in order</p>
          </div>
          <svg className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      )}
    </div>
  );
}
