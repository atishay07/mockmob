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
    assert.ok(DRAW_MS[mark] >= 280 && DRAW_MS[mark] <= 700, `${mark} is drawn in a pen's time`);
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
  assert.match(jsx, /rootMargin: '0px 0px -20% 0px', threshold: 0\.9/, 'well clear of the screen\'s foot');
  assert.match(jsx, /seen\.unobserve\(entry\.target\);/, 'once');
  assert.match(jsx, /const on = \(controlled \? when : drawn\) && primed;/, 'never before its undrawn state was on screen');
  assert.match(jsx, /aria-hidden="true" focusable="false"/, 'the mark is decoration: the words are the content');
  const css = read('./doodle.css');
  assert.match(css, /stroke-dashoffset: var\(--dd-len, 0\)/);
  assert.match(css, /cubic-bezier\(0\.23, 1, 0\.32, 1\)/);
  assert.doesNotMatch(css, /infinite|transition:\s*all/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /html\[data-motion='reduced'\]/);
});

// 18 Nov 2026 (owner LK314, "Some can be more animated"): the pen in view and the accent.
test('a mark made with the pen in view is slower, and an accent is a quick flick', async () => {
  const { PEN_PACE, SPARK_MS, DRAW_MS } = await import('./doodlePaths.mjs');
  assert.ok(PEN_PACE > 1.2 && PEN_PACE <= 2, 'a hand, not a flash and not a wait');
  assert.ok(Math.max(...Object.values(DRAW_MS)) * PEN_PACE <= 1000, 'no pen-made mark takes over a second');
  assert.ok(SPARK_MS >= 80 && SPARK_MS <= 200);
});

test('the pen: only where motion paths exist, never under reduced motion, and one stroke at a time', async () => {
  const { readFileSync } = await import('node:fs');
  const jsx = readFileSync(new URL('./Doodle.jsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('./doodle.css', import.meta.url), 'utf8');
  assert.match(jsx, /data-pen=\{pen \|\| undefined\}/);
  assert.match(jsx, /offsetPath: `path\("\$\{d\}"\)`/, 'the pencil rides the very stroke it makes');
  assert.match(jsx, /className="dd__nib" aria-hidden="true"/, 'the pencil is decoration');
  assert.match(jsx, /<svg className="dd__tool" width="1" height="1"/, 'a zero-sized svg is not painted at all');
  assert.match(css, /@supports \(offset-path: path\('M0 0L1 1'\)\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{ \.dd__nib \{ display: none; \} \}/);
  assert.match(css, /html\[data-motion='reduced'\] \.dd__nib \{ display: none; \}/);
  assert.doesNotMatch(css, /dd-nib-[a-z]+[^;]*infinite/, 'the pen never loops');
  // Night: a highlighter's words turn where the swipe has reached.
  assert.match(jsx, /className="dd__over" aria-hidden="true"/);
  assert.match(css, /html\[data-theme='light'\] \.dd__over \{ display: none; \}/);
});
