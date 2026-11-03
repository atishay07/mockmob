import hashlib
import json
from pathlib import Path

import pdfplumber

ROOT = Path("artifacts/question-factory/cuet-readiness-2026-10-09/execution/v77-final-source-prep")

PAGES = {
    "lebs106": {2: {"left": (35, 45, 250), "right": (255, 45, 490)},
                6: {"left": (35, 45, 250), "right": (255, 45, 490)},
                28: {"left": (35, 45, 250), "right": (255, 45, 490)}},
    "lebs203": {7: {"left": (35, 45, 265), "right": (285, 45, 490)},
                8: {"left": (35, 45, 265), "right": (285, 45, 490)}},
}

for doc, page_specs in PAGES.items():
    pdf_path = ROOT / "ncert" / f"{doc}.pdf"
    records = []
    with pdfplumber.open(pdf_path) as pdf:
        for physical_page, columns in page_specs.items():
            page = pdf.pages[physical_page - 1]
            for name, (x0, y0, x1) in columns.items():
                bbox = (x0, y0, x1, page.height - 45)
                crop = page.crop(bbox)
                records.append({
                    "doc": doc,
                    "physical_pdf_page": physical_page,
                    "column": name,
                    "bbox_points": list(bbox),
                    "page_size_points": [page.width, page.height],
                    "text": crop.extract_text(x_tolerance=2, y_tolerance=3) or "",
                })
    output = ROOT / "ncert" / f"{doc}.columns-v3.json"
    output.write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(output), "sha256": hashlib.sha256(output.read_bytes()).hexdigest(), "records": len(records)}))
