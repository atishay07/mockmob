"""Builds the bundled Fold art and its manifest (assets/folds/folds.json) for the Mob v3 FoldPuppet.

The app loads every character image through this one manifest (Fold id, pose, file, figure box, eye
boxes, head file), so swapping the interim cut-outs for the final art is a re-run of this script and
no code change.

Usage (from flutter_app):
  python tool/fold_manifest.py interim   # characters/cut/C-*.webp, one still per Fold for every pose
  python tool/fold_manifest.py final     # characters/final/poses (idle, cheer, think, sad->shrug, wave)

Sources live in mockmob-next/tmp/design-1019pm/mob-v3/characters. Output: square WebP at 256 (den,
ruler, podium) and 512 (reveal, podium first, shelf detail), alpha q88, figure boots on the bottom
edge minus a margin; heads at 128 cropped around the visor. Budget check at the end (spec 5.7: the
whole bundle about 2.9 MB; this prints the total).
"""
import glob
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
OUT = os.path.join(APP, 'assets', 'folds')
SRC = os.path.normpath(os.path.join(APP, '..', '..', 'mockmob-next', 'tmp', 'design-1019pm', 'mob-v3', 'characters'))

FOLDS = ['dart', 'dogear', 'hexa', 'kandil', 'hop', 'crane', 'stamp', 'naav', 'tally', 'patang', 'sticky', 'cutting']
POSES = ['idle', 'cheer', 'think', 'shrug', 'wave']
# Paper colour per Fold (spec 0.4; the ones the table names by word take the art's own mid tone).
COLOUR = {
    'dart': '56B8F0', 'dogear': 'FF7A8A', 'hexa': '3FC6A8', 'kandil': 'F2A93B', 'hop': '2FB3A0', 'crane': 'B98CFF',
    'stamp': 'EADFC6', 'naav': '6E8BFF', 'tally': 'F3C9A8', 'patang': 'E8455A', 'sticky': '9BAF8E', 'cutting': 'E58E5A',
}
INTERIM = {k: f'C-{k}.webp' for k in FOLDS}
INTERIM['sticky'] = 'C-sticky2.webp'
INTERIM['hop'] = 'C-hop.webp'


def load(path):
    im = Image.open(path).convert('RGBA')
    a = np.asarray(im).astype(np.float32)
    return a[..., :3], a[..., 3] / 255.0, im


def square(im, margin=0.04):
    """Pads to a square canvas: the figure centred left to right, its boots on the bottom edge (minus a
    small margin), so every pose of every Fold shares one pivot (the boots)."""
    a = np.asarray(im)[..., 3]
    ys, xs = np.nonzero(a > 8)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    fig = im.crop((x0, y0, x1, y1))
    w, h = fig.size
    side = int(round(max(w, h) / (1 - 2 * margin)))
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    ox = (side - w) // 2
    oy = side - h - int(round(side * margin))
    canvas.paste(fig, (ox, oy), fig)
    box = [ox / side, oy / side, w / side, h / side]
    return canvas, box


def components(mask):
    m = Image.fromarray((mask * 255).astype(np.uint8))
    seen = np.zeros_like(mask, bool)
    out = []
    ys, xs = np.nonzero(mask)
    for y, x in zip(ys[::23], xs[::23]):
        if seen[y, x]:
            continue
        mm = m.copy()
        ImageDraw.floodfill(mm, (int(x), int(y)), 128, thresh=0)
        c = np.asarray(mm) == 128
        seen |= c
        yy, xx = np.nonzero(c)
        out.append((int(c.sum()), (int(xx.min()), int(yy.min()), int(xx.max()) + 1, int(yy.max()) + 1), c))
    return sorted(out, key=lambda t: -t[0])


def find_face(rgb, alpha):
    """The visor (the widest dark blob holding bright eyes) and the eyes inside it (post.py's method)."""
    lum = rgb.mean(axis=2)
    dark = (alpha > 0.95) & (lum < 40)
    dark = np.asarray(Image.fromarray((dark * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))) > 0
    best = None
    for cnt, (x0, y0, x1, y1), c in components(dark)[:8]:
        bw, bh = x1 - x0, y1 - y0
        if cnt < 300 or bh == 0:
            continue
        box = (slice(y0, y1), slice(x0, x1))
        bright = (lum[box] > 170) & (alpha[box] > 0.9)
        score = cnt * (1.5 if bw > bh * 1.1 else 0.6) * (2 if bright.sum() > 30 else 0.3)
        if best is None or score > best[0]:
            best = (score, (x0, y0, x1, y1), c)
    if best is None:
        return None
    x0, y0, x1, y1 = best[1]
    vis = best[2]
    sub = (lum[y0:y1, x0:x1] > 110) & (alpha[y0:y1, x0:x1] > 0.9)
    rows = vis[y0:y1, x0:x1]
    left = np.maximum.accumulate(rows, axis=1)
    right = np.maximum.accumulate(rows[:, ::-1], axis=1)[:, ::-1]
    sub &= left & right
    em = np.zeros_like(vis)
    em[y0:y1, x0:x1] = sub
    eyes = [e for e in components(em) if e[0] > 20][:3]
    if eyes:
        eyes = sorted([e for e in eyes if e[0] > 0.15 * eyes[0][0]], key=lambda e: e[1][0])
    col = np.median(rgb[vis & (alpha > 0.99)], axis=0) if (vis & (alpha > 0.99)).any() else np.array([20, 20, 22])
    return dict(visor=(x0, y0, x1, y1), eyes=[e[1] for e in eyes], visor_col=col)


