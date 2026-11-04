// node --test src/components/landing/oneGesture.test.mjs
// LK69 (4 Nov 2026), L-027 ("each gesture advances exactly ONE slide"), L-028 (one slide per gesture, readable dwell), L-029.
// Replaces scrollStorySpeed.test.mjs, which locked the opposite (a story that never caught a gesture).
//
// Part 1 (always): the rules as plain functions, and the statement's clauses.
// Part 2 (opt-in, real Chrome): the gesture matrix against a running page. It needs the shared browser lock, a dev or start
// server and a real Chrome (never chrome-headless-shell: it does not scroll on synthetic input):
//   MM_ONE_GESTURE=1 node --test src/components/landing/oneGesture.test.mjs
//   MM_ONE_GESTURE=1 ONE_GESTURE_URL=http://localhost:3467/ ONE_GESTURE_STORIES=ft-story,lc,ml-story,lp-statement__story node --test ...
// What it asserts: 4 distances x 4 speeds on each story give exactly +1 step and land within 2 px of a resting place;
// slow drags of 120/150/300 px give +1; 20 px gives 0; forward 100 then back 100 gives 0; two flicks 150 ms apart give 1 step
// and 700 ms apart give 2; an entry flick stops on step 0; an exit flick leaves freely; no non-passive listener exists while
// no story is near; the document is as tall fresh as warm (within 2 px).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COMMIT_PX, FLICK_PX, FLICK_V, LEAN_MAX, LOCK_MS, LOCK_REDUCED_MS, SLOP, WHEEL_MIN_PX, WHEEL_QUIET_MS,
  claimTouch, commitDirection, insideHold, keyDirection, leanFor, lockMs, nearestStep, restY, velocity, wheelBurst, wheelPx,
} from './storyGesture.mjs';
import { STATEMENT_HOLD, STATEMENT_STEPS, statementWords } from './statementSteps.mjs';
import { benchAvailable, openBench, runMatrix } from './oneGestureBench.mjs';

// ---------------------------------------------------------------- part 1: the rules

test('a step is chosen from net travel only: 40 px, or a 12 px flick at 0.3 px/ms; speed never multiplies steps', () => {
  assert.equal(commitDirection(-40, 0), 1);
  assert.equal(commitDirection(-39, 0), 0);
  assert.equal(commitDirection(40, 0), -1);
  assert.equal(commitDirection(-12, -0.3), 1, 'a short flick up');
  assert.equal(commitDirection(-12, -0.29), 0);
  assert.equal(commitDirection(-12, 0.5), 0, 'a short move up that left the glass going down commits nothing');
  assert.equal(commitDirection(-20, 0), 0, 'a 20 px nudge');
  // however far or fast, one direction: the function has no way to answer 2
  for (const dy of [-60, -150, -600, -4000]) for (const v of [-0.4, -1.2, -3, -6, -30]) assert.equal(commitDirection(dy, v), 1);
  assert.deepEqual([COMMIT_PX, FLICK_PX, FLICK_V, SLOP, LEAN_MAX, LOCK_MS, LOCK_REDUCED_MS, WHEEL_QUIET_MS, WHEEL_MIN_PX], [40, 12, 0.3, 6, 28, 420, 120, 160, 12]);
});

test('release velocity is read over the last 80 ms', () => {
  const samples = [{ t: 0, y: 500 }, { t: 100, y: 450 }, { t: 160, y: 420 }, { t: 200, y: 400 }];
  assert.equal(velocity(samples), -0.5, '20 px in the last 40 ms of the 80 ms window, up the screen');
  assert.equal(velocity([{ t: 0, y: 1 }]), 0);
});

test('who owns a touch: a story\'s hold, vertical, with a step to take, outside the lock', () => {
  const base = { inStory: true, dx: 1, dy: -20, locked: false, canStep: true, scrollsInside: false };
  assert.equal(claimTouch(base), 'own');
  assert.equal(claimTouch({ ...base, inStory: false }), 'native', 'outside any hold the browser scrolls');
  assert.equal(claimTouch({ ...base, dx: 30, dy: -10 }), 'native', 'sideways: chips, reels');
  assert.equal(claimTouch({ ...base, scrollsInside: true }), 'native', 'an inner scroller');
  assert.equal(claimTouch({ ...base, canStep: false }), 'native', 'the way out of the story is free');
  assert.equal(claimTouch({ ...base, locked: true }), 'spent', 'a gesture inside the lock is swallowed, never queued');
  assert.equal(claimTouch({ ...base, locked: true, canStep: false }), 'spent');
});

