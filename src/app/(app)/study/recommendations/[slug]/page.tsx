import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import RecommendationBrowser from "@/components/study/RecommendationBrowser";

async function getData(slug: string) {
  const supabase = await createClient();

  const { data: guideline } = await supabase
    .from("guidelines")
    .select("id, name, slug")
    .eq("slug", slug)
    .single();

  if (!guideline) return null;

  const { data: recommendations } = await supabase
    .from("recommendations")
    .select("*")
    .eq("guideline_id", guideline.id)
    .order("recommendation_number");

  const { data: { user } } = await supabase.auth.getUser();

  const { data: progress } = user
    ? await supabase
        .from("user_progress")
        .select("item_id, status")
        .eq("user_id", user.id)
        .eq("item_type", "recommendation")
    : { data: [] };

  const progressMap = Object.fromEntries(
    (progress ?? []).map((p: { item_id: string; status: string }) => [p.item_id, p.status])
  );

  return { guideline, recommendations: recommendations ?? [], progressMap };
}

export default async function RecommendationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ start?: string }>;
}) {
  const { slug } = await params;
  const { start } = await searchParams;
  const data = await getData(slug);
  if (!data) notFound();

  const startIndex = start
    ? Math.max(0, data.recommendations.findIndex((r) => r.recommendation_number === Number(start)))
    : 0;

  return (
    <RecommendationBrowser
      guideline={data.guideline}
      recommendations={data.recommendations}
      initialProgress={data.progressMap}
      initialIndex={startIndex}
    />
  );
}
