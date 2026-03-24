"""
Extract figure pages and render them using PyMuPDF.

Strategy: find pages that BOTH:
  1. Contain a "Figure X" caption label (as standalone text, not mid-sentence)
  2. Have significant graphical content (embedded images or vector drawings)

This avoids false positives from body text that references figures.

Run: python3 scripts/extract-and-render-figures.py
Then re-seed: npm run pipeline:seed
"""

import json
import os
import re
import fitz  # PyMuPDF

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDF_DIR = os.path.join(BASE_DIR, "data/pdfs")
FIGURES_DIR = os.path.join(BASE_DIR, "data/figures")
PIPELINE_DIR = os.path.join(BASE_DIR, "data/pipeline")
OUTPUT_JSON = os.path.join(PIPELINE_DIR, "figures.json")

DPI = 150

def slugify(name):
    return re.sub(r'-+', '-', re.sub(r'[^a-z0-9]+', '-', name.lower())).strip('-')

def page_has_graphics(page):
    """Check if page has substantial visual content (images or vector drawings)."""
    # Check for raster images
    images = page.get_images(full=False)
    if images:
        return True
    # Check for vector drawings (lines, rectangles, curves)
    drawings = page.get_drawings()
    # Filter trivial drawings (single lines, borders) — require at least 5 paths
    significant = [d for d in drawings if d.get("items") and len(d["items"]) > 1]
    return len(significant) >= 5

def find_figure_captions(page):
    """
    Find figure numbers whose captions appear on this page.
    Caption pattern: 'Figure X' or 'Fig. X' at the start of a text block,
    possibly followed by '.' ':' or a space then description.
    We look for it as a standalone label, not mid-sentence.
    """
    found = set()
    # Get text blocks with their bounding boxes
    blocks = page.get_text("blocks")  # (x0, y0, x1, y1, text, block_no, block_type)
    for block in blocks:
        text = block[4].strip()
        if not text:
            continue
        # Match "Figure X" or "Fig. X" at start of block (caption format)
        # Require it to be at the START of the text block
        m = re.match(r'^(?:Figure|Fig\.?)\s+(\d{1,3})\b', text, re.IGNORECASE)
        if m:
            num = int(m.group(1))
            if 1 <= num <= 150:
                found.add(num)
    return found

def find_figure_captions_fallback(page):
    """
    Fallback: search entire page text for figure caption patterns.
    Used when strict block-start matching finds nothing.
    """
    found = {}
    text = page.get_text()
    # Look for patterns like "Figure 1." "Figure 1:" "Figure 1 " at line start
    for m in re.finditer(r'(?:^|\n)\s*(?:Figure|Fig\.?)\s+(\d{1,3})[.:\s]', text, re.IGNORECASE | re.MULTILINE):
        num = int(m.group(1))
        if 1 <= num <= 150:
            if num not in found:
                # Get surrounding text as caption
                start = m.start()
                found[num] = text[start:start+200].strip()
    return found

def get_figure_crop(page, fig_num):
    """
    Crop to just the figure + caption area.
    - Find caption 'Figure X' text block → gives bottom boundary
    - Find topmost image/drawing above the caption → gives top boundary
    Returns None to render full page if crop cannot be determined.
    """
    page_rect = page.rect
    pw, ph = page_rect.width, page_rect.height

    # Find caption block
    caption_y0 = caption_y1 = None
    for block in page.get_text("blocks"):
        x0, y0, x1, y1, text, *_ = block
        if re.match(rf'^(?:Figure|Fig\.?)\s+{fig_num}\b', text.strip(), re.IGNORECASE):
            caption_y0, caption_y1 = y0, y1
            break

    if caption_y0 is None:
        return None

    graphic_top = caption_y0  # fallback: start at caption

    # Use get_image_info() — reliable dict-based API with 'bbox' key
    for info in page.get_image_info():
        bbox = fitz.Rect(info['bbox'])
        if bbox.y1 <= caption_y0 + 20 and bbox.height > 10 and bbox.width > 10:
            graphic_top = min(graphic_top, bbox.y0)

    # If no images found, look for substantial vector drawing clusters
    if graphic_top >= caption_y0 - 20:
        for drawing in page.get_drawings():
            r = drawing.get("rect")
            if not r:
                continue
            # Skip thin decorative lines and full-width dividers
            if r.height < 5 or r.width < 30:
                continue
            if r.y1 <= caption_y0 + 20:
                graphic_top = min(graphic_top, r.y0)

    top = max(0, graphic_top - 12)
    bottom = min(ph, caption_y1 + 15)

    # Need at least 12% of page height to be a useful crop
    if (bottom - top) < ph * 0.12:
        return None

    return fitz.Rect(0, top, pw, bottom)


