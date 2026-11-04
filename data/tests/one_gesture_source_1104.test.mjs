// node --test data/tests/one_gesture_source_1104.test.mjs
// LK69 and LK47 (owner, 2 and 4 Nov 2026), locked at the source:
//   LK69 "one gesture, one step, it detects speed": a held story moves exactly one step per swipe, wheel burst or key press
//        (storyController.mjs; the behaviour itself is measured in real Chrome by oneGesture.test.mjs).
//   LK47 "the scroll seemed to race": nothing on the landing may glide the page, and the reader's scrolling is 100% native
//        wherever no held story is within one screen: no listener that can cancel a scroll exists there.
// These tests read the sources, so they hold even where no browser can run.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const strip = (text) => text.split('\n').filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line)).join('\n');
const CONTROLLER = read('src/components/landing/storyController.mjs');
const STORY = read('src/components/landing/ScrollStory.jsx');
const BUS = read('src/components/landing/scrollBus.mjs');

function walk(dir) {
  const out = [];
  for (const name of readdirSync(new URL(dir, root))) {
    const path = join(dir, name).replaceAll('\\', '/');
    if (statSync(new URL(path, root)).isDirectory()) out.push(...walk(path));
    else if (/\.(js|jsx|mjs)$/.test(name) && !/\.test\./.test(name)) out.push(path);
  }
  return out;
}

