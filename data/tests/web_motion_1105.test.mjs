// R2-A (5 Nov night, owner LK95 "how to build UI exactly like the app, animations"): the app's three motions on the
// logged-in web. The monumental number roll (RollNumber, the app's MonumentalNumber), the finish stamp (stampFigure,
// the app's FinishCeremony) on the result's score, and the Start sheet's container transform (morphPlan, the app's
// MorphSheetRoute). The numbers are checked against the app's; the wiring against the source.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ROLL, planRoll, rollCells, travelShare } from '../../src/lib/motion/rollPlan.js';
import { STAMP, earnsRing, figureKeyframes, figureScale, ringAt, ringGeometry, ringKeyframes } from '../../src/lib/motion/stampPlan.js';
import { MORPH, contentKeyframes, discKeyframes, glassKeyframes, insetClip, morphFrom, radiiOf, shapeKeyframes } from '../../src/components/start/morphPlan.mjs';
import { durations, ease } from '../../src/lib/motion/tokens.g.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const close = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

test('the roll: every slot rolls up from 0 on a first show, 0 arrives from 9, a change rolls on and wraps', () => {
  assert.deepEqual(rollCells(3), [0, 1, 2, 3]);
  assert.deepEqual(rollCells(0), [9, 0], 'every slot moves on the first roll');
  assert.deepEqual(rollCells(3, 1), [1, 2, 3]);
  assert.deepEqual(rollCells(2, 8), [8, 9, 0, 1, 2], 'wraps through 9 to 0');
  assert.deepEqual(rollCells(5, 5), [5], 'an unchanged digit stays still');
  assert.equal(travelShare(1), 0);
  assert.equal(travelShare(4), 0.75);
});

test('the roll: 500 ms on emphasized, digit i starts 8% after the one before (40% at most), all land together', () => {
  assert.equal(ROLL.ms, durations.numberRoll);
  assert.equal(ROLL.ms, 500);
  assert.equal(ROLL.easing, ease.emphasized);
  const plan = planRoll('183');
  const digits = plan.slots.filter((s) => s.cells);
  assert.deepEqual(digits.map((s) => s.delay), [0, 40, 80]);
  for (const s of digits) assert.equal(s.delay + s.duration, 500, 'every slot lands at 500 ms');
  assert.equal(plan.landsIn, 500);
  const long = planRoll('1234567').slots;
  assert.equal(long[6].delay, 200, 'never later than 40% of the roll');
  assert.equal(planRoll('7').slots[0].delay, 0, 'a single digit starts at once');
  const held = planRoll('183', { delay: 120 });
  assert.equal(held.slots[0].delay, 120);
  assert.equal(held.landsIn, 620);
});

test('the roll: a change moves only the slots that changed, right-aligned to the old value; other characters stay', () => {
  const plan = planRoll('183', { previous: '171' });
  assert.deepEqual(plan.slots.map((s) => s.cells), [[1], [7, 8], [1, 2, 3]]);
  const grown = planRoll('105', { previous: '99' });
  assert.deepEqual(grown.slots[0].cells, [0, 1], 'a new leading slot rolls up from 0');
  assert.deepEqual(planRoll('4.5').slots[1], { ch: '.' });
  assert.equal(planRoll('42', { previous: '42' }).moves, false, 'an unchanged value does not roll');
});

test('the stamp: the app\'s figure curve, 1.12 at the top of the lift, 1 at the landing, a small settle by 420 ms', () => {
  assert.equal(STAMP.ms, 840);
  assert.equal(STAMP.figureMs, 420);
  assert.equal(STAMP.landMs, 240);
  assert.equal(figureScale(0), 1);
  assert.ok(close(figureScale(80), 1.12, 1e-3), 'the lift peaks at 80 ms');
  assert.ok(close(figureScale(240), 1, 1e-9), 'lands at 240 ms');
  const dip = Math.min(...[260, 280, 300, 320, 340].map(figureScale));
  assert.ok(dip < 1 && dip > 0.985, 'settles a hair below 1, never past 0.985');
  assert.equal(figureScale(420), 1);
  const frames = figureKeyframes();
  assert.equal(frames[0].offset, 0);
  assert.equal(frames.at(-1).offset, 1);
  assert.equal(frames.at(-1).transform, 'scale(1)');
  assert.equal(frames[1].transform, 'scale(1.12)');
  assert.ok(frames.every((f, i) => i === 0 || f.offset > frames[i - 1].offset), 'offsets climb');
});

