// node --test src/components/landing/heroLines.test.mjs
// The home hero's headline (LK74, SPEC-HOME-1104 decisions 5, 7 and 18; L-016 "typed line, one pass").
// Replaces R3 ruling H1 of 1 Nov (a static headline): on 4 Nov the owner asked for a refined typing animation in
// Preparoo's direction, so the third line now types once and rests on the approved "Know what to fix." The sentence in
// the DOM never changes. This file was deliberately rewritten for that (risk 2 of the proposal), not a regression.
// The old H2/H3/H4 checks (the dotted trust line, the desktop host Mobi in the gutter, the Day room poster) lived here
// beside the headline; the 1104 hero changed what they lock (decisions 3, 13, 14), so they moved to the hero's own
// tests (homeHero.test.mjs, heroTaps.test.mjs, heroScene.test.mjs).
// Source-level and pure; the fit at 360 px and the real typing are measured in a browser (tmp/home-1104/build-p3/).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { HERO_LINES, HERO_SENTENCE, HERO_SLOT_PHRASES, HERO_TYPED, TYPING, caretTail, letterTimes, typingPlan } from './heroLines.mjs';
import { marksLedger, labStory } from './labStory.mjs';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const PAGE = read('../../app/page.js');
const TYPED = read('./HeroTyped.jsx');
const CSS = read('../../app/opening.css');
const rules = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const COPY = existsSync(new URL('./homeCopy.mjs', import.meta.url)) ? read('./homeCopy.mjs') : '';

