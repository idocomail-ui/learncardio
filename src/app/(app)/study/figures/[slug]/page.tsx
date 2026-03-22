import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import FigureBrowser from "@/components/study/FigureBrowser";

async function getFigures(slug: string) {
  const supabase = await createClient();

  const { data: guideline } = await supabase
    .from("guidelines")
    .select("id, name, slug")
    .eq("slug", slug)
    .single();

  if (!guideline) return null;

  const { data: figures } = await supabase
    .from("figures")
    .select("*")
    .eq("guideline_id", guideline.id)
    .order("figure_number");

  const { data: { user } } = await supabase.auth.getUser();

  const { data: progress } = user
    ? await supabase
        .from("user_progress")
        .select("item_id, status")
        .eq("user_id", user.id)
        .eq("item_type", "figure")
    : { data: [] };

  const progressMap = new Map((progress ?? []).map((p: { item_id: string; status: string }) => [p.item_id, p.status]));

  return {
    guideline,
    figures: figures ?? [],
    progressMap: Object.fromEntries(progressMap),
  };
}

export default async function FiguresPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getFigures(slug);
  if (!data) notFound();

  return (
    <FigureBrowser
      guideline={data.guideline}
      figures={data.figures}
      initialProgress={data.progressMap}
    />
  );
}