test('the ring: one line on the figure\'s outline that spreads, thins (5 to 0.8, scaled) and fades; only for a good set', () => {
  const g = ringGeometry({ width: 120, fontSize: 64 });
  assert.ok(g.rx0 > 60, 'starts just outside the digits, not across them');
  assert.ok(g.ryMax < 64, 'stays off the lines above and below');
  const start = ringAt(0, g);
  const end = ringAt(1, g);
  assert.ok(close(start.width, 5.8 * g.stroke) && close(end.width, 0.8 * g.stroke));
  assert.ok(close(start.alpha, 0.85) && close(end.alpha, 0));
  assert.ok(end.rx > start.rx && end.ry <= g.ryMax);
  const frames = ringKeyframes(g);
  assert.equal(frames.at(-1).opacity, 0, 'gone at the end');
  assert.equal(earnsRing({ right: 7, wrong: 2, blank: 1 }), true, '70% right is the app\'s good');
  assert.equal(earnsRing({ right: 6, wrong: 3, blank: 1 }), false);
  assert.equal(earnsRing({}), false);
});

test('the morph: the shape starts on the key, stands off when the key is outside the sheet, and grows to the sheet', () => {
  // Phone: the dock key sits inside the bottom sheet's box.
  const phone = morphFrom({ left: 167, top: 772, width: 56, height: 56 }, { left: 0, top: 120, width: 390, height: 724 }, 28);
  assert.equal(phone.dx, 0);
  assert.equal(phone.dy, 0);
  assert.deepEqual(phone.inset, { top: 652, right: 167, bottom: 16, left: 167 });
  assert.equal(phone.radius, 28);
  // Desktop: the sidebar key is left of the panel; the panel starts on the key and travels home.
  const desk = morphFrom({ left: 14, top: 62, width: 203, height: 48 }, { left: 248, top: 16, width: 520, height: 868 }, 14);
  assert.equal(desk.dx, -234);
  assert.equal(desk.dy, 0);
  assert.equal(desk.inset.left, 0);
  assert.equal(desk.inset.top, 46);
  const [from, to] = shapeKeyframes(desk, [24, 24, 24, 24]);
  assert.match(from.clipPath, /^inset\(46px 317px 774px 0px round 14px 14px 14px 14px\)$/);
  assert.equal(from.transform, 'translate(-234px, 0px)');
  assert.equal(to.clipPath, insetClip({ top: 0, right: 0, bottom: 0, left: 0 }, [24, 24, 24, 24]));
  const [c0, c1] = shapeKeyframes(desk, [24, 24, 24, 24], { closing: true });
  assert.deepEqual([c0, c1], [to, from], 'closing gathers back into the key');
  assert.deepEqual(radiiOf({ borderTopLeftRadius: '26px', borderTopRightRadius: '26px', borderBottomRightRadius: '0px', borderBottomLeftRadius: '0px' }), [26, 26, 0, 0]);
});

