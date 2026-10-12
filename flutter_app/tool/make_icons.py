"""Generates the Android launcher icons, the splash mark and the notification icon from the mark's
geometry (keep in step with MarkGeometry in lib/core/widgets/brand/mark.dart).

Usage (from flutter_app):  python tool/make_icons.py

The mark: a dark tile (#101210) with a 2 by 2 grid of answer bubbles, the top-left one inked
volt and the others hollow hairline rings, and a volt edge light along the top.

Writes, under android/app/src/main/res:
  mipmap-*/ic_launcher.png, ic_launcher_round.png     legacy icons (rounded tile, circle)
  mipmap-*/ic_launcher_foreground.png                 adaptive foreground (bubbles and edge)
  mipmap-*/ic_launcher_monochrome.png                 themed icon (outlines, filled bubble solid)
  mipmap-anydpi-v26/ic_launcher.xml, _round.xml       adaptive icon on the #101210 background
  drawable/splash_mark.xml                            the Android 12 splash icon (vector)
  drawable/ic_stat_mockmob.xml                        notification silhouette (vector)
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
RES = ROOT / "android" / "app" / "src" / "main" / "res"

TILE = (0x10, 0x12, 0x10, 255)
VOLT = (0xD2, 0xF0, 0x00, 255)
RING = (0x6A, 0x64, 0x5A, 255)
TILE_RADIUS = 0.25
BUBBLE_R = 0.112
RING_STROKE = 0.026
CENTRES = [(0.355, 0.355), (0.645, 0.355), (0.355, 0.645), (0.645, 0.645)]
INKED = 0

DENSITIES = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}
SS = 4  # supersampling


def draw_bubbles(d: ImageDraw.ImageDraw, ox: float, oy: float, s: float, mono: bool = False) -> None:
    r = BUBBLE_R * s
    for i, (fx, fy) in enumerate(CENTRES):
        cx, cy = ox + fx * s, oy + fy * s
        box = (cx - r, cy - r, cx + r, cy + r)
        if i == INKED:
            d.ellipse(box, fill=(255, 255, 255, 255) if mono else VOLT)
        else:
            d.ellipse(box, outline=(255, 255, 255, 255) if mono else RING, width=max(1, round(RING_STROKE * s)))


def draw_edge(img: Image.Image, x0: float, x1: float, y: float, width: float) -> None:
    """The volt edge light: brightest in the middle, fading at both ends."""
    line = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(line)
    steps = 64
    for k in range(steps):
        t0, t1 = k / steps, (k + 1) / steps
        a = int(255 * (1 - abs((t0 + t1) - 1)) ** 0.6)
        d.line((x0 + (x1 - x0) * t0, y, x0 + (x1 - x0) * t1, y), fill=(VOLT[0], VOLT[1], VOLT[2], a), width=max(1, round(width)))
    img.alpha_composite(line)


def legacy(px: int, round_shape: bool) -> Image.Image:
    size = px * SS
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pad = size * 0.06
    s = size - 2 * pad
    if round_shape:
        d.ellipse((pad, pad, pad + s, pad + s), fill=TILE)
    else:
        d.rounded_rectangle((pad, pad, pad + s, pad + s), radius=s * TILE_RADIUS, fill=TILE)
    inner = s * (0.82 if round_shape else 1.0)
    off = pad + (s - inner) / 2
    draw_bubbles(d, off, off, inner)
    draw_edge(img, pad + s * 0.3, pad + s * 0.7, pad + s * (0.07 if round_shape else 0.02) + SS, s * 0.016)
    return img.resize((px, px), Image.LANCZOS)


def adaptive(px: int, mono: bool) -> Image.Image:
    """108 dp layer; the visible tile is the central 72 dp."""
    size = px * SS
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    s = size * 72 / 108
    o = (size - s) / 2
    # Bubbles slightly smaller than the tile so round and squircle masks both leave air.
    inner = s * 0.96
    io = o + (s - inner) / 2
    draw_bubbles(d, io, io, inner, mono=mono)
    if not mono:
        draw_edge(img, size * 0.38, size * 0.62, o + size * 0.035, size * 0.012)
    return img.resize((px, px), Image.LANCZOS)


def vector_mark(tile_px: float, offset: float, viewport: int) -> str:
    """The mark as an Android vector drawable (tile, edge light, bubbles)."""
    def circle(cx, cy, r):
        return f"M{cx - r:.3f},{cy:.3f} a{r:.3f},{r:.3f} 0 1,0 {2 * r:.3f},0 a{r:.3f},{r:.3f} 0 1,0 {-2 * r:.3f},0 Z"

    s, o = tile_px, offset
    rad = s * TILE_RADIUS
    tile = (f"M{o + rad:.3f},{o:.3f} H{o + s - rad:.3f} A{rad:.3f},{rad:.3f} 0 0,1 {o + s:.3f},{o + rad:.3f} "
            f"V{o + s - rad:.3f} A{rad:.3f},{rad:.3f} 0 0,1 {o + s - rad:.3f},{o + s:.3f} H{o + rad:.3f} "
            f"A{rad:.3f},{rad:.3f} 0 0,1 {o:.3f},{o + s - rad:.3f} V{o + rad:.3f} A{rad:.3f},{rad:.3f} 0 0,1 {o + rad:.3f},{o:.3f} Z")
    r = BUBBLE_R * s
    stroke = RING_STROKE * s
    paths = [f'    <path android:fillColor="#101210" android:pathData="{tile}"/>']
    paths.append(
        f'    <path android:strokeColor="#D2F000" android:strokeWidth="{max(0.8, s * 0.016):.3f}" android:strokeLineCap="round" '
        f'android:strokeAlpha="0.9" android:pathData="M{o + s * 0.3:.3f},{o + s * 0.025:.3f} H{o + s * 0.7:.3f}"/>'
    )
    for i, (fx, fy) in enumerate(CENTRES):
        cx, cy = o + fx * s, o + fy * s
        if i == INKED:
            paths.append(f'    <path android:fillColor="#D2F000" android:pathData="{circle(cx, cy, r)}"/>')
        else:
            paths.append(
                f'    <path android:strokeColor="#6A645A" android:strokeWidth="{stroke:.3f}" '
                f'android:pathData="{circle(cx, cy, r - stroke / 2)}"/>'
            )
    body = "\n".join(paths)
    return (
        '<?xml version="1.0" encoding="utf-8"?>\n'
        "<!-- Generated by tool/make_icons.py from the mark's geometry. -->\n"
        '<vector xmlns:android="http://schemas.android.com/apk/res/android"\n'
        f'    android:width="{viewport}dp" android:height="{viewport}dp"\n'
        f'    android:viewportWidth="{viewport}" android:viewportHeight="{viewport}">\n{body}\n</vector>\n'
    )


def notification_icon() -> str:
    def circle(cx, cy, r):
        return f"M{cx - r:.3f},{cy:.3f} a{r:.3f},{r:.3f} 0 1,0 {2 * r:.3f},0 a{r:.3f},{r:.3f} 0 1,0 {-2 * r:.3f},0 Z"

    s, o = 22.0, 1.0
    r = 0.15 * s
    paths = []
    for i, (fx, fy) in enumerate([(0.27, 0.27), (0.73, 0.27), (0.27, 0.73), (0.73, 0.73)]):
        cx, cy = o + fx * s, o + fy * s
        if i == INKED:
            paths.append(f'    <path android:fillColor="#FFFFFFFF" android:pathData="{circle(cx, cy, r)}"/>')
        else:
            paths.append(f'    <path android:strokeColor="#FFFFFFFF" android:strokeWidth="1.6" android:pathData="{circle(cx, cy, r - 0.8)}"/>')
    body = "\n".join(paths)
    return (
        '<?xml version="1.0" encoding="utf-8"?>\n'
        "<!-- Notification small icon: the mark's bubbles as a white silhouette (Android tints it).\n"
        "     Generated by tool/make_icons.py. -->\n"
        '<vector xmlns:android="http://schemas.android.com/apk/res/android"\n'
        '    android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24">\n'
        f"{body}\n</vector>\n"
    )


ADAPTIVE = """<?xml version="1.0" encoding="utf-8"?>
<!-- Generated by tool/make_icons.py: the mark's dark tile is the background, the bubbles and the
     volt edge are the foreground, and the themed icon uses outlines with the inked bubble solid. -->
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
    <monochrome android:drawable="@mipmap/ic_launcher_monochrome" />
</adaptive-icon>
"""


def main() -> None:
    for name, scale in DENSITIES.items():
        folder = RES / f"mipmap-{name}"
        folder.mkdir(parents=True, exist_ok=True)
        legacy(round(48 * scale), False).save(folder / "ic_launcher.png")
        legacy(round(48 * scale), True).save(folder / "ic_launcher_round.png")
        adaptive(round(108 * scale), False).save(folder / "ic_launcher_foreground.png")
        adaptive(round(108 * scale), True).save(folder / "ic_launcher_monochrome.png")
    anydpi = RES / "mipmap-anydpi-v26"
    anydpi.mkdir(parents=True, exist_ok=True)
    (anydpi / "ic_launcher.xml").write_text(ADAPTIVE, encoding="utf-8")
    (anydpi / "ic_launcher_round.xml").write_text(ADAPTIVE, encoding="utf-8")
    # Splash icon: the tile fits inside the circle Android 12 masks the splash icon to.
    (RES / "drawable" / "splash_mark.xml").write_text(vector_mark(46, 31, 108), encoding="utf-8")
    (RES / "drawable" / "ic_stat_mockmob.xml").write_text(notification_icon(), encoding="utf-8")
    print("icons written")


if __name__ == "__main__":
    main()
