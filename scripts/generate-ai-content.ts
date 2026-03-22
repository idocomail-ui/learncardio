/**
 * Script 3: Enrich figures and recommendations with AI-generated content using Groq
 * Run: npm run pipeline:ai-content
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import fs from "fs";
import path from "path";
import Groq from "groq-sdk";
import type { RecommendationEntry } from "./extract-recommendations";

const PIPELINE_DIR = path.join(process.cwd(), "data/pipeline");
const RATE_LIMIT_DELAY_MS = 2500;

export interface EnrichedFigure {
  guideline: string;
  guidelineSlug: string;
  figureNumber: number;
  caption: string;
  page: number;
  imagePath: string;
  explanation: string;
}

export interface EnrichedRecommendation extends RecommendationEntry {
  rephrasedText: string;
  explanation: string;
  miniVignette: string;
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function enrichFigure(figure: EnrichedFigure, groq: Groq): Promise<string> {
  const prompt = `You are a cardiology education expert. Explain Figure ${figure.figureNumber} from the ESC ${figure.guideline} guideline.

Caption: "${figure.caption}"

Provide a clear explanation for a cardiology resident. Include:
1. What the figure shows (algorithm, flowchart, risk score, etc.)
2. How to interpret it step by step
3. Key clinical decision points
4. Clinical use

Keep it under 250 words.`;

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 512,
    });
    return completion.choices[0]?.message?.content?.trim() ?? "";
  } catch {
    return "";
  }
}

async function enrichRecommendation(
  rec: RecommendationEntry,
  groq: Groq
): Promise<{ rephrasedText: string; explanation: string; miniVignette: string }> {
  const prompt = `You are a cardiology education expert helping a resident study the ESC ${rec.guideline} guideline.

Original recommendation (Class ${rec.class}, LOE ${rec.loe}):
"${rec.text}"

Return a JSON object:
{
  "rephrasedText": "Plain-English version (1-2 sentences)",
  "explanation": "Why this recommendation exists: clinical reasoning, mechanism, evidence. 3-5 sentences.",
  "miniVignette": "One sentence clinical scenario illustrating when this applies."
}

Return ONLY the JSON object.`;

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 512,
    });
    const response = completion.choices[0]?.message?.content?.trim() ?? "";
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { rephrasedText: rec.text, explanation: "", miniVignette: "" };
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      rephrasedText: parsed.rephrasedText || rec.text,
      explanation: parsed.explanation || "",
      miniVignette: parsed.miniVignette || "",
    };
  } catch {
    return { rephrasedText: rec.text, explanation: "", miniVignette: "" };
  }
}

async function main() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not set in .env.local");
  const groq = new Groq({ apiKey });

  // --- Enrich Figures ---
  const figuresPath = path.join(PIPELINE_DIR, "figures.json");
  const enrichedFiguresPath = path.join(PIPELINE_DIR, "figures-enriched.json");

  if (fs.existsSync(figuresPath)) {
    const figures: EnrichedFigure[] = JSON.parse(fs.readFileSync(figuresPath, "utf-8"));
    const enriched: EnrichedFigure[] = fs.existsSync(enrichedFiguresPath)
      ? JSON.parse(fs.readFileSync(enrichedFiguresPath, "utf-8"))
      : [];

    const enrichedKeys = new Set(enriched.map((f) => `${f.guideline}-${f.figureNumber}`));
    const toEnrich = figures.filter((f) => !enrichedKeys.has(`${f.guideline}-${f.figureNumber}`));
    console.log(`Figures: ${enriched.length} done, ${toEnrich.length} remaining`);

    for (let i = 0; i < toEnrich.length; i++) {
      const fig = toEnrich[i];
      console.log(`  [${i + 1}/${toEnrich.length}] ${fig.guideline} - Figure ${fig.figureNumber}`);
      const explanation = await enrichFigure(fig, groq);
      enriched.push({ ...fig, explanation });
      fs.writeFileSync(enrichedFiguresPath, JSON.stringify(enriched, null, 2));
      await sleep(RATE_LIMIT_DELAY_MS);
    }
    console.log(`✅ Figures enriched: ${enriched.length}`);
  }

  // --- Enrich Recommendations ---
  const recsPath = path.join(PIPELINE_DIR, "recommendations.json");
  const enrichedRecsPath = path.join(PIPELINE_DIR, "recommendations-enriched.json");

  if (fs.existsSync(recsPath)) {
    const recs: RecommendationEntry[] = JSON.parse(fs.readFileSync(recsPath, "utf-8"));
    const enriched: EnrichedRecommendation[] = fs.existsSync(enrichedRecsPath)
      ? JSON.parse(fs.readFileSync(enrichedRecsPath, "utf-8"))
      : [];

    const enrichedKeys = new Set(enriched.map((r) => `${r.guideline}-${r.recommendationNumber}`));
    const toEnrich = recs.filter((r) => !enrichedKeys.has(`${r.guideline}-${r.recommendationNumber}`));
    console.log(`\nRecommendations: ${enriched.length} done, ${toEnrich.length} remaining`);

    for (let i = 0; i < toEnrich.length; i++) {
      const rec = toEnrich[i];
      console.log(`  [${i + 1}/${toEnrich.length}] ${rec.guideline} - Rec #${rec.recommendationNumber}`);
      const ai = await enrichRecommendation(rec, groq);
      enriched.push({ ...rec, ...ai });
      fs.writeFileSync(enrichedRecsPath, JSON.stringify(enriched, null, 2));
      await sleep(RATE_LIMIT_DELAY_MS);
    }
    console.log(`✅ Recommendations enriched: ${enriched.length}`);
  }
}

main().catch(console.error);
