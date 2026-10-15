"""Compares the pixels each picture needs at its call sites with the pixels its file holds.

Usage (from flutter_app):
    python tool/asset_audit.py            # a table, one row per call site, worst first
    python tool/asset_audit.py --json     # the same rows as JSON
    python tool/asset_audit.py --all      # also list sites that are comfortably sharp

A site needs `drawn dp x device pixel ratio` pixels across. The audit uses two ratios: 3.5 (a typical
high-density phone) and 4.0 (the top end). A file with fewer pixels than the 3.5 need is "soft":
Flutter stretches it, and a hard-edged render turns blurry. More than 1.6 times the 4.0 need is
"heavy": it only costs APK size, because the decode is already cut to the drawn width.

Sources of truth, read from the code so this cannot drift:
  - the object renders: `SubjectRender` entries in lib/core/art/object_art.dart (their declared pixel size is
    also checked against the file), drawn the way `SubjectRender.rectIn` draws them at each emblem size;
  - the painted scenes: `SceneArt` in lib/core/widgets/art/scene_art.dart, drawn full width on phones from
    360 to 412 dp wide (the milestone band and the empty states fill the width; the portrait rooms too).
Other pictures (Mobi poses, tokens, the hero desk) are listed with their file pixels only, because their
call sites size them from the layout; run with `--site name=dp` to test one by hand.
"""
import json
import re
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / "assets" / "art"
DPRS = (3.5, 4.0)

# The emblem sides the app draws an object at (EmblemSizes, SubjectTiles.emblemSize), with whether the
# call site uses the framed tile. Review's artSize and the Today hero use EmblemSizes.hero (136).
EMBLEM_SIDES = [
    ("chip row (EmblemSizes.chip 40)", 40.0, False),
    ("picker tile (EmblemSizes.tile 56)", 56.0, False),
    ("subject tile with count (SubjectTiles 84)", 84.0, False),
    ("subject tile (SubjectTiles 96)", 96.0, False),
    ("hero prop (EmblemSizes.hero 136)", 136.0, False),
    ("framed tile (56)", 56.0, True),
]
PHONE_WIDTHS = (360.0, 412.0)


def contain(w, h, box_w, box_h):
    k = min(box_w / w, box_h / h)
    return w * k


def object_rows():
    src = (ROOT / "lib" / "core" / "art" / "object_art.dart").read_text(encoding="utf-8")
    entries = re.findall(r"SubjectRender\._\('(\w+)',\s*(\d+),\s*(\d+),", src)
    rows, mismatches = [], []
    for name, w, h in entries:
        w, h = int(w), int(h)
        path = ART / f"obj-{name}.webp"
        if not path.exists():
            mismatches.append(f"obj-{name}.webp is declared but missing")
            continue
        with Image.open(path) as im:
            fw, fh = im.size
        if (fw, fh) != (w, h):
            mismatches.append(f"obj-{name}.webp is {fw}x{fh} but object_art.dart says {w}x{h}")
        for label, side, framed in EMBLEM_SIDES:
            # SubjectRender.rectIn: the picture sits contained in the tile's inner box.
            box_w, box_h = (side * 0.83, side * 0.80) if framed else (side * 0.94, side * 0.88)
            drawn = contain(fw, fh, box_w, box_h)
            rows.append(site(f"obj-{name}.webp", label, drawn, fw))
    return rows, mismatches


def scene_rows():
    src = (ROOT / "lib" / "core" / "widgets" / "art" / "scene_art.dart").read_text(encoding="utf-8")
    entries = re.findall(r"\(\s*'([\w-]+)',\s*(\d+),\s*(\d+)\)", src)
    rows = []
    for file, w, h in entries:
        path = ART / f"{file}.webp"
        if not path.exists():
            rows.append({"file": f"{file}.webp", "site": "declared in SceneArt but missing", "status": "missing"})
            continue
        with Image.open(path) as im:
            fw, fh = im.size
        for width in PHONE_WIDTHS:
            rows.append(site(f"{file}.webp", f"scene drawn full width on a {int(width)} dp phone", width, fw))
    return rows


def site(file, label, drawn_dp, file_px):
    need35, need4 = drawn_dp * 3.5, drawn_dp * 4.0
    if file_px < need35 - 1:
        status = "soft"
    elif file_px > need4 * 1.6:
        status = "heavy"
    else:
        status = "ok"
    return {"file": file, "site": label, "drawn_dp": round(drawn_dp, 1), "need_px_3_5x": round(need35), "need_px_4x": round(need4),
            "file_px": file_px, "ratio_at_4x": round(file_px / need4, 2), "status": status}


def main(argv):
    rows, mismatches = object_rows()
    rows += scene_rows()
    for arg in argv:
        if arg.startswith("--site="):
            name, dp = arg[len("--site="):].split("=")
            with Image.open(ART / name) as im:
                rows.append(site(name, "by hand", float(dp), im.width))
    order = {"missing": 0, "soft": 1, "heavy": 2, "ok": 3}
    rows.sort(key=lambda r: (order[r["status"]], r.get("ratio_at_4x", 0)))
    # "heavy" is only APK weight (the decode is already cut to the drawn width), so it is summarised per file
    # as the headroom at the file's biggest call site instead of listed site by site.
    heavy = {}
    for r in rows:
        if r["status"] == "heavy" or (r["status"] == "ok" and r["file"] in heavy):
            heavy.setdefault(r["file"], []).append(r)
    shown = rows if "--all" in argv else [r for r in rows if r["status"] in ("missing", "soft")]
    if "--json" in argv:
        print(json.dumps({"mismatches": mismatches, "rows": shown, "headroom": {f: min(x["ratio_at_4x"] for x in v) for f, v in heavy.items()}}, indent=1))
        return
    for m in mismatches:
        print("MISMATCH", m)
    print(f"{len(rows)} call sites checked, {sum(r['status'] == 'soft' for r in rows)} soft, "
          f"{sum(r['status'] == 'heavy' for r in rows)} heavier than 1.6x the 4x need (APK weight only), {sum(r['status'] == 'missing' for r in rows)} missing")
    for r in shown:
        if r["status"] == "missing":
            print(f"missing  {r['file']}: {r['site']}")
            continue
        print(f"{r['status']:<6} {r['file']:<38} {r['site']:<46} needs {r['need_px_3_5x']:>4} to {r['need_px_4x']:>4} px, file {r['file_px']:>4} px ({r['ratio_at_4x']}x)")
    if heavy:
        print("headroom at the biggest call site (file pixels over the 4x need; more than 1.6x costs APK size only):",
              ", ".join(f"{f[:-5]} {min(x['ratio_at_4x'] for x in v)}x" for f, v in sorted(heavy.items())))
    others = sorted(p.name for p in ART.glob("*.webp") if not p.name.startswith(("obj-", "scene-")))
    print("not audited (call sites size them from the layout):", ", ".join(others))


if __name__ == "__main__":
    main(sys.argv[1:])
