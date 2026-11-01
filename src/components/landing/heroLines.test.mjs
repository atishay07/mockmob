// node --test src/components/landing/heroLines.test.mjs
// The home hero's static headline and its trust line (R3 rulings H1, H2, H3, H4; 1 Nov 2026). Source-level, no server.
// H1: "CUET 2027. One mock. Know what to fix." does not move: no typing, no caret, no cycling line, no highlight.
// H2: the trust line never breaks inside a segment. H3: the desktop host Mobi stays out of the card's frame.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { HERO_LINES, HERO_SENTENCE } from './heroLines.mjs';
import { heroTrustLine, heroTrustSegments } from './heroTaps.mjs';
import { marksLedger, labStory } from './labStory.mjs';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const PAGE = read('../../app/page.js');
const SCENE = read('../../app/hero-scene.css');
const rules = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

test('H1: the headline is one static sentence, word for word', () => {
  assert.deepEqual([...HERO_LINES], ['CUET 2027.', 'One mock.', 'Know what to fix.']);
  assert.equal(HERO_SENTENCE, 'CUET 2027. One mock. Know what to fix.');
  for (const line of HERO_LINES) {
    assert.match(line, /^[A-Z0-9][A-Za-z0-9 ]+\.$/, `${line} is one plain sentence`);
    assert.doesNotMatch(line, /!|guarantee|unlimited|best|#1/i, line);
  }
});

test('H1: page.js renders the three lines inline with breaks; "CUET 2027." keeps the accent class', () => {
  // The spaces before the breaks keep the sentence for a screen reader and a search engine; the three runs share the
  // h1's own box (one paint for LCP; landing.css .lp-title__line--run).
  assert.match(PAGE, /<span className="lp-title__line lp-title__line--run lp-title__brand">\{HERO_LINES\[0\]\}<\/span>\{' '\}<br \/>\s*<span className="lp-title__line lp-title__line--run">\{HERO_LINES\[1\]\}<\/span>\{' '\}<br \/>\s*<span className="lp-title__line lp-title__line--run">\{HERO_LINES\[2\]\}<\/span>\s*<\/>\}/);
  assert.match(rules(SCENE), /\.mm\.lp \.lp-title__brand \{ color: var\(--accent-text\); \}/, 'CUET 2027 in the accent colour, plain text');
  assert.doesNotMatch(PAGE, /<(a|button|Link)[^>]*>\s*\{?HERO_LINES\[0\]/, 'CUET 2027 is not a button');
});

test('H1: nothing types, cycles or highlights the headline any more', () => {
  const landing = readdirSync(new URL('.', import.meta.url));
  for (const gone of ['HeroMorph.jsx', 'HeroType.jsx', 'HeroLine.jsx', 'HeroMelt.jsx', 'heroPhrases.mjs']) assert.ok(!landing.includes(gone), `${gone} is deleted`);
  assert.ok(!existsSync(new URL('../../app/hero-motion.css', import.meta.url)), 'the headline motion stylesheet is deleted');
  assert.doesNotMatch(PAGE, /HeroMorph|HeroLine|HeroType|HeroMelt|heroMotion|hero-motion|heroPhrases/);
  const title = PAGE.slice(PAGE.indexOf('<h1 className="lp-title">'), PAGE.indexOf('</h1>'));
  assert.doesNotMatch(title, /caret|lp-morph|aria-live|use client/);
  // No stylesheet that the page loads styles a caret, a selection or a morph on the title.
  for (const file of readdirSync(new URL('../../app/', import.meta.url)).filter((f) => f.endsWith('.css'))) {
    assert.doesNotMatch(read(`../../app/${file}`), /lp-morph|lp-type-letter|lp-morph__caret/, file);
  }
});

test('H1: the title\'s only motion is the one entrance rise, never a loop', () => {
  assert.match(SCENE, /\.lp-hero \.lp-title \{ animation: lp-scene-rise 420ms cubic-bezier\(0\.23, 1, 0\.32, 1\) 240ms backwards; \}/);
  assert.doesNotMatch(rules(SCENE), /\.lp-title[^{]*\{[^}]*infinite/);
});

test('"Know what to fix." is true: chapter review names the chapter and the free SWOT gives the sets to do next', () => {
  assert.match(PAGE, /title: 'Know the chapter to fix first\.'/);
  assert.match(read('../../../data/mock_swot.js'), /free: no model and no credit/);
  assert.match(PAGE, /Take a timed mock\. See exactly where every mark went\. Fix the right chapter tonight\./);
  const ledger = marksLedger();
  const story = labStory();
  assert.equal(ledger.gap, story.facts.outOf - story.facts.marks, 'the Lab sorts every missed mark into a group');
});

test('H2: the trust line keeps every segment whole and may wrap only between segments', () => {
  assert.deepEqual(heroTrustSegments('Pro ₹99 once, through 31 July 2027', { monthly: false }), ['Free to start', 'Pro ₹99 once, through 31 July 2027', 'No auto-renewal']);
  assert.deepEqual(heroTrustSegments('Pro ₹99 a month'), ['Free to start', 'Pro ₹99 a month', 'Cancel anytime']);
  assert.deepEqual(heroTrustSegments('', { monthly: false }), ['Free to start', 'No auto-renewal'], 'an empty price leaves no empty segment');
  // The string form is the segments joined with middle dots (and nothing else).
  assert.equal(heroTrustLine('Pro ₹499 once', { monthly: false }), heroTrustSegments('Pro ₹499 once', { monthly: false }).join(' · '));
  // page.js renders each segment in its own nowrap span; the dot rides on the segment before it, so no line starts with one.
  assert.match(PAGE, /heroTrustSegments\(priceLine\(OFFER\), \{ monthly: OFFER\.purchasable === 'monthly' \}\)\.map\(\(part, i, all\) => <Fragment key=\{part\}>\{i > 0 \? ' ' : null\}<span className="lp-trust-line__seg">\{part\}\{i < all\.length - 1 \? ' ·' : ''\}<\/span><\/Fragment>\)/);
  assert.match(rules(SCENE), /\.lp-trust-line__seg \{ white-space: nowrap; \}/);
  // The price words still come from OFFER: nothing is typed into the hero.
  assert.match(PAGE, /priceLine\(OFFER\)/);
  assert.doesNotMatch(PAGE.slice(PAGE.indexOf('lp-trust-line'), PAGE.indexOf('lp-trust-line') + 400), /₹\d|31 July|auto-renewal|Cancel anytime/);
});

test('H3: the desktop host Mobi sits in the gutter, clear of the stage\'s frame, in every desktop range', () => {
  const css = rules(SCENE);
  // His right edge is --gap before the bay's border (the stage's inset frame): no overlap by construction.
  assert.match(css, /left: calc\(-1 \* var\(--bay\) - var\(--gap\) - var\(--mobi-w\)\);/);
  assert.doesNotMatch(css, /left: calc\(36px - var\(--bay\) - var\(--mobi-w\)\)/, 'the old 36 px overlap is gone');
  assert.match(css, /--gap: 12px;/);
  assert.ok(css.includes('--bay: 1.1rem;'), 'the stage frame is 1.1 rem outside it from 761 px (home-refinements.css), so is the host offset');
  assert.ok(read('../../app/home-refinements.css').includes('inset: -1.1rem;'), 'the stage frame inset the host clears');
  // One column (761 to 959 px): smaller, so he still fits the margin beside the frame.
  assert.match(css, /@media \(min-width: 761px\) and \(max-width: 959px\) \{\s*\.lp-mobi--host \{ --mobi-h: 88px; --gap: 6px; \}/);
  // Night's bubble: the app's welcome bubble, near-white ink on the dark card (at least 4.5:1, measured 14.9:1).
  const m = css.match(/:root\[data-theme='dark'\] \.lp-mobi__bubble \{\s*--bub-bg: (#[0-9a-f]{6}); --bub-ink: (#[0-9a-f]{6});/);
  assert.ok(m, 'the Night bubble colours are the two tokens');
  const lum = (hex) => { const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
  const [a, b] = [lum(m[1]) + 0.05, lum(m[2]) + 0.05];
  assert.ok(Math.max(a, b) / Math.min(a, b) >= 4.5, 'Night bubble text contrast is at least 4.5:1');
  // The bubble line fades in from opacity 0 over 210 ms only; it is never left translucent.
  assert.doesNotMatch(css, /\.lp-mobi__bubble[^{]*\{[^}]*opacity: 0\.[0-9]/);
});

test('H4: the Day room poster is a painted image with no overlay of marks; Night\'s empty bubbles are the only drawn ones', () => {
  const room = read('HeroRoom.jsx');
  // Night draws six empty bubbles over its painting; Day draws none: its sheet is painted into the image.
  assert.match(room, /lp-room__paint--night">[\s\S]*<svg className="lp-room__sheet"/);
  assert.doesNotMatch(room.slice(room.indexOf('lp-room__paint--day')), /<svg|<circle/);
});

test('the rules that lived beside the old headline motion survived its deletion (bank line, the sample\'s other-subjects line)', () => {
  const css = rules(SCENE);
  assert.match(css, /\.lp \.lp-bank \{ color: var\(--ink-3\); \}/);
  assert.match(css, /\.lp-stage__other \{ margin: -0\.35rem 0 0; justify-self: center; text-align: center; font-size: 0\.75rem;/);
  assert.match(css, /\.lp-stage__other a \{\s*color: var\(--accent-text\);/);
});
