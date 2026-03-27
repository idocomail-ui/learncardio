import { createClient } from "@/lib/supabase/server";
import SessionLauncher from "@/components/SessionLauncher";

async function getGuidelines() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("guidelines")
    .select("id, slug, name, figures(count), recommendations(count)")
    .order("name");

  return (data ?? []).map((g: {
    id: string;
    slug: string;
    name: string;
    figures: { count: number }[];
    recommendations: { count: number }[];
  }) => ({
    id: g.id,
    slug: g.slug,
    name: g.name,
    figureCount: g.figures?.[0]?.count ?? 0,
    recCount: g.recommendations?.[0]?.count ?? 0,
  }));
}

export default async function DashboardPage() {
  const guidelines = await getGuidelines();
  return <SessionLauncher guidelines={guidelines} />;
}
