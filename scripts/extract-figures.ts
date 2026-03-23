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

function isTocPage(text: string): boolean {
  // TOC pages have many dot sequences like "Figure 1 .............. 42"
  const dotSequences = (text.match(/\.{5,}/g) ?? []).length;
  return dotSequences >= 3;
}

function findFigurePages(
  pageTexts: string[]
): Array<{ page: number; caption: string; figureNumber: number }> {
  // Map figureNumber -> all occurrences (page, caption)
  const occurrences = new Map<number, Array<{ page: number; caption: string }>>();
  const figureRegex = /\b(?:Figure|Fig\.?)\s+(\d{1,3})\b/gi;

  for (let i = 0; i < pageTexts.length; i++) {
    const text = pageTexts[i];
    // Skip TOC pages — they list all figures but aren't the actual figure pages
    if (isTocPage(text)) continue;

    let match: RegExpExecArray | null;
    figureRegex.lastIndex = 0;

    while ((match = figureRegex.exec(text)) !== null) {
      const figureNumber = parseInt(match[1], 10);
      if (figureNumber < 1 || figureNumber > 150) continue;
      const afterMatch = text.slice(match.index, match.index + 300);
      // Skip if this looks like a reference within a TOC-style line
      if (/\.{5,}/.test(afterMatch)) continue;
      if (!occurrences.has(figureNumber)) occurrences.set(figureNumber, []);
      occurrences.get(figureNumber)!.push({
        page: i + 1,
        caption: afterMatch.trim().slice(0, 180),
      });
    }
  }

  // For each figure, pick the first non-TOC occurrence (the actual figure page)
  const results: Array<{ page: number; caption: string; figureNumber: number }> = [];
  for (const [figureNumber, occ] of occurrences.entries()) {
    results.push({ figureNumber, ...occ[0] });
  }

  return results.sort((a, b) => a.figureNumber - b.figureNumber);
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

  // Only build the manifest — rendering is done by render-figures.py (PyMuPDF)
  return figurePagesFound.map((fig) => {
    const outputPath = path.join(outputDir, `fig_${fig.figureNumber}.png`);
    const relPath = path.relative(process.cwd(), outputPath);
    console.log(`   Figure ${fig.figureNumber} → page ${fig.page}`);
    return {
      guideline: guidelineName,
      guidelineSlug: slug,
      figureNumber: fig.figureNumber,
      caption: fig.caption,
      page: fig.page,
      imagePath: relPath,
    };
  });
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
