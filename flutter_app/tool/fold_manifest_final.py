"""Drops the final Fold art (characters/final, FINAL-ART.md) into the app: assets/folds/ and its manifest.

Usage (from flutter_app):  python tool/fold_manifest_final.py

Reads final/folds.json (v2) and writes assets/folds/folds.json in the app's manifest shape (the one
fold_manifest.dart parses), so no code change is needed when more poses arrive: re-run this script.
- Every pose of one Fold shares the idle's figure box: the final canvas keeps one scale and the boot
  line (y 0.955) for all poses, so a pose cross-fade never jumps.
- A pose the generator has not made yet (shrug, wave) is simply not listed; the app falls back to the
  Fold's idle (FoldArt.still), never a broken image.
- The paper colour is final/folds.json `paper` (spec 0.4's colour column is out of date for Hexa, Naav,
  Cutting and Dog-ear).
- The parcel stills and the stamp seal go to assets/art/.
"""
import glob
import json
import os
import shutil

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
OUT = os.path.join(APP, 'assets', 'folds')
ART = os.path.join(APP, 'assets', 'art')
SRC = os.path.normpath(os.path.join(APP, '..', '..', 'mockmob-next', 'tmp', 'design-1019pm', 'mob-v3', 'characters', 'final'))
FOLDS = ['dart', 'dogear', 'hexa', 'kandil', 'hop', 'crane', 'stamp', 'naav', 'tally', 'patang', 'sticky', 'cutting']
POSES = ['idle', 'cheer', 'think', 'shrug', 'wave']


def visor_colour(path, visor):
    im = np.asarray(Image.open(path).convert('RGBA')).astype(np.float32)
    s = im.shape[0]
    x, y, w, h = visor
    sub = im[int(y * s):int((y + h) * s), int(x * s):int((x + w) * s)]
    rgb, a = sub[..., :3], sub[..., 3]
    dark = (a > 240) & (rgb.mean(axis=2) < 60)
    if dark.sum() < 10:
        return '16151A'
    med = np.median(rgb[dark], axis=0)
    return '%02X%02X%02X' % tuple(int(v) for v in med)


def r4(v):
    return [round(float(x), 4) for x in v]


def main():
    src = json.load(open(os.path.join(SRC, 'folds.json')))
    os.makedirs(OUT, exist_ok=True)
    for f in glob.glob(os.path.join(OUT, 'fold-*.webp')):
        os.remove(f)
    manifest = {'version': 2, 'source': 'final', 'poses': POSES, 'folds': {}}
    total = 0
    for k in FOLDS:
        v = src['folds'][k]
        idle_box = r4(v['poses']['idle']['bbox'])
        entry = {'colour': v['paper'].lstrip('#').upper(), 'widthClass': v.get('widthClass'), 'folds': v.get('folds'), 'poses': {}}
        for p in POSES:
            pv = v['poses'].get(p)
            if pv is None:
                continue
            small = pv['file256']
            shutil.copy(os.path.join(SRC, 'poses', small), os.path.join(OUT, small))
            total += os.path.getsize(os.path.join(OUT, small))
            large = pv.get('file512')
            if large:
                shutil.copy(os.path.join(SRC, 'poses', large), os.path.join(OUT, large))
                total += os.path.getsize(os.path.join(OUT, large))
            rec = {
                'file': small,
                # The idle's large still stands in for a pose without its own (think).
                'large': large or v['poses']['idle'].get('file512'),
                'box': idle_box,
                'bbox': r4(pv['bbox']),
                'bootPivot': r4(pv['bootPivot']),
                'visor': r4(pv['visor']),
                'eyes': [r4(e) for e in pv['eyes']],
                'visorColour': visor_colour(os.path.join(SRC, 'poses', small), pv['visor']),
            }
            entry['poses'][p] = rec
        head = v['head']
        shutil.copy(os.path.join(SRC, 'heads', head), os.path.join(OUT, head))
        total += os.path.getsize(os.path.join(OUT, head))
        entry['head'] = head
        manifest['folds'][k] = entry
    with open(os.path.join(OUT, 'folds.json'), 'w', newline='\n') as fh:
        json.dump(manifest, fh, indent=1)
        fh.write('\n')
    for name in ['parcel-sealed', 'parcel-pop', 'parcel-open', 'stamp-seal']:
        shutil.copy(os.path.join(SRC, 'objects', f'{name}.webp'), os.path.join(ART, f'{name}.webp'))
        total += os.path.getsize(os.path.join(ART, f'{name}.webp'))
    print(f'{len(glob.glob(os.path.join(OUT, "fold-*.webp")))} Fold files, {total / 1024:.0f} KB with the objects')


if __name__ == '__main__':
    main()
