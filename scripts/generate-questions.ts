/**
 * Script 4: Generate MCQ questions for all 5 study modes using Groq
 * Run: npm run pipeline:questions
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import fs from "fs";
import path from "path";
import Groq from "groq-sdk";
import type { EnrichedRecommendation, EnrichedFigure } from "./generate-ai-content";

const PIPELINE_DIR = path.join(process.cwd(), "data/pipeline");
const RATE_LIMIT_DELAY_MS = 2500;

type Difficulty = "easy" | "intermediate" | "hard";
type QuestionType = "vignette" | "rec_class" | "rec_loe" | "rec_completion" | "rec_identify" | "fig_identify" | "fig_step" | "fig_label";

export interface MCQOption { A: string; B: string; C: string; D: string; }

export interface Question {
  id: string;
  type: QuestionType;
  difficulty: Difficulty;
  guidelineSlug: string;
  guideline: string;
  sourceRecommendationNumber?: number;
  sourceFigureNumber?: number;
  stem: string;
  options: MCQOption;
  correctOption: "A" | "B" | "C" | "D";
  explanation: string;
  figureImagePath?: string;
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 11);
}

async function callGroq(groq: Groq, prompt: string): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 1024,
      });
      return completion.choices[0]?.message?.content?.trim() ?? "";
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      if (status === 429 && attempt < 2) {
        await sleep((attempt + 1) * 15000);
      } else {
        throw err;
      }
    }
  }
  return "";
}

function parseQuestion(response: string, defaults: Partial<Question>): Question | null {
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.stem || !parsed.options?.A || !parsed.correctOption || !parsed.explanation) return null;
    return { id: generateId(), stem: parsed.stem, options: parsed.options, correctOption: parsed.correctOption, explanation: parsed.explanation, ...defaults } as Question;
  } catch { return null; }
}

// Mode 3: Clinical Vignette
async function generateVignetteQuestion(rec: EnrichedRecommendation, difficulty: Difficulty, groq: Groq): Promise<Question | null> {
  const diffGuide = {
    easy: "straightforward with a classic presentation.",
    intermediate: "moderately complex with comorbidities.",
    hard: "challenging with subtle distinctions or contraindications.",
  };

  const prompt = `Create a clinical vignette MCQ for a cardiology resident based on this ESC ${rec.guideline} recommendation:
"${rec.text}" (Class ${rec.class}, LOE ${rec.loe})

Difficulty: ${difficulty} — ${diffGuide[difficulty]}

Return ONLY a JSON object:
{
  "stem": "2-4 sentence clinical vignette + 1 question sentence",
  "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
  "correctOption": "A",
  "explanation": "3-5 sentences referencing the ESC guideline Class ${rec.class}, LOE ${rec.loe}."
}`;

  try {
    const response = await callGroq(groq, prompt);
    return parseQuestion(response, { type: "vignette", difficulty, guideline: rec.guideline, guidelineSlug: rec.guidelineSlug, sourceRecommendationNumber: rec.recommendationNumber });
  } catch { return null; }
}

// Mode 4a: Identify Class (no API call needed — constructed directly)
function generateRecClassQuestion(rec: EnrichedRecommendation, difficulty: Difficulty): Question {
  const allClasses = ["I", "IIa", "IIb", "III"];
  const distractors = allClasses.filter((c) => c !== rec.class).sort(() => 0.5 - Math.random()).slice(0, 3);
  const options = [rec.class, ...distractors].sort(() => 0.5 - Math.random());
  const correctIndex = options.indexOf(rec.class);
  const correctLetter = (["A", "B", "C", "D"] as const)[correctIndex];

  return {
    id: generateId(), type: "rec_class", difficulty,
    guideline: rec.guideline, guidelineSlug: rec.guidelineSlug,
    sourceRecommendationNumber: rec.recommendationNumber,
    stem: `According to the ESC ${rec.guideline} guideline, what is the Class of the following recommendation?\n\n"${rec.text}"`,
    options: { A: `Class ${options[0]}`, B: `Class ${options[1]}`, C: `Class ${options[2]}`, D: `Class ${options[3]}` },
    correctOption: correctLetter,
    explanation: `This is a Class ${rec.class} recommendation (LOE ${rec.loe}). ${rec.explanation}`,
  };
}

// Mode 4b: Identify LOE (no API call needed)
function generateRecLOEQuestion(rec: EnrichedRecommendation, difficulty: Difficulty): Question {
  const allLOEs = ["A", "B", "C"];
  const distractors = allLOEs.filter((l) => l !== rec.loe);
  const options = [rec.loe, ...distractors, "Not specified"].sort(() => 0.5 - Math.random()).slice(0, 4);
  const correctIndex = options.indexOf(rec.loe);
  const safeIndex = correctIndex === -1 ? 0 : correctIndex;
  if (correctIndex === -1) options[0] = rec.loe;
  const correctLetter = (["A", "B", "C", "D"] as const)[safeIndex];

  return {
    id: generateId(), type: "rec_loe", difficulty,
    guideline: rec.guideline, guidelineSlug: rec.guidelineSlug,
    sourceRecommendationNumber: rec.recommendationNumber,
    stem: `What is the Level of Evidence (LOE) for the following ESC ${rec.guideline} recommendation?\n\n"${rec.text}"`,
    options: { A: `LOE ${options[0]}`, B: `LOE ${options[1] ?? "B"}`, C: `LOE ${options[2] ?? "C"}`, D: `LOE ${options[3] ?? "A"}` },
    correctOption: correctLetter,
    explanation: `The Level of Evidence is ${rec.loe} (Class ${rec.class}). ${rec.explanation}`,
  };
}

// Mode 4c: Which recommendation applies
function generateRecIdentifyQuestion(rec: EnrichedRecommendation, otherRecs: EnrichedRecommendation[], difficulty: Difficulty): Question | null {
  if (otherRecs.length < 3) return null;
  const distractors = otherRecs.filter((r) => r.recommendationNumber !== rec.recommendationNumber).sort(() => 0.5 - Math.random()).slice(0, 3);
  const allOptions = [rec.text, ...distractors.map((d) => d.text)].sort(() => 0.5 - Math.random());
  const correctIndex = allOptions.indexOf(rec.text);
  const correctLetter = (["A", "B", "C", "D"] as const)[correctIndex];

  return {
    id: generateId(), type: "rec_identify", difficulty,
    guideline: rec.guideline, guidelineSlug: rec.guidelineSlug,
    sourceRecommendationNumber: rec.recommendationNumber,
    stem: `${rec.miniVignette || `A patient requires guidance per ESC ${rec.guideline}.`}\n\nWhich recommendation (Class ${rec.class}, LOE ${rec.loe}) applies?`,
    options: { A: allOptions[0], B: allOptions[1], C: allOptions[2], D: allOptions[3] },
    correctOption: correctLetter,
    explanation: `Correct: "${rec.text}" (Class ${rec.class}, LOE ${rec.loe}). ${rec.explanation}`,
  };
}

// Mode 5: Figure question — uses explanation text (no image encoding needed for Groq)
async function generateFigureQuestion(figure: EnrichedFigure, difficulty: Difficulty, groq: Groq): Promise<Question | null> {
  if (!figure.explanation) return null;

  const diffGuide = {
    easy: "Ask what this figure/algorithm represents overall.",
    intermediate: "Ask about a specific step or decision point.",
    hard: "Ask about a nuanced detail or clinical implication.",
  };

  const prompt = `Create a ${difficulty} MCQ about Figure ${figure.figureNumber} from the ESC ${figure.guideline} guideline.

Caption: "${figure.caption}"
Explanation: "${figure.explanation}"

${diffGuide[difficulty]}

Return ONLY a JSON object:
{
  "stem": "Question referencing Figure ${figure.figureNumber} from the ${figure.guideline} guideline",
  "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
  "correctOption": "A",
  "explanation": "2-4 sentences referencing the figure content."
}`;

  try {
    const response = await callGroq(groq, prompt);
    return parseQuestion(response, {
      type: "fig_identify", difficulty,
      guideline: figure.guideline, guidelineSlug: figure.guidelineSlug,
      sourceFigureNumber: figure.figureNumber,
      figureImagePath: figure.imagePath,
    });
  } catch { return null; }
}

async function main() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not set in .env.local");
  const groq = new Groq({ apiKey });

  const outputPath = path.join(PIPELINE_DIR, "questions.json");
  const existing: Question[] = fs.existsSync(outputPath) ? JSON.parse(fs.readFileSync(outputPath, "utf-8")) : [];
  const existingKeys = new Set(existing.map((q) => `${q.type}-${q.guideline}-${q.sourceRecommendationNumber ?? q.sourceFigureNumber}-${q.difficulty}`));
  const allQuestions: Question[] = [...existing];

  const recs: EnrichedRecommendation[] = fs.existsSync(path.join(PIPELINE_DIR, "recommendations-enriched.json"))
    ? JSON.parse(fs.readFileSync(path.join(PIPELINE_DIR, "recommendations-enriched.json"), "utf-8")) : [];
  const figs: EnrichedFigure[] = fs.existsSync(path.join(PIPELINE_DIR, "figures-enriched.json"))
    ? JSON.parse(fs.readFileSync(path.join(PIPELINE_DIR, "figures-enriched.json"), "utf-8")) : [];

  console.log(`Generating for ${recs.length} recs + ${figs.length} figures. Have ${existing.length} questions already.`);

  const difficulties: Difficulty[] = ["easy", "intermediate", "hard"];

  for (const rec of recs) {
    const sameGuidelineRecs = recs.filter((r) => r.guidelineSlug === rec.guidelineSlug);

    for (const difficulty of difficulties) {
      // Class + LOE + identify — no API calls needed
      const classKey = `rec_class-${rec.guideline}-${rec.recommendationNumber}-${difficulty}`;
      if (!existingKeys.has(classKey)) {
        const q = generateRecClassQuestion(rec, difficulty);
        allQuestions.push(q); existingKeys.add(classKey);
      }

      const loeKey = `rec_loe-${rec.guideline}-${rec.recommendationNumber}-${difficulty}`;
      if (!existingKeys.has(loeKey)) {
        const q = generateRecLOEQuestion(rec, difficulty);
        allQuestions.push(q); existingKeys.add(loeKey);
      }

      const identifyKey = `rec_identify-${rec.guideline}-${rec.recommendationNumber}-${difficulty}`;
      if (!existingKeys.has(identifyKey)) {
        const q = generateRecIdentifyQuestion(rec, sameGuidelineRecs, difficulty);
        if (q) { allQuestions.push(q); existingKeys.add(identifyKey); }
      }

      // Vignette — needs API call
      const vignetteKey = `vignette-${rec.guideline}-${rec.recommendationNumber}-${difficulty}`;
      if (!existingKeys.has(vignetteKey)) {
        const q = await generateVignetteQuestion(rec, difficulty, groq);
        if (q) { allQuestions.push(q); existingKeys.add(vignetteKey); }
        await sleep(RATE_LIMIT_DELAY_MS);
      }
    }

    fs.writeFileSync(outputPath, JSON.stringify(allQuestions, null, 2));
    process.stdout.write(`\r  Progress: ${allQuestions.length} questions`);
  }

  // Figure questions
  console.log(`\nGenerating figure questions...`);
  for (const fig of figs) {
    for (const difficulty of difficulties) {
      const figKey = `fig_identify-${fig.guideline}-${fig.figureNumber}-${difficulty}`;
      if (!existingKeys.has(figKey)) {
        const q = await generateFigureQuestion(fig, difficulty, groq);
        if (q) { allQuestions.push(q); existingKeys.add(figKey); }
        await sleep(RATE_LIMIT_DELAY_MS);
      }
    }
    fs.writeFileSync(outputPath, JSON.stringify(allQuestions, null, 2));
  }

  console.log(`\n✅ Done! Total questions: ${allQuestions.length}`);
}

main().catch(console.error);
