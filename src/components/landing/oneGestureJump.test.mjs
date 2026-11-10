// node --test src/components/landing/oneGestureJump.test.mjs
// LK89 (owner, 5 Nov 2026): "whenever and wherever I click 'Try a CUET question', it sometimes gets stuck in a scroll loop".
//
// The loop, found in the code and reproduced here: a tap on a jump link ends with a touchend, which the story controller
// counted as a fling for 3 s; the jump was instant, so it arrived on its first frame, and the scroll bus cleared
// jumping() before the controller read that frame. The controller took the arrival for a fling across the near story and
// held the page on that story's edge; DemoJump's correction jumped again, and the hold (never cleared) put it back. A tap
// made inside a hold left a hold at its touchend too, which no jump cleared. The page ended on the story's last step.
//
// This runs the real scrollBus and storyController against a small simulated window (scroll events at the next frame,
// requestAnimationFrame, timers and performance.now on one fake clock): a touch tap with its touchend on a link to the
// demo card, then DemoJump's instant declared jump and its two-frame correction, across a near story, from just below
// it, from far below it and from inside its hold. The page must land on the card and stay there. The same journey in
// real Chrome is runJump() in oneGestureBench.mjs.
//
// LK90 (5 Nov 2026), found with the fast-scroll hunt (runFast): a finger that drags the page into a story from outside
// is held on the rest it came in by (it used to end on the rest nearest to how far the finger went: steps skipped), a
// finger that turns back out is free, and a drag that stops short of a story is never touched.
import test from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------- the simulated browser
const clock = { t: 1000 };
const timers = [];
let frameQueue = [];
let nextId = 1;
let scrollPending = false;
const moves = [];

class Listeners {
  constructor() { this.map = new Map(); }
  addEventListener(type, fn) { if (!this.map.has(type)) this.map.set(type, new Set()); this.map.get(type).add(fn); }
  removeEventListener(type, fn) { this.map.get(type)?.delete(fn); }
  dispatch(type, event = {}) {
    const e = { type, timeStamp: clock.t, defaultPrevented: false, cancelable: true, preventDefault() { this.defaultPrevented = true; }, ...event };
    for (const fn of [...(this.map.get(type) || [])]) fn(e);
    return e;
  }
}

class FakeElement {
  constructor({ top = 0, height = 0, href = null, id = null } = {}) {
    Object.assign(this, { docTop: top, height, href, id, isConnected: true, dataset: {}, style: { removeProperty() {}, setProperty() {} }, parentElement: null });
  }
  get offsetHeight() { return this.height; }
  getBoundingClientRect() { const top = this.docTop - win.scrollY; return { top, bottom: top + this.height, height: this.height }; }
  closest(selector) { return selector.startsWith('a') && this.href ? this : null; }
}

const win = Object.assign(new Listeners(), {
  scrollY: 0,
  innerHeight: 844,
  innerWidth: 390,
  location: { href: 'http://localhost/', origin: 'http://localhost', pathname: '/', hash: '' },
  scrollTo({ top }) {
    const y = Math.max(0, Math.min(MAX_Y, Math.round(top)));
    moves.push(y);
    if (y !== win.scrollY) { win.scrollY = y; scrollPending = true; }
  },
  requestAnimationFrame(fn) { const id = nextId++; frameQueue.push({ id, fn }); return id; },
  cancelAnimationFrame(id) { frameQueue = frameQueue.filter((f) => f.id !== id); },
  setTimeout(fn, ms = 0) { const id = nextId++; timers.push({ id, at: clock.t + ms, fn }); return id; },
  clearTimeout(id) { const i = timers.findIndex((x) => x.id === id); if (i >= 0) timers.splice(i, 1); },
  // (pointer: coarse) is read live by the controller (touchPans): off for every test but the ones that turn it on.
  matchMedia: () => ({ get matches() { return coarse; }, addEventListener() {}, removeEventListener() {} }),
});
let coarse = false;
// The root's style counts how often the page was made unscrollable for a frame (stopFling).
const rootStyle = { value: '', hides: 0, get overflowY() { return this.value; }, set overflowY(v) { this.value = v; if (v === 'hidden') this.hides += 1; } };
const doc = Object.assign(new Listeners(), {
  documentElement: { dataset: {}, style: rootStyle },
  elements: new Map(),
  getElementById(id) { return doc.elements.get(id) || null; },
});
const MAX_Y = 12000;

