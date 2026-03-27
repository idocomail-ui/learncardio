import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import SessionLauncher from "@/components/SessionLauncher";

async function getGuidelines() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("guidelines")
    .select("id, slug, name, figures(count), recommendations(count)")
    .order("name");

  return (data ?? []).map((g: {
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
    recCount: g.recommendations?.[0]?.count ?? 0,
  }));
}

export default async function StudyPage() {
  const guidelines = await getGuidelines();

  return (
    <div>
      <div className="max-w-xl mx-auto px-4 pt-6">
        <Link
          href="/dashboard"
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 mb-4 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">Study Session</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">Choose what to study</p>
      </div>
      <SessionLauncher guidelines={guidelines} />
    </div>
  );
}
