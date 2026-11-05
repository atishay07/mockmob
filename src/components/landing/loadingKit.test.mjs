// The home page's loading-motion kit (R3-D10, owner LK112, 5 Nov 2026; research preparoo B8): count-up on true numbers once
// at 40% in view, rows that arrive in turn. Pure rules and source checks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COUNT_UP, STAGGER, countAt, countPlan, easeOutQuart, formatCount, staggerDelay } from './loadingRules.mjs';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const KIT = read('LoadingKit.jsx');
const CSS = strip(read('loading-kit.css'));

test('the count-up runs 1,900 ms on an ease-out quart and starts at 40% in view', () => {
  assert.deepEqual({ ...COUNT_UP }, { ms: 1900, share: 0.4, below: 96 });
  assert.equal(easeOutQuart(0), 0);
  assert.equal(easeOutQuart(1), 1);
  assert.equal(easeOutQuart(0.5), 1 - 0.5 ** 4);
  assert.ok(easeOutQuart(0.25) > 0.6, 'fast at first');
  assert.equal(easeOutQuart(-1), 0);
  assert.equal(easeOutQuart(2), 1);
});

test('countAt climbs from 0 to the true value and lands on it exactly, whole numbers or fixed decimals', () => {
  assert.equal(countAt(0, { to: 16020 }), 0);
  assert.equal(countAt(1900, { to: 16020 }), 16020);
  assert.equal(countAt(5000, { to: 16020 }), 16020);
  const mid = countAt(950, { to: 16020 });
  assert.ok(Number.isInteger(mid) && mid > 8000 && mid < 16020, `${mid}`);
  let last = -1;
  for (let t = 0; t <= 1900; t += 100) { const v = countAt(t, { to: 16020 }); assert.ok(v >= last); last = v; }
  assert.equal(countAt(1900, { to: 3.3, decimals: 2 }), 3.3);
  assert.equal(countAt(950, { to: 3.3, decimals: 2 }), Math.round(3.3 * easeOutQuart(0.5) * 100) / 100);
  assert.equal(countAt(100, { to: 'n/a' }), 'n/a', 'not a number: shown as it is');
  assert.equal(countAt(10, { to: 50, ms: 0 }), 50);
});

test('countPlan: a number already 40% in view, a non-number or reduced motion stays as printed; one below the fold arms the roll', () => {
  assert.equal(countPlan({ value: 16020, ratio: 0 }), 'arm');
  assert.equal(countPlan({ value: 16020, ratio: 0.39 }), 'arm');
  assert.equal(countPlan({ value: 16020, ratio: 0.4 }), 'show');
  assert.equal(countPlan({ value: 16020, ratio: 1 }), 'show');
  assert.equal(countPlan({ value: 16020, ratio: 0, reduced: true }), 'show');
  assert.equal(countPlan({ value: 'many', ratio: 0 }), 'show');
});

test('numbers print in Indian grouping, with fixed decimals when asked', () => {
  assert.equal(formatCount(16020), '16,020');
  assert.equal(formatCount(123456), '1,23,456');
  assert.equal(formatCount(3.3, { decimals: 2 }), '3.30');
  assert.equal(formatCount(14), '14');
  assert.equal(formatCount('n/a'), 'n/a');
});

test('the printed value is the server\'s and the first paint\'s: the roll is a copy React does not own, over a transparent value', () => {
  assert.match(KIT, /<span className="lk-count__value">\{printed\}<\/span>\s*<span ref=\{live\} className="lk-count__live" aria-hidden="true" \/>/);
  assert.match(CSS, /\.lk-count \{[^}]*font-variant-numeric: tabular-nums;/, 'the width never jumps');
  assert.match(CSS, /\.lk-count\[data-lk='rolling'\] \.lk-count__value \{ color: transparent; \}/, 'only transparent during the roll, so the true value stays in the accessibility tree');
  assert.doesNotMatch(KIT, /write\(0\)|dataset\.lk = 'armed'/, 'never rest on zero while waiting for the roll');
  assert.match(KIT, /new IntersectionObserver\(/);
  assert.match(KIT, /\{ threshold: \[0, share\], rootMargin: `0px 0px -\$\{COUNT_UP\.below\}px 0px` \}/, 'in view means above the phone dock');
  assert.match(KIT, /watch\.disconnect\(\);\s*roll\(\);/, 'it rolls once, then stops watching');
  assert.doesNotMatch(KIT, /addEventListener\(\s*['"]scroll/, 'no scroll listener');
  assert.match(KIT, /isMotionReduced\(\)/, 'reduced motion (device or the site switch) prints the value');
});

test('rows arrive 70 ms apart, each rising 6 px over 160 ms; keyframes move opacity and transform only', () => {
  assert.deepEqual({ ...STAGGER }, { step: 70, ms: 160, rise: 6 });
  assert.equal(staggerDelay(0), 0);
  assert.equal(staggerDelay(3), 210);
  assert.equal(staggerDelay(-2), 0);
  assert.match(CSS, /\.lk-stagger > \* \{ animation: lk-row-in 160ms cubic-bezier\(0\.23, 1, 0\.32, 1\) var\(--lk-delay, 0ms\) both; \}/);
  assert.match(CSS, /@keyframes lk-row-in \{ from \{ opacity: 0; transform: translateY\(6px\); \} \}/);
  for (const [, body] of CSS.matchAll(/@keyframes [\w-]+ \{((?:[^{}]|\{[^{}]*\})*)\}/g)) {
    assert.doesNotMatch(body, /\b(width|height|top|left|margin|padding)\s*:/, 'no layout in a keyframe');
  }
});
