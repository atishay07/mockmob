// Concept checks with life (motion packet M4): the website's half. The words and numbers are held to
// data/fixtures/study_feel/feel.json, which is copied byte for byte into the app's
// test/fixtures/learn_feel/feel.json (learn_feel_test.dart holds the app to the same bytes).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { GLANCE_GAP_MS, reactNow, reset, setClock } from '../../src/lib/mobiRation.js';
import {
  FEEL, NUDGE_LINES, checkDelayMs, flyAway, flyKeyframes, flyOpacity, flyTransform, mobiShownFor, nudgeLine, nudgeOffset,
  pickedIndex, reactionAct, resultKind, ringDelayMs, rightIndex, softClick,
} from '../../src/components/study/studyFeel.js';

const read = (path) => fs.readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const fixture = JSON.parse(read('data/fixtures/study_feel/feel.json'));
const css = read('src/components/study/study.css').replaceAll('\r\n', '\n');
const run = read('src/components/study/StudyRun.jsx').replaceAll('\r\n', '\n');
const blocks = read('src/components/study/StudyBlocks.jsx').replaceAll('\r\n', '\n');

const cssNumber = (name) => {
  const m = css.match(new RegExp(`--${name}:\\s*(-?[\\d.]+)(ms|px)?`));
  assert.ok(m, `--${name} is set in study.css`);
  return Number(m[1]);
};

test('the words and numbers equal the shared fixture', () => {
  assert.deepEqual(NUDGE_LINES, { miss: fixture.copy.miss, skipped: fixture.copy.skipped });
  assert.deepEqual({ ...FEEL.ink }, fixture.ink);
  assert.deepEqual({ ...FEEL.nudge }, fixture.nudge);
  assert.deepEqual({ ...FEEL.swap }, fixture.swap);
  assert.equal(FEEL.mobi.rightAct, fixture.mobi.rightAct);
  assert.equal(FEEL.mobi.missAct, fixture.mobi.missAct);
  assert.equal(FEEL.mobi.gapMs, fixture.mobi.gapMs);
  assert.equal(FEEL.mobi.slot, fixture.mobi.slot);
  assert.equal(GLANCE_GAP_MS, fixture.mobi.gapMs, 'one rate limit for every Mobi reaction');
});

test('the CSS carries the same numbers as custom properties on the run', () => {
  assert.equal(cssNumber('sx-ring-ms'), fixture.ink.ringMs);
  assert.equal(cssNumber('sx-check-ms'), fixture.ink.checkMs);
  assert.equal(cssNumber('sx-lead-ms'), fixture.ink.leadMs);
  assert.equal(cssNumber('sx-check-after-ms'), fixture.ink.checkAfterMs);
  assert.equal(cssNumber('sx-panel-check-ms'), fixture.ink.panelCheckMs);
  assert.equal(cssNumber('sx-nudge-ms'), fixture.nudge.durationMs);
  assert.equal(cssNumber('sx-arrive-travel'), fixture.swap.arriveTravel);
  assert.equal(cssNumber('sx-fly-travel'), fixture.swap.flyTravel);
  assert.equal(cssNumber('sx-fly-lift'), fixture.swap.flyLift);
  assert.equal(cssNumber('sx-fly-scale'), fixture.swap.flyScale);
  assert.equal(cssNumber('sx-fly-gone-at'), fixture.swap.flyGoneAt);
});

test('the nudge keyframes in the CSS are the app’s MmShake curve', () => {
  const block = css.match(/@keyframes sx-nudge \{([\s\S]*?)\n\}/);
  assert.ok(block, 'sx-nudge keyframes exist');
  const frames = [...block[1].matchAll(/([\d.]+)% \{ translate: (-?[\d.]+)px 0; \}/g)].map((m) => [Number(m[1]) / 100, Number(m[2])]);
  assert.ok(frames.length >= 13, 'at least eight samples a cycle would be better; at least 13 here');
  assert.equal(frames[0][0], 0);
  assert.equal(frames.at(-1)[0], 1);
  for (const [t, x] of frames) assert.ok(Math.abs(x - nudgeOffset(t)) < 0.002, `t=${t}: ${x} vs ${nudgeOffset(t)}`);
  // It ends exactly at rest, never past 4 px, and it composes with the panel's rise (translate, not transform).
  assert.equal(nudgeOffset(0), 0);
  assert.equal(nudgeOffset(1), 0);
  assert.ok(Math.max(...frames.map(([, x]) => Math.abs(x))) <= FEEL.nudge.amplitude);
  assert.ok(!/@keyframes sx-nudge[\s\S]*?transform:/.test(block[0]), 'the nudge never replaces the rise');
});

