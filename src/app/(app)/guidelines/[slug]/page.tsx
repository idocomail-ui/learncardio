import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";

async function getGuideline(slug: string) {
  const supabase = await createClient();

  const { data: guideline } = await supabase
    .from("guidelines")
    .select(`id, slug, name, figures(count), recommendations(count), questions(count)`)
    .eq("slug", slug)
    .single();

  return guideline;
}

const STUDY_MODES = [
  {
    id: "browse_figures",
    label: "Browse Figures",
    description: "View all figures in order with explanations",
    icon: "🖼️",
    href: (slug: string) => `/study/figures/${slug}`,
  },
  {
    id: "browse_recommendations",
    label: "Browse Recommendations",
    description: "Study Class I/IIa/IIb/III recommendations",
    icon: "📋",
    href: (slug: string) => `/study/recommendations/${slug}`,
  },
  {
    id: "mcq_vignette",
    label: "Clinical Vignette MCQ",
    description: "Patient scenarios with 4-option questions",
    icon: "🏥",
    href: (slug: string) => `/study/mcq?mode=mcq_vignette&guideline=${slug}`,
  },
  {
    id: "mcq_recommendations",
    label: "Recommendations MCQ",
    description: "Test Class, LOE, and recall",
    icon: "🎯",
    href: (slug: string) => `/study/mcq?mode=mcq_recommendations&guideline=${slug}`,
  },
  {
    id: "mcq_figures",
    label: "Figures MCQ",
    description: "Interpret and label guideline figures",
    icon: "📊",
    href: (slug: string) => `/study/mcq?mode=mcq_figures&guideline=${slug}`,
  },
];

export default async function GuidelinePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guideline = await getGuideline(slug);

  if (!guideline) notFound();

  const figureCount = (guideline.figures as { count: number }[])?.[0]?.count ?? 0;
  const recCount = (guideline.recommendations as { count: number }[])?.[0]?.count ?? 0;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Back */}
      <Link
        href="/guidelines"
        className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 mb-4 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        All guidelines
      </Link>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          {guideline.name}
        </h1>
        <div className="flex items-center gap-3 mt-2">
          <span className="text-sm text-slate-400">{figureCount} figures</span>
          <span className="text-slate-300 dark:text-slate-600">·</span>
          <span className="text-sm text-slate-400">{recCount} recommendations</span>
        </div>
      </div>

      {/* Study modes */}
      <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
        Study Modes
      </h2>

      <div className="space-y-2">
        {STUDY_MODES.map((mode) => (
          <Link
            key={mode.id}
            href={mode.href(slug)}
            className="card p-4 flex items-center gap-4 hover:border-slate-300 dark:hover:border-slate-700 transition-colors block"
          >
            <span className="text-2xl flex-shrink-0">{mode.icon}</span>
            <div className="flex-1">
              <p className="font-medium text-slate-800 dark:text-slate-200">
                {mode.label}
              </p>
              <p className="text-sm text-slate-400 mt-0.5">{mode.description}</p>
            </div>
            <svg
              className="w-4 h-4 text-slate-400 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        ))}
      </div>
    </div>
  );
}
