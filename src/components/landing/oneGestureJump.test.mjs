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
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
});
const doc = Object.assign(new Listeners(), {
  documentElement: { dataset: {} },
  elements: new Map(),
  getElementById(id) { return doc.elements.get(id) || null; },
});
const MAX_Y = 12000;

globalThis.window = win;
globalThis.document = doc;
globalThis.Element = FakeElement;
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
const stage = new FakeElement({ top: STORY_TOP, height: 844 });
let shown = 0;
const handle = { id: 'story', root: new FakeElement(), track, stage, steps: 4, step: () => shown, show: (n) => { shown = n; }, reduced: () => false };
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