def frac(b, side):
    return [round(b[0] / side, 4), round(b[1] / side, 4), round((b[2] - b[0]) / side, 4), round((b[3] - b[1]) / side, 4)]


def save(im, path, size, q=88):
    im.resize((size, size), Image.LANCZOS).save(path, 'WEBP', quality=q, method=6, alpha_quality=90)
    return os.path.getsize(path)


def head(canvas, face, path, size=128):
    x0, y0, x1, y1 = face['visor']
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    side = (x1 - x0) * 2.2
    a = np.asarray(canvas)[..., 3]
    ys, _ = np.nonzero(a > 80)
    top = max(ys.min(), cy - side * 0.62)
    cy = max(cy, top + side / 2 - 4)
    box = (int(round(cx - side / 2)), int(round(cy - side / 2)), int(round(cx + side / 2)), int(round(cy + side / 2)))
    crop = canvas.crop(box)
    crop.resize((size, size), Image.LANCZOS).save(path, 'WEBP', quality=90, method=6, alpha_quality=90)
    return os.path.getsize(path)


def build(mode):
    os.makedirs(OUT, exist_ok=True)
    for f in glob.glob(os.path.join(OUT, 'fold-*.webp')):
        os.remove(f)
    manifest = {'version': 1, 'source': mode, 'poses': POSES, 'folds': {}}
    total = 0
    for k in FOLDS:
        entry = {'colour': COLOUR[k], 'poses': {}}
        stills = {}
        if mode == 'interim':
            stills = {p: os.path.join(SRC, 'cut', INTERIM[k]) for p in POSES}
        else:
            for p in POSES:
                name = 'sad' if p == 'shrug' else p
                path = os.path.join(SRC, 'final', 'poses', f'fold-{k}-{name}@512.webp')
                stills[p] = path if os.path.exists(path) else os.path.join(SRC, 'final', 'poses', f'fold-{k}-idle@512.webp')
        written = {}
        for p, src in stills.items():
            if not os.path.exists(src):
                print('missing', k, p, src)
                continue
            if src in written:
                entry['poses'][p] = dict(entry['poses'][written[src]])
                continue
            _, _, im = load(src)
            canvas, box = square(im)
            side = canvas.size[0]
            rgb = np.asarray(canvas).astype(np.float32)[..., :3]
            alpha = np.asarray(canvas).astype(np.float32)[..., 3] / 255.0
            face = find_face(rgb, alpha)
            small = f'fold-{k}-{p}@256.webp'
            large = f'fold-{k}-{p}@512.webp'
            total += save(canvas, os.path.join(OUT, small), 256)
            if p in ('idle', 'cheer'):
                total += save(canvas, os.path.join(OUT, large), 512, q=90)
            rec = {'file': small, 'large': large if p in ('idle', 'cheer') else None, 'box': [round(v, 4) for v in box]}
            if face:
                rec['visor'] = frac(face['visor'], side)
                rec['eyes'] = [frac(e, side) for e in face['eyes']]
                rec['visorColour'] = '%02X%02X%02X' % tuple(int(v) for v in face['visor_col'])
                if p == 'idle':
                    hp = f'fold-{k}-head@128.webp'
                    total += head(canvas, face, os.path.join(OUT, hp))
                    entry['head'] = hp
            entry['poses'][p] = rec
            written[src] = p
        # Interim: one still serves every pose; the large still is the idle's.
        for p in POSES:
            if p in entry['poses'] and entry['poses'][p].get('large') is None:
                entry['poses'][p]['large'] = entry['poses']['idle'].get('large')
        manifest['folds'][k] = entry
    with open(os.path.join(OUT, 'folds.json'), 'w') as fh:
        json.dump(manifest, fh, indent=1)
    print(f'{len(glob.glob(os.path.join(OUT, "fold-*.webp")))} files, {total / 1024:.0f} KB')


if __name__ == '__main__':
    build(sys.argv[1] if len(sys.argv) > 1 else 'interim')
