// node --test src/components/landing/landingPosition.test.mjs
// The landing's two pieces of top chrome: the Night/Day switch in the site bar, and the position band under it that
// names the held story you are in. Source-level checks that keep them wired to the page as it is.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const PAGE = read('../../app/page.js');
const BAND = read('./SectionPosition.jsx');
const CSS = read('../../app/section-position.css');
const RULES = CSS.replace(/\/\*[\s\S]*?\*\//g, ''); // without its comments
const NAV = read('../NavBar.jsx');
const TOGGLE = read('../ThemeToggle.jsx');
const THEME_CSS = read('../../app/marketing-theme.css');

// The page's named held stories, as { id, name } in the order the page lays them out.
const POSITION = PAGE.match(/const POSITION = \[([\s\S]*?)\n\];/)[1];
const IDS = [...POSITION.matchAll(/id: '([^']+)'/g)].map((m) => m[1]);

test('the band is mounted once, right under the site bar, with the page\'s held stories', () => {
  assert.match(PAGE, /import \{ SectionPosition \} from '@\/components\/landing\/SectionPosition';/);
  assert.equal((PAGE.match(/<SectionPosition /g) || []).length, 1);
  assert.match(PAGE, /<NavBar \/>\s*<SectionPosition sections=\{POSITION\} \/>/);
  assert.deepEqual(IDS, ['inside-the-lab', 'your-prep', 'score-recovery-lab']);
});

test('every name is a real section on the page, in page order, and a host for the stage offset', () => {
  let at = -1;
  for (const id of IDS) {
    const hit = PAGE.search(new RegExp(`<section className="[^"]*lp-pos-host[^"]*" id="${id}"`));
    assert.ok(hit > at, `${id} is a section with lp-pos-host, after the one before it`);
    at = hit;
  }
  assert.equal((PAGE.match(/lp-pos-host/g) || []).length, IDS.length, 'only the named sections are hosts');
});

test('the names are the words of the sections\' own headings, not the rejected branch\'s', () => {
  assert.match(POSITION, /name: 'Inside the Mistake Lab'/);
  assert.match(POSITION, /name: <>What’s inside <em>MockMob<\/em><\/>/);
  assert.match(POSITION, /name: 'Score Recovery Lab'/);
  assert.match(PAGE, /<p className="lp-kicker">Mistake Lab<\/p>/);
  assert.match(PAGE, /<h2 className="lp-h2">What’s inside MockMob\.<\/h2>/);
  assert.match(PAGE, /<p className="lp-kicker">Score Recovery Lab<\/p>/);
});

test('the band is a position readout: no link, no button, no live region, no tap', () => {
  assert.doesNotMatch(BAND, /<(a|button)\b|href=|onClick|aria-live|role="(status|alert|progressbar)"/);
  assert.match(BAND, /view\.on \? \{ role: 'group', 'aria-label': 'Where you are on this page' \} : null/, 'a labelled group only while it is on');
  assert.match(CSS, /\.mm\.lp \.lp-pos \{[^}]*pointer-events: none;/);
  assert.doesNotMatch(CSS, /pointer-events: auto/);
  assert.match(CSS, /\.lp-pos__band \{[^}]*visibility: hidden;/, 'out of the accessibility tree while it is off');
});

test('the band sits under the site bar and its menu, and never glows', () => {
  const z = Number(CSS.match(/\.lp-pos \{[^}]*z-index: (\d+)/)[1]);
  assert.ok(z < 60, 'the site bar is z-index 60');
  assert.doesNotMatch(RULES, /glow|text-shadow|box-shadow|drop-shadow|gradient\(/i);
  assert.match(CSS, /\.lp-pos__rule \{[^}]*height: 2px;/);
});

test('reduced motion, reduced transparency, short landscape windows and print are all handled', () => {
  assert.match(CSS, /@media \(prefers-reduced-motion: reduce\) \{[^}]*transition: none !important/);
  assert.match(CSS, /html\[data-motion='reduced'\] \.mm\.lp :is\(\.lp-pos__band, \.lp-pos__name\) \{[^}]*transition: none !important/);
  assert.match(CSS, /prefers-reduced-transparency: reduce/);
  assert.match(CSS, /@media \(max-height: 520px\) \{\s*\.mm\.lp \.lp-pos \{ display: none; \}/);
  assert.match(CSS, /@media print/);
  assert.doesNotMatch(RULES, /transition: all|ease-in[^-]/);
});

test("on a wide window the band keeps the bar's left edge, by the same lane the bar grows", () => {
  assert.match(CSS, /@media \(min-width: 1100px\) and \(prefers-reduced-motion: no-preference\) \{\s*:root:not\(\[data-motion='reduced'\]\) \.mm\.lp \.lp-pos__row \{ max-width: calc\(75rem \+ var\(--pip-lane\)\); \}/);
  assert.match(read('../../app/brand-pip.css'), /:is\(\.mm-nav, \.mm-foot\) > \.mm-wrap \{ max-width: calc\(75rem \+ var\(--pip-lane\)\); \}/);
});

test('the held stories start under the band and tuck up by its height, so the page reads as it did', () => {
  assert.match(CSS, /--lp-pos-h: 2\.5rem/);
  assert.match(CSS, /\.lp-pos-host \.ss \{ --ss-top: calc\(61px \+ env\(safe-area-inset-top, 0px\) \+ 0\.75rem \+ var\(--lp-pos-h\)\); \}/);
  assert.match(CSS, /\.lp-pos-host \.ss\[data-pinned='true'\] \{ margin-top: calc\(var\(--lp-pos-h\) \* -1\); \}/);
  assert.match(CSS, /\.lp-pos-host \.ss--centre\[data-pinned='true'\] \{ margin-top: calc\(var\(--ss-slack, 0px\) \/ -2 - var\(--lp-pos-h\)\); \}/);
  assert.match(CSS, /@media \(min-width: 900px\) and \(min-height: 521px\) \{\s*\.mm\.lp \.lp-pos-host \.ss \{ --ss-top: calc\(72px \+ 1\.25rem \+ var\(--lp-pos-h\)\); \}/);
});

test('the band reads geometry only for sections on screen, and writes state only when it changes', () => {
  assert.match(BAND, /new IntersectionObserver/);
  assert.match(BAND, /near\.has\(i\)/);
  assert.match(BAND, /current\.on === on && current\.label === label \? current/);
  assert.match(BAND, /rule\.style\.transform = `scaleX\(/);
  assert.match(BAND, /addEventListener\('scroll', onScroll, \{ passive: true \}\)/);
});

test('the Night/Day switch is in the landing\'s site bar: a labelled switch with a 44 px target', () => {
  assert.match(PAGE, /import \{ NavBar \} from '@\/components\/NavBar';/);
  assert.match(NAV, /<ThemeToggle hint \/>/);
  assert.match(TOGGLE, /role="switch"/);
  assert.match(TOGGLE, /aria-checked=\{dark\}/);
  assert.match(TOGGLE, /aria-label="Dark mode"/);
  assert.match(TOGGLE, /title=\{dark \? 'Switch to light mode' : 'Switch to dark mode'\}/);
  assert.match(THEME_CSS, /\.mm-theme-toggle \{[^}]*width: 64px; height: 44px;/);
  assert.match(THEME_CSS, /\.mm-theme-toggle:focus-visible \.mm-theme-toggle__sky \{ outline: 2px solid/);
  assert.match(THEME_CSS, /prefers-reduced-motion: reduce\) \{ \.mm-theme-toggle \*/);
  // The band keeps clear of the switch: it sits below the bar the switch lives in.
  assert.match(CSS, /--lp-pos-top: calc\(61px \+ env\(safe-area-inset-top, 0px\)\)/);
});
