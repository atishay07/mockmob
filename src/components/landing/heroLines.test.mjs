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

// LK87 (5 Nov 2026, D5): retimed after a 50 ms film beside ug.preparoo.app: letters land whole at an even 46 ms with a beat
// at each word, the resting line holds 420 ms with its caret before the first select-back, holds are 1,700 ms (were 2,200),
// and the whole pass is no longer than the 4 Nov one (7,606 ms to the last letter, 9,356 ms with the caret's goodbye).
test('the timing: 46 ms a letter, +34 at a new word, +80 before the full stop; a lead before the first select-back; one pass of about 9 s, no longer than before', () => {
  assert.deepEqual(letterTimes('Ab c.'), [0, 46, 92, 46 * 3 + 34, 46 * 4 + 34 + 80]);
  const plan = typingPlan();
  assert.equal(plan[0].kind, 'caret');
  assert.equal(plan.find((s) => s.kind === 'wash').at, TYPING.caretIn + TYPING.lead, 'the resting line is read before it changes');
  assert.equal(TYPING.lead, 420);
  assert.equal(TYPING.hold, 1700);
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
  assert.ok(plan.at(-1).at <= 7606 && total <= 9356, `no longer than the 4 Nov pass (${plan.at(-1).at} / ${total} ms)`);
  assert.equal(caretTail(), 530 + 530 + 530 + 160, 'two blinks, then it leaves in 160 ms');
});

