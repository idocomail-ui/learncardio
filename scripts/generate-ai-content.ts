/**
 * Script 3: Enrich figures (via Gemini vision) and recommendations (via Groq) with AI content
 * Run: npm run pipeline:ai-content
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import fs from "fs";
import path from "path";
import Groq from "groq-sdk";
import type { RecommendationEntry } from "./extract-recommendations";

const PIPELINE_DIR = path.join(process.cwd(), "data/pipeline");
const GROQ_DELAY_MS = 2500;
const GEMINI_DELAY_MS = 4000; // gemini-2.5-flash-lite free tier ~15 RPM

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

async function enrichFigureWithVision(
  figure: EnrichedFigure,
  geminiApiKey: string
): Promise<string> {
  const imgPath = path.join(process.cwd(), figure.imagePath);
  if (!fs.existsSync(imgPath)) return "";

  const imgB64 = fs.readFileSync(imgPath).toString("base64");

  const prompt = `Figure ${figure.figureNumber} from the ESC ${figure.guideline} guideline.
Caption: "${figure.caption}"

Describe what this figure shows to a cardiology resident in 3-5 sentences. Be specific about the actual content visible in the figure — the steps, pathways, values, or decisions shown. Do not start with any preamble.`;

  const payload = {
    contents: [
      {
        parts: [
          { inline_data: { mime_type: "image/png", data: imgB64 } },
          { text: prompt },
        ],
      },
    ],
    generationConfig: { maxOutputTokens: 400, temperature: 0.2 },
  };

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    if (!res.ok) {
      const err = await res.text();
      console.warn(`    Gemini error ${res.status}: ${err.slice(0, 200)}`);
      return "";
    }
    const data = await res.json();
    return (data.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
  } catch (e) {
    console.warn("    Gemini request failed:", e);
    return "";
  }
}

async function enrichRecommendation(
  rec: RecommendationEntry,
  groq: Groq
): Promise<{ rephrasedText: string; explanation: string; miniVignette: string }> {
  const prompt = `ESC ${rec.guideline} guideline recommendation:
"${rec.text}"

Return a JSON object with these fields:
{
  "rephrasedText": "Plain-English version (1-2 sentences)",
  "explanation": "Why this recommendation exists: clinical reasoning, mechanism, evidence. 3-5 sentences.",
  "miniVignette": "One sentence clinical scenario illustrating when this applies."
}

Return ONLY the JSON object. No preamble.`;

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
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) throw new Error("GROQ_API_KEY not set in .env.local");
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) throw new Error("GEMINI_API_KEY not set in .env.local");

  const groq = new Groq({ apiKey: groqKey });

  // --- Enrich Figures (vision) ---
  const figuresPath = path.join(PIPELINE_DIR, "figures.json");
  const enrichedFiguresPath = path.join(PIPELINE_DIR, "figures-enriched.json");

  if (fs.existsSync(figuresPath)) {
    const figures: EnrichedFigure[] = JSON.parse(fs.readFileSync(figuresPath, "utf-8"));
    const enriched: EnrichedFigure[] = fs.existsSync(enrichedFiguresPath)
      ? JSON.parse(fs.readFileSync(enrichedFiguresPath, "utf-8"))
      : [];

    // Re-enrich figures that have an empty explanation or were done without vision
    const enrichedKeys = new Set(
      enriched.filter((f) => f.explanation).map((f) => `${f.guideline}-${f.figureNumber}`)
    );
    const toEnrich = figures.filter((f) => !enrichedKeys.has(`${f.guideline}-${f.figureNumber}`));
    console.log(`Figures: ${enriched.filter(f => f.explanation).length} done, ${toEnrich.length} remaining`);

    // Remove entries without explanation so they get re-added
    const enrichedWithExp = enriched.filter((f) => f.explanation);

    for (let i = 0; i < toEnrich.length; i++) {
      const fig = toEnrich[i];
      console.log(`  [${i + 1}/${toEnrich.length}] ${fig.guideline} - Figure ${fig.figureNumber}`);
      const explanation = await enrichFigureWithVision(fig, geminiKey);
      enrichedWithExp.push({ ...fig, explanation });
      fs.writeFileSync(enrichedFiguresPath, JSON.stringify(enrichedWithExp, null, 2));
      await sleep(GEMINI_DELAY_MS);
    }
    console.log(`✅ Figures enriched: ${enrichedWithExp.length}`);
  }

  // --- Enrich Recommendations (text via Groq) ---
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
      await sleep(GROQ_DELAY_MS);
    }
    console.log(`✅ Recommendations enriched: ${enriched.length}`);
  }
}

main().catch(console.error);
