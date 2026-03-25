import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

async function getStats(userId: string) {
  const supabase = await createClient();

  const [{ count: totalFigures }, { count: totalRecs }, { count: totalQuestions }] =
    await Promise.all([
      supabase.from("figures").select("*", { count: "exact", head: true }),
      supabase.from("recommendations").select("*", { count: "exact", head: true }),
      supabase.from("questions").select("*", { count: "exact", head: true }),
    ]);

  const { count: seenFigures } = await supabase
    .from("user_progress")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("item_type", "figure")
    .neq("status", "unseen");

  const { count: answeredQuestions } = await supabase
    .from("user_progress")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("item_type", "question");

  const { count: dueReviews } = await supabase
    .from("user_progress")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .lte("next_review_at", new Date().toISOString())
    .neq("status", "unseen");

  const { data: recentSessions } = await supabase
    .from("sessions")
    .select("*")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(3);

  return {
    totalFigures: totalFigures ?? 0,
    totalRecs: totalRecs ?? 0,
    totalQuestions: totalQuestions ?? 0,
    seenFigures: seenFigures ?? 0,
    answeredQuestions: answeredQuestions ?? 0,
    dueReviews: dueReviews ?? 0,
    recentSessions: recentSessions ?? [],
  };
}

const MODE_LABELS: Record<string, string> = {
  browse_figures: "Browse Figures",
  browse_recommendations: "Browse Recommendations",
  mcq_vignette: "Clinical Vignette MCQ",
  mcq_recommendations: "Recommendations MCQ",
  mcq_figures: "Figures MCQ",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const stats = await getStats(user.id);

  const quickStart = [
    { href: "/guidelines", label: "Start Studying", description: "Choose a guideline", primary: true },
    { href: "/study/mcq?mode=mcq_vignette", label: "Quick MCQ", description: "10 random vignettes", primary: false },
  ];

  if (stats.dueReviews > 0) {
    quickStart.unshift({
      href: "/study/mcq?mode=review",
      label: `${stats.dueReviews} Due Reviews`,
      description: "Spaced repetition queue",
      primary: true,
    });
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Dashboard</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
          {user.user_metadata?.name ?? user.email}
        </p>
      </div>

      {/* Due reviews alert */}
      {stats.dueReviews > 0 && (
        <Link
          href="/study/mcq?mode=review"
          className="block card p-4 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/50 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-blue-800 dark:text-blue-300">
                {stats.dueReviews} reviews due
              </p>
              <p className="text-sm text-blue-600 dark:text-blue-400">
                Tap to start spaced repetition session
              </p>
            </div>
            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {stats.seenFigures}
            <span className="text-sm font-normal text-slate-400">/{stats.totalFigures}</span>
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Figures seen</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {stats.answeredQuestions}
            <span className="text-sm font-normal text-slate-400">/{stats.totalQuestions}</span>
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Questions done</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">25</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Guidelines</p>
        </div>
      </div>

      {/* Random study */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
          Surprise Me
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/api/random/figure"
            className="card p-4 flex flex-col gap-1 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
          >
            <span className="text-2xl">🖼️</span>
            <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">Random Figure</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Jump to any figure</p>
          </Link>
          <Link
            href="/api/random/recommendation"
            className="card p-4 flex flex-col gap-1 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
          >
            <span className="text-2xl">📋</span>
            <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">Random Rec</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Jump to any recommendation</p>
          </Link>
        </div>
      </div>

      {/* Quick start */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
          Quick Start
        </h2>
        <div className="space-y-2">
          {quickStart.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between p-4 rounded-xl transition-colors ${
                item.primary
                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                  : "card hover:border-slate-300 dark:hover:border-slate-700"
              }`}
            >
              <div>
                <p className={`font-semibold ${item.primary ? "text-white" : "text-slate-800 dark:text-slate-200"}`}>
                  {item.label}
                </p>
                <p className={`text-sm ${item.primary ? "text-blue-100" : "text-slate-500 dark:text-slate-400"}`}>
                  {item.description}
                </p>
              </div>
              <svg
                className={`w-5 h-5 ${item.primary ? "text-blue-200" : "text-slate-400"}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent sessions */}
      {stats.recentSessions.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
            Recent Sessions
          </h2>
          <div className="space-y-2">
            {stats.recentSessions.map((session: {
              id: string;
              mode: string;
              questions_answered: number;
              correct_count: number;
              started_at: string;
            }) => (
              <div key={session.id} className="card p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-800 dark:text-slate-200 text-sm">
                    {MODE_LABELS[session.mode] ?? session.mode}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {new Date(session.started_at).toLocaleDateString()}
                  </p>
                </div>
                {session.questions_answered > 0 && (
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {Math.round((session.correct_count / session.questions_answered) * 100)}%
                    </p>
                    <p className="text-xs text-slate-400">{session.questions_answered}Q</p>
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
