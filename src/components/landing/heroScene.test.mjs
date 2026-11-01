// The home hero as the Play app's welcome (LK32, 1 Nov 2026; hero.md): the app's own painted room instead of the
// redrawn SVG (V16, D191, retired), the rigged Mobi standing in its light, his line in a bubble, one key and a quiet
// text link, two quiet fact lines, and the sample on the first screen. Tablets and desktop: no room; Mobi hosts the
// sample. The headless walk (scripts/design-audit/hero-1101-r2-capture.mjs) checks the same on the running page.
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

test('the room is the app\'s painted file, not a drawn SVG room', () => {
  assert.ok(!existsSync(new URL('./HeroScene.jsx', import.meta.url)), 'HeroScene.jsx is gone');
  assert.doesNotMatch(PAGE, /HeroScene|lp-scene__art|lp-hero__for|For CUET UG 2027/);
  assert.doesNotMatch(ROOM, /<rect|<polygon|<path/, 'no drawn room shapes');
  assert.match(ROOM, /sceneArt\('welcomeBand'\)/);
  assert.match(ROOM, /sceneArt\('allClear', \{ night: false \}\)/);
  assert.match(PAGE, /<div className="lp-hero__greeting"><HeroRoom \/><HeroMobi variant="room" poster=\{<MobiPoster id="room" \/>\} \/><\/div>/);
});

test('the band files exist within budget and the scene model knows them', () => {
  const band = sceneArt('welcomeBand');
  assert.deepEqual(band.widths, [780, 1170]);
  assert.deepEqual(band.cropY, [0.2, 0.95]);
  assert.ok(allSceneFiles().some((f) => f.src === sceneSrc(band, 780, 'avif')));
  const kb = (w, f) => statSync(pub(sceneSrc(band, w, f))).size / 1000;
  assert.ok(kb(780, 'avif') <= 55, `780w avif ${kb(780, 'avif')} KB`);
  assert.ok(kb(1170, 'avif') <= 95, `1170w avif ${kb(1170, 'avif')} KB`);
  for (const w of band.widths) assert.ok(existsSync(pub(sceneSrc(band, w, 'webp'))));
  const day = sceneArt('allClear', { night: false });
  assert.ok(statSync(pub(sceneSrc(day, 768, 'avif'))).size / 1000 <= 30);
});

test('only the shown theme\'s file is fetched, and nothing shifts when it decodes', () => {
  // Both pictures are lazy; the other theme's box is display: none, which a browser never fetches.
  assert.equal((ROOM.replace(/^\s*\/\/.*$/gm, '').match(/loading="lazy"/g) || []).length, 1, 'one Picture component, lazy');
  assert.match(ROOM, /decoding="async"/);
  assert.match(ROOM, /width=\{art\.width\} height=\{art\.height\} alt=""/);
  assert.match(ROOM, /<Picture art=\{NIGHT\} sizes="100vw"/);
  assert.match(ROOM, /<Picture art=\{DAY\} sizes="150vw"/);
  const css = strip(CSS);
  assert.match(css, /\.lp-room__paint--night \{ display: none;/);
  assert.match(css, /:root\[data-theme='dark'\] \.lp-room__paint--night \{ display: block; \}/);
  assert.match(css, /:root\[data-theme='dark'\] \.lp-room__paint--day \{ display: none; \}/);
  // The room's height is fixed before anything loads.
  assert.match(css, /--room-h: clamp\(17rem, 38svh, 20rem\);/);
  assert.match(css, /height: var\(--room-h\);/);
});

test('the painting sits where hero.md places it: the floor ellipse 28 px above the room\'s foot', () => {
  const css = strip(CSS);
  // Night: W wide, 1.25 W tall; top = room - 28 px - 0.853 x 1.25 W.
  assert.equal(+(anchors.welcome.ellipse.cy * 125).toFixed(3), 106.625);
  assert.match(css, /\.lp-room__paint--night \{[^}]*height: 125cqw; top: calc\(var\(--room-h\) - 28px - 106\.625cqw\); \}/);
  // Day: 1.5 W wide, 1.0 W tall, centred; ellipse at 0.785.
  assert.equal(anchors.vignette.scenes.allClear.life.ellipseY, 0.785);
  assert.match(css, /\.lp-room__paint--day \{ left: -25cqw; width: 150cqw; height: 100cqw; top: calc\(var\(--room-h\) - 28px - 78\.5cqw\); \}/);
  // The band file inside the painting's frame.
  assert.match(css, /\.lp-room__file--night \{ top: 20%; height: 75%; \}/);
});

test('each tap fills the next of six measured sheet bubbles at Night, 120 ms after the tap; Day has no overlay', () => {
  const bubbles = anchors.welcome.sheetBubbles;
  assert.equal(bubbles.centers.length, 6);
  for (const [x, y] of bubbles.centers) assert.ok(x > anchors.welcome.sheetLeft && x < 0.9 && y > 0.4 && y < 0.6, 'on the sheet');
  assert.match(ROOM, /viewBox=\{`0 0 \$\{PAINT\.width\} \$\{PAINT\.height\}`\}/);
  assert.match(ROOM, /window\.setTimeout\(\(\) => setFilled[\s\S]{0,120}\), 120\);/);
  assert.equal((ROOM.match(/lp-room__sheet/g) || []).length, 1, 'one overlay, inside the Night painting');
  assert.ok(ROOM.indexOf('lp-room__sheet') < ROOM.indexOf('lp-room__paint--day'));
  assert.match(strip(CSS), /\.lp-room__dot\[data-on\] \{ transform: none; opacity: 1; transition: transform 180ms cubic-bezier\(0\.23, 1, 0\.32, 1\)/);
});

