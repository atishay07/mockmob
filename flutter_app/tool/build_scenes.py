"""Builds the painted scenes (assets/art/scene-*.webp) from the full-resolution masters, and measures
the anchors Mobi and the seal land on (writes ../shared/scene-anchors.json).

Usage (from flutter_app):
    python tool/build_scenes.py [masters folder]
Default masters: ../../mockmob-next/tmp/feature-wave-1015/masters/I1 (the Codex originals, kept at
full resolution, plus the processed full-size PNGs this script writes into <masters>/processed/ for
the website's own sizes).

What it does, per file:
- The empty states and the milestone band are native 1536 x 1024 originals, feathered to transparent
  at every edge (so they sit on the ground of either theme with no seam) and encoded as WebP with
  alpha, quality searched down from 92 until the file fits its budget.
- The two tall rooms (welcome, plan seal) are cropped to their painted part, resized once with
  LANCZOS to 1296 px wide, given the 2 percent grain back, and blended into the exact ground colour
  at their foot (code paints the same ground under them).
Needs Pillow and numpy. Prints sizes, quality and the anchors; the budget for the whole set is
1.5 MB more than the set it replaces.
"""
import io
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "art"
SHARED = ROOT.parent / "shared"
HERE = ROOT.parent.parent  # .../mockmob copy
DEFAULT_MASTERS = HERE / "mockmob-next" / "tmp" / "feature-wave-1015" / "masters" / "I1"
OLD_FINAL = HERE / "mockmob-next" / "tmp" / "art-explore" / "final"

NIGHT_GROUND = (0x12, 0x11, 0x0E)
DAY_GROUND = (0xF3, 0xEF, 0xE6)
VIGNETTE_BUDGET = 175 * 1000
BAND_BUDGET = 150 * 1000
TALL_BUDGET = 230 * 1000


def smooth(t):
    t = np.clip(t, 0, 1)
    return t * t * (3 - 2 * t)


def encode_under(im, limit, lo=60, hi=94, **kw):
    best = None
    while lo <= hi:
        q = (lo + hi) // 2
        buf = io.BytesIO()
        im.save(buf, "WEBP", quality=q, method=6, **kw)
        if buf.tell() <= limit:
            best, lo = (q, buf.getvalue()), q + 1
        else:
            hi = q - 1
    if best is None:  # nothing fits: take the lowest and let the report say so
        buf = io.BytesIO()
        im.save(buf, "WEBP", quality=60, method=6, **kw)
        best = (60, buf.getvalue())
    return best


def feathered(im, fx=0.07, fy_top=0.07, fy_bottom=0.10):
    """RGBA with every edge feathered to transparent (smoothstep), size unchanged."""
    im = im.convert("RGB")
    w, h = im.size
    xs = np.arange(w, dtype=np.float32) / (w - 1)
    ys = np.arange(h, dtype=np.float32) / (h - 1)
    ax = smooth(np.minimum(xs, 1 - xs) / fx)
    ay = smooth(np.minimum(ys / fy_top, (1 - ys) / fy_bottom))
    alpha = ay[:, None] * ax[None, :]
    rgba = im.convert("RGBA")
    rgba.putalpha(Image.fromarray((alpha * 255 + 0.5).astype("uint8")))
    return rgba


def blend_bottom(im, ground, start, end=1.0):
    a = np.asarray(im.convert("RGB")).astype(np.float32)
    h = a.shape[0]
    y = np.arange(h, dtype=np.float32) / (h - 1)
    t = smooth((y - start) / (end - start))[:, None, None]
    g = np.array(ground, dtype=np.float32)[None, None, :]
    return Image.fromarray(np.clip(a * (1 - t) + g * t + 0.5, 0, 255).astype("uint8"))


def grain(im, amount=0.02, seed=7):
    """About [amount] of film grain (std as a share of 255), the house 2 percent."""
    a = np.asarray(im.convert("RGB")).astype(np.float32)
    rng = np.random.default_rng(seed)
    n = rng.normal(0, amount * 255, a.shape[:2]).astype(np.float32)[..., None]
    return Image.fromarray(np.clip(a + n, 0, 255).astype("uint8"))


