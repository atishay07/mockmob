// App pages download no marketing CSS (speed.md item 8, LK28): the .mm surface system lives in src/app/marketing.css, and every
// file that draws it imports it, so a public page looks exactly as before and an app page skips about 60 KB of render-blocking CSS.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

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
  assert.ok(IMPORT.test(home) && home.search(IMPORT) < home.indexOf("import './landing.css'"), 'the home page loads the system before its own sheets');
  for (const file of sourceFiles(join(root, 'src'))) {
    const rel = relative(root, file).split(sep).join('/');
    if (rel.startsWith('src/components/landing/') || rel === 'src/app/page.js') continue;
    assert.doesNotMatch(readFileSync(file, 'utf8'), /from '@\/components\/landing\/(CloseActions|CreatorReels|DemoDrill|HeroBackdrop|HeroDockGate|LabCinema|LiveStatsBand)'/, `${rel} draws a home section without the sheet`);
  }
});
