"""Parse DU CSAS 2026 minimum-allocation-score PDFs into rows.

Geometry-based, not text-regex based. The PDFs draw a border under every table
row, so each row is the band between two horizontal borders. Inside a band:
  - exactly one S.NO word (the row id),
  - score values aligned to the page's own header columns (x position),
  - the college and programme names, which may wrap over several lines above or
    below the S.NO line (alignment differs between rounds).
Anything that cannot be assigned unambiguously raises, so a wrong cutoff can
never be silently emitted.

Usage: python scripts/du-csas/parse_cutoffs.py <pdf> <round-label> <out.json>
"""
import json
import re
import sys

import pdfplumber

NUM = re.compile(r"^\d+(\.\d+)?$")
HEADER_MAP = {
    "UR": "UR",
    "NCL": "OBC-NCL",
    "SC": "SC",
    "ST": "ST",
    "EWS": "EWS",
    "SIKH": "SIKH",
    "PwBD": "PwBD",
    "KM": "KM",
    "SGC": "SGC",
    "FEMALE": "ORPHAN-FEMALE",
    "MALE": "ORPHAN-MALE",
}


def cy(w):
    return (w["top"] + w["bottom"]) / 2


def cx(w):
    return (w["x0"] + w["x1"]) / 2


def page_header(words):
    sno = [w for w in words if w["text"] in ("S.NO", "S.NO.")]
    if not sno:
        return None
    hy = cy(sno[0])
    line = [w for w in words if abs(cy(w) - hy) < 2.5]
    cols = sorted(((HEADER_MAP[w["text"]], cx(w)) for w in line if w["text"] in HEADER_MAP), key=lambda c: c[1])
    names = [c[0] for c in cols]
    if sorted(names) != sorted(set(HEADER_MAP.values())):
        raise ValueError(f"unexpected header columns {names}")
    college = next(w for w in line if w["text"] == "COLLEGE")
    programme = next(w for w in line if w["text"] == "PROGRAMME")
    ur_x = next(c[1] for c in cols if c[0] == "UR")
    return hy, cols, college["x0"] - 6, programme["x0"] - 6, ur_x - 20, ur_x


def row_borders(page, ur_x, hy):
    """y positions of horizontal borders that cross the UR column (one per row)."""
    ys = []
    for r in page.rects:
        if r["height"] <= 0.6 and r["width"] > 5 and r["x0"] - 1 <= ur_x <= r["x1"] + 1 and r["top"] > hy:
            ys.append(r["top"])
    ys.sort()
    merged = []
    for y in ys:
        if not merged or y - merged[-1] > 3:
            merged.append(y)
    return merged


def nearest_col(x, cols):
    best = min(cols, key=lambda c: abs(c[1] - x))
    if abs(best[1] - x) > 14:
        raise ValueError(f"value at x={x:.0f} is not under any header (nearest {best})")
    return best[0]


def parse(pdf_path):
    rows = []
    with pdfplumber.open(pdf_path) as pdf:
        for pno, page in enumerate(pdf.pages, start=1):
            words = page.extract_words()
            hdr = page_header(words)
            if hdr is None:
                continue
            hy, cols, college_x0, programme_x0, value_x0, ur_x = hdr
            borders = row_borders(page, ur_x, hy)
            if len(borders) < 2:
                continue
            bands = list(zip(borders[:-1], borders[1:]))
            body = [
                w for w in words
                if borders[0] - 1 <= cy(w) <= borders[-1] + 1
                and not (w["x0"] > page.width - 60 and cy(w) > page.height - 55)
            ]
            recs = []
            for top, bottom in bands:
                inside = [w for w in body if top - 0.5 <= cy(w) < bottom - 0.5]
                anchors = [
                    w for w in inside
                    if NUM.match(w["text"]) and "." not in w["text"] and w["x1"] <= college_x0 + 8
                ]
                if not anchors:
                    if not inside:
                        continue
                    # A row whose name straddles a page break: its tail is the
                    # first band of the next page, with names only (no values).
                    if (top, bottom) == bands[0] and rows and all(cx(w) < value_x0 for w in inside):
                        prev = rows[-1]
                        for side in ("college", "programme"):
                            ws = sorted(
                                (w for w in inside if (w["x0"] < programme_x0) == (side == "college")),
                                key=lambda w: (round(cy(w) / 3), w["x0"]),
                            )
                            if ws:
                                prev[side] = re.sub(r"\s+", " ", prev[side] + " " + " ".join(w["text"] for w in ws)).strip()
                        continue
                    raise ValueError(
                        f"p{pno}: band {top:.0f}-{bottom:.0f} has words but no S.NO: {[w['text'] for w in inside][:6]}"
                    )
                if len(anchors) != 1:
                    raise ValueError(f"p{pno}: band {top:.0f}-{bottom:.0f} has {len(anchors)} S.NO words")
                rec = {"sno": int(anchors[0]["text"]), "college": [], "programme": [], "scores": {}, "page": pno}
                for w in inside:
                    if w is anchors[0]:
                        continue
                    x = cx(w)
                    if x >= value_x0:
                        if not NUM.match(w["text"]):
                            raise ValueError(f"p{pno} S.NO {rec['sno']}: non-numeric value cell {w['text']!r}")
                        key = nearest_col(x, cols)
                        if key in rec["scores"]:
                            raise ValueError(f"p{pno} S.NO {rec['sno']}: duplicate {key}")
                        rec["scores"][key] = float(w["text"])
                    else:
                        rec["college" if w["x0"] < programme_x0 else "programme"].append(w)
                for side in ("college", "programme"):
                    ws = sorted(rec[side], key=lambda w: (round(cy(w) / 3), w["x0"]))
                    rec[side] = re.sub(r"\s+", " ", " ".join(w["text"] for w in ws)).strip()
                if not rec["college"] or not rec["programme"]:
                    raise ValueError(f"p{pno}: S.NO {rec['sno']} missing a name: {rec}")
                recs.append(rec)
            rows.extend(recs)
    return rows


if __name__ == "__main__":
    pdf_path, label, out = sys.argv[1:4]
    data = parse(pdf_path)
    snos = [r["sno"] for r in data]
    expected = list(range(snos[0], snos[0] + len(snos)))
    gaps = sorted(set(expected) - set(snos))
    dupes = len(snos) - len(set(snos))
    print(f"{label}: {len(data)} rows, S.NO {min(snos)}..{max(snos)}, gaps={len(gaps)}, dupes={dupes}")
    if snos != sorted(snos) or dupes or gaps:
        raise SystemExit(f"S.NO sequence is not contiguous: gaps={gaps[:10]} dupes={dupes}")
    cells = sum(len(r["scores"]) for r in data)
    print(f"  {cells} score cells; max score {max(max(r['scores'].values()) for r in data if r['scores']):.4f}")
    json.dump({"round": label, "rows": data}, open(out, "w", encoding="utf-8"), ensure_ascii=False)
