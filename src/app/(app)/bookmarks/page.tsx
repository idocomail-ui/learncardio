import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { classBadgeVariant, loeBadgeVariant, cn } from "@/lib/utils";

async function getBookmarks(userId: string) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("bookmarks")
    .select("id, item_type, item_id, notes, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (!data || data.length === 0) return [];

  // Fetch details for each bookmark
  const figureIds = data.filter((b: { item_type: string }) => b.item_type === "figure").map((b: { item_id: string }) => b.item_id);
  const recIds = data.filter((b: { item_type: string }) => b.item_type === "recommendation").map((b: { item_id: string }) => b.item_id);
  const questionIds = data.filter((b: { item_type: string }) => b.item_type === "question").map((b: { item_id: string }) => b.item_id);

  const [{ data: figures }, { data: recs }, { data: questions }] = await Promise.all([
    figureIds.length > 0
      ? supabase.from("figures").select("id, figure_number, caption_original, guideline_id, guidelines(slug, name)").in("id", figureIds)
      : { data: [] },
    recIds.length > 0
      ? supabase.from("recommendations").select("id, class, loe, original_text, guideline_id, guidelines(slug, name)").in("id", recIds)
      : { data: [] },
    questionIds.length > 0
      ? supabase.from("questions").select("id, type, difficulty, stem, guidelines(slug, name)").in("id", questionIds)
      : { data: [] },
  ]);

  const detailMap = new Map<string, unknown>();
  (figures ?? []).forEach((f: { id: string }) => detailMap.set(f.id, { ...f, _type: "figure" }));
  (recs ?? []).forEach((r: { id: string }) => detailMap.set(r.id, { ...r, _type: "recommendation" }));
  (questions ?? []).forEach((q: { id: string }) => detailMap.set(q.id, { ...q, _type: "question" }));

  return data.map((b: { id: string; item_type: string; item_id: string; notes: string | null; created_at: string }) => ({
    ...b,
    detail: detailMap.get(b.item_id),
  }));
}

export default async function BookmarksPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const bookmarks = await getBookmarks(user.id);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Bookmarks</h1>
        <p className="text-slate-500 text-sm mt-0.5">{bookmarks.length} saved items</p>
      </div>

      {bookmarks.length === 0 ? (
        <div className="card p-8 text-center text-slate-400">
          <p>No bookmarks yet.</p>
          <p className="text-sm mt-1">Bookmark figures, recommendations, and questions while studying.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {bookmarks.map((b) => {
            const detail = b.detail as Record<string, unknown> | undefined;
            if (!detail) return null;

            const guideline = detail.guidelines as { slug: string; name: string } | undefined;

            return (
              <div key={b.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {/* Type badge */}
                    <span className="text-xs text-slate-400 uppercase tracking-wide font-medium">
                      {b.item_type.replace("_", " ")}
                    </span>

                    {/* Content preview */}
                    {b.item_type === "figure" && (
                      <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5 truncate">
                        Figure {detail.figure_number as number} — {detail.caption_original as string}
                      </p>
                    )}

                    {b.item_type === "recommendation" && (
                      <div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium", classBadgeVariant(detail.class as string))}>
                            Class {detail.class as string}
                          </span>
                          <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium", loeBadgeVariant(detail.loe as string))}>
                            LOE {detail.loe as string}
                          </span>
                        </div>
                        <p className="text-sm text-slate-700 dark:text-slate-300 mt-1 line-clamp-2">
                          {detail.original_text as string}
                        </p>
                      </div>
                    )}

                    {b.item_type === "question" && (
                      <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5 line-clamp-2">
                        {detail.stem as string}
                      </p>
                    )}

                    {/* Guideline */}
                    {guideline && (
                      <p className="text-xs text-slate-400 mt-1">{guideline.name}</p>
                    )}

                    {/* Notes */}
                    {b.notes && (
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 italic">{b.notes}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
