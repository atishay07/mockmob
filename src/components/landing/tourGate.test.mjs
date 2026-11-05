// node --test src/components/landing/tourGate.test.mjs
// R3-D5 (5 Nov 2026, LK105, "This Walk, What's Inside Walk Mob, is still a bit glitchy ... sometimes it's not glitchy and
// sometimes it is"). Research scrolltour P2-1..P2-5: a screen coming on stage committed its first frame, was rebased to
// its FINISHED frame by a parked settle update, then restarted mid-fade; the leaving screen popped to finished during its
// fade-out; a symmetric crossfade held two tools at about 50/50 for about 115 ms; rail icons loaded late; the chip row
// moved late after a forced layout.
//
// Part 1 (always): the screen's value rule, the gate's analysis, the timing maths from the shipped curves, and the source.
// Part 2 (opt-in, real Chrome, the shared browser lock, a running server):
//   MM_TOUR_GATE=1 TOUR_GATE_URL=http://localhost:3584/ node --test src/components/landing/tourGate.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { firstState, shownValue } from './tourSequence.mjs';
import { GATE, analyzeTourRun, runTourGateAll } from './tourGateBench.mjs';
import { benchAvailable } from './oneGestureBench.mjs';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

// ---------------------------------------------------------------- the value rule
const base = { held: true, active: true, reduced: false, paused: false, epoch: 7, first: 0, settled: 6 };

test('on stage and playing: this activation\'s frame, or the first frame until its playback speaks (never the finished one)', () => {
  assert.equal(shownValue({ ...base, state: { epoch: 7, value: 3 } }), 3);
  assert.equal(shownValue({ ...base, state: { epoch: 4, value: 6 } }), 0, 'a returning screen whose state is from an older visit starts over');
  assert.equal(shownValue({ ...base, state: { epoch: -1, value: 6 } }), 0, 'a screen never shown before starts from its first frame');
});

test('a held screen off stage is frozen where it was: it never settles, so a leaving screen fades out as it was', () => {
  assert.equal(shownValue({ ...base, active: false, epoch: -1, state: { epoch: 7, value: 2 } }), 2);
  assert.equal(shownValue({ ...base, active: false, epoch: -1, state: { epoch: 7, value: 0 } }), 0);
});

test('paused keeps the current frame; reduced motion and the unheld carousel off stage show the finished screen', () => {
  assert.equal(shownValue({ ...base, paused: true, state: { epoch: 7, value: 4 } }), 4);
  assert.equal(shownValue({ ...base, paused: true, state: { epoch: 2, value: 6 } }), 6);
  assert.equal(shownValue({ ...base, reduced: true, state: { epoch: 7, value: 1 } }), 6);
  assert.equal(shownValue({ ...base, held: false, active: false, epoch: -1, state: { epoch: 3, value: 2 } }), 6);
  assert.deepEqual(firstState({ ...base }), { epoch: 7, value: 0 });
  assert.deepEqual(firstState({ ...base, active: false }), { epoch: 7, value: 6 });
  assert.deepEqual(firstState({ ...base, paused: true }), { epoch: 7, value: 6 });
  assert.deepEqual(firstState({ ...base, reduced: true }), { epoch: 7, value: 6 });
});

// ---------------------------------------------------------------- the gate's analysis
const frames = (from, to, ops) => Array.from({ length: Math.floor((to - from) / 8) + 1 }, (_, k) => ({ t: from + k * 8, ops: ops(from + k * 8), sl: 0, unloaded: 0 }));
const clean = (t) => [t < 100 ? 1 - t / 120 : 0, t < 95 ? 0 : Math.min(1, (t - 95) / 120)];
const steps = (seq, t0 = 0) => seq.map((val, k) => ({ t: t0 + 2 + k * 45, i: 1, attr: 'data-ts-step', old: String(k ? seq[k - 1] : 5), val: String(val) }));

test('the gate passes a clean step: 0 then climbing, the leaving screen untouched, a short faint overlap', () => {
  const log = [
    { t: 0, i: -1, attr: 'data-step', old: '0', val: '1' },
    { t: 0, i: 0, attr: 'data-active', old: 'true', val: 'false' },
    { t: 0, i: 1, attr: 'data-ts-step', old: '5', val: '0' },
    { t: 0, i: 1, attr: 'data-active', old: 'false', val: 'true' },
    ...steps([1, 2, 3, 4, 5], 60),
  ];
  const run = analyzeTourRun(log, frames(0, 600, clean), { slides: 2 });
  assert.equal(run.ok, true, run.fails.join('; '));
  assert.equal(run.steps[0].values, '0>1>2>3>4>5');
});

test('the gate fails the old flash: 0, the finished frame, then 0 again', () => {
  const log = [
    { t: 0, i: 0, attr: 'data-active', old: 'true', val: 'false' },
    { t: 0, i: 1, attr: 'data-ts-step', old: '5', val: '0' },
    { t: 0, i: 1, attr: 'data-active', old: 'false', val: 'true' },
    { t: 0, i: 1, attr: 'data-ts-step', old: '0', val: '5' },
    ...steps([0, 1, 2], 8),
  ];
  const run = analyzeTourRun(log, frames(0, 600, clean), { slides: 2 });
  assert.equal(run.ok, false);
  assert.match(run.fails[0], /activation 0->1 data-ts-step 0>5>0>1>2/);
});

