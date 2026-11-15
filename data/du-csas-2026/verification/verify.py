"""Independent check of the served DU CSAS 2026 cutoffs against the official PDFs.

This does NOT use scripts/du-csas/parse_cutoffs.py. It reads every cutoff PDF twice, with two
different PDF engines, and compares both readings with each other, with the parsed JSON and with
the files the app serves:

  Method A (pdfplumber table finder): the table grid is taken from the ruled lines DU drew; each
           cell's text is whatever falls inside that cell. Column labels come from the header words
           inside each column's x-range. Gives every row, both names and all 11 category cells,
           blanks included.
  Method B (pypdf, a separate PDF engine): every printed decimal number with its own position.
           Each number is placed in a row and column by its position on the drawn grid, then
           compared with Method A. Also checks, row by row, that pypdf's reading order gives the
           same numbers in the same order.

The verdict needs A == B everywhere. Then A is compared with data/du-csas-2026/parsed/round-*.json
(by S.NO) and with public/du/2026/offerings/*.json (by college + programme name), cell by cell,
for every row, category and round.

No network. Needs Python 3 with pdfplumber and pypdf.

Usage (from the repository root):
  python data/du-csas-2026/verification/verify.py [--source DIR]

The source PDFs are not in Git (see .gitignore); put them in data/du-csas-2026/source/ or pass
--source. Their SHA-256 must equal public/du/2026/index.json meta.sources, or the run stops.

Writes, beside this script:
  results.json        totals, document facts and every check's counts
  mismatches.csv      every cell where any two readings differ (header only when there are none)
  five-colleges.csv   every cell of the five named colleges x five programmes, all rounds
  sample-cells.csv    the seeded random sample (seed 20261115), PDF value beside served value
  flags.csv           served cells that are zero, above the maximum, or rise in a later round
Exit code 0 only when there are no mismatches.
"""
import argparse
import csv
import glob
import hashlib
import json
import logging
import os
import random
import re
import sys
from collections import Counter, defaultdict

import pdfplumber
import pypdf

logging.getLogger("pypdf").setLevel(logging.ERROR)

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
PARSED = os.path.join(ROOT, "data", "du-csas-2026", "parsed")
SERVED = os.path.join(ROOT, "public", "du", "2026")

CATEGORIES = ["UR", "OBC-NCL", "SC", "ST", "EWS", "SIKH", "PwBD", "KM", "SGC", "ORPHAN-FEMALE", "ORPHAN-MALE"]
ROUNDS = [("round-1", "cutoff-r1.pdf"), ("round-2", "cutoff-r2.pdf"), ("round-3", "minscore-r3.pdf")]
LABELS = {
    "SNO": "sno", "COLLEGENAME": "college", "PROGRAMMENAME": "programme",
    "UR": "UR", "OBCNCL": "OBC-NCL", "SC": "SC", "ST": "ST", "EWS": "EWS", "SIKH": "SIKH", "PWBD": "PwBD",
    "KM": "KM", "SGC": "SGC", "ORPHANFEMALE": "ORPHAN-FEMALE", "ORPHANMALE": "ORPHAN-MALE",
}
VALUE = re.compile(r"^\d+(\.\d+)?$")
DECIMAL = re.compile(r"(?<![\d.])\d+\.\d+(?![\d.])")
SEED = 20261115
FIVE_COLLEGES = [
    "Shri Ram College of Commerce",
    "Hindu College",
    "Miranda House (W)",
    "Hansraj College",
    "Lady Shri Ram College for Women (W)",
]
FIVE_PROGRAMMES = [
    "B.Com. (Hons.)",
    "B.A. (Hons.) Economics",
    "B.A. (Hons.) English",
    "B.A. (Hons.) Political Science",
    "B.Sc. (Hons.) Mathematics",
]
PAPER_MAX = 250  # one CUET (UG) paper: 50 questions x 5 marks (assumption, see REPORT.md)


