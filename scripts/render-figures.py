"""
Re-render figure pages from PDFs using PyMuPDF (fitz).
Reads figures.json for page numbers, renders each page as a high-quality PNG.

Run: python3 scripts/render-figures.py
"""

import json
import os
import sys
import fitz  # PyMuPDF

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDF_DIR = os.path.join(BASE_DIR, "data/pdfs")
FIGURES_DIR = os.path.join(BASE_DIR, "data/figures")
FIGURES_JSON = os.path.join(BASE_DIR, "data/pipeline/figures.json")

def find_pdf(guideline_name):
    """Find PDF file matching the guideline name."""
    for f in os.listdir(PDF_DIR):
        if f.lower().endswith(".pdf") and f[:-4].lower() == guideline_name.lower():
            return os.path.join(PDF_DIR, f)
    # Fuzzy match
    for f in os.listdir(PDF_DIR):
        if f.lower().endswith(".pdf") and guideline_name.lower() in f.lower():
            return os.path.join(PDF_DIR, f)
    return None

def render_page(pdf_path, page_num, output_path, dpi=150):
    """Render a single PDF page as PNG at given DPI."""
    doc = fitz.open(pdf_path)
    page = doc[page_num - 1]  # 0-indexed
    mat = fitz.Matrix(dpi / 72, dpi / 72)  # 72 is base DPI
    pix = page.get_pixmap(matrix=mat, alpha=False)
    pix.save(output_path)
    doc.close()
    return os.path.getsize(output_path)

def main():
    with open(FIGURES_JSON) as f:
        figures = json.load(f)

    print(f"Rendering {len(figures)} figures...")

    # Group by guideline to open each PDF once
    by_guideline = {}
    for fig in figures:
        key = fig["guideline"]
        by_guideline.setdefault(key, []).append(fig)

    total = 0
    errors = 0

    for guideline, figs in by_guideline.items():
        pdf_path = find_pdf(guideline)
        if not pdf_path:
            print(f"  ⚠️  PDF not found for: {guideline}")
            errors += len(figs)
            continue

        slug = figs[0]["guidelineSlug"]
        out_dir = os.path.join(FIGURES_DIR, slug)
        os.makedirs(out_dir, exist_ok=True)

        print(f"\n📄 {guideline} ({len(figs)} figures)")

        for fig in sorted(figs, key=lambda x: x["figureNumber"]):
            out_path = os.path.join(out_dir, f"fig_{fig['figureNumber']}.png")
            try:
                size = render_page(pdf_path, fig["page"], out_path)
                kb = size / 1024
                status = "✓" if kb > 20 else "⚠️  (small, may be blank)"
                print(f"   Fig {fig['figureNumber']:3d} p{fig['page']:3d} → {kb:.0f}KB {status}")
                total += 1
            except Exception as e:
                print(f"   ✗ Fig {fig['figureNumber']}: {e}")
                errors += 1

    print(f"\n✅ Done: {total} rendered, {errors} errors")
    print("Now re-run: npm run pipeline:seed  (to upload new images to Supabase)")

if __name__ == "__main__":
    main()
