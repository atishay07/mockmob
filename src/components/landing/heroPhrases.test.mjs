// node --test src/components/landing/heroPhrases.test.mjs
// The hero headline's changing line (L-016, D38): few phrases, each true and one line long, one static sentence for
// screen readers and search, the agreed motion, and nothing moving under Reduce motion. Source-level, no server.
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  HERO_LINES, HERO_PHRASES, HERO_PHRASES_V2, HERO_SENTENCE, HERO_MOTION_V2_DEFAULT, MELT, MORPH, RULE, TYPE,
  asksForHeroV2, asksForHeroV3, caretKeyframes, changeSpanMs, createHeroCycle, cycleChanges, heroMotionMode, heroPreview,
  mayMorph, meltBlurScale, meltFrame, meltLayer, nextPhrase, phraseWords, typingSchedule,
} from './heroPhrases.mjs';
import { marksLedger, labStory } from './labStory.mjs';
import { ONBOARDING_LEAD } from '../../lib/paperCopy.mjs';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const PAGE = read('../../app/page.js');
const MORPH_JSX = read('HeroMorph.jsx');
const CSS = read('../../app/hero-motion.css');
const TYPE_JSX = read('HeroType.jsx');
const LINE_JSX = read('HeroLine.jsx');
const MELT_JSX = read('HeroMelt.jsx');

test('at most four phrases, the first is the static one, and the h1 reads one sentence', () => {
  assert.ok(HERO_PHRASES.length >= 2 && HERO_PHRASES.length <= 4);
  assert.equal(HERO_PHRASES[0], 'No more guessing.');
  assert.deepEqual([...HERO_LINES], ['CUET 2027.', 'One mock.']);
  assert.equal(HERO_SENTENCE, 'CUET 2027. One mock. No more guessing.');
  assert.equal(new Set(HERO_PHRASES).size, HERO_PHRASES.length, 'no phrase twice');
});

