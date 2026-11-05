// node --test src/components/landing/homeHero.test.mjs
// The home hero, "Desk Light" (4 Nov 2026, SPEC-HOME-1104 packet P2), refined in round 3 (R3-D3, owner LK99/LK100,
// 5 Nov 2026) and round 4 (owner LK117-LK124, 5 Nov 2026: the desktop hero fills the screen, "CUET 2027." highlighted, the
// fact line gone, the features strip and its price hook, the brand's answer-sheet texture; docs/design-decisions/
// web-r4-hero.md): the LK67 and LK70 measures and the decisions the hero owns (2, 3, 4, 5, 13, 15, 18; decision 12's "no
// ambient pattern" is superseded by the owner's texture request, LK117). Source-level by default; with HOME_HERO_URL set (for example
// http://localhost:3572) it also measures the running page in real Chrome (the shared browser lock, one browser) at
// 390x844, 375x667, 360x640, 412x915 and 1440x900 (LK70: the h1 starts in the first 12 % of the screen, the pitch
// sentence ends by 40 % at 390x844 and 48 % at 360x640, the key by 46 % at 390x844; R3-D3: the lead is two lines at
// 16-17 px on phones and the fact line one line; LK67: the room and Mobi are drawn at every width, Mobi at least 130 px
// tall on phones and 170 px on desktop; the bubble never changes on six real taps).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { HERO_LINES, HERO_SENTENCE, HERO_TYPED } from './heroLines.mjs';
import { DESK_LINES, DESK_NOTE, heroFeatures, heroPriceHook } from './heroTaps.mjs';
import { HERO_LEAD, buildFaqs, buildTour, LAB_HEAD, RECOVERY_HEAD, COMPASS_HEAD, proPlan } from './homeCopy.mjs';
import { KEY_CARDS_HEAD } from './keyCardsCopy.mjs';
import { MOCK_PACES, perMock } from '../../lib/payments/value.mjs';
import { BLINK_EVERY_MS, GAZE_MAX_PX, GAZE_MEDIA, GLANCE, gazeOffset, glanceOffset } from '../brand/mobiGaze.mjs';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
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
const OFFER = { purchasable: 'monthly', monthly: { rupees: 99 }, oneTime: { rupees: 99, expires: '31 July 2027' } };