test('the room breathes once and rests; never under Reduce motion', () => {
  assert.match(ROOM, /<SceneLife scene="welcome" night breaths=\{1\} \/>/);
  assert.match(ROOM, /<SceneLife scene="allClear" night=\{false\} breaths=\{1\} \/>/);
  const life = lifeLayers(anchors, 'welcome');
  assert.equal(life.glow.x, anchors.welcome.lamp.x);
  assert.equal(life.motes.length, anchors.vignette.life.motes);
  assert.equal(life.aspect, 1.25);
  assert.match(read('../scenes/SceneLife.jsx'), /if \(!run \|\| done \|\| prefs\.reduced \|\| saveData\(\)\) return null;/);
});

test('phones only: wider screens never draw the room', () => {
  const css = strip(CSS);
  assert.match(css, /^\.lp-room,\n\.lp-mobi--room,\n\.lp-mobi--host \{ display: none; \}/m);
  const outside = css.replace(/@media \(max-width: 760px\)[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
  assert.doesNotMatch(outside, /\.lp-room \{|\.lp-room__paint--(night|day) \{|\.lp-mobi--room \{/);
  assert.match(css, /@media \(min-width: 761px\) \{\n\s+\.mm\.lp \.lp-hero__greeting \{ display: none; \}/);
});

test('the details band is two quiet lines: no eyebrow, no stacked checks, no three-line bank sentence', () => {
  // R3 H2: the line is the segments, each in its own nowrap span (heroLines.test.mjs pins the markup).
  assert.ok(PAGE.includes('<p className="lp-trust-line">{heroTrustSegments(priceLine(OFFER), '));
  assert.match(PAGE, /<QuestionBankLine variant="short" className="lp-bank lp-bank--short" \/>/);
  assert.doesNotMatch(PAGE, /<ul className="lp-trust"/);
  assert.match(strip(CSS), /\.lp \.lp-hero__facts > p \{ margin: 0; max-width: none; font-size: 0\.8125rem;/);
});

test('the sample loses its repeated lines and opens the reasoning only once answered', () => {
  assert.doesNotMatch(DRILL, /Tap an answer\. No signup needed\.|mm-drill__ghost|The reasoning shows up here/);
  assert.match(DRILL, /<div className="mm-drill__reveal" data-open=\{answered \? 'true' : 'false'\}>/);
  assert.doesNotMatch(PAGE, /lp-stage__path|Read why it’s right/);
  assert.match(PAGE, /<p className="lp-stage__note">Five CUET-style questions, each with the why\.<\/p>/);
  const css = strip(CSS);
  assert.match(css, /grid-template-rows: 0fr;\n\s+transition: grid-template-rows 240ms/);
  assert.match(css, /\.mm-drill__reveal\[data-open='true'\] \{ grid-template-rows: 1fr; \}/);
});

test('the entrance plays once in hero.md\'s order; nothing loops', () => {
  const css = strip(CSS);
  assert.match(css, /\.lp-mobi--room \.lp-mobi__figure \{ animation: lp-mobi-appear 750ms [^;]* 150ms backwards; \}/);
  assert.match(css, /\.lp-title \{ animation: lp-scene-rise 420ms [^;]* 240ms backwards; \}/);
  assert.match(css, /\.lp-cta\[data-hero\] \{ animation-delay: 330ms; \}/);
  assert.match(css, /\.lp-mobi--room \.lp-mobi__bubble \{ animation: lp-scene-bubble 260ms [^;]* 900ms backwards; \}/);
  assert.match(css, /@keyframes lp-scene-rise \{ from \{ transform: translate3d\(0, 8px, 0\); \} \}/, 'the title never starts invisible');
  assert.doesNotMatch(css, /infinite/);
  assert.match(css, /transition: opacity 200ms/, 'the room fades in once decoded');
});

test('reduce motion (the system setting or the site switch) gets fades only', () => {
  const css = strip(CSS);
  assert.match(css, /@media \(max-width: 760px\) and \(prefers-reduced-motion: reduce\) \{[^}]*\{ animation: lp-scene-fade 240ms ease-out backwards; \}/);
  assert.match(css, /:root\[data-motion='reduced'\] \.lp-mobi--room \.lp-mobi__bubble \{ animation: lp-scene-fade 240ms ease-out backwards; \}/);
  assert.match(css, /:root\[data-motion='reduced'\] \.lp-mobi__line \{ animation: lp-line-fade 120ms ease-out both; \}/);
  assert.match(css, /:root\[data-motion='reduced'\] \.lp-room__dot\[data-on\] \{ transform: none; transition: opacity 120ms ease-out; \}/);
});

test('one key: the second hero action is a quiet text link with a 44 px target and a visible focus ring', () => {
  const css = strip(CSS);
  assert.match(css, /\.lp \.lp-cta \.mm-actions > a:nth-child\(2\) \{\n\s+min-height: 44px;[\s\S]*?background: transparent;\n\s+box-shadow: none;/);
  assert.match(css, /\.lp \.lp-cta \.mm-actions > a:focus-visible \{ outline: 2px solid/);
});

test('no video, GIF or frame sequence anywhere in the hero', () => {
  const hero = PAGE.slice(PAGE.indexOf('<section className="lp-hero">'), PAGE.indexOf('{/* Second hero beat'));
  for (const src of [hero, ROOM, MOBI]) assert.doesNotMatch(src, /<video|\.mp4|\.webm|\.gif|mobi3d/);
});