globalThis.window = win;
globalThis.document = doc;
globalThis.Element = FakeElement;
globalThis.CSS = { supports: () => true };
globalThis.getComputedStyle = () => ({ overflowY: 'visible', scrollMarginTop: '0px' });
win.getComputedStyle = globalThis.getComputedStyle;
Object.defineProperty(globalThis, 'performance', { value: { now: () => clock.t }, configurable: true });

/** One rendering update: scroll events first (the browser fires them in the frame), then the frame callbacks. */
function frame() {
  clock.t += 16;
  for (const timer of timers.filter((x) => x.at <= clock.t).sort((a, b) => a.at - b.at)) {
    win.clearTimeout(timer.id);
    timer.fn();
  }
  if (scrollPending) { scrollPending = false; win.dispatch('scroll'); }
  const run = frameQueue;
  frameQueue = [];
  for (const { fn } of run) fn(clock.t);
}
const frames = (n) => { for (let i = 0; i < n; i += 1) frame(); };

// ---------------------------------------------------------------- the page
const bus = await import('./scrollBus.mjs');
const controller = await import('./storyController.mjs');

// A story whose track starts at 4000 px: 3000 px tall, a 844 px stage, so the hold is 2156 px and its four rests are
// 4000, 4719, 5437 and 6156. The demo card sits in the hero, at 520 px; the nav is not simulated (DemoJump's gap is).
const STORY_TOP = 4000;
const track = new FakeElement({ top: STORY_TOP, height: 3000 });
// The marks a held track carries (held-first, held-mid, held-last), so a test can see that a flowing story never gets one.
const marks = new Set();
track.classList = { add: (...names) => names.forEach((n) => marks.add(n)), remove: (...names) => names.forEach((n) => marks.delete(n)) };
// FLOW (10 Nov 2026): the handle says whether the story flows (a touch screen). Off for every test above the flow block.
let flowOn = false;
const stage = new FakeElement({ top: STORY_TOP, height: 844 });
let shown = 0;
const handle = { id: 'story', root: new FakeElement(), track, stage, steps: 4, step: () => shown, show: (n) => { shown = n; }, reduced: () => false, flow: () => flowOn };
controller.register(handle);
controller.near(handle, true);
const rests = [0, 1, 2, 3].map((k) => Math.round(STORY_TOP + (2156 * k) / 3));
const END = rests[3];

const card = new FakeElement({ top: 520, height: 430, id: 'try-practice' });
doc.elements.set('try-practice', card);
const GAP = 12;
const cardTop = () => Math.round(win.scrollY + card.getBoundingClientRect().top - GAP);

/** A stand-in for DemoJump.go: one declared instant jump, then a correction two frames on if the card drifted. */
function demoJump() {
  const top = cardTop();
  if (Math.abs(win.scrollY - top) >= 2) bus.instantTo(top);
  win.requestAnimationFrame(() => win.requestAnimationFrame(() => {
    const settled = cardTop();
    if (Math.abs(win.scrollY - settled) > 6) bus.instantTo(settled);
  }));
}

// DemoJump listens for clicks on the document in the capture phase, takes a demo link over (no router navigation) and
// jumps. Registered after the controller's own click listener, the order the page mounts them in.
doc.addEventListener('click', (e) => {
  if (e.defaultPrevented || !String(e.target?.href || '').endsWith('#try-practice')) return;
  e.preventDefault();
  demoJump();
});

/** A finger taps a link to #try-practice: pointerdown, touchstart, touchend, then the click. */
function tapDemoLink() {
  const link = new FakeElement({ href: 'http://localhost/#try-practice' });
  const touch = { clientX: 195, clientY: 800 };
  win.dispatch('pointerdown');
  win.dispatch('touchstart', { touches: [touch], target: link });
  clock.t += 60;
  win.dispatch('touchend', { touches: [], target: link });
  doc.dispatch('click', { button: 0, target: link });
}

function placeAt(y) {
  win.scrollTo({ top: y });
  frames(30); // well past the settle timer and any jump
  moves.length = 0;
}

