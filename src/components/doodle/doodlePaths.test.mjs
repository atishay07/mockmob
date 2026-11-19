// The pen's strokes (18 Nov 2026, owner LK308): every mark is made for its words' own box, the same way every time.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DRAW_MS, MARKS, doodlePath, penWidth, seedOf, seeded, through } from './doodlePaths.mjs';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const BOX = { width: 160, height: 36, fontSize: 30 };
const numbers = (d) => (d.match(/-?\d+(\.\d+)?/g) || []).map(Number);

test('one phrase always gets the same stroke; two phrases never share one', () => {
  const a = doodlePath('circle', { ...BOX, seed: seedOf('circle:on time.') });
  const b = doodlePath('circle', { ...BOX, seed: seedOf('circle:on time.') });
  const c = doodlePath('circle', { ...BOX, seed: seedOf('circle:open to you?') });
  assert.deepEqual(a, b);
  assert.notEqual(a.strokes[0], c.strokes[0]);
  const r = seeded(7);
  const run = [r(), r(), r()];
  const again = seeded(7);
  assert.deepEqual(run, [again(), again(), again()]);
  for (const v of run) assert.ok(v >= 0 && v < 1);
});

test('every mark is a real path for a real box, and nothing for an empty one', () => {
  for (const mark of Object.keys(MARKS)) {
    const shape = doodlePath(mark, { ...BOX, seed: 11 });
    const paths = shape.fill ? [shape.fill] : shape.strokes;
    assert.ok(paths.length >= 1, mark);
    for (const d of paths) {
      assert.match(d, /^M-?\d/, `${mark} starts with a move`);
      for (const n of numbers(d)) assert.ok(Number.isFinite(n), `${mark} has only finite numbers`);
    }
    assert.ok(DRAW_MS[mark] >= 280 && DRAW_MS[mark] <= 1100, `${mark} is drawn in a hand's time (owner LK317: a bit slower)`);
  }
  assert.deepEqual(doodlePath('circle', { width: 0, height: 36, fontSize: 30 }), { strokes: [], pen: 0 });
  assert.deepEqual(doodlePath('nothing', BOX), { strokes: [], pen: 0 });
});

test('a circle goes a little more than once round the words and stays near them', () => {
  const { strokes } = doodlePath('circle', { ...BOX, seed: 3 });
  const n = numbers(strokes[0]);
  const xs = n.filter((_, i) => i % 2 === 0);
  const ys = n.filter((_, i) => i % 2 === 1);
  assert.ok(Math.min(...xs) < 0 && Math.max(...xs) > BOX.width, 'it passes outside both ends of the words');
  assert.ok(Math.min(...xs) > -BOX.fontSize && Math.max(...xs) < BOX.width + BOX.fontSize, 'and never more than a letter away');
  assert.ok(Math.min(...ys) > -BOX.fontSize && Math.max(...ys) < BOX.height + BOX.fontSize);
});

test('an underline lies under the words, left to right; a double comes back shorter', () => {
  const one = numbers(doodlePath('underline', { ...BOX, seed: 5 }).strokes[0]);
  assert.ok(one[0] < 4 && one[one.length - 2] > BOX.width - 4, 'from the first letter to the last');
  for (let i = 1; i < one.length; i += 2) assert.ok(one[i] > BOX.height * 0.75 && one[i] < BOX.height + BOX.fontSize * 0.3);
  const two = doodlePath('double', { ...BOX, seed: 5 }).strokes;
  assert.equal(two.length, 2);
  const back = numbers(two[1]);
  assert.ok(back[0] > back[back.length - 2], 'the second stroke runs right to left');
  assert.ok(back[back.length - 2] > 10, 'and stops short of the start');
});

test('the highlighter is one closed swipe behind the words; the pen keeps a pen\'s width', () => {
  const { fill, strokes } = doodlePath('highlight', { ...BOX, seed: 9 });
  assert.equal(strokes, undefined);
  assert.match(fill, /Z$/);
  assert.equal(penWidth(8), 1.75);
  assert.equal(penWidth(200), 4.5);
  assert.ok(penWidth(34) > 1.75 && penWidth(34) < 2.2);
  assert.ok(doodlePath('tick', { width: 20, height: 20, fontSize: 16, seed: 1 }).pen >= 2.3, 'a tick in a small box is still a firm stroke');
  assert.equal(through([[0, 0]]), '');
});

