// Round 4, packet H1/H4/H5 (owner LK117, LK119, LK125-LK128, 5 Nov 2026 about 11:40 pm; SPEC-R4 H1, H4, H5): every section under
// the hero laid out again for desktop and phones (home-sections.css), "MockMob" green from the first frame in the statement, the
// Lab's Repair and SWOT scenes calmer on phones, Key cards tighter, and the brand's answer-sheet texture under the shelf.
// Source-level; the gaps and sizes were measured in real Chrome (tmp/r4/gaps.cjs in the r4-sections worktree):
//   390: 53-60 px between every pair of sections from the statement to the FAQ (it was 111-149 around the held stories);
//   1440: 137-169 px (it was 166-200, and 411 before the close band).
//   node --test data/tests/home_sections_r4_1105.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { STATEMENT } from '../../src/components/landing/homeCopy.mjs';
import { BRAND_WORD, statementWords } from '../../src/components/landing/statementSteps.mjs';

const root = new URL('../../', import.meta.url);
const read = (rel) => readFileSync(new URL(rel, root), 'utf8').replace(/\r\n/g, '\n');
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const SECTIONS = strip(read('src/app/home-sections.css'));
const DEPTH = strip(read('src/app/hero-depth.css'));
const LAB = strip(read('src/app/lab-cinema.css'));
const CARDS = strip(read('src/components/landing/key-cards.css'));
const PAGE = read('src/app/page.js');

// ------------------------------------------------------------------------------------------------ H4: the brand word
test('H4 (LK125): "MockMob" is the statement\'s brand word, green and lit from the first frame; the other accents still light up', () => {
  assert.equal(BRAND_WORD, 'MockMob');
  const words = statementWords(STATEMENT);
  assert.deepEqual(words.filter((w) => w.brand).map((w) => w.text), ['MockMob']);
  assert.deepEqual(words.filter((w) => w.accent && !w.brand).map((w) => w.text), ['where,', 'tonight,', 'shortlist']);
  assert.match(read('src/components/landing/Statement.jsx'), /data-brand=\{word\.brand \|\| undefined\}/);
  // Every state: the scrub (no animation, full opacity, the accent), and the phone's held story at every step.
  assert.match(DEPTH, /\.mm\.lp \.lp-statement \.lp-statement__w\[data-brand\] \{ animation: none; opacity: 1; color: var\(--statement-accent, var\(--ink\)\); \}/);
  assert.match(DEPTH, /\.ss\[data-pinned='true'\] \.lp-statement__w\[data-accent\]\[data-brand\] \{ opacity: 1; color: var\(--statement-accent, var\(--ink\)\); transition: none; \}/);
});

// ------------------------------------------------------------------------------------------------ H1: desktop
test('H1 (LK117): section headings about 72 px at 1440, 28 px on a phone, never past 4.5 rem; the exam column keeps its ladder', () => {
  const m = SECTIONS.match(/\.mm\.lp \{ --fs-h2: clamp\(([\d.]+)rem, ([\d.]+)rem \+ ([\d.]+)vw, ([\d.]+)rem\); \}/);
  assert.ok(m, 'the h2 token');
  const at = (vw, rootPx = 16) => Math.min(Math.max(Number(m[1]) * rootPx, Number(m[2]) * rootPx + (Number(m[3]) * vw) / 100), Number(m[4]) * rootPx);
  assert.ok(Math.abs(at(1440) - 72) < 1.5, `h2 at 1440: ${at(1440)}`);
  assert.equal(at(390), 28);
  assert.ok(at(1920, 18) <= 81 && at(1920, 18) > 72, `h2 at 1920: ${at(1920, 18)}`);
  assert.match(SECTIONS, /\.mm\.lp \.xs \.lp-h2 \{ font-size: clamp\(1\.75rem, 0\.8rem \+ 3\.6vw, 3\.25rem\); \}/);
});

