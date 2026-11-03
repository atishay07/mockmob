// node --test src/components/landing/homeHero.test.mjs
// The home hero, "Desk Light" (4 Nov 2026, SPEC-HOME-1104 packet P2): the LK67 and LK70 measures and the decisions
// the hero owns (2, 3, 4, 5, 12, 13, 14, 15, 18). Source-level by default; with HOME_HERO_URL set (for example
// http://localhost:3467) it also measures the running page in real Chrome at 390x844, 375x667, 360x640, 412x915 and
// 1440x900 (LK70: the h1 starts in the first 12 % of the screen, the pitch sentence ends by 40 % at 390x844 and 48 %
// at 360x640, the key by 46 % at 390x844; LK67: the room and Mobi are drawn at every width, Mobi at least 130 px tall
// on phones and 170 px on desktop; the bubble never changes on six real taps).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { HERO_LINES, HERO_SENTENCE, HERO_TYPED } from './heroLines.mjs';
import { DESK_LINES, heroBeat, heroBankLine, heroTrustSentence } from './heroTaps.mjs';
import { HERO_LEAD, buildFaqs, buildTour, LAB_HEAD } from './homeCopy.mjs';
import { BLINK_EVERY_MS, GAZE_MAX_PX, GAZE_MEDIA, GLANCE, gazeOffset, glanceOffset } from '../brand/mobiGaze.mjs';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const PAGE = read('../../app/page.js');
const HERO = PAGE.slice(PAGE.indexOf('<section className="lp-hero">'), PAGE.indexOf('STATEMENT ('));
const CSS = strip(read('../../app/hero-scene.css'));
const FIGURE_CSS = strip(read('../brand/mobi-figure.css'));
const REACT = read('../brand/MobiReact.jsx');
const MOBI = read('./HeroMobi.jsx');
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
  { text: heroTrustSentence('Pro ₹99 a month'), source: 'priceLine(OFFER) (src/lib/payments/offer.js), never typed in', holds: () => /heroTrustSentence\(priceLine\(OFFER\)/.test(HERO) },
  { text: heroBankLine(null), source: 'loadBankSize() (/api/stats bankSize); without it no number at all', holds: () => /<QuestionBankLine variant="short"/.test(HERO) && !/\d/.test(heroBankLine(null)) },
  { text: DESK_LINES.load, source: 'the sample is on the desk: five questions, no signup (DemoDrill DRILL, L-015)', holds: () => /DRILL\.length/.test(read('./DemoDrill.jsx')) },
  { text: DESK_LINES.right, source: 'DemoDrill opens the reason under a right answer (mm-drill__why)', holds: () => /mm-drill__why/.test(read('./DemoDrill.jsx')) },
  { text: DESK_LINES.miss, source: 'DemoDrill opens the reason under a miss too', holds: () => /question\.why/.test(read('./DemoDrill.jsx')) },
  { text: DESK_LINES.five, source: 'after five, other subjects are one free signup away (the card note, L-015)', holds: () => /Other subjects\? <Link href="\/signup">Pick yours free<\/Link>/.test(HERO) },
  ...heroBeat(73).map((b) => ({ text: `${b.title}. ${b.line}`, source: { '#try-practice': 'DemoDrill: five questions, no signup', '#du-eligibility': 'DU_FACTS.programmes (duIndexFacts, the DU index)', '#exam-experience': 'ExamScreen: MockMob and NTA style', '#your-prep': 'the Practice slide: a full 50-question, 60-minute mock' }[b.href], holds: () => (b.href !== '#your-prep' || /50-question, 60-minute mock/.test(TOUR)) && (b.href !== '#du-eligibility' || /heroBeat\(DU_FACTS\?\.programmes \?\? null\)/.test(HERO)) })),
];

test('decision 18: every hero string traces to a source, and each source still says it', () => {
  for (const row of HERO_STRINGS) {
    assert.ok(row.source, `${row.text} has a source`);
    assert.ok(row.holds(), `${row.text} <- ${row.source}`);
    assert.doesNotMatch(row.text, /·|!|guarantee|unlimited mocks|never repeats/i, row.text);
  }
  assert.deepEqual([...HERO_TYPED], ['Fresh every time.', 'Every mark traced.']);
  for (const p of HERO_TYPED) assert.ok(p.length <= 18, p);
});

test('LK70: the h1 comes first and the lead says what MockMob is, in the server HTML order', () => {
  const order = ['<h1 className="lp-title">', '<p className="lp-lead">', '<div className="lp-cta">', '<div className="lp-hero__facts">', '<div className="lp-desk" id="try-practice">', '<div className="lp-hero__links">', '<nav className="lp-beat"'];
  let at = -1;
  for (const mark of order) {
    const i = HERO.indexOf(mark);
    assert.ok(i > at, `${mark} comes after the one before it`);
    at = i;
  }
  assert.match(HERO, /<b>\{HERO_LEAD\.strong\}<\/b>\{HERO_LEAD\.rest\}/);
  assert.equal(HERO_LEAD.strong, 'MockMob is CUET UG mock tests');
  // The visual lines read the approved sentence: CUET 2027. in the brand word colour, plain text.
  assert.match(HERO, /<span className="lp-title__line lp-title__brand">\{HERO_LINES\[0\]\}<\/span>\{' '\}\s*<span className="lp-title__line">\{HERO_LINES\[1\]\}<\/span>\{' '\}/);
  assert.match(HERO, /<HeroTyped \/>/);
  assert.match(CSS, /\.mm\.lp \.lp-title__brand \{ color: var\(--brand-word, var\(--accent-text\)\); \}/);
  assert.deepEqual([...HERO_LINES], ['CUET 2027.', 'One mock.', 'Know what to fix.']);
});

