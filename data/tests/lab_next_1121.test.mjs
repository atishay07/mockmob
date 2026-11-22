// node --test data/tests/lab_next_1121.test.mjs
// The Mistake Lab's "next" look (21 Nov 2026; owner: "the mistake lab approach was better ... You just had to redo the
// screens", and LK363: the product's real screens worked live by a cursor). LabCinema look="next" keeps the held story, its
// five scenes and their words, and draws each screen as the result page's own UI (LabNextScreens.jsx) inside a CursorDemo.
// LK368 (22 Nov 2026 night, the owner: "incorporate the old and new into making better cards"): each card leads with ONE
// finding (its figure bold, one pen mark), then ONE picture from the earlier screens, then the slot a tap fills; a beat line
// above the device follows the taps.
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
const NEXT_ONLY = /data-look=|cd-stage|cd-cursor|class="lnx|lc-beats|mr-start/;

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
  // Each card: the finding first, then its picture from the earlier screens (the chapter bars cut into their lost questions,
  // the pace rows, each change as two picks and an arrow, the two options that matter and the repair's own key, the plan).
  const parts = {
    chapters: /class="lnx-find"[\s\S]*class="lnx-ch__q"/, time: /class="lnx-find"[\s\S]*class="lnx-t__row"/,
    changes: /class="lnx-net"[\s\S]*class="lnx-chg"/, repair: /class="lnx-rq"[\s\S]*class="lnx-opt"[\s\S]*class="mr-start"/,
    swot: /class="lnx-plan lnx-in"[\s\S]*class="lnx-quad lnx-in"/,
  };
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
  assert.ok(text.includes(`All ${S.facts.wrong} wrong answers ran over the ${S.pace} pace.`), 'the Time finding, from labStory');
  for (const c of S.changes) assert.ok(text.includes(`Picked ${c.from} at ${c.at}. Changed to ${c.to} at ${c.toAt}, ${c.gap} later.`), `change Q${c.n}`);
  assert.ok(text.includes(`Repair Q${REPAIR.n}`));
  assert.ok(text.includes(S.swot.plan[0].label));
  for (const q of S.swot.quadrants) assert.ok(text.includes(q.title), q.id);
  // Chapters: the habit proof, labStory's earlierLine, in the folded head of "Across your mocks" (no opening needed).
  const chapters = scenesOf(next)[0];
  assert.match(chapters, /class="lnx-across"/);
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
  assert.ok(scene(1).includes(`Pace ${S.pace}`) && scene(1).includes('Over pace, wrong Over pace, right Under pace'));
  assert.equal(scenesOf(next)[1].match(/class="lnx-t__row"/g).length, 8, 'every answered question, slowest first');
  assert.ok(scene(2).includes(`+${S.gainedMarks} 1 change gained ${S.gainedMarks} marks`), 'the gain and its line');
  assert.ok(scene(2).includes(`2 changes cost ${-S.lostToChanges} marks`) && scene(2).includes('Net effect on your marks'));
  assert.ok(scene(2).includes('= −6'));
  assert.ok(scene(3).includes(REPAIR.stem));
  assert.ok(scene(4).includes('Strengths, gaps and risks'));
  const sheet = read('src/components/landing/lab-next.css');
  assert.doesNotMatch(sheet, /lnx-rq[^}]*(display: none|text-overflow|nowrap|line-clamp)/, 'the question is never cut or hidden');
  // A chapter's lost question is a 44 px tap (its piece drawn 30 px inside).
  assert.match(sheet, /\.lnx-ch__q \{[^}]*height: 44px;/);
  // Short phones (360 x 740 and under) are trimmed from the first frame, never shrunk: five time rows; at 360 x 640 the key,
  // the totals and the record's columns step aside. The two options that matter show at every size: no rule hides them.
  assert.match(sheet, /@media \(max-width: 380px\) and \(max-height: 760px\) \{[^@]*\.lnx-t__rows > li:nth-child\(n \+ 6\) \{ display: none; \}/);
  assert.match(sheet, /@media \(max-width: 380px\) and \(max-height: 660px\) \{[^@]*:is\(\.lnx-key, \.lnx-tot, \.lnx-across__cols\) \{ display: none; \}/);
  assert.doesNotMatch(sheet, /\.lnx-opts? \{[^}]*display: none/);
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
  assert.deepEqual(hasSubjects, [], 'no :has()');
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
});

