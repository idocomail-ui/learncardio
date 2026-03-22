import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function classBadgeVariant(cls: string) {
  switch (cls) {
    case "I":   return "badge-class-i";
    case "IIa": return "badge-class-iia";
    case "IIb": return "badge-class-iib";
    case "III": return "badge-class-iii";
    default:    return "badge-loe";
  }
}

/** SM-2 spaced repetition algorithm */
export function sm2(
  quality: 0 | 1 | 2 | 3 | 4 | 5, // 0-2 = fail, 3-5 = pass
  repetitions: number,
  easeFactor: number,
  interval: number
): { repetitions: number; easeFactor: number; interval: number } {
  if (quality < 3) {
    return { repetitions: 0, easeFactor, interval: 1 };
  }

  const newEase = Math.max(
    1.3,
    easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
  );

  let newInterval: number;
  if (repetitions === 0) {
    newInterval = 1;
  } else if (repetitions === 1) {
    newInterval = 6;
  } else {
    newInterval = Math.round(interval * newEase);
  }

  return {
    repetitions: repetitions + 1,
    easeFactor: newEase,
    interval: newInterval,
  };
}
