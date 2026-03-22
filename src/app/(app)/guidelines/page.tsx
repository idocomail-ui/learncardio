import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

interface Guideline {
  id: string;
  slug: string;
  name: string;
  figureCount: number;
  recommendationCount: number;
}

async function getGuidelines(): Promise<Guideline[]> {
  const supabase = await createClient();

  const { data: guidelines } = await supabase
    .from("guidelines")
    .select(`
      id, slug, name,
      figures(count),
      recommendations(count)
    `)
    .order("name");

  return (guidelines ?? []).map((g: {
    id: string;
    slug: string;
    name: string;
    figures: { count: number }[];
    recommendations: { count: number }[];
  }) => ({
    id: g.id,
    slug: g.slug,
    name: g.name,
    figureCount: g.figures?.[0]?.count ?? 0,
    recommendationCount: g.recommendations?.[0]?.count ?? 0,
  }));
}

export default async function GuidelinesPage() {
  const guidelines = await getGuidelines();

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">ESC Guidelines</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
          {guidelines.length} guidelines available
        </p>
      </div>

      <div className="space-y-2">
        {guidelines.map((guideline) => (
          <Link
            key={guideline.id}
            href={`/guidelines/${guideline.slug}`}
            className="card p-4 flex items-center justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-colors block"
          >
            <div className="flex-1 min-w-0">
              <p className="font-medium text-slate-800 dark:text-slate-200 truncate">
                {guideline.name}
              </p>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs text-slate-400">
                  {guideline.figureCount} figures
                </span>
                <span className="text-xs text-slate-300 dark:text-slate-600">·</span>
                <span className="text-xs text-slate-400">
                  {guideline.recommendationCount} recommendations
                </span>
              </div>
            </div>
            <svg
              className="w-4 h-4 text-slate-400 flex-shrink-0 ml-3"
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