def process_pdf(pdf_path, guideline_name):
    slug = slugify(guideline_name)
    out_dir = os.path.join(FIGURES_DIR, slug)
    os.makedirs(out_dir, exist_ok=True)

    doc = fitz.open(pdf_path)
    n_pages = doc.page_count
    print(f"\n📄 {guideline_name} ({n_pages} pages)")

    # Pass 1: find pages with graphics + figure captions (strict)
    figure_pages = {}  # figure_num -> (page_num_1indexed, caption_text)
    graphic_pages = set()

    for i in range(n_pages):
        page = doc[i]
        has_gfx = page_has_graphics(page)
        if has_gfx:
            graphic_pages.add(i + 1)
        captions = find_figure_captions(page)
        for num in captions:
            if num not in figure_pages and has_gfx:
                text = page.get_text()
                m = re.search(r'(?:Figure|Fig\.?)\s+' + str(num) + r'[.:\s][^\n]{0,200}', text, re.IGNORECASE)
                caption = m.group(0).strip() if m else f"Figure {num}"
                figure_pages[num] = (i + 1, caption[:180])

    # Pass 2: fallback for figures not found with graphics requirement
    caption_only_pages = {}
    for i in range(n_pages):
        page = doc[i]
        text = page.get_text()
        for m in re.finditer(r'(?:^|\n)\s*(?:Figure|Fig\.?)\s+(\d{1,3})[.:\s]', text, re.IGNORECASE | re.MULTILINE):
            num = int(m.group(1))
            if 1 <= num <= 150 and num not in figure_pages:
                caption_text = text[m.start():m.start()+200].strip()
                caption_only_pages.setdefault(num, []).append((i + 1, caption_text[:180]))

    for num, occurrences in caption_only_pages.items():
        if num in figure_pages:
            continue
        best = min(occurrences, key=lambda x: min((abs(x[0] - gp) for gp in graphic_pages), default=999))
        figure_pages[num] = best

    print(f"   Found {len(figure_pages)} figures | {len(graphic_pages)} graphic pages")

    # Render and save (with cropping)
    entries = []
    for num in sorted(figure_pages.keys()):
        page_1indexed, caption = figure_pages[num]
        out_path = os.path.join(out_dir, f"fig_{num}.png")
        rel_path = os.path.relpath(out_path, BASE_DIR)

        page = doc[page_1indexed - 1]
        crop = get_figure_crop(page, num)
        mat = fitz.Matrix(DPI / 72, DPI / 72)

        if crop:
            pix = page.get_pixmap(matrix=mat, clip=crop, alpha=False)
            cropped = "✂"
        else:
            pix = page.get_pixmap(matrix=mat, alpha=False)
            cropped = "🖼"

        pix.save(out_path)
        kb = os.path.getsize(out_path) / 1024
        print(f"   {cropped} Fig {num:3d} p{page_1indexed:3d} → {kb:.0f}KB")

        entries.append({
            "guideline": guideline_name,
            "guidelineSlug": slug,
            "figureNumber": num,
            "caption": caption,
            "page": page_1indexed,
            "imagePath": rel_path,
        })

    doc.close()
    return entries

def main():
    pdf_files = sorted(f for f in os.listdir(PDF_DIR) if f.lower().endswith(".pdf"))
    print(f"Processing {len(pdf_files)} PDFs...")

    all_figures = []
    for pdf_file in pdf_files:
        guideline_name = pdf_file[:-4]  # strip .pdf
        pdf_path = os.path.join(PDF_DIR, pdf_file)
        entries = process_pdf(pdf_path, guideline_name)
        all_figures.extend(entries)

        # Save after each guideline
        with open(OUTPUT_JSON, "w") as f:
            json.dump(all_figures, f, indent=2)

    print(f"\n✅ Done: {len(all_figures)} figures extracted and rendered")
    print(f"📝 Manifest: {OUTPUT_JSON}")
    print(f"\nNext: npm run pipeline:ai-content  (re-enrich new captions)")
    print(f"Then: npm run pipeline:seed         (upload to Supabase)")

if __name__ == "__main__":
    main()
