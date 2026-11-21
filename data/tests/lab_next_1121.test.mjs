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
// next/dynamic: the loader runs at once and the test waits for it (globalThis.__labDyn), and for the module's own server import
// (LabNextGate's SERVER_READY), before rendering, so the server render draws the loaded component as Next's own server render does.
const HOOKS = `
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
const ROOT = ${JSON.stringify(ROOT_URL)};
const REACT = ${JSON.stringify(reactUrl)};
const STUBS = {
  'next/link': "import React from '" + REACT + "'; export default function Link({ href, children, prefetch, ...rest }) { return React.createElement('a', { href, ...rest }, children); }",
  'next/dynamic': "import React from '" + REACT + "'; export default function dynamic(loader) { let C = null; (globalThis.__labDyn ||= []).push(loader().then(async (m) => { await m.SERVER_READY; C = m.default; })); return function Dynamic(props) { return C ? React.createElement(C, props) : null; }; }",
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
  assert.match(sheet, /\.ml-chip \{ min-height: 44px;/);
  assert.match(sheet, /\.ml-seg \{ height: 44px;/);
  // 360 px phones: the content trims are for a short window only (360 x 740); a 360 x 800 phone keeps the part names, five time
  // rows and two changes; a change's picks stack with the arrow turned down on any 380 px phone.
  assert.match(sheet, /@media \(max-width: 380px\) and \(max-height: 760px\) \{[^@]*\.lnx-h \{ display: none; \}/);
  assert.match(sheet, /@media \(max-width: 380px\) and \(min-height: 761px\) \{[^@]*li:nth-child\(n \+ 6\)/);
  // The repair's row keeps "D yours / B answer" beside the written repair at every size (360 x 676 included): no rule hides them.
  assert.doesNotMatch(sheet, /rx-row__facts[^{]*\{[^}]*display: none/);
  assert.match(sheet, /\.lnx-picks__row \{ flex-direction: column;[^}]*\}[^@]*\.lnx-picks__arrow \{ transform: rotate\(90deg\)/);
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
  assert.match(cinema, /dynamic\(\(\) => import\('\.\/LabNextGate'\)\)/);
  // 21 Nov 2026 (load weight): the gate keeps the server's drawing and loads the screens' code only as the Lab nears the window.
  const gate = read('src/components/landing/LabNextGate.jsx');
  assert.doesNotMatch(gate, /^import .*LabNextScreens/m, 'the gate never imports the screens statically');
  assert.match(gate, /export const SERVER_READY = typeof window === 'undefined' \? import\('\.\/LabNextScreens'\)/);
  assert.match(gate, /export const LAB_NEAR = '150% 0px 150% 0px';/);
  assert.match(gate, /^import '\.\/lab-next\.css';$/m, 'the next look sheet comes with the gate, so the drawn screens are styled');
  assert.doesNotMatch(cinema, /^import .*lab-next\.css/m);
  const css = read('src/components/landing/lab-next.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const selectors = [...css.matchAll(/(^|})\s*([^@{}][^{}]*)\{/g)].map((m) => m[2].trim()).filter((s) => !/^(@|from|to|\d+%)/.test(s));
  assert.ok(selectors.length > 40);
  // Split a selector list on its top-level commas only (not those inside :is()).
  const parts = (sel) => { const out = ['']; let depth = 0; for (const ch of sel) { if (ch === '(') depth += 1; if (ch === ')') depth -= 1; if (ch === ',' && !depth) out.push(''); else out[out.length - 1] += ch; } return out; };
  for (const sel of selectors) for (const one of parts(sel)) assert.match(one, /\[data-look='next'\]/, `unscoped: ${one.trim()}`);
  // Speed rules (AGENT-COMMON, 20 Nov): no blur, no :has(), no layout read in the next screens.
  assert.doesNotMatch(css, /blur|backdrop-filter/);
  // :has(), if any, only on a screen's own small list, never on a large ancestor.
  const hasSubjects = [...css.matchAll(/([.\w-]+):has\(/g)].map((m) => m[1]);
  for (const subject of hasSubjects) assert.ok(['.ml-rows', '.td-changes', '.lnx--repair', '.lnx-quads'].includes(subject), `:has() on ${subject}`);
  const screens = read('src/components/landing/LabNextScreens.jsx');
  assert.doesNotMatch(screens, /getBoundingClientRect|offsetWidth|offsetHeight|getComputedStyle/);
  // One bounded frame loop only: the Changes totals' count-up, 420 ms, once as the scene comes on.
  assert.equal((screens.match(/requestAnimationFrame\(tick\)/g) || []).length, 2);
  assert.match(screens, /const t = Math\.min\(1, \(now - start\) \/ 420\);/);
});

// LK364 (21 Nov 2026): the next look plays itself, its taps show their answer in a slot that holds its room, and on a phone the
// words above the device are the title and one short line.
// LK365 (21 Nov 2026, evening): the next scene comes as soon as a scene's script ends; not touching means playing (the autoplay
// pauses only while the reader acts); the scenes are cards that stack.
test('the next look plays itself, pausing only while the reader acts, and only the next look does', () => {
  const cinema = read('src/components/landing/LabCinema.jsx');
  assert.match(cinema, /useLabAutoplay\(\{ enabled: next && pinned && !reduced, live, step, steps: SCENES\.length, goTo, where, arriving \}\)/);
  assert.match(cinema, /onDone=\{\(\) => auto\.done\(i\)\} onTakeover=\{\(\) => auto\.take\(i\)\}/);
  assert.match(cinema, /if \(next\) auto\.pick\(\); goTo\(i, \{ instant: event\.detail === 0 \}\)/);
  const hook = read('src/components/landing/useLabAutoplay.js');
  assert.doesNotMatch(hook, /HOLD_MS/, 'no held moment: the next scene comes as the script ends');
  assert.match(hook, /export const QUIET_MS = 2000;/, 'still and untouched for 2 s, it carries on');
  assert.match(hook, /export const TAP_QUIET_MS = 4000;/, 'a tap inside a screen: it carries on 4 s after the last tap');
  assert.match(hook, /if \(!event\.isTrusted\) return;/);
  assert.match(hook, /\['touchstart', 'touchmove', 'touchend', 'touchcancel'\]/);
  assert.match(hook, /\['wheel', 'keydown', 'pointerdown'\]/);
  assert.match(hook, /if \(fingers\.current > 0\) return;/, 'never while a finger is down');
  assert.match(hook, /window\.addEventListener\('scroll', onScroll, \{ passive: true \}\)/, 'never within 2 s of the reader\'s last scroll');
  assert.match(hook, /if \(place === 'out'\) return;/, 'never pulls a reader who has scrolled out back in');
  assert.match(hook, /document\.hidden/);
  assert.match(hook, /i >= steps - 1\) return;/, 'the last scene rests');
  assert.doesNotMatch(hook, /scrollTo|scrollBy|requestAnimationFrame|getBoundingClientRect|setInterval/, 'it moves only through the story\'s own goTo, with one timer');
  assert.doesNotMatch(read('src/components/landing/ScrollStory.jsx'), /autoplay|useLabAutoplay/i, 'ScrollStory is unchanged for every story');
  // The script's own last step hands over (LabNextScreens), not CursorDemo's onDone 260 ms after the cursor has faded.
  const screens = read('src/components/landing/LabNextScreens.jsx');
  assert.match(screens, /\[\.\.\.SCRIPTS\[scene\], \{ run: \(stage\) => \{ keepPoint\(stage\); doneRef\.current\?\.\(\); \} \}\]/);
  const scripts = screens.slice(screens.indexOf('const SCRIPTS'), screens.indexOf('const SCREENS'));
  // Critic round, 21 Nov 2026 evening: the hand-off comes about 300 ms after the last tap's answer has come in (its rise: 260 ms,
  // a change's final pick 460 ms, the repair's rule 670 ms), not a second of dwell after it. The last scene rests, no hand-off.
  const RISE = { chapters: 260, time: 260, changes: 460, repair: 670 };
  for (const key of ['chapters', 'time', 'changes', 'repair', 'swot']) {
    const body = scripts.slice(scripts.indexOf(`${key}:`), scripts.indexOf(']),', scripts.indexOf(`${key}:`)));
    const lastStep = body.trim().split('\n').filter((line) => line.trim().startsWith('{')).at(-1);
    assert.match(lastStep, /click: true/, `${key}: the script ends on its last tap, no move after it`);
    const last = Number(lastStep.match(/dwell: (\d+) \}/)?.[1]);
    if (RISE[key]) assert.ok(last - RISE[key] >= 200 && last - RISE[key] <= 400, `${key}: hands over about 300 ms after its last answer is in (${last})`);
    // The next scene's cursor waits for its card to stand, shows where the last one stopped, and goes straight to its control.
    assert.match(body, /Object\.freeze\(\[\s*ARRIVE,\s*\{ run: arrive \},(?:\s*\/\/[^\n]*)*\s*\{ target: [^}]*move: 380, click: true/, `${key}: arrives in place`);
  }
});

// Critic round, 21 Nov 2026 evening: a card lands in its start state and plays its reveal once, never finished-then-replayed.
test('an arriving card carries its start state and plays its reveal once it stands; tabs change with the card', () => {
  const screens = read('src/components/landing/LabNextScreens.jsx');
  // The scene's state comes from the story's own data-step attribute (written at once), not from React's lagging step.
  assert.match(screens, /new MutationObserver\(read\);\s*watch\.observe\(root, \{ attributes: true, attributeFilter: \['data-step'\] \}\)/);
  // A screen is drawn afresh after its scene has left (RESET_MS), never as it arrives (only a reader's quick way back does).
  assert.match(screens, /if \(playing \|\| !mount\.used\) return undefined;/);
  assert.match(screens, /const RESET_MS = 480;/);
  assert.doesNotMatch(screens, /if \(live\) setEntries/);
  // The counts wait at 0 until the scene is on, then count once the card stands.
  assert.match(screens, /if \(!on\) \{ write\(0\); return undefined; \}/);
  assert.match(screens, /export const LNX_IN_MS = 420;/);
  const css = read('src/components/landing/lab-next.css');
  assert.match(css, /\.lc-scene \.lnx :is\(\.td-long__fill, \.ml-seg, \.ml-share i\) \{ animation-play-state: paused; \}/);
  for (let s = 0; s < 5; s += 1) assert.ok(css.includes(`[data-step='${s}'] .lc__grid[data-look='next'] .lc-scene[data-ss-step='${s}']${s === 0 ? "[data-armed='true']" : ''} .lnx :is(.td-long__fill, .ml-seg, .ml-share i)`), `step ${s} runs its reveal`);
  assert.match(css, /--lnx-in: 420ms;/);
  // The rail's tab and the device's tab are written from the same attribute, in the same frame as the card.
  const cinema = read('src/components/landing/LabCinema.jsx');
  assert.match(cinema, /button\.dataset\.on = on \? 'true' : 'false';/);
  assert.match(cinema, /watch\.observe\(root, \{ attributes: true, attributeFilter: \['data-step'\] \}\)/);
  // A wheel that carries the arrival one scene on is taken back to the first scene once it rests.
  const hook = read('src/components/landing/useLabAutoplay.js');
  assert.match(hook, /const ENTRY_MS = 1600;/);
  assert.match(hook, /if \(step === 1 && e && e\.fromAbove && !e\.used/);
});

test('the scenes are cards that stack, keyed to the story\'s own step, transform and opacity only', () => {
  const css = read('src/components/landing/lab-next.css');
  const block = css.slice(css.indexOf('The scenes are cards that stack'), css.indexOf("Every screen: its part's name"));
  // Every pair of story step and scene: on show, one card down, two down, deeper (hidden); the rest wait below.
  for (let s = 0; s < 5; s += 1) assert.ok(block.includes(`[data-step='${s}'] .lc__grid[data-look='next'] .lc-scene[data-ss-step='${s}'] .lc-scene__screen`), `step ${s} on show`);
  for (let i = 0; i < 4; i += 1) assert.ok(block.includes(`[data-step='${i + 1}'] .lc__grid[data-look='next'] .lc-scene[data-ss-step='${i}'] .lc-scene__screen`), `scene ${i} one down`);
  assert.match(block, /translate3d\(0, calc\(var\(--lnx-peek\) \* -1\), 0\) scale\(0\.96\)/, 'the card underneath settles back');
  assert.match(block, /translate3d\(0, calc\(var\(--lnx-peek\) \* -2\), 0\) scale\(0\.92\)/, 'a second edge');
  assert.match(block, /--lnx-peek: 12px;/, 'two edges of 12 px on a phone');
  assert.match(block, /\.lc-scene__mini \{ display: block; \}/, 'each card carries its own header');
  assert.match(block, /translate3d\(0, calc\(100% \+ 32px\), 0\)/, 'the next card waits below and rises');
  assert.match(block, /transition: transform 420ms var\(--lnx-ease\), opacity 200ms linear;/);
  assert.match(block, /\.lc-scene \{ overflow: clip; \}/, 'a card waiting below is out of sight');
  const transitions = [...block.matchAll(/transition:([^;]+);/g)].map((m) => m[1]);
  for (const t of transitions) for (const prop of t.split(',').map((p) => p.trim().split(/\s+/)[0])) assert.ok(['transform', 'opacity'].includes(prop), `transition on ${prop}`);
  assert.match(block, /\[data-reduced='true'\][^{]*\.lc-scene__screen \{ opacity: 0; \}/, 'reduced motion: only the scene on show');
  // Later scenes lie on top.
  for (let i = 0; i < 5; i += 1) assert.ok(block.includes(`.lc-scene[data-ss-step='${i}'] { z-index: ${i + 1}; }`));
});

test('a tap shows its answer in a slot that holds its room; each scene has two taps; phones get one short line', async () => {
  const { next } = await lab();
  const scenes = scenesOf(next);
  for (const i of [0, 1, 2, 4]) assert.match(scenes[i], /class="lnx-slot[ "]/, `scene ${i}: the slot`);
  assert.ok(textOf(scenes[0]).includes('Q4: wrong after 3:18. You changed B to D.'));
  const screens = read('src/components/landing/LabNextScreens.jsx');
  const scripts = screens.slice(screens.indexOf('const SCRIPTS'), screens.indexOf('const SCREENS'));
  for (const key of ['chapters', 'time', 'changes', 'swot']) {
    const body = scripts.slice(scripts.indexOf(`${key}:`), scripts.indexOf(']),', scripts.indexOf(`${key}:`)));
    assert.equal((body.match(/click: true/g) || []).length, 2, `${key}: two taps`);
  }
  for (const scene of LAB_SCENES) {
    assert.ok(scene.next?.short, `${scene.key}: a short line for phones`);
    assert.ok(scene.next.short.length <= 52, `${scene.key}: one short line`);
  }
  const sheet = read('src/components/landing/lab-next.css');
  assert.match(sheet, /\.lnx-slot__item \{ grid-area: 1 \/ 1;[^}]*visibility: hidden; \}/);
  assert.match(sheet, /\.lc\[data-pinned='true'\] \.lc__grid\[data-look='next'\] \{ padding-inline: 11px;/, 'the device takes 94 % of a phone');
  // Text in the screens is 13 px or more.
  const sizes = [...sheet.matchAll(/font(?:-size)?:[^;]*?(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1])).filter((n) => n < 40);
  assert.ok(sizes.every((n) => n >= 13), `font sizes ${[...new Set(sizes)].sort().join(', ')}`);
});
