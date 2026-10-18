"""Generates lib/features/onboarding/data/du_2026_data.dart from the DU CSAS 2026 files in
public/du/2026 (the repo's own copy of the Bulletin rules and the Round 1 minimum allocation
scores): each course's eligibility combinations and, per college, the Round 1 minimum score for
each category.

- `_courses`: the six Commerce and Economics programmes the course step shows as tiles, in order
  of aspirant demand (owner, 18 Oct, D41; plan 19 Oct, G4).
- `_moreCourses`: every other course with Round 1 seats in 2026, for "More courses". Left out:
  courses with no Round 1 rows, and B.A. (Programme), whose rows are per pair of disciplines
  (one college appears dozens of times), so it has no single college ladder to show.

Run from flutter_app:  python tool/make_onboarding_du.py
"""

import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
SRC = ROOT / "public" / "du" / "2026"
OUT = pathlib.Path(__file__).resolve().parents[1] / "lib" / "features" / "onboarding" / "data" / "du_2026_data.dart"

# (id in the DU index, short display name), in the order the onboarding shows them: by how many
# DU commerce aspirants aim for each, never alphabetical and never labelled "top" (plan 19 Oct, G4:
# B.Com (Hons), B.A. (Hons) Economics, B.Com, BMS, BBA (FIA), then B.A. (Hons) Business Economics).
COURSES = [
    ("b-com-hons", "B.Com (Hons)"),
    ("b-a-hons-economics", "B.A. (Hons) Economics"),
    ("b-com", "B.Com"),
    ("bachelor-of-management-studies-bms", "BMS"),
    ("bachelor-of-business-administration-financial-investment-analysis-bba-fia", "BBA (FIA)"),
    ("b-a-hons-business-economics", "B.A. (Hons) Business Economics"),
]

# Rows per pair of disciplines, not per college: no single ladder (see the module note).
LEFT_OUT = {"b-a-programme"}

# Short names for the long ones in "More courses"; the rest follow course_short().
MORE_SHORT = {
    "bachelor-of-elementary-education-b-el-ed": "B.El.Ed.",
    "b-tech-information-technology-and-mathematical-innovation-it-mi": "B.Tech IT and Mathematical Innovation",
    "b-sc-prog-applied-physical-science-with-analytical-methods-in-chemistry-biochemistry":
        "B.Sc (Prog) Applied Physical Science, Analytical Chemistry",
    "b-sc-prog-physical-science-with-computer-science-informatics-practices":
        "B.Sc (Prog) Physical Science with Computer Science",
}


def course_short(cid: str, name: str) -> str:
    if cid in MORE_SHORT:
        return MORE_SHORT[cid]
    return name.replace("(Hons.)", "(Hons)").replace("(Prog.)", "(Prog)").replace("B.Sc.", "B.Sc").replace("B.Com.", "B.Com").replace("B.Voc.", "B.Voc")

# Short names students use, for the one-line summary on the sheet. Anything not listed falls
# back to a rule (drop "(W)", then a trailing "College" when what is left is short).
SHORT = {
    "Shri Ram College of Commerce": "SRCC",
    "Lady Shri Ram College for Women (W)": "LSR",
    "Sri Guru Gobind Singh College of Commerce": "SGGSCC",
    "Shaheed Sukhdev College Business Studies": "SSCBS",
    "Delhi College of Arts and Commerce": "DCAC",
    "Indraprastha College for Women (W)": "IP College",
    "Jesus & Mary College (W)": "JMC",
    "Sri Guru Tegh Bahadur Khalsa College": "SGTB Khalsa",
    "Shyama Prasad Mukherji College For Women (W)": "SPM College",
    "Atma Ram Sanatan Dharma College": "ARSD",
    "College of Vocational Studies": "CVS",
    "Deen Dayal Upadhyaya College": "DDU College",
    "St. Stephen's College": "St. Stephen's",
    "Shaheed Rajguru College of Applied Sciences for Women (W)": "Shaheed Rajguru",
    "Sri Guru Nanak Dev Khalsa College": "SGND Khalsa",
    "Janki Devi Memorial College (W)": "JDM College",
    "Dr. Bhim Rao Ambedkar College": "Ambedkar College",
}


def short_name(name: str) -> str:
    if name in SHORT:
        return SHORT[name]
    s = name.replace(" (W)", "")
    if s.endswith(" College") and len(s.split()) <= 3:
        s = s[: -len(" College")]
    return s