for (const [label, from] of [
  ['just below the story (it is within one screen)', END + 300],
  ['a screen below the story', END + 900],
  ['inside the story\'s hold, on a rest (a tap there leaves a hold at its touchend)', rests[2]],
]) {
  test(`a tap on a demo link ${label} lands on the card and stays there`, () => {
    placeAt(from);
    assert.equal(win.scrollY, from, 'starts where it was put');
    const target = cardTop();
    tapDemoLink();
    frames(120); // two seconds: the landing frame, the correction, the settle timer, the fling window's first part
    assert.equal(win.scrollY, target, `ends on the card (${target}), not on the story's edge (${END}) or a rest (${rests.join(', ')}); moves ${moves.join(' -> ')}`);
    assert.ok(moves.every((y) => y === target), `every move went to the card: ${moves.join(' -> ')}`);
    // And it stays: two more seconds of frames move nothing.
    frames(120);
    assert.equal(win.scrollY, target);
  });
}

test('a declared jump stands the controller down: a fling a moment before the tap does not hold the arrival', () => {
  placeAt(END + 300);
  // A real flick upward ended 200 ms ago (its momentum is over), then the reader taps the link.
  win.dispatch('touchstart', { touches: [{ clientX: 195, clientY: 300 }], target: new FakeElement() });
  win.dispatch('touchend', { touches: [], target: new FakeElement() });
  frames(12);
  const target = cardTop();
  tapDemoLink();
  frames(120);
  assert.equal(win.scrollY, target);
});

test('the bus runs a frame\'s subscribers before it checks the jump\'s arrival, and says `landed` on the next frame', () => {
  placeAt(END + 300);
  const seen = [];
  const off = bus.subscribe((s) => seen.push({ y: s.y, jumping: bus.jumping(), landed: s.landed }));
  bus.instantTo(600);
  frames(3);
  off();
  assert.deepEqual(seen[0], { y: 600, jumping: true, landed: false }, 'the landing frame still reads jumping()');
  assert.deepEqual(seen[1], { y: 600, jumping: false, landed: true }, 'the next frame carries landed');
});

test('a fling from outside is still held on the story\'s edge (the clamp is unchanged for real gestures)', () => {
  placeAt(END + 300);
  // The finger leaves the glass; the momentum carries the page up across the story's end.
  win.dispatch('touchstart', { touches: [{ clientX: 195, clientY: 300 }], target: new FakeElement() });
  win.dispatch('touchend', { touches: [], target: new FakeElement() });
  for (const y of [END + 200, END + 60, END - 120, END - 400]) { win.scrollTo({ top: y }); frame(); }
  frames(30);
  assert.equal(win.scrollY, END, 'held on the last rest');
});

// ---------------------------------------------------------------- a finger dragging into a story (LK90, 5 Nov 2026)
// The browser scrolls the page under a native drag on the compositor; the simulation applies each frame's finger travel
// to wherever the page is (after any hold put it back), as Chrome does.
function drag(perFrame, frameCount, { lift = true, fling = [] } = {}) {
  const at = { clientX: 195, clientY: 600 };
  win.dispatch('touchstart', { touches: [at], target: new FakeElement() });
  for (let i = 0; i < frameCount; i += 1) {
    at.clientY -= perFrame;
    win.dispatch('touchmove', { touches: [at], target: new FakeElement(), cancelable: false });
    win.scrollTo({ top: win.scrollY + perFrame });
    frame();
  }
  if (!lift) return;
  win.dispatch('touchend', { touches: [], target: new FakeElement() });
  for (const step of fling) { win.scrollTo({ top: win.scrollY + step }); frame(); }
  frames(30);
}

test('a fast drag from above into a story is held on its first rest while the finger is down, and after it lifts', () => {
  placeAt(STORY_TOP - 360);
  shown = 0;
  // 600 px of finger travel at about 2400 px/s, then the fling the browser would run on after it.
  drag(40, 15, { fling: [60, 50, 40, 30, 20, 10] });
  assert.equal(win.scrollY, rests[0], `held on the first rest (${rests[0]}), not the nearest one to how far the finger went`);
  assert.equal(shown, 0, 'and the story shows its first step');
});

test('a fast drag from below into a story is held on its last rest', () => {
  placeAt(END + 360);
  shown = 3;
  drag(-40, 15, { fling: [-60, -50, -40, -30, -20, -10] });
  assert.equal(win.scrollY, END);
  assert.equal(shown, 3);
});

test('an outside touch clamps entry when the compositor scrolls before the first touchmove is delivered', () => {
  placeAt(STORY_TOP - 360);
  shown = 0;
  const at = { clientX: 195, clientY: 600 };
  const target = new FakeElement();
  win.dispatch('touchstart', { touches: [at], target });
  win.scrollTo({ top: rests[1] });
  frame();
  assert.equal(win.scrollY, rests[0], 'the first compositor frame stops at the entrance');
  win.dispatch('touchend', { touches: [], target });
  frames(30);
  assert.equal(shown, 0);
});

