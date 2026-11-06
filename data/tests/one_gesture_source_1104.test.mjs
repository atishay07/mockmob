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
  assert.equal(calls, 5, 'touchmove (waiting + owned), wheel (owned + the notch that lands on a story edge), keys');
  const move = body(code, 'onTouchMove');
  // A touch that starts outside a held story is native from touchstart (the compositor may scroll before the first touchmove).
  const start = body(code, 'onTouchStart');
  assert.match(start, /claim: story \? undefined : 'native'/);
  assert.doesNotMatch(start, /preventDefault\(/);
  // Under the slop the page waits (a story is held), then a decision; native claims return before any cancel.
  assert.match(move, /if \(g\.claim === 'native'\) return;\s*if \(e\.cancelable\) e\.preventDefault\(\);/);
  const wheel = body(code, 'onWheel');
  // A burst the story does not own returns before the owned cancel (its only cancel is the edge landing, below).
  assert.match(wheel, /if \(!wb\.own\) \{[\s\S]*?\s+return;\s+\}\s+keepY = null;\s*if \(e\.cancelable\) e\.preventDefault\(\);/);
  assert.match(wheel, /e\.ctrlKey/, 'pinch zoom is never cancelled');
  // R5 (6 Nov 2026): a burst from outside is cancelled only on the notch that would cross a story's edge, and that
  // notch is then the story's (catchWheel), so a spun mouse wheel neither overshoots nor shakes at the door.
  assert.match(wheel, /const s = keepY === null && !bus\.jumping\(\) \? edgeAhead\(window\.scrollY, dir, Math\.max\(2 \* px, 120\)\) : null;\s*if \(s\) \{\s*if \(e\.cancelable\) e\.preventDefault\(\);[\s\S]*?catchWheel\(s, t\);/);
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
  // (5 Nov 2026, LK90: <html> is one window tall on the landing, so the body is what grows and shrinks with the content.)
  assert.match(ctl, /resizeObserver\.observe\(document\.body\)/);
  assert.doesNotMatch(body(ctl, 'onTouchMove'), /getBoundingClientRect|offsetHeight/);
  assert.doesNotMatch(body(ctl, 'onFrame'), /getBoundingClientRect|offsetHeight/);
});

