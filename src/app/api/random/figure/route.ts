import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();

  const { count } = await supabase
    .from("figures")
    .select("*", { count: "exact", head: true });

  if (!count) return NextResponse.json({ error: "No figures" }, { status: 404 });

  const randomOffset = Math.floor(Math.random() * count);

  const { data } = await supabase
    .from("figures")
    .select("id, figure_number, image_url, caption_original, caption_explanation, page_number, guidelines(id, name, slug)")
    .range(randomOffset, randomOffset)
    .single();

  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(data);
}
