"""Local source acquisition aid, never academic authentication or publication.

NTA's 2025 final keys use answer positions; 2026 uses official option IDs.
Preserve that distinction and every dropped/multiple-answer row for matching.
"""
from pathlib import Path
from pypdf import PdfReader
import hashlib
import json
import re
import sys

root = Path(sys.argv[1] if len(sys.argv) > 1 else "data/question-factory-runtime/source-foundation")
subjects = {"101": "english", "301": "accountancy", "305": "business_studies", "309": "economics"}
reports = []
for year in (2025, 2026):
    file = root / f"cuet-{year}-final-keys.pdf"
    reader = PdfReader(file)
    entries, pages = [], []
    for index, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        subject = re.search(r"Subject\s*:\s*(101|301|305|309)\s*-", text)
        if not subject:
            continue
        subject = subjects[subject.group(1)]
        pages.append({"page": index + 1, "subject": subject, "text": text})
        date = re.search(r"Exam Date\s*:\s*(.*?)\s+Subject", text, re.S)
        for line in text.splitlines():
            row = re.fullmatch(r"\s*(\d{10,})\s+(DROP|\d+(?:\s*,\s*\d+)*)\s*", line)
            if not row:
                continue
            qid, raw = row.groups()
            keys = [] if raw == "DROP" else re.findall(r"\d+", raw)
            single = len(keys) == 1
            key_format = "position" if year == 2025 else "option_id"
            if key_format == "position" and any(key not in ("1", "2", "3", "4") for key in keys):
                raise ValueError("Unexpected answer position; inspect the source layout")
            entries.append({"year": year, "subject": subject, "page": index + 1,
                            "exam_date_shift": date.group(1).strip() if date else None,
                            "official_question_id": qid, "key_raw": raw, "key_quote": line.strip(),
                            "key_format": key_format, "official_key_values": keys,
                            "key_status": "single" if single else "multiple" if keys else "dropped",
                            "correct_position": int(keys[0]) if single and key_format == "position" else None,
                            "final_key_option_id": keys[0] if single and key_format == "option_id" else None,
                            "reuse_permitted": False})
    (root / f"cuet-{year}-target-pages.json").write_text(json.dumps(pages, indent=2, ensure_ascii=False), encoding="utf-8")
    extraction = root / f"cuet-{year}-key-entries.json"
    extraction.write_text(json.dumps(entries, indent=2), encoding="utf-8")
    reports.append({"year": year, "document_pages": len(reader.pages), "target_pages": len(pages),
                    "parsed_key_rows": len(entries), "single_answer_rows": sum(e["key_status"] == "single" for e in entries),
                    "excluded_rows": sum(e["key_status"] != "single" for e in entries),
                    "subjects": {s: sum(e["subject"] == s for e in entries) for s in subjects.values()},
                    "extraction_sha256": hashlib.sha256(extraction.read_bytes()).hexdigest(),
                    "state": "provisional_extraction_not_authenticated_anchors", "reuse_permitted": False})
(root / "extraction-report.json").write_text(json.dumps(reports, indent=2), encoding="utf-8")
print(json.dumps(reports))
