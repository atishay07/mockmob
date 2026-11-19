// The home page looks the same whichever order the bundler loads its stylesheets in (paint pass, 15 Nov 2026).
// A home-sheet rule that ties a component sheet's rule (same specificity and importance, a property in common, an element of
// "/" both can style) wins only by loading later, and the joined home sheet does not always load later (webpack served
// scroll-story.css, section-position.css and du.css after it: the tour's hold, the Lab cinema's hold, the DU teaser card and
// the position bar changed). Every such home rule now carries a body ancestor (one type more); this test keeps new ties out.
// How it works and why: src/lib/cssCascade.mjs. The page's element tree: data/tests/fixtures/home-elements.json
// (scripts/capture-home-elements.mjs refreshes them after the page gains or loses sections).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve as resolvePath, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HOME_SHEETS, BUNDLE } from '../../src/lib/homeCss.mjs';
import { elementTree, entries, importedSheets, readRules, specificity, splitList, ties } from '../../src/lib/cssCascade.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (abs) => readFileSync(abs, 'utf8');
const rel = (abs) => relative(root, abs).split(sep).join('/');

function resolveImport(spec, from) {
  let base;
  if (spec.startsWith('@/')) base = join(root, 'src', spec.slice(2));
  else if (spec.startsWith('.')) base = resolvePath(dirname(from), spec);
  else return null; // packages: tailwind sits in its own @layer and loses to every unlayered rule; katex is not on "/"
  const candidates = [base, ...['.js', '.jsx', '.mjs', '.ts', '.tsx'].map((x) => base + x), ...['index.js', 'index.jsx', 'index.mjs'].map((x) => join(base, x))];
  return candidates.find((c) => existsSync(c) && statSync(c).isFile()) ?? null;
}

function componentSheets() {
  const sheets = importedSheets([join(root, 'src/app/layout.js'), join(root, 'src/app/page.js')], { read, resolve: resolveImport });
  // A sheet's own @import (globals.css pulls in motion-kit.css) loads with it.
  const out = [];
  const add = (abs) => {
    if (out.includes(abs)) return;
    out.push(abs);
    for (const m of read(abs).matchAll(/@import\s+["'](\.[^"']+\.css)["']/g)) add(resolvePath(dirname(abs), m[1]));
  };
  sheets.forEach(add);
  const home = new Set([...HOME_SHEETS, BUNDLE]);
  return out.map(rel).filter((f) => !home.has(f));
}

test('specificity follows Selectors 4', () => {
  assert.deepEqual(specificity('.ft-story'), [0, 1, 0]);
  assert.deepEqual(specificity('body .ft-story'), [0, 1, 1]);
  assert.deepEqual(specificity('html:has(.lp)'), [0, 1, 1]);
  assert.deepEqual(specificity('.mm :where(a, button):focus-visible'), [0, 2, 0]);
  assert.deepEqual(specificity(".mm .lp :is(#pricing, .x) .y::before"), [1, 3, 1]);
  assert.deepEqual(specificity('.a:not(.b, #c) li:nth-child(2 of .d)'), [1, 3, 1]);
  assert.deepEqual(splitList('.a, :is(.b, .c) .d, [data-x="1,2"]'), ['.a', ':is(.b, .c) .d', '[data-x="1,2"]']);
});

test('the reader keeps each rule with its at-rules and skips keyframes', () => {
  const rules = readRules('/* x { } */ .a { color: red; --v: calc(1px + 2px) }\n@media (min-width: 700px) { .b, .c { margin: 0 !important; } }\n@keyframes k { from { opacity: 0 } }');
  assert.equal(rules.length, 2);
  assert.deepEqual(rules[0].decls, [{ prop: 'color', value: 'red', important: false }, { prop: '--v', value: 'calc(1px + 2px)', important: false }]);
  assert.deepEqual(rules[1].conds, ['@media (min-width: 700px)']);
  assert.equal(rules[1].selector, '.b, .c');
  assert.equal(rules[1].decls[0].important, true);
});