def norm(s):
    return re.sub(r"[^a-z0-9]+", "", s.lower())


def clean(s):
    return re.sub(r"\s+", " ", (s or "").replace("\n", " ")).strip()


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


# ---------------------------------------------------------------------------------------------
# Method A: pdfplumber table finder on the ruled grid
# ---------------------------------------------------------------------------------------------
def method_a(path):
    rows, problems, pages = [], [], []
    last = None
    with pdfplumber.open(path) as pdf:
        for pno, page in enumerate(pdf.pages, start=1):
            info = {"page": pno, "rows": 0, "values": 0, "words_decimal": 0}
            words = page.extract_words()
            info["words_decimal"] = sum(1 for w in words if DECIMAL.fullmatch(w["text"]))
            tables = [t for t in page.find_tables() if any("S.NO" in (c or "") for c in (t.extract()[0] if t.extract() else []))]
            if not tables:
                info["note"] = "no table with an S.NO header"
                pages.append(info)
                continue
            if len(tables) != 1:
                problems.append(f"p{pno}: {len(tables)} cutoff tables")
            t = tables[0]
            texts = t.extract()
            trows = t.rows
            hdr = next(i for i, r in enumerate(texts) if (r[0] or "").startswith("S.NO"))
            end = hdr + 1
            while end < len(texts) and not any(re.search(r"\d", c or "") for c in texts[end]) and any(
                k in " ".join(c or "" for c in texts[end]) for k in ("NCL", "FEMALE", "MALE")
            ):
                end += 1
            band_top, band_bottom = trows[hdr].bbox[1], trows[end - 1].bbox[3]
            data = list(range(end, len(texts)))
            if not data:
                info["note"] = "header only, no data rows"
                pages.append(info)
                continue
            # Columns: the cell x-ranges of a data row; labels: header words inside each range.
            ref = next((i for i in data if re.fullmatch(r"\d+", (texts[i][0] or "").strip())), data[0])
            cols = [c for c in trows[ref].cells if c is not None]
            labels = []
            for (x0, _, x1, _) in cols:
                ws = [w for w in words if band_top - 1 <= (w["top"] + w["bottom"]) / 2 <= band_bottom + 1 and x0 <= (w["x0"] + w["x1"]) / 2 <= x1]
                ws.sort(key=lambda w: (round(w["top"]), w["x0"]))
                key = re.sub(r"[^A-Z]", "", " ".join(w["text"] for w in ws).upper())
                labels.append(LABELS.get(key, f"?{key}"))
            if sorted(labels) != sorted(["sno", "college", "programme", *CATEGORIES]):
                problems.append(f"p{pno}: header columns {labels}")
                pages.append(info)
                continue
            info["columns"] = [[lab, round(c[0], 1), round(c[2], 1)] for lab, c in zip(labels, cols)]
            for i in data:
                cells = trows[i].cells
                present = [(c, txt) for c, txt in zip(cells, texts[i]) if c is not None]
                if [round(c[0]) for c, _ in present] != [round(c[0]) for c in cols]:
                    problems.append(f"p{pno} row {i}: cell layout differs from the header columns")
                    continue
                rec = {lab: clean(txt) for lab, (_, txt) in zip(labels, present)}
                vals = {c: rec[c] for c in CATEGORIES}
                bad = [f"{c}={v!r}" for c, v in vals.items() if v and not VALUE.match(v)]
                if bad:
                    problems.append(f"p{pno} S.NO {rec['sno']!r}: non-numeric value cells {bad}")
                if not rec["sno"]:
                    if any(vals.values()):
                        problems.append(f"p{pno} row {i}: values without an S.NO: {vals}")
                    elif last is not None and i == data[0]:
                        # Tail of a name that wrapped over the page break.
                        last["college"] = clean(last["college"] + " " + rec["college"])
                        last["programme"] = clean(last["programme"] + " " + rec["programme"])
                        last["continued_on"] = pno
                    elif any((rec["college"], rec["programme"])):
                        problems.append(f"p{pno} row {i}: names without an S.NO mid-page: {rec}")
                    continue
                if not VALUE.match(rec["sno"]) or "." in rec["sno"]:
                    problems.append(f"p{pno}: S.NO cell {rec['sno']!r}")
                    continue
                band = trows[i].bbox
                row = {
                    "sno": int(rec["sno"]),
                    "college": rec["college"],
                    "programme": rec["programme"],
                    "values": {c: v for c, v in vals.items() if v},
                    "page": pno,
                    "band": [band[1], band[3]],
                    "cols": {lab: [c[0], c[2]] for lab, c in zip(labels, cols)},
                }
                rows.append(row)
                last = row
                info["rows"] += 1
                info["values"] += len(row["values"])
            pages.append(info)
    return rows, problems, pages