test('lifting an outside touch preserves its entry clamp when the page has already moved ahead of the next frame', () => {
  placeAt(STORY_TOP - 360);
  shown = 0;
  drag(40, 12, { lift: false });
  assert.equal(win.scrollY, rests[0]);
  win.scrollTo({ top: rests[1] });
  win.dispatch('touchend', { touches: [], target: new FakeElement() });
  frames(30);
  assert.equal(win.scrollY, rests[0]);
  assert.equal(shown, 0);
});

test('a finger held still inside the hold keeps it; a finger that turns back out is free', () => {
  placeAt(STORY_TOP - 200);
  drag(40, 10, { lift: false });
  assert.equal(win.scrollY, rests[0], `held while the finger is down; moves ${moves.join(" ")}`);
  frames(20); // the finger rests 320 ms: the settle timer must not drop the hold
  const at = { clientX: 195, clientY: 200 };
  for (let i = 0; i < 6; i += 1) { win.dispatch('touchmove', { touches: [at], target: new FakeElement(), cancelable: false }); win.scrollTo({ top: win.scrollY + 40 }); frame(); }
  assert.equal(win.scrollY, rests[0], 'still held when it moves on');
  for (let i = 0; i < 10; i += 1) { win.dispatch('touchmove', { touches: [at], target: new FakeElement(), cancelable: false }); win.scrollTo({ top: win.scrollY - 40 }); frame(); }
  assert.ok(win.scrollY < STORY_TOP - 300, `turned back out freely (y ${win.scrollY})`);
  win.dispatch('touchend', { touches: [], target: new FakeElement() });
  frames(30);
  assert.ok(win.scrollY < STORY_TOP - 300, 'and stays out');
});

test('a slow drag that stops short of a story is never touched', () => {
  placeAt(STORY_TOP - 500);
  drag(10, 30);
  assert.equal(win.scrollY, STORY_TOP - 200);
});

// ---------------------------------------------------------------- the reader's way back (R3-D4, 5 Nov 2026)
// The logo on the home page and the bottom bar's Top and Skip move the page through pageJump.mjs: within three screens a
// glide (scrollBus.glideTo, 850 ms), a declared jump for its whole length. No story may clamp it on the way, it must end
// exactly where it was sent, and any touch of the reader's must stop it where it is.

test('a glide to the top across a near story arrives at 0 and stays: no hold on the story\'s edge', () => {
  placeAt(END + 300);
  // The tap on the logo or on Top: a touch that starts and ends on the glass (a fling window for 3 s, LK89).
  win.dispatch('touchstart', { touches: [{ clientX: 40, clientY: 800 }], target: new FakeElement() });
  clock.t += 60;
  win.dispatch('touchend', { touches: [], target: new FakeElement() });
  bus.glideTo(0, { ms: 850 });
  frames(70); // 1.1 s
  assert.equal(win.scrollY, 0, `ends at the top; moves ${moves.slice(0, 6).join(' ')} ... ${moves.slice(-4).join(' ')}`);
  assert.ok(moves.every((y, i) => i === 0 || y <= moves[i - 1]), 'every frame moved up: never put back on a rest');
  assert.ok(!moves.includes(END) || moves.indexOf(END) === moves.lastIndexOf(END), 'the story\'s last rest is passed, not held');
  assert.equal(bus.jumping(), false, 'the jump is over once the page has arrived');
  frames(120);
  assert.equal(win.scrollY, 0, 'and it stays there');
});

test('the glide eases in and out over 850 ms (ease-in-out-cubic), and a touch stops it where it is', () => {
  assert.equal(bus.easeInOutCubic(0), 0);
  assert.equal(bus.easeInOutCubic(0.5), 0.5);
  assert.equal(bus.easeInOutCubic(1), 1);
  assert.ok(bus.easeInOutCubic(0.1) < 0.1 && bus.easeInOutCubic(0.9) > 0.9, 'slow at both ends');
  placeAt(2400);
  bus.glideTo(0, { ms: 850 });
  frames(20); // about 320 ms in
  const mid = win.scrollY;
  assert.ok(mid > 0 && mid < 2400, `part way (${mid})`);
  win.dispatch('touchstart', { touches: [{ clientX: 195, clientY: 400 }], target: new FakeElement() });
  win.dispatch('touchend', { touches: [], target: new FakeElement() });
  frames(60);
  assert.equal(win.scrollY, mid, 'the reader took over: the page stays where the touch found it');
  assert.equal(bus.isGliding(), false);
});

