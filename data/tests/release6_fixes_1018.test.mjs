// Release 6 verifier fixes (docs/brain: the independent verifier's report on the 18 Oct web release 6). Source-level checks
// that run without a browser; the browser walk of the same fixes is in tmp/fix-r6 (headless, Night and Day).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
// The text of every at-rule block that opens with `head` (brace-matched), so a rule can be asked "which block holds you".
function blocks(css, head) {
  const out = [];
  let from = 0;
  for (;;) {
    const at = css.indexOf(head, from);
    if (at < 0) return out;
    let depth = 0;
    let i = css.indexOf('{', at);
    const start = i;
    for (; i < css.length; i += 1) {
      if (css[i] === '{') depth += 1;
      else if (css[i] === '}') { depth -= 1; if (depth === 0) break; }
    }
    out.push(css.slice(start + 1, i));
    from = i;
  }
}

test('the docked Ask Mobi panel cannot squeeze the analysis: the side-by-side layout is a container query on the section, not the window', () => {
  const css = stripComments(read('src/components/result/result-parts.css'));
  assert.match(css, /\.ap\s*\{[^}]*container:\s*ap\s*\/\s*inline-size/, '.ap is the container');
  const inContainer = blocks(css, '@container ap (min-width: 880px)').join('\n');
  for (const piece of ['.ap-grid { display: grid', '.ap-indexwrap { position: sticky', '.ap-detail { margin-top: 0', '.ap .ap-all { display: none']) {
    assert.ok(inContainer.includes(piece), `${piece} sits in the container query`);
  }
  for (const media of blocks(css, '@media (min-width: 1024px)')) {
    assert.ok(!/\.ap-grid|\.ap-indexwrap|\.ap-detail|\.ap-all/.test(media), 'no window-width rule decides the analysis columns');
  }
  // The index (360) and the gap (44) leave the detail 476 px or more at the threshold.
  assert.ok(360 + 44 + 476 <= 880);
});

test('the docked panel cannot squeeze Review: its two columns are a container query on the page, not the window', () => {
  const css = stripComments(read('src/components/review/review-1018.css'));
  assert.match(css, /\.app-shell \.rvw\s*\{[^}]*container:\s*rvw\s*\/\s*inline-size/, '.rvw is the container');
  const inContainer = blocks(css, '@container rvw (min-width: 720px)').join('\n');
  for (const piece of ['.rv8-board { display: grid', '.rv8-board > .rv8-side { display: block', 'position: sticky']) {
    assert.ok(inContainer.includes(piece), `${piece} sits in the container query`);
  }
  for (const media of blocks(css, '@media (min-width: 1024px)')) {
    assert.ok(!/rv8-board|rv8-side/.test(media), 'no window-width rule decides the Review columns');
  }
});

test('the analysis scroll helper asks the layout, not the window, whether the detail sits beside the index', () => {
  const code = read('src/components/result/AnalysisParts.jsx');
  assert.ok(!/matchMedia\('\(min-width: 1024px\)'\)/.test(code), 'no 1024 px window query left in the part scroll');
  assert.match(code, /getComputedStyle\(g\)\.display === 'grid'/);
});

test('a URL that matches no route gets the themed not-found page, never the default white 404', () => {
  const root = read('src/app/not-found.js');
  assert.match(root, /export default function NotFound\(\)/);
  assert.match(root, /SiteNotFound/);
  const page = read('src/components/SiteNotFound.jsx');
  // The arena's own tokens (Night by default, Day when chosen) come from the shell scope and its two sheets.
  assert.match(page, /className="view app-shell snf"/);
  assert.match(page, /@\/app\/\(app\)\/arena\.css/);
  assert.match(page, /@\/app\/\(app\)\/student-pages\.css/);
  // The AppNotFound look: the same headline, an ArenaHead, the same primary action class.
  const inApp = read('src/app/(app)/not-found.js');
  const headline = inApp.match(/title="([^"]+)"/)[1];
  assert.ok(page.includes(`title="${headline}"`), 'the same headline as the signed-in not-found');
  assert.match(page, /<ArenaHead/);
  assert.match(page, /ui-state__action ui-state__action--primary/);
  // A way home that works for a signed-in student and for a visitor: "/" (the front page sends a student on to Today).
  assert.match(page, /<Link href="\/"/);
  assert.match(page, /<Logo \/>/);
  // It never blanks the page white: the ground is the arena's.
  const css = read('src/components/site-not-found.css');
  assert.match(css, /min-height:\s*100dvh/);
  assert.ok(!/background:\s*#fff|background:\s*white/i.test(css));
});