test('the gate fails a leaving screen that changes while it can still be seen, and a long or strong overlap', () => {
  const popped = analyzeTourRun([
    { t: 0, i: 0, attr: 'data-active', old: 'true', val: 'false' },
    { t: 0, i: 1, attr: 'data-ts-step', old: '5', val: '0' },
    { t: 0, i: 1, attr: 'data-active', old: 'false', val: 'true' },
    { t: 18, i: 0, attr: 'data-ts-step', old: '2', val: '7' },
  ], frames(0, 600, clean), { slides: 2 });
  assert.ok(popped.fails.some((f) => /^leaving 0 changed while visible: 2>7@\+18/.test(f)), popped.fails.join('; '));
  const cross = analyzeTourRun([
    { t: 0, i: 0, attr: 'data-active', old: 'true', val: 'false' },
    { t: 0, i: 1, attr: 'data-ts-step', old: '5', val: '0' },
    { t: 0, i: 1, attr: 'data-active', old: 'false', val: 'true' },
  ], frames(0, 600, (t) => [Math.max(0, 1 - t / 240), Math.min(1, t / 240)]), { slides: 2 });
  assert.ok(cross.fails.some((f) => /^overlap 0->1/.test(f)), 'the old symmetric 240 ms crossfade fails');
  assert.ok(cross.steps[0].overlapMs >= GATE.overlapMs && cross.steps[0].overlapMaxMin >= GATE.overlapOpacity);
});

// ---------------------------------------------------------------- the timing, from the shipped curves
function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1; const bx = 3 * (x2 - x1) - cx; const ax = 1 - cx - bx;
  const cy = 3 * y1; const by = 3 * (y2 - y1) - cy; const ay = 1 - cy - by;
  const sx = (t) => ((ax * t + bx) * t + cx) * t; const sy = (t) => ((ay * t + by) * t + cy) * t;
  return (x) => { let lo = 0; let hi = 1; for (let i = 0; i < 50; i += 1) { const m = (lo + hi) / 2; if (sx(m) < x) lo = m; else hi = m; } return sy((lo + hi) / 2); };
}
const token = (css, name) => {
  const m = css.match(new RegExp(`${name}: cubic-bezier\\(([^)]+)\\);`));
  assert.ok(m, `${name} is a token`);
  return bezier(...m[1].split(',').map(Number));
};

test('the sequenced change: out 120 ms on the exit curve with no move, in 200 ms after 90 ms rising 0.6rem; overlap < 30 ms below 0.25', () => {
  const css = strip(read('../../app/feature-tour.css'));
  assert.match(css, /\.ft-story \{ --ft-out: 120ms; --ft-in: 200ms; --ft-in-delay: 90ms; --ft-rise: 0\.6rem; \}/);
  assert.match(css, /\.ft-story\[data-pinned='true'\] \.ft__slide \{[^}]*transition: opacity var\(--ft-out\) var\(--mm-ease-exit, ease-in\), visibility 0s linear var\(--ft-out\); \}/);
  assert.match(css, /\.ft-story\[data-pinned='true'\] \.ft__slide\[data-active='true'\] \{ opacity: 1; visibility: visible; transition: opacity var\(--ft-in\) var\(--mm-ease-glide, ease-out\) var\(--ft-in-delay\), visibility 0s linear 0s; \}/);
  // The leaving tool does not move: its transform only snaps back once it is hidden.
  assert.match(css, /\.ft-story\[data-pinned='true'\] \.ft__slide :is\(\.ft__copy, \.ft__shot\) \{ transform: translate3d\(0, var\(--ft-rise\), 0\); transition: transform 0s linear var\(--ft-out\); \}/);
  assert.match(css, /\.ft-story\[data-pinned='true'\] \.ft__slide\[data-active='true'\] :is\(\.ft__copy, \.ft__shot\) \{ transform: none; transition: transform var\(--ft-in\) var\(--mm-ease-out, ease-out\) var\(--ft-in-delay\); \}/);
  assert.doesNotMatch(css, /\.ft__slide \{[^}]*transition: opacity var\(--mm-dur-card/, 'no symmetric crossfade');
  assert.doesNotMatch(css, /scale\(0\.97\)/);
  // Reduced motion: no move, no overlap.
  assert.match(css, /\.ft-story\[data-reduced='true'\] \.ft__slide \{ transition: opacity 0s linear, visibility 0s linear; \}/);

  const kit = read('../../app/motion-kit.css');
  const out = token(kit, '--mm-ease-exit');
  const inn = token(kit, '--mm-ease-glide');
  let first = null; let last = null; let maxMin = 0;
  for (let t = 0; t <= 320; t += 0.5) {
    const o = t >= 120 ? 0 : 1 - out(t / 120);
    const i = t < 90 ? 0 : t >= 290 ? 1 : inn((t - 90) / 200);
    if (o > GATE.visible && i > GATE.visible) { first ??= t; last = t; maxMin = Math.max(maxMin, Math.min(o, i)); }
  }
  assert.ok(last - first < GATE.overlapMs, `overlap ${last - first} ms`);
  assert.ok(maxMin < GATE.overlapOpacity, `the fainter tool peaks at ${maxMin.toFixed(3)}`);
});

