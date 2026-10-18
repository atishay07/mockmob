// Pass 1016e, packet WP-A: page transitions, count-ups, the stagger and the swipe release.
// Run: node --test src/lib/motion/motion-pass-1016e.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VT, logicalPath, navigationTypesFor, transitionTypesFor } from './placeTransition.js';
import { COUNT_UP_MIN_MS, planCountUp } from './countUpPlan.js';
import { SWIPE_RELEASE, removalCurve, swipeReleaseFrames } from './swipeRelease.js';
import { durations, springs } from './tokens.g.js';

const css = readFileSync(new URL('../../app/motion-kit.css', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('transitionTypesFor: places fade through by dock order, drill-ins push and pop, results rise', () => {
  assert.deepEqual(transitionTypesFor('/today', '/dashboard'), [VT.placeFwd]);
  assert.deepEqual(transitionTypesFor('/dashboard', '/today'), [VT.placeBack]);
  assert.deepEqual(transitionTypesFor('/review', '/profile'), [VT.placeFwd]);
  assert.deepEqual(transitionTypesFor('/review', '/review/revise'), [VT.push]);
  assert.deepEqual(transitionTypesFor('/review/revise', '/review'), [VT.pop]);
  assert.deepEqual(transitionTypesFor('/dashboard', '/result/abc'), [VT.rise]);
  assert.deepEqual(transitionTypesFor('/result/abc', '/dashboard'), [VT.riseBack]);
  assert.deepEqual(transitionTypesFor('/pricing', '/saved'), [VT.fade]);
  assert.deepEqual(transitionTypesFor('/dashboard', '/dashboard?subject=economics'), [], 'same page, new filter: no transition');
});

test('the NTA runner never animates, into it, out of it or inside it', () => {
  for (const [a, b] of [['/today', '/test/x'], ['/test/x', '/result/x'], ['/test/x', '/test/x?q=4'], ['/dashboard', '/test']]) {
    assert.deepEqual(transitionTypesFor(a, b), [], `${a} to ${b}`);
    assert.deepEqual(navigationTypesFor(`https://mockmob.in${a}`, `https://mockmob.in${b}`), [], `full URLs ${a} to ${b}`);
  }
  assert.deepEqual(navigationTypesFor('/preview/arena?view=dashboard', '/preview/arena?view=test'), []);
});

test('navigationTypesFor reads full URLs, and the preview views as the routes they draw', () => {
  assert.deepEqual(navigationTypesFor('http://localhost:3181/today', 'http://localhost:3181/dashboard#x'), [VT.placeFwd]);
  assert.equal(logicalPath('/preview/arena?view=revise&plan=free'), '/review/revise');
  assert.equal(logicalPath('/preview/arena?plan=free'), '/dashboard');
  assert.equal(logicalPath('/preview/arena?view=ranks'), '/leaderboard');
  assert.deepEqual(navigationTypesFor('/preview/arena?view=review', '/preview/arena?view=revise'), [VT.push]);
  assert.deepEqual(navigationTypesFor('/preview/arena?view=revise', '/preview/arena?view=review'), [VT.pop]);
  assert.deepEqual(navigationTypesFor('/preview/arena?view=dashboard', '/preview/arena?view=result'), [VT.rise]);
});

test('the arena frame holds still, and the leaving page is gone before the new one lands (see-through pages)', () => {
  for (const name of ['mm-frame-top', 'mm-frame-dock', 'mm-frame-side']) {
    assert.match(css, new RegExp(`view-transition-name: ${name};`));
  }
  assert.match(css, /:root:active-view-transition-type\(mm-place-fwd, mm-place-back, mm-push, mm-pop, mm-rise, mm-rise-back, mm-fade\) \.arena-dock/);
  assert.match(css, /::view-transition-old\(\.mm-fade\) \{ transform: translateY\(var\(--mm-vt-from-y, 0px\)\); \}/);
  assert.match(css, /::view-transition-old\(\.mm-fade\) \{ animation: mm-vt-fade-out /);
});

test('count-up: 720 ms on the countUp token (the app value, restored 19 Oct, owner G31), and an unchanged value never rolls', () => {
  assert.equal(durations.countUp, 720);
  assert.deepEqual(planCountUp({ value: 128, first: true, from: 0 }), { origin: 0, target: 128, span: 720, roll: true }, 'first ever view climbs from 0 in 720 ms');
  assert.equal(planCountUp({ value: 128, first: true }).roll, false, 'no from: shown as it is');
  assert.deepEqual(planCountUp({ value: 128, first: true, from: 0, remembered: 128 }), { origin: 128, target: 128, span: 720, roll: false }, 'remembered and unchanged: no roll, not from 0');
  assert.deepEqual(planCountUp({ value: 140, first: true, from: 0, remembered: 128 }), { origin: 128, target: 140, span: 720, roll: true }, 'remembered and changed: rolls from the old figure');
  assert.equal(planCountUp({ value: 140, first: false, shown: 140 }).roll, false);
  assert.equal(planCountUp({ value: 140, first: true, from: 0, reduced: true }).roll, false, 'reduced motion: the value at once');
  assert.equal(planCountUp({ value: 140, first: true, from: 0, duration: 20 }).span, COUNT_UP_MIN_MS);
  assert.equal(planCountUp({ value: 'n/a', first: true, from: 0 }).roll, false);
});

test('count-up callers take the token, and the roll is on the emphasized curve', () => {
  for (const file of ['../../components/ai/RecordGlimpse.jsx', '../../components/ai/RecordView.jsx', '../../components/profile/YourSheet.jsx', '../../components/ui/number-ticker.jsx']) {
    const src = readFileSync(new URL(file, import.meta.url), 'utf8');
    assert.doesNotMatch(src, /duration: ?(7|8|9|1[0-9])\d\d\b/, file);
  }
  const hook = readFileSync(new URL('./useCountUp.js', import.meta.url), 'utf8');
  assert.match(hook, /cubicAt\(curves\.emphasized, t\)/, 'the roll is on the emphasized curve again (deploy/1015-night)');
});

test('a committed swipe keeps its speed on the lift spring and leaves within the app leave', () => {
  assert.equal(SWIPE_RELEASE.spring, springs.lift);
  assert.equal(springs.lift.ms, 300);
  assert.equal(springs.lift.bounce, 0);
  const slow = swipeReleaseFrames({ dx: -80, velocity: 0, width: 360, dir: 'left' });
  const fast = swipeReleaseFrames({ dx: -80, velocity: -1800, width: 360, dir: 'left' });
  assert.ok(fast.duration < slow.duration, `a fling leaves sooner (${fast.duration} < ${slow.duration})`);
  assert.ok(slow.duration <= SWIPE_RELEASE.maxMs + 17);
  for (const run of [slow, fast]) {
    const xs = run.frames.map((f) => f.x);
    assert.equal(xs[0], -80, 'starts where the finger let go');
    for (let i = 1; i < xs.length; i++) assert.ok(xs[i] <= xs[i - 1], 'never comes back');
    assert.equal(run.frames[run.frames.length - 1].opacity, 0);
  }
  // No hang: the first frame after release already moves (an ease-in would barely move).
  assert.ok(slow.frames[1].x < -80 - 1.5, `moves at once (${slow.frames[1].x})`);
  assert.ok(fast.frames[1].x - fast.frames[0].x <= -20, 'the fling carries its speed');
  // A release that moved back the other way starts from rest, still toward the committed side.
  const back = swipeReleaseFrames({ dx: 90, velocity: -400, width: 300, dir: 'right' });
  assert.ok(back.frames[1].x > 90);
  assert.deepEqual(removalCurve({ gesture: true }), { kind: 'spring', spring: springs.lift });
  assert.deepEqual(removalCurve({ gesture: false }), { kind: 'ease-out', duration: 200 });
  assert.doesNotMatch(css, /\.mk-swipe\[data-swipe='commit'\][^}]*ease-leave/, 'no ease-in commit');
});

test('the stagger: every child rises 45 ms after the one before, capped at the eighth (restored 19 Oct, owner G31)', () => {
  assert.match(css, /\.mk-stagger > \* \{ animation: mk-rise var\(--mm-dur-enter\) var\(--mm-ease-emphasized\) calc\(min\(var\(--i, 0\), var\(--mm-stagger-cap\)\) \* var\(--mm-dur-stagger-step\)\) backwards; \}/);
  assert.match(css, /\.mk-stagger > :nth-child\(2\) \{ --i: 1; \}/);
  assert.match(css, /\.mk-stagger > :nth-child\(n\+9\) \{ --i: 8; \}/);
  assert.match(css, /\.mk-stagger--flat > :nth-child\(n\) \{ animation: mk-fade /);
});

test('no entrance grows from a point (scale under 0.6) in the arena CSS this packet owns', () => {
  const files = ['../../app/(app)/student-pages.css', '../../app/(app)/dashboard/practice.css', '../../app/onboarding/onboarding.css', '../../app/brand.css', '../../components/du/du.css', '../../components/ai/prepos.css'];
  for (const file of files) {
    const src = readFileSync(new URL(file, import.meta.url), 'utf8');
    assert.doesNotMatch(src, /scale\((0|0\.[0-5])\)/, file);
  }
});
