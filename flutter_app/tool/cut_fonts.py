"""Cuts static Bricolage Grotesque instances from the variable font (Night Sheet brief, section 4).

Usage (from flutter_app):  python tool/cut_fonts.py <path to bricolage-var.ttf>

Writes assets/fonts/Bricolage*.ttf and checks that each instance keeps the `tnum` feature and
equal-width tabular digits. Static instances avoid relying on runtime variable axes.
"""
import sys
from pathlib import Path

from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

OUT = Path(__file__).resolve().parent.parent / "assets" / "fonts"

# (file stem, family name, axes, latin-only subset text or None for the full font)
INSTANCES = [
    ("BricolageCondensed-Bold", "Bricolage Condensed", {"wdth": 75, "wght": 700, "opsz": 96}, None),
    ("BricolageHeadline-SemiBold", "Bricolage Headline", {"wdth": 87, "wght": 650, "opsz": 48}, None),
    ("BricolageTitle-SemiBold", "Bricolage Title", {"wdth": 100, "wght": 600, "opsz": 24}, None),
    ("BricolageWordmark-Bold", "Bricolage Wordmark", {"wdth": 82, "wght": 700, "opsz": 48}, "abcdefghijklmnopqrstuvwxyz"),
]


def rename(font: TTFont, family: str, style: str) -> None:
    name = font["name"]
    full = f"{family} {style}"
    ps = f"{family.replace(' ', '')}-{style.replace(' ', '')}"
    for rec in list(name.names):
        if rec.nameID in (16, 17, 21, 22, 25):
            name.removeNames(nameID=rec.nameID)
    for nid, value in ((1, family), (2, "Regular"), (4, full), (6, ps)):
        name.setName(value, nid, 3, 1, 0x409)
        name.setName(value, nid, 1, 0, 0)


def has_tnum(font: TTFont) -> bool:
    return any(r.FeatureTag == "tnum" for r in font["GSUB"].table.FeatureList.FeatureRecord)


def main(src: str) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for stem, family, axes, subset_text in INSTANCES:
        var = TTFont(src)
        static = instancer.instantiateVariableFont(var, axes, updateFontNames=False)
        rename(static, family, "Regular")
        if subset_text:
            opts = Options()
            opts.layout_features = ["*"]
            opts.name_IDs = ["*"]
            sub = Subsetter(opts)
            sub.populate(text=subset_text)
            sub.subset(static)
        path = OUT / f"{stem}.ttf"
        static.save(path)
        check = TTFont(path)
        digits = ""
        if not subset_text:
            cmap = check.getBestCmap()
            widths = {check["hmtx"][cmap[ord(c)]][0] for c in "0123456789"}
            digits = f"default digit widths {sorted(widths)}"
        print(f"{path.name}: {path.stat().st_size // 1024} KB, tnum={has_tnum(check)} {digits}")


if __name__ == "__main__":
    main(sys.argv[1])
