import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await supabase.from("user_progress").delete().eq("user_id", user.id);
  await supabase.from("sessions").delete().eq("user_id", user.id);

  return NextResponse.json({ ok: true });
}
