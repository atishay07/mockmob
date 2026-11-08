// Key cards on the home page (R3-D10, owner LK112, 5 Nov 2026): the rules the section must keep. Source and pure-module
// checks with node:test; the look is checked in real Chrome (tmp/r3/cards, docs/design-decisions/web-r3-cards.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadDecks, keyCardsEnabled } from '../../lib/server/keycards.js';
import { KIND_LABELS, schedule, tasteIds } from '../../../data/keycards.js';
import { WORDS, backLine, returnWords } from '../../../data/learn/words.js';
import { RATINGS } from '../keycards/kinds.js';
import { KEY_CARD_PICKS, bankOf, keyCardsDemo, pickKeyCards, picksAreFree, ratingKeys, sourceOf } from './keyCardsPicks.mjs';
import { KEY_CARDS_HEAD, KEY_CARDS_WORDS, BANK_WORDS, backRow, cardOf } from './keyCardsCopy.mjs';
import { COPY_BUDGET, wordCount } from './homeCopy.mjs';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const PAGE = read('../../app/page.js');
const DEMO = read('KeyCardsDemo.jsx');
const CSS = strip(read('key-cards.css'));
const LANDING_CSS = strip(read('../../app/landing.css'));
const DECKS = loadDecks({ log: () => {} });

// ------------------------------------------------------------------------------------------------ real cards, never invented
test('the five picks are real served cards, three Accountancy then English in turn, and every one is a Free taste card', () => {
  assert.equal(KEY_CARD_PICKS.length, 5);
  const cards = pickKeyCards(DECKS);
  assert.equal(cards.length, 5, 'every pick is in the served decks (sha256-checked, tiers applied)');
  assert.deepEqual(cards.map((c) => c.subject), ['accountancy', 'english', 'accountancy', 'english', 'accountancy']);
  // "Sign up free to keep going" is literal: a free account opens exactly these cards (the first Must-know cards of their chapter).
  assert.equal(picksAreFree(DECKS), true);
  for (const id of KEY_CARD_PICKS) {
    const card = DECKS.byId.get(id);
    const chapter = DECKS.bySubject.get(card.subject).cards.filter((c) => c.chapterKey === card.chapterKey);
    assert.ok(tasteIds(chapter).has(id), `${id} is a Free taste card`);
  }
});

test('each card shows the deck\'s own words: the back verbatim, the front only without the kind word it repeats', () => {
  for (const card of pickKeyCards(DECKS)) {
    const served = DECKS.byId.get(card.id);
    assert.equal(card.back, served.back, `${card.id}: the back is the deck's`);
    const bare = served.front.replace(/^formula\s*:\s*/i, '');
    assert.equal(card.front, bare.charAt(0).toUpperCase() + bare.slice(1), `${card.id}: the front is the deck's`);
    assert.equal(card.label, KIND_LABELS[served.kind]);
    assert.equal(card.note, served.note ? served.note.trim() : null);
    assert.equal(card.source, sourceOf(served.source));
    assert.ok(card.front.length <= 90 && card.back.length <= 110, `${card.id} is short enough for a 360 px phone`);
  }
  // An NCERT card cites its book page as the app does; a WordNet meaning says so; the English deck's own cards carry no line.
  const [debenture, concise, , usage] = pickKeyCards(DECKS);
  assert.equal(debenture.source, 'Accountancy Part 2, Ch 2, p. 75');
  assert.equal(concise.source, 'Meaning from WordNet');
  assert.equal(usage.source, null);
});

test('no invented text: the section\'s files never type a card\'s words, only the picks\' ids', () => {
  for (const card of pickKeyCards(DECKS)) {
    // keyCardsPicks.mjs names the picks by id ("usage-principal-principle"), so a one-word back is looked for in the others only.
    const sources = card.back.length >= 15 ? [PAGE, DEMO, read('keyCardsCopy.mjs'), read('keyCardsPicks.mjs')] : [PAGE, DEMO, read('keyCardsCopy.mjs')];
    for (const src of sources) assert.ok(!src.includes(card.back), `${card.id}'s back is not typed in a source file`);
    for (const src of [PAGE, DEMO, read('keyCardsCopy.mjs'), read('keyCardsPicks.mjs')]) assert.ok(!src.includes(card.front), `${card.id}'s front is not typed in a source file`);
  }
});

