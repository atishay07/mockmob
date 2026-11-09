// Round 9 (owner, 9 Nov 2026): the walkthrough film and its chapter bar (HeroFilm.jsx, heroFilmConfig.mjs, hero-film.css).
// Round 7 (owner, 7 Nov 2026, after klayprep.com): "the promo video playing as the main hero, then a college logo section
// ('Get into the college you want' with college logos and a 'logos belong to their owners, not affiliated' line). Only CUET
// colleges." Source-level pins for the hero film (HeroFilm.jsx, hero-film.css), the college strip (CollegeStrip.jsx,
// college-strip.css) and the desk's move out of the hero into section#try.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
const stripCss = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const code = (src) => src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const FILM = read('src/components/landing/HeroFilm.jsx');
const FILM_CODE = code(FILM);
const FILM_CSS = stripCss(read('src/app/hero-film.css'));
const CONFIG = code(read('src/components/landing/heroFilmConfig.mjs'));
const STRIP = read('src/components/landing/CollegeStrip.jsx');
const STRIP_CSS = stripCss(read('src/app/college-strip.css'));
const SCENE_CSS = stripCss(read('src/app/hero-scene.css'));
const PAGE = code(read('src/app/page.js'));
const HERO = PAGE.slice(PAGE.indexOf('<section className="lp-hero">'), PAGE.indexOf('<CollegeStrip'));

test('the launch teaser\'s files stay in the repo until the walkthrough ships (round 9 replaces them with hero-v2)', () => {
  for (const f of ['public/video/hero-480.mp4', 'public/video/hero-720.mp4', 'public/video/hero-poster.webp']) {
    assert.ok(existsSync(join(ROOT, f)), f);
    assert.ok(statSync(join(ROOT, f)).size > 10_000, `${f} is a real file`);
  }
});

// Round 9 (owner, 9 Nov 2026: "the main walkthrough video of the platform ... highly converting"): the walkthrough film,
// three files picked by need, ten chapters under the frame, nothing on the picture.
const loadConfig = () => import(pathToFileURL(join(ROOT, 'src/components/landing/heroFilmConfig.mjs')).href);

