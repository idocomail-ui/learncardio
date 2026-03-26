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
const OLLAMA_BASE = "http://localhost:11434";

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

async function enrichFigureWithVision(figure: EnrichedFigure): Promise<string> {
  const imgPath = path.join(process.cwd(), figure.imagePath);
  if (!fs.existsSync(imgPath)) return "";

  const imgB64 = fs.readFileSync(imgPath).toString("base64");

  const prompt = `This is Figure ${figure.figureNumber} from the ESC ${figure.guideline} guideline (caption: "${figure.caption}"). What are the main steps or categories shown in this figure? Answer in one short paragraph, max 60 words.`;

  try {
    const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "llava:7b", prompt, images: [imgB64], stream: false, options: { num_predict: 100, temperature: 0.1 } }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) {
      console.warn(`    LLaVA error ${res.status}`);
      return "";
    }
    const data = await res.json();
    let text = (data.response ?? "").trim();
    // Strip generic opener
    text = text.replace(/^The image (is|shows|displays|presents|depicts)[^.]*\.\s*/i, "");
    // Truncate at last complete sentence
    const lastPeriod = text.lastIndexOf(".");
    if (lastPeriod > 0) text = text.slice(0, lastPeriod + 1);
    return text.trim();
  } catch (e) {
    console.warn("    LLaVA request failed:", e);
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
  const mode = process.argv[2] ?? "all"; // "figures" | "recs" | "all"
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) throw new Error("GROQ_API_KEY not set in .env.local");
  const groq = new Groq({ apiKey: groqKey });

  // --- Enrich Figures (vision) ---
  const figuresPath = path.join(PIPELINE_DIR, "figures.json");
  const enrichedFiguresPath = path.join(PIPELINE_DIR, "figures-enriched.json");

  if (mode !== "recs" && fs.existsSync(figuresPath)) {
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
      const explanation = await enrichFigureWithVision(fig);
      enrichedWithExp.push({ ...fig, explanation });
      fs.writeFileSync(enrichedFiguresPath, JSON.stringify(enrichedWithExp, null, 2));
    }
    console.log(`✅ Figures enriched: ${enrichedWithExp.length}`);
  }

  // --- Enrich Recommendations (text via Groq) ---
  const recsPath = path.join(PIPELINE_DIR, "recommendations.json");
  const enrichedRecsPath = path.join(PIPELINE_DIR, "recommendations-enriched.json");

  if (mode !== "figures" && fs.existsSync(recsPath)) {
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