test('a missing deck or pick drops the cards, and with none at all there is no section', () => {
  const none = { byId: new Map(), bySubject: new Map() };
  assert.equal(keyCardsDemo({ decks: none, log: () => {} }), null);
  assert.deepEqual(pickKeyCards(DECKS, ['kc.nope', KEY_CARD_PICKS[0]]).map((c) => c.id), [KEY_CARD_PICKS[0]]);
  assert.match(PAGE, /const KEY_CARDS_LIVE = process\.env\.KEY_CARDS_ENABLED === 'true';/);
  assert.equal(keyCardsEnabled({ KEY_CARDS_ENABLED: 'true' }), true, 'the same switch every Key cards route reads');
  assert.match(PAGE, /const KEY_CARDS = KEY_CARDS_LIVE \? keyCardsDemo\(\) : null;/);
  assert.match(PAGE, /\{KEY_CARDS \? \(\s*<section className="lp-sec lp-kc" id="key-cards"/);
});

// ------------------------------------------------------------------------------------------------ the keys and the numbers
test('the rating keys are the app\'s (Missed it, Got it, Easy) with when each comes back, from the scheduler the app rates with', () => {
  const at = Date.parse('2026-11-05T10:00:00+05:30');
  const keys = ratingKeys(at);
  assert.deepEqual(keys.map((k) => k.rating), RATINGS.map((r) => r.rating));
  assert.deepEqual(keys.map((k) => k.label), [WORDS.missedIt, 'Got it', 'Easy']);
  assert.deepEqual(keys.map((k) => k.label), RATINGS.map((r) => r.label));
  for (const key of keys) assert.equal(key.when, backLine(returnWords(schedule(null, key.rating, at).interval_days)));
  assert.deepEqual(keys.map((k) => k.when), ['back tomorrow', 'back in 3 days', 'back in 8 days'], 'a new card, today');
  assert.ok(!/back tomorrow|in 3 days|in 8 days/.test(strip(DEMO + read('keyCardsCopy.mjs'))), 'the words are worked out, never typed');
});

test('the bank line counts the served decks; Free\'s share is the taste rule; nothing in the copy is a typed number', () => {
  const bank = bankOf(DECKS);
  let cards = 0;
  for (const { cards: list } of DECKS.bySubject.values()) cards += list.length;
  assert.deepEqual(bank, { cards, subjects: DECKS.bySubject.size, taste: 5 });
  assert.ok(bank.cards > 10000 && bank.subjects >= 14);
  const literals = [...strip(read('keyCardsCopy.mjs')).matchAll(/'([^'\n]*)'|`([^`]*)`/g)].map((m) => (m[1] ?? m[2]).replace(/\$\{[^}]+\}/g, ''));
  assert.ok(literals.length > 10);
  for (const text of literals.filter((t) => !t.startsWith('../'))) assert.doesNotMatch(text, /\d/, `no typed number in the section copy: ${text}`);
  assert.equal(BANK_WORDS.free(5), 'Free gives you 5 Must-know cards in every chapter, Pro every card.');
  assert.equal(cardOf(2, 5), 'Card 2 of 5');
  assert.equal(backRow(1, 'back tomorrow'), '1 card back tomorrow');
  assert.equal(backRow(3, 'back in 3 days'), '3 cards back in 3 days');
  assert.match(DEMO, /<b><CountUp value=\{bank\.cards\} \/><\/b>\{BANK_WORDS\.across\}<b><CountUp value=\{bank\.subjects\} \/><\/b>/);
});

// ------------------------------------------------------------------------------------------------ copy rules
test('the head keeps the page\'s copy rules: a sub of at most 20 words, sentence case, no dots, no exclamation marks, no arrows', () => {
  assert.ok(wordCount(KEY_CARDS_HEAD.sub) <= COPY_BUDGET.sub, `${wordCount(KEY_CARDS_HEAD.sub)} words`);
  const all = [...Object.values(KEY_CARDS_HEAD), ...Object.values(KEY_CARDS_WORDS), BANK_WORDS.across, BANK_WORDS.subjects, BANK_WORDS.free(5)];
  for (const text of all) {
    assert.doesNotMatch(text, /[·•!→←↗]|->/, text);
    assert.doesNotMatch(text, /^[A-Z\s]{4,}$/, `${text} is not ALL CAPS`);
  }
  assert.equal(KEY_CARDS_WORDS.turnOver, WORDS.turnOver, 'the app\'s word for the turn');
  assert.equal(KEY_CARDS_WORDS.turnCue, WORDS.turnCue);
  assert.equal(KEY_CARDS_WORDS.keepGoing, 'Sign up free to keep going');
});

test('the stamp (R3-D2): the Key cards desk object at 28 px and the product\'s name in the brand word colour, above the h2', () => {
  assert.match(PAGE, /<p className="lp-kc__stamp"><BrandIcon name="keycards" size=\{32\} style=\{\{ '--bi-size': '28px' \}\} \/>\{KEY_CARDS_HEAD\.stamp\}<\/p>\s*<h2 className="lp-h2" id="key-cards-title">/);
  assert.equal(KEY_CARDS_HEAD.stamp, 'Key cards');
  assert.match(CSS, /\.lp-kc__stamp \{[^}]*color: var\(--brand-word\);/);
  assert.doesNotMatch(CSS, /\.lp-kc__stamp \{[^}]*text-transform/, 'sentence case, no caps');
});

// ------------------------------------------------------------------------------------------------ placement and size
test('the section sits right after the Score Recovery Lab and before Compass, with its own reserved height on both widths', () => {
  const recovery = PAGE.indexOf('id="score-recovery-lab"');
  const cards = PAGE.indexOf('id="key-cards"');
  const compass = PAGE.indexOf('id="compass"');
  assert.ok(recovery > 0 && cards > recovery && compass > cards);
  assert.equal((PAGE.match(/id="key-cards"/g) || []).length, 1, 'one section block');
  const wide = LANDING_CSS.indexOf('@media (min-width: 960px) {\n  .lp main > #inside-the-lab');
  assert.ok(wide > 0, 'the reserved heights block is found');
  const phone = LANDING_CSS.slice(LANDING_CSS.indexOf('.lp main > :is(.lp-sec, .lp-close)'), wide);
  const desktop = LANDING_CSS.slice(wide, LANDING_CSS.indexOf('\n}', wide));
  assert.match(phone, /\.lp main > #score-recovery-lab \{[^}]*\}\n\.lp main > #key-cards \{ contain-intrinsic-size: auto \d+px; \}/);
  assert.match(desktop, /\.lp main > #score-recovery-lab \{[^}]*\}\n {2}\.lp main > #key-cards \{ contain-intrinsic-size: auto \d+px; \}/);
});

test('the reserved height is measured for each width band the section changes in (review fix, 5 Nov; re-measured R4, 6 Nov)', () => {
  // Content height (section minus its padding), measured by width with tmp/r4/intrinsic.cjs (round 4, 6 Nov 2026: the phone
  // gaps are one 20 px step, the demo column is 31 rem from 1100 and 36 rem from 1440, the h2 about 72 px): 852 px at 360,
  // 826 px at 375, 802 px at 390; 508 px at 1024, 688 px at 1100, 549 px at 1280, 575 px at 1440; 585 px from 1920 (18 px
  // root), 774 px from 2560 (22 px root).
  const at = (re) => { const m = LANDING_CSS.match(re); assert.ok(m, `a reserved value for ${re}`); return [Number(m[1]), m.index]; };
  const [at390] = at(/\n\.lp main > #key-cards \{ contain-intrinsic-size: auto (\d+)px; \}/);
  const [at375, i375] = at(/@media \(max-width: 383px\) \{ \.lp main > #key-cards \{ contain-intrinsic-size: auto (\d+)px; \} \}/);
  const [at360, i360] = at(/@media \(max-width: 361px\) \{ \.lp main > #key-cards \{ contain-intrinsic-size: auto (\d+)px; \} \}/);
  const [atDesk] = at(/\n {2}\.lp main > #key-cards \{ contain-intrinsic-size: auto (\d+)px; \}/);
  const [at1100, i1100] = at(/@media \(min-width: 1100px\) \{ \.lp main > #key-cards \{ contain-intrinsic-size: auto (\d+)px; \} \}/);
  const [at1280, i1280] = at(/@media \(min-width: 1280px\) \{ \.lp main > #key-cards \{ contain-intrinsic-size: auto (\d+)px; \} \}/);
  const [at1440, i1440] = at(/@media \(min-width: 1440px\) \{ \.lp main > #key-cards \{ contain-intrinsic-size: auto (\d+)px; \} \}/);
  const [at1920, i1920] = at(/@media \(min-width: 1920px\) \{ \.lp main > #key-cards \{ contain-intrinsic-size: auto (\d+)px; \} \}/);
  const [at2560, i2560] = at(/@media \(min-width: 2560px\) \{ \.lp main > #key-cards \{ contain-intrinsic-size: auto (\d+)px; \} \}/);
  assert.deepEqual([at360, at375, at390, atDesk, at1100, at1280, at1440, at1920, at2560], [852, 826, 802, 508, 688, 549, 575, 585, 774]);
  // Later bands must follow the ones they narrow, or the wider value wins.
  assert.ok(i360 > i375, 'the 361 px band follows the 383 px one');
  assert.ok(i1100 > LANDING_CSS.indexOf('  .lp main > #key-cards') && i1280 > i1100 && i1440 > i1280 && i1920 > i1440 && i2560 > i1920, 'the wide bands follow the 960 px block, in order');
});

// ------------------------------------------------------------------------------------------------ the flip and its motion
test('the card turns in 3D: 600 ms on cubic-bezier(.4,0,.2,1), perspective 1000 px, both faces backface-hidden', () => {
  assert.match(CSS, /\.kc-demo__arrive \{ perspective: 1000px;/);
  assert.match(CSS, /\.kc-demo__card \{[^}]*transform-style: preserve-3d;[^}]*transition: transform 600ms cubic-bezier\(0\.4, 0, 0\.2, 1\);/);
  assert.match(CSS, /\.kc-demo__card\[data-turned\] \{ transform: rotateY\(180deg\);/);
  assert.match(CSS, /\.kc-demo__face \{[^}]*backface-visibility: hidden; -webkit-backface-visibility: hidden;/);
  assert.match(CSS, /\.kc-demo__face--back \{ transform: rotateY\(180deg\); \}/);
  assert.match(CSS, /\.kc-demo__card \{[^}]*-webkit-tap-highlight-color: transparent;/, 'no blue Android tap flash (the film showed one on Preparoo)');
});

test('reduced motion (the device or the site\'s switch) fades between the faces: no turn, no rise', () => {
  const reduced = CSS.slice(CSS.indexOf('@media (prefers-reduced-motion: reduce)'));
  assert.match(reduced, /\.kc-demo__card, \.kc-demo__card\[data-turned\] \{ transform: none; transition: none; \}/);
  assert.match(reduced, /\.kc-demo__face \{ transition: opacity 200ms ease; \}/);
  assert.match(reduced, /\.kc-demo__card\[data-turned\] \.kc-demo__face--back \{ opacity: 1; \}/);
  assert.match(CSS, /:root\[data-motion='reduced'\] :is\(\.kc-demo__card, \.kc-demo__card\[data-turned\]\) \{ transform: none; transition: none; \}/);
  assert.match(DEMO, /if \(isMotionReduced\(\)\) \{ next\(\); return; \}/, 'the rated card leaves at once');
});

test('the rating keys fade in after the turn (200 ms after 300 ms), Got it is the app\'s volt key with dark ink and its keycap lip', () => {
  assert.match(CSS, /\.kc-demo__rates \{[^}]*animation: kc-keys-in 200ms cubic-bezier\(0\.23, 1, 0\.32, 1\) 300ms both;/);
  assert.match(CSS, /\.kc-demo__rate\[data-rating='3'\] \{[^}]*background: var\(--volt\); color: var\(--volt-ink\);[^}]*0 3px 0 var\(--volt-edge\)/);
  assert.match(CSS, /\.kc-demo__rate \{[^}]*min-height: 60px;/, '44 px targets and more');
  assert.match(DEMO, /role="group" aria-label=\{W\.ratingsLabel\}/);
});

test('the glass is the card front only, over its subject object: blurred, saturated, a hairline and a highlight in both themes', () => {
  const glass = [...CSS.matchAll(/([^{}]+)\{([^{}]*backdrop-filter[^{}]*)\}/g)].map((m) => m[1].trim());
  assert.deepEqual(glass, ['.kc-demo__glass']);
  assert.match(CSS, /\.kc-demo__glass \{[^}]*backdrop-filter: blur\(14px\) saturate\(1\.4\);/);
  assert.match(CSS, /html\[data-theme='light'\] \.kc-demo__glass \{[^}]*inset 0 1px 0 #fff;/);
  assert.match(DEMO, /<Art art=\{card\.art\} \/>\s*<div className="kc-demo__glass">/, 'the art is drawn under the glass');
  assert.match(CSS, /\.kc-demo__face--front \{[^}]*radial-gradient\([^)]*var\(--kc-light\)/, 'the subject light (the app\'s light field), never volt');
});

test('progress: "1 / 5" in words for the eye and "Card 1 of 5" for a screen reader, and dots below in the brand word colour (no second bar, R8 SEC-06)', () => {
  assert.match(DEMO, /<span aria-hidden="true">\{shown\} \/ \{total\}<\/span>\s*<span className="kc-demo__sr">\{cardOf\(shown, total\)\}<\/span>/);
  assert.match(DEMO, /<ol className="kc-demo__pips" aria-hidden="true">/);
  assert.doesNotMatch(DEMO, /kc-demo__bar/, 'one progress cue: the count and the dots, no bar repeating them');
  assert.match(CSS, /\.kc-demo__pips li\[data-state='now'\] \{ background: var\(--brand-word\);/);
});

test('one key under the demo: guest "Sign up free to keep going" (secondary, volt once the five are done), signed in "Open Key cards"', () => {
  assert.match(DEMO, /<Link href=\{isAuthenticated \? '\/cards' : KEEP_GOING_HREF\} className=\{done \? 'mm-btn mm-btn--primary' : 'mm-btn mm-btn--secondary'\}>/);
  assert.match(DEMO, /\{isAuthenticated \? W\.openCards : W\.keepGoing\}/);
  assert.match(DEMO, /\{isAuthenticated \? null : <p className="kc-foot__free">/, 'no Pro line for a signed-in student');
  assert.equal((DEMO.match(/href=/g) || []).length, 1, 'the demo itself links nowhere else');
});

test('"Sign up free to keep going" leads back to Key cards: the guest key carries next=/cards (review fix, 5 Nov)', async () => {
  assert.match(DEMO, /const KEEP_GOING_HREF = signupPathFor\('\/cards'\);/);
  assert.doesNotMatch(DEMO, /wayIn|recoveryReleased/, 'the Recovery way in is not this key');
  const { signupPathFor, safeNextPath } = await import('../../lib/auth-redirect.js');
  assert.equal(signupPathFor('/cards'), '/signup?next=%2Fcards');
  assert.equal(safeNextPath('/cards'), '/cards', 'the signup page keeps /cards as the page to return to');
});

test('no two landing modules differ only by the case of their name (Windows resolves KeyCardsDemo to keyCardsDemo.mjs, Linux does not)', async () => {
  const { readdirSync } = await import('node:fs');
  const stems = readdirSync(new URL('.', import.meta.url)).filter((f) => /\.(jsx?|mjs)$/.test(f) && !/\.test\./.test(f)).map((f) => f.replace(/\.(jsx?|mjs)$/, ''));
  const seen = new Map();
  for (const stem of stems) {
    const key = stem.toLowerCase();
    assert.ok(!seen.has(key) || seen.get(key) === stem, `${stem} and ${seen.get(key)} clash on a case-blind disk`);
    seen.set(key, stem);
  }
});

// ------------------------------------------------------------------------------------------------ review fixes (5 Nov)
test('reduced motion: no section head (.rv.lp-head) keeps the phone blur, under the device setting or the site switch', () => {
  const FT = strip(read('../../app/feature-tour.css'));
  // The phone blur is `.lp .rv.lp-head` (0,3,0) and Reveal never sets data-in under reduced motion, so the lift must name it.
  const reduce = FT.slice(FT.indexOf('@media (prefers-reduced-motion: reduce) {'));
  const block = reduce.slice(0, reduce.indexOf('\n}'));
  assert.match(block, /\.lp \.rv, \.lp \.rv\.lp-head \{ filter: none; \}/);
  assert.ok(FT.indexOf('@media (prefers-reduced-motion: reduce) {') > FT.indexOf('.lp .rv.lp-head { filter: blur(6px)'), 'the lift comes after the blur');
  assert.match(FT, /:root\[data-motion='reduced'\] \.lp \.rv\.lp-head \{ filter: none; \}/);
});

test('one volt in view: the phone dock steps aside while the Key cards demo or its key holds the screen', () => {
  const GATE = read('HeroDockGate.jsx');
  assert.match(GATE, /document\.querySelectorAll\('[^']*\.lp \.kc-demo, \.lp \.kc-foot'\)/);
});