test('HeroTyped: server text is the resting line, the slot is aria-hidden with a sizer, a screen reader reads the sentence', () => {
  assert.match(TYPED, /^'use client';/);
  assert.match(TYPED, /export default function HeroTyped\(\) \{/, 'no props');
  assert.match(TYPED, /const REST = HERO_LINES\[2\];/);
  assert.match(TYPED, /<span className="sr-only">\{REST\}<\/span>/);
  assert.match(TYPED, /<span className="lp-typed__slot" aria-hidden="true" ref=\{slotRef\}>/);
  assert.match(TYPED, /HERO_SLOT_PHRASES\.map\(\(p\) => <span key=\{p\} className="lp-typed__sizer" data-t=\{p\} \/>\)/);
  // Before the effect runs (server HTML, no JS) the live text is the plain resting line, no caret. While it types, the
  // text stays one run (LK87: letters land whole, no per-letter spans or fades).
  assert.match(TYPED, /\n\s*\{text\}\n/);
  assert.doesNotMatch(TYPED, /lp-typed__ch|\[\.\.\.text\]\.map/);
  assert.match(TYPED, /const text = view \? view\.text : REST;/);
  // A new caret node for each length: it never moves as a laid-out box, so typing makes no layout shift.
  assert.match(TYPED, /view && view\.caret !== 'off' \? <span key=\{`c\$\{text\.length\}`\} className=\{`lp-typed__caret/);
  // The sizer is generated text, never DOM text: the h1's text stays the sentence.
  assert.match(rules(CSS), /\.lp-typed__sizer::before \{ content: attr\(data-t\); \}/);
  assert.match(rules(CSS), /\.lp-typed__sizer,\s*\.lp-typed__live \{\s*grid-area: 1 \/ 1;/);
  assert.match(rules(CSS), /\.lp-typed__slot \{\s*display: inline-grid;/);
  assert.doesNotMatch(TYPED, /aria-live/);
});

test('HeroTyped: no timer under reduced motion; pauses off screen and in a hidden tab', () => {
  const effect = TYPED.slice(TYPED.indexOf('useEffect(() => {'));
  const guard = effect.indexOf('if (stillOnly()) return undefined;');
  assert.ok(effect.indexOf('setTimeout') > 0);
  assert.ok(guard > 0 && guard < effect.indexOf('setTimeout'), 'the reduced-motion guard comes before any timer');
  assert.match(TYPED, /if \(html\.getAttribute\('data-motion'\) === 'reduced'\) return true;/);
  assert.match(TYPED, /matchMedia\('\(prefers-reduced-motion: reduce\)'\)/);
  assert.match(TYPED, /new IntersectionObserver/);
  assert.match(TYPED, /visibilitychange/);
  assert.doesNotMatch(TYPED, /setInterval|requestAnimationFrame/, 'one timer at a time, nothing per frame');
  // It starts a beat after the opening's hand-off, or 2.2 s into the load when there was none. Round 10 (10 Nov 2026): it
  // used to start 600 ms in, so the first select-back emptied the line about 1.4 s in and a student's first read was
  // "CUET 2027. One mock." with no third line; now the whole sentence holds for the first read (about 3 s) and only then
  // types, the same pass as before.
  assert.match(TYPED, /window\.addEventListener\('mm:opening', onOpening\)/);
  assert.match(TYPED, /if \(event\.detail\?\.phase === 'done'\) start\(TYPING\.afterOpening\);/);
  assert.match(TYPED, /start\(TYPING\.startAfterPaint - performance\.now\(\)\)/);
  assert.equal(TYPING.startAfterPaint, 2200);
  assert.equal(TYPING.afterOpening, 1000);
  const firstClear = typingPlan().find((s) => s.kind === 'clear').at;
  assert.ok(TYPING.startAfterPaint + firstClear >= 2900, `the line is whole for the first ~3 s (${TYPING.startAfterPaint + firstClear} ms)`);
  assert.ok(TYPING.afterOpening + firstClear >= 1700, 'after an opening, the sentence is read before it clears');
});

test('round 4 (owner LK120): the line types on every visit, signed in or not, and never waits for ever on the opening', () => {
  // The cause of "sometimes there, sometimes gone": a Supabase session cookie (<html data-signed-in>) used to skip the pass.
  const still = TYPED.slice(TYPED.indexOf('function stillOnly()'), TYPED.indexOf('export default function HeroTyped'));
  assert.doesNotMatch(still, /data-signed-in/, 'a signed-in visitor sees the same pass as a guest');
  // If the opening's hand-off is missed, the fallback starts the pass after the longest opening (1,600 ms) has ended.
  assert.match(TYPED, /fallback = window\.setTimeout\(\(\) => start\(0\), TYPING\.openingFallback\);/);
  assert.match(TYPED, /window\.clearTimeout\(fallback\);/);
  assert.ok(TYPING.openingFallback > 1600 && TYPING.openingFallback <= 3000);
});

test('decision 5: a completed phrase tells Mobi (window mm:hero-typed { index, final })', () => {
  assert.match(TYPED, /window\.dispatchEvent\(new CustomEvent\('mm:hero-typed', \{ detail: \{ index: HERO_SLOT_PHRASES\.indexOf\(phrases\[s\.phrase\]\), final: s\.final \} \}\)\)/);
});

test('HeroTyped never types a phrase that would not fit the column on one line; it always rests on the sentence', () => {
  assert.match(TYPED, /phrases = HERO_SLOT_PHRASES\.filter\(\(p\) => p === REST \|\| !\(widths\.get\(p\) > column \+ 1\)\);/);
  assert.match(TYPED, /plan = typingPlan\(phrases\);/);
  assert.match(TYPED, /document\.fonts\.ready\.then\(go, go\)/, 'measured with the web fonts in');
  assert.equal(HERO_SLOT_PHRASES.at(-1), HERO_LINES[2], 'the filter keeps the resting line last');
  const fallback = typingPlan([HERO_LINES[2]]);
  assert.deepEqual(fallback.filter((s) => s.kind === 'typed').map((s) => s.final), [true], 'with nothing else fitting it still selects back and retypes the sentence once');
});

// LK87 (5 Nov 2026, D5) changes the 4 Nov rule "never blinking while the text is static": a caret at rest blinks the way a
// text field's does (solid for 530 ms, then 530 off, 530 on), three finite cycles while a phrase holds, and it gives way to
// the selection. It still never loops and is still ink.
test('the caret: an ink bar, never volt; solid while typing, blinking like a text field while a phrase holds, gone after the last phrase, never looping', () => {
  const css = rules(CSS);
  assert.match(css, /\.lp-typed__caret \{[^}]*width: 0\.075em;[^}]*height: 0\.78em;[^}]*background: currentColor;/);
  assert.doesNotMatch(css.slice(css.indexOf('.lp-typed')), /D2F000|--volt|--accent|--brand-word/i, 'ink, never volt');
  assert.doesNotMatch(css, /infinite/);
  assert.match(css, /\.lp-typed__caret--end \{ animation: lp-caret-end 1750ms linear forwards; \}/, 'two blinks after the last letter, then gone');
  assert.match(css, /\.lp-typed__caret--idle \{ animation: lp-caret-idle 1060ms linear 530ms 3 both; \}/, 'a resting caret blinks after 530 ms, three cycles at most');
  assert.match(css, /\.lp-typed__live\[data-wash\] \.lp-typed__caret \{ animation: none; opacity: 0; \}/, 'the selection takes the caret\'s place');
  assert.match(TYPED, /if \(!s\.final\) show\(\{ caret: 'idle' \}\);/, 'a finished phrase rests its caret');
  // Only opacity and transform animate in the typed line.
  for (const name of ['lp-typed-wash', 'lp-caret-in', 'lp-caret-idle', 'lp-caret-end']) {
    assert.ok(css.includes(`@keyframes ${name}`), `${name} exists`);
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
