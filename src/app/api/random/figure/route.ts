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

  let countQuery = supabase.from("figures").select("*", { count: "exact", head: true });
  if (guidelineIds.length > 0) countQuery = countQuery.in("guideline_id", guidelineIds);
  const { count } = await countQuery;
  if (!count) return NextResponse.json({ error: "No figures" }, { status: 404 });

  const randomOffset = Math.floor(Math.random() * count);

  let dataQuery = supabase
    .from("figures")
    .select("id, figure_number, image_url, caption_original, caption_explanation, page_number, guidelines(id, name, slug)");
  if (guidelineIds.length > 0) dataQuery = dataQuery.in("guideline_id", guidelineIds);

  const { data } = await dataQuery.range(randomOffset, randomOffset).single();
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(data);
}
