// The home hero's desk (1104 "Desk Light", SPEC-HOME-1104 P2; LK67): one hero idea at every width. The room
// (HeroRoom, the app's own painted file), Mobi standing in its lamp pool (HeroMobi, the rigged Mobi), his bubble on
// the floor, and the real sample card (DemoDrill) attached to the room's foot. Phones stack it; desktop puts the
// desk in the right column. Source-level, so no server is needed; tmp/home-1104/build-p2/shoot.mjs and
// homeHero.test.mjs (HOME_HERO_URL) check the same on the running page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import anchors from '../../../data/scene-anchors.json' with { type: 'json' };
import { sceneArt, sceneSrc, allSceneFiles, lifeLayers } from '../scenes/sceneModel.mjs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const ROOM = read('./HeroRoom.jsx');
const MOBI = read('./HeroMobi.jsx');
const CSS = read('../../app/hero-scene.css');
const PAGE = read('../../app/page.js');
const DRILL = read('./DemoDrill.jsx');
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const pub = (src) => new URL(`../../../public${src}`, import.meta.url);
const HERO = PAGE.slice(PAGE.indexOf('<section className="lp-hero">'), PAGE.indexOf('STATEMENT (scroll-scrubbed)'));
// Every @media block's body, so a rule can be checked inside or outside them.
const mediaBlocks = (css) => {
  const out = [];
  const re = /@media[^{]*\{/g;
  let m;
  while ((m = re.exec(css))) {
    let depth = 1;
    let i = re.lastIndex;
    while (depth && i < css.length) { if (css[i] === '{') depth += 1; else if (css[i] === '}') depth -= 1; i += 1; }
    out.push(css.slice(m.index, i));
  }
  return out;
};

test('LK67: one desk at every width, the room and Mobi inside it, the card attached to its foot', () => {
  // R3-D3 (5 Nov 2026): the second beat is a strip under the hero (the judged pick), so the desk is the room, Mobi and
  // the attached card, as before.
  assert.match(HERO, /<div className="lp-desk" id="try-practice">\s*<div className="lp-desk__stage">\s*<HeroRoom \/>\s*<HeroMobi poster=\{<MobiPoster id="desk" \/>\} \/>\s*<\/div>\s*<div className="lp-desk__card">\s*<DemoDrill note=/);
  assert.equal((HERO.match(/<HeroMobi /g) || []).length, 1, 'one Mobi in the hero');
  assert.doesNotMatch(PAGE, /variant="(room|host)"|lp-hero__greeting|lp-stage__heading|lp-stage__note/);
  assert.doesNotMatch(MOBI, /variant\s*=|\{ variant/, 'HeroMobi has one variant');
  assert.match(ROOM, /className="lp-room lp-desk__room"/);
  assert.match(MOBI, /className="lp-mobi lp-desk__mobi"/);
});

test('LK67: no media query hides the room, Mobi, his bubble or the desk', () => {
  const css = strip(CSS);
  for (const block of mediaBlocks(css)) {
    assert.doesNotMatch(block, /\.lp-(room|desk|desk__room|desk__mobi|desk__figure|desk__bubble|desk__stage)\s*\{[^}]*display:\s*none/, block.slice(0, 80));
  }
  // The only display: none on the room's parts is the other theme's painting.
  const nones = [...css.matchAll(/([^{}]+)\{[^{}]*display:\s*none[^{}]*\}/g)].map((m) => m[1].trim());
  for (const sel of nones) assert.match(sel, /lp-room__paint--(night|day)/, sel);
});

test('LK67: Mobi\'s size rule (134 px on phones, 180 px on desktop) and his place in the lamp pool', () => {
  const css = strip(CSS);
  assert.match(css, /--mobi-h: min\(134px, calc\(var\(--desk-h, 212px\) - 34px\)\);/);
  assert.match(css, /@media \(min-width: 960px\) \{[\s\S]*\.lp-desk__figure \{ --mobi-h: 180px; left: 46px;/);
  assert.match(css, /--desk-h: clamp\(10\.5rem, 25svh, 13\.25rem\);/, 'the phone room: 168 to 212 px');
  assert.match(css, /\.mm\.lp \.lp-desk \{ --desk-h: 318px; margin: 0; \}/, 'the desktop room: 318 px');
  assert.match(css, /grid-template-columns: minmax\(0, 1fr\) 520px;/);
});

test('the room is the app\'s painted file, not a drawn SVG room, and only the shown theme\'s file is fetched', () => {
  assert.ok(!existsSync(new URL('./HeroScene.jsx', import.meta.url)), 'HeroScene.jsx is gone');
  assert.doesNotMatch(ROOM, /<rect|<polygon|<path/, 'no drawn room shapes');
  assert.match(ROOM, /sceneArt\('welcomeBand'\)/);
  assert.match(ROOM, /sceneArt\('allClear', \{ night: false \}\)/);
  assert.equal((ROOM.replace(/^\s*\/\/.*$/gm, '').match(/loading="lazy"/g) || []).length, 1, 'one Picture component, lazy');
  assert.match(ROOM, /decoding="async"/);
  assert.match(ROOM, /width=\{art\.width\} height=\{art\.height\} alt=""/);
  const css = strip(CSS);
  assert.match(css, /\.lp-room__paint--night \{ display: none;/);
  assert.match(css, /:root\[data-theme='dark'\] \.lp-room__paint--night \{ display: block; \}/);
  assert.match(css, /:root\[data-theme='dark'\] \.lp-room__paint--day \{ display: none; \}/);
});

test('the band files exist within budget and the scene model knows them', () => {
  const band = sceneArt('welcomeBand');
  assert.deepEqual(band.widths, [780, 1170]);
  assert.deepEqual(band.cropY, [0.2, 0.95]);
  assert.ok(allSceneFiles().some((f) => f.src === sceneSrc(band, 780, 'avif')));
  const kb = (w, f) => statSync(pub(sceneSrc(band, w, f))).size / 1000;
  assert.ok(kb(780, 'avif') <= 55, `780w avif ${kb(780, 'avif')} KB`);
  assert.ok(kb(1170, 'avif') <= 95, `1170w avif ${kb(1170, 'avif')} KB`);
  const day = sceneArt('allClear', { night: false });
  assert.ok(statSync(pub(sceneSrc(day, 768, 'avif'))).size / 1000 <= 30);
});

test('the painting\'s place: Night keeps its answer sheet in view at any room height; Day is overscanned to 118 %', () => {
  const css = strip(CSS);
  // The sheet's top row (y 0.4214) sits under the top: the painting's y 0.403 at the room's top, its box 1.25 W tall.
  // The painted row above it ends at about 0.395, so it stays out of frame (no half-cut bubbles at the edge).
  const top = Math.min(...anchors.welcome.sheetBubbles.centers.map(([, y]) => y)) - anchors.welcome.sheetBubbles.r;
  assert.ok(top > 0.403, 'the top bubble is below the room\'s top edge');
  assert.equal(+(0.403 * 125).toFixed(3), 50.375);
  assert.match(css, /\.lp-room__paint--night \{ display: none; left: 0; width: 100cqw; height: 125cqw; top: -50\.375cqw; \}/);
  assert.match(css, /\.lp-room__file--night \{ top: 20%; height: 75%; \}/);
  // Top-anchored in cqw (4 Nov integration): the pinned sheet shows whole at every room height, and the painting still
  // runs at least 40 px past the room's foot at 360, 390 and 1440, so its feathered edge never shows.
  assert.match(css, /\.lp-room__paint--day \{ left: -9cqw; width: 118cqw; height: 78\.667cqw; top: -8cqw; \}/);
  assert.equal(+(118 / 1.5).toFixed(3), 78.667, 'the Day file is 3:2');
});

test('decision 13: the Night sheet fills one bubble per sample answer (not per tap), 120 ms after it; Day has no overlay', () => {
  const bubbles = anchors.welcome.sheetBubbles;
  assert.equal(bubbles.centers.length, 6);
  assert.match(ROOM, /window\.addEventListener\(DEMO_STATE_EVENT, onState\)/);
  assert.doesNotMatch(ROOM, /HERO_TAP_EVENT|mm:mobi-tap/, 'taps fill nothing');
  assert.match(ROOM, /setFilled\(\(n\) => Math\.max\(n, Math\.min\(BUBBLES\.centers\.length, answered\)\)\), SHEET_FILL_DELAY_MS\)/);
  assert.match(ROOM, /export const SHEET_FILL_DELAY_MS = 120;/);
  assert.equal((ROOM.match(/lp-room__sheet/g) || []).length, 1, 'one overlay, inside the Night painting');
  assert.ok(ROOM.indexOf('lp-room__sheet') < ROOM.indexOf('lp-room__paint--day'));
  assert.match(strip(CSS), /\.lp-room__dot\[data-on\] \{ transform: none; opacity: 1; transition: transform 180ms cubic-bezier\(0\.23, 1, 0\.32, 1\)/);
});

test('decision 13: the bubble never changes size; the line cross-fades over 180 ms with a 4 px rise', () => {
  assert.match(MOBI, /\{DESK_STATES\.map\(\(key\) => \(\s*<span key=\{key\} className="lp-desk__line" data-on=\{key === state \? 'true' : undefined\}>\{DESK_LINES\[key\]\}<\/span>/);
  assert.match(MOBI, /<span className="sr-only" aria-live="polite">\{line\}<\/span>/, 'a screen reader hears the current line');
  const css = strip(CSS);
  assert.match(css, /\.lp-desk__bubble \{[^}]*display: grid;[^}]*width: 9\.75rem;/);
  assert.match(css, /\.lp-desk__line \{\n\s+grid-area: 1 \/ 1;/, 'all lines share one cell, so the widest sets the box');
  assert.match(css, /transform: translate3d\(0, 4px, 0\);\n\s+transition: opacity 180ms/);
  assert.doesNotMatch(css, /\.lp-desk__bubble[^{]*\{[^}]*(transition|animation)[^}]*(width|height)/);
});

test('decision 2: his first frame is the open-eyed wave (the poster), and the rig enters that same act', () => {
  assert.match(MOBI, /export const HERO_FIRST_ACT = 'wave';/);
  assert.match(MOBI, /useState\(HERO_FIRST_ACT\)/);
  assert.match(MOBI, /enterAt=\{ENTER_AT\}/);
  assert.match(read('../../../scripts/brand/build-mobi-poster.mjs'), /const ACT = 'wave';\nconst initial = poseRig\(moves, book, ACT, 'calm', \{ live: false \}\);/);
  assert.match(read('./mobiPoster.generated.js'), /the wave's still pose, mood calm, eyes open/);
  assert.doesNotMatch(MOBI, /'hello'/, 'never the closed-eye hello squint');
  assert.match(MOBI, /export const HERO_TAP_CYCLE = Object\.freeze\(\{ acts: \['hop', 'tilt', 'startle'\]/, 'taps never squint either');
});

test('the sample: a theme-aware card with the subject and "1 of 5" as two spans, a Literata stem, the reasoning only once answered', () => {
  assert.match(DRILL, /<span className="lp-card__sub"><b>\{question\.subject\}<\/b><span>\{index \+ 1\} of \{DRILL\.length\}<\/span><\/span>/);
  assert.doesNotMatch(DRILL, /mm-screen|·|Mascot/, 'no forced night screen, no middle dot, no second Mobi');
  assert.match(DRILL, /<div className="mm-drill__reveal" data-open=\{answered \? 'true' : 'false'\}>/);
  // D1 (owner LK83/LK88, 5 Nov 2026): the note is one even line with no link; sign-up is the hero's volt key.
  assert.match(HERO, /<DemoDrill note="No sign-up for these five\." \/>/);
  const css = strip(CSS);
  assert.match(css, /\.mm\.lp \.lp-desk \.mm-drill__q \{[^}]*font-family: var\(--font-stem, Georgia, 'Times New Roman', serif\);/);
  assert.match(css, /grid-template-rows: 0fr; transition: grid-template-rows 240ms/);
  assert.match(css, /\.mm-drill__reveal\[data-open='true'\] \{ grid-template-rows: 1fr; \}/);
});

test('the room breathes once and rests; never under Reduce motion', () => {
  assert.match(ROOM, /<SceneLife scene="welcome" night breaths=\{1\} \/>/);
  assert.match(ROOM, /<SceneLife scene="allClear" night=\{false\} breaths=\{1\} \/>/);
  const life = lifeLayers(anchors, 'welcome');
  assert.equal(life.aspect, 1.25);
  assert.match(read('../scenes/SceneLife.jsx'), /if \(!run \|\| done \|\| prefs\.reduced \|\| saveData\(\)\) return null;/);
});

test('nothing in the hero loops; reduce motion gets fades or nothing', () => {
  const css = strip(CSS);
  assert.doesNotMatch(css, /infinite/);
  assert.match(css, /:root\[data-motion='reduced'\] \.lp-desk__line \{ transform: none; \}/);
  assert.match(css, /:root\[data-motion='reduced'\] \.lp-room__dot\[data-on\] \{ transition: opacity 120ms ease-out; \}/);
});

test('no video, GIF or frame sequence anywhere in the hero', () => {
  for (const src of [HERO, ROOM, MOBI]) assert.doesNotMatch(src, /<video|\.mp4|\.webm|\.gif|mobi3d/);
});
