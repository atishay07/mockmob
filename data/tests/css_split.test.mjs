// App pages download no marketing CSS (speed.md item 8, LK28): the .mm surface system lives in src/app/marketing.css, and every
// file that draws it imports it, so a public page looks exactly as before and an app page skips about 60 KB of render-blocking CSS.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUNDLE, HOME_SHEETS, assertClosed, generate } from '../../src/lib/homeCss.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (rel) => readFileSync(join(root, rel), 'utf8');
const IMPORT = /import '@\/app\/marketing\.css';/;

function selectors(css) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = [];
  let buf = '';
  for (const ch of text) {
    if (ch === '{') { const s = buf.trim(); if (!s.startsWith('@') && !/^(from|to|\d+%)$/.test(s)) out.push(...s.split(/,(?![^(]*\))/).map((x) => x.trim())); buf = ''; }
    else if (ch === '}' || ch === ';') buf = '';
    else buf += ch;
  }
  return out;
}

function sourceFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...sourceFiles(p));
    else if (/\.(jsx?|mjs)$/.test(name) && !/\.test\./.test(name)) out.push(p);
  }
  return out;
}

const marketing = read('src/app/marketing.css');
const sels = selectors(marketing);
// Classes a rule can match without a .mm ancestor (the mm-* blocks, the lp backdrop): a file drawing one needs the sheet.
const free = new Set();
for (const s of sels) {
  const classes = [...s.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map((m) => m[1]);
  if (classes.includes('mm')) continue;
  // The outermost class is the one the drawing file must render (.mm-nav__end > .mm-theme-toggle needs the marketing nav).
  if (classes[0] && !['logo', 'dot', 'lp'].includes(classes[0])) free.add(classes[0]);
}

test('the marketing system left globals.css and the app shell never loads it', () => {
  const globals = read('src/app/globals.css');
  assert.ok(sels.length > 400, 'the whole .mm system moved');
  assert.match(marketing, /^\.mm \{/m);
  assert.doesNotMatch(globals, /^\.mm(\b|-)[^{]*\{/m, 'no .mm rule is left in the root stylesheet');
  assert.doesNotMatch(globals, /MARKETING SURFACE SYSTEM/);
  for (const rel of ['src/app/layout.js', 'src/app/(app)/layout.js', 'src/app/(app)/AppLayoutClient.jsx', 'src/components/ThemeToggle.jsx']) {
    assert.doesNotMatch(read(rel), /marketing\.css/, `${rel} must not pull the marketing sheet into every page`);
  }
  // brand.css's marketing logo sizes moved with it, after the system, as before.
  assert.doesNotMatch(read('src/app/brand.css'), /\.mm-(nav|foot) \.logo/);
  assert.ok(marketing.lastIndexOf('.mm-foot .logo .dot') > marketing.indexOf('.mm .logo {'));
});

test('every file that draws the .mm system imports marketing.css (home sections ride on the home page)', () => {
  const missing = [];
  for (const file of sourceFiles(join(root, 'src'))) {
    const rel = relative(root, file).split(sep).join('/');
    const text = readFileSync(file, 'utf8');
    const literals = [...text.matchAll(/(["`'])((?:(?!\1)[^\\\n]|\\.)*)\1/g)].map((m) => m[2]).join(' ');
    const tokens = new Set(literals.split(/[^\w-]+/));
    const drawsRoot = /className=\{?["'`]mm[ "'`]|class(Name)?="[^"]* mm[ "]/.test(text);
    const drawsBlock = [...tokens].some((t) => free.has(t));
    if (!drawsRoot && !drawsBlock) continue;
    // The home page's own sections (src/components/landing) are drawn only inside the home page, which imports the sheet first.
    if (rel.startsWith('src/components/landing/')) continue;
    if (!IMPORT.test(text)) missing.push(rel);
  }
  assert.deepEqual(missing, []);
  const home = read('src/app/page.js');
  assert.ok(IMPORT.test(home) && home.search(IMPORT) < home.indexOf("import './home-sheets.css'"), 'the home page loads the system before its own sheets');
  for (const file of sourceFiles(join(root, 'src'))) {
    const rel = relative(root, file).split(sep).join('/');
    if (rel.startsWith('src/components/landing/') || rel === 'src/app/page.js') continue;
    assert.doesNotMatch(readFileSync(file, 'utf8'), /from '@\/components\/landing\/(CloseActions|CreatorReels|DemoDrill|HeroBackdrop|HeroDockGate|LabCinema|LiveStatsBand)'/, `${rel} draws a home section without the sheet`);
  }
});

// Paint pass (15 Nov 2026): "/" loads its own 23 sheets as one joined file (src/app/home-sheets.css, src/lib/homeCss.mjs),
// so a phone makes one render-blocking request for them instead of seven (the chunkers never merge across a sheet another
// page shares). The joined file must equal the sheets, in the order production applied them, or the look would drift.
test('the home page imports its own sheets as one joined file that matches them, in the cascade order', () => {
  const home = read('src/app/page.js');
  const cssImports = [...home.matchAll(/^import '([^']+\.css)';/gm)].map((m) => m[1]);
  assert.deepEqual(cssImports, ['@/app/marketing.css', '@/components/brand/mobi-figure.css', './home-sheets.css'], 'no sheet of the list is also imported on its own');
  assert.equal(generate({ check: true }).stale, false, `${BUNDLE} is stale: run node scripts/gen-home-css.mjs`);
  assert.equal(HOME_SHEETS.length, 28); // 23 on 15 Nov 2026; round 16 added the tour's stack and the phone pass (16 Nov); round 18 the tour's deck (18 Nov); round 19 the sheets of lanes home-a and home-b (18 Nov)
  assert.equal(new Set(HOME_SHEETS).size, HOME_SHEETS.length, 'each sheet once');
  const joined = read(BUNDLE).replace(/\r\n/g, '\n');
  assert.match(joined, /^\/\* GENERATED by scripts\/gen-home-css\.mjs/);
  let at = 0;
  for (const rel of HOME_SHEETS) {
    const banner = `/* ==== ${rel} ==== */\n`;
    const i = joined.indexOf(banner, at);
    assert.ok(i >= at, `${rel} is in the joined file, after the sheet before it`);
    const body = read(rel).replace(/\r\n/g, '\n').replace(/\n+$/, '');
    assert.equal(joined.slice(i + banner.length, i + banner.length + body.length), body, `${rel} is copied byte for byte`);
    at = i + banner.length + body.length;
  }
  // The order is the cascade production served (15 Nov 2026): the three sheets /daily shares sit together after home.css,
  // and every later round's sheet comes after the round before it.
  const name = (rel) => rel.replace('src/app/', '').replace('.css', '');
  assert.deepEqual(HOME_SHEETS.map(name), ['landing', 'home-refinements', 'mistake-lab', 'compass-ladder', 'social-proof', 'hero-depth',
    'feature-tour', 'tour-screens', 'lab-cinema', 'home', 'hero-scene', 'r10-sample', 'r13-motion', 'desktop-scale', 'home-sections',
    'hero-film', 'college-strip', 'r10-hero', 'r10-lab-tour', 'r10-tools', 'r10-close', 'r14-look', 'r14-companion', 'r16-tour-stack', 'r16-phone', 'r18-tour-deck', 'r19-home-a', 'r19-home-b']);
  // A sheet that would leak into the next one once joined is refused.
  assert.throws(() => assertClosed('.a { color: red; ', 'x'), /left open/);
  assert.throws(() => assertClosed('.a { color: red; } /* note', 'x'), /comment is never closed/);
  assert.throws(() => assertClosed('.a { content: "x; }', 'x'), /string is never closed/);
  assert.throws(() => assertClosed('.a { } }', 'x'), /closes nothing/);
  assert.throws(() => assertClosed("@import './b.css';", 'x'), /@import/);
  assert.throws(() => assertClosed(".a { background: url('../img/x.png'); }", 'x'), /relative/);
  assert.doesNotThrow(() => assertClosed('.a { background: url(/img/x.png); mask: url("#m"); }', 'x'));
  assert.doesNotThrow(() => assertClosed(".a::after { content: '}'; } /* { */ .b { background: url('data:x;y') }", 'x'));
  // The dev server keeps it current; builds only read it.
  assert.match(read('next.config.mjs').replace(/\r\n/g, '\n'), /if \(process\.env\.NODE_ENV === 'development'\) \{\n\s*const \{ watchHomeCss \} = await import\('\.\/src\/lib\/homeCss\.mjs'\);/);
});

// 19 Nov 2026 (owner LK326, "the screen stutters in the first five"): two things that made the browser or React redo the WHOLE
// page for one small change. Both were measured on the live home page (tmp/1119-phone/task.mjs and style.mjs).
function cssFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) cssFiles(full, out);
    else if (name.endsWith('.css')) out.push(full);
  }
  return out;
}

test('no rule puts a bare * on the left of a sibling combinator (it restyles a whole subtree on every insert)', () => {
  // `> * + *` and `* ~ .x` go into the browser's one page-wide sibling set: any element added or removed under a parent then
  // restyles that parent's whole subtree, so one script appended to <body> restyled the entire home page. Write
  // `> :where(:not(:first-child))` (same elements, same specificity).
  const bare = /(?:^|[\s>,(])\*\s*[+~]/;
  const found = [];
  for (const file of cssFiles(join(root, 'src'))) {
    for (const sel of selectors(readFileSync(file, 'utf8'))) if (bare.test(sel)) found.push(`${relative(root, file).split(sep).join('/')}: ${sel}`);
  }
  assert.deepEqual(found, []);
});

test('the session context value never changes: the state is read from a store', () => {
  // The provider wraps every page. While user and status sat in its context value, their first change after a page loaded
  // made React hydrate every not-yet-hydrated part of the page in one blocking task (about 0.6 s on a mid-range phone).
  const provider = read('src/components/AuthProvider.jsx');
  const value = provider.slice(provider.indexOf('const value = useMemo('), provider.indexOf('return <AuthContext.Provider value={value}>'));
  assert.ok(value.length > 0);
  assert.doesNotMatch(value, /\buser\b|\bstatus\b|needsOnboarding|isAuthenticated/, 'no state in the context value');
  assert.match(value, /\(\) => \(\{\s+store,\s+actions: \{/);
  assert.match(provider, /const \{ user, status \} = useSyncExternalStore\(store\.subscribe, store\.get, firstState\);/);
  assert.doesNotMatch(provider, /useState\('loading'\)|setStatus\(|setUser\(/);
  // Readers go through the hooks; nothing reads the bare context for state. (A reader that did would see no user and no
  // status, silently.) Only the provider itself and the development previews, which hand in a plain value, name the context.
  const direct = [];
  for (const file of scripts(join(root, 'src'))) {
    const rel = relative(root, file).split(sep).join('/');
    if (rel === 'src/components/AuthProvider.jsx' || rel.startsWith('src/app/preview/')) continue;
    if (/\bAuthContext\b/.test(readFileSync(file, 'utf8'))) direct.push(rel);
  }
  assert.deepEqual(direct, []);
  assert.match(read('src/app/error.js'), /const auth = useAuthMaybe\(\);/);
});

function scripts(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) scripts(full, out);
    else if (/\.(jsx?|mjs|tsx?)$/.test(name) && !/\.test\./.test(name)) out.push(full);
  }
  return out;
}

test('the desktop pointer layer is for a hovering fine pointer only, costs nothing at rest and leaves no style behind (LK333)', () => {
  const jsx = read('src/components/landing/DesktopCursor.jsx');
  const css = read('src/app/r19-home-b.css');
  // Who gets it: a mouse on a device that hovers, with motion allowed (the device's setting and the student's switch), on a
  // machine that can spare the frames (LK353: none of it on a weak one).
  assert.match(jsx, /const QUERY = '\(hover: hover\) and \(pointer: fine\)';/);
  assert.match(jsx, /fine\.matches && !calm\.matches && document\.documentElement\.getAttribute\('data-motion'\) !== 'reduced'/);
  assert.match(jsx, /if \(event\.pointerType !== 'mouse' \|\| !allowed\(\)\) \{ hide\(\); return; \}/);
  assert.match(jsx, /if \(document\.documentElement\.hasAttribute\('data-lite'\)\) return undefined;/);
  assert.match(css, /@media not \(\(hover: hover\) and \(pointer: fine\)\) \{ \.lp-cursor, \.lp-torch \{ display: none; \} \}/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{ \.lp-cursor, \.lp-torch \{ display: none; \} \}/);
  assert.match(css, /html\[data-lite\] :is\(\.lp-torch, \.lp-cursor\) \{ display: none; \}/);
  // Cost: passive listeners and one frame loop that stops.
  for (const name of ['pointermove', 'pointerdown', 'scroll']) assert.ok(jsx.split(`window.addEventListener('${name}', `)[1]?.split('\n')[0].includes('{ passive: true }'), name);
  assert.match(jsx, /if \(moving\) frame = window\.requestAnimationFrame\(step\);/, 'the loop stops when everything has arrived');
  // However many move events a fast mouse sends, the arrow is looked at once a frame, and what is under it is worked out only
  // when it crosses onto a different element.
  assert.match(jsx, /pending = event\.target instanceof Element \? event\.target : null; asked = true;/);
  assert.match(jsx, /if \(asked\) \{ asked = false; aim\(pending, now\); \}/);
  assert.match(jsx, /if \(el !== under \|\| !seen\) \{ under = el; seen = classify\(el\); \}/);
  // Layout is read only as a thing is taken (a leaning key, a tilting picture, a snapped key) or after the page has scrolled;
  // the frame loop never reads the scroll position, a box or a computed style.
  assert.equal((jsx.match(/getBoundingClientRect\(\)/g) || []).length, 3);
  const loop = jsx.slice(jsx.indexOf('const step = (now) => {'), jsx.indexOf('const run = () =>'));
  assert.doesNotMatch(loop, /scrollY|getComputedStyle|offsetWidth|offsetHeight|elementFromPoint/, 'nothing is read from the page per frame');
  assert.doesNotMatch(jsx, /setInterval|getComputedStyle|offsetWidth|offsetHeight|scrollHeight/);
  // Hit tests: one after a scroll has settled under a resting arrow, and the reach-ahead (ONE point a short way ahead of a
  // travelling arrow, at most about sixteen a second: it was four points on every frame).
  assert.match(jsx, /reaim = window\.setTimeout\(\(\) => \{ if \(shown\) \{ asked = false; aim\(document\.elementFromPoint\(tx, ty\), performance\.now\(\)\); run\(\); \} \}, 140\);/);
  assert.equal((jsx.match(/elementFromPoint/g) || []).length, 2);
  assert.match(jsx, /export const PROBE_EVERY_MS = 60;/);
  assert.match(jsx, /if \(now - probedAt < PROBE_EVERY_MS \|\| dx \* dx \+ dy \* dy < PROBE_TRAVEL \* PROBE_TRAVEL\) return near;/);
  // The snap (LK339, LK352): the KEY takes the ring and draws its own edge; no box is floated over it. A text link is not a
  // key. A scroll lets the key go at once. A keyboard focus ring is never replaced.
  assert.match(jsx, /const SNAP = '\.mm-btn, button, \[role="button"\], summary, \[data-snap-key\]';/);
  assert.match(jsx, /export const SNAP_MAX = Object\.freeze\(\{ width: 460, height: 110 \}\);/);
  assert.match(jsx, /key\.setAttribute\('data-snap', 'in'\);/);
  assert.match(jsx, /if \(snap && snap\.el === key\) key\.setAttribute\('data-snap', 'on'\);/);
  assert.match(jsx, /if \(snap\) \{ snap\.el\.removeAttribute\('data-snap'\); snap = null; \}/);
  assert.match(jsx, /dropSnap\(\); px = -99;/);
  assert.match(jsx, /if \(el\.getClientRects\(\)\.length !== 1\) return null;/, 'a line that wraps is not a key');
  assert.doesNotMatch(jsx + css, /lp-snap\b/, 'no separate box over the key');
  assert.match(css, /body \.mm\.lp \[data-snap='on'\]:not\(:focus-visible\) \{ outline-color: color-mix\(in srgb, currentColor 58%, transparent\); outline-offset: 2px;/);
  assert.match(css, /\.lp-cursor\[data-on='snap'\] \.lp-cursor__ring \{ transform: scale\(0\.3\); opacity: 0; \}/);
  // Night's light is smaller and fainter than Day's (owner LK338: "a bit too large and excessive in dark mode").
  assert.match(css, /html:not\(\[data-theme='light'\]\) \.lp-torch \{ width: 420px; height: 420px; margin: -210px 0 0 -210px; background: radial-gradient\(closest-side, rgb\(210 240 0 \/ 0\.055\)/);
  // Bounded: a key leans a few pixels, a picture turns a few degrees.
  assert.match(jsx, /export const TILT_MAX = 4\.5;/);
  assert.match(jsx, /export const LEAN_MAX = 7;/);
  // It lets go: what the arrow leaves returns to rest and loses our inline style; unmounting clears the rest.
  assert.match(jsx, /hold\.el\.style\.translate = ''; leaving\.delete\(hold\);/);
  assert.match(jsx, /hold\.el\.style\.removeProperty\('--tilt-x'\); hold\.el\.style\.removeProperty\('--tilt-y'\); leaving\.delete\(hold\);/);
  // The tilt's angles belong to the one element (not inherited), and the tilt applies to a fine pointer only.
  assert.match(css, /@property --tilt-x \{ syntax: '<angle>'; inherits: false; initial-value: 0deg; \}/);
  assert.match(css, /@media \(hover: hover\) and \(pointer: fine\) \{\s*\.mm\.lp \[data-tilt\] \{ transform: perspective\(1100px\) rotateX\(var\(--tilt-x\)\) rotateY\(var\(--tilt-y\)\); \}/);
});

test('desktop scroll depth runs from the scroll position itself, for a fine pointer on a wide window only (LK333)', () => {
  const css = read('src/app/r19-home-b.css');
  const at = css.indexOf('animation: lp-depth linear both; animation-timeline: view(); animation-range: cover 0% cover 100%;');
  assert.ok(at > 0);
  const before = css.slice(0, at);
  assert.ok(before.lastIndexOf('@media (min-width: 960px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)') > before.lastIndexOf('@keyframes'), 'inside the desktop, fine pointer, motion-allowed query');
  assert.match(css, /@keyframes lp-depth \{ from \{ translate: 0 40px; \} to \{ translate: 0 -40px; \} \}/, 'translate only: no layout, no clash with a transform');
});

test('a marked word in the statement keeps its comma, and desktop marks clear the words beside them (LK335)', () => {
  assert.match(read('src/components/landing/Statement.jsx'), /<span className="lp-statement__nb"><Doodle /);
  assert.match(read('src/app/hero-depth.css'), /\.lp-statement__nb \{ white-space: nowrap; \}/);
  assert.match(read('src/components/doodle/doodle.css'), /@media \(min-width: 960px\) \{ \.dd--circle \{ margin-inline: 0\.16em; \} \}/);
  assert.match(read('src/components/doodle/doodle.css'), /\n\.dd--circle \{ margin-inline: 0\.13em; \}/, 'and on a phone');
  assert.match(read('src/components/doodle/doodlePaths.mjs'), /const x0 = -fs \* 0\.08; const x1 = w \+ fs \* 0\.1;/);
});
