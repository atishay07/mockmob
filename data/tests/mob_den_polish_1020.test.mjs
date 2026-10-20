// Web Mob polish, 20 Oct: the den's skeleton (D6), live sticker flights (M12) and their rules. The podium's lamp rule is
// in mob_v3_web_play.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  STICKER_SPACING_MS, STICKERS_VISIBLE, RECEIVED_WINDOW_MS, canSendSticker, freshReactions, pushVisible, reactionKey,
  flightFrames, emphasized, isStickerKind, stickerWords, stickerTilt,
} from '../../src/lib/mob/v3/stickerFlights.mjs';
import { DEFAULT_BLOCKS, parseShape, shapeBand, skeletonBlocks } from '../../src/lib/mob/v3/denSkeleton.mjs';
import { STICKERS, DEN_STICKERS, DenCopy } from '../../src/lib/mob/v3/denCopy.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => readFileSync(path.join(root, p), 'utf8');
const NOW = Date.parse('2026-10-22T09:30:00.000Z');
const ago = (ms) => new Date(NOW - ms).toISOString();

test('stickers are the fixed enum: no free text is ever drawn', () => {
  assert.equal(Object.keys(STICKERS).length, 8);
  for (const k of Object.keys(STICKERS)) { assert.ok(isStickerKind(k)); assert.equal(stickerWords(k), STICKERS[k]); assert.equal(typeof stickerTilt(k), 'number'); }
  for (const bad of ['hello', '<b>hi</b>', '', null, undefined, 'toString', '__proto__', 'constructor']) {
    assert.equal(isStickerKind(bad), false, String(bad));
    assert.equal(stickerWords(bad), null);
  }
  for (const k of DEN_STICKERS) assert.ok(isStickerKind(k));
  // The paper sticker draws only stickerWords(kind) and a glyph per kind; nothing else from a reaction.
  const src = read('src/components/mob/den/Stickers.jsx');
  assert.match(src, /const words = stickerWords\(kind\);\s*if \(!words\) return null;/);
  for (const k of Object.keys(STICKERS)) assert.ok(src.includes(`case '${k}':`), `a glyph for ${k}`);
  assert.doesNotMatch(src, /dangerouslySetInnerHTML/);
  assert.equal(DenCopy.stickerRowLabel, 'Send your Mob a sticker');
});