// LK366 (22 Nov 2026), the owner: "the auto play is a bit too fast. Previously, it was a bit too slow, but I prefer the previous
// one only over this one. This is just way too fast ... No one can even read it properly". Every scene keeps one rhythm, timed
// from the moment its card stands: the first tap 1.4 to 1.7 s in; 1.8 s or more of rest after each answer before the next tap;
// 2.0 to 2.4 s after the last answer, then the next card; a scene 6.5 to 7.5 s, the Lab 32 to 38 s; the last scene rests.
test('the Lab keeps the pace the owner can read: every scene alike, every rest long enough', async () => {
  await lab();
  const { LAB_PACE, REVEAL_MS, LAB_TAPS, LAB_SCRIPTS, LNX_IN_MS, sceneMs } = await load('src/components/landing/LabNextScreens.jsx');
  const { firstTapMs, readMs, lastReadMs, minReadMs, minLastReadMs, moveMs, pressMs } = LAB_PACE;
  assert.ok(firstTapMs >= 1400 && firstTapMs <= 1700, `first tap ${firstTapMs} ms after the card stands`);
  assert.ok(minReadMs >= 1800 && readMs >= minReadMs, `rest after an answer ${readMs} ms (never under ${minReadMs})`);
  assert.ok(minLastReadMs >= 2000 && lastReadMs >= minLastReadMs && lastReadMs <= 2400, `rest after the last answer ${lastReadMs} ms`);
  // The press is CursorDemo's own.
  assert.match(read('src/components/landing/demo/CursorDemo.jsx'), new RegExp(`const PRESS_MS = ${pressMs};`));
  // Each reveal is what its sheet draws: the slot's rise (every tap but the repair's), and the repair's sheet and rule.
  const sheet = read('src/components/landing/lab-next.css');
  assert.match(sheet, /\.lnx-slot__item\[data-shown\] \{ visibility: visible; animation: lnx-rise 260ms/);
  assert.equal(REVEAL_MS.line, 260);
  assert.deepEqual(Object.keys(REVEAL_MS).sort(), ['line', 'repair']);
  assert.match(sheet, /\.lnx-sheet\[data-fresh\] \{ animation: lnx-sheet 320ms/);
  const repairCss = read('src/components/recovery/mistake-repair.css');
  assert.match(repairCss, /\.mr-rule\[data-stagger\] \{ animation: mr-rule-in 520ms/);
  assert.equal(REVEAL_MS.repair, 520 + 3 * 50, 'the rule is the fourth block, 50 ms apart');
  // Two taps a scene, every scene (Repair too: the row opens, then the repair), each a real control of the screen.
  let total = 0;
  for (const scene of ['chapters', 'time', 'changes', 'repair', 'swot']) {
    const taps = LAB_TAPS[scene];
    assert.equal(taps.length, 2, `${scene}: two taps`);
    const script = LAB_SCRIPTS[scene];
    const clicks = script.filter((s) => s.click);
    assert.equal(clicks.length, 2, `${scene}: the script taps twice`);
    for (const c of clicks) { assert.equal(c.move, moveMs); assert.equal(c.exact, true, `${scene}: a rest is never cut short to catch up`); }
    // The script ends on its last tap's rest (then the hand-off): no move after it.
    assert.ok(script.at(-1).click, `${scene}: ends on its last tap`);
    // The cursor waits for its card to stand, shows where the last one stopped, and rests before its first move.
    assert.ok(script.findIndex((s) => s.click) >= 4, `${scene}: stands, arrives, rests, then taps`);
    // Scripted length, from the scene's step to the next one's: within 6.5 to 7.5 s, and 6.5 s or more from its card standing.
    const ms = sceneMs(scene);
    assert.equal(ms, LNX_IN_MS + firstTapMs + taps[0].reveal + readMs + moveMs + pressMs + taps[1].reveal + lastReadMs);
    assert.ok(ms >= 6500 && ms <= 7500, `${scene}: ${ms} ms a scene`);
    assert.ok(ms - LNX_IN_MS >= 6500, `${scene}: ${ms - LNX_IN_MS} ms from its card standing`);
    total += ms;
  }
  assert.ok(total >= 32000 && total <= 38000, `the whole Lab ${total} ms`);
  // The pace's targets are named in the code with the owner's words.
  const screens = read('src/components/landing/LabNextScreens.jsx');
  assert.match(screens, /"the auto play is a bit too fast\./);
  assert.match(screens, /export const LAB_PACE = Object\.freeze\(\{ firstTapMs: \d+, readMs: \d+, lastReadMs: \d+, minReadMs: 1800, minLastReadMs: 2000,/);
});

// LK366: nothing cut off on a phone. The Lab plays only while its stage is held whole in the window (the track's top at the
// window's top, clear of the site bar and the position band); a reader who stops on the way in with the Lab's heading in the
// top half of the window is carried to the first resting place, and one on the way out is left alone.
test('the Lab plays only while it is whole, and a reader who stops on the way in is carried to it', () => {
  const cinema = read('src/components/landing/LabCinema.jsx');
  assert.match(cinema, /const HELD_STRIP = '0px 0px -99\.6% 0px';/);
  assert.match(cinema, /new IntersectionObserver\(\(entries\) => setHeld\(entries\[entries\.length - 1\]\.isIntersecting\), \{ rootMargin: HELD_STRIP, threshold: 0 \}\)/);
  assert.match(cinema, /ready=\{pinned && held && \(i !== 0 \|\| armed\)\}/, 'no scene plays until the stage is held');
  assert.match(cinema, /const firstReady = next \? armed && held : armed;/, 'the first card waits calm in its start state');
  assert.match(cinema, /const GLIDE_REACH = 0\.5;/);
  assert.match(cinema, /window\.scrollTo\(\{ top: Math\.round\(y \+ top\), behavior: 'smooth' \}\)/, 'the browser\'s own smooth scroll');
  assert.match(cinema, /const down = lastY !== null && y > lastY \+ 1;/, 'only on the way in');
  assert.match(cinema, /if \(!near \|\| fingers > 0 \|\| document\.hidden\) return;/, 'never under a finger');
  assert.match(cinema, /if \(!next \|\| !pinned \|\| reduced \|\| !track/, 'never under reduced motion, never for the default look');
  // No layout read per scroll event: the scroll listener only re-arms the timer.
  assert.match(cinema, /const onScroll = \(\) => \{ if \(near\) later\(\); \};/);
  assert.doesNotMatch(read('src/components/landing/ScrollStory.jsx'), /autoplay|useLabAutoplay|GLIDE_REACH|HELD_STRIP/i, 'ScrollStory is unchanged for every story');
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
  assert.match(css, /\.lc-scene \.lnx-in \{ animation-play-state: paused; \}/);
  for (let s = 0; s < 5; s += 1) assert.ok(css.includes(`[data-step='${s}'] .lc__grid[data-look='next'] .lc-scene[data-ss-step='${s}']${s === 0 ? "[data-armed='true']" : ''} .lnx-in`), `step ${s} runs its reveal`);
  // Every card's picture plays in once it stands: each of these screens has elements that wait (lnx-in).
  const screensSrc = read('src/components/landing/LabNextScreens.jsx');
  for (const name of ['ChaptersScreen', 'TimeScreen', 'ChangesScreen', 'SwotScreen']) {
    const from = screensSrc.indexOf(`function ${name}`);
    assert.match(screensSrc.slice(from, screensSrc.indexOf('\n}\n', from)), /lnx-in/, `${name}: its picture plays in`);
  }
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
  const { LAB_TAPS } = await load('src/components/landing/LabNextScreens.jsx');
  for (const key of ['chapters', 'time', 'changes', 'repair', 'swot']) assert.equal(LAB_TAPS[key].length, 2, `${key}: two taps`);
  // Repair's first tap is the pick itself (a real button that says it is pressed): the record line waits in its slot.
  assert.match(scenes[3], /<button type="button" class="lnx-opt" data-kind="mine" aria-pressed="false"/);
  assert.ok(textOf(scenes[3]).includes('From your record You first chose B here, then changed to D.'));
  assert.ok(textOf(scenes[3]).includes(`Your answer ${REPAIR.options.find(([l]) => l === REPAIR.picked)[1]}`));
  assert.ok(textOf(scenes[3]).includes(`Correct answer ${REPAIR.options.find(([l]) => l === REPAIR.key)[1]}`));
  for (const scene of LAB_SCENES) {
    assert.ok(scene.next?.short, `${scene.key}: a short line for phones`);
    assert.ok(scene.next.short.length <= 52, `${scene.key}: one short line`);
  }
  const sheet = read('src/components/landing/lab-next.css');
  assert.match(sheet, /\.lnx-slot__item \{ grid-area: 1 \/ 1;[^}]*visibility: hidden; \}/);
  assert.match(sheet, /\.lc\[data-pinned='true'\] \.lc__grid\[data-look='next'\] \{ padding-inline: 11px;/, 'the device takes 94 % of a phone');
  // Text in the screens is 14 px or more (LK368: on-screen text never under 14 px on a phone; the films measure it at the fit).
  const sizes = [...sheet.matchAll(/font(?:-size)?:[^;]*?(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1])).filter((n) => n < 40);
  assert.ok(sizes.every((n) => n >= 14), `font sizes ${[...new Set(sizes)].sort().join(', ')}`);
});

// LK368 (22 Nov 2026 night): one finding a card with one pen mark (the result page's own idiom), and a beat line that follows
// the cursor's taps, one plain idea a beat, one line on a 360 px phone.
test('each card leads with one finding and one pen mark; the beat line follows the taps', async () => {
  const { next, def } = await lab();
  const { LAB_BEATS } = await load('src/components/landing/LabBeats.mjs');
  const scenes = scenesOf(next);
  for (const [i, key] of ['chapters', 'time', 'changes', 'repair', 'swot'].entries()) {
    const lines = LAB_BEATS[key];
    assert.equal(lines.length, 3, `${key}: a line for the card and one for each tap`);
    for (const line of lines) {
      assert.ok(line.length <= 42, `${key}: "${line}" fits one line on a 360 px phone`);
      assert.doesNotMatch(line, /!|\u2014/);
    }
    assert.ok(textOf(scenes[i]).includes(lines.join(' ')), `${key}: its three lines are drawn`);
  }
  assert.doesNotMatch(def, /lc-beats/, 'the default look keeps its own short line');
  const screens = read('src/components/landing/LabNextScreens.jsx');
  // One pen mark a card: Chapters, Time and Repair in the red pen, the plan in volt; Changes leads with its counted net.
  assert.equal((screens.match(/<Doodle mark=/g) || []).length, 4);
  // A tapped control writes its scene's beat (an attribute, no render); a fresh drawing starts on the first line.
  assert.match(screens, /if \(scene\) scene\.dataset\.beat = String\(k\);/);
  assert.match(screens, /removeAttribute\('data-beat'\)/);
  const css = read('src/components/landing/lab-next.css');
  assert.ok(css.includes(".lc-scene[data-beat='2'] .lc-beats > [data-k='2'] { opacity: 1; }"));
  // On a phone the SWOT scene's one way in takes the line's own cell, so every scene's words are the title and one line.
  assert.ok(css.includes(':is(.lc-beats, .lc-scene__cta) { grid-area: line; }'));
  assert.match(read('src/components/landing/LabCinema.jsx'), /data-link=\{link \? '' : undefined\}/);
});
