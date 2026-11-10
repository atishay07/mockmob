// node --test src/components/landing/homeHero.test.mjs
// The home hero, "Desk Light" (4 Nov 2026, SPEC-HOME-1104 packet P2), refined in round 3 (R3-D3, owner LK99/LK100,
// 5 Nov 2026) and round 4 (owner LK117-LK124, 5 Nov 2026: the desktop hero fills the screen, "CUET 2027." highlighted, the
// fact line gone, the features strip and its price hook, a texture behind the hero; docs/design-decisions/
// web-r4-hero.md) and round 5 (owner, 6 Nov 2026: the answer-sheet texture was "very weird": the paper's own grain; the
// highlighter on "CUET 2027." was "not tasteful at all" (LK159): type and colour alone; the drawn line icons were "a
// regression" (LK160): the brand's 3D desk objects again, improved): the LK67 and LK70 measures and the decisions the hero owns (2, 3, 4, 5, 13, 15, 18; decision 12's "no
// ambient pattern" is superseded by the owner's texture request, LK117). Source-level by default; with HOME_HERO_URL set (for example
// http://localhost:3572) it also measures the running page in real Chrome (the shared browser lock, one browser) at
// 390x844, 375x667, 360x640, 412x915 and 1440x900 (LK70: the h1 starts in the first 12 % of the screen, the pitch
// sentence ends by 40 % at 390x844 and 48 % at 360x640, the key by 46 % at 390x844; R3-D3: the lead is two lines at
// 16-17 px on phones and the fact line one line; LK67: the room and Mobi are drawn at every width, Mobi at least 130 px
// tall on phones and 170 px on desktop; the bubble never changes on six real taps).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { HERO_LINES, HERO_SENTENCE, HERO_TYPED } from './heroLines.mjs';
import { DESK_LINES, DESK_NOTE, heroFeatures, heroPriceHook } from './heroTaps.mjs';
import { STRIP_OBJECTS, STRIP_OBJECT_BASE, STRIP_OBJECT_BOX, STRIP_OBJECT_SIZES, STRIP_OBJECT_WIDTHS, stripObjectSrc, stripObjectSrcSet } from './stripObjects.mjs';
import { HERO_LEAD, STATEMENT, LAB_SCENES, buildFaqs, buildTour, LAB_HEAD, EXAM_HEAD, COMPASS_HEAD, BRAND_STAMPS, TOUR_ICON, proPlan } from './homeCopy.mjs';
import { KEY_CARDS_HEAD } from './keyCardsCopy.mjs';
import { MOCK_PACES, perMock } from '../../lib/payments/value.mjs';
import { BLINK_EVERY_MS, GAZE_MAX_PX, GAZE_MEDIA, GLANCE, gazeOffset, glanceOffset } from '../brand/mobiGaze.mjs';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
// The strip's object files (public/art/icons/strip), and a webp's canvas size from its header (VP8X, VP8L or VP8), as
// data/tests/brand_icons_1103.test.mjs reads it. The pixel checks use sharp (Next's own image library) when it loads.
const publicFile = (src) => fileURLToPath(new URL(`../../../public${src}`, import.meta.url));
function webpSize(file) {
  const b = readFileSync(file);
  assert.equal(b.toString('ascii', 0, 4), 'RIFF');
  assert.equal(b.toString('ascii', 8, 12), 'WEBP');
  const kind = b.toString('ascii', 12, 16);
  if (kind === 'VP8X') return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3), alpha: Boolean(b[20] & 0x10) };
  if (kind === 'VP8L') { const v = b.readUInt32LE(21); return { w: 1 + (v & 0x3fff), h: 1 + ((v >> 14) & 0x3fff), alpha: Boolean((v >> 28) & 1) }; }
  return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff, alpha: false };
}
const sharp = await import('sharp').then((m) => m.default, () => null);
const PAGE = read('../../app/page.js');
const HERO = PAGE.slice(PAGE.indexOf('<section className="lp-hero">'), PAGE.indexOf('STATEMENT ('));
const CSS = strip(read('../../app/hero-scene.css'));
const SCALE_CSS = strip(read('../../app/desktop-scale.css'));
const TEXTURE_CSS = strip(read('../../app/brand-texture.css'));
const TEXTURE = read('./BrandTexture.jsx');
const FIGURE_CSS = strip(read('../brand/mobi-figure.css'));
const REACT = read('../brand/MobiReact.jsx');
const MOBI = read('./HeroMobi.jsx');
const BEAT_STRIP = read('./HeroBeatStrip.jsx');
const THEME_CSS = strip(read('../../app/marketing-theme.css'));
const OFFER = { purchasable: 'monthly', monthly: { rupees: 99 }, oneTime: { rupees: 99, expires: '31 July 2027' } };

