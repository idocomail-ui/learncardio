import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const guidelineSlug = request.nextUrl.searchParams.get("guideline");

  let guidelineId: string | null = null;
  if (guidelineSlug) {
    const { data: gl } = await supabase.from("guidelines").select("id").eq("slug", guidelineSlug).single();
    guidelineId = gl?.id ?? null;
  }

  let countQuery = supabase.from("recommendations").select("*", { count: "exact", head: true });
  if (guidelineId) countQuery = countQuery.eq("guideline_id", guidelineId);
  const { count } = await countQuery;
  if (!count) return NextResponse.json({ error: "No recommendations" }, { status: 404 });

  const randomOffset = Math.floor(Math.random() * count);

  let dataQuery = supabase
    .from("recommendations")
    .select("id, recommendation_number, class, loe, original_text, rephrased_text, explanation, mini_vignette, guidelines(id, name, slug)");
  if (guidelineId) dataQuery = dataQuery.eq("guideline_id", guidelineId);

  const { data } = await dataQuery.range(randomOffset, randomOffset).single();
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(data);
}