test('a glide from inside a hold (Top tapped on a rest) leaves the story: the tap\'s hold is dropped', () => {
  placeAt(rests[1]);
  win.dispatch('touchstart', { touches: [{ clientX: 40, clientY: 800 }], target: new FakeElement() });
  clock.t += 60;
  win.dispatch('touchend', { touches: [], target: new FakeElement() });
  const target = STORY_TOP - 900;
  bus.glideTo(target, { ms: 850 });
  frames(80);
  assert.equal(win.scrollY, target, `left the story for ${target}; moves ${moves.slice(-5).join(' ')}`);
  frames(60);
  assert.equal(win.scrollY, target);
});

// ---------------------------------------------------------------- FLOW: a touch screen is never held (10 Nov 2026, LK190)
// The owner: held stories feel "very locked in" on a phone and "people will just not scroll to the end"; a page that
// scrolls past them "isn't able to really show the features". On a touch screen the story's handle says flow(): no
// finger is owned and the track is never marked, so the browser pans the page under the finger everywhere.
//
// FLOW v2 (10 Nov 2026, LK192, after he had used it on his phone): "even in normal scrolling ... it skips too much or too
// little of the content and unevenly skips the slides"; a flick that keeps scrolling is "expected behavior"; "not making
// it properly held". In a story with slides (handle.land) the gesture chooses the step: a swipe is exactly one step, a
// flick is the reader's, and a swipe that brings the story on lands on the step at its door. A passage (land off, the
// statement) keeps the first rule: the page's position chooses and only a scroll at rest is settled.
handle.land = true;

/** A declared move (never a gesture): no fling is left behind it, so the next test starts clean. */
function putAt(y) {
  bus.instantTo(y);
  frames(30);
  moves.length = 0;
}

function flowTest(name, fn, { landed = true, hold = true } = {}) {
  test(name, () => {
    flowOn = true;
    coarse = hold; // Chromium on a touch screen: a put page stays put while a fling runs. Off: nothing is put before rest.
    handle.landed = landed; // most tests are about a story the reader has already arrived in
    rootStyle.hides = 0;
    try { fn(); } finally {
      win.dispatch('touchend', { touches: [], target: new FakeElement() }); // no finger is left down by a failed test
      frames(30);
      flowOn = false; coarse = false; shown = 0; handle.landed = false; handle.land = true;
      putAt(STORY_TOP - 2000);
    }
  });
}

// One swipe as the browser runs it: `perFrame` px of finger travel per 16 ms frame with the page panning under it (20 is
// 1.25 px/ms, a normal swipe; 48 is 3 px/ms, a flick), then the momentum, a frame at a time, added to wherever the page
// is after the controller has acted. Returns the page's position after each frame of momentum.
function swipe(perFrame, frameCount, momentum = []) {
  const at = { clientX: 195, clientY: 600 };
  win.dispatch('touchstart', { touches: [at], target: new FakeElement() });
  for (let i = 0; i < frameCount; i += 1) {
    at.clientY -= perFrame;
    win.dispatch('touchmove', { touches: [at], target: new FakeElement(), cancelable: false });
    win.scrollTo({ top: win.scrollY + perFrame });
    frame();
  }
  win.dispatch('touchend', { touches: [], target: new FakeElement() });
  const seen = [];
  for (const step of momentum) { win.scrollTo({ top: win.scrollY + step }); frame(); seen.push(win.scrollY); }
  return seen;
}
const tap = () => {
  win.dispatch('touchstart', { touches: [{ clientX: 195, clientY: 600 }], target: new FakeElement() });
  win.dispatch('touchend', { touches: [], target: new FakeElement() });
};