// ---- Decision 18: every hero string, with where its truth comes from ---------------------------------------------
const FAQ = buildFaqs({ offer: OFFER }).map((f) => f.answer).join(' ');
const TOUR = buildTour({}).map((s) => `${s.title} ${s.body} ${s.lede}`).join(' ');
export const HERO_STRINGS = [
  { text: HERO_SENTENCE, source: 'heroLines.mjs HERO_LINES: the owner-approved sentence (L-016)', holds: () => HERO_SENTENCE === 'CUET 2027. One mock. Know what to fix.' },
  { text: 'Know what to fix.', source: 'the Lab SWOT gives the exact sets to do next, and the statement picks the chapter for tonight (homeCopy LAB_SCENES, STATEMENT; R11 moved this off the tour)', holds: () => LAB_SCENES.some((s) => /exact sets to do next/.test(s.body)) && /picks the chapter for \*tonight/.test(STATEMENT) },
  { text: 'Fresh every time.', source: 'the FAQ: every mock is built fresh from one live question bank (homeCopy buildFaqs)', holds: () => /every mock is built fresh from one live question bank/.test(FAQ) },
  { text: 'Every mark traced.', source: 'the Mistake Lab head (homeCopy LAB_HEAD)', holds: () => LAB_HEAD.h2 === 'Every mark, traced back to a moment.' },
  { text: `${HERO_LEAD.strong}${HERO_LEAD.rest}`, source: 'the Pro plan Mistake Lab line ranks every chapter, and the statement picks the chapter for tonight (homeCopy proPlan, STATEMENT; R11 moved this off the tour)', holds: () => proPlan({}).some((item) => /^Mistake Lab across all your mocks: every chapter/.test(item)) && /picks the chapter for \*tonight/.test(STATEMENT) },
  { text: DESK_LINES.load, source: 'the sample is on the desk: CUET-pattern questions, no signup (DemoDrill DRILL, L-015)', holds: () => /DRILL\.length/.test(read('./DemoDrill.jsx')) },
  { text: DESK_NOTE, source: 'the sample needs no sign-up and opens the reason under every answer (DemoDrill mm-drill__why)', holds: () => /mm-drill__why/.test(read('./DemoDrill.jsx')) },
  { text: DESK_LINES.right, source: 'DemoDrill opens the reason under a right answer (mm-drill__why)', holds: () => /mm-drill__why/.test(read('./DemoDrill.jsx')) },
  { text: DESK_LINES.miss, source: 'DemoDrill opens the reason under a miss too', holds: () => /question\.why/.test(read('./DemoDrill.jsx')) },
  // R8 HERO-03: the end of the five answers the score (heroTaps deskEndState) and points at the readout, which lists the
  // misses (or says there is nothing to flag); the card's own end state offers sign-up as "Sign up free" (LK83, L-015).
  ...['all', 'four', 'three', 'two', 'tough'].map((key) => ({ text: DESK_LINES[key], source: 'the readout under the score lists each miss, or none (DemoDrill mm-drill__readout, deskEndState)', holds: () => /mm-drill__readout/.test(read('./DemoDrill.jsx')) && /deskEndState\(score, DRILL\.length\)/.test(read('./DemoDrill.jsx')) && /<Link href="\/signup" className="mm-btn mm-btn--primary">\s*Sign up free/.test(read('./DemoDrill.jsx')) })),
  { text: DESK_LINES.pick, source: 'a picked subject plays five live questions (DemoDrill chooseSubject, /api/sample)', holds: () => /demoSetUrl\(slug/.test(read('./DemoDrill.jsx')) },
  { text: DESK_LINES.here, source: 'DemoJump points at answer A when the card is already on screen (pointAtAnswer)', holds: () => /sendDemoState\('here', 0\)/.test(read('./DemoJump.jsx')) },
  // Round 4 (LK124): every feature cell says only what its own section says.
  ...heroFeatures({ compass: true, keyCards: true }).map((f) => ({ text: `${f.name}. ${f.line}`, source: {
    'Unlimited mocks': 'Pro: unlimited Quick and Full (homeCopy proPlan); every mock built fresh from one live bank (the FAQ)',
    'Mistake Lab': 'the Mistake Lab head (homeCopy LAB_HEAD)',
    'Exam-day screen': 'the exam section\'s sub (homeCopy EXAM_HEAD): switch to NTA style to rehearse (round 11)',
    'DU Compass': 'the Compass head (homeCopy COMPASS_HEAD)',
    'Ask Mobi': 'the tour\'s Ask Mobi slide (homeCopy buildTour prepos)',
    'Key cards': 'the Key cards head (keyCardsCopy KEY_CARDS_HEAD)',
  }[f.name], holds: () => ({
    'Unlimited mocks': () => proPlan({}).some((item) => /^Unlimited Quick practice and Full mock/.test(item)) && /every mock is built fresh from one live question bank/.test(FAQ),
    'Mistake Lab': () => /traced/.test(LAB_HEAD.h2),
    'Exam-day screen': () => /Switch to NTA style to rehearse/.test(EXAM_HEAD.sub),
    'DU Compass': () => /shortlist/.test(COMPASS_HEAD.h2),
    'Ask Mobi': () => /Ask what to do tonight\. Get one clear step\./.test(buildTour({}).map((t) => t.title).join(' ')),
    'Key cards': () => /^Turn it\. Rate it\./.test(KEY_CARDS_HEAD.h2),
  }[f.name])() })),
  { text: `${heroPriceHook(OFFER, { from: new Date(Date.UTC(2026, 10, 6)) }).lead} ${heroPriceHook(OFFER, { from: new Date(Date.UTC(2026, 10, 6)) }).figure}`, source: 'perMock(offer) at the pricing slider\'s top pace (value.mjs MOCK_PACES), the nearest rupee from 1 up (owner, 7 Nov), never typed', holds: () => { const m = perMock(OFFER, Math.max(...MOCK_PACES), { from: new Date(Date.UTC(2026, 10, 6)) }); return heroPriceHook(OFFER, { from: new Date(Date.UTC(2026, 10, 6)) }).figure === (m.exactPaise >= 100 ? `₹${Math.round(m.exactPaise / 100)}` : m.about); } },
];

test('decision 18: every hero string traces to a source, and each source still says it', () => {
  for (const row of HERO_STRINGS) {
    assert.ok(row.source, `${row.text} has a source`);
    assert.ok(row.holds(), `${row.text} <- ${row.source}`);
    assert.doesNotMatch(row.text, /·|!|guarantee|never repeats/i, row.text);
    // "Unlimited mocks" only ever beside "On Pro" (Free is credits): the USP said truthfully (owner, 16 Oct; L-041).
    if (/unlimited mocks/i.test(row.text)) assert.match(row.text, /On Pro/, row.text);
  }
  assert.deepEqual([...HERO_TYPED], ['Fresh every time.', 'Every mark traced.']);
  for (const p of HERO_TYPED) assert.ok(p.length <= 18, p);
});

test('LK70: the h1 comes first and the lead says what MockMob is, in the server HTML order', () => {
  // Round 4 (LK121): no fact line under the keys. Round 7 (owner, 7 Nov 2026): the film (HeroFilm) took the desk's place,
  // then the features strip (on desktop it sits under the keys by grid area) and the two hero links; after the hero, the
  // college strip, then the desk in its own section#try. The texture is the hero's first child, behind everything.
  assert.doesNotMatch(HERO, /<QuestionBankLine\b|lp-hero__fact/);
  const order = ['<BrandTexture variant="hero" />', '<h1 className="lp-title">', '<p className="lp-lead">', '<div className="lp-cta">', '<HeroFilm />', '<HeroBeatStrip ', '<div className="lp-hero__links">', '</section>', '<CollegeStrip />', '<section className="lp-sec lp-try" id="try"', 'id="try-practice">', '<div className="lp-desk__stage">'];
  let at = -1;
  for (const mark of order) {
    const i = HERO.indexOf(mark);
    assert.ok(i > at, `${mark} comes after the one before it`);
    at = i;
  }
  assert.match(HERO, /<b>\{HERO_LEAD\.strong\}<\/b>\{HERO_LEAD\.rest\}/);
  // R8 HERO-09, CONT-17 (8 Nov 2026): "MockMob is CUET UG mock tests" read as a singular verb on a plural noun.
  assert.equal(HERO_LEAD.strong, 'CUET UG mocks');
  // R3-D3 (LK99): the lead is two lines at 16-17 px on a phone, so at most 76 characters (72 now; measured in Chrome:
  // two lines at 360, 390, 1024 and 1440). The claim is unchanged: the review traces every miss to its chapter.
  assert.equal(`${HERO_LEAD.strong}${HERO_LEAD.rest}`, 'CUET UG mocks that trace every lost mark to its chapter.');
  assert.ok(`${HERO_LEAD.strong}${HERO_LEAD.rest}`.length <= 76);
  // The visual lines read the approved sentence: CUET 2027. in the brand volt (D2, LK82, 5 Nov: #D2F000 Night; Day #526700 since R3-D1, LK101), plain text.
  assert.match(HERO, /<span className="lp-title__line lp-title__brand">\{HERO_LINES\[0\]\}<\/span>\{' '\}\s*<span className="lp-title__line">\{HERO_LINES\[1\]\}<\/span>\{' '\}/);
  assert.match(HERO, /<HeroTyped \/>/);
  assert.match(CSS, /html\[data-theme\] \.mm\.lp \.lp-hero \.lp-title__brand \{ color: #d2f000; font-variant-numeric: lining-nums tabular-nums; letter-spacing: -0\.022em; \}/);
  assert.match(CSS, /html\[data-theme='light'\] \.mm\.lp \.lp-hero \.lp-title__brand \{ color: #526700; \}/);
  assert.deepEqual([...HERO_LINES], ['CUET 2027.', 'One mock.', 'Know what to fix.']);
});

test('LK70 geometry: phone sizes put the words first (h1 39.5 px at 390, the room clamp, the key 56 px)', () => {
  assert.match(CSS, /\.mm\.lp \.lp-hero \{ padding-block: 22px 40px; \}/);
  assert.match(CSS, /font-size: min\(2\.75rem, 11\.3cqi\);/, 'the h1 is 39.5 px at 390 and fits the widest phrase on one line');
  assert.match(CSS, /\.mm\.lp \.lp-hero \.lp-title__line \{ display: block; white-space: nowrap; \}/);
  assert.match(CSS, /grid-template-areas: 'copy' 'film' 'strip' 'links';/, 'phones: the words, the film, the features strip, the two links');
  assert.match(CSS, /grid-template-areas: 'copy film' 'strip strip' 'links links';/, 'desktop: the film beside the words; the strip and the links full width under both (owner, 7 Nov 2026)');
  // D1 (LK83/LK88, 5 Nov): the volt "Sign up free" at 56 px, the secondary "Try 5 questions first" at 50 px under it.
  assert.match(CSS, /\.mm\.lp \.lp-hero \.lp-cta \.mm-actions > a \{ width: 100%; border-radius: 16px; \}/);
  assert.match(CSS, /\.lp-cta \.mm-actions > a:first-child \{\n\s+min-height: 56px;/);
  assert.match(CSS, /\.lp-cta \.mm-actions > a:nth-child\(2\) \{ min-height: 50px;/);
  // The widest phrase fits (integration, 4 Nov, measured in Chrome): "Every mark traced." is 8.77 em at the phone's
  // -0.035 em tracking and 8.69 em at the desktop's -0.04 em, so 11.3 cqi (phones, tablet) and 11.4 cqi (desktop) keep it
  // under 100 % of the copy column at 360, 390, 768, 1280 and 1440: every typed phrase types and fits its line.
  assert.ok(8.77 * 11.3 < 99.5);
  assert.ok(8.69 * 11.4 < 99.5);
  assert.match(CSS, /\.mm\.lp \.lp-hero \.lp-title \{ font-size: min\(4\.25rem, 11\.3cqi\); \}/, 'tablets: up to 68 px in a 752 px column (round 4)');
  // Round 4 (LK117): the headline fills its column up to 128 px (79 px at 1440, 101 px at 1920, measured), and the hero
  // takes the site-wide desktop container (desktop-scale.css: 3.5 vw gutters, up to 1,680 px), not the guide Mobi's lane.
  assert.match(CSS, /\.mm\.lp \.lp-hero \.lp-title \{ font-size: min\(128px, 11\.4cqi\); line-height: 0\.95; letter-spacing: -0\.04em; \}/);
  assert.match(SCALE_CSS, /html:root \.mm\.lp > main > \.lp-hero > \.mm-wrap\.lp-hero__grid:not\(\.mm-wrap \.mm-wrap\) \{\s*max-width: calc\(var\(--lp-max\) \+ 2 \* var\(--lp-gutter\)\);\s*padding-inline: var\(--lp-gutter\);/);
  assert.ok(0.114 * 629 / 52 > 1.25 && 0.113 * 320 / 28 > 1.25, 'the h1 is at least 1.25x the section h2 at 1280 and at 360');
});

test('R3-D3 (LK99): calmer, Preparoo-clean: a two-line lead at 17 px, one fact line, and a 16/24 px rhythm between the groups', () => {
  // Phones: 16 inside a group (h1 to lead, keys to the fact line), 24 between groups (lead to keys, fact line to desk).
  assert.match(CSS, /\.mm\.lp \.lp-hero \.lp-lead \{\n\s+margin: 16px 0 0;\n\s+max-width: 36ch;\n\s+font-size: 1\.0625rem;/);
  assert.match(CSS, /\.mm\.lp \.lp-hero \.lp-cta \{ margin-top: 24px; \}/);
  assert.doesNotMatch(CSS, /lp-hero__fact|lp-hero__count/, 'round 4 (LK121): the fact line and its rules are gone');
  assert.match(CSS, /\.mm\.lp \.lp-desk \{ --desk-h: clamp\(10\.5rem, 25svh, 13\.25rem\); position: relative; margin: 24px -4px 0;/);
  // Desktop: 24 / 28 / 12, the lead two lines at 20 to 24 px (it grows with the window, round 4).
  assert.match(CSS, /\.mm\.lp \.lp-hero \.lp-lead \{ margin-top: 24px; max-width: 40ch; font-size: clamp\(1\.25rem, 0\.6rem \+ 0\.9vw, 1\.5rem\); line-height: 1\.5; \}/);
  assert.match(CSS, /\.mm\.lp \.lp-hero \.lp-cta \{ margin-top: 28px; \}/);
  // Every gap between the hero's groups sits on the rhythm (no 14, 18, 20, 22 or 26 px stragglers).
  const gaps = [...CSS.matchAll(/\.mm\.lp \.lp-hero (?:\.lp-lead|\.lp-cta) \{[^}]*margin(?:-top)?: (\d+)px/g)].map((m) => Number(m[1]));
  for (const gap of gaps) assert.ok([16, 24, 28].includes(gap), `${gap} px is on the rhythm`);
  assert.doesNotMatch(CSS, /lp-hero__facts/, 'the two-line facts block is gone');
});

test('round 4 (LK124): the features strip, each feature a link to its section, then the honest price hook (supersedes R3-D3\'s number strip)', () => {
  assert.match(HERO, /<HeroBeatStrip items=\{FEATURES\} label=\{HERO_FEATURES_LABEL\} hook=\{PRICE_HOOK\} \/>/, 'inside the hero grid');
  assert.equal((PAGE.match(/<HeroBeatStrip /g) || []).length, 1);
  assert.doesNotMatch(PAGE, /HeroBeatLine|HERO_BEAT_VARIANT|lp-desk--beat|heroBeat\(/);
  assert.doesNotMatch(CSS, /lp-beatline|lp-beat-fill|lp-strip__fig|lp-strip__unit/, 'the number strip\'s rules are gone');
  // No glass or glow; nothing moves.
  const stripCss = CSS.slice(CSS.indexOf('.mm.lp .lp-strip {\n  margin-top: 24px;'), CSS.indexOf('@media (min-width: 640px) and (max-width: 959px)'));
  assert.ok(stripCss.length > 500, 'the strip block');
  assert.doesNotMatch(stripCss, /backdrop-filter|radial-gradient|box-shadow: 0 0 |animation/);
  assert.match(BEAT_STRIP, /<nav className="lp-strip" aria-label=\{label\}>/);
  assert.match(BEAT_STRIP, /<a href=\{item\.href\} className="lp-strip__fact">/);
  // Round 5 (owner, 6 Nov 2026, LK160): each feature's 3D desk object (the next test), beside the words, no tile.
  assert.match(BEAT_STRIP, /<StripObject name=\{item\.icon\} \/>/);
  assert.match(BEAT_STRIP, /<a href=\{hook\.href\} className="lp-strip__hook">/, 'the hook is one link to the slider');
  // Round 4 review (6 Nov): the figure never shows without its pace: the pace follows the unit in the same flow and ink,
  // and the price under it is ink-2 at body size (it was ink-3 at 13 px beside a 36 px figure).
  assert.match(BEAT_STRIP, /<span className="lp-strip__hook-unit">\{hook\.unit\}<\/span>\{' '\}\s*(?:\{\/\*[^*]*\*\/\}\s*)?<span className="lp-strip__hook-at">\{hook\.at\}/);
  assert.match(CSS, /\.mm\.lp \.lp-strip__hook-at \{ font: 650 0\.9375rem\/1\.2 var\(--font-body\); color: var\(--ink\); white-space: nowrap; \}/);
  assert.match(CSS, /\.mm\.lp \.lp-strip__hook-line \{ display: block; margin-top: 4px; font-size: 0\.9375rem; line-height: 1\.4; color: var\(--ink-2\); \}/);
  assert.match(CSS, /\.mm\.lp \.lp-strip__hook-unit, \.mm\.lp \.lp-strip__hook-lead, \.mm\.lp \.lp-strip__hook-at \{ font-size: 1\.0625rem; \}/, 'desktop: the pace as large as the unit');
  assert.doesNotMatch(CSS, /lp-strip__hook-line \{[^}]*(?:ink-3|0\.8125rem)/, 'the price never shrinks to a footnote');
  assert.match(CSS, /\.mm\.lp \.lp-strip__hook-fig \{[^}]*color: var\(--brand-word, var\(--ink\)\);[^}]*font-variant-numeric: lining-nums tabular-nums;/);
  assert.match(CSS, /\.mm\.lp \.lp-strip__list \{ display: grid; grid-template-columns: minmax\(0, 1fr\);/, 'one feature a row on phones');
  assert.match(CSS, /\.mm\.lp \.lp-strip__item:last-child:nth-child\(odd\) \{ grid-column: 1 \/ -1; border-right: 0; \}/, 'tablets: an odd last cell spans the row');
  assert.match(CSS, /\.mm\.lp \.lp-strip__list \{ grid-template-columns: repeat\(3, minmax\(0, 1fr\)\); column-gap: 8px;/, 'three across, full width under the words and the film, from 960 px');
  assert.match(CSS, /@media \(min-width: 1400px\) \{\s*\.mm\.lp \.lp-strip__list \{ grid-template-columns: repeat\(3, minmax\(0, 1fr\)\); column-gap: 4px; \}/, 'three across from 1400 px');
  assert.match(CSS, /\.mm\.lp \.lp-strip__fact \{[^}]*min-height: 44px;/);
  assert.match(CSS, /\.mm\.lp \.lp-strip__hook \{[^}]*min-height: 44px;/);
  assert.match(CSS, /\.mm\.lp \.lp-strip__fact:focus-visible \{ outline: 2px solid var\(--focus-ring, var\(--ink\)\);/);
  assert.match(CSS, /\.mm\.lp \.lp-strip__hook:focus-visible \{ outline: 2px solid var\(--focus-ring, var\(--ink\)\);/);
});

test('round 5 (owner, 6 Nov 2026, LK160): the strip draws the brand\'s 3D desk objects again: the right object, one weight, one baseline, cut for 2x and 3x', async () => {
  // Each feature shows the object that already means it on this page: the section its link opens is stamped with that
  // object (BRAND_STAMPS), the mocks are the tour's Practice object (an answer sheet and a pencil), Ask Mobi is Mobi.
  const features = heroFeatures({ compass: true, keyCards: true });
  const keys = features.map((f) => f.icon);
  // Round 11 (10 Nov 2026): the third object is the exam-day screen's clipboard paper (the brand's `papers`, cut from R7 sheet
  // B like the others), where the Score Recovery Lab's index cards stood.
  assert.deepEqual(keys, ['questions', 'mistakes', 'papers', 'compass', 'mobi', 'keycards']);
  assert.equal(new Set(keys).size, keys.length, 'no two features share an object');
  const stampFor = { '#inside-the-lab': BRAND_STAMPS.lab.icon, '#compass': BRAND_STAMPS.compass.icon, '#key-cards': BRAND_STAMPS.keycards.icon };
  for (const f of features) if (stampFor[f.href]) assert.equal(f.icon, stampFor[f.href], `${f.name}: the object its section is stamped with`);
  assert.equal(features[0].icon, TOUR_ICON.arena, 'Unlimited mocks: the tour\'s Practice object');
  assert.equal(features.find((f) => f.name === 'Ask Mobi').icon, 'mobi', 'Ask Mobi is Mobi himself');
  assert.equal(features.find((f) => f.href === '#exam-experience').icon, 'papers', 'the exam-day screen: a question paper on a clipboard');
  // The files: every width, one 12:11 box, true alpha, small; the srcset names them all, the sizes say the drawn box.
  for (const key of keys) {
    assert.ok(STRIP_OBJECTS[key], `${key} is a strip object`);
    for (const w of STRIP_OBJECT_WIDTHS) {
      const file = publicFile(stripObjectSrc(key, w));
      assert.ok(existsSync(file), `${key}-${w}.webp exists`);
      const size = webpSize(file);
      assert.deepEqual([size.w, size.h], [w, Math.round((w * STRIP_OBJECT_BOX.height) / STRIP_OBJECT_BOX.width)], `${key}-${w}: the 12:11 box`);
      assert.ok(size.alpha, `${key}-${w} keeps its alpha`);
      assert.ok(statSync(file).size < 12 * 1024, `${key}-${w} stays under 12 KB`);
    }
  }
  assert.deepEqual([...STRIP_OBJECT_WIDTHS], [96, 144, 192], '2x and 3x phones get a file cut for them');
  assert.equal(stripObjectSrcSet('compass'), '/art/icons/strip/compass-96.webp 96w, /art/icons/strip/compass-144.webp 144w, /art/icons/strip/compass-192.webp 192w');
  assert.equal(STRIP_OBJECT_SIZES, '(min-width: 3400px) 70px, (min-width: 2560px) 55px, (min-width: 1400px) 45px, 48px', 'the drawn box at every root');
  assert.equal(stripObjectSrc('nope'), null);
  // The markup: one img per feature, its box laid out before it decodes (nothing shifts), decorative, lazy, never dragged.
  for (const attr of ['className="lp-strip__obj"', 'srcSet={stripObjectSrcSet(name)}', 'sizes={STRIP_OBJECT_SIZES}', 'width={STRIP_OBJECT_BOX.width}', 'height={STRIP_OBJECT_BOX.height}', 'alt=""', 'loading="lazy"', 'draggable={false}']) {
    assert.ok(BEAT_STRIP.includes(attr), attr);
  }
  assert.doesNotMatch(BEAT_STRIP, /StripGlyph|featureGlyphs|<svg|MobiMark|BrandIcon/, 'no drawn line set, no flat face mark, no padded 192 px squares');
  assert.ok(!existsSync(new URL('./featureGlyphs.mjs', import.meta.url)), 'the drawn line set is gone');
  // The box: 3rem (2.75rem three across, 2.5rem on the large roots), lifted onto the second line's baseline (the running
  // page test measures it); in rem, so it grows with the page's type; no tile, frame or glow; never a target.
  const objRule = CSS.match(/\.mm\.lp \.lp-strip__obj \{[^}]*\}/)[0];
  for (const decl of ['grid-row: 1 / span 2;', 'align-self: center;', 'width: 3rem;', 'height: auto;', 'translate: 0 -0.25rem;', 'pointer-events: none;']) assert.ok(objRule.includes(decl), decl);
  assert.doesNotMatch(objRule, /background|border|padding|box-shadow|filter|radius/);
  assert.match(CSS, /@media \(min-width: 960px\) \{[^@]*\.mm\.lp \.lp-strip__obj \{ translate: 0 -0\.1875rem; \}/);
  assert.match(CSS, /@media \(min-width: 1400px\) \{[^@]*\.mm\.lp \.lp-strip__fact \{ column-gap: 10px; padding-right: 4px; \}\s*\.mm\.lp \.lp-strip__obj \{ width: 2\.75rem; translate: 0 -0\.125rem; \}/);
  assert.match(CSS, /@media \(min-width: 1920px\) \{\s*\.mm\.lp \.lp-strip__obj \{ width: 2\.5rem; translate: 0 -0\.05rem; \}/);
  assert.doesNotMatch(CSS, /lp-strip__icon|lp-strip__accent/, 'the line set\'s rules are gone');
  // The pixels (when sharp is installed): every object stands on the shared baseline, inside its box, at one size class
  // (round 4 drew 22 to 34 px objects in a padded 36 px square), and the only thing under it is a dark contact shadow.
  if (!sharp) return;
  const f = 192 / STRIP_OBJECT_BOX.width;
  for (const key of keys) {
    const { data, info } = await sharp(publicFile(stripObjectSrc(key, 192))).raw().toBuffer({ resolveWithObject: true });
    let x0 = info.width, x1 = -1, y0 = info.height, y1 = -1, area = 0;
    for (let y = 0; y < info.height; y += 1) {
      for (let x = 0; x < info.width; x += 1) {
        if (data[(y * info.width + x) * 4 + 3] < 200) continue;
        area += 1;
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
    }
    const w = (x1 - x0 + 1) / f, h = (y1 - y0 + 1) / f;
    assert.ok(Math.abs((y1 + 1) / f - STRIP_OBJECT_BASE) <= 1, `${key} stands on the baseline (${((y1 + 1) / f).toFixed(1)})`);
    assert.ok(y0 / f >= 0.5 && x0 >= 0 && x1 < info.width, `${key} inside its box`);
    assert.ok(Math.max(w, h) >= 35 && Math.max(w, h) <= 44, `${key}: ${w.toFixed(1)} x ${h.toFixed(1)} css px`);
    const cssArea = area / (f * f);
    assert.ok(cssArea >= 480 && cssArea <= 950, `${key}: one visual weight (${Math.round(cssArea)} css px of object)`);
    // Under its foot (past its own antialiased edge, one row): only the shadow's dark pixels.
    for (let y = y1 + 2; y < info.height; y += 1) {
      for (let x = 0; x < info.width; x += 1) {
        const i = (y * info.width + x) * 4;
        if (data[i + 3] > 0) assert.ok(data[i] + data[i + 1] + data[i + 2] <= 3 * 60, `${key}: the shadow is dark, never a glow`);
      }
    }
  }
});

test('round 5 (owner, 6 Nov 2026, LK159): "CUET 2027." is the headline\'s anchor by type and colour alone, never a highlighter', () => {
  // A step larger than the lines under it, the brand word colour on the letters (the LK70 test above pins volt in Night and
  // #526700 in Day), always inside the column (5.54 em measured at its tracking).
  assert.match(CSS, /\.mm\.lp \.lp-hero \.lp-title__brand \{ font-size: min\(1\.3em, 18cqi\); \}/);
  assert.match(CSS, /\.mm\.lp \.lp-hero \.lp-title__brand \{ font-size: min\(1\.45em, 17\.4cqi\); line-height: 0\.98; \}/);
  assert.ok(5.54 * 18 < 100 && 5.54 * 17.4 < 100, 'the brand line fits its column at either cap');
  // No marker in any sheet the home page draws: no band, stroke, swoosh, glow, gradient or outline on the line, nothing drawn
  // before or after it, and the old draw-in is gone (round 4's highlighter, which the owner called "not tasteful at all").
  const sheets = ['hero-scene', 'hero-depth', 'home', 'landing', 'home-refinements', 'home-sections', 'desktop-scale', 'marketing-theme', 'marketing'];
  const all = sheets.map((name) => strip(read(`../../app/${name}.css`))).join('\n');
  const brandRules = [...all.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((m) => /lp-title__brand/.test(m[1]));
  assert.ok(brandRules.length >= 3, 'the brand line has its colour and size rules');
  for (const [, sel, body] of brandRules) {
    assert.doesNotMatch(sel, /::?(before|after)/, `${sel.trim()}: nothing drawn around the words`);
    assert.doesNotMatch(body, /background|box-shadow|text-shadow|text-decoration|border|outline|filter|text-stroke|clip-path|mask|gradient|animation|--mark/, `${sel.trim()}: type and colour only`);
  }
  assert.doesNotMatch(all, /@keyframes lp-mark|lp-mark-(in|late)/, 'the highlighter\'s draw-in is gone');
});

test('decision 3: the hero link stays, as an ink underlined text link (round 11: the exam-day screen moved into the strip)', () => {
  assert.match(HERO, /<Link href="\/cuet-cutoff-calculator" className="lp-hero__tool">Free DU eligibility and cutoff calculator<\/Link>/);
  // Round 11 (10 Nov 2026): the strip's third item opens the exam section, so the tray holds the DU calculator alone.
  const tray = HERO.slice(HERO.indexOf('<div className="lp-hero__links">'), HERO.indexOf('</section>'));
  assert.equal((tray.match(/<(?:Link|a) /g) || []).length, 1, 'one link in the tray');
  assert.doesNotMatch(HERO, /lp-hero__exam-link|Try the exam-day screen/);
  assert.ok(heroFeatures({ compass: true, keyCards: true }).some((f) => f.href === '#exam-experience' && f.name === 'Exam-day screen'), 'the strip carries the exam-day screen');
  assert.match(CSS, /\.mm\.lp \.lp-hero__links > a \{[^}]*color: var\(--ink\);[^}]*text-decoration: underline;/);
  assert.match(CSS, /\.mm\.lp \.lp-hero__links > a \{[^}]*min-height: 44px;/);
});

test('round 5 (owner 6 Nov 2026; LK117, supersedes decision 12): the hero\'s texture is the paper\'s own fine grain, never bubbles, a grid, dots or glow', () => {
  // Round 4 (owner, 5 Nov ~11:40 pm): "some sort of texture ... in the background, like we had previously ... in black mode
  // the black space is even more significant". Round 5 (6 Nov): the answer-sheet bubble field "is kind of very weird ... needs
  // to be replaced". The old generic backdrop (grid, dot matrix, volt spotlight) stays gone too.
  assert.match(HERO, /<section className="lp-hero">\s*<BrandTexture variant="hero" \/>/, 'the section\'s first child, behind everything');
  assert.doesNotMatch(HERO, /HeroBackdrop|lp-bg|lp-hero__spot|spotlight/);
  assert.doesNotMatch(PAGE, /<HeroBackdrop/);
  assert.doesNotMatch(CSS, /radial-gradient|rgb\(210 240 0|rgba\(210, 240, 0|#d2f000[^;]*;\s*\}?\s*\/\*\s*glow/i);
  assert.match(CSS, /\.mm\.lp \.lp-hero \{ position: relative; isolation: isolate; \}/);
  // One empty layer hidden from assistive technology: no bubbles, rows, numbers or pattern.
  const code = TEXTURE.replace(/^\s*\/\/.*$/gm, '');
  assert.match(code, /<div className=\{`mm-texture mm-texture--\$\{variant\}`\} aria-hidden="true" \/>/);
  assert.doesNotMatch(code, /<ellipse|<pattern|<text|mm-texture__(num|ring|mark)/);
  assert.doesNotMatch(code + TEXTURE_CSS, /d2f000|210, 240, 0|volt|animation|transition|blur\(/i, 'never volt, never moving, never a blur');
  assert.match(TEXTURE_CSS, /\.mm-texture \{[^}]*position: absolute;[^}]*z-index: -1;[^}]*pointer-events: none;/);
  // The grain: a pre-drawn noise tile (an SVG feTurbulence image the browser rasterises once, tiled seamlessly) used as a
  // mask over plain colour; no live CSS filter, no blend mode, nothing repainted on scroll.
  assert.equal((TEXTURE_CSS.match(/feTurbulence type='fractalNoise'/g) || []).length, 2, 'a light and a dark half of one noise');
  assert.equal((TEXTURE_CSS.match(/stitchTiles='stitch'/g) || []).length, 2, 'seamless tiles');
  const seeds = TEXTURE_CSS.match(/seed='\d+'/g) || [];
  assert.equal(seeds.length, 2);
  assert.equal(new Set(seeds).size, 1, 'the same noise, so a light speck and a dark speck never share a grain');
  assert.doesNotMatch(TEXTURE_CSS, /(^|[;{\s])(filter|backdrop-filter|mix-blend-mode):/m);
  assert.match(TEXTURE_CSS, /mask-size: 256px 256px, 100% 100%, 100% 100%;/);
  assert.match(TEXTURE_CSS, /mask-composite: intersect, intersect;/);
  assert.match(TEXTURE_CSS, /-webkit-mask-composite: source-in, source-in;/);
  // It fades in under the nav and out over the hero's last quarter, so the hero meets the statement on plain paper.
  assert.match(TEXTURE_CSS, /linear-gradient\(to bottom, transparent 0, #000 40px, #000 76%, transparent 100%\)/);
  // Light and dark specks cancel, so the grain never lifts or darkens the ground into a patch (no glow, no wash); and Night
  // carries it more than Day. Levels = alpha x (speck colour - ground), from the theme tokens.
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const token = (theme, name) => THEME_CSS.match(new RegExp(`html\\[data-theme='${theme}'\\] \\.mm \\{[^}]*--${name}: ([^;]+);`))[1].trim();
  const night = { ground: lum(hex(token('dark', 'paper'))), tint: lum(token('dark', 'tint').split(' ').map(Number)) };
  const day = { ground: lum(hex(token('light', 'paper'))), raised: lum(hex(token('light', 'paper-raised'))), tint: lum(token('light', 'tint').split(' ').map(Number)) };
  const nightRule = TEXTURE_CSS.match(/:root\[data-theme='dark'\] \.mm-texture \{ --grain-hi: rgb\(var\(--tint, [\d ]+\) \/ ([\d.]+)\); --grain-lo: rgb\(0 0 0 \/ ([\d.]+)\); \}/);
  assert.ok(nightRule, 'the Night grain');
  const dayHi = Number(TEXTURE_CSS.match(/--grain-hi: color-mix\(in srgb, var\(--paper-raised, #fffdf8\) (\d+)%, transparent\);/)[1]) / 100;
  const dayLo = Number(TEXTURE_CSS.match(/--grain-lo: rgb\(var\(--tint, 23 21 15\) \/ ([\d.]+)\);/)[1]);
  const nightUp = Number(nightRule[1]) * (night.tint - night.ground);
  const nightDown = Number(nightRule[2]) * night.ground;
  const dayUp = dayHi * (day.raised - day.ground);
  const dayDown = dayLo * (day.ground - day.tint);
  assert.ok(Math.abs(nightUp - nightDown) <= 0.1 * nightUp, `Night balanced: +${nightUp.toFixed(1)} / -${nightDown.toFixed(1)} levels`);
  assert.ok(Math.abs(dayUp - dayDown) <= 0.1 * dayUp, `Day balanced: +${dayUp.toFixed(1)} / -${dayDown.toFixed(1)} levels`);
  assert.ok(nightUp > dayUp, 'Night carries it more');
  assert.ok(nightUp <= 20 && dayUp <= 12, 'a few levels: grain, never a pattern that competes with the words');
  // Where it shows: the lamp's falloff, strongest around the desk (from 960 px the right column), softer toward the words.
  assert.match(TEXTURE_CSS, /--grain-falloff: radial-gradient\(ellipse 160% 46% at 85% 4%, #000 35%, transparent 100%\);/);
  assert.match(TEXTURE_CSS, /@media \(min-width: 960px\) \{\s*\.mm-texture--hero \{ --grain-falloff: radial-gradient\(ellipse 72% 120% at 78% 40%, #000 38%, rgba\(0, 0, 0, 0\.5\) 72%, transparent 100%\); \}/);
  assert.match(TEXTURE_CSS, /@media \(prefers-contrast: more\) \{ \.mm-texture \{ opacity: 0\.5; \} \}/);
  assert.match(TEXTURE_CSS, /@media \(forced-colors: active\) \{ \.mm-texture \{ display: none; \} \}/);
});

test('decision 4: the spotlight became his gaze: fine pointers only, at most 2.5 px, one rAF per move, on screen only', () => {
  assert.equal(GAZE_MEDIA, '(hover: hover) and (pointer: fine)');
  assert.equal(GAZE_MAX_PX, 2.5);
  const box = { left: 0, top: 0, width: 150, height: 180 };
  for (const at of [[5000, 81], [-5000, -800], [75, 3000], [76, 82]]) {
    const [x, y] = gazeOffset(at, box);
    const screen = Math.hypot(x, y) * (180 / 168);
    assert.ok(screen <= GAZE_MAX_PX + 0.01, `${at}: ${screen} px`);
  }
  assert.deepEqual(gazeOffset([75, 81], box), [0, 0], 'a pointer on his eyes moves nothing');
  // MobiReact: the listener is added only when the media query matches, while he is live, and never under Reduce motion.
  const gaze = REACT.slice(REACT.indexOf('// The gaze:'), REACT.indexOf('const accessibleName'));
  assert.match(gaze, /if \(!gaze \|\| !live \|\| prefs\.reduced \|\| typeof window\.matchMedia !== 'function'\) return undefined;\n\s+if \(!window\.matchMedia\(GAZE_MEDIA\)\.matches\) return undefined;/);
  assert.match(gaze, /if \(raf\) return;\n\s+raf = window\.requestAnimationFrame/);
  assert.match(gaze, /window\.addEventListener\('pointermove', onMove, \{ passive: true \}\);/);
  // One translate on the eye group, in the drawing's units.
  assert.match(FIGURE_CSS, /\.mobi-react \.mb-svg g\[clip-path\$='eyes\)'\] > g \{\n\s+translate: calc\(var\(--gx, 0px\) \+ var\(--glx, 0px\)\) calc\(var\(--gy, 0px\) \+ var\(--gly, 0px\)\);/);
  assert.match(MOBI, /<Rig act=\{act\} size=\{SIZE\} interactive idle="css" gaze /);
});

test('decision 5: when a typed phrase completes he glances 2 px at the h1 (140 ms in, 160 ms back) and nods on the final one', () => {
  assert.deepEqual({ ...GLANCE }, { px: 2, inMs: 140, holdMs: 260, outMs: 160 });
  const fig = { left: 800, top: 300, width: 150, height: 180 };
  const h1 = { left: 100, top: 180, width: 528, height: 270 };
  const [x, y] = glanceOffset(h1, fig);
  assert.ok(x < 0, 'toward the h1, which is to his left');
  assert.ok(Math.abs(Math.hypot(x, y) * (180 / 168) - 2) < 0.02, 'two screen pixels');
  assert.match(MOBI, /window\.addEventListener\(HERO_TYPED_EVENT, onTyped\)/);
  assert.match(MOBI, /export const HERO_TYPED_EVENT = 'mm:hero-typed';/);
  assert.match(MOBI, /if \(event\.detail\?\.final\) setAct\(\(current\) => \(current === 'nod' \? current : 'nod'\)\);/);
  assert.match(read('./HeroTyped.jsx'), /new CustomEvent\('mm:hero-typed', \{ detail: \{ index: HERO_SLOT_PHRASES\.indexOf\(phrases\[s\.phrase\]\), final: s\.final \} \}\)/, 'P3 sends the event Mobi listens for');
});

test('perf: between acts the rig runs no frame loop; he breathes and blinks in CSS', () => {
  assert.match(REACT, /const loop = cssIdle \? createActLoop\(\(\) => simRef\.current, draw\) : createLoop\(\(\) => simRef\.current, draw\);/);
  const loop = REACT.slice(REACT.indexOf('function createActLoop'));
  assert.doesNotMatch(loop, /setTimeout|idleWait|elapse/, 'no idle beats are scheduled');
  assert.equal(BLINK_EVERY_MS, 4200);
  assert.match(FIGURE_CSS, /animation: mb-breathe 3\.6s ease-in-out infinite;/);
  assert.match(FIGURE_CSS, /@keyframes mb-breathe \{ 50% \{ transform: scale\(1\.004, 1\.012\); \} \}/, 'transform only, at most 1.012');
  assert.match(FIGURE_CSS, /@media \(prefers-reduced-motion: no-preference\) \{\n\s+:root:not\(\[data-motion='reduced'\]\) \.mobi-react\[data-idle='css'\]\[data-live='true'\]:not\(\[data-acting\]\) \.mobi-react__look/);
});

test('decision 15: one volt key per viewport: the bar\'s Sign up free is the raised-paper secondary', () => {
  const nav = read('../NavBar.jsx');
  // The label is the home page's (LK83/LK88, night 1105 R2-B; it said Start free before). The rule pinned here is unchanged.
  assert.match(nav, /<Link href="\/signup" className="mm-btn mm-btn--secondary mm-nav__cta">\s*Sign up free\s*<\/Link>/);
  assert.doesNotMatch(nav, /mm-nav__cta[^"]*mm-btn--primary|mm-btn--primary[^"]*mm-nav__cta/);
  assert.match(read('../LandingActions.jsx'), /className=\{heroKey\}/, 'the hero key steps down once the sample is answered');
  assert.match(read('./DemoDrill.jsx'), /<button type="button" className="mm-btn mm-btn--primary" onClick=\{next\}>/, 'then the sample\'s own key is the one volt');
});

// ---- The running page (opt-in: HOME_HERO_URL) ---------------------------------------------------------------------
const URL_ = process.env.HOME_HERO_URL;
test('LK67 and LK70 on the running page, in real Chrome', { skip: !URL_ && 'set HOME_HERO_URL to measure the running page' }, async () => {
  const require = createRequire(import.meta.url);
  const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'C:/Users/atish/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
  // One headless browser on this PC at a time: the shared lock, and the real Chrome binary the benches use.
  const { CHROME, withLock } = await import('./oneGestureBench.mjs');
  await withLock('homeHero test', async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  try {
    const sizes = [[390, 844, 2, true], [375, 667, 2, true], [360, 640, 2, true], [412, 915, 2, true], [1280, 800, 1, false], [1440, 900, 1, false], [1920, 1080, 1, false]];
    for (const [width, height, dsf, touch] of sizes) {
      const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dsf, hasTouch: touch, isMobile: touch });
      await ctx.addInitScript(() => { try { localStorage.setItem('mm:opened:v1', '1'); sessionStorage.setItem('mm:opening:v1', '1'); } catch { /* none */ } });
      const page = await ctx.newPage();
      await page.goto(`${URL_}/`, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(1500);
      const m = await page.evaluate(() => {
        const b = (s) => document.querySelector(s)?.getBoundingClientRect();
        const lines = (s) => { const el = document.querySelector(s); return el ? Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)) : 0; };
        const brand = document.querySelector('.lp-title__brand');
        const range = document.createRange();
        range.selectNodeContents(brand);
        const column = document.querySelector('.lp-hero__copy').getBoundingClientRect();
        const sizers = [...document.querySelectorAll('.lp-typed__sizer')].map((el) => el.getBoundingClientRect().right);
        return { h1: b('.lp-hero .lp-title'), lead: b('.lp-hero .lp-lead'), key: b('.lp-hero .lp-cta .mm-actions > a:first-child'), room: b('.lp-desk__room'), fig: b('.lp-desk__figure'), docW: document.documentElement.scrollWidth, text: document.querySelector('.lp-hero').innerText, leadLines: lines('.lp-hero .lp-lead'), leadPx: parseFloat(getComputedStyle(document.querySelector('.lp-hero .lp-lead')).fontSize), fact: Boolean(document.querySelector('.lp-hero__fact')), brandRight: range.getBoundingClientRect().right, columnRight: column.right, sizerRight: Math.max(...sizers), film: b('.lp-hero .lp-film__frame'), filmKeys: b('.lp-hero .lp-film__keys'), filmSegs: [...document.querySelectorAll('.lp-hero .lp-film__seg')].map((s) => s.getBoundingClientRect()).map((r) => ({ w: r.width, h: r.height, top: Math.round(r.top) })), strip: b('.lp-strip'), texture: (() => {
          // Round 5: the grain covers the hero, behind it, untouchable, drawn by its two masked layers.
          const el = document.querySelector('.lp-hero > .mm-texture--hero');
          if (!el) return null;
          const cs = getComputedStyle(el);
          const hero = document.querySelector('.lp-hero').getBoundingClientRect();
          const r = el.getBoundingClientRect();
          const mask = (pseudo) => { const p = getComputedStyle(el, pseudo); return p.maskImage || p.webkitMaskImage || ''; };
          return { z: cs.zIndex, events: cs.pointerEvents, hidden: el.getAttribute('aria-hidden'), same: Math.abs(r.top - hero.top) < 1 && Math.abs(r.height - hero.height) < 1 && Math.abs(r.width - hero.width) < 1, before: mask('::before'), after: mask('::after') };
        })(), brandMarks: [getComputedStyle(brand, '::before').content, getComputedStyle(brand, '::after').content], brandBg: getComputedStyle(brand).backgroundImage + getComputedStyle(brand).backgroundColor, objs: [...document.querySelectorAll('.lp-strip__fact')].map((a) => {
          // Round 5 (LK160): each desk object's shared baseline (40.5/44 down its box) against its second line's baseline.
          const img = a.querySelector('.lp-strip__obj').getBoundingClientRect();
          const line = a.querySelector('.lp-strip__line');
          const probe = document.createElement('span');
          probe.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
          line.appendChild(probe);
          const base = probe.getBoundingClientRect().top;
          probe.remove();
          const rr = document.createRange(); rr.selectNodeContents(line);
          return { off: img.top + img.height * (40.5 / 44) - base, rows: new Set([...rr.getClientRects()].map((c) => Math.round(c.top))).size };
        }) };
      });
      const pct = (y) => (100 * y) / height;
      assert.ok(m.docW <= width, `${width}: no sideways scroll`);
      assert.ok(m.room.height > 100 && m.fig.height > 100, `${width}: the room and Mobi are drawn`);
      assert.match(m.text, /mock tests|exam/i);
      // R3-D3: the lead in two lines (16-17 px on phones). Round 4: no fact line; "CUET 2027." and every typed phrase
      // inside the words' column; on desktop the sample's fourth option inside the first screen.
      assert.equal(m.leadLines, 2, `${width}: the lead is ${m.leadLines} lines`);
      assert.equal(m.fact, false, `${width}: no fact line`);
      assert.ok(m.brandRight <= m.columnRight + 1 && m.sizerRight <= m.columnRight + 1, `${width}: the headline fits its column`);
      // Round 7: the film is the hero's picture now (the sample moved to section#try): on desktop it is large and wholly in
      // the first screen.
      if (width >= 960) assert.ok(m.film && m.film.bottom <= height && m.film.width >= width * 0.38, `${width}x${height}: the film is large and in the first screen`);
      // Round 9 (owner, 9 Nov 2026): the film's keys sit in one row under the picture, never over it; ten chapter
      // segments, each a 44 px tall and at least 24 px wide target, on one line; on desktop the row is in the first screen.
      assert.ok(m.filmKeys && m.filmKeys.top >= m.film.bottom && m.filmKeys.height === 44, `${width}: the film's keys in one 44 px row under the picture`);
      assert.equal(m.filmSegs.length, 9, `${width}: nine chapters`);
      assert.equal(new Set(m.filmSegs.map((s) => s.top)).size, 1, `${width}: the chapters on one line`);
      for (const s of m.filmSegs) assert.ok(s.w >= 23.99 && s.h >= 44, `${width}: a chapter target ${s.w.toFixed(1)}x${s.h} px`);
      if (width >= 960) assert.ok(m.filmKeys.bottom <= height, `${width}x${height}: the film's keys in the first screen`);
      // Round 5 (LK159): nothing is drawn behind, before or after "CUET 2027.": type and colour alone.
      assert.deepEqual(m.brandMarks, ['none', 'none'], `${width}: no marker around "CUET 2027."`);
      assert.match(m.brandBg, /^none(rgba\(0, 0, 0, 0\)|transparent)$/, `${width}: no band behind "CUET 2027."`);
      // Round 5 (LK160): the strip's objects stand on their second line's baseline, and three across every line holds one line.
      assert.ok(m.objs.length >= 5, `${width}: the strip's objects`);
      for (const o of m.objs) assert.ok(Math.abs(o.off) <= 1.5, `${width}: an object stands ${o.off.toFixed(1)} px off its line's baseline`);
      if (width >= 1400) for (const o of m.objs) assert.equal(o.rows, 1, `${width}: a strip line wraps`);
      // Round 5: the paper grain is drawn behind the whole hero, never in the way of a tap, at every width.
      assert.ok(m.texture, `${width}: the hero's texture`);
      assert.equal(m.texture.z, '-1');
      assert.equal(m.texture.events, 'none');
      assert.equal(m.texture.hidden, 'true');
      assert.ok(m.texture.same, `${width}: the grain covers the hero`);
      for (const layer of [m.texture.before, m.texture.after]) assert.match(layer, /data:image\/svg\+xml.*radial-gradient.*linear-gradient/, `${width}: noise, falloff and fade`);
      if (width < 960) assert.ok(m.leadPx >= 16 && m.leadPx <= 17, `${width}: lead ${m.leadPx} px`);
      if (width < 960) {
        assert.ok(pct(m.h1.top) <= 12, `${width}x${height}: h1 at ${pct(m.h1.top).toFixed(1)} %`);
        assert.ok(m.fig.height >= 130 || height < 700, `${width}: Mobi ${m.fig.height} px`);
      } else assert.ok(m.fig.height >= 170, `Mobi ${m.fig.height} px`);
      if (width === 390) {
        assert.ok(pct(m.lead.bottom) <= 40, `lead ends at ${pct(m.lead.bottom).toFixed(1)} %`);
        assert.ok(pct(m.key.bottom) <= 46, `key ends at ${pct(m.key.bottom).toFixed(1)} %`);
      }
      if (width === 360) assert.ok(pct(m.lead.bottom) <= 48, `360x640 lead ends at ${pct(m.lead.bottom).toFixed(1)} %`);
      if (width === 390) {
        // Six real taps on Mobi: the bubble never changes.
        // Round 7: the desk is in section#try under the college strip; bring it on screen first.
        await page.locator('.lp-desk__figure').scrollIntoViewIfNeeded();
        await page.waitForTimeout(400);
        const before = await page.evaluate(() => document.querySelector('.lp-desk__line[data-on]').textContent);
        const box = await page.locator('.lp-desk__figure').boundingBox();
        for (let i = 0; i < 6; i += 1) { await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2); await page.waitForTimeout(500); }
        assert.equal(await page.evaluate(() => document.querySelector('.lp-desk__line[data-on]').textContent), before);
        assert.equal(before, DESK_LINES.load);
      }
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
  });
});
