import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

const MODE_LABELS: Record<string, string> = {
  browse_figures: "Browse Figures",
  browse_recommendations: "Browse Recommendations",
  mcq_vignette: "Clinical Vignette MCQ",
  mcq_recommendations: "Recommendations MCQ",
  mcq_figures: "Figures MCQ",
};

async function getRecentSessions(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sessions")
    .select("*")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(3);
  return data ?? [];
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const recentSessions = await getRecentSessions(user.id);

  const quickStart = [
    { href: "/guidelines", label: "Start Studying", description: "Choose a guideline", primary: true },
    { href: "/study/mcq?mode=mcq_vignette", label: "Quick MCQ", description: "10 random vignettes", primary: false },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Dashboard</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
          {user.user_metadata?.name ?? user.email}
        </p>
      </div>

      {/* Random study */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
          Surprise Me
        </h2>
        <Link
          href="/study/random"
          className="card p-4 flex items-center justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎲</span>
            <div>
              <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">Random Study</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Figures or recommendations — keep hitting Next</p>
            </div>
          </div>
          <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
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
      {recentSessions.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
            Recent Sessions
          </h2>
          <div className="space-y-2">
            {recentSessions.map((session: {
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