test('round 9 film config: the walkthrough\'s label, poster and three files; nine chapters in the journey\'s order, starts rising from 0', async () => {
  const { FILM: CFG, FILM_CHAPTERS } = await loadConfig();
  assert.match(CFG.label, /^MockMob walkthrough, \d+ seconds$/);
  assert.equal(CFG.poster, '/video/hero-v3-poster.webp');
  assert.deepEqual({ ...CFG.sources }, { 480: '/video/hero-v3-480.mp4', 720: '/video/hero-v3-720.mp4', 1080: '/video/hero-v3-1080.mp4' });
  assert.equal(CFG.chapters, FILM_CHAPTERS);
  assert.deepEqual(FILM_CHAPTERS.map((c) => c.id), ['score', 'repair', 'learn', 'askmobi', 'keycards', 'mocks', 'exam', 'plan', 'mob', 'value']);
  assert.deepEqual(FILM_CHAPTERS.map((c) => c.name), ['Your score', 'Mistake Repair', 'Learn', 'Ask Mobi', 'Key cards', 'Mocks', 'Exam screen', 'Plan and colleges', 'The Mob', 'What you get']);
  assert.equal(FILM_CHAPTERS[0].start, 0, 'the first chapter starts the film');
  for (let i = 1; i < FILM_CHAPTERS.length; i += 1) assert.ok(FILM_CHAPTERS[i].start > FILM_CHAPTERS[i - 1].start, `${FILM_CHAPTERS[i].id} starts after ${FILM_CHAPTERS[i - 1].id}`);
  assert.ok(FILM_CHAPTERS.at(-1).start <= 101, 'inside the narrated film (101 s)');
  assert.ok(Object.isFrozen(CFG) && Object.isFrozen(FILM_CHAPTERS) && FILM_CHAPTERS.every(Object.isFrozen));
  // Chapter names and the label: no exclamation marks, middle dots or arrows.
  for (const w of [CFG.label, ...FILM_CHAPTERS.map((c) => c.name)]) assert.doesNotMatch(w, /!|·|→|->/, w);
  // HeroFilm.jsx takes the config from the module (no runtime fetch of chapters.json).
  assert.match(FILM_CODE, /import \{ FILM, chapterAt, pickSource \} from '\.\/heroFilmConfig\.mjs';/);
  assert.doesNotMatch(FILM_CODE, /fetch\(|chapters\.json/);
});

test('round 9 sources by need: the frame\'s rendered width x min(devicePixelRatio, 2); up to 640 -> 480p, up to 1100 -> 720p, else 1080p; Data Saver -> 480p', async () => {
  const { pickSource } = await loadConfig();
  const cases = [
    [335, 1, false, 480], [320, 2, false, 480], [350, 2, false, 720], [350, 3, false, 720], [589, 1, false, 480],
    [662, 1, false, 720], [880, 1, false, 720], [550, 2, false, 720], [551, 2, false, 1080], [662, 2, false, 1080],
    [880, 3, false, 1080], [1101, 1, false, 1080], [880, 2, true, 480], [0, 1, false, 480], [400, undefined, false, 480],
  ];
  for (const [w, dpr, save, res] of cases) assert.equal(pickSource(w, dpr, save), `/video/hero-v3-${res}.mp4`, `${w} css px at ${dpr}x${save ? ', Data Saver' : ''}`);
  // Picked once on mount from the frame's own width.
  assert.match(FILM_CODE, /video\.src = pickSource\(frame\.getBoundingClientRect\(\)\.width, window\.devicePixelRatio, navigator\.connection\?\.saveData === true\);/);
});

test('round 9 chapterAt: the chapter at a time and the share of it played', async () => {
  const { chapterAt } = await loadConfig();
  const ch = [{ start: 0 }, { start: 10 }, { start: 30 }];
  assert.deepEqual(chapterAt(0, 40, ch), { index: 0, share: 0 });
  assert.deepEqual(chapterAt(5, 40, ch), { index: 0, share: 0.5 });
  assert.deepEqual(chapterAt(10, 40, ch), { index: 1, share: 0 });
  assert.deepEqual(chapterAt(20, 40, ch), { index: 1, share: 0.5 });
  assert.deepEqual(chapterAt(35, 40, ch), { index: 2, share: 0.5 });
  assert.deepEqual(chapterAt(45, 40, ch), { index: 2, share: 1 }, 'never past full');
  assert.deepEqual(chapterAt(35, NaN, ch), { index: 2, share: 0 }, 'before the length is known');
  assert.deepEqual(chapterAt(-1, 40, ch), { index: 0, share: 0 });
});

test('HeroFilm: muted, inline, looped, nothing fetched before it plays, the poster first, no native controls', () => {
  assert.match(FILM, /^'use client';/);
  const video = FILM_CODE.slice(FILM_CODE.indexOf('<video'), FILM_CODE.indexOf('/>', FILM_CODE.indexOf('<video')));
  for (const attr of [/\bmuted\b/, /\bplaysInline\b/, /\bloop\b/, /preload="none"/, /poster=\{FILM\.poster\}/]) assert.match(video, attr);
  assert.doesNotMatch(video, /\bcontrols\b|\bautoPlay\b|\bsrc=/, 'no controls, no autoplay attribute, no src until mount');
  assert.match(FILM_CODE, /video\.muted = true;/, 'muted as a property too (React does not render the attribute)');
  // The poster: the same file as the video's poster, with its size, at high priority (the hero's largest paint on desktop).
  assert.match(FILM_CODE, /<img className="lp-film__poster" src=\{FILM\.poster\} width=\{FILM\.width\} height=\{FILM\.height\} alt="" fetchPriority="high"/);
  assert.match(FILM_CSS, /\.mm\.lp \.lp-film__frame \{[^}]*aspect-ratio: 16 \/ 9;/, 'a fixed 16:9 frame: no layout shift');
  assert.match(FILM_CODE, /export \{ FILM \};/, 'the config is still reachable from the component');
});

test('HeroFilm: plays only while half on screen, pauses when it leaves, never by itself under Reduce motion or Data Saver', () => {
  assert.match(CONFIG, /visibleShare: 0\.5/);
  assert.match(FILM_CODE, /new IntersectionObserver\(/);
  assert.match(FILM_CODE, /inView\.current = entry\.isIntersecting && entry\.intersectionRatio >= FILM\.visibleShare;/);
  assert.match(FILM_CODE, /io\.observe\(frame\);/, 'half of the picture itself');
  assert.match(FILM_CODE, /if \(inView\.current && !document\.hidden && wantPlay\.current && loaded\) start\(\);\s*else if \(!video\.paused && \(!inView\.current \|\| document\.hidden\)\) video\.pause\(\);/);
  // It first plays by itself only after the load event, so the film's file never competes with the first paint.
  assert.match(FILM_CODE, /let loaded = document\.readyState === 'complete';/);
  assert.match(FILM_CODE, /window\.addEventListener\('load', onLoad, \{ once: true \}\);/);
  const still = FILM_CODE.slice(FILM_CODE.indexOf('function stillOnly'), FILM_CODE.indexOf('function reducedMotion'));
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

test('round 9 nothing on the picture: a pointer tap on it pauses or plays; the keys sit in one row under the frame', () => {
  const frame = FILM_CODE.slice(FILM_CODE.indexOf('<div ref={frameRef}'), FILM_CODE.indexOf('<div className="lp-film__keys">'));
  assert.match(frame, /<div ref=\{frameRef\} className="lp-film__frame" onClick=\{togglePlay\}>/, 'a tap or click on the picture');
  assert.doesNotMatch(frame, /lp-film__key\b|lp-film__chapters|lp-film__now/, 'no key, bar or name over the picture');
  // The only thing ever on the poster is the round Play key when the film does not play by itself; it keeps its tap.
  assert.match(frame, /onClick=\{\(event\) => \{ event\.stopPropagation\(\); play\(\); \}\}/);
  // The row: play/pause, the chapter bar with the name, sound.
  const keys = FILM_CODE.slice(FILM_CODE.indexOf('<div className="lp-film__keys">'));
  const order = ["aria-label={playing ? 'Pause film' : 'Play film'}", '<div className="lp-film__track">', '<p className="lp-film__now">', 'role="toolbar" aria-label="Chapters"', "aria-label={soundOn ? 'Turn sound off' : 'Turn sound on'}"];
  let at = -1;
  for (const mark of order) { const i = keys.indexOf(mark); assert.ok(i > at, mark); at = i; }
  assert.match(FILM_CSS, /\.mm\.lp \.lp-film__keys \{[^}]*display: grid;[^}]*grid-template-columns: 44px minmax\(0, 1fr\) 44px;[^}]*margin-top: 12px;/, 'one row under the frame');
  assert.doesNotMatch(FILM_CSS, /\.lp-film__keys \{[^}]*position: absolute/, 'not over the picture any more');
  assert.match(FILM_CSS, /@media \(hover: hover\) and \(pointer: fine\) \{[^@]*\.mm\.lp \.lp-film__frame \{ cursor: pointer; \}/);
});

test('round 9 the chapter bar: ten segments that seek and play, named "Chapter 2 of 10: Mistake Repair", the current one marked and filling', () => {
  assert.match(FILM_CODE, /aria-label=\{`Chapter \$\{i \+ 1\} of \$\{COUNT\}: \$\{c\.name\}`\}/);
  assert.match(FILM_CODE, /aria-current=\{i === chapter \? 'true' : undefined\}/);
  assert.match(FILM_CODE, /data-state=\{i < chapter \? 'past' : i === chapter \? 'current' : 'next'\}/);
  assert.match(FILM_CODE, /onClick=\{\(\) => seek\(i\)\}/);
  // A segment goes to its chapter's first frame and plays; before the film's length is known the seek waits for it.
  const seek = FILM_CODE.slice(FILM_CODE.indexOf('const seek = (index) =>'), FILM_CODE.indexOf('const onBarKey'));
  assert.match(seek, /const at = FILM\.chapters\[index\]\.start;/);
  assert.match(seek, /if \(video\.readyState >= 1\) \{\s*pendingSeek\.current = null;\s*video\.currentTime = at;\s*\} else pendingSeek\.current = at;\s*play\(\);/);
  assert.match(FILM_CODE, /video\.addEventListener\('loadedmetadata', onMeta\);/);
  // The visible name of the current chapter, with its place for screen readers.
  assert.match(FILM_CODE, /<p className="lp-film__now"><span className="lp-sr">\{`Chapter \$\{chapter \+ 1\} of \$\{COUNT\}: `\}<\/span>\{current\.name\}<\/p>/);
  // One Tab stop: the current segment; arrows, Home and End move between them.
  assert.match(FILM_CODE, /tabIndex=\{i === chapter \? 0 : -1\}/);
  assert.match(FILM_CODE, /\{ ArrowRight: from \+ 1, ArrowLeft: from - 1, Home: 0, End: COUNT - 1 \}\[event\.key\]/);
  // Targets: 44 px tall, at least 24 px wide; the visible rail is 4 px; a ring on the rail for the keyboard.
  assert.match(FILM_CSS, /\.mm\.lp \.lp-film__seg \{[^}]*flex: 1 1 0;[^}]*min-width: 24px;[^}]*height: 44px;/);
  assert.match(FILM_CSS, /\.mm\.lp \.lp-film__rail \{[^}]*height: 4px;[^}]*background: var\(--line-strong\);/);
  assert.match(FILM_CSS, /\.mm\.lp \.lp-film__seg:focus-visible \.lp-film__rail \{ outline: 2px solid var\(--focus-ring, var\(--ink\)\); outline-offset: 3px; \}/);
  // The fill: past chapters full, the current one by --p, the next ones empty; ink on a hairline rail.
  assert.match(FILM_CSS, /\.mm\.lp \.lp-film__fill \{[^}]*background: var\(--ink\);[^}]*transform: scaleX\(0\);/);
  assert.match(FILM_CSS, /\[data-state='past'\] \.lp-film__fill \{ transform: scaleX\(1\); \}/);
  assert.match(FILM_CSS, /\[data-state='current'\] \.lp-film__fill \{ transform: scaleX\(var\(--p, 0\)\); \}/);
  assert.doesNotMatch(FILM_CSS, /\.lp-film__fill \{[^}]*transition/, 'the fill never animates by itself');
  // The name never pushes the row: one line, cut with an ellipsis, under the segments' taps.
  assert.match(FILM_CSS, /\.mm\.lp \.lp-film__now \{[^}]*overflow: hidden;[^}]*white-space: nowrap;[^}]*text-overflow: ellipsis;[^}]*pointer-events: none;/);
});

