"""Generates the Android launcher icons, the splash "mo", the notification icon and the Play
store icon from the final logo's production SVGs (logo B, "Closing Mobi"; built by
tmp/logo/final-B/build_final.py, which also writes lib/core/widgets/brand/logo_geometry.g.dart).

Usage (from flutter_app):  python tool/make_icons.py [--svg DIR] [--play DIR] [--preview FILE]

No browser or native library is needed: the SVG subset those files use (rect, circle, path with
absolute M L H V Q C Z, fill-rule) is rasterised here with 4x supersampling.

Writes, under android/app/src/main/res:
  mipmap-*/ic_launcher_foreground.png    adaptive foreground: "mo", small master, inside the
                                         66 dp safe circle (android-adaptive-foreground-small.svg)
  mipmap-*/ic_launcher_monochrome.png    themed icon (Android 13): one ink, visor knocked out
                                         (android-adaptive-monochrome-small.svg)
  mipmap-*/ic_launcher.png               legacy icon: the rounded charcoal tile (icon-rounded-small.svg)
  mipmap-*/ic_launcher_round.png         legacy round icon (icon-circle-small.svg)
  mipmap-anydpi-v26/ic_launcher.xml, _round.xml   adaptive icon on @color/ic_launcher_background
  drawable/splash_mo.xml                 the system splash icon (Android 12+) and the pre-12 launch
                                         background: "mo", full master (ring eye, flap cut), as a
                                         vector converted from android-adaptive-foreground-full.svg.
                                         Flutter's first frame draws the same "mo" at the same
                                         place (OpeningTimeline.splashIconDp, keep SPLASH_ICON_DP
                                         in step).
  drawable/ic_stat_mockmob.xml           notification silhouette: "mo", micro master, one ink
and the 512 px Play store icon (icon-square-full.svg) to --play.
"""
import argparse
import math
import re
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RES = ROOT / "android" / "app" / "src" / "main" / "res"
LOGO = ROOT.parent / "tmp" / "logo" / "final-B"

DENSITIES = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}
SS = 4  # supersampling per axis
# The 108-unit splash drawable is drawn this many dp square by the Android 12+ splash (an icon
# with no icon background: 288 dp, content inside the central 192 dp circle).
SPLASH_ICON_DP = 288
# Legacy icons sit in a 48 dp square with 2 dp of air.
LEGACY_INSET = 2 / 48


# ---------------------------------------------------------------- SVG reading --------------------
def _attrs(tag: str) -> dict:
    return dict(re.findall(r'([\w:-]+)="([^"]*)"', tag))


def read_svg(path: Path):
    """Returns (viewBox (x, y, w, h), [shape]) with shape = dict(kind, fill, rule, d / geometry)."""
    src = path.read_text(encoding="utf-8")
    root = _attrs(re.search(r"<svg\b[^>]*>", src).group(0))
    vb = tuple(float(v) for v in root["viewBox"].split())
    shapes = []
    for m in re.finditer(r"<(rect|circle|path)\b[^>]*>", src):
        a = _attrs(m.group(0))
        kind = m.group(1)
        if "transform" in a:
            raise ValueError(f"{path.name}: transforms are not supported")
        shape = dict(kind=kind, id=a.get("id", ""), fill=a.get("fill", "#000000"), rule=a.get("fill-rule", "nonzero"))
        if kind == "path":
            shape["d"] = a["d"]
        elif kind == "rect":
            shape.update(x=float(a.get("x", 0)), y=float(a.get("y", 0)), w=float(a["width"]), h=float(a["height"]), rx=float(a.get("rx", 0)))
        else:
            shape.update(cx=float(a["cx"]), cy=float(a["cy"]), r=float(a["r"]))
        shapes.append(shape)
    return vb, shapes


_TOKEN = re.compile(r"[MLHVQCZmlhvqcz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?")


