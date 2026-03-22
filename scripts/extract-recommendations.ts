/**
 * Script 2: Extract recommendations from ESC guideline PDFs using Groq
 * Run: npm run pipeline:recommendations
 */

import fs from "fs";
import path from "path";
import Groq from "groq-sdk";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const PDF_DIR = path.join(process.cwd(), "data/pdfs");
const PIPELINE_DIR = path.join(process.cwd(), "data/pipeline");

// Groq free tier: 30 RPM, generous daily limits
const RATE_LIMIT_DELAY_MS = 2500; // ~24 req/min, safe margin

export interface RecommendationEntry {
  guideline: string;
  guidelineSlug: string;
  recommendationNumber: number;
  class: "I" | "IIa" | "IIb" | "III";
  loe: "A" | "B" | "C";
  text: string;
  page: number;
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function extractFullText(pdfPath: string): Promise<{ pageTexts: string[] }> {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs" as string);
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjsLib.getDocument({ data }).promise;
  const pageTexts: string[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((item: { str?: string }) => item.str || "").join(" ");
    pageTexts.push(text);
  }

  return { pageTexts };
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function extractRecommendationsWithAI(
  guidelineName: string,
  textChunk: string,
  groq: Groq,
  chunkIndex: number
): Promise<Array<{ class: string; loe: string; text: string }>> {
  // Sanitize: remove control chars that break JSON parsing
  const safeChunk = textChunk.slice(0, 8000).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, " ");

  const prompt = `You are extracting clinical recommendations from an ESC (European Society of Cardiology) guideline PDF.

The text below is extracted from the "${guidelineName}" guideline. ESC recommendations appear in tables with:
- A recommendation statement (the clinical recommendation itself)
- A Class (I, IIa, IIb, or III)
- A Level of Evidence (A, B, or C)

Extract ALL clinical recommendations from this text. Return ONLY a JSON array:
[
  { "class": "I", "loe": "A", "text": "The exact recommendation text" }
]

Rules:
- Only include actual clinical recommendations (not background text or explanations)
- Class must be exactly one of: "I", "IIa", "IIb", "III"
- LOE must be exactly one of: "A", "B", "C"
- If no recommendations are found, return []
- Return ONLY the JSON array, no other text

TEXT TO ANALYZE:
${safeChunk}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const completion = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 4096,
      });

      const response = completion.choices[0]?.message?.content?.trim() ?? "";
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];
      const parsed = JSON.parse(jsonMatch[0]);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      if (status === 429 && attempt < 2) {
        const waitMs = (attempt + 1) * 15000;
        console.warn(`   ⏳ Rate limited, waiting ${waitMs / 1000}s...`);
        await sleep(waitMs);
      } else {
        console.warn(`   ⚠️  AI failed for chunk ${chunkIndex}:`, (err as Error).message);
        return [];
      }
    }
  }
  return [];
}

async function processPDF(pdfFile: string, groq: Groq): Promise<RecommendationEntry[]> {
  const pdfPath = path.join(PDF_DIR, pdfFile);
  const guidelineName = pdfFile.replace(/\.pdf$/i, "");
  const slug = slugify(guidelineName);

  console.log(`\n📄 Processing: ${guidelineName}`);

  const { pageTexts } = await extractFullText(pdfPath);
  const chunkSize = 15;
  const chunks: Array<{ text: string; startPage: number }> = [];

  for (let i = 0; i < pageTexts.length; i += chunkSize) {
    chunks.push({ text: pageTexts.slice(i, i + chunkSize).join("\n"), startPage: i + 1 });
  }

  console.log(`   ${pageTexts.length} pages → ${chunks.length} chunks`);

  const allRecs: RecommendationEntry[] = [];
  const seenTexts = new Set<string>();

  for (let i = 0; i < chunks.length; i++) {
    console.log(`   Processing chunk ${i + 1}/${chunks.length}...`);
    const recs = await extractRecommendationsWithAI(guidelineName, chunks[i].text, groq, i);

    for (const rec of recs) {
      const key = rec.text.slice(0, 100);
      if (seenTexts.has(key)) continue;
      seenTexts.add(key);
      if (!["I", "IIa", "IIb", "III"].includes(rec.class)) continue;
      if (!["A", "B", "C"].includes(rec.loe)) continue;

      allRecs.push({
        guideline: guidelineName,
        guidelineSlug: slug,
        recommendationNumber: allRecs.length + 1,
        class: rec.class as "I" | "IIa" | "IIb" | "III",
        loe: rec.loe as "A" | "B" | "C",
        text: rec.text.trim(),
        page: chunks[i].startPage,
      });
    }

    if (i < chunks.length - 1) await sleep(RATE_LIMIT_DELAY_MS);
  }

  console.log(`   ✅ Extracted ${allRecs.length} recommendations`);
  return allRecs;
}

async function main() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not set in .env.local");

  const groq = new Groq({ apiKey });

  const outputPath = path.join(PIPELINE_DIR, "recommendations.json");
  const existing: RecommendationEntry[] = fs.existsSync(outputPath)
    ? JSON.parse(fs.readFileSync(outputPath, "utf-8"))
    : [];

  const processedGuidelines = new Set(existing.map((r) => r.guideline));
  const allRecs: RecommendationEntry[] = [...existing];

  const pdfFiles = fs.readdirSync(PDF_DIR).filter((f) => f.toLowerCase().endsWith(".pdf"));
  console.log(`Found ${pdfFiles.length} PDFs`);

  for (const pdfFile of pdfFiles) {
    const guidelineName = pdfFile.replace(/\.pdf$/i, "");
    if (processedGuidelines.has(guidelineName)) {
      console.log(`\n⏭️  Skipping: ${guidelineName}`);
      continue;
    }

    const recs = await processPDF(pdfFile, groq);
    allRecs.push(...recs);
    fs.writeFileSync(outputPath, JSON.stringify(allRecs, null, 2));
  }

  console.log(`\n✅ Done! Total recommendations: ${allRecs.length}`);
}

main().catch(console.error);
