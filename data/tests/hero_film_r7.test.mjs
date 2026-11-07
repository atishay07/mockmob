// Round 7 (owner, 7 Nov 2026, after klayprep.com): "the promo video playing as the main hero, then a college logo section
// ('Get into the college you want' with college logos and a 'logos belong to their owners, not affiliated' line). Only CUET
// colleges." Source-level pins for the hero film (HeroFilm.jsx, hero-film.css), the college strip (CollegeStrip.jsx,
// college-strip.css) and the desk's move out of the hero into section#try.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
const stripCss = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const code = (src) => src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const FILM = read('src/components/landing/HeroFilm.jsx');
const FILM_CODE = code(FILM);
const FILM_CSS = stripCss(read('src/app/hero-film.css'));
const STRIP = read('src/components/landing/CollegeStrip.jsx');
const STRIP_CSS = stripCss(read('src/app/college-strip.css'));
const SCENE_CSS = stripCss(read('src/app/hero-scene.css'));
const PAGE = code(read('src/app/page.js'));
const HERO = PAGE.slice(PAGE.indexOf('<section className="lp-hero">'), PAGE.indexOf('<CollegeStrip'));

test('the film files are in the repo: 480p and 720p H.264 files and the 1280 x 720 poster', () => {
  for (const f of ['public/video/hero-480.mp4', 'public/video/hero-720.mp4', 'public/video/hero-poster.webp']) {
    assert.ok(existsSync(join(ROOT, f)), f);
    assert.ok(statSync(join(ROOT, f)).size > 10_000, `${f} is a real file`);
  }
});

test('HeroFilm: muted, inline, looped, nothing fetched before it plays, the poster first, no native controls', () => {
  assert.match(FILM, /^'use client';/);
  const video = FILM_CODE.slice(FILM_CODE.indexOf('<video'), FILM_CODE.indexOf('/>', FILM_CODE.indexOf('<video')));
  for (const attr of [/\bmuted\b/, /\bplaysInline\b/, /\bloop\b/, /preload="none"/, /poster=\{FILM\.poster\}/]) assert.match(video, attr);
  assert.doesNotMatch(video, /\bcontrols\b|\bautoPlay\b|\bsrc=/, 'no controls, no autoplay attribute, no src until mount');
  assert.match(FILM_CODE, /video\.muted = true;/, 'muted as a property too (React does not render the attribute)');
  // The file is picked on mount by the window's width.
  assert.match(FILM_CODE, /video\.src = window\.innerWidth < FILM\.smallBelow \? FILM\.small : FILM\.large;/);
  assert.match(FILM, /small: '\/video\/hero-480\.mp4'/);
  assert.match(FILM, /large: '\/video\/hero-720\.mp4'/);
  assert.match(FILM, /smallBelow: 768/);
  // The poster: the same file as the video's poster, with its size, at high priority (the hero's largest paint on desktop).
  assert.match(FILM_CODE, /<img className="lp-film__poster" src=\{FILM\.poster\} width=\{FILM\.width\} height=\{FILM\.height\} alt="" fetchPriority="high"/);
  assert.match(FILM, /poster: '\/video\/hero-poster\.webp'/);
  assert.match(FILM_CSS, /\.mm\.lp \.lp-film__frame \{[^}]*aspect-ratio: 16 \/ 9;/, 'a fixed 16:9 frame: no layout shift');
});