def path_commands(d: str):
    """Absolute M L H V Q C Z commands as (cmd, [numbers]); H and V become L."""
    toks = _TOKEN.findall(d)
    out, i, cmd, cx, cy = [], 0, "", 0.0, 0.0
    arity = {"M": 2, "L": 2, "H": 1, "V": 1, "Q": 4, "C": 6, "Z": 0}
    while i < len(toks):
        t = toks[i]
        if t.isalpha():
            if t.islower():
                raise ValueError("relative path commands are not supported")
            cmd = t
            i += 1
            if cmd == "Z":
                out.append(("Z", []))
                continue
        n = arity[cmd]
        nums = [float(v) for v in toks[i:i + n]]
        i += n
        if cmd == "H":
            cmd_out, nums = "L", [nums[0], cy]
        elif cmd == "V":
            cmd_out, nums = "L", [cx, nums[0]]
        else:
            cmd_out = cmd
        out.append((cmd_out, nums))
        cx, cy = nums[-2], nums[-1]
        if cmd == "M":
            cmd = "L"  # implicit lineto
    return out


def flatten(cmds, steps=24):
    """Contours (lists of points) from path commands."""
    contours, cur, px, py = [], [], 0.0, 0.0
    for c, n in cmds:
        if c == "M":
            if len(cur) > 2:
                contours.append(cur)
            cur = [(n[0], n[1])]
            px, py = n
        elif c == "L":
            cur.append((n[0], n[1]))
            px, py = n
        elif c == "Q":
            x1, y1, x, y = n
            for k in range(1, steps + 1):
                t = k / steps
                u = 1 - t
                cur.append((u * u * px + 2 * u * t * x1 + t * t * x, u * u * py + 2 * u * t * y1 + t * t * y))
            px, py = x, y
        elif c == "C":
            x1, y1, x2, y2, x, y = n
            for k in range(1, steps + 1):
                t = k / steps
                u = 1 - t
                cur.append((u**3 * px + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t**3 * x,
                            u**3 * py + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t**3 * y))
            px, py = x, y
        elif c == "Z":
            if len(cur) > 2:
                contours.append(cur)
            if cur:
                px, py = cur[0]
            cur = []
    if len(cur) > 2:
        contours.append(cur)
    return contours


def shape_contours(s):
    if s["kind"] == "path":
        return flatten(path_commands(s["d"]))
    if s["kind"] == "circle":
        n = 256
        return [[(s["cx"] + s["r"] * math.cos(2 * math.pi * k / n), s["cy"] + s["r"] * math.sin(2 * math.pi * k / n)) for k in range(n)]]
    x, y, w, h, r = s["x"], s["y"], s["w"], s["h"], min(s["rx"], s["w"] / 2, s["h"] / 2)
    if r <= 0:
        return [[(x, y), (x + w, y), (x + w, y + h), (x, y + h)]]
    pts = []
    for cx, cy, a0 in ((x + w - r, y + r, -90), (x + w - r, y + h - r, 0), (x + r, y + h - r, 90), (x + r, y + r, 180)):
        for k in range(17):
            a = math.radians(a0 + 90 * k / 16)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return [pts]


# ---------------------------------------------------------------- rasteriser ---------------------
def coverage(contours, width, height, rule):
    """Supersampled coverage (0 to 1) of the filled contours, already in output pixels."""
    W, H = width * SS, height * SS
    edges = []
    for c in contours:
        for i in range(len(c)):
            (x0, y0), (x1, y1) = c[i], c[(i + 1) % len(c)]
            if y0 != y1:
                edges.append((x0 * SS, y0 * SS, x1 * SS, y1 * SS))
    mask = np.zeros((H, W), dtype=bool)
    if not edges:
        return np.zeros((height, width))
    e = np.array(edges)
    x0, y0, x1, y1 = e.T
    ymin, ymax = np.minimum(y0, y1), np.maximum(y0, y1)
    direction = np.where(y1 > y0, 1, -1)
    for r in range(max(0, int(ymin.min())), min(H, int(math.ceil(ymax.max())) + 1)):
        yc = r + 0.5
        sel = (ymin <= yc) & (ymax > yc)
        if not sel.any():
            continue
        t = (yc - y0[sel]) / (y1[sel] - y0[sel])
        xs = x0[sel] + t * (x1[sel] - x0[sel])
        order = np.argsort(xs, kind="stable")
        xs = xs[order]
        if rule == "evenodd":
            inside = (np.arange(1, len(xs) + 1) % 2) == 1
        else:
            inside = np.cumsum(direction[sel][order]) != 0
        for k in range(len(xs) - 1):
            if inside[k]:
                a, b = int(math.ceil(xs[k] - 0.5)), int(math.ceil(xs[k + 1] - 0.5))
                if b > a:
                    mask[r, max(a, 0):min(b, W)] = True
    return mask.reshape(height, SS, width, SS).mean(axis=(1, 3))