test('a step costs a fraction of a millisecond of style work: no custom property is set on the root of a story (4 Nov 2026: 50 ms at 4x in the Lab)', () => {
  const ctl = strip(CONTROLLER);
  assert.doesNotMatch(ctl, /setProperty\('--/, 'the lean is an inline transform on the stage, not a custom property');
  assert.match(ctl, /story\.stage\.style\.transform = leanTransform\(px\)/);
  const code = strip(STORY);
  assert.doesNotMatch(code, /root\.style\.setProperty\('--ss-step'/, '--ss-step is not written on the root');
  assert.doesNotMatch(code, /'--ss-step': step/, 'and React does not write it there either');
  assert.match(code, /const STEP_NODES = '\.ss-fill, \.lcd__tab-ink, \[data-ss-var\]';/, 'it is written on the few elements that read it');
  assert.match(code, /root\.dataset\.step = String\(next\); writeStep\(root, next\);/);
  const css = strip(read('src/app/scroll-story.css'));
  assert.match(css, /\.ss__stage\[data-lean\] \{/);
  assert.doesNotMatch(css, /--ss-drag/);
});

test('the old speed-driven test is gone and the rules it replaced are locked here and in oneGesture.test.mjs', () => {
  assert.throws(() => read('src/components/landing/scrollStorySpeed.test.mjs'), /ENOENT/);
});

test('a declared jump that lands above a story\'s first rest leaves that story on its first step, not the last it had (4 Nov 2026, found with nav links in real Chrome)', () => {
  const bus = strip(BUS);
  // The bus says once that a jump has ended, even if the page did not move in that frame.
  assert.match(bus, /state\.landed = landed;/);
  // (5 Nov 2026, LK89: the subscribers now run only on a frame that moved, resized or landed, and BEFORE the arrival check.)
  assert.match(bus, /if \(state\.dy \|\| state\.resized \|\| landed\) for \(const fn of \[\.\.\.subs\]\) fn\(state\);/);
  assert.match(bus, /if \(was\) \{ landedFlag = true; wake\(\); \}/);
  // The story reads the beat it landed on only on that frame, two frames later (the observer has reported by then),
  // and never on an ordinary frame, where a step the controller has just committed would be undone.
  const code = strip(STORY);
  assert.match(code, /bus\.subscribe\(\(\{ y, vh, landed \}\) => fromSide\(y, vh, landed\)\)/);
  assert.match(code, /if \(landed && !landing\) landing = window\.requestAnimationFrame\(\(\) => \{ landing = window\.requestAnimationFrame\(readLanding\); \}\);/);
  assert.match(code, /if \(!bus\.jumping\(\) && held\.size > 0 && !held\.has\(stepRef\.current\)\) applyStep\(Math\.min\(\.\.\.held\)\);/);
  assert.match(code, /window\.cancelAnimationFrame\(landing\);/);
});

test('the edge clamp holds only a fling: a scrollbar drag, End or a script jump across a story is never pulled back (4 Nov integration)', () => {
  // Found in the integration look: window.scrollTo from the hero to #exam-experience stopped on the statement's first
  // step (1,499 px at 390, the Lab's at 1440). The clamp now needs a touch released within 3 s or a running wheel burst.
  const code = strip(CONTROLLER);
  assert.match(code, /const FLING_MS = 3000;/);
  assert.match(code, /const wheelRunning = \(\) => wb !== null && now\(\) - wb\.last < WHEEL_QUIET_MS \* 2;/);
  assert.match(code, /const flinging = \(\) => now\(\) - lastRelease < FLING_MS \|\| wheelRunning\(\);/);
  // (5 Nov 2026, LK90: a finger dragging the page natively into another story's hold is held too; see the next test.)
  assert.match(body(code, 'onFrame'), /if \(keepY === null && !bus\.jumping\(\) && \(drag \|\| \(touches === 0 && flinging\(\)\)\)\) \{/);
  assert.match(code, /const dragging = \(\) => touches === 1 && g !== null && g\.claim === 'native';/, 'a drag is a finger scrolling natively, never a script or the scrollbar');
  assert.match(body(code, 'onTouchEnd'), /lastRelease = now\(\);/);
  assert.match(body(code, 'onTouchCancel'), /lastRelease = now\(\);/);
});

test('a tap on a jump link is not a fling, and a jump\'s landing frame still reads jumping() (5 Nov 2026, LK89 "stuck in a scroll loop")', () => {
  // The loop (reproduced by oneGestureJump.test.mjs): the tap's touchend counted as a fling for 3 s; the instant jump
  // arrived on its first frame and the bus cleared jumping() before the controller read it, so the controller held the
  // page on the edge of the near story the jump crossed, again after each of DemoJump's corrections.
  const bus = strip(BUS);
  const run = body(bus, 'run');
  assert.ok(run.indexOf('fn(state)') > 0 && run.indexOf('jumpFrame(y)') > run.indexOf('fn(state)'), 'subscribers first, then the arrival check');
  assert.match(bus, /export function onJump\(fn\) \{/);
  assert.match(body(bus, 'jump'), /for \(const fn of \[\.\.\.jumpWatchers\]\) fn\(jumpY\);/, 'every declared jump is announced');
  const code = strip(CONTROLLER);
  const stand = body(code, 'standDown');
  assert.match(stand, /keepY = null;/);
  assert.match(stand, /keepStory = null;/);
  assert.match(stand, /lastRelease = -Infinity;/);
  assert.match(body(code, 'passiveListeners'), /unsubJump = bus\.onJump\(standDown\);/, 'any bus.jump (DemoJump, HashSettle, a hash) stands the controller down');
  assert.match(body(code, 'onClick'), /standDown\(\);\s*if \(!e\.defaultPrevented\) declareAnchor\(url\.hash\);/);
  assert.match(body(code, 'onHashChange'), /standDown\(\);\s*declareAnchor\(window\.location\.hash\);/);
  // DemoJump: the question card, not the room, and the card itself takes focus; DemoDrill never glides.
  const jump = strip(read('src/components/landing/DemoJump.jsx'));
  assert.match(jump, /const CARD = '\.lp-desk__card';/);
  assert.match(jump, /stage\.querySelector\('\.mm-drill\[tabindex\]'\)/);
  const drill = strip(read('src/components/landing/DemoDrill.jsx'));
  assert.match(drill, /scrollIntoView\(\{ block: 'nearest', behavior: 'instant' \}\)/, "'auto' inherits html's scroll-behavior: smooth");
  assert.equal((drill.match(/className="lp-card mm-drill"[^>]*tabIndex=\{-1\}/g) || []).length, 2, 'both of the card\'s states take focus');
  // The arrival is the card's own shell, quiet: no outline ring.
  const css = strip(read('src/app/landing-close.css'));
  assert.match(css, /#try-practice\[data-arrive='true'\] \.lp-desk__card \{\s*animation: lp-arrive 600ms/);
  assert.doesNotMatch(css, /@keyframes lp-arrive[^@]*outline/, 'no ring in the arrival');
  assert.doesNotMatch(css, /data-arrive='true'\] \.mm-drill/, 'the near-white ring on .mm-drill is gone');
  assert.match(css, /@keyframes lp-arrive \{\s*30% \{ border-color: var\(--line-strong\); box-shadow: var\(--lp-arrive-lift\); \}\s*\}/);
});

test('a finger that drags the page into a story is held on the rest it came in by, and may turn back out (5 Nov 2026, LK90)', () => {
  // Found with the hunt (tmp/night-1105/p4): a 600 px swipe from above the statement dragged the page 240 px into its
  // hold before the finger lifted, and the release held the nearest rest (step 1; step 2 or 3 for longer swipes).
  const code = strip(CONTROLLER);
  const frame = body(code, 'onFrame');
  assert.match(frame, /if \(!s\.ok \|\| \(drag && s === g\.story\)\) continue;/, 'never the story the finger started in (its exits stay free)');
  assert.match(frame, /keepDir = 1;/);
  assert.match(frame, /keepDir = -1;/);
  assert.match(frame, /if \(keepY !== null && drag && \(keepDir > 0 \? y < keepY - 1 : y > keepY \+ 1\)\) \{ keepY = null; keepStory = null; \}/, 'a finger turning back out is free');
  assert.match(frame, /if \(keepY !== null && \(touches === 0 \|\| drag\) && Math\.abs\(y - keepY\) > 1\) \{/);
  assert.match(body(code, 'settle'), /if \(dragging\(\) && keepY !== null\) return;/, 'a finger still down keeps its hold');
});

test('the one glide on the landing is the reader\'s own way back (R3-D4, LK104, 5 Nov 2026): bus.glideTo, called only by pageJump', () => {
  // LK47 ("no glide") stands for everything the page does on its own. The owner's round 3 asked for the logo to take the
  // reader to the top and for a way to skip and to reach the bottom; within three screens that is an 850 ms
  // ease-in-out-cubic glide (Preparoo's own), further a veil and one instant jump. The glide is a declared jump for its
  // whole length (no story clamps it) and stops on any touch, wheel, key or pointer of the reader's.
  const callers = HOME_FILES.filter((file) => /glideTo\(/.test(strip(read(file)))).sort();
  assert.deepEqual(callers, ['src/components/landing/pageJump.mjs', 'src/components/landing/scrollBus.mjs']);
  const jump = strip(read('src/components/landing/pageJump.mjs'));
  assert.match(jump, /import \* as bus from '\.\/scrollBus\.mjs';/);
  assert.doesNotMatch(jump, /window\.scroll(To|By)\(/, 'pageJump moves the page only through the bus');
  assert.match(jump, /return Math\.abs\(to - from\) <= GLIDE_SCREENS \* vh \? 'glide' : 'veil';/);
  assert.match(jump, /if \(reduced\) return 'instant';/, 'never a glide under reduced motion');
  const bus = strip(BUS);
  assert.match(body(bus, 'glideTo'), /jump\(end\(\)\);/, 'declared before the first frame');
  assert.match(body(bus, 'jumpInput'), /addEventListener\(type, userTook, \{ passive: true \}\)/, 'the reader\'s input ends it');
  // Every frame of it is instant: html's scroll-behavior: smooth would turn each into a glide of its own.
  assert.match(body(bus, 'glideTo'), /behavior: 'instant'/);
});

test('touch screens: inside a held story the browser may pan only the way out, a fling caught on an edge is stopped, and a touch just short of an edge is the story\'s (R5, 6 Nov 2026, LK161)', () => {
  // Measured on Android Chrome (real touch, emulator): quick swipes flew 2-3 steps because a swipe that starts while the
  // last fling runs reaches the page uncancelable, a caught fling kept running and was boosted by the next swipe, and a
  // fling that stopped 8 px short of a story started the next swipe outside it. Each has its own rule here.
  const code = strip(CONTROLLER);
  const css = read('src/app/scroll-story.css');
  assert.match(css, /@supports \(touch-action: pan-up\) \{\s*@media \(pointer: coarse\) \{\s*\.ss__track\.held-mid \{ touch-action: pinch-zoom; \}\s*\.ss__track\.held-first \{ touch-action: pan-up pinch-zoom; \}\s*\.ss__track\.held-last \{ touch-action: pan-down pinch-zoom; \}/);
  const held = body(code, 'syncHeld');
  assert.match(held, /s\.step\(\) <= 0 \? 'first' : s\.step\(\) >= s\.steps - 1 \? 'last' : 'mid'/, 'the mark follows the step the story shows');
  assert.match(body(code, 'onFrame'), /syncHeld\(lastY\);/, 'kept current as the page moves: a swipe can start mid-motion (two real skips when it was set only at rest)');
  assert.match(body(code, 'settle'), /syncHeld\(target\);/, 'kept current when the page comes to rest');
  assert.match(body(code, 'commit'), /syncHeld\(\);/, 'and on every committed step');
  assert.match(body(code, 'onTouchStart'), /const story = holding\(\) \?\? adoptEdge\(e\.target\);/);
  assert.match(code, /const ADOPT_PX = 64;/);
  assert.match(code, /track\.classList\.add\(`held-\$\{edge\}`\)/, 'a class, never a data attribute (an attribute write restyled the whole story)');
  const stop = body(code, 'stopFling');
  assert.match(stop, /html\.style\.overflowY = 'hidden';/);
  assert.match(stop, /requestAnimationFrame\(\(\) => \{ html\.style\.overflowY = before; flingStopped = 0; \}\)/, 'one frame only: the page is never left frozen');
  assert.match(body(code, 'touchPans'), /CSS\.supports\?\.\('touch-action', 'pan-up'\)/);
  assert.match(body(code, 'touchPans'), /\(pointer: coarse\)/, 'never on a mouse or trackpad');
  assert.match(body(code, 'onFrame'), /if \(touches === 0 && now\(\) - lastRelease < FLING_MS && stoppedAt !== keepY\) \{ stoppedAt = keepY; stopFling\(\); syncHeld\(keepY\); \}/, 'only a touch fling the clamp has caught');
});
