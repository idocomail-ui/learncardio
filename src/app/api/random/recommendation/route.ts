import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();

  const { count } = await supabase
    .from("recommendations")
    .select("*", { count: "exact", head: true });

  if (!count) return NextResponse.json({ error: "No recommendations" }, { status: 404 });

  const randomOffset = Math.floor(Math.random() * count);

  const { data } = await supabase
    .from("recommendations")
    .select("id, recommendation_number, class, loe, original_text, rephrased_text, explanation, mini_vignette, guidelines(id, name, slug)")
    .range(randomOffset, randomOffset)
    .single();

  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(data);
}