def _rgb(hex_colour: str):
    h = hex_colour.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def render(svg: Path, px: int, inset: float = 0.0, colour=None, skip=()) -> Image.Image:
    """The SVG at px by px (square viewBox), [inset] (fraction) of air on every side; [colour]
    replaces every fill (monochrome); shapes whose id is in [skip] are left out."""
    (vx, vy, vw, vh), shapes = read_svg(svg)
    s = px * (1 - 2 * inset) / max(vw, vh)
    ox = px * inset - vx * s + (px * (1 - 2 * inset) - vw * s) / 2
    oy = px * inset - vy * s + (px * (1 - 2 * inset) - vh * s) / 2
    out = np.zeros((px, px, 4))  # premultiplied RGBA
    for sh in shapes:
        if sh["id"] in skip:
            continue
        contours = [[(ox + x * s, oy + y * s) for x, y in c] for c in shape_contours(sh)]
        a = coverage(contours, px, px, sh["rule"])[..., None]
        r, g, b = _rgb(colour or sh["fill"])
        out = out * (1 - a) + np.concatenate([a * r, a * g, a * b, a], axis=2)
    alpha = out[..., 3:4]
    rgb = np.where(alpha > 0, out[..., :3] / np.maximum(alpha, 1e-9), 0)
    return Image.fromarray(np.round(np.concatenate([rgb, alpha], axis=2) * 255).astype(np.uint8), "RGBA")


# ---------------------------------------------------------------- vector drawables ---------------
def _fmt(v: float) -> str:
    return f"{v:.3f}".rstrip("0").rstrip(".")


def transform_d(d: str, s: float, tx: float, ty: float) -> str:
    parts = []
    for c, n in path_commands(d):
        pts = [_fmt(v * s + (tx if k % 2 == 0 else ty)) for k, v in enumerate(n)]
        parts.append(c + " ".join(pts))
    return "".join(parts)


def vector_drawable(shapes, viewport: float, size_dp: float, comment: str, s=1.0, tx=0.0, ty=0.0, colour=None) -> str:
    lines = []
    for sh in shapes:
        if sh["kind"] != "path":
            continue
        fill = colour or sh["fill"].upper()
        rule = ' android:fillType="evenOdd"' if sh["rule"] == "evenodd" else ""
        lines.append(f'    <path android:fillColor="{fill}"{rule}\n        android:pathData="{transform_d(sh["d"], s, tx, ty)}"/>')
    body = "\n".join(lines)
    return (
        '<?xml version="1.0" encoding="utf-8"?>\n'
        f"<!-- {comment}\n     Generated by tool/make_icons.py; do not edit by hand. -->\n"
        '<vector xmlns:android="http://schemas.android.com/apk/res/android"\n'
        f'    android:width="{_fmt(size_dp)}dp" android:height="{_fmt(size_dp)}dp"\n'
        f'    android:viewportWidth="{_fmt(viewport)}" android:viewportHeight="{_fmt(viewport)}">\n{body}\n</vector>\n'
    )


