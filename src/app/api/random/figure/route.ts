import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const guidelineSlug = request.nextUrl.searchParams.get("guideline");

  let query = supabase.from("figures").select("*", { count: "exact", head: true });
  if (guidelineSlug) {
    const { data: gl } = await supabase.from("guidelines").select("id").eq("slug", guidelineSlug).single();
    if (gl) query = query.eq("guideline_id", gl.id);
  }

  const { count } = await query;
  if (!count) return NextResponse.json({ error: "No figures" }, { status: 404 });

  const randomOffset = Math.floor(Math.random() * count);

  let dataQuery = supabase
    .from("figures")
    .select("id, figure_number, image_url, caption_original, caption_explanation, page_number, guidelines(id, name, slug)");

  if (guidelineSlug) {
    const { data: gl } = await supabase.from("guidelines").select("id").eq("slug", guidelineSlug).single();
    if (gl) dataQuery = dataQuery.eq("guideline_id", gl.id);
  }

  const { data } = await dataQuery.range(randomOffset, randomOffset).single();
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(data);
}
