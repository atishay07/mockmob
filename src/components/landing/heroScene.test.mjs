// The phone hero as the app's welcome (V16, D191, 20 Oct 2026): a lamp-lit study drawn in SVG, Mobi standing in its
// light with his line in a bubble, one key and a quiet text link. Phones only; tablet and desktop are unchanged.
// The headless walk (tmp/v16-web/hero) checks the same on the running page at 390, 360 and 1440, Night and Day.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const SCENE = read('./HeroScene.jsx');
const CSS = read('../../app/hero-scene.css');
const PAGE = read('../../app/page.js');
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

test('the scene is SVG in the page: no raster, no request, decoration only', () => {
  assert.doesNotMatch(SCENE, /<img|<Image|url\(['"]?(https?:|\/)|\.(png|jpe?g|webp|avif)/i);
  assert.match(SCENE, /className="lp-scene" aria-hidden="true"/);
  assert.match(SCENE, /preserveAspectRatio="xMidYMax slice"/);
});

test('the page draws the scene and the bubble inside the hero row, with the hero seat kept as the one Mobi', () => {
  assert.match(PAGE, /<div className="lp-hero__greeting"><HeroScene \/>.*<MascotSeat station="hero" pose="greeting"[^>]*\/><p className="lp-scene__bubble">Hi, I’m Mobi\. Let’s find yours\.<\/p><\/div>/);
  assert.equal((PAGE.match(/station="hero"/g) || []).length, 1);
  assert.match(PAGE, /import '\.\/hero-scene\.css';/);
});

test('phones only: wider screens never draw the scene or the bubble', () => {
  const css = strip(CSS);
  assert.match(css, /^\.lp-scene,\n\.lp-scene__bubble \{ display: none; \}/m);
  // Every rule that shows or lays out the scene sits under max-width 760 px.
  const outside = css.replace(/@media \(max-width: 760px\)[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
  assert.doesNotMatch(outside, /display: block|grid-area|lp-hero__greeting|lp-cta|lp-trust|lp-bank/);
});

test('the room reserves its height, so nothing shifts when it paints', () => {
  assert.match(CSS, /--scene-h: clamp\(17rem, 44svh, 26rem\);/);
  assert.match(CSS, /grid-template-rows: var\(--scene-h\) auto;/);
});

test('the entrance plays once: light, Mobi, title and key 90 ms apart, the bubble last; nothing loops', () => {
  const css = strip(CSS);
  assert.match(css, /\.sc-light,[^{]*\.sc-bulb \{ animation: lp-scene-fade 300ms/);
  assert.match(css, /\.pip-seat__art \{ animation: lp-scene-mobi 360ms cubic-bezier\(0\.23, 1, 0\.32, 1\) 150ms backwards; \}/);
  assert.match(css, /@keyframes lp-scene-mobi \{ from \{ opacity: 0; transform: translate3d\(0, 12px, 0\); \} \}/);
  assert.match(css, /\.lp-title \{ animation: lp-scene-rise 420ms [^;]* 240ms backwards; \}/);
  assert.match(css, /\.lp-cta\[data-hero\] \{ animation-delay: 330ms; \}/);
  assert.match(css, /\.lp-scene__bubble \{ animation: lp-scene-bubble 260ms [^;]* 620ms backwards; \}/);
  assert.doesNotMatch(css, /infinite/);
  // The title (the largest paint) is never invisible: its rise is transform only.
  assert.match(css, /@keyframes lp-scene-rise \{ from \{ transform: translate3d\(0, 8px, 0\); \} \}/);
});

test('reduce motion (the system setting or the site switch) gets fades only', () => {
  const css = strip(CSS);
  assert.match(css, /@media \(max-width: 760px\) and \(prefers-reduced-motion: reduce\) \{[^}]*\{ animation: lp-scene-fade 240ms ease-out backwards; \}/);
  assert.match(css, /:root\[data-motion='reduced'\] \.lp-scene__bubble \{ animation: lp-scene-fade 240ms ease-out backwards; \}/);
});

test('one key: the second hero action is a quiet text link with a 44 px target and a visible focus ring', () => {
  const css = strip(CSS);
  assert.match(css, /\.lp \.lp-cta \.mm-actions > a:nth-child\(2\) \{\n\s+min-height: 44px;[\s\S]*?background: transparent;\n\s+box-shadow: none;/);
  assert.match(css, /\.lp \.lp-cta \.mm-actions > a:focus-visible \{ outline: 2px solid/);
});

test('the bubble copy is plain and warm', () => {
  const bubble = PAGE.match(/<p className="lp-scene__bubble">([^<]*)<\/p>/)[1];
  assert.doesNotMatch(bubble, /[!→←]|\p{Extended_Pictographic}|\b(lost|behind|last)\b/u);
});