// ---- Decision 18: every hero string, with where its truth comes from ---------------------------------------------
const FAQ = buildFaqs({ offer: OFFER }).map((f) => f.answer).join(' ');
const TOUR = buildTour({}).map((s) => `${s.title} ${s.body} ${s.lede}`).join(' ');
export const HERO_STRINGS = [
  { text: HERO_SENTENCE, source: 'heroLines.mjs HERO_LINES: the owner-approved sentence (L-016)', holds: () => HERO_SENTENCE === 'CUET 2027. One mock. Know what to fix.' },
  { text: 'Know what to fix.', source: 'chapter review names the chapter to fix first (homeCopy buildTour radar)', holds: () => /Know the chapter to fix first\./.test(TOUR) },
  { text: 'Fresh every time.', source: 'the FAQ: every mock is built fresh from one live question bank (homeCopy buildFaqs)', holds: () => /every mock is built fresh from one live question bank/.test(FAQ) },
  { text: 'Every mark traced.', source: 'the Mistake Lab head (homeCopy LAB_HEAD)', holds: () => LAB_HEAD.h2 === 'Every mark, traced back to a moment.' },
  { text: `${HERO_LEAD.strong}${HERO_LEAD.rest}`, source: 'the Lab traces every miss to its chapter (homeCopy buildTour radar)', holds: () => /traces every miss to its chapter/.test(TOUR) },
  { text: DESK_LINES.load, source: 'the sample is on the desk: CUET-pattern questions, no signup (DemoDrill DRILL, L-015)', holds: () => /DRILL\.length/.test(read('./DemoDrill.jsx')) },
  { text: DESK_NOTE, source: 'the sample needs no sign-up and opens the reason under every answer (DemoDrill mm-drill__why)', holds: () => /mm-drill__why/.test(read('./DemoDrill.jsx')) },
  { text: DESK_LINES.right, source: 'DemoDrill opens the reason under a right answer (mm-drill__why)', holds: () => /mm-drill__why/.test(read('./DemoDrill.jsx')) },
  { text: DESK_LINES.miss, source: 'DemoDrill opens the reason under a miss too', holds: () => /question\.why/.test(read('./DemoDrill.jsx')) },
  { text: DESK_LINES.five, source: 'after five, the card\'s own end state offers sign-up, where a student picks a subject (DemoDrill), and the hero\'s volt key is "Sign up free" (LK83, L-015)', holds: () => /<Link href="\/signup" className="mm-btn mm-btn--primary">/.test(read('./DemoDrill.jsx')) && /way\.signup/.test(read('../LandingActions.jsx')) },
  // Round 4 (LK124): every feature cell says only what its own section says.
  ...heroFeatures({ compass: true, keyCards: true }).map((f) => ({ text: `${f.name}. ${f.line}`, source: {
    'Unlimited mocks': 'Pro: unlimited Quick and Full (homeCopy proPlan); every mock built fresh from one live bank (the FAQ)',
    'Mistake Lab': 'the Mistake Lab head (homeCopy LAB_HEAD)',
    'Score Recovery': 'the Score Recovery Lab head (homeCopy RECOVERY_HEAD)',
    'DU Compass': 'the Compass head (homeCopy COMPASS_HEAD)',
    'Ask Mobi': 'the tour\'s Ask Mobi slide (homeCopy buildTour prepos)',
    'Key cards': 'the Key cards head (keyCardsCopy KEY_CARDS_HEAD)',
  }[f.name], holds: () => ({
    'Unlimited mocks': () => proPlan({}).some((item) => /^Unlimited Quick practice and Full mock/.test(item)) && /every mock is built fresh from one live question bank/.test(FAQ),
    'Mistake Lab': () => /traced/.test(LAB_HEAD.h2),
    'Score Recovery': () => RECOVERY_HEAD.h2 === 'Fix it once. Check it holds.',
    'DU Compass': () => /shortlist/.test(COMPASS_HEAD.h2),
    'Ask Mobi': () => /Ask what to do tonight\. Get one clear step\./.test(buildTour({}).map((t) => t.title).join(' ')),
    'Key cards': () => /^Turn it\. Rate it\./.test(KEY_CARDS_HEAD.h2),
  }[f.name])() })),
  { text: `${heroPriceHook(OFFER, { from: new Date(Date.UTC(2026, 10, 6)) }).lead} ${heroPriceHook(OFFER, { from: new Date(Date.UTC(2026, 10, 6)) }).figure}`, source: 'perMock(offer) at the pricing slider\'s top pace (value.mjs MOCK_PACES), rounded up, never typed', holds: () => heroPriceHook(OFFER, { from: new Date(Date.UTC(2026, 10, 6)) }).figure === perMock(OFFER, Math.max(...MOCK_PACES), { from: new Date(Date.UTC(2026, 10, 6)) }).about },
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
  // Round 4 (LK121): no fact line under the keys; the features strip comes after the desk (on desktop it sits under the
  // keys by grid area), then the two hero links. The texture is the section's first child, behind everything.
  assert.doesNotMatch(HERO, /<QuestionBankLine\b|lp-hero__fact/);
  const order = ['<BrandTexture variant="hero" />', '<h1 className="lp-title">', '<p className="lp-lead">', '<div className="lp-cta">', 'id="try-practice">', '<div className="lp-desk__stage">', '<HeroBeatStrip ', '<div className="lp-hero__links">'];
  let at = -1;
  for (const mark of order) {
    const i = HERO.indexOf(mark);
    assert.ok(i > at, `${mark} comes after the one before it`);
    at = i;
  }
  assert.match(HERO, /<b>\{HERO_LEAD\.strong\}<\/b>\{HERO_LEAD\.rest\}/);
  assert.equal(HERO_LEAD.strong, 'MockMob is CUET UG mock tests');
  // R3-D3 (LK99): the lead is two lines at 16-17 px on a phone, so at most 76 characters (72 now; measured in Chrome:
  // two lines at 360, 390, 1024 and 1440). The claim is unchanged: the review traces every miss to its chapter.
  assert.equal(`${HERO_LEAD.strong}${HERO_LEAD.rest}`, 'MockMob is CUET UG mock tests that trace every lost mark to its chapter.');
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
  assert.match(CSS, /grid-template-areas: 'copy' 'desk' 'strip' 'links';/, 'phones: the words, the desk, the features strip, the two links');
  assert.match(CSS, /grid-template-areas: 'copy desk' 'strip desk' 'links desk';/, 'desktop: the strip and the links under the keys in the left column');
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
  assert.match(BEAT_STRIP, /<BrandIcon name=\{item\.icon\} size=\{36\} className="lp-strip__icon" \/>/, 'a desk object at 36 px (objects need 32 px or more)');
  assert.match(BEAT_STRIP, /<MobiMark size=\{30\} \/>/, 'Ask Mobi is Mobi\'s own mark');
  assert.match(BEAT_STRIP, /<a href=\{hook\.href\} className="lp-strip__hook">/, 'the hook is one link to the slider');
  assert.match(CSS, /\.mm\.lp \.lp-strip__hook-fig \{[^}]*color: var\(--brand-word, var\(--ink\)\);[^}]*font-variant-numeric: lining-nums tabular-nums;/);
  assert.match(CSS, /\.mm\.lp \.lp-strip__list \{ display: grid; grid-template-columns: minmax\(0, 1fr\);/, 'one feature a row on phones');
  assert.match(CSS, /\.mm\.lp \.lp-strip__item:last-child:nth-child\(odd\) \{ grid-column: 1 \/ -1; border-right: 0; \}/, 'tablets: an odd last cell spans the row');
  assert.match(CSS, /\.mm\.lp \.lp-strip__list \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); column-gap: 8px;/, 'two across in the words\' column from 960 px');
  assert.match(CSS, /@media \(min-width: 1400px\) \{\s*\.mm\.lp \.lp-strip__list \{ grid-template-columns: repeat\(3, minmax\(0, 1fr\)\); \}/, 'three across from 1400 px');
  assert.match(CSS, /\.mm\.lp \.lp-strip__fact \{[^}]*min-height: 44px;/);
  assert.match(CSS, /\.mm\.lp \.lp-strip__hook \{[^}]*min-height: 44px;/);
  assert.match(CSS, /\.mm\.lp \.lp-strip__fact:focus-visible \{ outline: 2px solid var\(--focus-ring, var\(--ink\)\);/);
  assert.match(CSS, /\.mm\.lp \.lp-strip__hook:focus-visible \{ outline: 2px solid var\(--focus-ring, var\(--ink\)\);/);
});

test('round 4 (LK120): "CUET 2027." is the headline\'s anchor: a step larger, under a highlighter mark that draws once', () => {
  // One step larger than the lines under it, always inside the column (5.4 em measured, plus the mark's overhang).
  assert.match(CSS, /\.mm\.lp \.lp-hero \.lp-title__brand \{\n\s+position: relative;\n\s+z-index: 0;\n\s+width: fit-content;\n\s+font-size: min\(1\.3em, 18cqi\);/);
  assert.match(CSS, /\.mm\.lp \.lp-hero \.lp-title__brand \{ font-size: min\(1\.45em, 17\.4cqi\); line-height: 0\.98; \}/);
  assert.ok(5.54 * 18 < 100 && 5.54 * 17.4 < 100, 'the brand line fits its column at either cap');
  // Day: the volt band over the letters' lower part, the letters in the deepest Day green; Night: a volt stroke under
  // volt letters (a band behind volt letters read as a muddy selection).
  assert.match(CSS, /html\[data-theme='light'\] \.mm\.lp \.lp-hero \.lp-title__brand \{ color: #2c3a00; --mark-top: 0\.4em; --mark-bottom: 0\.02em;/);
  assert.match(CSS, /--mark: #d2f000;\n\s+--mark-top: 0\.99em;/);
  assert.match(CSS, /\.mm\.lp \.lp-hero \.lp-title__brand::before \{[^}]*z-index: -1;[^}]*background: var\(--mark\);/);
  // It draws once after the opening (520 ms, the out curve); reduce motion and no JS: drawn already; never a glow.
  assert.match(CSS, /:root:not\(\[data-motion='reduced'\]\):is\(\[data-opening='skip'\], \[data-opening='done'\]\) \.mm\.lp \.lp-hero \.lp-title__brand::before \{\s*animation: lp-mark-in 520ms cubic-bezier\(0\.23, 1, 0\.32, 1\) 160ms both;/);
  assert.match(CSS, /@keyframes lp-mark-in \{ from \{ clip-path: inset\(0 100% 0 0\); \} to \{ clip-path: inset\(0 0 0 0\); \} \}/);
  const markRules = CSS.slice(CSS.indexOf('.mm.lp .lp-hero .lp-title__brand::before {'), CSS.indexOf('@keyframes lp-mark-in'));
  assert.doesNotMatch(markRules, /box-shadow|filter|infinite/);
  assert.match(CSS, /@media \(forced-colors: active\) \{ \.mm\.lp \.lp-hero \.lp-title__brand::before \{ display: none; \} \}/);
});

test('decision 3: the two hero links stay, as ink underlined text links', () => {
  assert.match(HERO, /<Link href="\/cuet-cutoff-calculator" className="lp-hero__tool">Free DU eligibility and cutoff calculator<\/Link>/);
  assert.match(HERO, /<a href="#exam-experience" className="lp-hero__exam-link">Try the exam-day screen<\/a>/);
  assert.match(CSS, /\.mm\.lp \.lp-hero__links > a \{[^}]*color: var\(--ink\);[^}]*text-decoration: underline;/);
  assert.match(CSS, /\.mm\.lp \.lp-hero__links > a \{[^}]*min-height: 44px;/);
});

test('round 4 (LK117, supersedes decision 12): the hero\'s texture is the brand\'s own answer sheet, never a generic grid, dots or glow', () => {
  // The owner (5 Nov, ~11:40 pm): "some sort of texture ... in the background, like we had previously ... in black mode the
  // black space is even more significant". The old generic backdrop (grid, dot matrix, volt spotlight) stays gone.
  assert.match(HERO, /<section className="lp-hero">\s*<BrandTexture variant="hero" \/>/, 'the section\'s first child, behind everything');
  assert.doesNotMatch(HERO, /HeroBackdrop|lp-bg|lp-hero__spot|spotlight/);
  assert.doesNotMatch(PAGE, /<HeroBackdrop/);
  assert.doesNotMatch(CSS, /radial-gradient|rgb\(210 240 0|rgba\(210, 240, 0|#d2f000[^;]*;\s*\}?\s*\/\*\s*glow/i);
  assert.match(CSS, /\.mm\.lp \.lp-hero \{ position: relative; isolation: isolate; \}/);
  // The sheet: numbered questions, four bubbles each, one pencil mark a row; hidden from assistive technology; neutral.
  assert.match(TEXTURE, /<svg className=\{`mm-texture mm-texture--\$\{variant\}`\} aria-hidden="true" focusable="false"/);
  assert.match(TEXTURE, /<ellipse/);
  assert.match(TEXTURE, /className="mm-texture__num"/);
  assert.doesNotMatch(TEXTURE.replace(/^\s*\/\/.*$/gm, '') + TEXTURE_CSS, /d2f000|210, 240, 0|volt|animation|blur\(/i, 'never volt, never moving, never a blur');
  assert.match(TEXTURE_CSS, /\.mm-texture \{[^}]*position: absolute;[^}]*z-index: -1;[^}]*pointer-events: none;/);
  // Stronger in Night than in Day; less again when more contrast is asked for; none in forced colours.
  const alpha = (theme) => Number((TEXTURE_CSS.match(new RegExp(`${theme}[^}]*--mm-tex-ring: rgba\\([^)]*?, ([0-9.]+)\\)`)) || [])[1]);
  assert.ok(alpha(":root\\[data-theme='dark'\\] \\.mm-texture \\{") > alpha('\\.mm-texture \\{\\s*position'), 'Night carries it more');
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
    const sizes = [[390, 844, 2, true], [375, 667, 2, true], [360, 640, 2, true], [412, 915, 2, true], [1440, 900, 1, false]];
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
        return { h1: b('.lp-hero .lp-title'), lead: b('.lp-hero .lp-lead'), key: b('.lp-hero .lp-cta .mm-actions > a:first-child'), room: b('.lp-desk__room'), fig: b('.lp-desk__figure'), docW: document.documentElement.scrollWidth, text: document.querySelector('.lp-hero').innerText, leadLines: lines('.lp-hero .lp-lead'), leadPx: parseFloat(getComputedStyle(document.querySelector('.lp-hero .lp-lead')).fontSize), fact: Boolean(document.querySelector('.lp-hero__fact')), brandRight: range.getBoundingClientRect().right, columnRight: column.right, sizerRight: Math.max(...sizers), option4: b('.lp-desk .mm-drill__option:nth-child(4)'), strip: b('.lp-strip') };
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
      if (width >= 960) assert.ok(m.option4.bottom <= height, `${width}x${height}: the fourth option ends at ${Math.round(m.option4.bottom)}`);
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
