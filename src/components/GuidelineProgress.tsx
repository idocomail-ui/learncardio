"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Props {
  guidelineId: string;
  figureCount: number;
  recCount: number;
}

export default function GuidelineProgress({ guidelineId, figureCount, recCount }: Props) {
  const [figs, setFigs] = useState<{ known: number; seen: number } | null>(null);
  const [recs, setRecs] = useState<{ known: number; seen: number } | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data: figIds }, { data: recIds }] = await Promise.all([
        supabase.from("figures").select("id").eq("guideline_id", guidelineId),
        supabase.from("recommendations").select("id").eq("guideline_id", guidelineId),
      ]);

      if (figIds?.length) {
        const ids = figIds.map((f) => f.id);
        const { data } = await supabase.from("user_progress")
          .select("status").eq("user_id", user.id).eq("item_type", "figure").in("item_id", ids);
        setFigs({ seen: data?.length ?? 0, known: data?.filter((d) => d.status === "known").length ?? 0 });
      }
      if (recIds?.length) {
        const ids = recIds.map((r) => r.id);
        const { data } = await supabase.from("user_progress")
          .select("status").eq("user_id", user.id).eq("item_type", "recommendation").in("item_id", ids);
        setRecs({ seen: data?.length ?? 0, known: data?.filter((d) => d.status === "known").length ?? 0 });
      }
    }
    load();
  }, [guidelineId]);

  if (!figs && !recs) return null;

  return (
    <div className="flex items-center gap-4 mt-2">
      {figs !== null && figureCount > 0 && (
        <div className="flex items-center gap-1.5">
          <div className="h-1.5 w-20 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full" style={{ width: `${(figs.known / figureCount) * 100}%` }} />
          </div>
          <span className="text-xs text-slate-400">{figs.known}/{figureCount} figs</span>
        </div>
      )}
      {recs !== null && recCount > 0 && (
        <div className="flex items-center gap-1.5">
          <div className="h-1.5 w-20 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(recs.known / recCount) * 100}%` }} />
          </div>
          <span className="text-xs text-slate-400">{recs.known}/{recCount} recs</span>
        </div>
      )}
    </div>
  );
}