test('every phrase fits one headline line: short, one sentence, no hype', () => {
  // The widest, "Every mark traced.", measures 8.7 em at the hero's weight and tracking; the column holds 9 em on a
  // phone (11 cqi) and 8.85 em from 761 px (11.3 cqi). 18 characters is the most any phrase may use.
  for (const phrase of HERO_PHRASES) {
    assert.ok(phrase.length <= 18, `${phrase} is ${phrase.length} characters`);
    assert.match(phrase, /^[A-Z][a-z ]+\.$/, `${phrase} is one plain sentence`);
    assert.doesNotMatch(phrase, /!|never|guarantee|unlimited|best|#1|unlock|supercharg|seamless/i);
  }
});

test('every phrase is true: each one is held to what makes it so', () => {
  const [guessing, traced, fix, fresh] = HERO_PHRASES;
  assert.equal(guessing, 'No more guessing.');
  // The copy deck's line 3; the lead under it names what replaces the guessing.
  assert.match(read('../../../docs/design-decisions/landing-copy-bolder-1018.md'), /\*\*No more guessing\.\*\*/);
  assert.match(PAGE, /Take a timed mock\. See exactly where every mark went\. Fix the right chapter tonight\./);

  assert.equal(traced, 'Every mark traced.');
  assert.match(PAGE, /Every mark, traced back to a moment\./);
  const ledger = marksLedger();
  const story = labStory();
  assert.equal(ledger.gap, story.facts.outOf - story.facts.marks, 'the Lab sorts every missed mark into a group');

  assert.equal(fix, 'Know what to fix.');
  assert.match(PAGE, /title: 'Know the chapter to fix first\.'/);
  assert.match(read('../../../data/mock_swot.js'), /free: no model and no credit/);

  assert.equal(fresh, 'Fresh every time.');
  assert.match(read('QuestionBankLine.jsx'), /each built fresh from one live bank of/);
  assert.match(ONBOARDING_LEAD, /Every mock is built fresh from one live question bank/);
});

test('the letters: grouped by word, indexed through the spaces, every phrase in turn', () => {
  const words = phraseWords('Know what to fix.');
  assert.deepEqual(words.map((w) => w.map((l) => l.ch).join('')), ['Know', 'what', 'to', 'fix.']);
  assert.deepEqual(words.map((w) => w[0].i), [0, 5, 10, 13]);
  assert.equal(nextPhrase(HERO_PHRASES.length - 1), 0);
  let i = 0;
  const seen = new Set();
  for (let k = 0; k < HERO_PHRASES.length; k++) { seen.add(i); i = nextPhrase(i); }
  assert.equal(seen.size, HERO_PHRASES.length);
});

test('the motion is the agreed one, in the code and in the CSS', () => {
  assert.ok(MORPH.STAGGER_MS >= 18 && MORPH.STAGGER_MS <= 24);
  assert.equal(MORPH.IN_DELAY_MS + MORPH.IN_MS, MORPH.CHANGE_MS);
  assert.ok(Math.abs(MORPH.CHANGE_MS - 480) <= 40);
  assert.ok(MORPH.OUT_MS < MORPH.CHANGE_MS);
  assert.ok(MORPH.HOLD_MS >= 2400 && MORPH.HOLD_MS <= 2800);
  assert.equal(MORPH.RISE_EM, 0.35);
  assert.equal(MORPH.EASE, 'cubic-bezier(0.23, 1, 0.32, 1)');
  assert.equal(changeSpanMs('No more guessing.', 'Every mark traced.'), 17 * MORPH.STAGGER_MS + MORPH.CHANGE_MS);
  assert.match(CSS, new RegExp(`lp-morph-in ${MORPH.IN_MS}ms cubic-bezier\\(0\\.23, 1, 0\\.32, 1\\) calc\\(${MORPH.IN_DELAY_MS}ms \\+ var\\(--i, 0\\) \\* ${MORPH.STAGGER_MS}ms\\)`));
  assert.match(CSS, new RegExp(`lp-morph-out ${MORPH.OUT_MS}ms cubic-bezier\\(0\\.23, 1, 0\\.32, 1\\) calc\\(var\\(--i, 0\\) \\* ${MORPH.STAGGER_MS}ms\\)`));
  assert.match(CSS, /translate3d\(0, -0\.35em, 0\)/);
  assert.match(CSS, /translate3d\(0, 0\.35em, 0\)/);
});

test('no glass, no glow, no gradient text on the headline (L-016, L-019)', () => {
  const rules = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(rules, /filter|blur\(|text-shadow|box-shadow|background-clip|gradient/);
  assert.match(rules, /\.mm\.lp \.lp-title__brand \{ color: var\(--accent-text\); \}/, 'CUET 2027 in the brand colour, plain text');
  assert.doesNotMatch(PAGE, /<(a|button|Link)[^>]*>\s*\{?HERO_LINES\[0\]/, 'CUET 2027 is not a button');
});

test('Reduce motion keeps the first phrase still; a hidden tab or an off-screen hero pauses', () => {
  assert.equal(mayMorph({ reduced: true }), false);
  assert.equal(mayMorph({ hidden: true }), false);
  assert.equal(mayMorph({ inView: false }), false);
  assert.equal(mayMorph({ count: 1 }), false);
  assert.equal(mayMorph({}), true);
  // The component asks both switches, the system's and MockMob's own, and goes back to the first phrase.
  assert.match(MORPH_JSX, /matchMedia\('\(prefers-reduced-motion: reduce\)'\)/);
  assert.match(MORPH_JSX, /root\.dataset\.motion === 'reduced'/);
  assert.match(MORPH_JSX, /if \(index !== 0\) \{ index = 0;/);
  assert.match(MORPH_JSX, /visibilitychange/);
  assert.match(MORPH_JSX, /IntersectionObserver/);
  // And the letters only move where motion is allowed.
  assert.match(CSS, /@media \(prefers-reduced-motion: no-preference\) \{\n\s+:root:not\(\[data-motion='reduced'\]\) \.lp-morph__phrase\[data-state='in'\]/);
  assert.match(CSS, /@media \(prefers-reduced-motion: reduce\) \{\n\s+\.lp-morph__phrase\[data-state='out'\] \{ display: none; \}/);
});

test('a screen reader hears the static sentence once; the letters are hidden and nothing is announced', () => {
  // 20 Oct: the two still lines run inline with a break (one paint for LCP; landing.css .lp-title__line--run); a space
  // before the break keeps the sentence "CUET 2027. One mock." for a screen reader and a search engine.
  assert.match(PAGE, /<span className="lp-title__line lp-title__line--run lp-title__brand">\{HERO_LINES\[0\]\}<\/span>\{' '\}<br \/>\s*<span className="lp-title__line lp-title__line--run">\{HERO_LINES\[1\]\}<\/span>\s*\{heroMotion === 'v1' \? <HeroMorph \/> : <HeroLine mode=\{heroMotion\} \/>\}/);
  assert.match(MORPH_JSX, /<span className="lp-sr">\{phrases\[0\]\}<\/span>/);
  assert.match(MORPH_JSX, /<span className="lp-morph__cell" aria-hidden="true">/);
  assert.doesNotMatch(MORPH_JSX, /aria-live/);
});

// =================================================================================================================
// Option C, "select and type" (G30; D112 C-pick 3; HERO-MOTION-1019.md), behind its flag (D115).
// =================================================================================================================

test('D120: option C (faster, looping) is on for everyone; HERO_MOTION_V2=0 brings the released line back', () => {
  assert.equal(HERO_MOTION_V2_DEFAULT, true, 'the owner published v2 on 19 Oct (D120)');
  // Production and every other build: option C, served with the page.
  assert.equal(heroMotionMode({}), 'v2');
  assert.equal(heroMotionMode({ VERCEL_ENV: 'production', NODE_ENV: 'production' }), 'v2');
  assert.equal(heroMotionMode({ VERCEL_ENV: 'preview' }), 'v2');
  // The switch-on after his OK, and the kill switch for the preview link.
  for (const on of ['1', 'true', 'on', ' ON ']) assert.equal(heroMotionMode({ HERO_MOTION_V2: on }), 'v2', on);
  for (const off of ['0', 'false', 'off']) assert.equal(heroMotionMode({ HERO_MOTION_V2: off }), 'v1', off);
  assert.equal(heroMotionMode({ HERO_MOTION_V2: 'maybe' }), 'v2');
  // Only exactly ?hero=v2 asks for it.
  assert.equal(asksForHeroV2('?hero=v2'), true);
  assert.equal(asksForHeroV2('?utm_source=x&hero=v2'), true);
  for (const no of ['', '?hero=v1', '?hero=V2', '?hero=', '?heroes=v2', '#hero=v2']) assert.equal(asksForHeroV2(no), false, no);
});

test('D115: the default path mounts the released HeroMorph untouched; option C is a lazy chunk', () => {
  assert.match(PAGE, /const heroMotion = heroMotionMode\(process\.env\);/);
  assert.match(PAGE, /\{heroMotion === 'v1' \? <HeroMorph \/> : <HeroLine mode=\{heroMotion\} \/>\}/);
  // HeroLine renders the released line unless the address asks; the server and hydration always see the released one.
  assert.match(LINE_JSX, /const HeroType = lazy\(\(\) => import\('\.\/HeroType'\)/);
  assert.doesNotMatch(LINE_JSX, /import \{ HeroType \}|from '\.\/HeroType'/, 'never a static import of option C');
  assert.match(LINE_JSX, /mode === 'preview' && asksForHeroV2\(window\.location\.search\)/);
  assert.match(LINE_JSX, /\(\) => \(mode === 'v2' \? 'v2' : ''\),\n\s+\);/, 'the server snapshot ignores the address');
  assert.match(LINE_JSX, /if \(!pick\) return <HeroMorph \/>;/);
  assert.match(LINE_JSX, /<Suspense fallback=\{<HeroMorph \/>\}>/, 'while the chunk loads, the released line stays');
  // The released line's own motion is unchanged.
  assert.equal(MORPH.FIRST_MS, 3600);
  assert.equal(MORPH.HOLD_MS, 2600);
});

test('option C phrases: the same first line, one phrase reworded in his voice, each true and one line long', () => {
  assert.equal(HERO_PHRASES_V2.length, HERO_PHRASES.length);
  assert.equal(HERO_PHRASES_V2[0], HERO_PHRASES[0], 'the resting line, the screen-reader line and the Reduce motion line agree');
  assert.deepEqual([...HERO_PHRASES_V2], ['No more guessing.', 'See the lost marks.', 'Know what to fix.', 'Fresh every time.']);
  assert.equal(new Set(HERO_PHRASES_V2).size, HERO_PHRASES_V2.length);
  for (const phrase of HERO_PHRASES_V2) {
    // "See the lost marks." is 19 characters but 8.66 em at the hero's face, under "Every mark traced." (8.69 em).
    assert.ok(phrase.length <= 19, `${phrase} is ${phrase.length} characters`);
    assert.match(phrase, /^[A-Z][a-z ]+\.$/, `${phrase} is one plain sentence`);
    assert.doesNotMatch(phrase, /!|never|guarantee|unlimited|best|#1|unlock|supercharg|seamless/i);
  }
  // "See the lost marks." is the page's own promise and what the result shows.
  assert.match(PAGE, /Your marks slipped somewhere\. MockMob shows you \*where/);
  assert.doesNotMatch(PAGE, /Your lost marks went somewhere/);
  assert.match(PAGE, /label="Let’s find the lost marks\."/);
  assert.match(read('labStory.mjs'), /You missed \$\{gap\} marks\. Here’s where they went\./);
});

test('option C timing, faster (D119): select 220 ms, a 100 ms beat, typed at a quick rhythm; a change lands in about 1.1 s', () => {
  assert.equal(TYPE.SELECT_MS, 220);
  assert.equal(TYPE.SELECT_EASE, 'cubic-bezier(0.25, 1, 0.5, 1)');
  assert.equal(TYPE.BEAT_MS, 100);
  assert.equal(TYPE.LETTER_MS, 30);
  assert.deepEqual([...TYPE.JITTER], [0, 9, -6, 12, -3, 5, -8, 10, -4, 7, -5, 3]);
  assert.equal(TYPE.SPACE_MS, 24);
  assert.equal(TYPE.STOP_MS, 70);
  assert.equal(TYPE.FADE_MS, 60);
  assert.equal(TYPE.BLINK_AFTER_MS, 200);
  assert.deepEqual([...TYPE.BLINK_MS], [260, 260], 'off, on: one blink, then gone');
  assert.equal(TYPE.CARET_OUT_MS, 160);

  // "See the lost marks.", worked by hand: S 320, e 359 (+30 +9), e 383 (+30 -6), space 425 (+30 +12), t 476 (+30 -3
  // +24 after the space) ... the full stop waits 70 ms more.
  const s = typingSchedule('See the lost marks.');
  assert.equal(s.replaceAt, 320);
  assert.deepEqual(s.times.slice(0, 5), [320, 359, 383, 425, 476]);
  assert.equal(s.land, s.times[18] + TYPE.FADE_MS);
  assert.equal(s.blinkAt, s.land + 200);
  assert.equal(s.caretEnd, s.land + 200 + 520 + 160);
  assert.equal(s.times[18] - s.times[17], TYPE.LETTER_MS + TYPE.JITTER[18 % TYPE.JITTER.length] + TYPE.STOP_MS, 'the full stop waits 70 ms more');
  for (const phrase of HERO_PHRASES_V2) {
    const t = typingSchedule(phrase);
    assert.equal(t.times.length, Array.from(phrase).length);
    for (let k = 1; k < t.times.length; k++) assert.ok(t.times[k] - t.times[k - 1] >= 22, `${phrase}: letter ${k} follows at a quick typist's rhythm`);
    assert.ok(t.land >= 950 && t.land <= 1200, `${phrase} lands at ${t.land} ms (about 1.1 s)`);
    // The caret is gone inside the hold, so nothing blinks while the line rests.
    assert.ok(t.caretEnd - t.land < RULE.HOLD_MS, `${phrase}: the caret leaves ${t.caretEnd - t.land} ms after landing`);
    // The owner's rule (D119): from one line landing to the next landing is at most 2.6 s, for every phrase.
    assert.ok(t.land + RULE.HOLD_MS <= 2600, `${phrase}: ${t.land + RULE.HOLD_MS} ms from one landing to the next`);
  }
});

test('option C rule, faster (D119): quiet 0.5 s, read 0.6 s, hold 1.3 s; the first change comes within 2.2 s of first paint', () => {
  assert.equal(RULE.ENTRANCE_MS, 1000);
  assert.equal(RULE.QUIET_MS, 500);
  assert.equal(RULE.READ_MS, 600);
  assert.equal(RULE.HOLD_MS, 1300);
  assert.ok(Math.max(RULE.ENTRANCE_MS, RULE.QUIET_MS) + RULE.READ_MS <= 2200, 'the first change starts no later than 2.2 s after first paint');
});

test('option C caret: fades in, rides the selection, jumps after each letter, blinks once and fades out', () => {
  const phrase = 'Know what to fix.';
  const s = typingSchedule(phrase);
  const edges = Array.from(phrase).map((_, k) => ({ x: 10 * (k + 1), y: 0 }));
  const { keyframes, duration } = caretKeyframes(s, edges);
  assert.equal(duration, s.caretEnd);
  const offsets = keyframes.map((k) => k.offset);
  for (let k = 1; k < offsets.length; k++) assert.ok(offsets[k] >= offsets[k - 1], 'offsets never go back');
  assert.equal(offsets[0], 0);
  assert.equal(offsets.at(-1), 1);
  assert.equal(keyframes[0].opacity, 0, 'it fades in');
  assert.equal(keyframes[1].opacity, 1);
  assert.equal(keyframes[1].offset, TYPE.CARET_IN_MS / duration);
  assert.equal(keyframes.at(-1).opacity, 0, 'and it leaves');
  // One blink: after the last letter the opacity goes off, on, then fades away.
  const tail = keyframes.filter((k) => k.offset >= s.blinkAt / duration);
  const flips = tail.slice(1).filter((k, i) => k.opacity !== tail[i].opacity).map((k) => k.opacity);
  assert.deepEqual(flips, [0, 1, 0]);
  // It ends one pixel right of the last letter, and every move is an instant jump (paired keyframes).
  assert.equal(keyframes.at(-1).transform, `translate(${edges.at(-1).x + 1}px, 0px)`);
  assert.ok(keyframes.every((k) => !('filter' in k) && !('boxShadow' in k)), 'no glow');
});

test('option C CSS: the times are the TYPE values; a solid brand caret; no glow, no gradient (L-016, L-019)', () => {
  const rules = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
  const esc = (v) => v.replace(/[().,]/g, '\\$&');
  assert.match(rules, new RegExp(`animation: lp-type-select ${TYPE.SELECT_MS}ms ${esc(TYPE.SELECT_EASE)} both;`));
  assert.match(rules, new RegExp(`animation: lp-type-replace 1ms linear ${TYPE.SELECT_MS + TYPE.BEAT_MS - 1}ms both;`));
  assert.equal(TYPE.SELECT_MS + TYPE.BEAT_MS - 1, 319);
  assert.match(rules, new RegExp(`animation: lp-type-letter ${TYPE.FADE_MS}ms ease-out var\\(--t, 0ms\\) both;`));
  assert.match(rules, /\.lp-morph__sel \{[^}]*background: rgba\(124, 150, 20, 0\.2\);[^}]*transform-origin: 100% 50%;/, 'Day: olive at 20%, grown from the line end');
  assert.match(rules, /:root\[data-theme='dark'\] \.lp-morph__sel \{ background: rgba\(210, 240, 0, 0\.24\); \}/, 'Night: volt at 24%');
  assert.match(rules, /\.lp-morph__caret \{[^}]*top: 0\.1em;[^}]*width: max\(2px, 0\.055em\);[^}]*height: 0\.84em;[^}]*border-radius: 1px;[^}]*background: var\(--accent-text\);/);
  // Motion only where it is allowed, and nothing left behind under Reduce motion.
  assert.match(rules, /@media \(prefers-reduced-motion: no-preference\) \{\n\s+:root:not\(\[data-motion='reduced'\]\) \.lp-morph--type \.lp-morph__sel/);
  assert.match(rules, /:root\[data-motion='reduced'\] \.lp-morph--type \.lp-morph__caretwrap \{ display: none; \}/);
  assert.doesNotMatch(rules, /filter|blur\(|text-shadow|box-shadow|background-clip|gradient/);
  // Nothing in the change touches layout: the selection and the caret are positioned out of flow.
  assert.match(rules, /\.lp-morph__sel \{\n\s+position: absolute;/);
  assert.match(rules, /\.lp-morph__caretwrap \{ position: absolute;/);
});

test('option C reads as one stable sentence, keeps its size, and asks Mobi to glance at each change', () => {
  assert.match(TYPE_JSX, /<span className="lp-sr">\{phrases\[0\]\}<\/span>/);
  assert.match(TYPE_JSX, /<span ref=\{cellRef\} className="lp-morph__cell" aria-hidden="true">/);
  assert.doesNotMatch(TYPE_JSX, /aria-live=/);
  assert.match(TYPE_JSX, /phrases\.map\(\(p\) => <span key=\{`size-\$\{p\}`\} className="lp-morph__phrase" data-state="size">/, 'every phrase holds the cell');
  assert.match(TYPE_JSX, /new CustomEvent\('pip:glance'/);
  // The settle inputs: passive scroll, wheel and touch; scroll keys; the line fully on screen; fonts; first paint.
  assert.match(TYPE_JSX, /\['scroll', 'wheel', 'touchstart', 'touchmove'\]\) window\.addEventListener\(type, input, passive\)/);
  assert.match(TYPE_JSX, /const SCROLL_KEYS = new Set\(\[' ', 'PageDown', 'PageUp', 'ArrowDown', 'ArrowUp', 'Home', 'End'\]\)/);
  assert.match(TYPE_JSX, /entry\.intersectionRatio >= 0\.99/);
  assert.match(TYPE_JSX, /document\.fonts\?\.ready/);
  assert.match(TYPE_JSX, /'first-contentful-paint'/);
  assert.match(TYPE_JSX, /matchMedia\('\(prefers-reduced-motion: reduce\)'\)/);
  assert.match(TYPE_JSX, /root\.dataset\.motion === 'reduced'/);
  assert.match(TYPE_JSX, /visibilitychange/);
});

// ---- The settle-and-pause rule, under node's fake timers (setTimeout and Date). ----
function rig({ count = HERO_PHRASES_V2.length, landMs = (from, to) => typingSchedule(HERO_PHRASES_V2[to]).land } = {}) {
  mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
  const changes = [];
  const lands = [];
  const resets = [];
  const cycle = createHeroCycle({
    count,
    landMs,
    now: () => Date.now(),
    onChange: (c) => changes.push({ ...c, at: Date.now() }),
    onLand: (l) => lands.push({ ...l, at: Date.now() }),
    onReset: (r) => resets.push({ ...r, at: Date.now() }),
  });
  // Runs the fake clock forward to `ms` a millisecond at a time, so every timer fires at its own time and a timer set
  // inside a callback counts from that moment (one big tick would move the clock first, then run the callbacks).
  const to = (ms) => { while (Date.now() < ms) mock.timers.tick(1); };
  return { cycle, changes, lands, resets, to };
}
// A page that has painted at `t0`, has its fonts and shows the whole line.
function ready(r, t0 = 100) { r.to(t0); r.cycle.painted(t0); r.cycle.fontsReady(); r.cycle.setInView(true); }

test('settle rule: an untouched page changes 1.6 s after first paint (settled at 1.0 s, then 0.6 s of reading)', (t) => {
  t.after(() => mock.timers.reset());
  const r = rig();
  ready(r, 100);
  assert.equal(r.cycle.snapshot().state, 'settling');
  r.to(100 + RULE.ENTRANCE_MS + RULE.READ_MS - 1);
  assert.equal(r.changes.length, 0, 'nothing before settled + READ');
  r.to(100 + RULE.ENTRANCE_MS + RULE.READ_MS);
  assert.deepEqual(r.changes.map((c) => [c.from, c.to, c.at]), [[0, 1, 100 + RULE.ENTRANCE_MS + RULE.READ_MS]]);
});

test('settle rule: nothing changes before the fonts are ready, or before the line is fully on screen', (t) => {
  t.after(() => mock.timers.reset());
  const r = rig();
  r.cycle.painted(100);
  r.to(5000);
  assert.equal(r.changes.length, 0, 'the line not yet reported on screen');
  r.cycle.setInView(true);
  r.to(9000);
  assert.equal(r.changes.length, 0, 'fonts still loading');
  assert.equal(r.cycle.snapshot().state, 'loading');
  r.cycle.fontsReady();
  r.to(9000 + RULE.READ_MS - 1);
  assert.equal(r.changes.length, 0);
  r.to(9000 + RULE.READ_MS);
  assert.equal(r.changes.length, 1, 'once the fonts are in and the line is on screen, the reader still gets READ');
});

test('pause rule: a scroll during the wait holds the change until 0.5 s of stillness plus 0.6 s of reading', (t) => {
  t.after(() => mock.timers.reset());
  const r = rig();
  ready(r, 100);
  // The student scrolls straight away, for 8 s, every 100 ms.
  for (let ms = 300; ms <= 8300; ms += 100) { r.to(ms); r.cycle.input(); }
  assert.equal(r.changes.length, 0, 'never changes under a moving page');
  assert.equal(r.cycle.snapshot().state, 'scrolling');
  r.to(8300 + RULE.QUIET_MS + RULE.READ_MS - 1);
  assert.equal(r.changes.length, 0);
  r.to(8300 + RULE.QUIET_MS + RULE.READ_MS);
  assert.equal(r.changes.length, 1, 'first change 1.1 s after the last scroll');
});

test('pause rule: a scroll during a hold pauses the next change; the line then gets READ again', (t) => {
  t.after(() => mock.timers.reset());
  const r = rig();
  ready(r, 100);
  const first = 100 + RULE.ENTRANCE_MS + RULE.READ_MS;
  r.to(first);
  assert.equal(r.changes.length, 1);
  const land1 = first + typingSchedule(HERO_PHRASES_V2[1]).land;
  r.to(land1);
  assert.equal(r.lands.length, 1);
  assert.equal(r.cycle.snapshot().state, 'holding');
  assert.equal(r.cycle.snapshot().nextAt, land1 + RULE.HOLD_MS, 'untouched, the next change comes after the hold');
  // A scroll 1 s into the hold.
  r.to(land1 + 1000);
  r.cycle.input();
  r.to(land1 + RULE.HOLD_MS + 100);
  assert.equal(r.changes.length, 1, 'the hold ran out after the scroll: no change yet');
  r.to(land1 + 1000 + RULE.QUIET_MS + RULE.READ_MS - 1);
  assert.equal(r.changes.length, 1);
  r.to(land1 + 1000 + RULE.QUIET_MS + RULE.READ_MS);
  assert.equal(r.changes.length, 2, 'stillness for 0.5 s, then READ');
});

test('pause rule: a change under way finishes (never frozen mid-letter); the next one waits for stillness', (t) => {
  t.after(() => mock.timers.reset());
  const r = rig();
  ready(r, 100);
  const first = 100 + RULE.ENTRANCE_MS + RULE.READ_MS;
  r.to(first + 150);
  assert.equal(r.changes.length, 1);
  r.cycle.input(); // 150 ms into the change
  assert.equal(r.cycle.snapshot().state, 'changing');
  const land1 = first + typingSchedule(HERO_PHRASES_V2[1]).land;
  r.to(land1);
  assert.equal(r.lands.length, 1, 'it landed on time');
  assert.equal(r.cycle.snapshot().nextAt, land1 + RULE.HOLD_MS, 'a full hold after it lands (the READ it owes ends sooner)');
  r.to(land1 + RULE.HOLD_MS);
  assert.equal(r.changes.length, 2);
});

test('off screen or a hidden tab: no change; back on screen it waits READ again', (t) => {
  t.after(() => mock.timers.reset());
  const r = rig();
  ready(r, 100);
  r.to(1000);
  r.cycle.setInView(false); // the line leaves the screen before its first change
  r.to(10000);
  assert.equal(r.changes.length, 0);
  assert.equal(r.cycle.snapshot().state, 'away');
  r.cycle.setInView(true);
  r.to(10000 + RULE.READ_MS - 1);
  assert.equal(r.changes.length, 0, 'never at the moment it comes back');
  r.to(10000 + RULE.READ_MS);
  assert.equal(r.changes.length, 1);
  // The tab hidden during a hold: no change while hidden, READ again on return.
  const land1 = r.changes[0].at + typingSchedule(HERO_PHRASES_V2[1]).land;
  r.to(land1 + 500);
  r.cycle.setHidden(true);
  r.to(land1 + 20000);
  assert.equal(r.changes.length, 1);
  assert.equal(r.cycle.snapshot().state, 'hidden');
  r.cycle.setHidden(false);
  r.to(land1 + 20000 + RULE.READ_MS);
  assert.equal(r.changes.length, 2);
});

test('Reduce motion: "No more guessing." still, no cycle; switched on mid-change it goes back to that line', (t) => {
  t.after(() => mock.timers.reset());
  const r = rig();
  r.cycle.setReduced(true);
  ready(r, 100);
  r.to(60000);
  assert.equal(r.changes.length, 0);
  assert.equal(r.cycle.snapshot().state, 'reduced');
  assert.equal(HERO_PHRASES_V2[r.cycle.snapshot().index], 'No more guessing.');
  r.cycle.dispose();
  // A second visit: motion allowed at first, then Reduce motion switched on 150 ms into the first change.
  mock.timers.reset();
  const s = rig();
  ready(s, 100);
  s.to(100 + RULE.ENTRANCE_MS + RULE.READ_MS + 150);
  assert.equal(s.changes.length, 1);
  s.cycle.setReduced(true);
  assert.deepEqual(s.resets.map((x) => x.index), [0]);
  assert.equal(s.cycle.snapshot().changing, false);
  s.to(60000);
  assert.equal(s.changes.length, 1, 'and it stays still');
  assert.equal(s.lands.length, 0, 'the interrupted change never lands on top of the reset');
});

test('it loops (D119): the set keeps going while the hero is on screen, a landing every 2.6 s at most', (t) => {
  t.after(() => mock.timers.reset());
  assert.equal(cycleChanges(4), 4, 'the one-lap count is still there for a cycle built with loop: false');
  assert.equal(cycleChanges(1), 0);
  const r = rig();
  ready(r, 100);
  r.to(60000);
  assert.ok(r.changes.length >= 24, `${r.changes.length} changes in 60 s`);
  r.changes.forEach((c, k) => assert.deepEqual([c.from, c.to], [k % 4, (k + 1) % 4], `change ${k} follows the set in order`));
  assert.notEqual(r.cycle.snapshot().state, 'rest', 'it never rests on its own');
  // Each change after the first comes a full hold after the last one landed; each landing is at most 2.6 s after the last.
  for (let k = 1; k < r.changes.length - 1; k++) {
    assert.equal(r.changes[k].at, r.lands[k - 1].at + RULE.HOLD_MS);
    assert.ok(r.lands[k].at - r.lands[k - 1].at <= 2600, `landing ${k}: ${r.lands[k].at - r.lands[k - 1].at} ms after the last`);
  }
  // The first change starts no later than 2.2 s after first paint (painted at 100 ms).
  assert.ok(r.changes[0].at - 100 <= 2200, `first change ${r.changes[0].at - 100} ms after first paint`);
  // It still pauses off screen, and starts again after READ once the line is back.
  const before = r.changes.length;
  r.cycle.setInView(false);
  r.to(80000);
  assert.ok(r.changes.length - before <= 1, 'at most the change in flight');
  const mid = r.changes.length;
  r.cycle.setInView(true);
  r.to(80000 + RULE.READ_MS + 10);
  assert.equal(r.changes.length, mid + 1, 'back on screen it starts again after READ');
});

test('a cycle built with loop: false still runs one lap and rests on "No more guessing."', (t) => {
  t.after(() => mock.timers.reset());
  mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
  const changes = [];
  const cycle = createHeroCycle({ count: 4, loop: false, landMs: (from, to) => typingSchedule(HERO_PHRASES_V2[to]).land, now: () => Date.now(), onChange: (c) => changes.push(c) });
  cycle.painted(100); cycle.fontsReady(); cycle.setInView(true);
  while (Date.now() < 60000) mock.timers.tick(1);
  assert.equal(changes.length, 4);
  assert.equal(cycle.snapshot().state, 'rest');
  assert.equal(cycle.snapshot().index, 0);
});

test('the controller cleans up: nothing fires after dispose', (t) => {
  t.after(() => mock.timers.reset());
  const r = rig();
  ready(r, 100);
  r.cycle.dispose();
  r.to(60000);
  assert.equal(r.changes.length, 0);
});

// =================================================================================================================
// ?hero=v3, last year's melt on today's line (D119), preview only.
// =================================================================================================================

test('v3 flag: exactly ?hero=v3 asks for the melt; v2 still works; the default is untouched (D119)', () => {
  assert.equal(asksForHeroV3('?hero=v3'), true);
  assert.equal(asksForHeroV3('?utm_source=x&hero=v3'), true);
  for (const no of ['', '?hero=v2', '?hero=V3', '?hero=', '?heroes=v3', '#hero=v3', '?hero=v33']) assert.equal(asksForHeroV3(no), false, no);
  assert.equal(asksForHeroV2('?hero=v2'), true, 'v2 keeps working');
  assert.equal(asksForHeroV2('?hero=v3'), false);
  assert.equal(heroPreview('?hero=v2'), 'v2');
  assert.equal(heroPreview('?hero=v3'), 'v3');
  assert.equal(heroPreview(''), '');
  assert.equal(heroPreview('?hero=v1'), '');
  // D120: the production default is option C for everyone; ?hero=v3 still previews the melt on a lazy chunk of its own.
  assert.equal(HERO_MOTION_V2_DEFAULT, true);
  assert.equal(heroMotionMode({}), 'v2');
  assert.equal(heroMotionMode({ HERO_MOTION_V2: '0' }), 'v1', 'the kill switch turns both previews off (HeroLine is never mounted)');
  assert.match(LINE_JSX, /const HeroMelt = lazy\(\(\) => import\('\.\/HeroMelt'\)/);
  assert.doesNotMatch(LINE_JSX, /from '\.\/HeroMelt'/, 'never a static import of the melt');
  assert.match(LINE_JSX, /asksForHeroV3\(window\.location\.search\) \? 'v3'/);
  assert.match(LINE_JSX, /\(\) => \(mode === 'v2' \? 'v2' : ''\)/, 'the server never renders the melt');
});

test('the released line is untouched by the speed-up: HeroMorph and MORPH are exactly as shipped', () => {
  assert.deepEqual({ ...MORPH }, { STAGGER_MS: 20, OUT_MS: 240, IN_DELAY_MS: 120, IN_MS: 360, CHANGE_MS: 480, HOLD_MS: 2600, FIRST_MS: 3600, RISE_EM: 0.35, EASE: 'cubic-bezier(0.23, 1, 0.32, 1)' });
  assert.match(MORPH_JSX, /schedule\(MORPH\.FIRST_MS\);/);
  assert.match(MORPH_JSX, /schedule\(span \+ MORPH\.HOLD_MS\);/);
  assert.match(MORPH_JSX, /import \{ HERO_PHRASES, MORPH, changeSpanMs, mayMorph, nextPhrase, phraseWords \} from '\.\/heroPhrases\.mjs';/);
  assert.doesNotMatch(MORPH_JSX, /createHeroCycle|HeroMelt|MELT|HERO_PHRASES_V2/);
  assert.equal(HERO_PHRASES[1], 'Every mark traced.', 'the released set keeps its own phrases');
  assert.match(CSS, /animation: lp-morph-in 360ms cubic-bezier\(0\.23, 1, 0\.32, 1\) calc\(120ms \+ var\(--i, 0\) \* 20ms\) both;/);
});

test('melt maths are last year\'s (morphing-text.jsx): blur(min(8 / f - 8, 100)) and opacity f^0.4', () => {
  // f = 0: invisible and at the 100 px cap. f = 0.5: 8 px and 0.5^0.4. f = 1: sharp and solid.
  assert.deepEqual(meltLayer(0), { blur: 100, opacity: 0 });
  const half = meltLayer(0.5);
  assert.equal(half.blur, 8);
  assert.ok(Math.abs(half.opacity - 0.5 ** 0.4) < 1e-12);
  assert.ok(Math.abs(half.opacity - 0.7578582832551990) < 1e-9);
  assert.deepEqual(meltLayer(1), { blur: 0, opacity: 1 });
  // The cap bites for tiny f (8 / 0.07 - 8 = 106 > 100) and the blur falls monotonically as the layer arrives.
  assert.equal(meltLayer(0.05).blur, 100);
  assert.ok(Math.abs(meltLayer(0.2).blur - 32) < 1e-9);
  let last = Infinity;
  for (let f = 0.01; f <= 1; f += 0.01) { const b = meltLayer(f).blur; assert.ok(b <= last + 1e-9); last = b; }
  // Whole frames: the incoming layer takes f, the outgoing one 1 - f, so the two mirror each other.
  assert.deepEqual(meltFrame(0).incoming, { blur: 100, opacity: 0 });
  assert.deepEqual(meltFrame(0).outgoing, { blur: 0, opacity: 1 });
  const mid = meltFrame(MELT.MORPH_MS / 2);
  assert.equal(mid.f, 0.5);
  assert.deepEqual(mid.incoming, mid.outgoing, 'at the middle both layers are 8 px and 76% (the melt)');
  assert.deepEqual(meltFrame(MELT.MORPH_MS).incoming, { blur: 0, opacity: 1 });
  assert.deepEqual(meltFrame(MELT.MORPH_MS).outgoing, { blur: 100, opacity: 0 });
  assert.equal(meltFrame(5 * MELT.MORPH_MS).f, 1, 'f never passes 1');
  assert.equal(meltFrame(-5).f, 0, 'nor goes below 0');
  // Timing: a 1.0 s melt, a 1.2 s hold, a new phrase every 2.2 s.
  assert.equal(MELT.MORPH_MS, 1000);
  assert.equal(MELT.HOLD_MS, 1200);
  assert.equal(MELT.MORPH_MS + MELT.HOLD_MS, 2200);
  // The blur scales with today's type: last year's 96 px keeps it all, a phone's 40 px line a little over 40% of it.
  assert.equal(meltBlurScale(96), 1);
  assert.equal(meltBlurScale(200), 1);
  assert.equal(meltBlurScale(82), 82 / 96);
  assert.equal(meltBlurScale(40), 40 / 96);
  assert.equal(meltBlurScale(10), 0.4);
  assert.equal(meltBlurScale(NaN), 1);
});

test('v3 melts on the same settle and pause rules as option C, with a 2.2 s beat, and loops', (t) => {
  t.after(() => mock.timers.reset());
  const rule = { ...RULE, HOLD_MS: MELT.HOLD_MS };
  mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
  const changes = [];
  const lands = [];
  const cycle = createHeroCycle({ count: HERO_PHRASES_V2.length, rule, landMs: () => MELT.MORPH_MS, now: () => Date.now(), onChange: (c) => changes.push(Date.now()), onLand: () => lands.push(Date.now()) });
  const to = (ms) => { while (Date.now() < ms) mock.timers.tick(1); };
  to(100); cycle.painted(100); cycle.fontsReady(); cycle.setInView(true);
  to(30000);
  assert.ok(changes[0] - 100 <= 2200, `the first melt starts ${changes[0] - 100} ms after first paint`);
  for (let k = 1; k < changes.length - 1; k++) assert.equal(changes[k] - changes[k - 1], MELT.MORPH_MS + MELT.HOLD_MS, 'a new phrase every 2.2 s');
  assert.ok(changes.length >= 12, `${changes.length} melts in 30 s: it loops`);
  // A scroll pauses it: nothing starts while the page moves, and it starts again after QUIET + READ.
  const n = changes.length;
  for (let ms = 30100; ms <= 34000; ms += 100) { to(ms); cycle.input(); }
  assert.ok(changes.length - n <= 1, 'at most the melt in flight');
  const m = changes.length;
  to(34000 + RULE.QUIET_MS + RULE.READ_MS + MELT.MORPH_MS + 10);
  assert.ok(changes.length > m, 'it starts again once the page is still');
  cycle.dispose();
});

test('v3 component: only the motion changes; nothing runs between melts; Reduce motion keeps one still line', () => {
  // Today's markup: the same classes, one stable sentence for readers, hidden layers, no live region.
  assert.match(MELT_JSX, /<span className="lp-sr">\{phrases\[0\]\}<\/span>/);
  assert.match(MELT_JSX, /<span ref=\{cellRef\} className="lp-morph__cell" aria-hidden="true">/);
  assert.match(MELT_JSX, /className="lp-title__line lp-morph lp-morph--melt"/);
  assert.doesNotMatch(MELT_JSX, /aria-live=/);
  assert.match(MELT_JSX, /phrases\.map\(\(p\) => <span key=\{`size-\$\{p\}`\} className="lp-morph__phrase" data-state="size">/, 'every phrase holds the cell: no layout shift');
  // The frame loop exists only inside a melt: it is started in the melt's layout effect, stops itself at f = 1, and is
  // cancelled on cleanup; the rest phase renders plain text and nothing else runs.
  assert.match(MELT_JSX, /if \(phase !== 'melt'\) return undefined;/);
  assert.match(MELT_JSX, /raf = f < 1 \? window\.requestAnimationFrame\(frame\) : 0;/);
  assert.match(MELT_JSX, /return \(\) => \{ if \(raf\) window\.cancelAnimationFrame\(raf\); \};/);
  assert.equal((MELT_JSX.match(/window\.requestAnimationFrame\(/g) || []).length, 3, 'one for first paint (two frames), one in the melt loop; none in a hold');
  assert.doesNotMatch(MELT_JSX, /setInterval/);
  // will-change only while the layers exist; blur and opacity from script, never from the stylesheet.
  assert.match(MELT_JSX, /out\.style\.willChange = 'opacity, filter';/);
  assert.doesNotMatch(CSS.replace(/\/\*[\s\S]*?\*\//g, ''), /will-change|filter|blur\(/);
  // The same settle, pause and visibility inputs as option C.
  assert.match(MELT_JSX, /\['scroll', 'wheel', 'touchstart', 'touchmove'\]\) window\.addEventListener\(type, input, passive\)/);
  assert.match(MELT_JSX, /const SCROLL_KEYS = new Set\(\[' ', 'PageDown', 'PageUp', 'ArrowDown', 'ArrowUp', 'Home', 'End'\]\)/);
  assert.match(MELT_JSX, /entry\.intersectionRatio >= 0\.99/);
  assert.match(MELT_JSX, /document\.fonts\?\.ready/);
  assert.match(MELT_JSX, /'first-contentful-paint'/);
  assert.match(MELT_JSX, /visibilitychange/);
  assert.match(MELT_JSX, /matchMedia\('\(prefers-reduced-motion: reduce\)'\)/);
  assert.match(MELT_JSX, /root\.dataset\.motion === 'reduced'/);
  assert.match(MELT_JSX, /new CustomEvent\('pip:glance'/);
  assert.match(MELT_JSX, /const RULE_MELT = Object\.freeze\(\{ \.\.\.RULE, HOLD_MS: MELT\.HOLD_MS \}\);/);
  // Nothing is left behind under Reduce motion.
  assert.match(CSS, /@media \(prefers-reduced-motion: reduce\) \{\n\s+\.lp-morph--melt \.lp-morph__phrase\[data-state='melt-out'\]/);
  assert.match(CSS, /:root\[data-motion='reduced'\] \.lp-morph--melt \.lp-morph__phrase\[data-state='melt-in'\] \{ display: none; \}/);
});
