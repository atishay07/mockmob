// node --test src/components/landing/heroPhrases.test.mjs
// The hero headline's changing line (L-016, D38): few phrases, each true and one line long, one static sentence for
// screen readers and search, the agreed motion, and nothing moving under Reduce motion. Source-level, no server.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HERO_LINES, HERO_PHRASES, HERO_SENTENCE, MORPH, changeSpanMs, mayMorph, nextPhrase, phraseWords } from './heroPhrases.mjs';
import { marksLedger, labStory } from './labStory.mjs';
import { ONBOARDING_LEAD } from '../../lib/paperCopy.mjs';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const PAGE = read('../../app/page.js');
const MORPH_JSX = read('HeroMorph.jsx');
const CSS = read('../../app/hero-motion.css');

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
  assert.match(PAGE, /<span className="lp-title__line lp-title__brand">\{HERO_LINES\[0\]\}<\/span>\s*<span className="lp-title__line">\{HERO_LINES\[1\]\}<\/span>\s*<HeroMorph \/>/);
  assert.match(MORPH_JSX, /<span className="lp-sr">\{phrases\[0\]\}<\/span>/);
  assert.match(MORPH_JSX, /<span className="lp-morph__cell" aria-hidden="true">/);
  assert.doesNotMatch(MORPH_JSX, /aria-live/);
});
