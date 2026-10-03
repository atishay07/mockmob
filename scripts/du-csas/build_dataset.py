"""Build the public DU eligibility + cutoff dataset from the parsed CSAS 2026 PDFs.

Inputs  (all produced by parse_cutoffs.py / parse_boi.py, kept under data/du-csas-2026/parsed):
  round-1.json round-2.json round-3.json boi.json
Outputs (static files served by the CDN, no server function involved):
  public/du/2026/index.json                 eligibility rules + per-programme cutoff summaries
  public/du/2026/offerings/<group-id>.json  college-wise cutoffs for one programme

Every join is checked. The build FAILS (never guesses) if a cutoff programme cannot be mapped
to exactly one Bulletin eligibility block, or if any cutoff cell would be dropped.

Usage: python scripts/du-csas/build_dataset.py
"""
import hashlib
import json
import os
import re
from collections import defaultdict

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PARSED = os.path.join(ROOT, "data", "du-csas-2026", "parsed")
SOURCE = os.path.join(ROOT, "data", "du-csas-2026", "source")
OUT = os.path.join(ROOT, "public", "du", "2026")

CATEGORIES = ["UR", "OBC-NCL", "SC", "ST", "EWS", "SIKH", "PwBD", "KM", "SGC", "ORPHAN-FEMALE", "ORPHAN-MALE"]
ROUNDS = ["round-1", "round-2", "round-3"]

SOURCES = [
    {"id": "boi", "file": "boi.pdf", "title": "University of Delhi, UG Bulletin of Information 2026-27", "url": "https://www.du.ac.in/uploads/2026/06012026_BOI_UG_2026_27_compressed.pdf", "use": "Programme-specific eligibility"},
    {"id": "round-1", "file": "cutoff-r1.pdf", "title": "UG 2026-27, First round of allocation and admissions, minimum allocation score", "url": "https://admission.uod.ac.in/userfiles/17072026-CutOff_UG_Round_One_compressed.pdf", "use": "Round I cutoffs"},
    {"id": "round-2", "file": "cutoff-r2.pdf", "title": "UG 2026-27, Second round of allocation and admissions, minimum allocation score", "url": "https://admission.uod.ac.in/userfiles/downloads/2026/25072026_CutOff_UG_Round_Two_compressed.pdf", "use": "Round II cutoffs"},
    {"id": "round-3", "file": "minscore-r3.pdf", "title": "UG 2026-27, Third round of allocation and admissions, minimum allocation score", "url": "https://admission.uod.ac.in/userfiles/downloads/2026/09082026_Minimum_Allocation_Score_RoundThree.pdf", "use": "Round III minimum allocation scores"},
]

# Cutoff-list programme names that differ from the Bulletin heading only in wording.
NAME_OVERRIDES = {
    "B.A. (Hons.) Humanities and Social Sciences": "B.A. (Hons.) Humanities & Social Sciences",
    "B.A. (Vocational Studies) Tourism Management": "B.A. (Vocational Studies)",
    "B.Sc. (Hons.) Biological Sciences": "B.Sc. (Hons.) Biological Science",
    "B.Sc. (Hons.) Environmental Sciences": "B.Sc. (Hons.) Environmental Science",
    "B.Sc. (Prog.) Applied Physical Sciences with Industrial Chemistry": "B.Sc. (Prog.) Applied Physical Science with Industrial Chemistry",
    "B.Sc. (Prog.) Mathematical Sciences": "B.Sc. (Prog.) Mathematical Science",
    "B.Sc. Applied Physical Sciences with Analytical Methods in Chemistry & Biochemistry": "B.Sc. (Prog.) Applied Physical Science with Analytical Methods in Chemistry & Biochemistry",
    "B.Tech. Information Technology and Mathematical Innovations (IT & MI)": "B.Tech. Information Technology and Mathematical Innovation (IT & MI)",
}

