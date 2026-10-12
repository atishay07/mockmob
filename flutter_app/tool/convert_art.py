"""Converts the generated Night Sheet art (PNG) into app-ready WebP in assets/art/.

Usage (from flutter_app):
    python tool/convert_art.py [source folder]
Default source: ../tmp/design-concepts/assets

Brief section 9: quality 82; objects and Mobi 512 px; the hero about 768 px wide; paper 512 px.
Transparent art is trimmed to its visible bounds (plus a little air) and keeps its alpha. The
total raster art is kept near 3 MB by lowering quality in steps if needed. Files that are not
there yet are skipped, so the script can be run again when generation finishes.
"""
import io
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "art"
DEFAULT_SRC = ROOT.parent / "tmp" / "design-concepts" / "assets"
CAP_BYTES = 3 * 1024 * 1024

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
for subject in ("accountancy", "business", "economics", "english", "generaltest"):
    SPEC[f"obj-{subject}"] = ((512, 512), True)
for token in ("first-mock", "first-repair", "held"):
    SPEC[f"token-{token}"] = ((320, 320), True)


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
    return im


def encode(im: Image.Image, quality: int) -> bytes:
    buf = io.BytesIO()
    im.save(buf, "WEBP", quality=quality, method=6, exact=im.mode == "RGBA")
    return buf.getvalue()


def main(src: Path) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    images = {}
    for name, (box, trim) in SPEC.items():
        path = src / f"{name}.png"
        if not path.exists():
            print(f"missing  {name}")
            continue
        images[name] = prepare(path, box, trim)

    for quality in (82, 76, 70, 64):
        encoded = {name: encode(im, quality) for name, im in images.items()}
        total = sum(len(b) for b in encoded.values())
        if total <= CAP_BYTES:
            break
    for name, data in encoded.items():
        (OUT / f"{name}.webp").write_bytes(data)
        im = images[name]
        print(f"wrote    {name}.webp {im.width}x{im.height} {im.mode} {len(data) // 1024} KB")
    print(f"total {total / 1024 / 1024:.2f} MB at quality {quality}")


if __name__ == "__main__":
    main(Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SRC)
