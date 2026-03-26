import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import GuidelineStudyMenu from "@/components/GuidelineStudyMenu";
import GuidelineProgress from "@/components/GuidelineProgress";

async function getGuideline(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("guidelines")
    .select(`id, slug, name, figures(count), recommendations(count)`)
    .eq("slug", slug)
    .single();
  return data;
}

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
      <Link
        href="/guidelines"
        className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 mb-4 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        All guidelines
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{guideline.name}</h1>
        <div className="flex items-center gap-3 mt-2">
          <span className="text-sm text-slate-400">{figureCount} figures</span>
          <span className="text-slate-300 dark:text-slate-600">·</span>
          <span className="text-sm text-slate-400">{recCount} recommendations</span>
        </div>
        <GuidelineProgress guidelineId={guideline.id} figureCount={figureCount} recCount={recCount} />
      </div>

      <GuidelineStudyMenu
        slug={slug}
        figureCount={figureCount}
        recCount={recCount}
      />
    </div>
  );
}
