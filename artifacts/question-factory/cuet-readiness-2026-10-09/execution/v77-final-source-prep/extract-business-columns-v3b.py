import json
from pathlib import Path

import pdfplumber

ROOT = Path("artifacts/question-factory/cuet-readiness-2026-10-09/execution/v77-final-source-prep")
CONFIG = {
    "lebs106": {2: {"left": (35, 45, 250), "right": (255, 45, 490)}},
    "lebs203": {
        7: {"left": (35, 45, 262), "right": (280, 45, 490)},
        8: {"left": (35, 45, 262), "right": (262, 45, 490)},
    },
}

for doc, pages in CONFIG.items():
    records = []
    with pdfplumber.open(ROOT / "ncert" / f"{doc}.pdf") as pdf:
        for number, columns in pages.items():
            page = pdf.pages[number - 1]
            for column, (x0, y0, x1) in columns.items():
                bbox = (x0, y0, x1, page.height - 45)
                text = page.crop(bbox).extract_text(x_tolerance=2, y_tolerance=3) or ""
                records.append({"doc": doc, "physical_pdf_page": number, "column": column,
                                "bbox_points": list(bbox), "page_size_points": [page.width, page.height],
                                "text": text})
    out = ROOT / "ncert" / f"{doc}.columns-v3b.json"
    out.write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(out), "record_count": len(records)}))
