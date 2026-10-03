"""Parse programme-specific eligibility from the DU UG Bulletin of Information 2026-27.

Input is `pdftotext -layout` output. For every "Programme Specific Eligibility"
block we capture the programme heading, the combinations (each parsed into
typed slots), and any other eligibility sentences verbatim. Combinations that
do not fit the known slot grammar are NOT guessed at: they are emitted with
`parsed: false` and surfaced in the report so a human can decide.

Usage: python scripts/du-csas/parse_boi.py <boi.txt> <out.json>
"""
import collections
import json
import re
import sys
from collections import Counter

import pdfplumber

LANGS = [
    "Assamese", "Bengali", "English", "Gujarati", "Hindi", "Kannada", "Malayalam", "Marathi",
    "Odia", "Punjabi", "Sanskrit", "Tamil", "Telugu", "Urdu",
]
NUMWORD = {"one": 1, "two": 2, "three": 3, "four": 4}

# Canonical domain subject ids (List B). Value = patterns that identify it in a rule.
DOMAIN = {
    "accountancy": r"accountancy",
    "agriculture": r"agriculture",
    "anthropology": r"anthropology",
    "biology": r"biology",
    "business_studies": r"business studies",
    "chemistry": r"chemistry",
    "computer_science": r"computer science",
    "economics": r"economics",
    "environmental_studies": r"environmental",
    "fine_arts": r"fine arts",
    "geography": r"geography",
    "history": r"history",
    "home_science": r"home science",
    "knowledge_tradition": r"knowledge tradition",
    "mass_media": r"mass media",
    "mathematics": r"mathematics",
    "performing_arts": r"performing arts",
    "physical_education": r"physical education",
    "physics": r"physics",
    "political_science": r"political science",
    "psychology": r"psychology",
    "sociology": r"sociology",
}


def clean(s):
    s = s.replace(" ", " ")
    s = re.sub(r"\s+", " ", s).strip()
    return s


def parse_term(raw):
    t = clean(raw)
    low = t.lower()
    low = low.replace("languages", "language")
    m = re.match(r"^any (one|two|three) language(?: from list a)?$", low)
    if m:
        return {"type": "lang", "any": NUMWORD[m.group(1)]}
    m = re.match(r"^any (one|two|three|four) subjects? from (?:either )?list b$", low)
    if m:
        return {"type": "free", "count": NUMWORD[m.group(1)]}
    if low in ("general aptitude test", "general aptitude"):
        return {"type": "gat"}
    for lang in LANGS:
        if low == f"{lang.lower()} from list a":
            return {"type": "lang", "specific": [lang.lower()]}
        if low == f"{lang.lower()} and one language from list a":
            return {"type": "lang", "specific": [lang.lower()], "any": 1}
    # Required domain subject: the FIRST slash-separated token names the subject, the rest are
    # aliases that DU treats as the same List B entry ("Biology/Biological Studies/...").
    stripped = re.sub(r"\s*from list b$", "", low).strip()
    first = stripped.split("/")[0].strip()
    for key, pat in DOMAIN.items():
        if re.match(r"^" + pat + r"$", first):
            return {"type": "domain", "subject": key}
    return None


def parse_combination(body):
    parts = [p for p in re.split(r"\s\+\s|\+\s|\s\+", body) if clean(p)]
    slots = []
    for p in parts:
        term = parse_term(p)
        if term is None:
            return None
        slots.append(term)
    return slots


DEGREE = re.compile(r"^(B\.\s?A|B\.\s?Sc|B\.\s?Com|B\.\s?Voc|B\.\s?Tech|Bachelor|Four|Integrated)", re.I)


def find_heading(lines, idx):
    """Heading = nearest short, degree-prefixed line with blank lines around it."""
    for j in range(idx - 1, max(idx - 45, 0), -1):
        text = clean(lines[j])
        if not text or len(text) > 95 or not DEGREE.match(text):
            continue
        before = clean(lines[j - 1]) if j > 0 else ""
        after = clean(lines[j + 1]) if j + 1 < len(lines) else ""
        if (before == "" or lines[j].startswith("")) and after == "":
            return text
    return None



