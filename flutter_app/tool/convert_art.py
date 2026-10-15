"""Converts the generated Night Sheet art (PNG) into app-ready WebP in assets/art/.

Usage (from flutter_app):
    python tool/convert_art.py [source folder] [--only PREFIX]
Default source: ../tmp/design-concepts/assets
--only mobi- converts the Mobi poses alone and leaves every other file in assets/art as it is.

Brief section 9: quality 82; Mobi 512 px; the hero about 768 px wide; paper 512 px.
Transparent art is trimmed to its visible bounds (plus a little air) and keeps its alpha.

Subject objects (obj-*) are exported at up to 1024 px on the long side and are never enlarged: a
source smaller than that ships at its own size (the old Oct 13 renders trim to 800 to 1000 px). Each
file is held to a size cap (OBJECT_CAP) by lowering the quality in steps from 82, because the files are
photographic and an unbounded 1024 px object would add 200 KB or more to the APK. A few very detailed
renders (the glass brain, the wheat sheaf) stay above the cap at the lowest step; the wheat is also exported
at 800 px, and test/unit/art/object_sharpness_test.dart holds every file under 190 KB and the set under 3.6 MB. The thirteen
objects added on 15 Oct 2026 (environmentalstudies ... teachingaptitude) and the two re-renders of
accountancy and computerscience exist only as renders on a flat black ground: they are matted (a clean,
gamma-correct alpha from the difference to the ground), kept as full-size RGBA masters and exported with
tmp/feature-wave-1015/masters/I2/export.py, which writes these same files. tool/asset_audit.py checks every
file against the pixels its call sites need.
"""
import io
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "art"
DEFAULT_SRC = ROOT.parent / "tmp" / "design-concepts" / "assets"
# Per-file size caps in bytes (quality steps down from 82 until a file fits). The old whole folder cap of
# 1.4 MB no longer describes the folder: the painted scenes alone are over 2 MB at their native sizes.
OBJECT_CAP = 140 * 1024
DEFAULT_CAP = 300 * 1024

# name: (box (w, h) the image is fitted inside, trim transparent margins)
SPEC = {
    "hero-desk": ((768, 1660), False),
    "hero-slab": ((768, 1660), False),
    "paper-tile": ((512, 512), False),
    "foil-seal": ((384, 384), True),
    "empty-allclear": ((768, 512), True),
    "empty-offline": ((768, 512), True),
}
for pose in ("greet", "point", "think", "cheer", "rest", "sleepy", "read"):
    SPEC[f"mobi-{pose}"] = ((512, 512), True)
for token in ("first-mock", "first-repair", "held"):
    SPEC[f"token-{token}"] = ((320, 320), True)
# The 29 subject objects: 1024 px on the long side at most, trimmed to the object plus 3 percent of air
# (the same crop the SubjectRender table's feet are measured on), never enlarged.
OBJECTS = (
    "accountancy", "biology", "business", "chemistry", "computerscience", "economics", "english", "generaltest", "geography",
    "history", "language", "mathematics", "physics", "politicalscience", "psychology", "sociology",
    "environmentalstudies", "massmedia", "homescience", "physicaleducation", "legalstudies", "knowledgetradition",
    "anthropology", "finearts", "performingarts", "engineeringgraphics", "entrepreneurship", "agriculture", "teachingaptitude",
)
for obj in OBJECTS:
    SPEC[f"obj-{obj}"] = ((1024, 1024), True)


def prepare(path: Path, box, trim: bool) -> Image.Image:
    im = Image.open(path)
    has_alpha = im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info)
    im = im.convert("RGBA" if has_alpha else "RGB")
    if has_alpha and trim:
        mask = im.getchannel("A").point(lambda v: 255 if v > 8 else 0)
        bbox = mask.getbbox()
        if bbox:
            pad = int(max(bbox[2] - bbox[0], bbox[3] - bbox[1]) * 0.03)
            l, t, r, b = bbox
            im = im.crop((max(0, l - pad), max(0, t - pad), min(im.width, r + pad), min(im.height, b + pad)))
    if box[0] == box[1] and not has_alpha and im.width != im.height:
        # Square textures (the paper tile) are cut from the centre so they still tile.
        side = min(im.width, im.height)
        left, top = (im.width - side) // 2, (im.height - side) // 2
        im = im.crop((left, top, left + side, top + side))
    im.thumbnail(box, Image.LANCZOS)
    if path.stem.startswith("empty-"):
        im = feather(im)
    return im


def feather(im: Image.Image) -> Image.Image:
    """Fades a scene's edges to transparent in an ellipse, so a vignette melts into the ground
    instead of sitting on it as a rectangle (baked here: no runtime mask)."""
    im = im.convert("RGBA")
    w, h = im.size
    cx, cy = w / 2, h * 0.48
    alpha = Image.new("L", (w, h))
    px = alpha.load()
    for y in range(h):
        for x in range(w):
            d = ((x - cx) / (w * 0.5)) ** 2 + ((y - cy) / (h * 0.52)) ** 2
            v = 1.0 if d <= 0.42 else max(0.0, 1.0 - (d - 0.42) / 0.5)
            px[x, y] = int(255 * v * v * (3 - 2 * v))
    im.putalpha(Image.composite(im.getchannel("A"), Image.new("L", (w, h)), alpha).point(lambda a: a))
    im.putalpha(Image.eval(alpha, lambda a: a))
    return im


def encode(im: Image.Image, quality: int, name: str = "") -> bytes:
    buf = io.BytesIO()
    if name.startswith("obj-"):
        # Colour under fully transparent pixels is free to compress (it is never seen): 2x smaller files.
        im.save(buf, "WEBP", quality=quality, method=6, alpha_quality=100, exact=False)
    else:
        im.save(buf, "WEBP", quality=quality, method=6, exact=im.mode == "RGBA")
    return buf.getvalue()


def cap_for(name: str) -> int:
    return OBJECT_CAP if name.startswith("obj-") else DEFAULT_CAP


def main(src: Path, only: str = "") -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    images = {}
    for name, (box, trim) in SPEC.items():
        if only and not name.startswith(only):
            continue
        path = src / f"{name}.png"
        if not path.exists():
            print(f"missing  {name}")
            continue
        images[name] = prepare(path, box, trim)

    encoded, quality_of = {}, {}
    for name, im in images.items():
        for quality in (82, 80, 78, 76, 74, 72, 70, 68, 64):
            data = encode(im, quality, name)
            if len(data) <= cap_for(name):
                break
        encoded[name], quality_of[name] = data, quality
    total = sum(f.stat().st_size for f in OUT.glob("*.webp") if f.stem not in encoded) + sum(len(b) for b in encoded.values())
    for name, data in encoded.items():
        (OUT / f"{name}.webp").write_bytes(data)
        im = images[name]
        print(f"wrote    {name}.webp {im.width}x{im.height} {im.mode} {len(data) // 1024} KB at quality {quality_of[name]}")
    print(f"total {total / 1024 / 1024:.2f} MB")


if __name__ == "__main__":
    args = sys.argv[1:]
    prefix = ""
    if "--only" in args:
        i = args.index("--only")
        prefix = args[i + 1]
        del args[i : i + 2]
    main(Path(args[0]) if args else DEFAULT_SRC, prefix)
