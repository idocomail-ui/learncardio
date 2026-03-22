/**
 * Script 5: Seed Supabase database with all pipeline output
 *
 * Uploads:
 * 1. Figure images to Supabase Storage
 * 2. Guidelines table
 * 3. Figures table (with storage URLs)
 * 4. Recommendations table
 * 5. Questions table
 *
 * Run: npm run pipeline:seed
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import type { EnrichedFigure, EnrichedRecommendation } from "./generate-ai-content";
import type { Question } from "./generate-questions";

const PIPELINE_DIR = path.join(process.cwd(), "data/pipeline");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSupabase(): ReturnType<typeof createClient<any>> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

async function uploadFigureImage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: ReturnType<typeof createClient<any>>,
  localPath: string,
  storagePath: string
): Promise<string | null> {
  const fullPath = path.join(process.cwd(), localPath);
  if (!fs.existsSync(fullPath)) return null;

  const fileBuffer = fs.readFileSync(fullPath);

  const { error } = await supabase.storage
    .from("figures")
    .upload(storagePath, fileBuffer, {
      contentType: "image/png",
      upsert: true,
    });

  if (error) {
    console.warn(`  Failed to upload ${storagePath}:`, error.message);
    return null;
  }

  const { data } = supabase.storage.from("figures").getPublicUrl(storagePath);
  return data.publicUrl;
}

async function main() {
  const supabase = getSupabase();

  // Load pipeline data
  const figures: EnrichedFigure[] = JSON.parse(
    fs.readFileSync(path.join(PIPELINE_DIR, "figures-enriched.json"), "utf-8")
  );
  const recommendations: EnrichedRecommendation[] = JSON.parse(
    fs.readFileSync(path.join(PIPELINE_DIR, "recommendations-enriched.json"), "utf-8")
  );
  const questions: Question[] = JSON.parse(
    fs.readFileSync(path.join(PIPELINE_DIR, "questions.json"), "utf-8")
  );

  console.log(`Seeding: ${figures.length} figures, ${recommendations.length} recommendations, ${questions.length} questions`);

  // 1. Upsert guidelines
  const guidelineSlugs = [...new Set([
    ...figures.map((f) => f.guidelineSlug),
    ...recommendations.map((r) => r.guidelineSlug),
  ])];

  const guidelineRows = guidelineSlugs.map((slug) => {
    const name = (figures.find((f) => f.guidelineSlug === slug) ||
      recommendations.find((r) => r.guidelineSlug === slug))!.guideline;
    return { slug, name };
  });

  console.log(`\nUpserting ${guidelineRows.length} guidelines...`);
  const { error: glErr } = await supabase.from("guidelines").upsert(guidelineRows, { onConflict: "slug" });
  if (glErr) throw new Error(`Guidelines upsert failed: ${glErr.message}`);

  // Fetch guideline IDs
  const { data: glData } = await supabase.from("guidelines").select("id, slug");
  const guidelineIdMap = new Map((glData ?? []).map((g: { id: string; slug: string }) => [g.slug, g.id]));

  // 2. Upload figures to storage + upsert figures table
  console.log(`\nUploading ${figures.length} figure images...`);
  const figureRows = [];

  for (let i = 0; i < figures.length; i++) {
    const fig = figures[i];
    const guidelineId = guidelineIdMap.get(fig.guidelineSlug);
    if (!guidelineId) continue;

    const storagePath = `${fig.guidelineSlug}/fig_${fig.figureNumber}.png`;
    const publicUrl = await uploadFigureImage(supabase, fig.imagePath, storagePath);

    figureRows.push({
      guideline_id: guidelineId,
      figure_number: fig.figureNumber,
      image_url: publicUrl ?? "",
      caption_original: fig.caption,
      caption_explanation: fig.explanation,
      page_number: fig.page,
    });

    if ((i + 1) % 10 === 0) {
      console.log(`  Uploaded ${i + 1}/${figures.length} figures`);
    }
  }

  const { error: figErr } = await supabase.from("figures").upsert(figureRows, {
    onConflict: "guideline_id,figure_number",
  });
  if (figErr) throw new Error(`Figures upsert failed: ${figErr.message}`);

  // 3. Upsert recommendations
  console.log(`\nUpserting ${recommendations.length} recommendations...`);
  const recRows = recommendations.map((rec) => ({
    guideline_id: guidelineIdMap.get(rec.guidelineSlug),
    recommendation_number: rec.recommendationNumber,
    class: rec.class,
    loe: rec.loe,
    original_text: rec.text,
    rephrased_text: rec.rephrasedText,
    explanation: rec.explanation,
    mini_vignette: rec.miniVignette,
    page_number: rec.page,
  })).filter((r) => r.guideline_id);

  // Batch upsert in chunks of 100
  for (let i = 0; i < recRows.length; i += 100) {
    const chunk = recRows.slice(i, i + 100);
    const { error } = await supabase.from("recommendations").upsert(chunk, {
      onConflict: "guideline_id,recommendation_number",
    });
    if (error) console.warn(`  Recommendations batch ${i}-${i + 100} error:`, error.message);
    console.log(`  Upserted ${Math.min(i + 100, recRows.length)}/${recRows.length} recommendations`);
  }

  // Fetch recommendation IDs for question linking
  const { data: recData } = await supabase
    .from("recommendations")
    .select("id, guideline_id, recommendation_number");

  const recIdMap = new Map(
    (recData ?? []).map((r: { id: string; guideline_id: string; recommendation_number: number }) =>
      [`${r.guideline_id}-${r.recommendation_number}`, r.id]
    )
  );

  // Fetch figure IDs for question linking
  const { data: figData } = await supabase
    .from("figures")
    .select("id, guideline_id, figure_number");

  const figIdMap = new Map(
    (figData ?? []).map((f: { id: string; guideline_id: string; figure_number: number }) =>
      [`${f.guideline_id}-${f.figure_number}`, f.id]
    )
  );

  // 4. Upsert questions
  console.log(`\nUpserting ${questions.length} questions...`);
  const questionRows = questions.map((q) => {
    const guidelineId = guidelineIdMap.get(q.guidelineSlug);
    const recId = q.sourceRecommendationNumber && guidelineId
      ? recIdMap.get(`${guidelineId}-${q.sourceRecommendationNumber}`)
      : null;
    const figId = q.sourceFigureNumber && guidelineId
      ? figIdMap.get(`${guidelineId}-${q.sourceFigureNumber}`)
      : null;

    return {
      external_id: q.id,
      guideline_id: guidelineId,
      recommendation_id: recId ?? null,
      figure_id: figId ?? null,
      type: q.type,
      difficulty: q.difficulty,
      stem: q.stem,
      options: q.options,
      correct_option: q.correctOption,
      explanation: q.explanation,
    };
  }).filter((q) => q.guideline_id);

  for (let i = 0; i < questionRows.length; i += 100) {
    const chunk = questionRows.slice(i, i + 100);
    const { error } = await supabase.from("questions").upsert(chunk, {
      onConflict: "external_id",
    });
    if (error) console.warn(`  Questions batch error:`, error.message);
    if ((i + 1) % 500 === 0 || i + 100 >= questionRows.length) {
      console.log(`  Upserted ${Math.min(i + 100, questionRows.length)}/${questionRows.length} questions`);
    }
  }

  console.log(`\n✅ Database seeded successfully!`);
  console.log(`   ${guidelineRows.length} guidelines`);
  console.log(`   ${figureRows.length} figures`);
  console.log(`   ${recRows.length} recommendations`);
  console.log(`   ${questionRows.length} questions`);
}

main().catch(console.error);