def font_headings(pdf_path):
    """Programme headings (16pt bold, wrapped lines merged), one per 'Programme Specific
    Eligibility' label, in reading order. Font size is a far more reliable signal than layout."""
    out = []
    current = None  # (page, last_top, text)
    with pdfplumber.open(pdf_path) as pdf:
        for pno, page in enumerate(pdf.pages, start=1):
            rows = collections.defaultdict(list)
            for c in page.chars:
                rows[round(c["top"] / 3)].append(c)
            for k in sorted(rows):
                cs = sorted(rows[k], key=lambda c: c["x0"])
                text = clean("".join(c["text"] for c in cs))
                if not text:
                    continue
                size = max(c["size"] for c in cs)
                top = cs[0]["top"]
                if 15.5 <= size <= 17.0:
                    if current and current[0] == pno and top - current[1] < 24:
                        current = (pno, top, clean(current[2] + " " + text))
                    else:
                        current = (pno, top, text)
                elif text == "Programme Specific Eligibility":
                    out.append(current[2] if current else None)
    return out


def parse(path, pdf_path=None):
    fh = font_headings(pdf_path) if pdf_path else None
    lines = open(path, encoding="utf-8", errors="replace").read().split("\n")
    progs = []
    for i, line in enumerate(lines):
        if clean(line) != "Programme Specific Eligibility":
            continue
        heading = find_heading(lines, i)
        blocks_seen = len(progs)
        # Block ends at the next heading-like line (centred) or the next "Programme Specific Eligibility".
        block = []
        j = i + 1
        while j < len(lines):
            raw = lines[j]
            t = clean(raw)
            indent = len(raw) - len(raw.lstrip())
            if t == "Programme Specific Eligibility":
                break
            # A section banner (all caps, several words) ends the eligibility block.
            if len(t.split()) >= 3 and t.isupper():
                break
            if t and len(t) <= 95 and DEGREE.match(t) and block and (not clean(lines[j - 1]) or lines[j].startswith("")) and not clean(lines[j + 1]):
                break
            block.append(t)
            j += 1
        # Join wrapped combination lines, drop page furniture.
        text = []
        for t in block:
            if re.match(r"^(It is mandatory for the candidates|[ivxlc]+$|\d+$)", t):
                continue
            text.append(t)
        joined = []
        for t in text:
            if not t:
                joined.append("")
            elif joined and joined[-1] and not re.match(r"^(Combination|OR$|Merit|Candidates|Note|\d+\.)", t):
                joined[-1] += " " + t
            else:
                joined.append(t)
        combos, notes = [], []
        for t in joined:
            m = re.match(r"^Combination\s+([IVX]+)\s*:\s*(.*)$", t)
            if m:
                body = re.sub(r"\s+AND$", "", clean(m.group(2)))
                slots = parse_combination(body)
                combos.append({"label": f"Combination {m.group(1)}", "text": body, "parsed": slots is not None, "slots": slots})
            elif t and t != "OR" and not t.startswith("Candidates must appear in CUET in any of the following"):
                notes.append(t)
        blob = " ".join(joined)
        if fh is not None:
            if blocks_seen >= len(fh):
                raise SystemExit("more eligibility blocks in text than headings in font stream")
            heading = fh[blocks_seen]
        progs.append({
            "heading": heading,
            "line": i + 1,
            "combinations": combos,
            "notes": notes,
            # "Candidates must appear in any one language from List A in CUET" on top of the listed subjects.
            "requiresLanguage": bool(re.search(r"must appear in any one language from List A", blob, re.I)),
            "performanceTest": bool(re.search(r"Performance[- ]Based Test|Performance-based test", blob, re.I)),
        })
    if fh is not None and len(fh) != len(progs):
        raise SystemExit(f"font stream has {len(fh)} eligibility labels but text has {len(progs)} blocks")
    return progs


if __name__ == "__main__":
    src, out = sys.argv[1:3]
    pdf_path = sys.argv[3] if len(sys.argv) > 3 else None
    progs = parse(src, pdf_path)
    total = sum(len(p["combinations"]) for p in progs)
    unparsed = [(p["heading"], c["text"]) for p in progs for c in p["combinations"] if not c["parsed"]]
    nohead = [p["line"] for p in progs if not p["heading"]]
    nocombo = [p["heading"] for p in progs if not p["combinations"]]
    print(f"{len(progs)} eligibility blocks, {total} combinations, unparsed={len(unparsed)}, no-heading={len(nohead)}, no-combos={len(nocombo)}")
    for u in unparsed[:30]:
        print("  UNPARSED:", u)
    for h in nocombo[:20]:
        print("  NO COMBOS:", h)
    print("  no heading at lines:", nohead[:10])
    json.dump(progs, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
