"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn, classBadgeVariant, loeBadgeVariant, sm2 } from "@/lib/utils";
import BookmarkButton from "@/components/BookmarkButton";

interface Question {
  id: string;
  type: string;
  difficulty: string;
  stem: string;
  options: { A: string; B: string; C: string; D: string };
  correct_option: string;
  explanation: string;
  figures?: { image_url: string; figure_number: number } | null;
  recommendations?: { class: string; loe: string } | null;
}

interface Props {
  questions: Question[];
  mode: string;
  userId: string;
}

type OptionKey = "A" | "B" | "C" | "D";

const MODE_LABELS: Record<string, string> = {
  mcq_vignette: "Clinical Vignette",
  mcq_recommendations: "Recommendations",
  mcq_figures: "Figures",
  review: "Spaced Review",
};

export default function MCQSession({ questions, mode, userId }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<OptionKey | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState<Array<{ correct: boolean; questionId: string }>>([]);

  const question = questions[index];
  const isLast = index === questions.length - 1;
  const correct = question?.correct_option as OptionKey;

  // Session start time for recording
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    async function startSession() {
      const { data } = await supabase
        .from("sessions")
        .insert({ user_id: userId, mode, guideline_ids: [] })
        .select("id")
        .single();
      if (data) setSessionId(data.id);
    }
    startSession();
  }, []);

  async function recordAnswer(questionId: string, wasCorrect: boolean) {
    // Fetch current progress for SM-2
    const { data: existing } = await supabase
      .from("user_progress")
      .select("*")
      .eq("user_id", userId)
      .eq("item_type", "question")
      .eq("item_id", questionId)
      .maybeSingle();

    const quality = wasCorrect ? 4 : 1; // simplify: correct=4, wrong=1
    const { repetitions, easeFactor, interval } = sm2(
      quality as 0 | 1 | 2 | 3 | 4 | 5,
      existing?.repetitions ?? 0,
      existing?.ease_factor ?? 2.5,
      existing?.interval_days ?? 0
    );

    const nextReview = new Date(Date.now() + interval * 86400000).toISOString();

    await supabase.from("user_progress").upsert(
      {
        user_id: userId,
        item_type: "question",
        item_id: questionId,
        status: wasCorrect ? "known" : "needs_review",
        correct_count: (existing?.correct_count ?? 0) + (wasCorrect ? 1 : 0),
        incorrect_count: (existing?.incorrect_count ?? 0) + (wasCorrect ? 0 : 1),
        ease_factor: easeFactor,
        interval_days: interval,
        repetitions,
        next_review_at: nextReview,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "user_id,item_type,item_id" }
    );
  }

  async function handleSelect(option: OptionKey) {
    if (revealed) return;
    setSelected(option);
    setRevealed(true);

    const wasCorrect = option === correct;
    await recordAnswer(question.id, wasCorrect);
    setResults((r) => [...r, { correct: wasCorrect, questionId: question.id }]);
  }

  async function handleNext() {
    if (isLast) {
      // Update session stats
      if (sessionId) {
        const correctCount = results.filter((r) => r.correct).length;
        await supabase
          .from("sessions")
          .update({
            questions_answered: results.length,
            correct_count: correctCount,
            ended_at: new Date().toISOString(),
          })
          .eq("id", sessionId);
      }
      router.push(`/study/mcq/results?correct=${results.filter((r) => r.correct).length}&total=${results.length}&mode=${mode}`);
    } else {
      setIndex((i) => i + 1);
      setSelected(null);
      setRevealed(false);
    }
  }

  if (!question) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-slate-500 mb-4">
          {mode === "review" ? "No reviews due right now!" : "No questions available."}
        </p>
        <button onClick={() => router.push("/guidelines")} className="btn-primary">
          Browse Guidelines
        </button>
      </div>
    );
  }

  const optionKeys: OptionKey[] = ["A", "B", "C", "D"];

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 flex flex-col min-h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
          {MODE_LABELS[mode] ?? mode}
        </span>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-400">
            {index + 1} / {questions.length}
          </span>
          <BookmarkButton itemType="question" itemId={question.id} />
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-slate-100 dark:bg-slate-800 rounded-full mb-4">
        <div
          className="h-full bg-blue-500 rounded-full transition-all"
          style={{ width: `${((index + 1) / questions.length) * 100}%` }}
        />
      </div>

      {/* Question card */}
      <div className="card flex-1 overflow-y-auto">
        {/* Difficulty badge */}
        <div className="flex items-center gap-2 px-4 pt-4 pb-2">
          <span className={cn(
            "text-xs px-2 py-0.5 rounded-full font-medium",
            question.difficulty === "easy" && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
            question.difficulty === "intermediate" && "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
            question.difficulty === "hard" && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
          )}>
            {question.difficulty}
          </span>
          {question.recommendations && (
            <>
              <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", classBadgeVariant(question.recommendations.class))}>
                Class {question.recommendations.class}
              </span>
              <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", loeBadgeVariant(question.recommendations.loe))}>
                LOE {question.recommendations.loe}
              </span>
            </>
          )}
        </div>

        {/* Figure image (if figure question) */}
        {question.figures?.image_url && (
          <div className="px-4 pb-3">
            <Image
              src={question.figures.image_url}
              alt={`Figure ${question.figures.figure_number}`}
              width={700}
              height={500}
              className="w-full h-auto rounded-lg border border-slate-200 dark:border-slate-700"
            />
          </div>
        )}

        {/* Stem */}
        <div className="px-4 pb-4">
          <p className="text-slate-800 dark:text-slate-200 text-sm leading-relaxed whitespace-pre-line">
            {question.stem}
          </p>
        </div>

        {/* Options */}
        <div className="px-4 pb-4 space-y-2">
          {optionKeys.map((key) => {
            const isCorrectOption = key === correct;
            const isSelectedOption = key === selected;

            let optionStyle = "border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:border-blue-300 dark:hover:border-blue-700";

            if (revealed) {
              if (isCorrectOption) {
                optionStyle = "border-2 border-green-500 bg-green-50 dark:bg-green-950/30 text-green-800 dark:text-green-300";
              } else if (isSelectedOption) {
                optionStyle = "border-2 border-red-400 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300";
              } else {
                optionStyle = "border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-slate-400 dark:text-slate-600";
              }
            }

            return (
              <button
                key={key}
                onClick={() => handleSelect(key)}
                disabled={revealed}
                className={cn(
                  "w-full text-left px-4 py-3 rounded-xl transition-colors text-sm flex items-start gap-3",
                  optionStyle
                )}
              >
                <span className="font-bold flex-shrink-0 w-5">{key}.</span>
                <span>{question.options[key]}</span>
                {revealed && isCorrectOption && (
                  <svg className="w-4 h-4 text-green-600 flex-shrink-0 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
                {revealed && isSelectedOption && !isCorrectOption && (
                  <svg className="w-4 h-4 text-red-500 flex-shrink-0 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>

        {/* Explanation */}
        {revealed && (
          <div className="mx-4 mb-4 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-100 dark:border-blue-900">
            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1.5 uppercase tracking-wide">
              Explanation
            </p>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              {question.explanation}
            </p>
          </div>
        )}
      </div>

      {/* Next button */}
      {revealed && (
        <button onClick={handleNext} className="btn-primary mt-4 w-full text-center">
          {isLast ? "See Results" : "Next Question →"}
        </button>
      )}
    </div>
  );
}