def tall_room(src, size, blend_start, ground):
    """A painted portrait room: resized once with LANCZOS to [size], the 2 percent grain given back,
    then blended into [ground] from [blend_start] (a share of the height) so the foot meets the flat
    ground that code paints under it with no seam (and no grain on the flat ground)."""
    im = Image.open(src).convert("RGB").resize(size, Image.LANCZOS)
    return blend_bottom(grain(im), ground, blend_start)


def lum(im):
    a = np.asarray(im.convert("RGB")).astype(np.float32)
    return 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]


def ellipse_of(im, night=True, centre=(0.52, 0.79)):
    """The lit floor ellipse as fractions: cx, cy, w, h. The patch is the connected region around
    [centre] that is at least halfway from the bare floor to the ellipse's own level (Night: luminance;
    Day: how much warmer than the cream it is), measured on a 4x smaller copy and kept below y = 0.70
    so the lamp's cone, which melts into the ellipse, is not counted."""
    im = im.convert("RGB")
    W, H = im.size
    small = im.resize((W // 4, H // 4), Image.BOX).filter(ImageFilter.GaussianBlur(1.5))
    a = np.asarray(small).astype(np.float32)
    v = lum(small) if night else (a[..., 0] + a[..., 1]) / 2 - a[..., 2]
    h, w = v.shape
    cy, cx = int(centre[1] * h), int(centre[0] * w)
    core = v[int((centre[1] - 0.02) * h):int((centre[1] + 0.02) * h), int((centre[0] - 0.05) * w):int((centre[0] + 0.05) * w)]
    level = np.percentile(core, 50)
    floor = np.median(v[int(0.94 * h):int(0.98 * h), int(0.3 * w):int(0.7 * w)])
    cut = floor + 0.5 * (level - floor)
    mask = (v > cut) if level > floor else (v < cut)
    mask[: int(0.70 * h)] = False
    seen = np.zeros_like(mask)
    stack = [(cy, cx)]
    seen[cy, cx] = True
    xs, ys = [], []
    while stack:
        y, x = stack.pop()
        xs.append(x)
        ys.append(y)
        for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                stack.append((ny, nx))
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    return dict(cx=round((x0 + x1) / 2 / w, 4), cy=round((y0 + y1) / 2 / h, 4), w=round((x1 - x0) / w, 4), h=round((y1 - y0) / h, 4))


def ellipse_of_day(im, y0=0.66, y1=0.92, thresh=0.80):
    """Day's sunlit ellipse, which is only a little warmer than the cream: the warm patch (the method of
    art-explore/final/anchors.py), as fractions cx, cy, w, h."""
    im = im.convert("RGB")
    W, H = im.size
    a = np.asarray(im.filter(ImageFilter.GaussianBlur(4))).astype(np.float32)[int(y0 * H):int(y1 * H)]
    warm = (a[..., 0] + a[..., 1]) / 2 - a[..., 2]
    ys, xs = np.nonzero(warm > thresh * np.percentile(warm, 99.5))
    x0, x1 = xs.min(), xs.max()
    yb0, yb1 = ys.min() + int(y0 * H), ys.max() + int(y0 * H)
    return dict(cx=round((x0 + x1) / 2 / W, 4), cy=round((yb0 + yb1) / 2 / H, 4), w=round((x1 - x0) / W, 4), h=round((yb1 - yb0) / H, 4))


def bulb_of(im, box=(0.25, 0.08, 0.55, 0.30)):
    """The lamp's bulb (the brightest compact patch inside [box], fractions): x, y."""
    im = im.convert("RGB")
    W, H = im.size
    x0, y0, x1, y1 = [int(v * s) for v, s in zip(box, (W, H, W, H))]
    sub = lum(im.filter(ImageFilter.GaussianBlur(5)))[y0:y1, x0:x1]
    m = sub > 0.95 * sub.max()
    ys, xs = np.nonzero(m)
    return dict(x=round((xs.mean() + x0) / W, 4), y=round((ys.mean() + y0) / H, 4))


def save(path: Path, im, limit, report, note="", **kw):
    q, data = encode_under(im, limit, **kw)
    path.write_bytes(data)
    report[path.stem] = dict(size=list(im.size), quality=q, kb=round(len(data) / 1024, 1), note=note, over_budget=len(data) > limit)
    print(f"{path.stem:36s} {im.width}x{im.height} q{q} {len(data) / 1024:.1f} KB{'  OVER BUDGET' if len(data) > limit else ''}")


class _Tall:
    """The two portrait rooms' numbers, filled in by the tall-room step."""
    welcome = None
    plan_seal = None

    def update_doc(self, doc):
        if self.welcome:
            doc["welcome"] = self.welcome
        if self.plan_seal:
            doc["planSeal"] = self.plan_seal


TALL = _Tall()


def main():
    masters = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_MASTERS
    proc = masters / "processed"
    proc.mkdir(exist_ok=True)
    report, anchors = {}, {}

    # (asset name, source png, night?, scene key)
    vignettes = [
        ("scene-empty-allclear-night", OLD_FINAL / "refs" / "empty-allclear-c.png", True, "allClear"),
        ("scene-empty-allclear-day", OLD_FINAL / "raw" / "empty-allclear-c-day.png", False, "allClear"),
        ("scene-empty-offline-night", OLD_FINAL / "refs" / "empty-offline-c.png", True, "offline"),
        ("scene-empty-offline-day", OLD_FINAL / "raw" / "empty-offline-c-day.png", False, "offline"),
        ("scene-empty-nothing-night", masters / "scene-nothing-night.png", True, "nothingYet"),
        ("scene-empty-nothing-day", masters / "scene-nothing-day.png", False, "nothingYet"),
        ("scene-empty-saved-night", masters / "scene-saved-night.png", True, "saved"),
        ("scene-empty-saved-day", masters / "scene-saved-day.png", False, "saved"),
        ("scene-empty-noresults-night", masters / "scene-noresults-night.png", True, "noResults"),
        ("scene-empty-noresults-day", masters / "scene-noresults-day.png", False, "noResults"),
        ("scene-empty-unreachable-night", masters / "scene-unreach-night.png", True, "unreachable"),
        ("scene-empty-unreachable-day", masters / "scene-unreach-day.png", False, "unreachable"),
    ]
    for name, src, night, key in vignettes:
        if not src.exists():
            print("skip (no master yet):", name)
            continue
        im = Image.open(src).convert("RGB")
        assert im.size == (1536, 1024), f"{src} is {im.size}, not the native 1536 x 1024 original"
        rgba = feathered(im)
        rgba.save(proc / f"{name}.png")
        save(OUT / f"{name}.webp", rgba, VIGNETTE_BUDGET, report, alpha_quality=90)
        e = ellipse_of(im) if night else ellipse_of_day(im)
        a = anchors.setdefault(key, {})
        a["night" if night else "day"] = dict(footX=e["cx"], footY=round(e["cy"] + 0.011, 3), ellipse=e)
        if night:
            a["night"]["lamp"] = bulb_of(im, box=(0.30, 0.20, 0.50, 0.42) if key == "offline" else (0.30, 0.08, 0.52, 0.30))

    # The milestone band: a native 1536 x 1024 frame, feathered at every edge.
    for name, src, night in [
        ("scene-milestone-check-night", masters / "milestone-night-band.png", True),
        ("scene-milestone-check-day", masters / "milestone-day-band.png", False),
    ]:
        if not src.exists():
            print("skip (no master yet):", name)
            continue
        im = Image.open(src).convert("RGB")
        assert im.size == (1536, 1024), f"{src} is {im.size}"
        rgba = feathered(im, fx=0.08, fy_top=0.08, fy_bottom=0.08)
        rgba.save(proc / f"{name}.png")
        save(OUT / f"{name}.webp", rgba, BAND_BUDGET, report, alpha_quality=90)

    # The two portrait rooms: native 1122 x 1402 and 1024 x 1536 originals (the generator's own
    # sizes), re-rendered from the old paintings 15 Oct 2026, cropped to the painted part.
    for name, src, size, start, ground, budget in [
        ("scene-welcome-hero-night", masters / "welcome-room.png", (1296, 1620), 0.93, NIGHT_GROUND, 240 * 1000),
        ("scene-plan-seal-night", masters / "plan-seal.png", (1296, 1944), 0.95, NIGHT_GROUND, 290 * 1000),
    ]:
        if not src.exists():
            print("skip (no master yet):", name)
            continue
        im = tall_room(src, size, start, ground)
        im.save(proc / f"{name}.png")
        save(OUT / f"{name}.webp", im, budget, report, note=f"from {src.name} {Image.open(src).size}", lo=55)
    TALL.welcome = dict(
        file=dict(width=1296, height=1620), footX=0.504, footY=0.857, ellipse=dict(cx=0.504, cy=0.853, w=0.771, h=0.092),
        mobiWidthShare=round(560 / 1080, 4), sheetLeft=0.6, lamp=dict(x=0.748, y=0.157), coneFootY=0.318,
        ground="#12110E", groundBlendFrom=0.93,
    )
    TALL.plan_seal = dict(
        file=dict(width=1296, height=1944), impressionX=0.494, impressionY=0.554, discShare=0.1055, teethShare=0.1345,
        sheet=dict(left=0.034, top=0.156, right=0.956, bottom=0.889), ground="#12110E", groundBlendFrom=0.95,
    )

    (masters / "build-report.json").write_text(json.dumps(dict(report=report, anchors=anchors), indent=1))
    check_anchors(anchors)
    write_shared_anchors()


# What the app and the website use (equal to SceneAnchor, SceneLifeSpec and MilestoneArtBand in
# lib/core/widgets/art and lib/features/rhythm/celebration; a Dart test keeps them equal). Measured
# above on the delivered files: Night within 0.01 of these, and every room built on the floor lamp
# shares one lit ellipse in Night and Day because each Day file is rendered from its Night file.
FLOOR_LAMP = dict(footX=0.514, footY=0.796)
DESK_LAMP = dict(footX=0.50, footY=0.776)
LIFE_FLOOR = dict(lampX=0.408, lampY=0.222, coneFootY=0.70, ellipseX=0.514, ellipseY=0.785, ellipseW=0.55,
                  stars=[[0.225, 0.07], [0.235, 0.21], [0.10, 0.21]])
LIFE_DESK = dict(lampX=0.393, lampY=0.356, coneFootY=0.70, ellipseX=0.50, ellipseY=0.766, ellipseW=0.484,
                 stars=[[0.19, 0.08], [0.215, 0.17], [0.09, 0.20]])
ROOMS = {"allClear": "floor", "offline": "desk", "nothingYet": "floor", "saved": "floor", "noResults": "floor", "unreachable": "floor"}


def check_anchors(measured):
    """The numbers above must agree with what was measured on the Night files (to 0.01)."""
    for key, kind in ROOMS.items():
        night = measured.get(key, {}).get("night")
        if not night:
            continue
        want = FLOOR_LAMP if kind == "floor" else DESK_LAMP
        for field in ("footX", "footY"):
            assert abs(night[field] - want[field]) < 0.01, f"{key} night {field}: measured {night[field]}, constant {want[field]}"
        life = LIFE_FLOOR if kind == "floor" else LIFE_DESK
        assert abs(night["lamp"]["x"] - life["lampX"]) < 0.015 and abs(night["lamp"]["y"] - life["lampY"]) < 0.015, f"{key} lamp {night['lamp']}"
    print("anchors agree with the measured Night files")


def write_shared_anchors():
    scenes = {}
    for key, kind in ROOMS.items():
        foot = FLOOR_LAMP if kind == "floor" else DESK_LAMP
        scenes[key] = dict(night=dict(foot), day=dict(foot), life=dict(LIFE_FLOOR if kind == "floor" else LIFE_DESK))
    doc = dict(
        version=1,
        note="Written by flutter_app/tool/build_scenes.py; read by lib/core/widgets/art/scene_art.dart (SceneAnchor), scene_life.dart (SceneLifeSpec) and the milestone band, and by the website's SceneImage and SceneLife. All numbers are fractions of the image unless the name ends in Dp. The same bytes live in both worktrees.",
        vignette=dict(
            file=dict(width=1536, height=1024),
            mobiShare=0.42,
            scenes=scenes,
            life=dict(breathSeconds=8, cycles=3, fadeEndsMs=1500, motes=9, glowRadiusOfWidth=0.2, poolAlphaNight=0.05, poolAlphaDay=0.04),
        ),
        milestone=dict(file=dict(width=1536, height=1024), mobiX=0.74, mobiFootY=0.92, mobiHeightDp=92, bleedDp=24),
    )
    TALL.update_doc(doc)
    SHARED.mkdir(exist_ok=True)
    (SHARED / "scene-anchors.json").write_text(json.dumps(doc, indent=2) + chr(10), encoding="utf-8")
    print("wrote", SHARED / "scene-anchors.json")


if __name__ == "__main__":
    main()
