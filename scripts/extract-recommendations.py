"""
Extract ESC guideline recommendations directly from PDF tables using PyMuPDF.
No AI / API calls needed — finds tables by their borders and extracts rows
where Class (I/IIa/IIb/III) and LOE (A/B/C) columns are present.

Run: python3 scripts/extract-recommendations.py
Then: npm run pipeline:ai-content   (re-enrich explanations)
Then: npm run pipeline:seed         (upload to Supabase)
"""

import fitz  # PyMuPDF
import re
import json
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDF_DIR = os.path.join(BASE_DIR, "data/pdfs")
PIPELINE_DIR = os.path.join(BASE_DIR, "data/pipeline")
OUTPUT_JSON = os.path.join(PIPELINE_DIR, "recommendations.json")

VALID_CLASSES = {"I", "IIa", "IIb", "III"}
VALID_LOES = {"A", "B", "C"}


def slugify(name):
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", name.lower())).strip("-")


def clean(cell):
    """Normalise a table cell: strip whitespace and ligatures."""
    if cell is None:
        return ""
    s = str(cell)
    # Replace common ligatures (fi, fl, ff) that PDFs encode as single chars
    s = s.replace("\ufb01", "fi").replace("\ufb02", "fl").replace("\ufb00", "ff")
    return re.sub(r"\s+", " ", s).strip()


def is_class(val):
    return clean(val) in VALID_CLASSES


def is_loe(val):
    return clean(val) in VALID_LOES


def find_class_loe_cols(header_rows, data_rows):
    """
    Detect which column indices hold Class and LOE values.
    Looks at actual data rows (not just header text) for robustness.
    Returns (class_col, loe_col) or (None, None).
    """
    if not data_rows:
        return None, None

    n_cols = max(len(r) for r in data_rows)
    class_votes = [0] * n_cols
    loe_votes = [0] * n_cols

    for row in data_rows:
        for ci, cell in enumerate(row):
            v = clean(cell)
            if v in VALID_CLASSES:
                class_votes[ci] += 1
            if v in VALID_LOES:
                loe_votes[ci] += 1

    # Also check header rows for "Class" / "Level" / "LOE" keywords
    for row in header_rows:
        for ci, cell in enumerate(row):
            v = clean(cell).lower()
            if "class" in v:
                class_votes[ci] = class_votes[ci] + 5 if ci < n_cols else 5
            if "level" in v or "loe" in v:
                loe_votes[ci] = loe_votes[ci] + 5 if ci < n_cols else 5

    class_col = class_votes.index(max(class_votes)) if max(class_votes) > 0 else None
    loe_col = loe_votes.index(max(loe_votes)) if max(loe_votes) > 0 else None

    if class_col == loe_col:
        # Try to break the tie: pick the next-best for loe
        sorted_loe = sorted(range(n_cols), key=lambda i: loe_votes[i], reverse=True)
        for ci in sorted_loe:
            if ci != class_col:
                loe_col = ci
                break

    return class_col, loe_col


def extract_text_col(row, class_col, loe_col, n_cols):
    """
    Pick the column that most likely contains the recommendation text.
    Heuristic: the longest non-Class/non-LOE column.
    """
    candidates = []
    for ci, cell in enumerate(row):
        if ci == class_col or ci == loe_col:
            continue
        v = clean(cell)
        if v:
            candidates.append((len(v), ci, v))
    if not candidates:
        return ""
    candidates.sort(reverse=True)
    return candidates[0][2]