# ---------------------------------------------------------------------------------------------
# Method B: pypdf positions and reading order
# ---------------------------------------------------------------------------------------------
def method_b(path, a_rows):
    reader = pypdf.PdfReader(path)
    by_page = defaultdict(list)
    for r in a_rows:
        by_page[r["page"]].append(r)
    placed, problems = {}, []
    order_checked = order_bad = 0
    page_counts = []
    for pno, page in enumerate(reader.pages, start=1):
        height = float(page.mediabox.height)
        hits = []

        def visit(text, cm, tm, _font, size):
            t = (text or "").strip()
            if not re.search(r"\d", t):
                return
            if DECIMAL.findall(t) and not DECIMAL.fullmatch(t):
                problems.append(f"p{pno}: text run {text!r} holds a number and other text")
                return
            if not VALUE.fullmatch(t):
                return  # names, header and disclaimer text
            x = tm[4] * cm[0] + tm[5] * cm[2] + cm[4]
            y = tm[4] * cm[1] + tm[5] * cm[3] + cm[5]
            fs = abs(size * (tm[3] or 1) * (cm[3] or 1)) or 8
            hits.append((t, x, height - y - 0.3 * fs))

        text = page.extract_text(visitor_text=visit)
        page_counts.append({"page": pno, "decimals_pypdf": sum(1 for h in hits if "." in h[0])})
        rows = by_page.get(pno, [])
        for val, x, ymid in hits:
            row = next((r for r in rows if r["band"][0] - 0.5 <= ymid <= r["band"][1] + 0.5), None)
            if row is None:
                if "." in val:
                    problems.append(f"p{pno}: number {val} at x={x:.1f} y={ymid:.1f} is in no table row")
                continue  # a whole number outside the table is the page number
            col = next((c for c, (x0, x1) in row["cols"].items() if x0 <= x + 1 <= x1), None)
            if col == "sno" and "." not in val:
                continue
            if col not in CATEGORIES:
                problems.append(f"p{pno} S.NO {row['sno']}: number {val} at x={x:.1f} is in column {col}")
                continue
            key = (row["sno"], col)
            if key in placed:
                problems.append(f"p{pno} S.NO {row['sno']}: two numbers in {col}")
            placed[key] = val
        # Reading order: the numbers after each S.NO, up to the next S.NO, in printed order.
        start = text.find("S.NO")
        body = text[start:] if start >= 0 else ""
        snos = [r["sno"] for r in rows]
        marks = []
        pos = 0
        for s in snos:
            m = re.compile(rf"(?m)^{s}(?=\s)").search(body, pos)
            if not m:
                marks.append(None)
                continue
            marks.append((m.start(), m.end()))
            pos = m.end()
        for k, r in enumerate(rows):
            if marks[k] is None:
                problems.append(f"p{pno}: S.NO {r['sno']} not found in pypdf reading order")
                order_bad += 1
                continue
            nxt = next((m[0] for m in marks[k + 1:] if m is not None), len(body))
            seq = re.findall(r"(?<![\w.])\d+(?:\.\d+)?(?![\w.])", body[marks[k][1]:nxt])
            want = [r["values"][c] for c in CATEGORIES if c in r["values"]]
            order_checked += 1
            if seq != want:
                order_bad += 1
                problems.append(f"p{pno} S.NO {r['sno']}: pypdf order {seq} vs grid {want}")
    return placed, problems, page_counts, order_checked, order_bad