test('HeroFilm: plays only while half on screen, pauses when it leaves, never by itself under Reduce motion or Data Saver', () => {
  assert.match(FILM, /visibleShare: 0\.5/);
  assert.match(FILM_CODE, /new IntersectionObserver\(/);
  assert.match(FILM_CODE, /inView\.current = entry\.isIntersecting && entry\.intersectionRatio >= FILM\.visibleShare;/);
  assert.match(FILM_CODE, /if \(inView\.current && !document\.hidden && wantPlay\.current && loaded\) start\(\);\s*else if \(!video\.paused && \(!inView\.current \|\| document\.hidden\)\) video\.pause\(\);/);
  // It first plays by itself only after the load event, so the film's file never competes with the first paint.
  assert.match(FILM_CODE, /let loaded = document\.readyState === 'complete';/);
  assert.match(FILM_CODE, /window\.addEventListener\('load', onLoad, \{ once: true \}\);/);
  const still = FILM_CODE.slice(FILM_CODE.indexOf('function stillOnly'), FILM_CODE.indexOf('export default function HeroFilm'));
  assert.match(still, /getAttribute\('data-motion'\) === 'reduced'/, 'the site\'s own Reduce motion switch');
  assert.match(still, /navigator\.connection\?\.saveData === true/, 'Data Saver');
  assert.match(still, /matchMedia\('\(prefers-reduced-motion: reduce\)'\)\.matches/, 'the system\'s Reduce motion');
  assert.match(FILM_CODE, /let autoOff = stillOnly\(\);\s*wantPlay\.current = !autoOff;/, 'autoplay only when none of them is on');
  assert.match(FILM_CODE, /if \(autoOff && video\.paused\) setNeedsTap\(true\);/);
  // Then a 56 px round Play key sits on the poster.
  assert.match(FILM_CODE, /\{needsTap && !playing \? \(/);
  assert.match(FILM_CSS, /\.mm\.lp \.lp-film__start \{[^}]*width: 56px;[^}]*height: 56px;/);
  assert.match(FILM_CSS, /\.mm\.lp \.lp-film__start \{[^}]*top: 50%;[^}]*left: 50%;/);
});

test('HeroFilm: two 44 px round corner keys, sound and pause/play, named, with a visible focus ring; sound is never on at the start', () => {
  assert.match(FILM_CODE, /aria-pressed=\{soundOn\} aria-label=\{soundOn \? 'Turn sound off' : 'Turn sound on'\}/);
  assert.match(FILM_CODE, /aria-label=\{playing \? 'Pause film' : 'Play film'\}/);
  assert.match(FILM_CODE, /import \{ Pause, Play, Volume2, VolumeX \} from 'lucide-react';/);
  assert.match(FILM_CODE, /const \[soundOn, setSoundOn\] = useState\(false\);/);
  // Turning sound on unmutes and plays.
  assert.match(FILM_CODE, /if \(video\.muted\) \{\s*video\.muted = false;\s*setSoundOn\(true\);\s*if \(video\.paused\) play\(\);/);
  assert.match(FILM_CSS, /\.mm\.lp \.lp-film__key,\n\.mm\.lp \.lp-film__start \{[^}]*width: 44px;[^}]*height: 44px;[^}]*border: 1px solid var\(--line-strong\);[^}]*border-radius: 50%;[^}]*background: var\(--paper\);/);
  assert.match(FILM_CSS, /\.mm\.lp \.lp-film__key:focus-visible \{ outline: 2px solid var\(--focus-ring, var\(--ink\)\); outline-offset: 2px; \}/);
  assert.match(FILM_CSS, /\.mm\.lp \.lp-film__keys \{ position: absolute; z-index: 3; top: 12px; right: 12px;/);
  assert.match(FILM_CODE, /aria-label=\{FILM\.label\}/);
  assert.match(FILM, /label: 'MockMob launch film, 78 seconds'/);
});