test('sends are spaced 3 s apart on this device', () => {
  assert.equal(STICKER_SPACING_MS, 3000);
  assert.equal(canSendSticker(Number.NaN, NOW), true);
  assert.equal(canSendSticker(undefined, NOW), true);
  assert.equal(canSendSticker(NOW - 2999, NOW), false);
  assert.equal(canSendSticker(NOW - 3000, NOW), true);
  const den = read('src/components/mob/den/DenV3.jsx');
  // A tap inside the gap returns before any request and says nothing; a failed send gives the gap back.
  assert.match(den, /if \(!canSendSticker\(lastSent\.current, at\)\) return;/);
  assert.match(den, /if \(!r\.ok\) \{ lastSent\.current = before;/);
});

test('friends\' stickers: recent, known, not yours, once per session, newest three', () => {
  const ids = new Set(['m1', 'm2', 'm3', 'you']);
  const reactions = [
    { memberId: 'm1', kind: 'nice_one', at: ago(60_000) },
    { memberId: 'you', kind: 'again', at: ago(50_000) },
    { memberId: 'm2', kind: 'free text', at: ago(40_000) },
    { memberId: 'gone', kind: 'so_close', at: ago(30_000) },
    { memberId: 'm3', kind: 'teach_me', at: ago(RECEIVED_WINDOW_MS + 1000) },
    { memberId: 'm2', kind: 'again', at: ago(20_000) },
    { memberId: 'm3', kind: 'so_close', at: ago(10_000) },
    { memberId: 'm1', kind: 'teach_me', at: ago(5_000) },
    { memberId: 'm1', kind: 'nice_one', at: 'not a time' },
  ];
  const fresh = freshReactions(reactions, { youId: 'you', now: NOW, memberIds: ids });
  assert.deepEqual(fresh.map((r) => `${r.memberId}:${r.kind}`), ['m2:again', 'm3:so_close', 'm1:teach_me']);
  assert.equal(fresh.length, STICKERS_VISIBLE);
  const flown = new Set(fresh.map(reactionKey));
  assert.deepEqual(freshReactions(reactions, { youId: 'you', now: NOW, memberIds: ids, flown }).map((r) => r.kind), ['nice_one']);
  assert.deepEqual(freshReactions(null), []);
});

test('at most three on the stage; the oldest retires', () => {
  let list = [];
  for (let i = 1; i <= 5; i++) list = pushVisible(list, { id: `s${i}` });
  assert.deepEqual(list.map((x) => x.id), ['s3', 's4', 's5']);
  assert.deepEqual(pushVisible(list, { id: 's4', again: true }).map((x) => x.id), ['s3', 's5', 's4']);
});

test('the flight is an arc from the key to the spot over your Fold', () => {
  for (const [from, to] of [[{ x: 100, y: 700 }, { x: 60, y: 300 }], [{ x: 900, y: 820 }, { x: 480, y: 440 }], [{ x: 200, y: 300 }, { x: 260, y: 320 }]]) {
    const f = flightFrames(from, to, { tilt: -1.5 });
    assert.equal(f.length, 17);
    assert.deepEqual([f[0].x, f[0].y, f[0].offset], [0, 0, 0]);
    const last = f.at(-1);
    assert.ok(Math.abs(last.x - (to.x - from.x)) < 0.2 && Math.abs(last.y - (to.y - from.y)) < 0.2, 'it lands on the spot');
    assert.equal(last.offset, 1);
    assert.ok(Math.min(...f.map((k) => k.y)) < Math.min(0, to.y - from.y) - 10, 'it rises above both ends, so the eye sees where it went');
    assert.ok(f.every((k) => Number.isFinite(k.x) && Number.isFinite(k.y) && k.scale >= 0.89 && k.scale <= 1.11));
    assert.ok(Math.abs(last.scale - 0.9) < 0.001, 'it sticks small');
    assert.ok(Math.abs(last.rotate - -1.5) < 0.01, 'and lands at its own tilt');
    for (let i = 1; i < f.length; i++) assert.ok(f[i].offset > f[i - 1].offset);
  }
  assert.equal(emphasized(0), 0);
  assert.ok(Math.abs(emphasized(1) - 1) < 1e-6);
  for (let t = 0.05; t < 1; t += 0.05) assert.ok(emphasized(t) >= emphasized(t - 0.05));
});

test('reduced motion: no flight and no rise, a 120 ms fade in and out over the Fold', () => {
  const css = read('src/components/mob/den/den.css');
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.den \.den-stage \.den-sticker \{[^}]*den-sticker-reduced 2040ms/);
  assert.match(css, /:root\[data-motion='reduced'\] \.den \.den-stage \.den-sticker \{[^}]*den-sticker-reduced 2040ms/);
  assert.match(css, /@keyframes den-sticker-reduced \{ 0% \{ opacity: 0; \} 5\.9% \{ opacity: 1; \} 94\.1% \{ opacity: 1; \} 100% \{ opacity: 0; \} \}/);
  const den = read('src/components/mob/den/DenV3.jsx');
  assert.match(den, /if \(to && prefersReduced\(\)\) \{/);
  // Neighbours' stickers never cover each other on a narrow stage; the end slots lean inwards.
  assert.match(css, /@container \(max-width: 600px\) \{ \.den-slot\[data-lift\] \{ --sy: 40px; \} \}/);
  assert.match(css, /\.den-floor:has\(\.den-sticker\) \{ z-index: 4; \}/);
  assert.match(read('src/components/mob/den/DenStage.jsx'), /onStage\.has\(members\[i - 1\]\.memberId\) && !lifted\.has\(members\[i - 1\]\.memberId\)/);
  assert.match(css, /\.den-slot:first-child \{ --sx: -26%; \}/);
  assert.match(css, /\.den-slot:last-child \{ --sx: -74%; \}/);
});

test('live: quiet re-reads every 30 s while the den is on screen and you are around; a failed one changes nothing', () => {
  const den = read('src/components/mob/den/DenV3.jsx');
  assert.match(den, /export const DEN_LIVE_MS = 30_000;/);
  assert.match(den, /export const DEN_LIVE_IDLE_MS = 5 \* 60_000;/);
  assert.match(den, /document\.visibilityState !== 'visible' \|\| Date\.now\(\) - touched > DEN_LIVE_IDLE_MS/);
  assert.match(den, /if \(!several \|\| !liveRead\) return undefined;/);
  const hook = read('src/components/mob/useMob.js');
  // The quiet read never sets an error, and a read that started before a write is dropped.
  const refresh = hook.slice(hook.indexOf('const refresh = useCallback'), hook.indexOf('const select = useCallback'));
  assert.doesNotMatch(refresh, /status: 'error'|status: 'loading'/);
  assert.match(refresh, /writes\.current !== seq/);
  assert.match(hook, /writes\.current \+= 1;/);
});

test('D6: the skeleton keeps the den\'s shape from this device, safely', () => {
  assert.equal(shapeBand(390), 'n');
  assert.equal(shapeBand(639), 'n');
  assert.equal(shapeBand(640), 'w');
  assert.equal(shapeBand(1440), 'w');
  assert.deepEqual(parseShape(null), { kind: 'den', switcher: false, blocks: {} });
  assert.deepEqual(parseShape({ kind: 'evil', switcher: 'yes', blocks: { n: [301.4, -5, 'x', 5000, 66, 70, 80], w: 'no' } }),
    { kind: 'den', switcher: false, blocks: { n: [301, 24, 900, 66] } });
  assert.deepEqual(parseShape({ kind: 'start', switcher: true, blocks: { w: [206, 66] } }), { kind: 'start', switcher: true, blocks: { w: [206, 66] } });
  assert.deepEqual(skeletonBlocks(parseShape(null), 390), [...DEFAULT_BLOCKS.n]);
  assert.deepEqual(skeletonBlocks(parseShape(null), 1440), [...DEFAULT_BLOCKS.w]);
  assert.deepEqual(skeletonBlocks(parseShape({ blocks: { n: [226, 66] } }), 390), [226, 66]);
  assert.deepEqual(skeletonBlocks(parseShape({ blocks: { n: [226, 66] } }), 1440), [...DEFAULT_BLOCKS.w]);
  // The skeleton is the den's own room at its own size: no fixed 318 px override, the pennant block in the pennant's place,
  // the head with blocks for the name and the chip, no Folds; the den over it does not rise again (warm).
  const css = read('src/components/mob/den/den.css');
  assert.doesNotMatch(css, /\.den-stage--skeleton \{ --stage-h/);
  assert.match(css, /\.den-stage--warm \.den-room, \.den-stage--warm \.den-room__lamp \{ animation: none; \}/);
  assert.match(css, /html\[data-den-switch='1'\] \.den-skel-switch \{ display: flex; \}/);
  const stage = read('src/components/mob/den/DenStage.jsx');
  assert.match(stage, /const preview = !v3 && !skeleton;/);
  assert.match(stage, /den-skelbar--name/);
  assert.match(stage, /const seats = skeleton \? 0 :/);
  const skel = read('src/components/mob/den/DenSkeleton.jsx');
  assert.match(skel, /var\(--den-skel-b\$\{i\}, \$\{h\}px\)/);
  assert.match(skel, /DenCopy\.failed/);
  // The root script sets the sizes before the first paint, from the same store, inside a try.
  const layout = read('src/app/layout.js');
  assert.match(layout, /try\{var k=JSON\.parse\(localStorage\.getItem\('mm:den:shape:v1'\)\|\|'null'\)/);
  assert.match(layout, /d\.dataset\.denSwitch='1'\}catch\(e\)\{\}/);
  const page = read('src/components/mob/MobPage.jsx');
  assert.match(page, /<MobWaiting mob=\{mob\} onShown=\{shown\} \/>/);
  assert.match(page, /warm=\{warm\}/);
});