test('a result is right, a miss, skipped or just shown, and only a miss or a skip gets a line', () => {
  assert.equal(resultKind({ correct: true }), 'right');
  assert.equal(resultKind({ correct: false }), 'miss');
  assert.equal(resultKind({ correct: false, skipped: true }), 'skipped');
  assert.equal(resultKind({ answer: 'Old share - New share' }), 'shown');
  assert.equal(resultKind(null), 'shown');
  assert.equal(nudgeLine({ correct: true }), null);
  assert.equal(nudgeLine({ correct: false }), NUDGE_LINES.miss);
  assert.equal(nudgeLine({ correct: false, skipped: true }), NUDGE_LINES.skipped);
  assert.equal(nudgeLine({ answer: 'x' }), null);
  assert.equal(reactionAct('right'), 'correct');
  assert.equal(reactionAct('miss'), 'encourage');
  assert.equal(reactionAct('skipped'), 'encourage');
  assert.equal(reactionAct('shown'), null, 'a self-rated card has no verdict, so no reaction');
});

test('the new words have no exclamation mark, em dash or middle dot, and the run’s own copy has no em dash or middle dot', () => {
  for (const line of Object.values(NUDGE_LINES)) assert.doesNotMatch(line, /[!—·]/);
  assert.doesNotMatch(run, /[—·]/, 'StudyRun.jsx');
  assert.doesNotMatch(read('src/components/study/studyFeel.js'), /[—·]/, 'studyFeel.js');
  assert.doesNotMatch(read('src/components/study/studyCopy.js'), /[—·]/, 'studyCopy.js');
});

test('which options were picked and which was right', () => {
  const item = { options: ['3:2', '1:1', '4:1', '2:3'], answer: 0 };
  assert.equal(rightIndex(item), 0);
  assert.equal(rightIndex({ options: ['a'], answer: undefined }), null, 'before the answer is revealed there is no right row');
  assert.equal(rightIndex({ options: ['a', 'b'], answer: 5 }), null);
  assert.equal(pickedIndex(item, { chosen: '1:1' }), 1);
  assert.equal(pickedIndex(item, { chosen: 'not an option' }), null);
  assert.equal(pickedIndex(item, { skipped: true }), null);
  assert.equal(pickedIndex({ options: undefined }, { chosen: '1:1' }), null);
});

test('a right answer inks at once; after a miss the right row waits for the nudge', () => {
  assert.equal(ringDelayMs(false), FEEL.ink.leadMs);
  assert.equal(ringDelayMs(true), FEEL.nudge.durationMs);
  assert.equal(checkDelayMs(false), FEEL.ink.leadMs + FEEL.ink.checkAfterMs);
  assert.equal(checkDelayMs(true), FEEL.nudge.durationMs + FEEL.ink.checkAfterMs);
});

test('a rated card flies 56 px left, lifts, shrinks and is fully gone well before its spring settles', () => {
  assert.equal(flyOpacity(0), 1);
  assert.equal(flyOpacity(FEEL.swap.flyGoneAt), 0);
  assert.equal(flyOpacity(1), 0);
  assert.ok(flyOpacity(0.3) > 0 && flyOpacity(0.3) < 1);
  assert.equal(flyTransform(0), 'translate3d(0px, 0px, 0) scale(1)');
  assert.equal(flyTransform(1), `translate3d(-56px, -10px, 0) scale(${FEEL.swap.flyScale})`);
  const frames = flyKeyframes();
  assert.deepEqual(frames.map((f) => f.offset), [0, FEEL.swap.flyGoneAt, 1]);
  assert.equal(frames[0].opacity, 1);
  assert.equal(frames[1].opacity, 0);
  assert.equal(frames[2].transform, flyTransform(1));
});

test('Mobi stands beside the words only under Celebrations Full, and at most once every 2.5 s', () => {
  assert.equal(mobiShownFor('full'), true);
  assert.equal(mobiShownFor('quiet'), false);
  assert.equal(mobiShownFor('off'), false);
  reset();
  let now = 1_700_000_000_000;
  setClock(() => now);
  assert.equal(reactNow(FEEL.mobi.gate, FEEL.mobi.gapMs), true);
  now += 1200;
  assert.equal(reactNow(FEEL.mobi.gate, FEEL.mobi.gapMs), false, 'a second answer 1.2 s later gets no Mobi');
  now += 1400;
  assert.equal(reactNow(FEEL.mobi.gate, FEEL.mobi.gapMs), true, 'and one 2.6 s after the first does');
  reset();
});