test('H1: one fluid column from 1100 px: a 3.5vw gutter, at most 1680 px, the right edge clear of Mobi\'s lane while he guides', () => {
  assert.match(SECTIONS, /--sec-gutter: clamp\(24px, 3\.5vw, 64px\); --sec-max: 1680px; --sec-lane: 0px;/);
  assert.match(SECTIONS, /:root:not\(\[data-motion='reduced'\]\):not\(\[data-pip-static\]\) \.mm\.lp \{ --sec-lane: 214px; \}/, '174 px lane plus 40 px of air (brand-pip.css)');
  assert.match(SECTIONS, /main > :is\(section, div\):not\(\.lp-hero\):not\(#pricing\) \.mm-wrap:not\(\.mm-wrap \.mm-wrap\) \{\s*max-width: none;\s*padding-left: max\(var\(--sec-gutter\), \(100% - var\(--sec-max\)\) \/ 2\);\s*padding-right: max\(var\(--sec-gutter\), \(100% - var\(--sec-max\)\) \/ 2, var\(--sec-lane\)\);/);
  // The bar and the footer share the left edge (one left edge on the page).
  assert.match(SECTIONS, /\.mm\.mm\.lp :is\(\.mm-nav, \.mm-foot\) > \.mm-wrap\.mm-wrap \{\s*max-width: none;\s*padding-left: max\(var\(--sec-gutter\), \(100% - var\(--sec-max\)\) \/ 2\);/);
  // The hero's own column and #pricing are other packets': never touched here.
  assert.doesNotMatch(SECTIONS, /\.lp-hero\s*[{.>]|#pricing\s*[{.]/);
  const imports = PAGE.match(/^import .*\.css';.*$/gm);
  // Round 7 (7 Nov 2026): the hero film's and the college strip's own sheets come after it. Round 10 (10 Nov 2026, owner
  // LK189): the refinement pass's five sheets, one per group of sections, come last of all; nothing else does.
  assert.deepEqual(imports.slice(-8), [
    "import './home-sections.css';", "import './hero-film.css';", "import './college-strip.css';",
    "import './r10-hero.css';", "import './r10-sample.css';", "import './r10-lab-tour.css';", "import './r10-tools.css';", "import './r10-close.css';",
  ], 'sections load after the hero sizing layer, the round 10 refinements after every older layer');
});

test('H1: a head\'s heading and its line stand side by side from 1100 px; Mobi\'s seats leave the flow while he guides; the FAQ sits beside its heading', () => {
  assert.match(SECTIONS, /grid-template-columns: minmax\(0, 7fr\) minmax\(0, 5fr\); column-gap: clamp\(2rem, 5vw, 6rem\);/);
  assert.match(SECTIONS, /> \.lp-sub \{ grid-column: 2; grid-row: 1; align-self: end; max-width: 34rem; \}/);
  assert.match(SECTIONS, /:has\(> \.lp-stamp\) > \.lp-sub \{ grid-row: 1 \/ span 2; \}/);
  assert.match(SECTIONS, /:is\(\.lp-guide-head, \.lp-close__inner\) > \.pip-seat \{ position: absolute; top: 0; right: 0; margin: 0; \}/);
  assert.match(SECTIONS, /\.lp-guide-head--lead \{ flex-direction: row; justify-content: space-between; \}/, 'the Compass head no longer starts 240 px in');
  assert.match(SECTIONS, /#faq \.mm-wrap--tight \{ display: grid; grid-template-columns: minmax\(0, 5fr\) minmax\(0, 7fr\);/);
});

test('H1/H5: the rhythm: 28 px a section side on phones (56 px between), 5vw on desktop; the held stories overlap their empty bands', () => {
  assert.match(SECTIONS, /\.mm\.lp main > \.lp-sec:not\(\.xs\) \{ padding-block: clamp\(1\.75rem, 5vw, 6rem\); \}/);
  assert.match(SECTIONS, /@media \(max-width: 760px\) \{\s*\.mm\.lp main > \.lp-sec:not\(\.xs\) \{ padding-block: 1\.75rem; \}/);
  assert.match(SECTIONS, /\.lc\.ss\[data-pinned='true'\] \{ margin-top: calc\(1rem - var\(--ss-top\)\); margin-bottom: calc\(-1 \* var\(--ss-bottom\)\); \}/);
  assert.match(SECTIONS, /\.ss--centre\.ss\[data-pinned='true'\] \{ margin-top: calc\(var\(--ss-slack, 0px\) \/ -2 \+ 1rem - var\(--ss-top\)\); margin-bottom: calc\(var\(--ss-slack, 0px\) \/ -2 - var\(--ss-bottom\)\); \}/);
  // The stage still keeps its bands while it holds, and its empty bands take no taps (scroll-story.css), so nothing is covered.
  assert.match(strip(read('src/app/scroll-story.css')), /\.ss\[data-pinned='true'\] \.ss__stage \{ pointer-events: none; \}/);
});

// ------------------------------------------------------------------------------------------------ H5: phones
test('H5 (LK126): Repair and SWOT show less at once on phones, so what shows is larger; nothing leaves the wide screen', () => {
  const block = LAB.slice(LAB.indexOf('@media (max-width: 759px) and (orientation: portrait)'));
  assert.match(block, /\.lcp--repair \.lcp-q__opts li:not\(\[data-state\]\), \.lcp--repair \.lcr-record, \.lcp--repair \.lcp-check, \.lcp--repair \.lcp-block\[data-kind='wrong'\] \{ display: none; \}/, 'the picked option and the key stay');
  assert.match(block, /\.lcp--swot \.lcp-plan:not\(\[data-first='true'\]\) \.lcp-plan__why, \.lcp--swot :is\(\.lcp-swot__detail, \.lcp-swot__see\) \{ display: none; \}/);
  const phone = block.slice(0, block.indexOf('}\n}') + 3);
  assert.doesNotMatch(phone, /lcp-block\[data-kind='(trap|right|rule)'\]|\.lcp-block \{[^}]*display: none|lcp-swot__title[^}]*display: none|lcp-plan__label[^}]*display: none|lcp-q__stem[^}]*display: none/, 'the trap, the key\'s reason, the rule, the question, the plan and the four groups stay');
});

test('H5 (LK127): Key cards tighter on phones (one 20 px step), the demo larger on desktop; the Day current dot is a volt mark with the olive rim', () => {
  assert.match(CARDS, /@media \(max-width: 760px\) \{\s*\.lp-kc__grid \{ gap: 1\.25rem; \}/);
  assert.match(CARDS, /@media \(min-width: 1100px\) \{\s*\.lp-kc__grid \{ grid-template-columns: minmax\(0, 1fr\) minmax\(0, 31rem\);/);
  assert.match(CARDS, /@media \(min-width: 1440px\) \{ \.lp-kc__grid \{ grid-template-columns: minmax\(0, 1fr\) minmax\(0, 36rem\); \} \}/);
  assert.match(CARDS, /html\[data-theme='light'\] \.kc-demo__pips li\[data-state='now'\]::after \{[^}]*background: var\(--volt\); box-shadow: 0 0 0 1px var\(--tick-rim\); \}/);
  assert.doesNotMatch(CARDS, /rgba\(82, 103, 0, 0\.28\)/, 'the rating key\'s hairline follows the token');
});

// ------------------------------------------------------------------------------------------------ the texture
test('H1: the brand texture is the answer sheet (rings and one mark a row) under the shelf, neutral, masked off the words, still', () => {
  const rule = SECTIONS.match(/\.mm\.lp \.lp-shelf::after \{([^}]*)\}/)[1];
  assert.match(rule, /url\("data:image\/svg\+xml,%3Csvg[^"]*%3Cpattern id='p'[^"]*r='5\.5'[^"]*"\) 0 0 \/ 104px 128px repeat;/);
  assert.match(rule, /mask-image: radial-gradient\(ellipse 48% 46% at 50% 54%, #000 18%, transparent 74%\);/);
  assert.match(rule, /z-index: -2;[^;]*;\s*pointer-events: none;|pointer-events: none;/);
  const tiles = [...SECTIONS.matchAll(/data:image\/svg\+xml,([^"]*)"/g)].map((x) => decodeURIComponent(x[1]));
  assert.equal(tiles.length, 2, 'one tile for Night, one for Day');
  for (const tile of tiles) {
    assert.doesNotMatch(tile, /d2f000|210[ ,]+240|9db400/i, 'never volt');
    assert.equal((tile.match(/<circle cx='\d+' cy='\d+' r='6'\/>/g) || []).length, 8, 'one pencil mark in each of the eight rows');
  }
  assert.match(SECTIONS, /@media \(prefers-contrast: more\) \{ \.mm\.lp \.lp-shelf::after \{ display: none; \} \}/);
  assert.doesNotMatch(SECTIONS, /animation|transition/, 'nothing in this layer moves');
});
