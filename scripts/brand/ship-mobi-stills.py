"""Ship Mobi's 3D job poses: a cleaned cutout (alpha checked, specks dropped, defringed) becomes a 560 px tall webp in
public/brand/mascot/, and every job pose is written into manifest.json beside the seven first poses.

  python scripts/brand/ship-mobi-stills.py                      rewrite the manifest entries from the files that are there
  python scripts/brand/ship-mobi-stills.py camera=PATH/clean.png  also ship one cutout as mobi-<name>.webp first

The same steps as the 16 Nov 2026 stills (reading, magnifier, calendar, desk-hello): trim to the figure, a premultiplied
Lanczos resize to 544 px with an 8 px margin, then every partly transparent pixel takes the colour of the nearest opaque
one (so no light or dark rim shows on cream or on charcoal), colour bled into the transparent pixels so the lossy codec
cannot pull black into the edge, webp q90 with lossless alpha. No paid API: local Pillow, numpy and scipy only.
"""
import json
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'public', 'brand', 'mascot')
H, MARGIN = 560, 8
LUM = np.array([0.299, 0.587, 0.114], np.float32)
# manifest key -> file. The keys are the poses Mascot.jsx accepts; `wave` is the first cell of the six-cell wave.
STILLS = {
    'reading': 'mobi-reading.webp',
    'magnifier': 'mobi-magnifier.webp',
    'camera': 'mobi-camera.webp',
    'calendar': 'mobi-calendar.webp',
    'deskHello': 'mobi-desk-hello.webp',
    'wave': 'mobi-wave-still.webp',
}
WAVE_SHEET = ('waveSheet', 'mobi-wave-6.webp', 6)


def fringe(c):
    """Percent of the partly transparent edge pixels that are more than 40 luminance darker, or lighter, than the body."""
    a, rgb = c[..., 3], c[..., :3]
    op = a >= 250
    semi = (a > 16) & (a < 240)
    idx = ndi.distance_transform_edt(~op, return_distances=False, return_indices=True)
    d = (rgb @ LUM) - (rgb[idx[0], idx[1]] @ LUM)
    return [round(float((d[semi] < -40).mean() * 100), 2), round(float((d[semi] > 40).mean() * 100), 2)]


def ship(name, src):
    im = Image.open(src).convert('RGBA')
    a = np.asarray(im.getchannel('A'))
    ys, xs = np.nonzero(a > 8)
    im = im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    th = H - 2 * MARGIN
    tw = round(im.width * th / im.height)
    im = im.convert('RGBa').resize((tw, th), Image.LANCZOS).convert('RGBA')  # premultiplied resample
    canvas = Image.new('RGBA', (tw + 2 * MARGIN, H), (0, 0, 0, 0))
    canvas.paste(im, (MARGIN, MARGIN))
    c = np.asarray(canvas).astype(np.float32)
    al, rgb = c[..., 3], c[..., :3]
    al[al < 4] = 0
    op = al >= 250
    idx = ndi.distance_transform_edt(~op, return_distances=False, return_indices=True)
    fix = al < 250
    rgb[fix] = rgb[idx[0], idx[1]][fix]  # edge colour = nearest body colour, bled into the transparency
    arr = np.dstack([rgb, al]).clip(0, 255).astype(np.uint8)
    dst = os.path.join(OUT, f'mobi-{name}.webp')
    Image.fromarray(arr, 'RGBA').save(dst, 'WEBP', quality=90, alpha_quality=100, method=6, exact=True)
    e = np.asarray(Image.open(dst).convert('RGBA')).astype(np.float32)
    print(json.dumps({'shipped': dst, 'size': [e.shape[1], e.shape[0]], 'bytes': os.path.getsize(dst), 'fringe_dark_light_pct': fringe(e)}))


def entry(file):
    path = os.path.join(OUT, file)
    im = Image.open(path).convert('RGBA')
    a = np.asarray(im.getchannel('A'))
    return {'src': f'/brand/mascot/{file}', 'width': im.width, 'height': im.height, 'bytes': os.path.getsize(path), 'alphaMin': int(a.min()), 'alphaMax': int(a.max())}


for arg in sys.argv[1:]:
    name, src = arg.split('=', 1)
    ship(name, src)

manifest_path = os.path.join(OUT, 'manifest.json')
with open(manifest_path, encoding='utf8') as f:
    manifest = json.load(f)
for key, file in STILLS.items():
    manifest[key] = entry(file)
key, file, cells = WAVE_SHEET
sheet = entry(file)
manifest[key] = {**sheet, 'cells': cells, 'cellWidth': sheet['width'] // cells, 'cellHeight': sheet['height']}
with open(manifest_path, 'w', encoding='utf8', newline='\n') as f:
    f.write(json.dumps(manifest, indent=2) + '\n')
print(json.dumps({k: manifest[k] for k in [*STILLS, key]}, indent=1))