test('a tie is found where two classes share one element, and a body ancestor settles it', () => {
  const nodes = elementTree([['main', '', 'lp mm', -1, ''], ['div', '', 'ft-story ss', 0, 'data-pinned'], ['div', '', 'x', 0, 'data-on'], ['section', '', 'du', -1, ''], ['div', '', 'x', 3, '']]);
  const components = entries([{ file: 'scroll-story.css', css: '.ss { --ss-beat: 72svh; }' }]);
  const found = ties({ home: entries([{ file: 'feature-tour.css', css: '.ft-story { --ss-beat: 58svh; }' }]), components, nodes });
  assert.equal(found.length, 1);
  assert.deepEqual(found[0].props, ['--ss-beat']);
  assert.equal(ties({ home: entries([{ file: 'feature-tour.css', css: 'body .ft-story { --ss-beat: 58svh; }' }]), components, nodes }).length, 0);
  // Shorthands meet their longhands; rules that never share an element do not tie.
  const tie = (h, c) => ties({ home: entries([{ file: 'h.css', css: h }]), components: entries([{ file: 'c.css', css: c }]), nodes }).length;
  assert.equal(tie('.lp .x { gap: 6px }', '.mm .x { column-gap: 8px }'), 1);
  assert.equal(tie('.lp > .x { gap: 6px }', '.du .x { gap: 8px }'), 0, 'the .x under .lp is not the .x under .du');
  assert.equal(tie('.lp .x:hover { color: red }', '.mm .x[data-on] { color: blue }'), 1, 'states count as met');
  assert.equal(tie('.lp .x::before { color: red }', '.mm .x[data-on] { color: blue }'), 0, 'a pseudo-element is another box');
  assert.equal(tie('.ft-story ~ .x { color: red }', '.mm .x { color: blue }'), 1, 'siblings: any child of the same parent');
  assert.equal(tie('.du .x { color: red }', '.mm .x[data-on] { color: blue }'), 0, 'the .x under .du never carries data-on');
  assert.equal(tie(':where(.lp) .x { color: red }', ':where(.mm:not(.lp)) .x { color: blue }'), 0, ':not of plain classes is read');
});

test('"/" loads the component sheets the cascade check reads', () => {
  const sheets = componentSheets();
  for (const f of ['src/app/globals.css', 'src/app/motion-kit.css', 'src/app/marketing.css', 'src/app/scroll-story.css', 'src/app/section-position.css']) {
    assert.ok(sheets.includes(f), `${f} is one of the sheets "/" loads`);
  }
  // Owner LK323 (18 Nov 2026): "Which DU courses are open to you?" left the home page, and the calculator's sheet with it.
  assert.ok(!sheets.includes('src/components/du/du.css'), 'the DU calculator is not drawn on "/" any more, so its sheet is not loaded there');
  for (const f of HOME_SHEETS) assert.ok(!sheets.includes(f), `${f} is a home sheet, not a component sheet`);
});

// Ties left as they are, because a third rule decides the property on every element where they meet, whichever loads last,
// and no raise fits between: one type more would also tie that third rule and change the page.
const SETTLED_ELSEWHERE = new Map([
  // marketing-theme.css: `html[data-theme] .mm .mm-btn--secondary` (0,3,1) sets the key's box-shadow on every page (the root
  // layout always renders html with data-theme), so neither hover rule's box-shadow is ever used.
  ['src/app/landing.css .lp .mm-btn--secondary:hover  ties  src/app/nav-motion.css .mm-nav .mm-nav__cta:hover', 'box-shadow'],
]);

test('no home rule ties a component rule on the same element and property', () => {
  const nodes = elementTree(JSON.parse(readFileSync(join(root, 'data/tests/fixtures/home-elements.json'), 'utf8')));
  assert.ok(nodes.length > 1000, 'the fixture holds the rendered page');
  const home = entries(HOME_SHEETS.map((file) => ({ file, css: read(join(root, file)) })));
  const components = entries(componentSheets().map((file) => ({ file, css: read(join(root, file)) })));
  const found = ties({ home, components, nodes })
    .map((t) => ({ ...t, key: `${t.home.replace(/:\d+ /, ' ')}  ties  ${t.component.replace(/:\d+ /, ' ')}` }));
  const open = found.filter((t) => SETTLED_ELSEWHERE.get(t.key) !== t.props.join(', '));
  assert.deepEqual(
    open.map((t) => `${t.home}  ties  ${t.component}  (${t.spec}; ${t.props.join(', ')})`),
    [],
    'Each of these home rules wins only by loading after the component sheet, which no bundler promises. Raise it by one type with a body ancestor (`body .x`), as the others are, and check "/" against live.',
  );
  for (const key of SETTLED_ELSEWHERE.keys()) assert.ok(found.some((t) => t.key === key), `${key} no longer ties: drop it from SETTLED_ELSEWHERE`);
});
