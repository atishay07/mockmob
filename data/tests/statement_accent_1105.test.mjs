// Night refinement 5 Nov 2026, packet P2, decision D4 (owner LK86): the statement's green words come back.
// The words marked * in homeCopy STATEMENT are drawn in the brand green again, true volt #D2F000 in Night and a deep olive
// that passes AA on the Day paper, every other word in ink. As each clause comes in (the phone's held story step, or the
// wide window's scrub) its accent word arrives dim in ink like the rest and then lights up green: colour on the letters,
// never a highlighter, a glow or a wash. This reverses the 4 Nov "accent is weight, not colour" rule (packet P1, 1104) for
// the statement only; everywhere else volt stays a fill (night_calm_1104.test.mjs still holds for the other text).
//   node --test data/tests/statement_accent_1105.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { STATEMENT } from '../../src/components/landing/homeCopy.mjs';
import { STATEMENT_STEPS, statementWords } from '../../src/components/landing/statementSteps.mjs';

const root = new URL('../../', import.meta.url);
const read = (rel) => readFileSync(new URL(rel, root), 'utf8').replace(/\r\n/g, '\n');
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const CSS = strip(read('src/app/hero-depth.css'));
const THEME = strip(read('src/app/marketing-theme.css'));
const JSX = read('src/components/landing/Statement.jsx');

const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a, b) => { const x = lum(a); const y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const token = (block, name) => (block.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i')) || [])[1];
const nightPaper = token(THEME.slice(THEME.indexOf("html[data-theme='dark'] .mm {")), 'paper');
const dayPaper = token(THEME.slice(THEME.indexOf("html[data-theme='light'] .mm {")), 'paper');

test('the three accent words are "where", "tonight" and "shortlist", one in each clause after the first', () => {
  const words = statementWords(STATEMENT);
  assert.deepEqual(words.filter((w) => w.accent).map((w) => w.text), ['where,', 'tonight,', 'shortlist']);
  assert.deepEqual(words.filter((w) => w.accent).map((w) => w.clause), [1, 2, 3]);
  assert.equal(STATEMENT_STEPS, 4);
});

test('Night draws them in true volt #D2F000, Day in a deep olive that holds AA on the paper; both from one statement-only token', () => {
  assert.match(CSS, /\.mm\.lp \.lp-statement \{ --statement-accent: #d2f000; \}/);
  assert.match(CSS, /html\[data-theme='light'\] \.mm\.lp \.lp-statement \{ --statement-accent: #3f5200; \}/);
  assert.equal(nightPaper, '#12110e');
  assert.equal(dayPaper, '#f3efe6');
  assert.ok(contrast('#d2f000', nightPaper) >= 7, `volt on the Night paper ${contrast('#d2f000', nightPaper).toFixed(2)}`);
  assert.ok(contrast('#3f5200', dayPaper) >= 4.5, `olive on the Day paper ${contrast('#3f5200', dayPaper).toFixed(2)} (AA)`);
  // The token belongs to the statement: no other stylesheet reads it, so no other text can turn volt through it.
  for (const file of readdirSync(new URL('src/app/', root)).filter((f) => f.endsWith('.css') && f !== 'hero-depth.css')) {
    assert.doesNotMatch(read(`src/app/${file}`), /--statement-accent/, `${file} leaves the statement's token alone`);
  }
});

test('the accent is colour on the letters, not weight, a highlighter or a glow (the 4 Nov weight rule is gone)', () => {
  const rule = CSS.match(/\.lp-statement__w\[data-accent\] \{([^}]*)\}/)[1];
  assert.match(rule, /color: var\(--statement-accent, var\(--ink\)\);/);
  assert.doesNotMatch(rule, /font-weight/, 'the accent keeps the statement\'s own weight');
  assert.doesNotMatch(CSS, /\.lp-statement__w\[data-accent\][^{]*\{[^}]*(background|box-shadow|text-shadow|filter)/, 'no highlighter, no glow');
  // Its comma stays ink: the green lands on the word alone.
  assert.match(JSX, /<span className="lp-statement__mark">\{mark\}<\/span>/);
  assert.match(CSS, /\.lp-statement__mark \{ color: var\(--ink\); \}/);
});

test('phone held story: an accent word is ink and dim until its clause is lit, then warms to green 200 ms after its own fade', () => {
  assert.match(CSS, /\.ss\[data-pinned='true'\] \.lp-statement__w\[data-accent\] \{\s*color: var\(--ink\);\s*transition: opacity 320ms [^;]*, color 200ms ease;/);
  for (const [steps, clause] of [["", '0'], [":is\\(\\[data-step='1'\\], \\[data-step='2'\\], \\[data-step='3'\\]\\)", '1'], [":is\\(\\[data-step='2'\\], \\[data-step='3'\\]\\)", '2'], ["\\[data-step='3'\\]", '3']]) {
    assert.match(CSS, new RegExp(`\\.ss\\[data-pinned='true'\\]${steps} \\.lp-statement__w\\[data-accent\\]\\[data-ph='${clause}'\\]`), `clause ${clause} lights its accent from its own step`);
  }
  assert.match(CSS, /\[data-ph='3'\] \{\s*color: var\(--statement-accent, var\(--ink\)\);\s*transition: opacity 320ms [^;]*, color 420ms [^;]* calc\(var\(--wo, 0\) \* 34ms \+ 200ms\);/);
});

test('wide windows: on the scrub an accent word fades in ink and turns green in the last third of its slice, still before the section is mid-window', () => {
  assert.match(CSS, /\.lp-statement__w\[data-accent\] \{\s*animation-name: lp-word-accent;\s*animation-range-end: cover calc\(21% \+ var\(--p\) \* 26%\);\s*\}/);
  const frames = CSS.match(/@keyframes lp-word-accent \{([\s\S]*?)\n\}/)[1];
  assert.match(frames, /from \{ opacity: 0\.18; color: var\(--ink\); \}/);
  assert.match(frames, /66% \{ opacity: 1; color: var\(--ink\); \}/);
  assert.match(frames, /to \{ opacity: 1; color: var\(--statement-accent, var\(--ink\)\); \}/);
  assert.ok(21 + 26 < 50, 'the last accent is green before the section reaches the middle of the window');
});

test('reduced motion, short phones and browsers without scroll timelines get the finished sentence: the accent words green at rest', () => {
  // The base rule sits outside every motion query, so wherever the scrub and the held story do not run it applies as is.
  const base = CSS.slice(0, CSS.indexOf('@supports (animation-timeline: view())'));
  assert.match(base, /\.lp-statement__w\[data-accent\] \{ color: var\(--statement-accent, var\(--ink\)\); \}/);
});