# ---------------------------------------------------------------------------------------------
def document_facts(path):
    r = pypdf.PdfReader(path)
    meta = {k.lstrip("/"): str(v) for k, v in (r.metadata or {}).items()}
    first = (r.pages[0].extract_text() or "").splitlines()
    heading = [l.strip() for l in first[:8] if l.strip()]
    return {"pages": len(r.pages), "metadata": meta, "first_lines": heading[:5], "sha256": sha256(path), "bytes": os.path.getsize(path)}


def served_index():
    """(norm college, norm programme) -> served record."""
    out, groups = {}, {}
    for f in sorted(glob.glob(os.path.join(SERVED, "offerings", "*.json"))):
        o = json.load(open(f, encoding="utf-8"))
        assert o["categories"] == CATEGORIES and o["rounds"] == [r for r, _ in ROUNDS], f
        groups[o["id"]] = o
        for i, row in enumerate(o["rows"]):
            prog = f"B.A. Program ({row[1]})" if o["id"] == "b-a-programme" else row[1]
            key = (norm(row[0]), norm(prog))
            if key in out:
                raise SystemExit(f"served key collision {key}")
            out[key] = {"group": o["id"], "college": row[0], "programme": prog, "rounds": row[2:5]}
    return out, groups


def fmt(v):
    return "" if v is None else (f"{v:.4f}".rstrip("0").rstrip(".") if isinstance(v, float) else str(v))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", default=os.path.join(ROOT, "data", "du-csas-2026", "source"))
    args = ap.parse_args()

    index = json.load(open(os.path.join(SERVED, "index.json"), encoding="utf-8"))
    want_sha = {s["id"]: s["sha256"] for s in index["meta"]["sources"]}
    results = {"seed": SEED, "documents": {}, "rounds": {}, "totals": {}, "checks": {}}
    mismatches = []

    docs = {"boi": "boi.pdf", **{r: f for r, f in ROUNDS}}
    for sid, fname in docs.items():
        p = os.path.join(args.source, fname)
        if not os.path.exists(p):
            raise SystemExit(f"missing source PDF {p}")
        facts = document_facts(p)
        if facts["sha256"] != want_sha[sid]:
            raise SystemExit(f"{fname}: SHA-256 {facts['sha256']} differs from index.json {want_sha[sid]}")
        results["documents"][sid] = {"file": fname, **facts, "sha256_matches_index": True}

    served, groups = served_index()
    seen_served = defaultdict(set)
    pdf_cells = {}  # (round, served key, category) -> (value or None, page, sno)

    for ri, (rid, fname) in enumerate(ROUNDS):
        path = os.path.join(args.source, fname)
        a_rows, a_problems, a_pages = method_a(path)
        placed, b_problems, b_pages, order_checked, order_bad = method_b(path, a_rows)
        snos = [r["sno"] for r in a_rows]
        a_cells = {(r["sno"], c): v for r in a_rows for c, v in r["values"].items()}
        a_vs_b = sorted(set(a_cells) ^ set(placed)) + sorted(k for k in a_cells if k in placed and a_cells[k] != placed[k])
        for k in a_vs_b:
            mismatches.append({"round": rid, "check": "A vs B (two PDF engines)", "page": "", "sno": k[0], "college": "", "programme": "", "category": k[1], "pdf": a_cells.get(k, ""), "other": placed.get(k, "")})
        last = a_rows[-1] if a_rows else None
        results["rounds"][rid] = {
            "pdf_rows": len(a_rows),
            "sno_first_last": [snos[0], snos[-1]] if snos else None,
            "sno_contiguous": snos == list(range(1, len(snos) + 1)),
            "pdf_cells": len(a_cells),
            "pdf_cells_printed_without_decimals": sorted(f"S.NO {k[0]} {k[1]} = {v}" for k, v in a_cells.items() if "." not in v),
            "pdf_colleges": len({norm(r["college"]) for r in a_rows}),
            "pdf_programme_names": len({norm(r["programme"]) for r in a_rows}),
            "pdf_categories": len(CATEGORIES),
            "last_row": {"sno": last["sno"], "page": last["page"], "college": last["college"], "programme": last["programme"]} if last else None,
            "pages_without_rows": [p["page"] for p in a_pages if p["rows"] == 0],
            "names_continued_over_page_break": sum(1 for r in a_rows if r.get("continued_on")),
            "method_a_problems": a_problems,
            "method_b_problems": b_problems,
            "method_b_numbers": len(placed),
            "pdfplumber_decimal_words": sum(p["words_decimal"] for p in a_pages),
            "pypdf_decimal_runs": sum(p["decimals_pypdf"] for p in b_pages),
            "a_equals_b": not a_vs_b and not b_problems and not a_problems,
            "reading_order_rows_checked": order_checked,
            "reading_order_rows_differing": order_bad,
        }

        # Against the parsed JSON, by S.NO.
        parsed = json.load(open(os.path.join(PARSED, f"{rid}.json"), encoding="utf-8"))["rows"]
        pmap = {r["sno"]: r for r in parsed}
        p_name_bad = p_cell_bad = 0
        for r in a_rows:
            q = pmap.get(r["sno"])
            if q is None:
                mismatches.append({"round": rid, "check": "PDF vs parsed: row missing", "page": r["page"], "sno": r["sno"], "college": r["college"], "programme": r["programme"], "category": "", "pdf": "", "other": ""})
                continue
            if (norm(q["college"]), norm(q["programme"])) != (norm(r["college"]), norm(r["programme"])):
                p_name_bad += 1
                mismatches.append({"round": rid, "check": "PDF vs parsed: names", "page": r["page"], "sno": r["sno"], "college": r["college"], "programme": r["programme"], "category": "", "pdf": f"{r['college']} | {r['programme']}", "other": f"{q['college']} | {q['programme']}"})
            for c in CATEGORIES:
                pv = float(r["values"][c]) if c in r["values"] else None
                qv = q["scores"].get(c)
                if pv != qv:
                    p_cell_bad += 1
                    mismatches.append({"round": rid, "check": "PDF vs parsed: cell", "page": r["page"], "sno": r["sno"], "college": r["college"], "programme": r["programme"], "category": c, "pdf": fmt(pv), "other": fmt(qv)})
        results["rounds"][rid]["parsed_rows"] = len(parsed)
        results["rounds"][rid]["parsed_cells"] = sum(len(q["scores"]) for q in parsed)
        results["rounds"][rid]["parsed_colleges"] = len({norm(q["college"]) for q in parsed})
        results["rounds"][rid]["parsed_programme_names"] = len({norm(q["programme"]) for q in parsed})
        results["rounds"][rid]["pdf_vs_parsed_name_mismatches"] = p_name_bad
        results["rounds"][rid]["pdf_vs_parsed_cell_mismatches"] = p_cell_bad

        # Against the served files, by names.
        s_bad = 0
        keys_this_round = Counter()
        for r in a_rows:
            key = (norm(r["college"]), norm(r["programme"]))
            keys_this_round[key] += 1
            s = served.get(key)
            if s is None or s["rounds"][ri] is None:
                s_bad += 1
                mismatches.append({"round": rid, "check": "PDF vs served: row missing", "page": r["page"], "sno": r["sno"], "college": r["college"], "programme": r["programme"], "category": "", "pdf": "row printed", "other": "not served" if s is None else "served without this round"})
                continue
            seen_served[rid].add(key)
            for ci, c in enumerate(CATEGORIES):
                pv = float(r["values"][c]) if c in r["values"] else None
                sv = s["rounds"][ri][ci]
                pdf_cells[(rid, key, c)] = (pv, r["page"], r["sno"])
                if pv != sv:
                    s_bad += 1
                    mismatches.append({"round": rid, "check": "PDF vs served: cell", "page": r["page"], "sno": r["sno"], "college": r["college"], "programme": r["programme"], "category": c, "pdf": fmt(pv), "other": fmt(sv)})
        dupes = [k for k, n in keys_this_round.items() if n > 1]
        for k in dupes:
            mismatches.append({"round": rid, "check": "PDF: same college and programme twice", "page": "", "sno": "", "college": k[0], "programme": k[1], "category": "", "pdf": "", "other": ""})
        extra = [k for k, s in served.items() if s["rounds"][ri] is not None and k not in seen_served[rid]]
        for k in extra:
            s = served[k]
            mismatches.append({"round": rid, "check": "served row not printed in this round", "page": "", "sno": "", "college": s["college"], "programme": s["programme"], "category": "", "pdf": "", "other": "served"})
        results["rounds"][rid]["served_rows"] = sum(1 for s in served.values() if s["rounds"][ri] is not None)
        results["rounds"][rid]["served_cells"] = sum(1 for s in served.values() if s["rounds"][ri] is not None for v in s["rounds"][ri] if v is not None)
        results["rounds"][rid]["served_null_cells"] = sum(1 for s in served.values() if s["rounds"][ri] is not None for v in s["rounds"][ri] if v is None)
        results["rounds"][rid]["pdf_vs_served_mismatches"] = s_bad + len(dupes) + len(extra)

    # ---- totals ------------------------------------------------------------------------------
    results["totals"] = {
        "served_offerings_meta": index["meta"]["offerings"],
        "served_offerings_rows": len(served),
        "served_colleges_meta": index["meta"]["colleges"],
        "served_colleges_rows": len({s["college"] for s in served.values()}),
        "served_groups": len(index["groups"]),
        "served_groups_with_cutoffs": len(groups),
        "served_programme_names": len({norm(s["programme"]) for s in served.values()}),
        "served_categories": index["meta"]["categories"],
        "served_cells_all_rounds": sum(results["rounds"][r]["served_cells"] for r, _ in ROUNDS),
        "pdf_cells_all_rounds": sum(results["rounds"][r]["pdf_cells"] for r, _ in ROUNDS),
        "cells_compared_all_rounds": len(pdf_cells),
        "union_pdf_rows": len(set().union(*seen_served.values())),
        "round3_rows_subset_of_round1": seen_served["round-3"] <= seen_served["round-1"],
        "round1_and_round2_same_rows": seen_served["round-1"] == seen_served["round-2"],
    }

    # ---- (b) five colleges x five programmes ------------------------------------------------
    five = []
    five_summary = []
    for col in FIVE_COLLEGES:
        for prog in FIVE_PROGRAMMES:
            key = (norm(col), norm(prog))
            s = served.get(key)
            entry = {"college": col, "programme": prog, "served": s is not None, "rounds": {}, "cells": 0, "mismatches": 0}
            for ri, (rid, _) in enumerate(ROUNDS):
                present = (rid, key, "UR") in pdf_cells
                entry["rounds"][rid] = present
                if not present and (s is None or s["rounds"][ri] is None):
                    continue
                for ci, c in enumerate(CATEGORIES):
                    pv, page, sno = pdf_cells.get((rid, key, c), (None, "", ""))
                    sv = s["rounds"][ri][ci] if s and s["rounds"][ri] else None
                    ok = present and pv == sv
                    entry["cells"] += 1
                    entry["mismatches"] += 0 if ok else 1
                    five.append({"college": col, "programme": prog, "round": rid, "page": page, "sno": sno, "category": c, "pdf": fmt(pv), "served": fmt(sv), "match": "yes" if ok else "NO"})
            five_summary.append(entry)
    results["checks"]["five_colleges"] = {
        "combinations": len(five_summary),
        "offered": sum(1 for e in five_summary if e["served"]),
        "cells": len(five),
        "non_null_cells": sum(1 for r in five if r["pdf"] != ""),
        "mismatches": sum(1 for r in five if r["match"] != "yes"),
        "not_offered": [f"{e['college']} / {e['programme']}" for e in five_summary if not e["served"]],
        "rows": [{k: v for k, v in e.items()} for e in five_summary if e["served"]],
    }

    # ---- (c) seeded random sample -----------------------------------------------------------
    five_keys = {(norm(c), norm(p)) for c in FIVE_COLLEGES for p in FIVE_PROGRAMMES}
    rng = random.Random(SEED)
    sample = []
    for ri, (rid, _) in enumerate(ROUNDS):
        keys = sorted(k for k, s in served.items() if s["rounds"][ri] is not None and k not in five_keys)
        filled = [(k, c) for k in keys for ci, c in enumerate(CATEGORIES) if served[k]["rounds"][ri][ci] is not None]
        empty = [(k, c) for k in keys for ci, c in enumerate(CATEGORIES) if served[k]["rounds"][ri][ci] is None]
        for k, c in rng.sample(filled, 100) + rng.sample(empty, 20):
            s = served[k]
            sv = s["rounds"][ri][CATEGORIES.index(c)]
            pv, page, sno = pdf_cells.get((rid, k, c), (None, "", ""))
            ok = (rid, k, c) in pdf_cells and pv == sv
            sample.append({"round": rid, "page": page, "sno": sno, "college": s["college"], "programme": s["programme"], "category": c, "pdf": fmt(pv), "served": fmt(sv), "match": "yes" if ok else "NO"})
    sample_path = os.path.join(HERE, "sample-cells.csv")
    reproducible = None
    if os.path.exists(sample_path):
        old = [(r["round"], r["college"], r["programme"], r["category"]) for r in csv.DictReader(open(sample_path, encoding="utf-8"))]
        reproducible = old == [(r["round"], r["college"], r["programme"], r["category"]) for r in sample]
    results["checks"]["sample"] = {
        "seed": SEED,
        "cells": len(sample),
        "non_null": sum(1 for r in sample if r["served"] != ""),
        "null": sum(1 for r in sample if r["served"] == ""),
        "mismatches": sum(1 for r in sample if r["match"] != "yes"),
        "same_cells_as_saved_file": reproducible,
    }

    # ---- (d) flags -------------------------------------------------------------------------
    papers = {}
    for g in index["groups"]:
        n = 0
        for comb in g["eligibility"]["combinations"]:
            k = 0
            for slot in comb["slots"]:
                if slot["type"] == "lang":
                    k += len(slot.get("specific", [])) + slot.get("any", 0)
                elif slot["type"] == "free":
                    k += slot.get("count", 1)
                else:
                    k += 1
            n = max(n, k)
        papers[g["id"]] = n
    flags = []
    for key, s in sorted(served.items(), key=lambda kv: (kv[1]["group"], kv[1]["college"], kv[1]["programme"])):
        limit = PAPER_MAX * papers.get(s["group"], 4)
        for ci, c in enumerate(CATEGORIES):
            vals = [arr[ci] if arr else None for arr in s["rounds"]]
            pages = []
            for ri, (rid, _) in enumerate(ROUNDS):
                cell = pdf_cells.get((rid, key, c))
                pages.append(f"{rid[-1]}:p{cell[1]}" if cell else "")
            base = {"group": s["group"], "college": s["college"], "programme": s["programme"], "category": c, "r1": fmt(vals[0]), "r2": fmt(vals[1]), "r3": fmt(vals[2]), "pdf_pages": " ".join(p for p in pages if p)}
            for v in vals:
                if v is not None and v == 0:
                    flags.append({"type": "zero", **base})
                if v is not None and (v > 1000 or v > limit):
                    flags.append({"type": f"above maximum ({limit})", **base})
            if vals[0] is not None and vals[1] is not None and vals[1] > vals[0]:
                flags.append({"type": "round 2 above round 1", **base})
            if vals[1] is not None and vals[2] is not None and vals[2] > vals[1]:
                flags.append({"type": "round 3 above round 2", **base})
            if vals[1] is None and vals[0] is not None and vals[2] is not None and vals[2] > vals[0]:
                flags.append({"type": "round 3 above round 1 (no round 2 value)", **base})
    nulls = {rid: results["rounds"][rid]["served_null_cells"] for rid, _ in ROUNDS}
    null_blank_in_pdf = sum(1 for (rid, k, c), (pv, _, _) in pdf_cells.items() if pv is None)
    results["checks"]["flags"] = {
        "served_null_cells_in_listed_rows": nulls,
        "served_null_cells_blank_in_pdf": null_blank_in_pdf,
        "rows_not_listed_in_round": {rid: len(served) - results["rounds"][rid]["served_rows"] for rid, _ in ROUNDS},
        "by_type": dict(Counter(f["type"] for f in flags)),
        "programme_paper_counts": dict(Counter(papers.values())),
    }

    results["mismatches"] = len(mismatches)
    results["verdict_inputs"] = {
        "all_pdf_engines_agree": all(results["rounds"][r]["a_equals_b"] for r, _ in ROUNDS),
        "reading_order_all_rows": all(results["rounds"][r]["reading_order_rows_differing"] == 0 for r, _ in ROUNDS),
        "pdf_equals_parsed": all(results["rounds"][r]["pdf_vs_parsed_cell_mismatches"] == 0 and results["rounds"][r]["pdf_vs_parsed_name_mismatches"] == 0 for r, _ in ROUNDS),
        "pdf_equals_served": all(results["rounds"][r]["pdf_vs_served_mismatches"] == 0 for r, _ in ROUNDS),
    }

    def write_csv(name, rows, fields):
        with open(os.path.join(HERE, name), "w", encoding="utf-8", newline="") as f:
            w = csv.DictWriter(f, fieldnames=fields, lineterminator="\n")
            w.writeheader()
            w.writerows(rows)

    write_csv("mismatches.csv", mismatches, ["round", "check", "page", "sno", "college", "programme", "category", "pdf", "other"])
    write_csv("five-colleges.csv", five, ["college", "programme", "round", "page", "sno", "category", "pdf", "served", "match"])
    write_csv("sample-cells.csv", sample, ["round", "page", "sno", "college", "programme", "category", "pdf", "served", "match"])
    write_csv("flags.csv", flags, ["type", "group", "college", "programme", "category", "r1", "r2", "r3", "pdf_pages"])
    with open(os.path.join(HERE, "results.json"), "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=1)
        f.write("\n")

    for rid, _ in ROUNDS:
        r = results["rounds"][rid]
        print(f"{rid}: PDF rows {r['pdf_rows']} cells {r['pdf_cells']} | A==B {r['a_equals_b']} | order bad {r['reading_order_rows_differing']} | "
              f"parsed rows {r['parsed_rows']} cells {r['parsed_cells']} | served rows {r['served_rows']} cells {r['served_cells']} | "
              f"vs parsed {r['pdf_vs_parsed_cell_mismatches'] + r['pdf_vs_parsed_name_mismatches']} vs served {r['pdf_vs_served_mismatches']}")
        for p in (r["method_a_problems"] + r["method_b_problems"])[:10]:
            print("   problem:", p)
    print("totals:", json.dumps(results["totals"]))
    print("five colleges:", {k: v for k, v in results["checks"]["five_colleges"].items() if k != "rows"})
    print("sample:", results["checks"]["sample"])
    print("flags:", results["checks"]["flags"]["by_type"])
    print("mismatches:", len(mismatches))
    return 0 if not mismatches else 1


if __name__ == "__main__":
    sys.exit(main())
