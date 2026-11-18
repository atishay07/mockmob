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
