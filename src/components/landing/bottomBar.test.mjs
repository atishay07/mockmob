// node --test src/components/landing/bottomBar.test.mjs
// R3-D4 (owner LK103/LK104, 5 Nov 2026), the bottom of the held stories and the shortcuts:
//   LK103 "Why does the card, when scrolling down, right now snap to the entire bottom of the phone? Rather than that,
//         below, like 10-20%, ... we can add some sort of a blur ... There should be a clear way to skip to the bottom or top."
//   LK104 "the Mob logo on the top should be working so that somebody can click it and go to the top, and there should be
//         something for the bottom also."
// What is pinned here: the band the held card stops above (scroll-story.css), the bottom bar (SectionPosition.jsx,
// section-position.css), the logo and shortcut jumps (pageJump.mjs, scrollBus.glideTo), the phone nav's Pricing pill
// (NavBar.jsx) and the Lab's short-phone fit (lab-cinema.css). The behaviour in real Chrome is oneGestureBench.mjs
// (runJump's bar-skip and logo places); the glide against the story controller is oneGestureJump.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { GLIDE_MS, GLIDE_SCREENS, HEAD_GAP, RISE_MS, RISE_PX, VEIL_IN_MS, planJump } from './pageJump.mjs';
import { stepCount, stepLabel } from './sectionPositionPhase.mjs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const STORY_CSS = strip(read('../../app/scroll-story.css'));
const BAR_CSS = strip(read('../../app/section-position.css'));
const LAB_CSS = strip(read('../../app/lab-cinema.css'));
const BAR = read('./SectionPosition.jsx');
const JUMP = read('./pageJump.mjs');
const BUS = read('./scrollBus.mjs');
const NAV = read('../NavBar.jsx');
const LOGO = read('../Logo.jsx');
const PAGE = read('../../app/page.js');

// ---------------------------------------------------------------- the rules as functions

test('a shortcut glides within three screens, jumps under a veil further, and jumps at once under reduced motion', () => {
  assert.deepEqual([GLIDE_MS, GLIDE_SCREENS, VEIL_IN_MS, RISE_MS, RISE_PX], [850, 3, 120, 240, 12]);
  assert.equal(planJump({ from: 0, to: 1, vh: 844 }), 'none', 'already there');
  assert.equal(planJump({ from: 2532, to: 0, vh: 844 }), 'glide', 'three screens exactly');
  assert.equal(planJump({ from: 2533, to: 0, vh: 844 }), 'veil', 'past three screens');
  assert.equal(planJump({ from: 6000, to: 0, vh: 844 }), 'veil', 'the owner\'s case: deep in the page');
  assert.equal(planJump({ from: 0, to: 18000, vh: 844 }), 'veil', 'the Pricing pill from the top');
  assert.equal(planJump({ from: 6000, to: 0, vh: 844, reduced: true }), 'instant');
  assert.equal(planJump({ from: 800, to: 0, vh: 844, reduced: true }), 'instant', 'no glide at all under reduced motion');
  assert.ok(HEAD_GAP >= 12 && HEAD_GAP <= 32, 'a heading lands a little under the site bar');
});

test('the bar counts the story\'s steps from 1: "2 of 4", read from --ss-steps or the beats', () => {
  assert.equal(stepCount('4'), 4);
  assert.equal(stepCount(' 8 '), 8);
  assert.equal(stepCount('', 4), 4, 'the beats when the property is missing');
  assert.equal(stepCount(undefined, 0), 1);
  assert.equal(stepLabel(1, 4), '2 of 4');
  assert.equal(stepLabel(0, 8), '1 of 8');
  assert.equal(stepLabel(9, 4), '4 of 4', 'never past the last');
  assert.equal(stepLabel(0, 0), '', 'nothing before a story is known');
});

// ---------------------------------------------------------------- the band the held card stops above