def notification_icon(svg: Path) -> str:
    """The micro "mo" (letters, and Mobi with the visor knocked out) fitted 22 dp wide in 24 dp."""
    _, shapes = read_svg(svg)
    shapes = [s for s in shapes if s["kind"] == "path"]
    pts = [p for s in shapes for c in shape_contours(s) for p in c]
    x0, x1 = min(p[0] for p in pts), max(p[0] for p in pts)
    y0, y1 = min(p[1] for p in pts), max(p[1] for p in pts)
    s = 22 / (x1 - x0)
    tx = 12 - (x0 + x1) / 2 * s
    ty = 12 - (y0 + y1) / 2 * s
    return vector_drawable(shapes, 24, 24, 'Notification small icon: "mo", micro master, white (Android tints it).', s, tx, ty, colour="#FFFFFFFF")


ADAPTIVE = """<?xml version="1.0" encoding="utf-8"?>
<!-- Generated by tool/make_icons.py: "mo" (logo B) on the warm charcoal; the themed icon
     (Android 13) uses the one-ink layer with Mobi's visor knocked out. -->
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
    <monochrome android:drawable="@mipmap/ic_launcher_monochrome" />
</adaptive-icon>
"""


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--svg", type=Path, default=LOGO / "svg")
    ap.add_argument("--play", type=Path, default=LOGO / "play")
    ap.add_argument("--preview", type=Path, default=None, help="also write a contact sheet of every output")
    args = ap.parse_args()
    svg = args.svg
    previews = []

    for name, scale in DENSITIES.items():
        folder = RES / f"mipmap-{name}"
        folder.mkdir(parents=True, exist_ok=True)
        fg = render(svg / "android-adaptive-foreground-small.svg", round(108 * scale))
        mono = render(svg / "android-adaptive-monochrome-small.svg", round(108 * scale), colour="#FFFFFF")
        legacy = render(svg / "icon-rounded-small.svg", round(48 * scale), inset=LEGACY_INSET)
        legacy_round = render(svg / "icon-circle-small.svg", round(48 * scale), inset=LEGACY_INSET)
        fg.save(folder / "ic_launcher_foreground.png")
        mono.save(folder / "ic_launcher_monochrome.png")
        legacy.save(folder / "ic_launcher.png")
        legacy_round.save(folder / "ic_launcher_round.png")
        previews += [(f"{name} fg", fg), (f"{name} mono", mono), (f"{name} legacy", legacy), (f"{name} round", legacy_round)]

    anydpi = RES / "mipmap-anydpi-v26"
    anydpi.mkdir(parents=True, exist_ok=True)
    (anydpi / "ic_launcher.xml").write_text(ADAPTIVE, encoding="utf-8")
    (anydpi / "ic_launcher_round.xml").write_text(ADAPTIVE, encoding="utf-8")

    _, splash_shapes = read_svg(svg / "android-adaptive-foreground-full.svg")
    (RES / "drawable" / "splash_mo.xml").write_text(
        vector_drawable(
            splash_shapes, 108, 108,
            'The system splash icon (Android 12+) and the pre-12 launch background: "mo", full master,\n'
            "     from tmp/logo/final-B/svg/android-adaptive-foreground-full.svg (108 dp layer; Android 12+\n"
            f"     draws it {SPLASH_ICON_DP} dp square, and launch_background.xml does the same before 12).",
        ),
        encoding="utf-8",
    )
    (RES / "drawable" / "ic_stat_mockmob.xml").write_text(notification_icon(svg / "icon-rounded-mono-micro.svg"), encoding="utf-8")

    args.play.mkdir(parents=True, exist_ok=True)
    play = render(svg / "icon-square-full.svg", 512)
    play.save(args.play / "ic_play_512.png")
    previews.append(("play 512", play))

    if args.preview:
        cell = 220
        sheet = Image.new("RGBA", (cell * 4, cell * ((len(previews) + 3) // 4)), (60, 58, 54, 255))
        for k, (_, im) in enumerate(previews):
            t = im.copy()
            t.thumbnail((cell - 20, cell - 20), Image.NEAREST if im.width < cell else Image.LANCZOS)
            sheet.alpha_composite(t, ((k % 4) * cell + 10, (k // 4) * cell + 10))
        sheet.save(args.preview)
    print("icons written")


if __name__ == "__main__":
    main()