test('round 9 progress runs only while the film plays and is on screen; Reduce motion steps with the film\'s time; paused, nothing runs', () => {
  assert.match(FILM_CODE, /if \(!video\.paused && !video\.ended && inView\.current && !document\.hidden\) raf = requestAnimationFrame\(tick\);/);
  assert.match(FILM_CODE, /const run = \(\) => \{ if \(!raf && !reducedMotion\(\)\) raf = requestAnimationFrame\(tick\); \};/);
  assert.match(FILM_CODE, /video\.addEventListener\('playing', run\);/);
  assert.match(FILM_CODE, /video\.addEventListener\('pause', halt\);/);
  assert.match(FILM_CODE, /const onTime = \(\) => \{ if \(reducedMotion\(\)\) paint\(\); \};/);
  assert.match(FILM_CODE, /bar\.style\.setProperty\('--p', share\.toFixed\(4\)\);/, 'one custom property, no render per frame');
  assert.match(FILM_CODE, /if \(index !== chapterRef\.current\) \{\s*chapterRef\.current = index;\s*setChapter\(index\);/, 'a render only when the chapter changes');
  assert.doesNotMatch(FILM_CODE, /setInterval|setTimeout/, 'no timers');
  assert.match(FILM_CODE, /if \(raf\) cancelAnimationFrame\(raf\);/, 'cleaned up on unmount');
});

test('HeroFilm: two 44 px round keys, pause/play and sound, named, with a visible focus ring; sound is never on at the start', () => {
  assert.match(FILM_CODE, /aria-pressed=\{soundOn\} aria-label=\{soundOn \? 'Turn sound off' : 'Turn sound on'\}/);
  assert.match(FILM_CODE, /aria-label=\{playing \? 'Pause film' : 'Play film'\}/);
  assert.match(FILM_CODE, /import \{ Pause, Play, Volume2, VolumeX \} from 'lucide-react';/);
  assert.match(FILM_CODE, /const \[soundOn, setSoundOn\] = useState\(false\);/);
  // Turning sound on unmutes and plays; the first time, back to the start of the chapter on screen (the narrator's whole line).
  assert.match(FILM_CODE, /if \(video\.muted\) \{\s*video\.muted = false;\s*setSoundOn\(true\);\s*if \(!heardOnce\.current\) \{[\s\S]*?video\.currentTime = FILM\.chapters\[index\]\.start;[\s\S]*?if \(video\.paused\) play\(\);/);
  // Until sound has come on once, a "Sound on" key in the picture's corner (a pointer shortcut; it does not stop the tap reaching only itself).
  assert.match(FILM_CODE, /\{!heard && !needsTap \? \([\s\S]*?className="lp-film__unmute" onClick=\{\(event\) => \{ event\.stopPropagation\(\); toggleSound\(\); \}\}[\s\S]*?<span>Sound on<\/span>/);
  assert.match(FILM_CSS, /\.mm\.lp \.lp-film__unmute \{[^}]*height: 44px;/);
  assert.match(FILM_CSS, /\.mm\.lp \.lp-film__key,\n\.mm\.lp \.lp-film__start \{[^}]*width: 44px;[^}]*height: 44px;[^}]*border: 1px solid var\(--line-strong\);[^}]*border-radius: 50%;[^}]*background: var\(--paper\);/);
  assert.match(FILM_CSS, /\.mm\.lp \.lp-film__key:focus-visible \{ outline: 2px solid var\(--focus-ring, var\(--ink\)\); outline-offset: 2px; \}/);
  assert.match(FILM_CODE, /aria-label=\{FILM\.label\}/);
});

test('the film card: raised paper, a hairline, the large-card radius, a soft shadow; no glow, gradient or glass; tokens only', () => {
  assert.match(FILM_CSS, /\.mm\.lp \.lp-film__frame \{[^}]*border: 1px solid var\(--line\);[^}]*border-radius: 22px;[^}]*background: var\(--paper-raised\);[^}]*box-shadow: var\(--sh-2\);/);
  assert.match(FILM_CSS, /@media \(min-width: 960px\) \{[^@]*\.mm\.lp \.lp-film__frame \{ border-radius: 28px; \}/);
  for (const css of [FILM_CSS, STRIP_CSS]) {
    assert.doesNotMatch(css, /gradient|backdrop-filter|blur\(|#[0-9a-f]{3,8}\b|rgba?\(/i, 'tokens only: no raw colour, gradient, blur or glass');
  }
  // Reduce motion: the keys and the rails change at once.
  assert.match(FILM_CSS, /@media \(prefers-reduced-motion: reduce\) \{[^@]*transition: none;/);
  assert.match(FILM_CSS, /:root\[data-motion='reduced'\] \.mm\.lp :is\(\.lp-film__key, \.lp-film__start, \.lp-film__rail\) \{ transition: none; \}/);
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
  // Without JavaScript the keys would do nothing, so their row is not drawn.
  assert.match(read('src/app/page.js'), /\.lp-film__keys\{display:none\}/);
  // The guide Mobi never flies over the film: it waits while the hero is on screen.
  assert.match(read('src/components/brand/PipGuide.jsx'), /document\.querySelectorAll\('\.lp-mobi, \.lp-hero'\)\.forEach\(el=>heroWatch\.observe\(el\)\)/);
});

test('CollegeStrip: two marquees, universities on top from University of Delhi, the DU colleges under them from SRCC', () => {
  const universities = ['du', 'jnu', 'bhu', 'jamia', 'uoh', 'amu'];
  const colleges = ['srcc', 'ststephens', 'hindu', 'lsr', 'miranda', 'hansraj', 'kmc', 'ramjas'];
  const block = (name) => STRIP.slice(STRIP.indexOf(`export const ${name} = Object.freeze([`), STRIP.indexOf(']);', STRIP.indexOf(`export const ${name} = Object.freeze([`)));
  assert.deepEqual([...block('UNIVERSITIES').matchAll(/file: '([a-z]+)'/g)].map((m) => m[1]), universities, 'the universities, University of Delhi first');
  assert.deepEqual([...block('COLLEGES').matchAll(/file: '([a-z]+)'/g)].map((m) => m[1]), colleges, 'the colleges, SRCC first');
  for (const file of [...universities, ...colleges]) assert.ok(existsSync(join(ROOT, `public/art/colleges/${file}.webp`)), `${file}.webp`);
  for (const gone of ['pondicherry', 'allahabad']) {
    assert.doesNotMatch(STRIP, new RegExp(`file: '${gone}'`), `${gone} left out (owner: not aspirational)`);
    assert.ok(!existsSync(join(ROOT, `public/art/colleges/${gone}.webp`)), `${gone}.webp removed`);
  }
  assert.match(STRIP, /export const COLLEGE_HEAD = 'Get into the college you want\.';/);
  assert.match(STRIP, /export const COLLEGE_NOTE = 'College names and logos belong to their owners\. MockMob is not affiliated with them\.';/);
  assert.match(STRIP, /<h2 className="lp-colleges__title" id="colleges-title">\{COLLEGE_HEAD\}<\/h2>/);
  assert.match(STRIP, /<p className="lp-colleges__note">\{COLLEGE_NOTE\}<\/p>/);
  assert.match(STRIP, /<img className="lp-colleges__logo" src=\{collegeSrc\(college\.file\)\} width=\{college\.w\} height=\{college\.h\} alt="" loading="lazy"/);
  assert.match(STRIP, /aria-label=\{copy \? undefined : row\.label\} aria-hidden=\{copy \? 'true' : undefined\}/, 'only the first copy of each row is read out, named');
  assert.doesNotMatch(STRIP, /^'use client'/, 'a server component');
  assert.match(STRIP_CSS, /\.mm\.lp \.lp-colleges__chip \{[^}]*background: var\(--paper-raised\);/);
  assert.match(STRIP_CSS, /\.mm\.lp \.lp-colleges__name \{[^}]*font-family: var\(--font-display\);[^}]*font-weight: 650;/);
  assert.match(STRIP_CSS, /\.mm\.lp \.lp-colleges__note \{[^}]*color: var\(--ink-3\);/);
  assert.doesNotMatch(STRIP_CSS, /text-transform: uppercase/, 'no all-caps eyebrow');
  assert.match(STRIP_CSS, /animation: lp-colleges-roll var\(--roll\) linear infinite;/, 'linear marquees');
  assert.match(STRIP_CSS, /\.lp-colleges__marquee--colleges \.lp-colleges__track \{ animation-direction: reverse; \}/, 'the colleges move the other way');
  assert.match(STRIP_CSS, /\.mm\.lp \.lp-colleges__marquee \{ --roll: 22s; overflow: hidden; \}\s*\.mm\.lp \.lp-colleges__marquee--colleges \{ --roll: 37s; \}/, 'phones: quicker, the universities quickest');
  assert.match(STRIP_CSS, /:hover \.lp-colleges__track,\s*\.mm\.lp \.lp-colleges__rows:focus-within \.lp-colleges__track \{ animation-play-state: paused; \}/, 'paused on hover and focus');
  assert.match(STRIP_CSS, /@media \(prefers-reduced-motion: reduce\) \{[^@]*animation: none;/, 'still under reduced motion');
  assert.match(STRIP_CSS, /:root\[data-motion='reduced'\] \.mm\.lp \.lp-colleges__track \{ width: auto; animation: none; \}/);
  // Copy: sentence case, no exclamation marks, no middle dots (every quoted string in both components).
  const words = [...code(STRIP + FILM + CONFIG).matchAll(/'([A-Z][^'\n]*)'/g)].map((m) => m[1]);
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