test('on a phone the held card stops above a bottom band: 11% of the window, 80 to 104 px, 64 px when 700 px tall or less', () => {
  assert.match(STORY_CSS, /@media \(max-width: 899px\) and \(min-height: 521px\) \{\s*:root \{ --ss-band: clamp\(80px, 11svh, 104px\); \}\s*\.ss \{ --ss-bottom: calc\(var\(--ss-band\) \+ env\(safe-area-inset-bottom, 0px\)\); \}/);
  assert.match(STORY_CSS, /@media \(max-width: 899px\) and \(min-height: 521px\) and \(max-height: 700px\) \{\s*:root \{ --ss-band: 64px; \}/);
  // It is the stage's own padding, so the fitted screens (data-ss-fit) scale to the room above it at load.
  assert.match(STORY_CSS, /padding: var\(--ss-top\) 0 var\(--ss-bottom\);/);
  // Landscape phones keep their own tight hold: no band there.
  assert.doesNotMatch(STORY_CSS, /max-height: 520px[^{]*\{[^}]*--ss-band/);
});

// ---------------------------------------------------------------- the bottom bar

test('the bar is one page-level fixed layer outside every stage, under the site bar, in the dock\'s slot', () => {
  const rule = BAR_CSS.match(/@media \(max-width: 899px\) and \(min-height: 521px\) \{\s*\.mm\.lp \.lp-bar \{([^}]*)\}/);
  assert.ok(rule, 'a phone rule for the bar');
  assert.match(rule[1], /position: fixed;/);
  assert.match(rule[1], /bottom: 0;/);
  assert.match(rule[1], /height: calc\(var\(--ss-band, 92px\) \+ env\(safe-area-inset-bottom, 0px\)\);/);
  assert.match(rule[1], /pointer-events: none;/);
  assert.match(rule[1], /visibility: hidden;/, 'out of the accessibility tree and the tab order while it is off');
  const z = Number(rule[1].match(/z-index: (\d+)/)[1]);
  assert.ok(z < 58 && z < 60, `z-index ${z}: under the veil (58) and the site bar (60)`);
  assert.match(BAR_CSS, /\.mm\.lp \.lp-bar \{ display: none; \}/, 'wide windows keep the band under the site bar');
  // Mounted once, beside the band, never inside a story (a lean would drag it).
  assert.equal((PAGE.match(/<SectionPosition /g) || []).length, 1);
  assert.doesNotMatch(read('./ScrollStory.jsx'), /lp-bar/);
});

test('its background is a progressive blur (1.5, 4, 8, 14 px, each masked lower) over a paper tint; a paper gradient alone when transparency is reduced or memory is low', () => {
  const blurs = [...BAR_CSS.matchAll(/\.lp-bar__blur i:nth-child\((\d)\) \{ -webkit-backdrop-filter: blur\(([\d.]+)px\); backdrop-filter: blur\([\d.]+px\); -webkit-mask-image: linear-gradient\(to bottom, transparent (\d+)%, #000 (\d+)%\)/g)];
  assert.deepEqual(blurs.map((m) => Number(m[2])), [1.5, 4, 8, 14]);
  const starts = blurs.map((m) => Number(m[3]));
  assert.deepEqual(starts, [...starts].sort((a, b) => a - b), 'each layer starts lower than the one before');
  assert.match(BAR_CSS, /\.lp-bar__blur::after \{[^}]*color-mix\(in srgb, var\(--paper\) 88%, transparent\) 100%/);
  assert.match(BAR_CSS, /@media \(prefers-reduced-transparency: reduce\) \{\s*\.mm\.lp \.lp-bar__blur i \{ display: none; \}/);
  assert.match(BAR_CSS, /\.lp-bar\[data-lite='true'\] \.lp-bar__blur i \{ display: none; \}/);
  assert.match(BAR, /navigator\.deviceMemory/);
  assert.match(BAR, /memory <= 4 && barRef\.current\) barRef\.current\.dataset\.lite = 'true';/);
});

test('one row: Top (44 x 44), the section\'s name with "n of N" over one segment per step, and Skip (44 px)', () => {
  assert.match(BAR, /<button type="button" className="lp-bar__top" onClick=\{top\} aria-label="Back to the top">/);
  assert.match(BAR, /<p className="lp-bar__name">\{live\?\.name\}<\/p>/);
  assert.match(BAR, /<p className="lp-bar__count">\{stepLabel\(bar\.step, bar\.steps\)\}<\/p>/);
  assert.match(BAR, /segments\.map\(\(i\) => <i key=\{i\} data-on=\{i <= bar\.step \? 'true' : 'false'\} \/>\)/);
  assert.match(BAR, /<a className="lp-bar__skip" href=\{`#\$\{bar\.next\.id\}`\} data-page-jump="">/);
  assert.match(BAR, /Skip\{bar\.next\.name \? <span className="sr-only"> to \{bar\.next\.name\}<\/span> : null\}/, 'the link\'s name starts with its visible word');
  assert.match(BAR_CSS, /\.lp-bar__row \{[^}]*grid-template-columns: 44px minmax\(0, 1fr\) auto;/);
  assert.match(BAR_CSS, /\.mm\.lp \.lp-bar__top \{ display: grid; place-items: center; width: 44px; height: 44px;/);
  assert.match(BAR_CSS, /\.mm\.lp :is\(\.lp-bar__top, \.lp-bar__skip\) \{[^}]*pointer-events: auto;[^}]*min-height: 44px;/);
  assert.match(BAR_CSS, /\.mm\.lp :is\(\.lp-bar__top, \.lp-bar__skip\):focus-visible \{ outline: 2px solid/);
  // The segments fill with the step over 220 ms, in the brand word's colour; the count is tabular and never under 12 px.
  assert.match(BAR_CSS, /\.lp-bar__steps i::after \{[^}]*background: var\(--brand-word, var\(--accent-text\)\);[^}]*transition: transform 220ms/);
  assert.match(BAR_CSS, /\.lp-bar__count \{[^}]*font: 600 0\.75rem/);
  assert.match(BAR_CSS, /\.lp-bar__count \{[^}]*tabular-nums/);
  assert.doesNotMatch(BAR, /aria-live|role="(status|alert|progressbar)"/, 'no announcement on every swipe');
  assert.match(BAR, /bar\.on \? \{ role: 'group', 'aria-label': 'Where you are on this page' \} : null/);
});

test('the bar follows the story\'s step, not the scroll: one MutationObserver on data-live and data-step, no per-frame read on a phone', () => {
  assert.match(BAR, /new MutationObserver\(read\)/);
  assert.match(BAR, /attributeFilter: \['data-live', 'data-step', 'data-pinned'\]/);
  assert.match(BAR, /root\.dataset\.pinned === 'true' && root\.dataset\.live === 'true'/);
  // State only when something on the bar changes.
  assert.match(BAR, /current\.on && current\.index === index && current\.step === step && current\.steps === steps\s*\? current/);
  // The band's per-frame read never runs on a phone.
  assert.match(BAR, /const PHONE = '\(max-width: 899px\)';/);
  assert.match(BAR, /listen\(near\.size > 0 && !phone\.matches\)/);
  // It enters on opacity and a short rise and leaves the same way; reduced motion swaps.
  assert.match(BAR_CSS, /\.lp-bar__row \{[^}]*transform: translate3d\(0, 8px, 0\);[^}]*transition: opacity 150ms ease-out, transform 200ms/);
  assert.match(BAR_CSS, /@media \(prefers-reduced-motion: reduce\) \{\s*\.mm\.lp :is\(\.lp-bar__row, \.lp-bar__blur, \.lp-veil\) \{ transition: none !important; transform: none !important; \}/);
  assert.match(BAR_CSS, /html\[data-motion='reduced'\] \.mm\.lp :is\(\.lp-bar__row, \.lp-bar__blur, \.lp-veil\) \{ transition: none !important;/);
  // The dock steps aside on the same signal (data-live), so the two never stack.
  assert.match(STORY_CSS, /\.mm\.lp:has\(\.ss\[data-live='true'\]\) \.mm-dock:not\(:focus-within\) \{ opacity: 0;/);
});

test('Skip goes to the next section with an id after the held one; the statement keeps its dock', () => {
  assert.match(BAR, /function nextSection\(host\) \{[\s\S]*node\.nextElementSibling[\s\S]*if \(!node\.id \|\| node\.hidden\) continue;/);
  // The statement is `quiet` (data-live stays false), so the bar never shows for it and the dock keeps its slot.
  assert.match(read('./Statement.jsx'), /\bquiet\b/);
  assert.match(read('./ScrollStory.jsx'), /data-live=\{live && !quiet \? 'true' : 'false'\}/);
});

// ---------------------------------------------------------------- the jumps

test('the logo and the shortcut links are taken in the capture phase, ahead of the router, and move only through the bus', () => {
  assert.match(JUMP, /document\.addEventListener\('click', onClick, true\)/);
  assert.match(JUMP, /if \(anchor\.matches\('\.logo'\) && !url\.hash\) \{\s*event\.preventDefault\(\);\s*toTop\(\);/);
  assert.match(JUMP, /if \(anchor\.hasAttribute\('data-page-jump'\) && url\.hash/);
  assert.match(JUMP, /url\.pathname !== window\.location\.pathname\) return;/, 'only on the page it is on');
  assert.doesNotMatch(strip(JUMP), /window\.scroll(To|By)\(|scrollIntoView\(/, 'every move goes through the scroll bus');
  assert.match(JUMP, /bus\.glideTo\(at, \{ ms: GLIDE_MS, done: arrive \}\)/);
  assert.match(JUMP, /bus\.instantTo\(at\(\)\)/);
  assert.match(JUMP, /bus\.jump\(at\(\)\);\s*veil\.dataset\.on = 'true';/, 'declared before the veil is up, so the tap is not a fling');
  assert.match(BAR, /useEffect\(\(\) => installPageJumps\(\), \[\]\);/, 'installed by the home page\'s position chrome');
  // The Logo stays a plain server-safe Link; its class is the hook.
  assert.match(LOGO, /className=\{`logo \$\{className\}`\.trim\(\)\}/);
  assert.doesNotMatch(LOGO, /use client|onClick/);
});

test('the glide is the bus\'s: declared for its whole length, ended by any input of the reader\'s', () => {
  const code = BUS.split('\n').filter((line) => !/^\s*\/\//.test(line)).join('\n');
  assert.match(code, /export function glideTo\(target, \{ ms = 850, ease = easeInOutCubic, done \} = \{\}\) \{/);
  assert.match(code, /jump\(end\(\)\);/);
  assert.match(code, /window\.scrollTo\(\{ top: Math\.round\(from \+ \(to - from\) \* ease\(k\)\), behavior: 'instant' \}\);/);
  assert.match(code, /if \(gliding\) \{ armJump\(\); return; \}/, 'a glide has not arrived until it ends');
  assert.match(code, /window\.addEventListener\(type, userTook, \{ passive: true \}\)/);
  assert.match(code, /function userTook\(\) \{\s*if \(gliding\) \{ gliding = false; window\.cancelAnimationFrame\(glideFrame\);/);
});

test('the veil is the page\'s paper under the site bar: 120 ms in, 240 ms out', () => {
  assert.match(BAR_CSS, /\.mm\.lp \.lp-veil \{[^}]*position: fixed;[^}]*inset: 0;[^}]*z-index: 58;[^}]*background: var\(--paper\);[^}]*pointer-events: none;/);
  assert.match(BAR_CSS, /\.mm\.lp \.lp-veil \{[^}]*transition: opacity 240ms/);
  assert.match(BAR_CSS, /\.mm\.lp \.lp-veil\[data-on='true'\] \{ opacity: 1; visibility: visible; transition: opacity 120ms ease-out, visibility 0s; \}/);
  assert.match(BAR, /<div className="lp-veil" aria-hidden="true" \/>/);
});

test('the phone nav carries a small Pricing pill on the home page only, hidden with the other prices in the app', () => {
  // Round 4 (owner LK133, 5 Nov 2026): the pill opens the /pricing page, not the home page's #pricing (supersedes R3-D4's jump).
  assert.match(NAV, /\{pathname === '\/' \? \(\s*<Link href="\/pricing" className="mm-nav__price" data-commerce="">\s*<span>Pricing<\/span>\s*<\/Link>\s*\) : null\}/);
  assert.doesNotMatch(NAV, /href="#pricing"/, 'no bar link jumps to the plan on the home page');
  assert.match(BAR_CSS, /\.mm \.mm-nav__price \{ display: none; \}/);
  assert.match(BAR_CSS, /@media \(min-width: 375px\) and \(max-width: 899px\) \{\s*\.mm \.mm-nav__price \{[^}]*min-height: 44px;/, 'a 44 px target on phones from 375 px');
  // Below 400 px the row closes up so the menu key keeps its place; below 375 px there is no room (measured), the menu keeps Pricing.
  assert.match(BAR_CSS, /@media \(min-width: 375px\) and \(max-width: 399px\) \{\s*\.mm \.mm-nav__row:has\(\.mm-nav__price\) \{ gap: 0\.5rem; \}/);
  assert.match(BAR_CSS, /\.mm \.mm-nav__price > span \{[^}]*height: 30px;[^}]*border-radius: 999px;/);
  assert.ok(existsSync(new URL('../../app/pricing/page.js', import.meta.url)), 'the page it opens');
});

test('the Lab fits a short phone: on a portrait window 700 px tall or less its chrome gives the room back before the screen scales to half', () => {
  const rule = LAB_CSS.match(/@media \(max-width: 959px\) and \(max-height: 700px\) and \(orientation: portrait\) \{([\s\S]*?)\n\}/);
  assert.ok(rule, 'a short-phone rule');
  assert.match(rule[1], /\.lc \.lc-scene__fit \{ --ss-fit-min: 0\.5; \}/);
  assert.match(rule[1], /\.lc \.lc__rail button \{ flex-direction: row;[^}]*min-height: 44px;/, 'the rail keeps 44 px targets');
  assert.match(rule[1], /-webkit-line-clamp: 2; line-clamp: 2;/);
});