test('the film card: raised paper, a hairline, the large-card radius, a soft shadow; no glow, gradient or glass; tokens only', () => {
  assert.match(FILM_CSS, /\.mm\.lp \.lp-film__frame \{[^}]*border: 1px solid var\(--line\);[^}]*border-radius: 22px;[^}]*background: var\(--paper-raised\);[^}]*box-shadow: var\(--sh-2\);/);
  assert.match(FILM_CSS, /@media \(min-width: 960px\) \{[^@]*\.mm\.lp \.lp-film__frame \{ border-radius: 28px; \}/);
  for (const css of [FILM_CSS, STRIP_CSS]) {
    assert.doesNotMatch(css, /gradient|backdrop-filter|blur\(|#[0-9a-f]{3,8}\b|rgba?\(/i, 'tokens only: no raw colour, gradient, blur or glass');
  }
  // Reduce motion: the keys change at once.
  assert.match(FILM_CSS, /@media \(prefers-reduced-motion: reduce\) \{[^@]*transition: none;/);
  assert.match(FILM_CSS, /:root\[data-motion='reduced'\] \.mm\.lp :is\(\.lp-film__key, \.lp-film__start\) \{ transition: none; \}/);
});

test('the hero: the film in the desk\'s old place, the words first; phones: words, film, strip, links; desktop: the film on the right', () => {
  assert.match(HERO, /<HeroFilm \/>/);
  assert.doesNotMatch(HERO, /lp-desk|try-practice|<DemoDrill|<HeroRoom|<HeroMobi/, 'the desk is not in the hero any more');
  const order = ['<h1 className="lp-title">', '<p className="lp-lead">', '<div className="lp-cta">', '<HeroFilm />', '<HeroBeatStrip ', '<div className="lp-hero__links">'];
  let at = -1;
  for (const mark of order) { const i = HERO.indexOf(mark); assert.ok(i > at, mark); at = i; }
  assert.match(SCENE_CSS, /grid-template-areas: 'copy' 'film' 'strip' 'links';/);
  assert.match(SCENE_CSS, /grid-template-areas: 'copy film' 'strip strip' 'links links';/);
  assert.match(SCENE_CSS, /--film-w: clamp\(480px, 46vw, 880px\);/, 'large: 46 % of the window on desktop');
  assert.match(FILM_CSS, /\.mm\.lp \.lp-hero \.lp-film \{ margin: 0; align-self: center; \}/);
  // Without JavaScript the keys would do nothing, so they are not drawn.
  assert.match(read('src/app/page.js'), /\.lp-film__keys\{display:none\}/);
  // The guide Mobi never flies over the film: it waits while the hero is on screen.
  assert.match(read('src/components/brand/PipGuide.jsx'), /document\.querySelectorAll\('\.lp-mobi, \.lp-hero'\)\.forEach\(el=>heroWatch\.observe\(el\)\)/);
});

test('CollegeStrip: sixteen CUET colleges with their emblems, as a marquee, with the heading and the not-affiliated line', () => {
  const files = ['du', 'srcc', 'ststephens', 'hindu', 'lsr', 'miranda', 'hansraj', 'kmc', 'ramjas', 'jnu', 'bhu', 'jamia', 'amu', 'uoh', 'allahabad', 'pondicherry'];
  for (const file of files) {
    assert.match(STRIP, new RegExp(`file: '${file}', w: \\d+, h: 192 \\}`), file);
    assert.ok(existsSync(join(ROOT, `public/art/colleges/${file}.webp`)), `${file}.webp`);
  }
  assert.equal((STRIP.match(/\{ name: /g) || []).length, files.length, 'only these');
  assert.match(STRIP, /export const COLLEGE_HEAD = 'Get into the college you want\.';/);
  assert.match(STRIP, /export const COLLEGE_NOTE = 'College names and logos belong to their owners\. MockMob is not affiliated with them\.';/);
  assert.match(STRIP, /<h2 className="lp-colleges__title" id="colleges-title">\{COLLEGE_HEAD\}<\/h2>/);
  assert.match(STRIP, /<p className="lp-colleges__note">\{COLLEGE_NOTE\}<\/p>/);
  assert.match(STRIP, /<img className="lp-colleges__logo" src=\{collegeSrc\(college\.file\)\} width=\{college\.w\} height=\{college\.h\} alt="" loading="lazy"/);
  assert.match(STRIP, /aria-hidden=\{copy \? 'true' : undefined\}/, 'the second copy is hidden from screen readers');
  assert.doesNotMatch(STRIP, /^'use client'/, 'a server component');
  assert.match(STRIP_CSS, /\.mm\.lp \.lp-colleges__chip \{[^}]*background: var\(--paper-raised\);/);
  assert.match(STRIP_CSS, /\.mm\.lp \.lp-colleges__name \{[^}]*font-family: var\(--font-display\);[^}]*font-weight: 650;/);
  assert.match(STRIP_CSS, /\.mm\.lp \.lp-colleges__note \{[^}]*color: var\(--ink-3\);/);
  assert.doesNotMatch(STRIP_CSS, /text-transform: uppercase/, 'no all-caps eyebrow');
  assert.match(STRIP_CSS, /animation: lp-colleges-roll 70s linear infinite;/, 'a slow linear marquee');
  assert.match(STRIP_CSS, /:hover \.lp-colleges__track,\s*\.mm\.lp \.lp-colleges__marquee:focus-within \.lp-colleges__track \{ animation-play-state: paused; \}/, 'paused on hover and focus');
  assert.match(STRIP_CSS, /@media \(prefers-reduced-motion: reduce\) \{[^@]*animation: none;/, 'still under reduced motion');
  assert.match(STRIP_CSS, /:root\[data-motion='reduced'\] \.mm\.lp \.lp-colleges__track \{ width: auto; animation: none; \}/);
  // Copy: sentence case, no exclamation marks, no middle dots (every quoted string in both components).
  const words = [...code(STRIP + FILM).matchAll(/'([A-Z][^'\n]*)'/g)].map((m) => m[1]);
  assert.ok(words.length >= 8, 'the copy was found');
  for (const w of words) assert.doesNotMatch(w, /!|·/, w);
});

test('the desk keeps id="try-practice" and sits in section#try, right after the college strip and before the statement', () => {
  const afterHero = PAGE.slice(PAGE.indexOf('</section>', PAGE.indexOf('<section className="lp-hero">')));
  const strip = afterHero.indexOf('<CollegeStrip />');
  const section = afterHero.indexOf('<section className="lp-sec lp-try" id="try" aria-labelledby="try-title">');
  const desk = afterHero.indexOf('<div className="lp-desk" id="try-practice">');
  const statement = afterHero.indexOf('<Statement ');
  assert.ok(strip > 0 && strip < section && section < desk && desk < statement, 'hero, college strip, section#try with the desk, statement');
  assert.equal((PAGE.match(/id="try-practice"/g) || []).length, 1);
  const tryBlock = afterHero.slice(section, statement);
  assert.match(tryBlock, /<h2 className="lp-h2" id="try-title">\{TRY_HEAD\.h2\}<\/h2>\s*<p className="lp-sub">\{TRY_HEAD\.sub\}<\/p>/);
  assert.match(tryBlock, /<div className="lp-desk__stage">\s*<HeroRoom \/>\s*<HeroMobi poster=\{<MobiPoster id="desk" \/>\} \/>\s*<\/div>\s*<div className="lp-desk__card">\s*<DemoDrill note=\{DESK_NOTE\} \/>/);
  assert.match(read('src/components/landing/homeCopy.mjs'), /export const TRY_HEAD = Object\.freeze\(\{ h2: 'Try five CUET questions\.', sub: 'Free, no sign-up\. Every answer shows its reason\.' \}\);/);
  // It is always drawn (every "Try 5 questions first" jump measures its card) and centred at 560 px on desktop.
  assert.match(SCENE_CSS, /\.lp main > #try \{ content-visibility: visible; \}/);
  assert.match(SCENE_CSS, /\.mm\.lp \.lp-try \.lp-desk \{ max-width: 560px; margin: 0 auto; \}/);
});