def dart_str(s: str) -> str:
    return "'" + s.replace("\\", "\\\\").replace("'", "\\'").replace("$", "\\$") + "'"


def dart_num(v):
    return "null" if v is None else f"{v:.4f}".rstrip("0").rstrip(".")


def slot(s: dict) -> str:
    t = s["type"]
    if t == "lang":
        specific = s.get("specific") or []
        if specific:
            names = ", ".join(dart_str(x) for x in specific)
            return f"DuSlot.languages([{names}], count: {s.get('any', 0)})"
        return f"DuSlot.language({s['any']})"
    if t == "domain":
        return f"DuSlot.domain({dart_str(s['subject'])})"
    if t == "free":
        return f"DuSlot.free({s['count']})"
    if t == "gat":
        return "DuSlot.generalTest()"
    raise ValueError(f"unknown slot {s}")


def main() -> None:
    index = json.loads((SRC / "index.json").read_text(encoding="utf-8"))
    rules = json.loads((SRC / "rules.json").read_text(encoding="utf-8"))
    categories = index["meta"]["categories"]
    groups = {g["id"]: g for g in rules["groups"]}

    lines = [
        "// GENERATED by tool/make_onboarding_du.py from public/du/2026. Do not edit by hand.",
        "// Source: University of Delhi, CSAS UG 2026-27: Bulletin of Information (eligibility) and",
        "// the Round 1 minimum allocation scores (out of 1000).",
        "",
        "part of 'du_catalog.dart';",
        "",
        "const List<String> _categories = [" + ", ".join(dart_str(c) for c in categories) + "];",
        "",
    ]
    featured = [cid for cid, _ in COURSES]
    shorts = dict(COURSES)
    more = [
        g["id"]
        for g in rules["groups"]
        if g["id"] not in shorts and g["id"] not in LEFT_OUT and g.get("offerings", 0) > 0
        and (SRC / "offerings" / f"{g['id']}.json").exists()
    ]
    more.sort(key=lambda cid: course_short(cid, groups[cid]["name"]).lower())
    for cid in more:
        shorts[cid] = course_short(cid, groups[cid]["name"])
    domains = {d["id"]: d["name"] for d in rules["domains"]}
    languages = {d["id"]: d["name"] for d in rules["languages"]}
    lines.append("const Map<String, String> _languageNames = {")
    for lid in sorted(languages):
        lines.append(f"  {dart_str(lid)}: {dart_str(languages[lid])},")
    lines.append("};")
    lines.append("")
    lines.append("const Map<String, String> _domainNames = {")
    for did in sorted(domains):
        lines.append(f"  {dart_str(did)}: {dart_str(domains[did])},")
    lines.append("};")
    lines.append("")
    for const_name, ids in (("_courses", featured), ("_moreCourses", more)):
        lines.append(f"const List<DuCourse> {const_name} = [")
        for cid in ids:
            course(lines, groups[cid], shorts[cid], categories)
        lines.append("];")
        lines.append("")
    OUT.write_text("\n".join(lines), encoding="utf-8", newline="\n")
    print(f"wrote {OUT}: {len(featured)} featured, {len(more)} more")


def course(lines, group, short, categories) -> None:
    cid = group["id"]
    offering = json.loads((SRC / "offerings" / f"{cid}.json").read_text(encoding="utf-8"))
    assert offering["categories"] == categories, cid
    combos = []
    for c in group["eligibility"]["combinations"]:
        slots = ", ".join(slot(s) for s in c["slots"])
        combos.append(f"DuCombo({dart_str(c['text'])}, [{slots}])")
    lines.append("  DuCourse(")
    lines.append(f"    id: {dart_str(cid)},")
    lines.append(f"    name: {dart_str(group['name'])},")
    lines.append(f"    short: {dart_str(short)},")
    lines.append(f"    stream: {dart_str(group['stream'])},")
    lines.append("    combos: [" + ", ".join(combos) + "],")
    lines.append("    offerings: [")
    for row in offering["rows"]:
        college, _programme, r1 = row[0], row[1], row[2]
        scores = ", ".join(dart_num(v) for v in (r1 or [None] * len(categories)))
        lines.append(f"      DuOffering({dart_str(college)}, {dart_str(short_name(college))}, [{scores}]),")
    lines.append("    ],")
    lines.append("  ),")


if __name__ == "__main__":
    main()
