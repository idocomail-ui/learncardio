import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const slugsParam = request.nextUrl.searchParams.get("slugs");
  const slugs = slugsParam ? slugsParam.split(",").filter(Boolean) : [];

  let guidelineIds: string[] = [];
  if (slugs.length > 0) {
    const { data: gls } = await supabase
      .from("guidelines")
      .select("id")
      .in("slug", slugs);
    guidelineIds = (gls ?? []).map((g: { id: string }) => g.id);
  }

  let countQuery = supabase.from("recommendations").select("*", { count: "exact", head: true });
  if (guidelineIds.length > 0) countQuery = countQuery.in("guideline_id", guidelineIds);
  const { count } = await countQuery;
  if (!count) return NextResponse.json({ error: "No recommendations" }, { status: 404 });

  const randomOffset = Math.floor(Math.random() * count);

  let dataQuery = supabase
    .from("recommendations")
    .select("id, recommendation_number, class, loe, original_text, rephrased_text, explanation, mini_vignette, guidelines(id, name, slug)");
  if (guidelineIds.length > 0) dataQuery = dataQuery.in("guideline_id", guidelineIds);

  const { data } = await dataQuery.range(randomOffset, randomOffset).single();
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(data);
}