LANG_LIST = ["Assamese", "Bengali", "English", "Gujarati", "Hindi", "Kannada", "Malayalam", "Marathi", "Odia", "Punjabi", "Sanskrit", "Tamil", "Telugu", "Urdu"]
# (id, official List B name, aliases). DU/NTA count the papers named together as ONE subject, so
# every alias a student might know their Class 12 subject by maps to the same entry.
DOMAIN_LIST = [
    ("accountancy", "Accountancy / Book Keeping", ["Accountancy", "Book Keeping", "Bookkeeping", "Accounts"]),
    ("agriculture", "Agriculture", ["Agriculture"]),
    ("anthropology", "Anthropology", ["Anthropology"]),
    ("biology", "Biology / Biological Studies / Biotechnology / Biochemistry", ["Biology", "Biological Studies", "Biotechnology", "Biochemistry", "Bio-Chemistry"]),
    ("business_studies", "Business Studies", ["Business Studies", "BST"]),
    ("chemistry", "Chemistry", ["Chemistry"]),
    ("computer_science", "Computer Science / Informatics Practices", ["Computer Science", "Informatics Practices", "Information Practices", "IP", "CS"]),
    ("economics", "Economics / Business Economics", ["Economics", "Business Economics"]),
    ("environmental_studies", "Environmental Studies / Environmental Science", ["Environmental Studies", "Environmental Science", "EVS"]),
    ("fine_arts", "Fine Arts / Visual Arts / Commercial Arts", ["Fine Arts", "Visual Arts", "Sculpture", "Painting", "Commercial Arts"]),
    ("geography", "Geography / Geology", ["Geography", "Geology"]),
    ("history", "History", ["History"]),
    ("home_science", "Home Science", ["Home Science"]),
    ("knowledge_tradition", "Knowledge Tradition and Practices in India", ["Knowledge Tradition", "KTPI"]),
    ("mass_media", "Mass Media / Mass Communication", ["Mass Media", "Mass Communication", "Media Studies"]),
    ("mathematics", "Mathematics / Applied Mathematics", ["Mathematics", "Applied Mathematics", "Maths", "Math"]),
    ("performing_arts", "Performing Arts (Dance, Drama, Music)", ["Performing Arts", "Dance", "Drama", "Music"]),
    ("physical_education", "Physical Education (Yoga, Sports)", ["Physical Education", "Yoga", "Sports", "PE"]),
    ("physics", "Physics", ["Physics"]),
    ("political_science", "Political Science", ["Political Science", "Polity", "Pol Sci"]),
    ("psychology", "Psychology", ["Psychology"]),
    ("sociology", "Sociology", ["Sociology"]),
]


def norm(s):
    return re.sub(r"[^a-z0-9]+", "", s.lower().replace("programme", "program"))


DISPLAY_OVERRIDES = {
    "Bachelor of Elementary Education B. El. Ed": "Bachelor of Elementary Education (B.El.Ed.)",
    "B.Sc. In Physical Education, Health Education & Sports": "B.Sc. in Physical Education, Health Education & Sports",
}


def pretty(heading):
    """Display name only. Matching still uses the raw Bulletin heading."""
    if heading in DISPLAY_OVERRIDES:
        return DISPLAY_OVERRIDES[heading]
    return re.sub(r"^(B\.\s?A|B\.\s?Sc|B\.\s?Com)\.?\s*\(", lambda m: m.group(1).replace(" ", "") + ". (", heading)


def slug(s):
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", s.lower())).strip("-")


def stream_of(heading):
    h = heading.lower()
    if h.startswith(("b.com", "bachelor of business", "bachelor of management")) or "business economics" in h or h == "b.a. (hons.) economics":
        return "Commerce & Economics"
    if h.startswith(("b.sc", "b.tech")):
        return "Science"
    if "voc" in h[:12]:
        return "Vocational"
    if h.startswith("b.a."):
        return "Humanities & Social Sciences"
    return "Other"


