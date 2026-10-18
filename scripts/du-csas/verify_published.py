"""Check the published DU dataset against what was parsed from the CSAS and Bulletin PDFs (M-007).

Runs with no network and no PDF: it compares public/du/2026/* (what the website serves and the
app reads through tools/data/du_source.dart) with data/du-csas-2026/parsed/* (the parser output
that build_dataset.py joins). It is written separately from build_dataset.py on purpose, so a
bug in the builder's join shows up here.

Checks:
  1. Every parsed cutoff cell (round, college, programme, category, score) appears once in the
     published offering files, and nothing extra appears.
  2. The offerings and colleges counts in index.json match the parsed seats.
  3. Every Bulletin block has a published group, and every group id is unique.
  4. The offerings files match the group list (no orphan file, no missing file).
  5. With --pdfs DIR (boi.pdf, cutoff-r1.pdf, cutoff-r2.pdf, minscore-r3.pdf): each PDF's SHA-256
     equals the one recorded in index.json meta.sources.

Usage: python scripts/du-csas/verify_published.py [--pdfs data/du-csas-2026/source]
Exit code 1 when anything differs. Prints a dated report (paste it into docs/brain).
"""
import argparse
import datetime
import hashlib
import json
import os
import re
import sys
from collections import Counter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PARSED = os.path.join(ROOT, "data", "du-csas-2026", "parsed")
PUBLIC = os.path.join(ROOT, "public", "du", "2026")
ROUNDS = ["round-1", "round-2", "round-3"]
PDF_FILES = {"boi": "boi.pdf", "round-1": "cutoff-r1.pdf", "round-2": "cutoff-r2.pdf", "round-3": "minscore-r3.pdf"}


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def norm(s):
    # The same spelling rule build_dataset.py joins the three rounds on (Round III writes a few
    # college and programme names with different spacing or punctuation).
    return re.sub(r"[^a-z0-9]+", "", s.lower().replace("programme", "program"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdfs", help="folder holding the four source PDFs")
    args = ap.parse_args()
    problems = []

    index = load(os.path.join(PUBLIC, "index.json"))
    meta = index["meta"]
    categories = meta["categories"]

    # 1. Cutoff cells: parsed vs published, as multisets keyed by (round, college, category, score).
    parsed_cells = Counter()
    parsed_seats = set()
    for r in ROUNDS:
        for row in load(os.path.join(PARSED, f"{r}.json"))["rows"]:
            parsed_seats.add((norm(row["college"]), norm(row["programme"])))
            for cat, score in row["scores"].items():
                parsed_cells[(r, norm(row["college"]), cat, round(score, 4))] += 1

    published_cells = Counter()
    published_seats = set()
    offering_ids = set()
    folder = os.path.join(PUBLIC, "offerings")
    for name in sorted(os.listdir(folder)):
        o = load(os.path.join(folder, name))
        offering_ids.add(o["id"])
        if name != o["id"] + ".json":
            problems.append(f"file {name} holds group id {o['id']}")
        if o["categories"] != categories:
            problems.append(f"{name}: category order differs from index.json")
        for row in o["rows"]:
            college, variant, per_round = row[0], row[1], row[2:]
            published_seats.add((norm(college), o["id"], norm(variant)))
            for r, arr in zip(ROUNDS, per_round):
                if arr is None:
                    continue
                for cat, score in zip(categories, arr):
                    if score is not None:
                        published_cells[(r, norm(college), cat, round(score, 4))] += 1

    missing = parsed_cells - published_cells
    extra = published_cells - parsed_cells
    if missing:
        problems.append(f"{sum(missing.values())} parsed cutoff cells are not published, e.g. {next(iter(missing))}")
    if extra:
        problems.append(f"{sum(extra.values())} published cutoff cells were never parsed, e.g. {next(iter(extra))}")

    # 2. Counts.
    if meta["offerings"] != len(parsed_seats):
        problems.append(f"index.json says {meta['offerings']} offerings; the parsed rounds hold {len(parsed_seats)} distinct seats")
    if meta["offerings"] != len(published_seats):
        problems.append(f"index.json says {meta['offerings']} offerings; the offering files hold {len(published_seats)} rows")
    colleges = {c for c, _ in parsed_seats}
    if meta["colleges"] != len(colleges):
        problems.append(f"index.json says {meta['colleges']} colleges; the parsed rounds name {len(colleges)}")

    # 3 and 4. Bulletin blocks and files.
    boi = load(os.path.join(PARSED, "boi.json"))
    group_ids = [g["id"] for g in index["groups"]]
    if len(group_ids) != len(set(group_ids)):
        problems.append("duplicate group ids in index.json")
    if len(group_ids) != len(boi):
        problems.append(f"index.json has {len(group_ids)} groups; the Bulletin parse has {len(boi)} blocks")
    with_cutoffs = {g["id"] for g in index["groups"] if g["offerings"] > 0}
    if with_cutoffs != offering_ids:
        problems.append(f"groups with cutoffs and offering files differ: {sorted(with_cutoffs ^ offering_ids)[:5]}")
    unparsed = [c["label"] for b in boi for c in b["combinations"] if c.get("parsed") is False]
    if unparsed:
        problems.append(f"{len(unparsed)} Bulletin combinations were not parsed, e.g. {unparsed[0]}")

    # 5. Source hashes.
    checked = "not checked (no --pdfs folder given)"
    if args.pdfs:
        bad = []
        for s in meta["sources"]:
            path = os.path.join(args.pdfs, PDF_FILES[s["id"]])
            if not os.path.exists(path):
                bad.append(f"{PDF_FILES[s['id']]} missing")
                continue
            with open(path, "rb") as f:
                digest = hashlib.sha256(f.read()).hexdigest()
            if digest != s["sha256"]:
                bad.append(f"{PDF_FILES[s['id']]} hash {digest[:12]} differs from the recorded {s['sha256'][:12]}")
        problems += bad
        checked = "all four match" if not bad else "; ".join(bad)

    print(f"DU dataset check, {datetime.date.today().isoformat()}")
    print(f"  cycle: {meta['cycle']}")
    print(f"  parsed cutoff cells: {sum(parsed_cells.values())}; published: {sum(published_cells.values())}")
    print(f"  offerings: {meta['offerings']}; colleges: {meta['colleges']}; groups: {len(group_ids)}; Bulletin blocks: {len(boi)}")
    print(f"  source PDF hashes: {checked}")
    for s in meta["sources"]:
        print(f"  source {s['id']}: {s['url']}")
    if problems:
        print("FAILED")
        for p in problems:
            print("  -", p)
        sys.exit(1)
    print("OK: the published files hold exactly the parsed cells.")


if __name__ == "__main__":
    main()
