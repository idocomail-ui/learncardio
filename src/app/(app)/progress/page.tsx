import { createClient } from "@/lib/supabase/server";

async function getProgressData(userId: string) {
  const supabase = await createClient();

  const { data: guidelines } = await supabase
    .from("guidelines")
    .select(`
      id, slug, name,
      figures(count),
      recommendations(count),
      questions(count)
    `)
    .order("name");

  const { data: userProgress } = await supabase
    .from("user_progress")
    .select("item_type, item_id, status, correct_count, incorrect_count")
    .eq("user_id", userId);

  const { data: sessions } = await supabase
    .from("sessions")
    .select("*")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(10);

  return { guidelines: guidelines ?? [], userProgress: userProgress ?? [], sessions: sessions ?? [] };
}

export default async function ProgressPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { guidelines, userProgress, sessions } = await getProgressData(user.id);

  const seenFigures = new Set(userProgress.filter((p: { item_type: string; status: string }) => p.item_type === "figure" && p.status !== "unseen").map((p: { item_id: string }) => p.item_id)).size;
  const seenRecs = new Set(userProgress.filter((p: { item_type: string; status: string }) => p.item_type === "recommendation" && p.status !== "unseen").map((p: { item_id: string }) => p.item_id)).size;
  const answeredQ = new Set(userProgress.filter((p: { item_type: string }) => p.item_type === "question").map((p: { item_id: string }) => p.item_id)).size;
  const correctQ = userProgress.filter((p: { item_type: string; status: string }) => p.item_type === "question" && p.status === "known").length;

  const totalSessions = sessions.length;
  const avgScore = sessions.length > 0
    ? Math.round(sessions.reduce((sum: number, s: { questions_answered: number; correct_count: number }) =>
        sum + (s.questions_answered > 0 ? (s.correct_count / s.questions_answered) * 100 : 0), 0
      ) / sessions.length)
    : 0;

  const MODE_LABELS: Record<string, string> = {
    browse_figures: "Figures",
    browse_recommendations: "Recommendations",
    mcq_vignette: "Vignette MCQ",
    mcq_recommendations: "Rec MCQ",
    mcq_figures: "Figure MCQ",
    review: "Review",
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Progress</h1>

      {/* Overall stats */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Figures seen", value: seenFigures },
          { label: "Recs studied", value: seenRecs },
          { label: "Questions done", value: answeredQ },
          { label: "Avg score", value: `${avgScore}%` },
        ].map(({ label, value }) => (
          <div key={label} className="card p-4 text-center">
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Per-guideline breakdown */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
          By Guideline
        </h2>
        <div className="space-y-2">
          {guidelines.map((g: {
            id: string;
            slug: string;
            name: string;
            figures: { count: number }[];
            recommendations: { count: number }[];
            questions: { count: number }[];
          }) => {
            const totalFigs = g.figures?.[0]?.count ?? 0;
            const totalRecsG = g.recommendations?.[0]?.count ?? 0;

            return (
              <div key={g.id} className="card p-4">
                <p className="font-medium text-slate-800 dark:text-slate-200 text-sm mb-2">{g.name}</p>
                <div className="space-y-1.5">
                  {[
                    { label: `Figures`, done: 0, total: totalFigs },
                    { label: `Recs`, done: 0, total: totalRecsG },
                  ].map(({ label, done, total }) => (
                    <div key={label} className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 w-12 flex-shrink-0">{label}</span>
                      <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: total > 0 ? `${Math.min(100, (done / total) * 100)}%` : "0%" }}
                        />
                      </div>
                      <span className="text-xs text-slate-400 w-8 text-right flex-shrink-0">
                        {total}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent sessions */}
      {sessions.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
            Recent Sessions
          </h2>
          <div className="space-y-2">
            {sessions.map((s: {
              id: string;
              mode: string;
              questions_answered: number;
              correct_count: number;
              started_at: string;
            }) => (
              <div key={s.id} className="card p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-800 dark:text-slate-200 text-sm">
                    {MODE_LABELS[s.mode] ?? s.mode}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {new Date(s.started_at).toLocaleDateString("en-GB", {
                      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                    })}
                  </p>
                </div>
                {s.questions_answered > 0 && (
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {Math.round((s.correct_count / s.questions_answered) * 100)}%
                    </p>
                    <p className="text-xs text-slate-400">{s.questions_answered} questions</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