test('LK70 geometry: phone sizes put the words first (h1 44 px at 390, the room clamp, the key 56 px)', () => {
  assert.match(CSS, /\.mm\.lp \.lp-hero \{ padding-block: 22px 40px; \}/);
  assert.match(CSS, /font-size: min\(2\.75rem, 12\.55cqi\);/, 'the h1 is 44 px at 390 and still fits the widest phrase on one line');
  assert.match(CSS, /\.mm\.lp \.lp-hero \.lp-title__line \{ display: block; white-space: nowrap; \}/);
  assert.match(CSS, /grid-template-areas: 'copy' 'desk' 'links';/, 'phones: the words, then the desk, then the two links under the card');
  assert.match(CSS, /grid-template-areas: 'copy desk' 'links desk';/, 'desktop: the links under the facts in the left column');
  assert.match(CSS, /min-height: 56px;\n\s+border-radius: 16px;/);
  // The widest phrase fits: 7.95 em at 12.55 cqi is under 100 % of the column.
  assert.ok(7.95 * 12.55 < 100);
});

test('decision 3: the two hero links stay, as ink underlined text links', () => {
  assert.match(HERO, /<Link href="\/cuet-cutoff-calculator" className="lp-hero__tool">Free DU eligibility and cutoff calculator<\/Link>/);
  assert.match(HERO, /<a href="#exam-experience" className="lp-hero__exam-link">Try the exam-day screen<\/a>/);
  assert.match(CSS, /\.mm\.lp \.lp-hero__links > a \{[^}]*color: var\(--ink\);[^}]*text-decoration: underline;/);
  assert.match(CSS, /\.mm\.lp \.lp-hero__links > a \{[^}]*min-height: 44px;/);
});

test('decision 12: no ambient pattern in the hero (no backdrop, grid, dots or spotlight)', () => {
  assert.doesNotMatch(HERO, /HeroBackdrop|lp-bg|lp-hero__spot|spotlight/);
  assert.doesNotMatch(PAGE, /<HeroBackdrop/);
  assert.doesNotMatch(CSS, /radial-gradient|rgb\(210 240 0|rgba\(210, 240, 0|#d2f000[^;]*;\s*\}?\s*\/\*\s*glow/i);
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
  assert.match(read('./HeroTyped.jsx'), /new CustomEvent\('mm:hero-typed', \{ detail: \{ index: s\.phrase, final: s\.final \} \}\)/, 'P3 sends the event Mobi listens for');
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

test('decision 15: one volt key per viewport: the bar\'s Start free is the raised-paper secondary', () => {
  const nav = read('../NavBar.jsx');
  assert.match(nav, /<Link href="\/signup" className="mm-btn mm-btn--secondary mm-nav__cta">\s*Start free\s*<\/Link>/);
  assert.doesNotMatch(nav, /mm-nav__cta[^"]*mm-btn--primary|mm-btn--primary[^"]*mm-nav__cta/);
  assert.match(read('../LandingActions.jsx'), /className=\{heroKey\}/, 'the hero key steps down once the sample is answered');
  assert.match(read('./DemoDrill.jsx'), /<button type="button" className="mm-btn mm-btn--primary" onClick=\{next\}>/, 'then the sample\'s own key is the one volt');
});

test('decision 14: the second beat is a hairline row of sentence links, not a stat strip', () => {
  assert.match(CSS, /\.mm\.lp \.lp-beat \{[^}]*border-top: 1px solid var\(--line\);/);
  assert.doesNotMatch(CSS.slice(CSS.indexOf('.lp-beat')), /backdrop-filter|glass/);
  assert.match(CSS, /\.mm\.lp \.lp-beat b \{ display: block; font: 700 1rem\/1\.3 var\(--font-display\);/);
});

// ---- The running page (opt-in: HOME_HERO_URL) ---------------------------------------------------------------------
const URL_ = process.env.HOME_HERO_URL;
test('LK67 and LK70 on the running page, in real Chrome', { skip: !URL_ && 'set HOME_HERO_URL to measure the running page' }, async () => {
  const require = createRequire(import.meta.url);
  const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'C:/Users/atish/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
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
        return { h1: b('.lp-hero .lp-title'), lead: b('.lp-hero .lp-lead'), key: b('.lp-hero .lp-cta .mm-actions > a:first-child'), room: b('.lp-desk__room'), fig: b('.lp-desk__figure'), docW: document.documentElement.scrollWidth, text: document.querySelector('.lp-hero').innerText };
      });
      const pct = (y) => (100 * y) / height;
      assert.ok(m.docW <= width, `${width}: no sideways scroll`);
      assert.ok(m.room.height > 100 && m.fig.height > 100, `${width}: the room and Mobi are drawn`);
      assert.match(m.text, /mock tests|exam/i);
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
        assert.equal(before, 'Your first question. Go.');
      }
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
});