test('the mark is drawn once, from its start, when the words are reached; reduced motion shows it still', () => {
  const jsx = read('./Doodle.jsx');
  // Wholly in view and clear of the window's foot: its lowest quarter under a finger; under a mouse more of it, and only once
  // the page has stopped (owner LK342, 19 Nov 2026: on a big screen the marks drew before he was looking).
  assert.match(jsx, /export const READ_BAND = Object\.freeze\(\{ touch: 25, fine: 38 \}\);/);
  assert.match(jsx, /rootMargin: `0px 0px -\$\{finePointer\(\) \? READ_BAND\.fine : READ_BAND\.touch\}% 0px`, threshold: 0\.9/);
  assert.match(jsx, /if \(!finePointer\(\)\) off = watchReading\(host, touchDown\);/, 'a touch screen keeps its timing');
  assert.match(jsx, /off = watchReading\(host, \(\) => \{ off = whenStill\(\(\) => \{ off = watchReading\(host, touchDown\); \}\); \}\);/, 'a mouse: reached, the page at rest, reached still');
  assert.match(jsx, /window\.addEventListener\('scroll', stamp, \{ passive: true \}\)/);
  assert.match(jsx, /if \(!waiters\) window\.removeEventListener\('scroll', stamp\);/, 'the scroll listener leaves with the last waiting mark');
  assert.match(jsx, /pathLength="1"/, 'a stroke is its own normalised length: nothing measures it');
  assert.match(jsx, /seen\.unobserve\(entry\.target\);/, 'once');
  assert.match(jsx, /const on = wanted && primed;/, 'never before its undrawn state was on screen');
  assert.match(jsx, /aria-hidden="true" focusable="false"/, 'the mark is decoration: the words are the content');
  const css = read('./doodle.css');
  assert.match(css, /stroke-dasharray: 1 1\.2; stroke-dashoffset: 1\.06;/, 'undrawn, the dash waits before the stroke starts: no dot from a round cap');
  assert.match(css, /--dd-ease: cubic-bezier\(0\.32, 0\.08, 0\.22, 1\)/, 'starts like a hand and settles');
  assert.doesNotMatch(css, /infinite|transition:\s*all/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /html\[data-motion='reduced'\]/);
});

// Owner, 19 Nov 2026 (LK317: "a bit slower, more refined and more accurate with when they are showing up in the scroll").
test('each mark takes a hand\'s time for what it is, and waits a beat for its words', async () => {
  const { DRAW_MS } = await import('./doodlePaths.mjs');
  assert.ok(DRAW_MS.circle >= 850 && DRAW_MS.circle <= 1100, 'a loop: about a second');
  assert.ok(DRAW_MS.underline >= 540 && DRAW_MS.underline <= 760, 'a line: about two thirds of one');
  assert.ok(DRAW_MS.highlight >= 600 && DRAW_MS.highlight <= 850);
  assert.ok(DRAW_MS.tick <= 420 && DRAW_MS.cross <= 500, 'a verdict on an answer just chosen still answers the tap');
  assert.ok(Math.max(...Object.values(DRAW_MS)) <= 1100, 'nothing drags');
  const jsx = read('./Doodle.jsx');
  assert.match(jsx, /export const TOUCH_DOWN_MS = 180;/);
  assert.match(jsx, /window\.setTimeout\(\(\) => setReached\(true\), TOUCH_DOWN_MS \+ delay\)/, 'a heading still arriving is not marked early');
});

// Owner, 19 Nov 2026 (LK326: the page stutters and scrolls at "40, 50 FPS"). Measured that day: every mark measured its words
// in a layout effect (offsetWidth, getComputedStyle, getTotalLength), each a forced layout of a 20,000 px page.
test('a mark never asks the browser to lay the page out: sizes and moments come from observers', () => {
  const jsx = read('./Doodle.jsx');
  const code = jsx.split('\n').filter((line) => !line.trim().startsWith('//')).join('\n');
  assert.doesNotMatch(code, /offsetWidth|offsetHeight|getTotalLength|useLayoutEffect/, 'no synchronous measuring');
  assert.equal((code.match(/getBoundingClientRect/g) || []).length, 1, 'only the fallback for a browser without ResizeObserver');
  assert.match(code, /new ResizeObserver\(/, 'one shared size observer');
  assert.match(code, /new IntersectionObserver\(/, 'one shared reading observer');
  assert.match(code, /if \(wantedRef\.current\) build\(\);/, 'a mark nobody has reached is never built');
  // Night: a highlighter's words turn where the swipe has reached, from generated content (one copy of the words in the page).
  assert.match(jsx, /className="dd__over" aria-hidden="true" data-text=\{text\} \/>/);
  const css = read('./doodle.css');
  assert.match(css, /\.dd__over::before \{ content: attr\(data-text\); \}/);
  assert.match(css, /html\[data-theme='light'\] \.dd__over \{ display: none; \}/);
});

// Owner, 18 Nov 2026 about 10 pm (LK317): the pencils and markers "looked highly unprofessional". They are gone from the
// component itself, and no page asks for one.
test('no drawing tool, flick or flourish: the mark is the stroke alone', async () => {
  const { readFileSync, readdirSync, statSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const jsx = read('./Doodle.jsx');
  const css = read('./doodle.css');
  assert.doesNotMatch(jsx, /Pencil|Marker\b|offsetPath|dd__nib|followScroll|\bpen = /, 'the component draws no tool');
  assert.doesNotMatch(css, /dd__nib|dd__tool|offset-path|spark/, 'the sheet styles no tool');
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const offenders = [];
  const flicked = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) { if (name !== 'doodle') walk(p); continue; }
      if (!/\.(jsx?|mjs)$/.test(name) || /\.test\./.test(name)) continue;
      const s = readFileSync(p, 'utf8');
      if (/\bpen: true\b|<Doodle[^>]*\spen[\s>]|followScroll/.test(s)) offenders.push(p);
      if (/accent="spark"|accent: 'spark'/.test(s)) flicked.push(p.replace(/\\/g, '/').split('/src/')[1]);
    }
  };
  walk(root);
  assert.deepEqual(offenders, []);
  // Owner, 19 Nov 2026 (LK342): the hero's price figure gets "that circle and three dots, how it had previously". The three
  // flicks are strokes, not a tool, and that one figure is the only place that asks for them.
  assert.deepEqual(flicked, ['components/landing/HeroBeatStrip.jsx']);
});