// The files that make up the home page's scroll behaviour: the landing's components, the brand components it uses, the page.
const HOME_FILES = [...walk('src/components/landing'), ...walk('src/components/brand'), 'src/app/page.js', 'src/components/NavBar.jsx', 'src/components/MobileDock.jsx'];
const body = (source, name) => {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} exists`);
  const next = source.indexOf('\nfunction ', start + 10);
  const nextExport = source.indexOf('\nexport ', start + 10);
  const end = Math.min(...[next, nextExport].filter((n) => n > 0), source.length);
  return source.slice(start, end);
};

test('the only non-passive listeners on the home page are the story controller\'s touchmove and wheel, inside attach() and detach()', () => {
  const offenders = HOME_FILES.filter((file) => /passive:\s*false/.test(strip(read(file)))).sort();
  assert.deepEqual(offenders, ['src/components/landing/storyController.mjs'], 'no other home-page file registers a listener that can cancel a scroll');
  const code = strip(CONTROLLER);
  const attach = body(code, 'attach');
  const detach = body(code, 'detach');
  assert.match(attach, /addEventListener\('touchmove', onTouchMove, \{ passive: false \}\)/);
  assert.match(attach, /addEventListener\('wheel', onWheel, \{ passive: false \}\)/);
  assert.match(detach, /removeEventListener\('touchmove', onTouchMove, \{ passive: false \}\)/);
  assert.match(detach, /removeEventListener\('wheel', onWheel, \{ passive: false \}\)/);
  const inside = (attach.match(/passive:\s*false/g) || []).length + (detach.match(/passive:\s*false/g) || []).length;
  assert.equal((code.match(/passive:\s*false/g) || []).length, inside, 'every passive: false is in attach() or detach()');
});

test('attach() runs only while a story is within one screen of the viewport', () => {
  const code = strip(CONTROLLER);
  assert.equal((code.match(/\battach\(\)/g) || []).length, 2, 'declared once, called once');
  const near = body(code, 'near');
  assert.match(near, /if \(on\) \{[\s\S]*nearSet\.add\(s\);[\s\S]*attach\(\);/);
  assert.match(near, /nearSet\.delete\(s\);\s*if \(!nearSet\.size\) detach\(\);/);
  // ScrollStory feeds it from one observer whose window is one screen above and below the track.
  assert.match(strip(STORY), /rootMargin: '100% 0px 100% 0px'/);
  assert.match(strip(STORY), /controller\.near\(handleRef\.current, on\)/);
  assert.match(strip(STORY), /controller\.near\(handleRef\.current, false\)/, 'and leaves it on unmount');
  // The listeners that cannot cancel anything may stay while any story is mounted.
  for (const type of ['touchstart', 'touchend', 'touchcancel']) assert.match(code, new RegExp(`\\[fn\\]\\('${type}', \\w+, \\{ passive: true \\}\\)`));
  assert.doesNotMatch(body(code, 'passiveListeners'), /passive:\s*false/);
});

test('preventDefault is called only for a gesture the controller owns', () => {
  const code = strip(CONTROLLER);
  const calls = [...code.matchAll(/preventDefault\(\)/g)].length;
  assert.equal(calls, 4, 'touchmove (waiting + owned), wheel, keys');
  const move = body(code, 'onTouchMove');
  // Under the slop the page waits (a story is held), then a decision; native claims return before any cancel.
  assert.match(move, /if \(!g\.story\) \{ g\.claim = 'native'; return; \}/);
  assert.match(move, /if \(g\.claim === 'native'\) return;\s*if \(e\.cancelable\) e\.preventDefault\(\);/);
  const wheel = body(code, 'onWheel');
  assert.match(wheel, /if \(!wb\.own\) return;\s*keepY = null;\s*if \(e\.cancelable\) e\.preventDefault\(\);/);
  assert.match(wheel, /e\.ctrlKey/, 'pinch zoom is never cancelled');
  const keys = body(code, 'onKeyDown');
  assert.match(keys, /const s = holding\(\);\s*if \(!s \|\| \(now\(\) >= busyUntil && !canStep\(s, dir\)\)\) return;[\s\S]*e\.preventDefault\(\);/);
  assert.match(keys, /\(e\.key === ' ' \|\| e\.key === 'Spacebar'\) && target\?\.closest\(PRESSABLE\)\) return;/, 'Space on a focused button is the button\'s');
  assert.match(code, /const PRESSABLE = '[^']*\[role="button"\]/);
  assert.doesNotMatch(strip(STORY), /preventDefault\(/);
  assert.doesNotMatch(strip(STORY), /overflow\s*=\s*['"]hidden/, 'the page is never frozen to stop momentum');
});

test('nothing on the landing glides the page (LK47): every programmatic move is instant', () => {
  for (const file of HOME_FILES) {
    const code = strip(read(file));
    assert.doesNotMatch(code, /window\.scroll(To|By)\(\{[^}]*behavior:\s*['"]smooth/, `${file} glides the page`);
    assert.doesNotMatch(code, /scrollTo\(\{[^}]*behavior:\s*['"]smooth/, `${file} scrolls smoothly`);
    assert.doesNotMatch(code, /scrollIntoView\(\{[^}]*behavior:\s*['"]smooth/, `${file} scrolls into view smoothly`);
  }
  const code = strip(STORY);
  assert.doesNotMatch(code, /STEP_MS|easeOut|steering/, 'the old 440 ms glide is gone');
  assert.match(strip(CONTROLLER), /const put = \(y\) => window\.scrollTo\(\{ top: y, behavior: 'instant' \}\);/);
  assert.match(strip(BUS), /window\.scrollTo\(\{ top: Math\.round\(y\), behavior: 'instant' \}\)/);
});

test('programmatic jumps declare their target before they scroll (so a jump from outside is not held at the first rest)', () => {
  for (const file of ['src/components/landing/HashSettle.jsx', 'src/components/landing/DemoJump.jsx']) {
    const code = strip(read(file));
    assert.match(code, /import \{ instantTo \} from '\.\/scrollBus\.mjs';/, file);
    assert.doesNotMatch(code, /window\.scrollTo\(/, `${file} moves the page only through the bus`);
  }
  assert.match(strip(BUS), /export function instantTo\(y\) \{[\s\S]*jump\(y\);[\s\S]*window\.scrollTo/);
  // Links and hashes the controller sees (it listens while any story is mounted) are declared too.
  const code = strip(CONTROLLER);
  assert.match(code, /document\[fn\]\('click', onClick, \{ capture: true, passive: true \}\)/);
  assert.match(code, /window\[fn\]\('hashchange', onHashChange/);
  assert.match(body(code, 'onKeyDown'), /bus\.clearJump\(\)/);
  assert.match(body(code, 'onWheel'), /bus\.clearJump\(\)/);
  assert.match(body(code, 'onTouchStart'), /bus\.clearJump\(\)/);
  // The clamp stands down for a declared jump.
  assert.match(body(code, 'onFrame'), /!bus\.jumping\(\)/);
  // The story's own picked step is instant and goes through the controller.
  assert.match(strip(STORY), /controller\.goTo\(handleRef\.current, n\)/);
});

test('one shared scroll read: the things that followed the scroll each on their own now subscribe to scrollBus', () => {
  for (const file of ['src/components/brand/ObjectLife.jsx', 'src/components/brand/PipGuide.jsx', 'src/components/landing/SectionPosition.jsx', 'src/components/landing/ScrollStory.jsx']) {
    const code = strip(read(file));
    assert.match(code, /scrollBus\.mjs'/, `${file} imports the bus`);
    assert.match(code, /(scrollBus|bus)\.subscribe\(/, `${file} subscribes`);
    assert.doesNotMatch(code, /window\.addEventListener\('scroll'/, `${file} has no scroll listener of its own`);
  }
  // The bus itself: one passive scroll listener, one frame request per frame, nothing cancelled.
  const bus = strip(BUS);
  assert.equal((bus.match(/addEventListener\('scroll'/g) || []).length, 1);
  assert.match(bus, /window\.addEventListener\('scroll', wake, \{ passive: true \}\)/);
  assert.match(bus, /const wake = \(\) => \{ if \(!frame\) frame = window\.requestAnimationFrame\(run\); \};/);
  assert.doesNotMatch(bus, /preventDefault|passive:\s*false/);
  // The loops that follow the scroll sleep while a held story is on screen.
  assert.match(strip(read('src/components/brand/ObjectLife.jsx')), /scrollBus\.held\(\)/);
  assert.match(strip(read('src/components/brand/PipGuide.jsx')), /scrollBus\.held\(\)/);
  assert.match(strip(STORY), /bus\.hold\(id, held\.size > 0\)/);
  // PipGuide: no query or measure per scroll frame (the drill's figures and the boxes are cached).
  const pip = strip(read('src/components/brand/PipGuide.jsx'));
  const choose = pip.slice(pip.indexOf('const choose = () => {'), pip.indexOf('const recheck = () => { dirty = true;'));
  assert.doesNotMatch(choose, /querySelectorAll|getBoundingClientRect|checkVisibility/);
});

test('the story\'s resize work is read-then-write and runs once per size change, never in a scroll frame', () => {
  const code = strip(STORY);
  const fit = body(code, 'fitAll');
  assert.match(fit, /for \(let pass = 0; pass < 3 && live\.some/);
  assert.match(code, /Math\.abs\(w - last\.w\) < 1 && Math\.abs\(h - last\.h\) < 16/, 'a few px of browser bar is not a size change');
  assert.doesNotMatch(code, /addEventListener\('scroll'/, 'no scroll listener in ScrollStory: the side check rides the shared read');
  // Geometry is cached by the controller (re-measured on size, content-visibility and near), hot paths read scrollY only.
  const ctl = strip(CONTROLLER);
  assert.match(ctl, /contentvisibilityautostatechange/);
  assert.match(ctl, /new ResizeObserver\(measureNear\)/);
  assert.doesNotMatch(body(ctl, 'onTouchMove'), /getBoundingClientRect|offsetHeight/);
  assert.doesNotMatch(body(ctl, 'onFrame'), /getBoundingClientRect|offsetHeight/);
});

test('the old speed-driven test is gone and the rules it replaced are locked here and in oneGesture.test.mjs', () => {
  assert.throws(() => read('src/components/landing/scrollStorySpeed.test.mjs'), /ENOENT/);
});
