"""Converts the generated Night Sheet art (PNG) into app-ready WebP in assets/art/.

Usage (from flutter_app):
    python tool/convert_art.py [source folder] [--only PREFIX]
Default source: ../tmp/design-concepts/assets
--only mobi- converts the Mobi poses alone and leaves every other file in assets/art as it is.

Brief section 9: quality 82; Mobi 512 px; the hero about 768 px wide; paper 512 px.
Transparent art is trimmed to its visible bounds (plus a little air) and keeps its alpha. The
whole assets/art folder is kept under about 1.4 MB by lowering quality in steps if needed. Files that are not
there yet are skipped, so the script can be run again when generation finishes.
"""
import io
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "art"
DEFAULT_SRC = ROOT.parent / "tmp" / "design-concepts" / "assets"
CAP_BYTES = int(1.4 * 1024 * 1024)

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


def encode(im: Image.Image, quality: int) -> bytes:
    buf = io.BytesIO()
    im.save(buf, "WEBP", quality=quality, method=6, exact=im.mode == "RGBA")
    return buf.getvalue()


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

    for quality in (82, 76, 70, 64):
        encoded = {name: encode(im, quality) for name, im in images.items()}
        # Files this run does not rewrite still count toward the cap.
        kept = sum(f.stat().st_size for f in OUT.glob("*.webp") if f.stem not in encoded)
        total = kept + sum(len(b) for b in encoded.values())
        if total <= CAP_BYTES:
            break
    for name, data in encoded.items():
        (OUT / f"{name}.webp").write_bytes(data)
        im = images[name]
        print(f"wrote    {name}.webp {im.width}x{im.height} {im.mode} {len(data) // 1024} KB")
    print(f"total {total / 1024 / 1024:.2f} MB at quality {quality}")


if __name__ == "__main__":
    args = sys.argv[1:]
    prefix = ""
    if "--only" in args:
        i = args.index("--only")
        prefix = args[i + 1]
        del args[i : i + 2]
    main(Path(args[0]) if args else DEFAULT_SRC, prefix)
