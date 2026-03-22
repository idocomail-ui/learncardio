/**
 * Script 1: Extract figures from ESC guideline PDFs
 *
 * Uses pdfjs-dist + canvas (pure Node.js, no ImageMagick/Ghostscript needed)
 * Finds pages with figure captions, renders those pages as PNG images.
 *
 * Run: npm run pipeline:figures
 */

import fs from "fs";
import path from "path";
import * as canvas from "canvas";

const PDF_DIR = path.join(process.cwd(), "data/pdfs");
const FIGURES_DIR = path.join(process.cwd(), "data/figures");
const PIPELINE_DIR = path.join(process.cwd(), "data/pipeline");

export interface FigureEntry {
  guideline: string;
  guidelineSlug: string;
  figureNumber: number;
  caption: string;
  page: number;
  imagePath: string;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function getPdfjsLib() {
  // Use legacy build for Node.js compatibility
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs" as string) as typeof import("pdfjs-dist");
  return pdfjsLib;
}

async function extractPageTexts(pdfPath: string): Promise<string[]> {
  const pdfjsLib = await getPdfjsLib();
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjsLib.getDocument({ data }).promise;
  const pageTexts: string[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item: { str?: string }) => item.str ?? "")
      .join(" ");
    pageTexts.push(text);
  }

  return pageTexts;
}

function findFigurePages(
  pageTexts: string[]
): Array<{ page: number; caption: string; figureNumber: number }> {
  const results: Array<{ page: number; caption: string; figureNumber: number }> = [];
  const seen = new Set<number>();
  // Only match figure numbers 1-150 to avoid false positives like "Figure 4052"
  const figureRegex = /\b(?:Figure|Fig\.?)\s+(\d{1,3})\b/gi;

  for (let i = 0; i < pageTexts.length; i++) {
    let match: RegExpExecArray | null;
    figureRegex.lastIndex = 0;

    while ((match = figureRegex.exec(pageTexts[i])) !== null) {
      const figureNumber = parseInt(match[1], 10);
      if (figureNumber < 1 || figureNumber > 150) continue;
      if (!seen.has(figureNumber)) {
        seen.add(figureNumber);
        const afterMatch = pageTexts[i].slice(match.index, match.index + 200);
        results.push({
          page: i + 1,
          caption: afterMatch.trim().slice(0, 180),
          figureNumber,
        });
      }
    }
  }

  return results.sort((a, b) => a.figureNumber - b.figureNumber);
}

async function renderPageAsPng(
  pdfPath: string,
  pageNum: number,
  outputPath: string,
  scale = 2.0
): Promise<void> {
  const pdfjsLib = await getPdfjsLib();
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjsLib.getDocument({ data }).promise;
  const page = await doc.getPage(pageNum);
  const viewport = page.getViewport({ scale });

  // Create canvas
  const canvasEl = canvas.createCanvas(
    Math.floor(viewport.width),
    Math.floor(viewport.height)
  );
  const ctx = canvasEl.getContext("2d");

  // White background
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvasEl.width, canvasEl.height);

  // pdfjs needs a special canvas factory
  const canvasFactory = {
    create(w: number, h: number) {
      const c = canvas.createCanvas(w, h);
      return { canvas: c, context: c.getContext("2d") };
    },
    reset(pair: { canvas: ReturnType<typeof canvas.createCanvas>; context: ReturnType<ReturnType<typeof canvas.createCanvas>["getContext"]> }, w: number, h: number) {
      pair.canvas.width = w;
      pair.canvas.height = h;
    },
    destroy() {},
  };

  const renderTask = page.render({
    canvasContext: ctx as unknown as CanvasRenderingContext2D,
    viewport,
    canvasFactory,
  } as Parameters<typeof page.render>[0]);

  await renderTask.promise;

  // Save as PNG
  const buffer = canvasEl.toBuffer("image/png");
  fs.writeFileSync(outputPath, buffer);
}

async function processPDF(pdfFile: string): Promise<FigureEntry[]> {
  const pdfPath = path.join(PDF_DIR, pdfFile);
  const guidelineName = pdfFile.replace(/\.pdf$/i, "");
  const slug = slugify(guidelineName);
  const outputDir = path.join(FIGURES_DIR, slug);

  fs.mkdirSync(outputDir, { recursive: true });

  console.log(`\n📄 Processing: ${guidelineName}`);

  const pageTexts = await extractPageTexts(pdfPath);
  const figurePagesFound = findFigurePages(pageTexts);

  console.log(`   Found ${figurePagesFound.length} figures across ${pageTexts.length} pages`);

  const entries: FigureEntry[] = [];

  for (const fig of figurePagesFound) {
    const outputPath = path.join(outputDir, `fig_${fig.figureNumber}.png`);
    const relPath = path.relative(process.cwd(), outputPath);

    console.log(`   Rendering Figure ${fig.figureNumber} (page ${fig.page})...`);

    try {
      await renderPageAsPng(pdfPath, fig.page, outputPath);
      entries.push({
        guideline: guidelineName,
        guidelineSlug: slug,
        figureNumber: fig.figureNumber,
        caption: fig.caption,
        page: fig.page,
        imagePath: relPath,
      });
    } catch (err) {
      console.warn(`   ⚠️  Failed Figure ${fig.figureNumber}:`, (err as Error).message);
    }
  }

  return entries;
}

async function main() {
  fs.mkdirSync(FIGURES_DIR, { recursive: true });
  fs.mkdirSync(PIPELINE_DIR, { recursive: true });

  const pdfFiles = fs.readdirSync(PDF_DIR).filter((f) =>
    f.toLowerCase().endsWith(".pdf")
  );
  console.log(`Found ${pdfFiles.length} PDFs to process`);

  // Support resuming
  const outputPath = path.join(PIPELINE_DIR, "figures.json");
  const existing: FigureEntry[] = fs.existsSync(outputPath)
    ? JSON.parse(fs.readFileSync(outputPath, "utf-8"))
    : [];
  const processedGuidelines = new Set(existing.map((f) => f.guideline));

  const allFigures: FigureEntry[] = [...existing];

  for (const pdfFile of pdfFiles) {
    const guidelineName = pdfFile.replace(/\.pdf$/i, "");
    if (processedGuidelines.has(guidelineName)) {
      console.log(`\n⏭️  Skipping (already done): ${guidelineName}`);
      continue;
    }

    const figures = await processPDF(pdfFile);
    allFigures.push(...figures);

    // Save after each guideline (resume-safe)
    fs.writeFileSync(outputPath, JSON.stringify(allFigures, null, 2));
  }

  console.log(`\n✅ Done! Extracted ${allFigures.length} figures total`);
  console.log(`📝 Manifest: ${outputPath}`);
}

main().catch(console.error);