test('the lock is 420 ms, 120 ms under reduced motion; the finger leans 25% to 28 px, and not at all when calm', () => {
  assert.equal(lockMs(false), 420);
  assert.equal(lockMs(true), 120);
  assert.equal(leanFor(-40), -10);
  assert.equal(leanFor(-400), -28);
  assert.equal(leanFor(400), 28);
  assert.equal(leanFor(-400, true), 0);
});

test('a wheel burst is notches or a trackpad tail: one burst after 160 ms of quiet or a change of direction', () => {
  let burst = wheelBurst(null, { t: 1000, dir: 1 });
  assert.equal(burst.fresh, true);
  burst = wheelBurst(burst, { t: 1040, dir: 1 });
  assert.equal(burst.fresh, false);
  for (let t = 1050; t < 2000; t += 15) burst = wheelBurst(burst, { t, dir: 1 });
  assert.equal(burst.fresh, false, 'a 900 ms inertia tail never starts a second burst');
  assert.equal(wheelBurst({ ...burst, last: 2000 }, { t: 2161, dir: 1 }).fresh, true, 'after 160 ms of quiet');
  assert.equal(wheelBurst({ ...burst, last: 2000 }, { t: 2010, dir: -1 }).fresh, true, 'turning back');
  assert.equal(wheelPx(100, 0), 100);
  assert.equal(wheelPx(-3, 1), 120, 'line mode counts 40 px a line');
  assert.equal(keyDirection('PageDown'), 1);
  assert.equal(keyDirection(' '), 1);
  assert.equal(keyDirection('ArrowUp'), -1);
  assert.equal(keyDirection('a'), 0);
});

test('resting places: the first at the start of the hold, the last at its end, the rest evenly between', () => {
  assert.equal(restY(1000, 3000, 4, 0), 1000);
  assert.equal(restY(1000, 3000, 4, 1), 2000);
  assert.equal(restY(1000, 3000, 4, 3), 4000);
  assert.equal(nearestStep(1000, 3000, 4, 2400), 1);
  assert.equal(nearestStep(1000, 3000, 4, 2600), 2);
  assert.equal(nearestStep(1000, 3000, 4, 100), 0);
  assert.equal(nearestStep(1000, 3000, 4, 9000), 3);
  assert.equal(insideHold(1000, 3000, 999), true, '2 px of slack');
  assert.equal(insideHold(1000, 3000, 990), false);
  assert.equal(insideHold(1000, 3000, 4002), true);
});

test('the statement is four clauses, one per step, and its words keep their accent', () => {
  assert.equal(STATEMENT_STEPS, 4);
  const text = 'Your marks slipped somewhere. MockMob shows you *where, picks the chapter for *tonight, and keeps your DU *shortlist in sight.';
  const words = statementWords(text);
  assert.equal(words.length, 20);
  assert.equal(words.map((w) => w.text).join(' '), text.replaceAll('*', ''), 'same words, same order');
  assert.deepEqual([...new Set(words.map((w) => w.clause))], [0, 1, 2, 3]);
  assert.deepEqual(words.filter((w) => w.clause === 0).map((w) => w.text), ['Your', 'marks', 'slipped', 'somewhere.']);
  assert.deepEqual(words.filter((w) => w.clause === 1).map((w) => w.text), ['MockMob', 'shows', 'you', 'where,']);
  assert.deepEqual(words.filter((w) => w.clause === 3).map((w) => w.text), ['and', 'keeps', 'your', 'DU', 'shortlist', 'in', 'sight.']);
  assert.deepEqual(words.filter((w) => w.accent).map((w) => w.text), ['where,', 'tonight,', 'shortlist']);
  assert.deepEqual(words.filter((w) => w.clause === 2).map((w) => w.offset), [0, 1, 2, 3, 4], 'the place within the clause staggers the fade');
  // Whatever the copy becomes, it is always exactly four steps.
  for (const copy of ['One. Two. Three. Four. Five. Six.', 'A short line with no break at all in it today', 'Only two, clauses.']) {
    const w = statementWords(copy);
    assert.equal(new Set(w.map((x) => x.clause)).size, Math.min(4, w.length), copy);
    assert.deepEqual(w.map((x) => x.clause), [...w.map((x) => x.clause)].sort((a, b) => a - b), 'clauses run in order');
  }
});

