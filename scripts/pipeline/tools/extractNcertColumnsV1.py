"""Column-aware, verified re-extraction of NCERT chapter PDFs (source custody repair, 10 Oct 2026).

Why: the registered NCERT facts came from a reading-order-naive extraction; about half splice two text columns
("staffing is appraisal of work force. In other a continuous process because new words ..."), so no faithful contiguous
quotation exists and validators cannot bind decisive premises. This tool never rewrites, corrects or summarises text.

Per page: detect a vertical gutter from glyph positions; read each column top-to-bottom; build words from glyphs with a
space only where the horizontal gap is >= 0.12 x font size (measured on lebs106 pp.2-13: spaces confirmed by an independent
extractor sit at >= 0.15 x size, intra-word kerning at 0.05-0.07; pdfplumber's default fixed 3 pt tolerance merges real words
in tight justified lines); split paragraphs on vertical gaps; keep line breaks, so only a genuine line-end hyphen can later
join a word.

Verification (independent extractor): every paragraph's letter/digit character stream must occur contiguously, in order,
inside the letter/digit stream that xpdf/poppler `pdftotext -raw` (content-stream order) produces for the same page. This
proves reading order and character identity without depending on either tool's word spacing. Unverified paragraphs are kept
with verified=false and must never be registered.

usage: python extractNcertColumnsV1.py <pdf> <out.json>
"""
import hashlib, json, re, subprocess, sys
import pdfplumber

METHOD = "ncert-columns-v1: pdfplumber glyph gutter + 0.12em word gaps; verify = in-order alnum stream contiguity vs xpdf pdftotext -raw page"
ALNUM = re.compile(r"[A-Za-z0-9]")
SPACE_EM = 0.12
LINE_TOL = 3.0


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def find_gutter(chars, width):
    """Return the centre of an empty vertical band (>= 10 pt, no glyph inside) that splits two text columns, else None.
    A 1%-crossing tolerance (first version) cut single-column justified accountancy pages through word gaps, so the band must be
    genuinely empty: at most 0.4% of body glyphs may touch it (measured: two-column BS pages <= 0.39%, single-column pages >= 0.57%), and each side must carry at least 15% of the glyphs."""
    body = [c for c in chars if c["text"].strip()]
    if len(body) < 200:
        return None
    best = None
    for x in range(int(width * 0.3), int(width * 0.7)):
        touching = sum(1 for c in body if c["x0"] < x + 5 and c["x1"] > x - 5)
        left = sum(1 for c in body if c["x1"] <= x - 5)
        right = sum(1 for c in body if c["x0"] >= x + 5)
        if left < len(body) * 0.15 or right < len(body) * 0.15:
            continue
        if best is None or touching < best[0]:
            best = (touching, x)
    if best and best[0] <= len(body) * 0.004:
        return best[1]
    return None


def build_lines(chars):
    chars = [c for c in chars if c["text"] != ""]
    chars.sort(key=lambda c: (c["top"], c["x0"]))
    lines = []
    for c in chars:
        if lines and abs(lines[-1]["top"] - c["top"]) <= LINE_TOL:
            lines[-1]["chars"].append(c)
        else:
            lines.append({"top": c["top"], "chars": [c]})
    out = []
    for line in lines:
        cs = sorted(line["chars"], key=lambda c: c["x0"])
        text, prev, pending = "", None, False
        for c in cs:
            if c["text"].isspace():
                pending = True  # an explicit space glyph in the PDF is a word space
                prev = c
                continue
            if text and (pending or (prev is not None and (c["x0"] - prev["x1"]) >= SPACE_EM * max(c.get("size") or 10, 1))):
                text += " "
            pending = False
            text += c["text"]
            prev = c
        text = text.strip()
        if text:
            out.append({"top": line["top"], "bottom": max(c["bottom"] for c in cs), "x0": min(c["x0"] for c in cs), "x1": max(c["x1"] for c in cs),
                        "size": max((c.get("size") or 0) for c in cs), "text": text})
    return out


def paragraphs_of(lines):
    if not lines:
        return []
    gaps = sorted(b["top"] - a["top"] for a, b in zip(lines, lines[1:]) if b["top"] > a["top"])
    step = gaps[len(gaps) // 2] if gaps else 14
    paras, cur = [], [lines[0]]
    for prev, line in zip(lines, lines[1:]):
        if line["top"] - prev["top"] > step * 1.6:
            paras.append(cur)
            cur = [line]
        else:
            cur.append(line)
    paras.append(cur)
    return paras


_PAGE = {}


def page_stream(pdf, page_no):
    key = (pdf, page_no)
    if key not in _PAGE:
        out = subprocess.run(["pdftotext", "-q", "-enc", "UTF-8", "-raw", "-f", str(page_no), "-l", str(page_no), pdf, "-"],
                             capture_output=True, text=True, encoding="utf-8", errors="replace").stdout
        _PAGE[key] = "".join(ALNUM.findall(out))
    return _PAGE[key]


def main(pdf, out):
    result = {"pdf": pdf, "pdf_sha256": sha256(pdf), "method": METHOD, "space_em": SPACE_EM, "pages": []}
    with pdfplumber.open(pdf) as doc:
        for index, page in enumerate(doc.pages, start=1):
            chars = page.chars
            gutter = find_gutter(chars, page.width)
            columns = [chars] if gutter is None else [[c for c in chars if c["x1"] <= gutter], [c for c in chars if c["x0"] >= gutter]]
            page_out = {"page": index, "width": page.width, "height": page.height, "gutter": gutter, "columns": []}
            stream = page_stream(pdf, index)
            for ci, cchars in enumerate(columns):
                col_out = {"column": ci, "paragraphs": []}
                for pi, para in enumerate(paragraphs_of(build_lines(cchars))):
                    # Maximal runs of consecutive lines whose alnum stream occurs contiguously in the independent page stream.
                    # Headings, figure labels and stray list numerals fall out as short or unverified runs instead of sinking a paragraph.
                    runs, cur = [], []
                    for line in para:
                        trial = cur + [line]
                        if "".join(ALNUM.findall("".join(l["text"] for l in trial))) in stream:
                            cur = trial
                        else:
                            if cur:
                                runs.append((cur, True))
                            ok = "".join(ALNUM.findall(line["text"])) in stream
                            cur = [line] if ok else []
                            if not ok:
                                runs.append(([line], False))
                    if cur:
                        runs.append((cur, True))
                    for si, (run, ok) in enumerate(runs):
                        text = "\n".join(line["text"] for line in run)
                        alnum = "".join(ALNUM.findall(text))
                        col_out["paragraphs"].append({"paragraph": pi, "segment": si, "text": text, "lines": len(run), "alnum_chars": len(alnum),
                                                      "verified": bool(ok and alnum and alnum in stream),
                                                      "bbox": [round(min(l["x0"] for l in run), 1), round(min(l["top"] for l in run), 1),
                                                               round(max(l["x1"] for l in run), 1), round(max(l["bottom"] for l in run), 1)]})
                page_out["columns"].append(col_out)
            result["pages"].append(page_out)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=1)
    paras = [p for pg in result["pages"] for c in pg["columns"] for p in c["paragraphs"]]
    big = [p for p in paras if p["alnum_chars"] >= 200]
    print(json.dumps({"pdf": pdf, "pages": len(result["pages"]), "two_column_pages": sum(1 for pg in result["pages"] if pg["gutter"]),
                      "paragraphs": len(paras), "verified": sum(1 for p in paras if p["verified"]),
                      "body_paragraphs_200plus": len(big), "body_verified": sum(1 for p in big if p["verified"])}))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
