import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const { count } = await supabase
    .from("figures")
    .select("*", { count: "exact", head: true });

  if (!count) return NextResponse.json({ error: "No figures" }, { status: 404 });

  const randomOffset = Math.floor(Math.random() * count);

  const { data } = await supabase
    .from("figures")
    .select("figure_number, guidelines(slug)")
    .range(randomOffset, randomOffset)
    .single();

  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const guidelines = data.guidelines as unknown as { slug: string };
  const slug = guidelines.slug;
  return NextResponse.redirect(
    new URL(`/study/figures/${slug}?start=${data.figure_number}`, request.url)
  );
}