test('the statement is held only where the scene fits, and hero-depth.css repeats the same two ranges', async () => {
  const { readFileSync } = await import('node:fs');
  const css = readFileSync(new URL('../../app/hero-depth.css', import.meta.url), 'utf8');
  assert.equal(STATEMENT_HOLD, '(max-width: 760px) and (min-height: 700px), (min-width: 761px) and (max-width: 959px) and (min-height: 780px)');
  assert.match(css, /@media \(max-width: 760px\) and \(min-height: 700px\) and \(prefers-reduced-motion: no-preference\), \(min-width: 761px\) and \(max-width: 959px\) and \(min-height: 780px\) and \(prefers-reduced-motion: no-preference\) \{/);
  assert.match(css, /--ss-beat: 22svh;/);
  assert.match(css, /opacity: clamp\(0\.18, calc\(var\(--ss-step, 0\) - var\(--ph, 0\) \+ 1\), 1\);/, 'words follow the step, not the scroll');
  assert.match(css, /\[data-step='3'\] \.lp-shelf \.subj-obj--alive \.subj-obj__float/, 'the objects arrive on the last step');
  assert.doesNotMatch(css.slice(css.indexOf('Phones: the statement is a 4-step')), /animation-timeline: --lp-statement/, 'no scroll timeline in the held story');
  // Wide windows: every word is lit by the time the section is half way up the window.
  assert.match(css, /animation-range-start: cover calc\(12% \+ var\(--p\) \* 26%\);/);
  assert.match(css, /animation-range-end: cover calc\(18% \+ var\(--p\) \* 26%\);/);
});

// ---------------------------------------------------------------- part 2: real Chrome (opt-in)

const URL_UNDER_TEST = process.env.ONE_GESTURE_URL || 'http://localhost:3467/';
const RUN = process.env.MM_ONE_GESTURE === '1' && benchAvailable();
const why = process.env.MM_ONE_GESTURE === '1' ? 'no real Chrome on this machine' : 'set MM_ONE_GESTURE=1 to run the matrix in real Chrome';

test('the gesture matrix in real Chrome: every cell is one step on a resting place', { skip: RUN ? false : why, timeout: 3_600_000 }, async () => {
  const bench = await openBench({ url: URL_UNDER_TEST, label: 'oneGesture.test matrix' });
  try {
    const failures = [];
    for (const name of (process.env.ONE_GESTURE_STORIES || 'ft-story,lc').split(',')) {
      const rows = await runMatrix(bench, name, { log: (line) => console.log(line) });
      for (const row of rows) if (!row.ok) failures.push(`${name} ${row.id}: step ${row.start}->${row.step}, y ${row.y}, off ${row.off}`);
      assert.ok(rows.length >= 30, `${name} ran ${rows.length} cells`);
    }
    assert.deepEqual(failures, []);
    assert.deepEqual(bench.errors.filter((e) => /pageerror/.test(e)), [], 'no page errors');
  } finally { await bench.close(); }
});

test('far from every story there is no listener that can cancel a scroll', { skip: RUN ? false : why, timeout: 600_000 }, async () => {
  const bench = await openBench({ url: URL_UNDER_TEST, label: 'oneGesture.test listeners' });
  try {
    await bench.jump(0);
    assert.deepEqual(await bench.nonPassive(), [], 'at the top of the page');
    const stories = await bench.stories();
    const first = stories[0];
    await bench.jump(first.top + first.hold / 2);
    assert.deepEqual([...new Set(await bench.nonPassive())].sort(), ['touchmove', 'wheel'], 'inside a story: exactly the two the controller owns');
    const last = stories[stories.length - 1];
    await bench.jump(last.top + last.hold + bench.height * 3);
    assert.deepEqual(await bench.nonPassive(), [], 'more than a screen after the last story');
  } finally { await bench.close(); }
});

for (const [width, height] of [[390, 844], [1440, 900]]) {
  test(`the page is as tall fresh as warm, within 2 px (${width}x${height})`, { skip: RUN ? false : why, timeout: 600_000 }, async () => {
    const bench = await openBench({ url: URL_UNDER_TEST, width, height, touch: width < 900, label: `oneGesture.test height ${width}` });
    try {
      const fresh = await bench.documentHeight();
      for (let y = 0; y < fresh + 2000; y += Math.round(height * 0.6)) {
        await bench.page.evaluate((v) => window.scrollTo({ top: v, behavior: 'instant' }), y);
        await new Promise((resolve) => setTimeout(resolve, 160));
      }
      await bench.page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await new Promise((resolve) => setTimeout(resolve, 1200));
      const warm = await bench.documentHeight();
      assert.ok(Math.abs(warm - fresh) <= 2, `fresh ${fresh}, warm ${warm}: every content-visibility section reserves the height it will really have`);
    } finally { await bench.close(); }
  });
}
