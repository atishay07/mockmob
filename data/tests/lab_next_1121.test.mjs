// node --test data/tests/lab_next_1121.test.mjs
// The Mistake Lab's "next" look (21 Nov 2026; owner: "the mistake lab approach was better ... You just had to redo the
// screens", and LK363: the product's real screens worked live by a cursor). LabCinema look="next" keeps the held story, its
// five scenes and their words, and draws each screen as the result page's own UI (LabNextScreens.jsx) inside a CursorDemo.
// These checks render the real LabCinema (swc, the page chrome stubbed) and hold:
//   - the default look (the live home) draws none of the next look's markup, and still draws its own five panels;
//   - the next look draws the cursor stage on every scene, with the result page's parts and labStory's figures;
//   - the next look's styles are scoped under [data-look='next'] and load only with it (a dynamic import).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { register, createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(resolve(root, rel), 'utf8').replace(/\r\n/g, '\n');
const load = (rel) => import(pathToFileURL(resolve(root, rel)).href);

const ROOT_URL = pathToFileURL(`${root}/`).href;
const reactUrl = pathToFileURL(createRequire(resolve(root, 'package.json')).resolve('react')).href;
// next/dynamic: the loader runs at once and the test waits for it (globalThis.__labDyn) before rendering, so the server render
// draws the loaded component as Next's own server render does.
const HOOKS = `
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
const ROOT = ${JSON.stringify(ROOT_URL)};
const REACT = ${JSON.stringify(reactUrl)};
const STUBS = {
  'next/link': "import React from '" + REACT + "'; export default function Link({ href, children, prefetch, ...rest }) { return React.createElement('a', { href, ...rest }, children); }",
  'next/dynamic': "import React from '" + REACT + "'; export default function dynamic(loader) { let C = null; (globalThis.__labDyn ||= []).push(loader().then((m) => { C = m.default; })); return function Dynamic(props) { return C ? React.createElement(C, props) : null; }; }",
  '@/components/brand/SubjectObject': 'export function SubjectObject() { return null; }',
  '@/components/doodle/Doodle': 'export default function Doodle({ children }) { return children; } export function Marked({ text }) { return text; }',
};
const ours = (url) => typeof url === 'string' && url.startsWith(ROOT) && !url.includes('/node_modules/');
const isFile = (url) => { try { return statSync(fileURLToPath(url)).isFile(); } catch { return false; } };
export async function resolve(specifier, context, next) {
  if (Object.hasOwn(STUBS, specifier) && ours(context.parentURL)) return { url: 'stub:' + specifier, shortCircuit: true };
  if (specifier.endsWith('.css')) return { url: 'stub:css', shortCircuit: true };
  if (ours(context.parentURL) && (specifier.startsWith('@/') || specifier.startsWith('./') || specifier.startsWith('../'))) {
    const base = specifier.startsWith('@/') ? new URL('src/' + specifier.slice(2), ROOT).href : new URL(specifier, context.parentURL).href;
    for (const ext of ['', '.js', '.jsx', '.mjs']) if (isFile(base + ext)) return { url: base + ext, shortCircuit: true };
  }
  return next(specifier, context);
}
let swc = null;
export async function load(url, context, next) {
  if (url === 'stub:css') return { format: 'module', source: 'export default null;', shortCircuit: true };
  if (url.startsWith('stub:')) return { format: 'module', source: STUBS[url.slice(5)], shortCircuit: true };
  if (url.endsWith('.jsx')) {
    if (!swc) { swc = createRequire(new URL('package.json', ROOT))('next/dist/build/swc'); await swc.loadBindings?.(); }
    const file = fileURLToPath(url);
    const out = await swc.transform(await readFile(file, 'utf8'), { filename: file, jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } }, target: 'es2022' }, module: { type: 'es6' } });
    return { format: 'module', source: out.code, shortCircuit: true };
  }
  return next(url, context);
}
`;
let cache = null;
async function lab() {
  if (cache) return cache;
  register(`data:text/javascript,${encodeURIComponent(HOOKS)}`);
  const [mod, React, server] = await Promise.all([load('src/components/landing/LabCinema.jsx'), import('react'), import('react-dom/server')]);
  await Promise.all(globalThis.__labDyn || []);
  const html = (props) => server.renderToStaticMarkup(React.createElement(mod.default, props));
  cache = { def: html({}), next: html({ look: 'next' }) };
  return cache;
}
const decode = (s) => s.replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
// Inline marks (a bold figure) join their sentence; every other tag is a break.
const textOf = (html) => decode(html.replace(/<\/?(b|strong)(?=[\s>])[^>]*>/g, '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const scenesOf = (html) => html.split('<article').slice(1);
const NEXT_ONLY = /data-look=|cd-stage|cd-cursor|class="lnx|td-long|td-changes|mr-start|sw-plan|class="ml"/;

const { labStory, REPAIR } = await load('src/components/landing/labStory.mjs');
const { LAB_SCENES } = await load('src/components/landing/homeCopy.mjs');
const S = labStory();

test('the default look (the live home) draws none of the next look, and still draws its own five panels', async () => {
  const { def } = await lab();
  assert.doesNotMatch(def, NEXT_ONLY);
  const scenes = scenesOf(def);
  assert.equal(scenes.length, 5);
  for (const [i, key] of ['chapters', 'time', 'changes', 'repair', 'swot'].entries()) assert.match(scenes[i], new RegExp(`class="lcp lcp--${key}"`), key);
  // Its words are the scenes' own; the next look's own words (LAB_SCENES `next`) never show on it.
  for (const scene of LAB_SCENES) {
    assert.ok(textOf(def).includes(decode(scene.body)), scene.key);
    if (scene.next) assert.ok(!textOf(def).includes(scene.next.body), `${scene.key}: next words stay off the default look`);
  }
});

test('the next look draws the cursor stage on every scene, each the result page\'s own part', async () => {
  const { next } = await lab();
  assert.match(next, /data-look="next"/);
  const scenes = scenesOf(next);
  assert.equal(scenes.length, 5);
  const parts = { chapters: /class="ml"/, time: /td-long__row/, changes: /td-changes__row/, repair: /mr-start|mr--done/, swot: /sw-plan__row/ };
  for (const [i, key] of ['chapters', 'time', 'changes', 'repair', 'swot'].entries()) {
    assert.match(scenes[i], /class="cd-stage lnx-stage"/, `${key}: the cursor stage`);
    assert.match(scenes[i], /class="cd-cursor"/, `${key}: the cursor`);
    assert.match(scenes[i], new RegExp(`class="lnx lnx--${key}`), `${key}: its screen`);
    assert.match(scenes[i], parts[key], `${key}: the result page's own part`);
    assert.doesNotMatch(scenes[i], /class="lcp /, `${key}: none of the default panels`);
  }
});

test('the next screens print labStory\'s figures in the result page\'s own sentences', async () => {
  const { next } = await lab();
  const text = textOf(next);
  const top = S.chapters[0];
  assert.ok(text.includes(`${top.chapter} cost ${top.lost} of the ${S.lostMarks} marks you missed.`));
  for (const l of S.longest.slice(0, 4)) assert.ok(text.includes(`Q${l.n}`) && text.includes(l.time), `time row Q${l.n}`);
  assert.ok(text.includes(`The paper gives ${S.pace} a question. Your median was ${S.median}.`));
  for (const c of S.changes) assert.ok(text.includes(`Picked ${c.from} at ${c.at}. Changed to ${c.to} at ${c.toAt}, ${c.gap} later.`), `change Q${c.n}`);
  assert.ok(text.includes(`Repair Q${REPAIR.n}`));
  assert.ok(text.includes(S.swot.plan[0].label));
  for (const q of S.swot.quadrants) assert.ok(text.includes(q.title), q.id);
  // Chapters: the habit proof, labStory's earlierLine, in the folded head of "Across your mocks" (no opening needed).
  const chapters = scenesOf(next)[0];
  assert.match(chapters, /class="am lnx-across"/);
  assert.ok(textOf(chapters).includes(`Across your mocks ${S.earlierLine}`));
  // Changes: the ledger's re-mark line in data/mistake_lab.copy.json's own words, filled from labStory (wide device only, in CSS).
  const COPY = JSON.parse(read('data/mistake_lab.copy.json'));
  const scores = COPY.remark.scores.replace(/\{first\}/, S.firstAnswers).replace(/\{final\}/, S.facts.marks).replace(/\{max\}/g, S.facts.outOf).replace('{held}', '');
  assert.equal(scores, 'First picks: 28 of 50. Final answers: 22 of 50.');
  assert.ok(textOf(scenesOf(next)[2]).includes(scores));
  // The critic's pass (21 Nov): Time labels its pace mark and keys its colours in the result page's words; Changes sums the
  // changes as the result page does (TIME_COPY.changesGained / changesCost) with the net; Repair prints the whole question; the
  // SWOT groups carry the result page's own heading.
  const scene = (i) => textOf(scenesOf(next)[i]);
  assert.ok(scene(1).includes(`Pace ${S.pace}`) && scene(1).includes('Right Wrong'));
  assert.equal(scenesOf(next)[1].match(/class="td-long__row"/g).length, 8, 'every answered question, slowest first');
  assert.ok(scene(2).includes(`+${S.gainedMarks}1 change gained ${S.gainedMarks} marks`), 'the gain and its line');
  assert.ok(scene(2).includes(`2 changes cost ${-S.lostToChanges} marks`) && scene(2).includes('Net effect on your marks'));
  assert.ok(scene(2).includes('= −6'));
  assert.ok(scene(3).includes(REPAIR.stem));
  assert.ok(scene(4).includes('Strengths, gaps and risks'));
  const sheet = read('src/components/landing/lab-next.css');
  assert.doesNotMatch(sheet, /rx-row__stem[^}]*(display: none|text-overflow|nowrap)/, 'the question is never cut or hidden');
  assert.match(sheet, /\.ml-chip \{ min-height: 44px; \}/);
  assert.match(sheet, /\.ml-seg \{ height: 44px;/);
  // 360 px phones: the content trims are for a short window only (360 x 740); a 360 x 800 phone keeps the part names, five time
  // rows and two changes; a change's picks stack with the arrow turned down on any 380 px phone.
  assert.match(sheet, /@media \(max-width: 380px\) and \(max-height: 760px\) \{[^@]*\.lnx-h \{ display: none; \}/);
  assert.match(sheet, /@media \(max-width: 380px\) and \(min-height: 761px\) \{[^@]*li:nth-child\(n \+ 6\)[^@]*li:nth-child\(n \+ 3\)/);
  assert.match(sheet, /\.lnx-picks__row \{ flex-direction: column;[^}]*\}\s*\.lc__grid\[data-look='next'\] \.lnx-picks__arrow \{ transform: rotate\(90deg\)/);
  const css = read('src/components/landing/lab-next.css');
  assert.match(css, /\.lnx-first \{ display: none; \}[\s\S]*@media \(min-width: 960px\) \{\s*\.lc__grid\[data-look='next'\] \.lnx-first \{\s*display: block;/, 'the re-mark line shows on the wide device only');
  // The Time scene's take names the slowest question, worked out from labStory.
  const time = LAB_SCENES.find((s) => s.key === 'time');
  assert.equal(time.next.take, `Your slowest, Q${S.longest[0].n}, took ${S.longest[0].time} and was still wrong.`);
  assert.ok(text.includes(time.next.body.replace(/’/g, '’')));
});

test('the next look loads only with it, and its styles are scoped to it', () => {
  const cinema = read('src/components/landing/LabCinema.jsx');
  assert.doesNotMatch(cinema, /^import .*LabNextScreens/m, 'never a static import: the default page carries none of it');
  assert.match(cinema, /dynamic\(\(\) => import\('\.\/LabNextScreens'\)\)/);
  assert.doesNotMatch(cinema, /^import .*lab-next\.css/m);
  const css = read('src/components/landing/lab-next.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const selectors = [...css.matchAll(/(^|})\s*([^@{}][^{}]*)\{/g)].map((m) => m[2].trim()).filter((s) => !/^(@|from|to|\d+%)/.test(s));
  assert.ok(selectors.length > 40);
  // Split a selector list on its top-level commas only (not those inside :is()).
  const parts = (sel) => { const out = ['']; let depth = 0; for (const ch of sel) { if (ch === '(') depth += 1; if (ch === ')') depth -= 1; if (ch === ',' && !depth) out.push(''); else out[out.length - 1] += ch; } return out; };
  for (const sel of selectors) for (const one of parts(sel)) assert.match(one, /\[data-look='next'\]/, `unscoped: ${one.trim()}`);
  // Speed rules (AGENT-COMMON, 20 Nov): no blur, no :has(), no layout read in the next screens.
  assert.doesNotMatch(css, /blur|backdrop-filter/);
  // :has() only on a screen's own small list (the 380 px trims), never on a large ancestor.
  const hasSubjects = [...css.matchAll(/([.\w-]+):has\(/g)].map((m) => m[1]);
  assert.ok(hasSubjects.length > 0);
  for (const subject of hasSubjects) assert.ok(['.ml-rows', '.td-changes', '.lnx--repair', '.lnx-quads'].includes(subject), `:has() on ${subject}`);
  const screens = read('src/components/landing/LabNextScreens.jsx');
  assert.doesNotMatch(screens, /getBoundingClientRect|offsetWidth|offsetHeight|getComputedStyle|requestAnimationFrame/);
});