test('the words: the sentence is unchanged, two typed phrases, and it rests on "Know what to fix."', () => {
  assert.deepEqual([...HERO_LINES], ['CUET 2027.', 'One mock.', 'Know what to fix.']);
  assert.equal(HERO_SENTENCE, 'CUET 2027. One mock. Know what to fix.');
  assert.deepEqual([...HERO_TYPED], ['Fresh every time.', 'Every mark traced.']);
  assert.deepEqual([...HERO_SLOT_PHRASES], [...HERO_TYPED, HERO_LINES[2]], 'the last phrase typed is the resting line');
  for (const line of [...HERO_LINES, ...HERO_TYPED]) {
    assert.match(line, /^[A-Z0-9][A-Za-z0-9 ]+\.$/, `${line} is one plain sentence`);
    assert.doesNotMatch(line, /!|guarantee|unlimited|best|#1|·|not just/i, line);
  }
  for (const p of HERO_SLOT_PHRASES) assert.ok(p.length <= 18, `${p} is at most 18 characters`);
});

test('decision 18: every typed phrase traces to a claim the page already makes', () => {
  // "Fresh every time.": the FAQ's approved claim.
  assert.match(COPY + PAGE, /every mock is built fresh from one live question bank/);
  // "Every mark traced.": the Mistake Lab's head and its first step.
  assert.match(COPY + PAGE, /Every mark, traced back to a moment\.|Every mark you missed, sorted by how it went/);
  // "Know what to fix.": chapter review names the chapter to fix first, and the free SWOT gives the sets to do next.
  assert.match(COPY + PAGE, /title: 'Know the chapter to fix first\.'/);
  assert.match(read('../../../data/mock_swot.js'), /free: no model and no credit/);
  const ledger = marksLedger();
  const story = labStory();
  assert.equal(ledger.gap, story.facts.outOf - story.facts.marks, 'the Lab sorts every missed mark into a group');
});

test('the timing: 34 ms a letter, +24 after a space, +70 before the full stop; one pass of about 9 s', () => {
  assert.deepEqual(letterTimes('Ab c.'), [0, 34, 68, 34 * 3 + 24, 34 * 4 + 24 + 70]);
  const plan = typingPlan();
  assert.equal(plan[0].kind, 'caret');
  const kinds = plan.map((s) => s.kind);
  assert.equal(kinds.filter((k) => k === 'wash').length, 3, 'select-back before each phrase, the server text first');
  assert.equal(kinds.filter((k) => k === 'clear').length, 3);
  assert.deepEqual(plan.filter((s) => s.kind === 'typed').map((s) => [s.phrase, s.final]), [[0, false], [1, false], [2, true]]);
  assert.equal(kinds.at(-1), 'end', 'it ends: no loop');
  for (let i = 1; i < plan.length; i += 1) assert.ok(plan[i].at >= plan[i - 1].at, 'steps are in time order');
  // The final letters spell the resting line.
  const last = plan.filter((s) => s.kind === 'letter' && s.phrase === 2).at(-1);
  assert.equal(HERO_SLOT_PHRASES[last.phrase].slice(0, last.count), HERO_LINES[2]);
  // Holds of 2,200 ms between the phrases; the wash is 220 ms then a 100 ms beat.
  const typed0 = plan.find((s) => s.kind === 'typed' && s.phrase === 0).at;
  const wash1 = plan.filter((s) => s.kind === 'wash')[1].at;
  assert.equal(wash1 - typed0, TYPING.hold);
  const clear1 = plan.filter((s) => s.kind === 'clear')[1].at;
  assert.equal(clear1 - wash1, TYPING.wash + TYPING.beat);
  const total = plan.at(-1).at + caretTail();
  assert.ok(total > 8000 && total < 10500, `about 9 s in all (${total} ms)`);
  assert.equal(caretTail(), 530 + 530 + 530 + 160, 'two blinks, then it leaves in 160 ms');
});

test('HeroTyped: server text is the resting line, the slot is aria-hidden with a sizer, a screen reader reads the sentence', () => {
  assert.match(TYPED, /^'use client';/);
  assert.match(TYPED, /export default function HeroTyped\(\) \{/, 'no props');
  assert.match(TYPED, /const REST = HERO_LINES\[2\];/);
  assert.match(TYPED, /<span className="sr-only">\{REST\}<\/span>/);
  assert.match(TYPED, /<span className="lp-typed__slot" aria-hidden="true" ref=\{slotRef\}>/);
  assert.match(TYPED, /HERO_SLOT_PHRASES\.map\(\(p\) => <span key=\{p\} className="lp-typed__sizer" data-t=\{p\} \/>\)/);
  // Before the effect runs (server HTML, no JS) the live text is the plain resting line, no caret.
  assert.match(TYPED, /\{view\?\.typing \? \[\.\.\.text\]\.map[^\n]+ : text\}/);
  assert.match(TYPED, /const text = view \? view\.text : REST;/);
  assert.match(TYPED, /view && view\.caret !== 'off' \? <span className=\{`lp-typed__caret/);
  // The sizer is generated text, never DOM text: the h1's text stays the sentence.
  assert.match(rules(CSS), /\.lp-typed__sizer::before \{ content: attr\(data-t\); \}/);
  assert.match(rules(CSS), /\.lp-typed__sizer,\s*\.lp-typed__live \{\s*grid-area: 1 \/ 1;/);
  assert.match(rules(CSS), /\.lp-typed__slot \{\s*display: inline-grid;/);
  assert.doesNotMatch(TYPED, /aria-live/);
});

test('HeroTyped: no timer under reduced motion or for a signed-in student; pauses off screen and in a hidden tab', () => {
  const effect = TYPED.slice(TYPED.indexOf('useEffect(() => {'));
  const guard = effect.indexOf('if (stillOnly()) return undefined;');
  assert.ok(guard > 0 && guard < effect.indexOf('setTimeout'), 'the reduced-motion and signed-in guard comes before any timer');
  assert.match(TYPED, /html\.getAttribute\('data-motion'\) === 'reduced' \|\| html\.hasAttribute\('data-signed-in'\)/);
  assert.match(TYPED, /matchMedia\('\(prefers-reduced-motion: reduce\)'\)/);
  assert.match(TYPED, /new IntersectionObserver/);
  assert.match(TYPED, /visibilitychange/);
  assert.doesNotMatch(TYPED, /setInterval|requestAnimationFrame/, 'one timer at a time, nothing per frame');
  // It starts at the opening's hand-off, or 600 ms after paint when there was none.
  assert.match(TYPED, /window\.addEventListener\('mm:opening', onOpening\)/);
  assert.match(TYPED, /start\(TYPING\.startAfterPaint - performance\.now\(\)\)/);
  assert.equal(TYPING.startAfterPaint, 600);
});

test('decision 5: a completed phrase tells Mobi (window mm:hero-typed { index, final })', () => {
  assert.match(TYPED, /window\.dispatchEvent\(new CustomEvent\('mm:hero-typed', \{ detail: \{ index: s\.phrase, final: s\.final \} \}\)\)/);
});

test('the caret: a solid ink bar, never volt, never blinking while the text is static, never looping', () => {
  const css = rules(CSS);
  assert.match(css, /\.lp-typed__caret \{[^}]*width: 0\.075em;[^}]*height: 0\.78em;[^}]*background: currentColor;/);
  assert.doesNotMatch(css.slice(css.indexOf('.lp-typed')), /D2F000|--volt|--accent|--brand-word/i, 'ink, never volt');
  assert.doesNotMatch(css, /infinite/);
  assert.match(css, /\.lp-typed__caret--end \{ animation: lp-caret-end 1750ms linear forwards; \}/, 'two blinks after the last letter, then gone');
  // Only opacity and transform animate in the typed line.
  for (const name of ['lp-typed-in', 'lp-typed-wash', 'lp-caret-in', 'lp-caret-end']) {
    const body = css.slice(css.indexOf(`@keyframes ${name}`), css.indexOf('}', css.indexOf(`@keyframes ${name}`) + 20) + 1);
    for (const [, p] of body.matchAll(/([a-z-]+):/g)) assert.ok(['opacity', 'transform'].includes(p), `${name} animates ${p}`);
  }
});

test('the old headline motion stays deleted; only HeroTyped types the h1', () => {
  const landing = readdirSync(new URL('.', import.meta.url));
  for (const gone of ['HeroMorph.jsx', 'HeroType.jsx', 'HeroLine.jsx', 'HeroMelt.jsx', 'heroPhrases.mjs']) assert.ok(!landing.includes(gone), `${gone} stays deleted`);
  assert.ok(!existsSync(new URL('../../app/hero-motion.css', import.meta.url)), 'the old headline motion stylesheet stays deleted');
  for (const file of readdirSync(new URL('../../app/', import.meta.url)).filter((f) => f.endsWith('.css'))) {
    assert.doesNotMatch(read(`../../app/${file}`), /lp-morph|lp-type-letter/, file);
  }
});

test('page.js places HeroTyped as the h1\'s third line (P2 wires it)', (t) => {
  if (!/import HeroTyped from '@\/components\/landing\/HeroTyped'/.test(PAGE)) {
    t.skip('page.js does not import HeroTyped yet (packet P2 wires it)');
    return;
  }
  const title = PAGE.slice(PAGE.indexOf('<h1 className="lp-title">'), PAGE.indexOf('</h1>'));
  assert.match(title, /\{HERO_LINES\[0\]\}/);
  assert.match(title, /\{HERO_LINES\[1\]\}/);
  assert.match(title, /<HeroTyped \/>/);
  assert.doesNotMatch(title, /\{HERO_LINES\[2\]\}/, 'the third line is HeroTyped\'s');
  assert.doesNotMatch(title, /aria-live|<(a|button|Link)\b/);
});