flowTest('FLOW v2: a swipe inside a story is exactly one step, however far the finger and its momentum go', () => {
  // A short swipe with a long tail, a drag longer than the gap between two rests (719 px), and a 40 px nudge.
  for (const [perFrame, count, momentum] of [[20, 4, [30, 25, 20, 15, 10, 5]], [30, 30, [20, 10]], [8, 5, []]]) {
    putAt(rests[1]);
    assert.equal(shown, 1);
    const seen = swipe(perFrame, count, momentum);
    assert.ok(seen.every((y) => y === rests[2]), `the momentum runs out on the next rest (${rests[2]}): ${seen.join(' ')}`);
    assert.equal(controller.governs(handle), true, 'and the step is the gesture\'s while it does: the observer stands by');
    frames(30);
    assert.equal(win.scrollY, rests[2], `${perFrame * count} px of finger: one step, not none and not two`);
    assert.equal(shown, 2);
    assert.equal(controller.governs(handle), false, 'at rest the page position speaks again');
  }
  // The same the other way.
  putAt(rests[2]);
  swipe(-20, 4, [-30, -20, -10]);
  frames(30);
  assert.equal(win.scrollY, rests[1]);
  assert.equal(shown, 1);
  assert.equal(rootStyle.hides, 0, 'momentum between two steps is never stopped (a stop restyles the page): it runs out unseen');
});

flowTest('FLOW v2: the next step shows while the finger is still down, going back takes it back, and nothing is held under the finger', () => {
  putAt(rests[1]);
  const at = { clientX: 195, clientY: 600 };
  const move = (px) => { at.clientY -= px; win.dispatch('touchmove', { touches: [at], target: new FakeElement(), cancelable: false }); win.scrollTo({ top: win.scrollY + px }); frame(); };
  win.dispatch('touchstart', { touches: [at], target: new FakeElement() });
  move(10); move(10); move(10);
  assert.equal(shown, 1, '30 px: not yet');
  move(10);
  assert.equal(shown, 2, '40 px of page under the finger: the next step is on');
  assert.equal(win.scrollY, rests[1] + 40, 'the page went where the finger took it');
  move(-10); move(-10);
  assert.equal(shown, 2, 'back to 20 px: it stays');
  move(-10);
  assert.equal(shown, 1, 'back inside 16 px: taken back');
  win.dispatch('touchend', { touches: [], target: new FakeElement() });
  frames(30);
  assert.equal(win.scrollY, rests[1], 'and the page is put back on the rest of the step that shows');
  assert.equal(shown, 1);
});

flowTest('FLOW v2: a flick is the reader\'s: nothing is put while it flies, and it never settles behind the step its swipe had shown', () => {
  putAt(rests[0]);
  const seen = swipe(48, 4, [200, 200, 200, 150, 100, 50]);
  const free = [192 + 200, 192 + 400, 192 + 600, 192 + 750, 192 + 850, 192 + 900].map((d) => rests[0] + d);
  assert.deepEqual(seen, free, 'the momentum ran where the browser took it');
  assert.equal(controller.governs(handle), false, 'the steps follow the page as it passes');
  assert.equal(controller.passing(handle), true, 'shown a moment late, so slides do not strobe');
  frames(30);
  assert.equal(win.scrollY, rests[2], 'and it settles on the rest nearest to where it stopped');
  assert.equal(shown, 2);
  frames(100);
  assert.equal(controller.passing(handle), false);
  // A short, fast flick whose momentum dies inside the first step's band still moves the step its first 32 px showed.
  putAt(rests[1]);
  swipe(48, 3, [20, 10]);
  assert.equal(shown, 2, 'shown under the finger');
  frames(30);
  assert.equal(win.scrollY, rests[2], 'never back to the step it left');
  assert.equal(shown, 2);
});

flowTest('FLOW v2: leaving by the last step going down, or the first going up, is the browser\'s own scroll', () => {
  putAt(rests[3]);
  assert.equal(shown, 3);
  const down = swipe(20, 10, [30, 20, 10]);
  assert.deepEqual(down, [END + 230, END + 250, END + 260]);
  frames(30);
  assert.equal(win.scrollY, END + 260, 'and nothing pulls it back');
  assert.equal(shown, 3);
  putAt(rests[0]);
  const up = swipe(-20, 10, [-30, -20]);
  assert.deepEqual(up, [STORY_TOP - 230, STORY_TOP - 250]);
  frames(30);
  assert.equal(win.scrollY, STORY_TOP - 250);
  assert.equal(shown, 0);
});