function withBrowser({ vibrate, userAgent = 'Android', visible = 'visible', dataset = {}, stored = null }, body) {
  const saved = ['navigator', 'document', 'window'].map((k) => [k, Object.getOwnPropertyDescriptor(globalThis, k)]);
  const set = (k, value) => Object.defineProperty(globalThis, k, { value, configurable: true, writable: true });
  set('navigator', { vibrate, userAgent });
  set('document', { visibilityState: visible, documentElement: { dataset } });
  set('window', { localStorage: { getItem: () => stored }, CSS: { supports: () => true } });
  try { return body(); } finally {
    for (const [k, d] of saved) { if (d) Object.defineProperty(globalThis, k, d); else delete globalThis[k]; }
  }
}

test('one soft click for a right answer, on Android with Touch feedback on, and never otherwise', () => {
  const calls = [];
  const vibrate = (p) => { calls.push(p); return true; };
  assert.equal(withBrowser({ vibrate }, () => softClick()), true);
  assert.deepEqual(calls, [[8]]);
  const none = (opts) => { const before = calls.length; const r = withBrowser({ vibrate, ...opts }, () => softClick()); return [r, calls.length - before]; };
  assert.deepEqual(none({ userAgent: 'iPhone' }), [false, 0], 'not on iPhone');
  assert.deepEqual(none({ visible: 'hidden' }), [false, 0], 'not while the page is hidden');
  assert.deepEqual(none({ dataset: { touch: 'off' } }), [false, 0], 'not with Touch feedback off');
  assert.deepEqual(none({ stored: 'off' }), [false, 0], 'not with the stored switch off');
  assert.equal(withBrowser({ vibrate: undefined }, () => softClick()), false, 'not where vibrate does not exist');
});

// A tiny DOM, enough for flyAway: a stage to copy, a host to put the copy in, and Web Animations.
function fakeNode(rect, tag = 'section') {
  const node = {
    tag, rect, attrs: {}, style: {}, classList: { items: [], add(c) { this.items.push(c); } }, children: [], removed: false, animations: [],
    getBoundingClientRect() { return this.rect; },
    cloneNode() { const copy = fakeNode(this.rect, this.tag); copy.cloned = true; return copy; },
    removeAttribute(k) { delete this.attrs[k]; },
    setAttribute(k, v) { this.attrs[k] = v; },
    querySelectorAll() { return []; },
    appendChild(child) { this.children.push(child); return child; },
    remove() { this.removed = true; },
    animate(keyframes, options) { this.animations.push({ keyframes, options }); return { finished: Promise.resolve() }; },
  };
  return node;
}

test('flyAway lifts a visual copy that takes no touches, flies or steps off the axis, and removes itself', async () => {
  const stage = fakeNode({ left: 116, top: 340, width: 300, height: 260 });
  const host = fakeNode({ left: 100, top: 100, width: 332, height: 900 }, 'div');
  const out = withBrowser({ vibrate: () => true }, () => flyAway(stage, host, 'fly'));
  assert.ok(out, 'a ghost is made');
  assert.equal(host.children.length, 1);
  assert.equal(out.attrs['aria-hidden'], 'true');
  assert.equal(out.attrs.inert, '');
  assert.deepEqual(out.classList.items, ['sx-ghost']);
  assert.equal(out.style.left, '16px');
  assert.equal(out.style.top, '240px');
  assert.equal(out.style.width, '300px');
  assert.equal(out.style.pointerEvents, 'none');
  assert.equal(out.animations.length, 1);
  assert.equal(out.animations[0].options.fill, 'forwards');
  assert.ok(String(out.animations[0].options.easing).length > 0);
  assert.deepEqual(out.animations[0].keyframes.map((f) => f.offset), [0, FEEL.swap.flyGoneAt, 1]);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(out.removed, true, 'the copy goes when its animation ends');

  const axisHost = fakeNode({ left: 100, top: 100, width: 332, height: 900 }, 'div');
  const axis = withBrowser({ vibrate: () => true }, () => flyAway(stage, axisHost, 'axis'));
  const { keyframes, options } = axis.animations[0];
  assert.equal(options.easing, 'linear');
  assert.ok(keyframes.length > 10);
  assert.equal(keyframes[0].opacity, 1, 'it holds at full strength first');
  assert.equal(keyframes.at(-1).opacity, 0);
  const drift = Number(keyframes.at(-1).transform.match(/translate3d\((-?[\d.]+)px/)[1]);
  assert.ok(Math.abs(drift + FEEL.swap.arriveTravel * 0.22) < 0.01, `the old step drifts a fifth of the arrival (got ${drift})`);
});

test('flyAway does nothing under reduced motion, or with nothing to lift', () => {
  const stage = fakeNode({ left: 0, top: 0, width: 300, height: 200 });
  const host = fakeNode({ left: 0, top: 0, width: 300, height: 900 }, 'div');
  assert.equal(flyAway(stage, host, 'fly', { reduced: true }), null);
  assert.equal(host.children.length, 0);
  assert.equal(flyAway(null, host, 'fly'), null);
  assert.equal(flyAway(stage, null, 'fly'), null);
  assert.equal(flyAway(fakeNode({ left: 0, top: 0, width: 0, height: 0 }), host, 'fly'), null, 'a hidden stage has nothing to fly');
});

test('wiring: the click and the flight come on the server’s acknowledgement, a miss clicks nothing, and the 3D turn is gone', () => {
  // Both run inside the try block after the awaited post, so they cannot come before the answer is kept.
  const sent = run.slice(run.indexOf('const send = async'), run.indexOf('const reload = async'));
  const after = sent.slice(sent.indexOf('await api.post'));
  assert.ok(after.includes("softClick()") && after.includes('flyAway('), 'both are after the await');
  assert.match(after, /event\.type === 'answer' && next\.feedback\?\.correct === true\) softClick\(\)/, 'only a right answer clicks');
  assert.ok(after.indexOf('flyAway(') < after.indexOf('setRun(next)'), 'the ghost is lifted before the new step renders');
  assert.ok(!sent.slice(0, sent.indexOf('await api.post')).includes('softClick'), 'nothing clicks before the post returns');
  assert.match(sent, /isMotionReduced\(\)/, 'reduced motion skips the flight');
  assert.ok(!/sx-turn|rotateX/.test(css + run), 'the dead 3D turn is removed');
  assert.match(run, /className="sx-ghosts"[^>]*aria-hidden="true"/, 'the ghost host is hidden from screen readers');
  assert.match(run, /data-picked=\{picked === r\.value \|\| undefined\}/, 'the tapped rating inks volt');
  assert.match(run, /<section key=\{run\.cursor\}/, 'each step is its own element, so it arrives on its own');
});