def extract_table_recs(table, page_num):
    """
    Given a PyMuPDF table object, return list of
    {"text": str, "class": str, "loe": str, "page": int}.
    """
    rows = table.extract()
    if not rows or len(rows) < 2:
        return []

    n_cols = max(len(r) for r in rows)

    # Split header (rows without Class/LOE data) from data rows
    header_rows = []
    data_rows = []
    for row in rows:
        padded = list(row) + [""] * (n_cols - len(row))
        has_class = any(clean(c) in VALID_CLASSES for c in padded)
        has_loe = any(clean(c) in VALID_LOES for c in padded)
        if has_class or has_loe:
            data_rows.append(padded)
        else:
            header_rows.append(padded)

    if not data_rows:
        return []

    class_col, loe_col = find_class_loe_cols(header_rows, data_rows)
    if class_col is None or loe_col is None:
        return []

    recs = []
    pending_text = ""  # accumulate multi-row recommendation text

    for row in rows:
        padded = list(row) + [""] * (n_cols - len(row))
        cls = clean(padded[class_col]) if class_col < len(padded) else ""
        loe = clean(padded[loe_col]) if loe_col < len(padded) else ""
        text = extract_text_col(padded, class_col, loe_col, n_cols)

        if cls in VALID_CLASSES and loe in VALID_LOES:
            # Combine pending text if this row's text is short (continuation)
            full_text = (pending_text + " " + text).strip() if pending_text else text
            pending_text = ""
            if full_text and len(full_text) > 10:
                recs.append({"text": full_text, "class": cls, "loe": loe, "page": page_num})
        else:
            # Accumulate section headers / continuation text
            if text and len(text) > 15:
                pending_text = (pending_text + " " + text).strip()
            else:
                pending_text = ""

    # Handle 6-col comparison tables (old vs new recs side by side)
    # If we got 0 recs but n_cols >= 6, try splitting into two halves
    if not recs and n_cols >= 6:
        mid = n_cols // 2
        for row in rows:
            padded = list(row) + [""] * (n_cols - len(row))
            left = padded[:mid]
            right = padded[mid:]
            for half in [left, right]:
                h_class = next((clean(c) for c in half if clean(c) in VALID_CLASSES), None)
                h_loe = next((clean(c) for c in half if clean(c) in VALID_LOES), None)
                if h_class and h_loe:
                    h_text = max((clean(c) for c in half
                                  if clean(c) not in VALID_CLASSES
                                  and clean(c) not in VALID_LOES),
                                 key=len, default="")
                    if h_text and len(h_text) > 10:
                        recs.append({"text": h_text, "class": h_class, "loe": h_loe, "page": page_num})

    return recs


def process_pdf(pdf_path, guideline_name):
    slug = slugify(guideline_name)
    doc = fitz.open(pdf_path)
    n_pages = doc.page_count

    print(f"\n📄 {guideline_name} ({n_pages} pages)")

    all_recs = []
    seen_texts = set()

    for i in range(n_pages):
        page = doc[i]
        page_num = i + 1

        try:
            tabs = page.find_tables()
        except Exception:
            continue

        for tab in tabs.tables:
            page_recs = extract_table_recs(tab, page_num)
            for rec in page_recs:
                key = rec["text"][:80].lower()
                if key in seen_texts:
                    continue
                seen_texts.add(key)
                all_recs.append({
                    "guideline": guideline_name,
                    "guidelineSlug": slug,
                    "recommendationNumber": len(all_recs) + 1,
                    "class": rec["class"],
                    "loe": rec["loe"],
                    "text": rec["text"],
                    "page": rec["page"],
                })

    doc.close()
    print(f"   ✅ {len(all_recs)} recommendations extracted")
    return all_recs


def main():
    pdf_files = sorted(f for f in os.listdir(PDF_DIR) if f.lower().endswith(".pdf"))
    print(f"Processing {len(pdf_files)} PDFs...")

    all_recs = []
    for pdf_file in pdf_files:
        guideline_name = pdf_file[:-4]
        pdf_path = os.path.join(PDF_DIR, pdf_file)
        recs = process_pdf(pdf_path, guideline_name)
        all_recs.extend(recs)

        with open(OUTPUT_JSON, "w") as f:
            json.dump(all_recs, f, indent=2)

    print(f"\n✅ Done: {len(all_recs)} total recommendations")
    print(f"📝 Saved to {OUTPUT_JSON}")
    print(f"\nNext: npm run pipeline:ai-content  (re-enrich explanations)")
    print(f"Then: npm run pipeline:seed         (upload to Supabase)")


if __name__ == "__main__":
    main()
