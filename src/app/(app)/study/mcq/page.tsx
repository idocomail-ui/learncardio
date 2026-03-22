import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import MCQSession from "@/components/study/MCQSession";

type MCQMode = "mcq_vignette" | "mcq_recommendations" | "mcq_figures" | "review";
type Difficulty = "easy" | "intermediate" | "hard" | "mixed";

const MODE_TO_TYPES: Record<string, string[]> = {
  mcq_vignette:       ["vignette"],
  mcq_recommendations: ["rec_class", "rec_loe", "rec_identify"],
  mcq_figures:        ["fig_identify", "fig_step", "fig_label"],
  review:             ["vignette", "rec_class", "rec_loe", "rec_identify", "fig_identify"],
};

async function getQuestions({
  mode,
  guidelineSlug,
  difficulty,
  limit,
  userId,
}: {
  mode: MCQMode;
  guidelineSlug?: string;
  difficulty: Difficulty;
  limit: number;
  userId: string;
}) {
  const supabase = await createClient();
  const types = MODE_TO_TYPES[mode] ?? MODE_TO_TYPES.mcq_vignette;

  let query = supabase
    .from("questions")
    .select(`
      *,
      figures(image_url, figure_number),
      recommendations(class, loe)
    `)
    .in("type", types);

  if (difficulty !== "mixed") {
    query = query.eq("difficulty", difficulty);
  }

  if (guidelineSlug) {
    const { data: gl } = await supabase
      .from("guidelines")
      .select("id")
      .eq("slug", guidelineSlug)
      .single();
    if (gl) query = query.eq("guideline_id", gl.id);
  }

  if (mode === "review") {
    // For review mode: get due questions only
    const { data: due } = await supabase
      .from("user_progress")
      .select("item_id")
      .eq("user_id", userId)
      .eq("item_type", "question")
      .lte("next_review_at", new Date().toISOString())
      .limit(limit);

    const dueIds = (due ?? []).map((d: { item_id: string }) => d.item_id);
    if (dueIds.length === 0) return [];
    query = query.in("id", dueIds);
  }

  const { data: questions } = await query.limit(limit * 3); // over-fetch, then shuffle

  // Shuffle and limit
  const shuffled = (questions ?? []).sort(() => 0.5 - Math.random()).slice(0, limit);
  return shuffled;
}

export default async function MCQPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const mode = (params.mode as MCQMode) ?? "mcq_vignette";
  const guidelineSlug = params.guideline;
  const difficulty = (params.difficulty as Difficulty) ?? "mixed";
  const limit = parseInt(params.limit ?? "10", 10);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const questions = await getQuestions({
    mode, guidelineSlug, difficulty, limit, userId: user.id,
  });

  return (
    <MCQSession
      questions={questions}
      mode={mode}
      userId={user.id}
    />
  );
}