test('the morph: the app\'s timings (420 ms open on the grow curve, 280 ms close, content 38-78%, the volt gone by 30%)', () => {
  assert.equal(MORPH.openMs, durations.emphasized);
  assert.equal(MORPH.closeMs, 280);
  assert.deepEqual(MORPH.grow, [0.3, 0.55, 0.2, 1]);
  assert.deepEqual(MORPH.close, [0.3, 0, 0.8, 0.15]);
  assert.equal(MORPH.reducedMs, durations.reducedFade);
  const content = contentKeyframes();
  assert.equal(content.find((f) => f.offset === 0.38).opacity, 0, 'nothing shows before the shape has room');
  assert.equal(content.find((f) => f.offset === 0.78).opacity, 1);
  assert.equal(content[0].transform, 'scale(0.94)');
  assert.equal(contentKeyframes({ closing: true }).find((f) => f.offset === 0.55).opacity, 0, 'gone in the first 55% of the close');
  const disc = discKeyframes();
  assert.equal(disc[0].opacity, 1);
  assert.equal(disc[0].transform, 'scale(1)');
  const gone = disc.find((f) => close(f.offset, 0.3));
  assert.equal(gone.opacity, 0);
  assert.equal(gone.transform, 'scale(1.2)');
  const glass = glassKeyframes();
  assert.equal(glass[0].opacity, 0.45, 'the page shows through the growing glass at first (the app tint alpha)');
  assert.equal(glass.find((f) => f.offset === 0.55).opacity, 1, 'whole by 55% of the morph');
  assert.equal(glassKeyframes({ closing: true }).at(-1).opacity, 0.45);
  const back = discKeyframes({ closing: true });
  assert.equal(back.at(-1).opacity, 1, 'the volt is whole again as the close ends');
  assert.ok(back.every((f, i) => i === 0 || f.offset >= back[i - 1].offset));
});

test('wired: the result\'s score rolls and stamps after the page settles; the Start sheet grows from its key, keeps focus', () => {
  const hero = read('src/components/result/ResultHero.jsx');
  assert.match(hero, /<RollNumber value=\{value\} run=\{run\} settle onRoll=\{onRoll\} \/>/);
  assert.match(hero, /stampFigure\(\{ figure: figure\.current, ring: ring \? ringRef\.current : null, landsIn \}\)/);
  assert.match(hero, /run=\{arrive && celebrations !== 'off'\}/);
  assert.match(hero, /ring=\{celebrations === 'full' && !nta && earnsRing\(marks\)\}/);
  assert.doesNotMatch(hero, /useCountUp/, 'the result score no longer counts up (LK95 supersedes G31\'s count-up)');
  const page = read('src/app/(app)/result/[id]/ResultPageClient.jsx');
  assert.match(page, /celebrations=\{prefs\.celebrations\} nta=\{attempt\?\.selectionMeta\?\.mode === 'nta'\}/);
  const roll = read('src/lib/motion/RollNumber.jsx');
  assert.match(roll, /settleStep\(wait, now\)/, 'the roll waits for the page to settle (G31)');
  assert.match(roll, /if \(!run \|\| reduced/, 'reduced motion never rolls');
  assert.match(roll, /if \(key !== null\) rememberNumber\(key, text\);/, 'with a memory key it remembers, as the app\'s does');
  assert.match(roll, /inkFor\(numberDirection\(before, text\)\)/, 'a remembered change inks its direction');
  const css = read('src/components/recovery/result.css');
  assert.match(css, /\.rp-hero__score > span \{/, 'the unit rule does not reach the figure\'s own spans');
  const sheet = read('src/components/start/StartSheet.jsx');
  assert.match(sheet, /if \(morph\(el, key\)\) return;/);
  assert.match(sheet, /const gathered = morph\(el, key, \{ closing: true \}\);/);
  assert.match(sheet, /duration: MORPH\.reducedMs, easing: 'linear'/, 'reduced motion: a 120 ms fade');
  assert.match(sheet, /el\.addEventListener\('focusout', onFocusOut\);/, 'focus never drops to the page while it is open');
  assert.match(sheet, /<span className="st-origin" aria-hidden="true" \/>/);
  const startCss = read('src/components/start/start.css');
  assert.match(startCss, /\.st-sheet::backdrop \{[^}]*animation: st-scrim-in var\(--mm-dur-emphasized, 420ms\)/);
});