flowTest('FLOW v2: a swipe onto the last step: its momentum points out of the story, so it is kept inside the end, stopped once, and the page is then put on the rest', () => {
  putAt(rests[2]);
  const seen = swipe(20, 4, [30, 30, 20]);
  assert.equal(shown, 3);
  assert.ok(seen.every((y) => y === END - 64), `kept 64 px inside the end, where a frame of momentum moves nothing on screen: ${seen.join(' ')}`);
  assert.equal(rootStyle.hides, 1, 'stopped, once');
  frames(30);
  assert.equal(win.scrollY, END, 'on the last rest once it is still');
  assert.equal(shown, 3);
  // And onto the first step going up.
  putAt(rests[1]);
  const up = swipe(-20, 4, [-30, -30]);
  assert.ok(up.every((y) => y === STORY_TOP + 64), up.join(' '));
  frames(30);
  assert.equal(win.scrollY, STORY_TOP);
  assert.equal(shown, 0);
});

flowTest('FLOW v2 arriving: a swipe that brings a story on lands on its first step, every time, whether its momentum or its finger crossed the edge', () => {
  for (const round of [1, 2]) {
    putAt(STORY_TOP - 360);
    shown = 0;
    const seen = swipe(20, 6, [60, 60, 50, 50, 40, 30, 20]); // lifted 240 px above the story; the momentum carries it in
    assert.deepEqual(seen, [STORY_TOP - 180, STORY_TOP - 120, STORY_TOP - 70, STORY_TOP - 20, rests[0], rests[0], rests[0]], `round ${round}`);
    frames(30);
    assert.equal(win.scrollY, rests[0]);
    assert.equal(shown, 0);
  }
  assert.equal(rootStyle.hides, 0, 'momentum that points into the story runs out unseen: never stopped');
  // The finger itself crosses the edge (120 px in) and lifts moving.
  putAt(STORY_TOP - 360);
  shown = 2; // whatever it showed before
  swipe(20, 24, [30, 20, 10]);
  assert.equal(shown, 0, 'the door\'s step');
  frames(30);
  assert.equal(win.scrollY, rests[0]);
  assert.deepEqual([...marks], [], 'and still not marked: the next touch pans freely');
});

flowTest('FLOW v2 arriving: from below a swipe lands on the last step', () => {
  putAt(END + 360);
  shown = 3;
  const seen = swipe(-20, 6, [-60, -60, -50, -50, -40, -30]);
  assert.deepEqual(seen.slice(-2), [END, END]);
  frames(30);
  assert.equal(win.scrollY, END);
  assert.equal(shown, 3);
});

flowTest('FLOW v2 arriving: a finger that walks the page in is never held; the door\'s step shows under it and it lands there when it lifts', () => {
  putAt(STORY_TOP - 360);
  shown = 2;
  drag(20, 30, { lift: false });
  assert.equal(win.scrollY, STORY_TOP + 240, 'the page went where the finger took it');
  assert.equal(shown, 0);
  frames(20); // the finger rests: nothing moves under it
  assert.equal(win.scrollY, STORY_TOP + 240);
  win.dispatch('touchend', { touches: [], target: new FakeElement() });
  frames(30);
  assert.equal(win.scrollY, rests[0]);
  assert.equal(shown, 0);
  assert.equal(handle.landed, true, 'and that was the arrival');
}, { landed: false });

flowTest('FLOW landing: a flick lands on the first step on its first arrival from above, is stopped once, and is never stopped again', () => {
  putAt(STORY_TOP - 360);
  shown = 0;
  const first = swipe(48, 4, [200, 200, 200, 100]);
  assert.deepEqual(first, [rests[0], rests[0], rests[0], rests[0]], 'held on the first rest for as long as the fling runs');
  assert.equal(rootStyle.hides, 1);
  frames(30);
  assert.equal(win.scrollY, rests[0]);
  assert.equal(shown, 0);
  assert.equal(handle.landed, true);
  // The same flick again: the story is free now.
  putAt(STORY_TOP - 360);
  const again = swipe(48, 4, [200, 200, 200, 100]);
  assert.deepEqual(again, [32, 232, 432, 532].map((d) => STORY_TOP + d), 'never put back while it runs');
  frames(30);
  assert.equal(win.scrollY, rests[1], `settled on the nearest rest (${rests[1]}) once it stopped`);
  assert.equal(shown, 1);
}, { landed: false });

flowTest('FLOW landing: never on the way back up', () => {
  putAt(END + 360);
  shown = 3;
  const up = swipe(-48, 4, [-200, -200, -200]);
  assert.deepEqual(up, [392, 592, 792].map((d) => END + 360 - d), 'a flick up into the story from below is free');
  frames(30);
  assert.equal(win.scrollY, rests[2]);
}, { landed: false });

