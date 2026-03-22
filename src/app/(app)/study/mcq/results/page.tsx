import Link from "next/link";

export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const correct = parseInt(params.correct ?? "0", 10);
  const total = parseInt(params.total ?? "0", 10);
  const mode = params.mode ?? "mcq_vignette";
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

  const emoji = pct >= 80 ? "🎉" : pct >= 60 ? "👍" : "💪";
  const message =
    pct >= 80
      ? "Excellent work!"
      : pct >= 60
      ? "Good effort — keep going."
      : "Keep practicing — you'll get there.";

  return (
    <div className="max-w-sm mx-auto px-4 py-16 flex flex-col items-center text-center">
      <span className="text-5xl mb-4">{emoji}</span>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">
        {pct}%
      </h1>
      <p className="text-slate-500 dark:text-slate-400 mb-2">
        {correct} / {total} correct
      </p>
      <p className="text-slate-600 dark:text-slate-400 text-sm mb-8">{message}</p>

      <div className="w-full space-y-3">
        <Link
          href={`/study/mcq?mode=${mode}`}
          className="btn-primary w-full block text-center"
        >
          New Session
        </Link>
        <Link
          href="/study/mcq?mode=review"
          className="btn-secondary w-full block text-center"
        >
          Do Reviews
        </Link>
        <Link
          href="/guidelines"
          className="btn-ghost w-full block text-center"
        >
          Back to Guidelines
        </Link>
      </div>
    </div>
  );
}