def family_of(heading):
    h = heading.lower()
    if "(hons.)" in h or h.startswith(("b.com. (hons", "bachelor of")):
        return "Honours"
    if "(prog" in h or "(pass)" in h or h == "b.com." or "programme" in h and h.startswith("b.a."):
        return "Programme"
    return "Other"


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def load_rounds():
    data = {}
    for r in ROUNDS:
        data[r] = json.load(open(os.path.join(PARSED, f"{r}.json"), encoding="utf-8"))["rows"]
    return data


def main():
    boi = json.load(open(os.path.join(PARSED, "boi.json"), encoding="utf-8"))
    rounds = load_rounds()

    heading_to_block = {}
    for b in boi:
        key = norm(b["heading"])
        if key in heading_to_block:
            raise SystemExit(f"duplicate Bulletin heading {b['heading']!r}")
        heading_to_block[key] = b

    def block_for(programme):
        if programme.startswith("B.A. Program ("):
            return heading_to_block[norm("B.A. (Programme)")], programme[len("B.A. Program ("):-1]
        name = NAME_OVERRIDES.get(programme, programme)
        b = heading_to_block.get(norm(name))
        if not b:
            raise SystemExit(f"cutoff programme has no Bulletin eligibility block: {programme!r}")
        return b, ""

    # Join the three rounds on (college, programme).
    seats = {}
    for r in ROUNDS:
        for row in rounds[r]:
            key = (norm(row["college"]), norm(row["programme"]))
            rec = seats.setdefault(key, {"college": row["college"], "programme": row["programme"], "rounds": {}})
            if r in rec["rounds"]:
                raise SystemExit(f"duplicate seat in {r}: {row['college']} / {row['programme']}")
            rec["rounds"][r] = row["scores"]
    expected_cells = sum(len(row["scores"]) for r in ROUNDS for row in rounds[r])

    groups = {}
    cells_out = 0
    for rec in seats.values():
        block, variant = block_for(rec["programme"])
        gid = slug(block["heading"])
        g = groups.setdefault(gid, {"block": block, "rows": []})
        arrs = []
        for r in ROUNDS:
            sc = rec["rounds"].get(r)
            if sc is None:
                arrs.append(None)
            else:
                arr = [sc.get(c) for c in CATEGORIES]
                cells_out += sum(1 for v in arr if v is not None)
                arrs.append(arr)
        g["rows"].append([rec["college"], variant or rec["programme"], *arrs])
    if cells_out != expected_cells:
        raise SystemExit(f"dropped cutoff cells: expected {expected_cells}, wrote {cells_out}")

    os.makedirs(os.path.join(OUT, "offerings"), exist_ok=True)
    for f in os.listdir(os.path.join(OUT, "offerings")):
        os.remove(os.path.join(OUT, "offerings", f))

    index_groups = []
    for gid, g in sorted(groups.items(), key=lambda kv: kv[1]["block"]["heading"]):
        b = g["block"]
        rows = sorted(g["rows"], key=lambda r: (r[0], r[1]))
        summary = {}
        for ri, r in enumerate(ROUNDS):
            per = {}
            for ci, c in enumerate(CATEGORIES):
                raw = [row[2 + ri][ci] for row in rows if row[2 + ri] is not None and row[2 + ri][ci] is not None]
                # Effective cutoff for a candidate of this category: DU's UR merit list includes every
                # candidate, so they clear on the lower of the UR and category cutoffs.
                eff = []
                for row in rows:
                    arr = row[2 + ri]
                    if arr is None:
                        continue
                    vals = [v for v in (arr[ci], arr[0]) if v is not None]
                    if vals:
                        eff.append(min(vals))
                if raw or eff:
                    per[c] = [min(raw) if raw else None, max(raw) if raw else None, min(eff), max(eff)]
            summary[r] = per
        index_groups.append({
            "id": gid,
            "name": pretty(b["heading"]),
            "stream": stream_of(b["heading"]),
            "family": family_of(b["heading"]),
            "colleges": len({row[0] for row in rows}),
            "offerings": len(rows),
            "eligibility": {
                "combinations": [{"label": c["label"], "text": c["text"], "slots": c["slots"]} for c in b["combinations"]],
                "notes": [n for n in b["notes"] if len(n) <= 700][:5],
                "requiresLanguage": b["requiresLanguage"],
                "performanceTest": b["performanceTest"],
            },
            "summary": summary,
        })
        with open(os.path.join(OUT, "offerings", f"{gid}.json"), "w", encoding="utf-8") as f:
            json.dump({"id": gid, "name": pretty(b["heading"]), "categories": CATEGORIES, "rounds": ROUNDS, "rows": rows}, f, ensure_ascii=False, separators=(",", ":"))

    unused = [b["heading"] for b in boi if slug(b["heading"]) not in groups]
    # Programmes with no CUET cutoff list (merit includes a separate test) stay in the
    # eligibility results, flagged, so a student still sees they exist.
    for b in boi:
        if slug(b["heading"]) in groups:
            continue
        index_groups.append({
            "id": slug(b["heading"]),
            "name": pretty(b["heading"]),
            "stream": stream_of(b["heading"]),
            "family": family_of(b["heading"]),
            "colleges": 0,
            "offerings": 0,
            "eligibility": {
                "combinations": [{"label": c["label"], "text": c["text"], "slots": c["slots"]} for c in b["combinations"]],
                "notes": [n for n in b["notes"] if len(n) <= 700][:5],
                "requiresLanguage": b["requiresLanguage"],
                "performanceTest": b["performanceTest"],
            },
            "summary": {},
        })
    index_groups.sort(key=lambda g: g["name"])
    all_scores = [v for r in ROUNDS for row in rounds[r] for v in row["scores"].values()]
    index = {
        "meta": {
            "cycle": "CSAS UG 2026-27",
            "forAdmissionYear": 2026,
            "rounds": ROUNDS,
            "categories": CATEGORIES,
            "scoreRange": [min(all_scores), max(all_scores)],
            "offerings": len(seats),
            "colleges": len({s["college"] for s in seats.values()}),
            "sources": [{k: v for k, v in s.items() if k != "file"} | {"sha256": sha256(os.path.join(SOURCE, s["file"]))} for s in SOURCES],
            "programmesWithoutCutoffs": unused,
        },
        "languages": [{"id": n.lower(), "name": n, "aliases": [n]} for n in LANG_LIST],
        "domains": [{"id": i, "name": n, "aliases": al} for i, n, al in DOMAIN_LIST],
        "groups": index_groups,
    }
    with open(os.path.join(OUT, "index.json"), "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, separators=(",", ":"))
    # Small file for the landing-page teaser: rules only, no cutoff summaries.
    rules = {
        "meta": {"cycle": index["meta"]["cycle"], "groups": len(index_groups)},
        "languages": index["languages"],
        "domains": index["domains"],
        "groups": [{k: v for k, v in g.items() if k not in ("summary", "colleges")} for g in index_groups],
    }
    with open(os.path.join(OUT, "rules.json"), "w", encoding="utf-8") as f:
        json.dump(rules, f, ensure_ascii=False, separators=(",", ":"))

    print(f"groups: {len(groups)}  offerings: {len(seats)}  cutoff cells: {cells_out}")
    print(f"programmes in the Bulletin without published cutoffs: {len(unused)}")
    for u in unused:
        print("   -", u)
    size = sum(os.path.getsize(os.path.join(OUT, "offerings", f)) for f in os.listdir(os.path.join(OUT, "offerings")))
    print(f"index.json {os.path.getsize(os.path.join(OUT, 'index.json'))/1024:.0f} KB; rules.json {os.path.getsize(os.path.join(OUT, 'rules.json'))/1024:.0f} KB; offerings total {size/1024:.0f} KB; groups in index: {len(index_groups)}")


if __name__ == "__main__":
    main()