test('wiring: Mobi is mounted only for a fresh result, gated and muted by Celebrations', () => {
  assert.match(blocks, /\{fresh && act \? <FeedbackMobi act=\{act\} \/> : null\}/);
  assert.match(blocks, /useMobiGate\(\(\) => reactNow\(FEEL\.mobi\.gate, FEEL\.mobi\.gapMs\), false\)/);
  assert.match(blocks, /!mobiShownFor\(celebrations\)\) return null/);
  assert.match(run, /<Feedback feedback=\{run\.feedback\} fresh=\{fresh\}/);
  assert.match(run, /const fresh = freshRev === run\.revision/, 'a step reopened from a saved state is never fresh');
});

test('the end state is the base style, so reduced motion and saved steps simply show it', () => {
  // Every drawing animation only plays up to the base style (fill-mode backwards, from-only keyframes).
  assert.match(css, /@keyframes sx-draw \{ from \{ stroke-dashoffset: 1; \} \}/);
  assert.match(css, /\.sx-inkring rect \{[^}]*stroke-dashoffset: 0;/);
  assert.match(css, /\.sx-mark path \{ stroke-dasharray: 1; stroke-dashoffset: 0; \}/);
  assert.match(css, /@keyframes sx-arrive \{ from \{ opacity: 0; transform: translate3d\(var\(--sx-arrive-travel\), 0, 0\); \} \}/);
  for (const rule of css.match(/(\.sx-result\[data-fresh\][^{]*|\.sx-mark\[data-fresh\][^{]*|\.sx-stage\[data-arrive='true'\])\{[^}]*\}/g)) assert.match(rule, /backwards/, rule);
  // Both reduced-motion switches stop every transition and animation under the run, pseudo-elements too.
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{ \.sx \*, \.sx \*::before, \.sx \*::after \{ transition: none !important; animation: none !important; \} \}/);
  assert.match(css, /:root\[data-motion='reduced'\] \.sx \*, :root\[data-motion='reduced'\] \.sx \*::before, :root\[data-motion='reduced'\] \.sx \*::after \{ transition: none !important; animation: none !important; \}/);
  // The pips fill on the smooth spring from the shared tokens.
  assert.match(css, /\.sx-pips li::after \{[^}]*transition: transform var\(--mm-spring-smooth-dur\) var\(--mm-spring-smooth\);/);
  assert.match(css, /\.sx-pips li\.done::after \{ transform: scaleX\(1\); \}/);
});

test('touch targets and tokens: ratings stay 56 px, result rows 52 px, and the colours are the arena’s own', () => {
  assert.match(css, /\.sx-ratings button \{ min-height: 56px;/);
  assert.match(css, /\.sx-result \{[^}]*min-height: 52px;/);
  const added = css.slice(css.indexOf('Concept checks with life'));
  assert.ok(!/#[0-9a-fA-F]{3,6}\b/.test(added.replace(/color: #111/g, '')), 'no hard-coded colours in the new rules (the volt ink #111 is the arena’s existing pairing)');
});
