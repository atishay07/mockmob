// The painted scenes on the website keep the app's numbers and files.
// Run: node --test src/components/scenes/sceneModel.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  EMPTY_SCENES, STATE_SCENES, allSceneFiles, lifeLayers, sceneArt, sceneForState, sceneSrcSet, vignetteLayout,
} from './sceneModel.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const ANCHORS_FILE = path.join(ROOT, 'data', 'scene-anchors.json');
const anchors = JSON.parse(readFileSync(ANCHORS_FILE, 'utf8'));
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

// Intrinsic size from the file's own header: WebP (VP8X, VP8 or VP8L) or AVIF (the ispe box).
function imageSize(buf) {
  if (buf.toString('ascii', 0, 4) === 'RIFF') {
    const chunk = buf.toString('ascii', 12, 16);
    if (chunk === 'VP8X') return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
    if (chunk === 'VP8L') {
      const b = buf.readUInt32LE(21);
      return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
    }
    if (chunk === 'VP8 ') return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    throw new Error(`unknown WebP chunk ${chunk}`);
  }
  assert.equal(buf.toString('ascii', 4, 8), 'ftyp');
  assert.match(buf.toString('ascii', 8, 12), /avif|avis/);
  const at = buf.indexOf('ispe', 0, 'ascii');
  assert.ok(at > 0, 'AVIF has an ispe box');
  return { width: buf.readUInt32BE(at + 8), height: buf.readUInt32BE(at + 12) };
}

test('the anchors are the app file, byte for byte, when the app worktree is beside this one', (t) => {
  const app = path.join(ROOT, '..', 'wt-phase2', 'shared', 'scene-anchors.json');
  if (!existsSync(app)) { t.skip('the app worktree is not here'); return; }
  assert.ok(readFileSync(app).equals(readFileSync(ANCHORS_FILE)), 'copy wt-phase2/shared/scene-anchors.json again');
});

test('the anchors hold the numbers the app draws with', () => {
  const v = anchors.vignette;
  assert.deepEqual(v.file, { width: 1536, height: 1024 });
  assert.equal(v.mobiShare, 0.42);
  assert.deepEqual(Object.keys(v.scenes).sort(), [...STATE_SCENES].sort());
  for (const key of STATE_SCENES) {
    const room = v.scenes[key];
    const want = key === 'offline' ? { footX: 0.5, footY: 0.776 } : { footX: 0.514, footY: 0.796 };
    assert.deepEqual(room.night, want, `${key} night`);
    assert.deepEqual(room.day, want, `${key} day`);
    assert.equal(room.life.stars.length, 3);
  }
  assert.deepEqual(v.life, { breathSeconds: 8, cycles: 3, fadeEndsMs: 1500, motes: 9, glowRadiusOfWidth: 0.2, poolAlphaNight: 0.05, poolAlphaDay: 0.04 });
  assert.deepEqual([anchors.milestone.mobiX, anchors.milestone.mobiFootY, anchors.milestone.mobiHeightDp, anchors.milestone.bleedDp], [0.74, 0.92, 92, 24]);
  assert.deepEqual(anchors.welcome.file, { width: 1296, height: 1620 });
  assert.deepEqual(anchors.planSeal.file, { width: 1296, height: 1944 });
});

test('every scene file exists at every width and format, at its true size', () => {
  const files = allSceneFiles();
  // 6 rooms and the band, Night and Day, at 3 widths; 2 tall rooms at 2 widths; AVIF and WebP each.
  assert.equal(files.length, (7 * 2 * 3 + 2 * 2) * 2);
  for (const file of files) {
    const disk = path.join(ROOT, 'public', file.src);
    assert.ok(existsSync(disk), `${file.src} is missing (run src/components/scenes/tools/build-scene-files.mjs)`);
    const size = imageSize(readFileSync(disk));
    assert.equal(size.width, file.width, file.src);
    assert.equal(size.height, Math.round((file.width * file.art.height) / file.art.width), file.src);
  }
});