flowTest('FLOW: a passage (land off, the statement) is never steered: the page\'s position chooses its step and only a scroll at rest is settled', () => {
  handle.land = false;
  putAt(rests[1]);
  const seen = swipe(20, 20, [40, 30, 20, 10]);
  assert.deepEqual(seen, [440, 470, 490, 500].map((d) => rests[1] + d), 'nothing is put while it moves');
  assert.equal(controller.governs(handle), false);
  frames(30);
  assert.equal(win.scrollY, rests[2], '500 px from rest 1 is nearest to rest 2');
  assert.equal(shown, 2);
  // Less than half a gap goes back; a flick from above is never stopped.
  putAt(rests[1]);
  swipe(20, 10, []);
  frames(30);
  assert.equal(win.scrollY, rests[1]);
  putAt(STORY_TOP - 360);
  assert.deepEqual(swipe(48, 4, [200, 200, 200, 100]), [32, 232, 432, 532].map((d) => STORY_TOP + d));
}, { landed: false });

flowTest('FLOW v2: a tap changes nothing, a picked step (a tab, an arrow) wins over it, and a page caught mid-flight keeps the step it shows', () => {
  putAt(rests[0]);
  tap();
  controller.goTo(handle, 2); // the tap's click picks a step
  frames(30);
  assert.equal(shown, 2);
  assert.equal(win.scrollY, rests[2]);
  // The page has flown on to 400 px past rest 1 while slide 1 is still the one on screen; a finger stops it there.
  putAt(rests[1]);
  win.scrollTo({ top: rests[1] + 400 });
  frame();
  tap();
  frames(30);
  assert.equal(shown, 1, 'what the reader sees is what stays');
  assert.equal(win.scrollY, rests[1], 'and the page is put under it');
});

flowTest('FLOW: the track is never marked, so the browser may pan both ways at every step', () => {
  for (const k of [0, 1, 3]) {
    putAt(rests[k]);
    frames(20);
    assert.deepEqual([...marks], [], `no held mark on rest ${k}`);
  }
});

test('held (a mouse or trackpad device): the same rests are marked, as before', () => {
  placeAt(rests[1]);
  shown = 1;
  frames(20);
  assert.deepEqual([...marks], ['held-mid']);
  placeAt(STORY_TOP - 2000);
  frames(20);
  assert.deepEqual([...marks], []);
});

flowTest('FLOW: a scroll that stops just outside the story is left alone', () => {
  putAt(STORY_TOP - 40);
  swipe(2, 5, []);
  frames(30);
  assert.equal(win.scrollY, STORY_TOP - 30, 'outside the hold: not pulled in');
});

// Where a put page is not known to stay put under a fling (Safari, Firefox): the same one step, shown the same way, but
// nothing is put before the scroll has come to rest.
flowTest('FLOW v2 without a hold: a swipe is still exactly one step; the page is put on its rest only once it has stopped', () => {
  putAt(rests[1]);
  const seen = swipe(20, 4, [200, 200, 150, 100]);
  assert.deepEqual(seen, [280, 480, 630, 730].map((d) => rests[1] + d), 'the momentum runs under the sticky stage, untouched');
  assert.equal(shown, 2, 'one step, though the page is past the next rest');
  assert.equal(controller.governs(handle), true);
  frames(30);
  assert.equal(win.scrollY, rests[2]);
  assert.equal(shown, 2);
  assert.equal(rootStyle.hides, 0);
  // Arriving: the door's step shows, the momentum runs on inside, the settle puts the page on the first rest.
  putAt(STORY_TOP - 360);
  shown = 0;
  const into = swipe(20, 6, [60, 60, 50, 50, 40, 30, 20]);
  assert.deepEqual(into.slice(-3), [STORY_TOP + 20, STORY_TOP + 50, STORY_TOP + 70]);
  frames(30);
  assert.equal(win.scrollY, rests[0]);
  assert.equal(shown, 0);
}, { hold: false });

flowTest('FLOW v2 without a hold: momentum that carries the page out of the story lets it go', () => {
  putAt(rests[2]);
  const seen = swipe(20, 4, [300, 300, 300]);
  assert.deepEqual(seen, [380, 680, 980].map((d) => rests[2] + d));
  assert.equal(shown, 3, 'the story is left on its last step');
  assert.equal(controller.governs(handle), false);
  frames(30);
  assert.equal(win.scrollY, rests[2] + 980, 'and nothing pulls the page back');
}, { hold: false });