// ---------------------------------------------------------------- the source
test('no render-phase setState and no settle timer: the demo is { epoch, value }, played only on stage', () => {
  const screens = strip(read('./TourScreens.jsx'));
  const hook = screens.slice(screens.indexOf('function useSequence'), screens.indexOf('function useSteps'));
  assert.doesNotMatch(hook, /wasActive|setTimeout/);
  assert.match(hook, /const \[state, setState\] = useState\(\(\) => firstState\(\{ active, reduced, paused, epoch, first, settled \}\)\);/);
  assert.match(hook, /if \(!active \|\| reduced\) return undefined;\s*const playback = createDemoPlayback\(events, \(value\) => setState\(\{ epoch, value \}\)\);/);
  assert.match(hook, /\}, \[active, reduced, events, epoch\]\);/);
  assert.match(hook, /\}, \[play, active, reduced, epoch\]\);/, 'a playback made for a new epoch is resumed in the same commit');
  assert.match(screens, /export const DemoPlaybackContext = createContext\(\{ active: false, reduced: false, paused: false, epoch: 0, held: false \}\);/);
});

test('ScrollStory carries a step count in the same transition as the step; the tour hands it to the screen on stage', () => {
  const story = strip(read('./ScrollStory.jsx'));
  assert.match(story, /const \[shown, setShown\] = useState\(\{ step: 0, seq: 0 \}\);/);
  assert.match(story, /seqRef\.current \+= 1;\s*const change = \{ step: next, seq: seqRef\.current \};/);
  assert.match(story, /startTransition\(\(\) => setShown\(change\)\);/);
  assert.match(story, /const api = useMemo\(\(\) => \(\{ step, seq, pinned, reduced, live, goTo, steps \}\)/);
  const tour = strip(read('./FeatureTour.jsx'));
  assert.match(tour, /function TourStage\(\{ slides, step, seq = 0, pinned, reduced, goTo: storyGoTo \}\)/);
  assert.match(tour, /epoch=\{on \? \(pinned \? seq : visit\) : -1\} held=\{pinned\}/);
  assert.match(tour, /key=\{pinned \|\| !on \? 'still' : visit\}/, 'screens stay mounted while held (LK81)');
});

test('the rail icons load eagerly at low priority; the chip row moves the next frame from cached places', () => {
  const tour = strip(read('./FeatureTour.jsx'));
  assert.match(tour, /<BrandIcon name=\{name\} size=\{RAIL_ICON\} loading="eager" fetchPriority="low" \/>/);
  assert.match(tour, /src="\/brand\/mascot\/ask-deskbell\.webp"[^>]*loading="eager" fetchPriority="low"/);
  assert.doesNotMatch(tour, /loading="lazy"/);
  const icon = strip(read('../brand/BrandIcon.jsx'));
  assert.match(icon, /export function BrandIcon\(\{ name, size = 40, label, className = '', style, loading = 'lazy', fetchPriority \}\)/, 'lazy stays the default elsewhere');
  assert.match(icon, /loading=\{loading\} fetchPriority=\{fetchPriority\}/);
  // No layout read on a step: the old effect read offsetLeft and scrollWidth right after the commit.
  assert.doesNotMatch(tour, /querySelector\('\[data-chapter="' \+ active/);
  assert.match(tour, /useLayoutEffect\(\(\) => \{\s*const frame = requestAnimationFrame\(\(\) => \{\s*const nav = navRef\.current;\s*const chips = chipsRef\.current \?\? measureChips\(\);/);
  assert.match(tour, /const observer = new ResizeObserver\(read\);\s*observer\.observe\(nav\);\s*nav\.querySelectorAll\('\[data-chapter\]'\)\.forEach\(\(item\) => observer\.observe\(item\)\);/);
});

// ---------------------------------------------------------------- part 2: the real gate
const live = process.env.MM_TOUR_GATE === '1' && benchAvailable();
test('real Chrome: data-ts-step climbs from 0 on every activation; overlap under 30 ms below 0.25 (390 touch, 1440 wheel, 1x and 4x)', { skip: !live && 'set MM_TOUR_GATE=1 with a running server' }, async () => {
  const runs = await runTourGateAll(process.env.TOUR_GATE_URL || 'http://localhost:3584/', { log: () => {} });
  for (const run of runs) {
    assert.ok(run.movesOk, `${run.width} ${run.cpu}x: a gesture did not move exactly one step`);
    assert.ok(run.ok, `${run.width} ${run.cpu}x: ${run.fails.join('; ')}`);
  }
});