test('names, versions and srcsets', () => {
  assert.equal(sceneArt('noResults', { night: false }).base, 'scene-empty-noresults-day');
  assert.equal(sceneArt('nothingYet').base, 'scene-empty-nothing-night');
  assert.equal(sceneArt('milestone', { night: false }).base, 'scene-milestone-check-day');
  assert.equal(sceneArt('welcome', { night: false }).base, 'scene-welcome-hero-night');
  assert.equal(sceneArt('nope'), null);
  assert.equal(
    sceneSrcSet(sceneArt('saved'), 'avif'),
    '/art/scenes/scene-empty-saved-night-768.v2.avif 768w, /art/scenes/scene-empty-saved-night-1280.v2.avif 1280w, /art/scenes/scene-empty-saved-night-1536.v2.avif 1536w',
  );
  assert.deepEqual(sceneArt('planSeal').widths, [1080, 1296]);
});

test('which room a state shows follows the app', () => {
  assert.equal(sceneForState('offline'), 'offline');
  assert.equal(sceneForState('error'), null, 'an error shows a room only when the caller asks');
  assert.equal(sceneForState('error', 'unreachable'), 'unreachable');
  assert.equal(sceneForState('error', true), 'unreachable');
  assert.equal(sceneForState('error', 'unreachable', { online: false }), 'offline');
  for (const scene of EMPTY_SCENES) assert.equal(sceneForState('empty', scene), scene);
  assert.equal(sceneForState('empty', 'offline'), null);
  assert.equal(sceneForState('empty', 'unreachable'), null);
  assert.equal(sceneForState('empty', undefined), null);
});

test('Mobi stands where the app puts him', () => {
  const room = vignetteLayout(anchors, 'saved');
  assert.ok(near(room.aspect, 2 / 3));
  assert.ok(near(room.mobi.height, 0.42));
  // His box is 1.6 times his height wide: 1.6 x 0.42 x 2/3 of the width.
  assert.ok(near(room.mobi.width, 0.448));
  assert.ok(near(room.mobi.left + room.mobi.width / 2, 0.514));
  assert.ok(near(room.mobi.top + room.mobi.height, 0.796));
  assert.ok(near(room.mobiOfWidth, 0.28));
  const desk = vignetteLayout(anchors, 'offline', { night: false });
  assert.ok(near(desk.mobi.left + desk.mobi.width / 2, 0.5));
  assert.ok(near(desk.mobi.top + desk.mobi.height, 0.776));
  assert.equal(vignetteLayout(anchors, 'nope'), null);
});

test('the room breathes with the app painter numbers', () => {
  const night = lifeLayers(anchors, 'allClear', { night: true });
  assert.deepEqual(night.timing, { breathSeconds: 8, cycles: 3, fadeEndsMs: 1500 });
  assert.equal(night.pool.alpha, 0.05);
  assert.deepEqual([night.glow.x, night.glow.y, night.glow.radius, night.glow.alphaLow, night.glow.alphaHigh], [0.408, 0.222, 0.2, 0.06, 0.13]);
  assert.equal(night.motes.length, 9);
  night.motes.forEach((mote, i) => {
    assert.ok(near(mote.phase, i / 9));
    assert.ok(near(mote.y0, 0.7) && near(mote.y1, 0.262), 'from the cone foot up to just under the shade');
    const r = ((i * 37) % 17) / 16;
    assert.ok(near(mote.x0, 0.408 + (r * 2 - 1) * 0.8 * 0.13));
    assert.ok(near(mote.x1, 0.408 + (r * 2 - 1) * 0.8 * 0.02));
    assert.ok(mote.alpha >= 0.22 && mote.alpha <= 0.62 + 1e-9);
  });
  assert.deepEqual(night.stars.map((s) => s.phase), [0, 0.31, 0.62]);
  assert.equal(night.stars[0].periodSeconds, 4);
  const day = lifeLayers(anchors, 'allClear', { night: false });
  assert.equal(day.pool.alpha, 0.04);
  assert.equal(day.glow, null, 'by day only the pool breathes');
  assert.deepEqual(day.motes, []);
  assert.deepEqual(day.stars, []);
  const desk = lifeLayers(anchors, 'offline', { night: true });
  assert.deepEqual([desk.glow.x, desk.glow.y, desk.pool.width], [0.393, 0.356, 0.484]);
});
