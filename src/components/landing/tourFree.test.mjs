// node --test src/components/landing/tourFree.test.mjs
// The tour on a touch screen is FREE (16 Nov 2026 night; owner on his phone, of the stack that had replaced the held tour:
// "I think the older one was better"; the brief: nothing moves unless his finger moves). The story controller
// (storyController.mjs) runs here against a stand-in window: a story marked free never has the page put for it (no landing
// when a swipe brings it on, no steering, no settle where the scroll comes to rest), while the same story without `free`
// is landed (the control, so this test can tell the two apart). A picked step (a tab) still puts the page on its rest.
import test from 'node:test';
import assert from 'node:assert/strict';
import { restY } from './storyGesture.mjs';

// ---------------------------------------------------------------- a stand-in window: listeners, frames, timers, puts
const on = { window: new Map(), document: new Map() };
const add = (where) => (type, fn) => { if (!on[where].has(type)) on[where].set(type, new Set()); on[where].get(type).add(fn); };
const remove = (where) => (type, fn) => on[where].get(type)?.delete(fn);
const fire = (where, type, event = {}) => { for (const fn of [...(on[where].get(type) || [])]) fn(event); };
let frames = [];
let timers = [];
let timerId = 0;
const puts = [];
const win = {
  scrollY: 0, innerHeight: 844, innerWidth: 390,
  addEventListener: add('window'), removeEventListener: remove('window'),
  scrollTo: ({ top }) => { puts.push(top); win.scrollY = top; },
  requestAnimationFrame: (fn) => { frames.push(fn); return frames.length; },
  cancelAnimationFrame: () => {},
  setTimeout: (fn) => { timerId += 1; timers.push({ id: timerId, fn }); return timerId; },
  clearTimeout: (id) => { timers = timers.filter((t) => t.id !== id); },
  // A phone: touch-first, coarse pointer, no hover.
  matchMedia: (query) => ({ matches: /coarse|hover: none/.test(query), addEventListener() {}, removeEventListener() {} }),
};
globalThis.window = win;
globalThis.document = { addEventListener: add('document'), removeEventListener: remove('document'), documentElement: { dataset: {}, style: {} }, body: {} };
globalThis.CSS = { supports: () => true };
globalThis.getComputedStyle = () => ({ overflowY: 'visible' });

const flushFrames = () => { for (let i = 0; i < 20 && frames.length; i += 1) { const now = frames; frames = []; for (const fn of now) fn(performance.now()); } };
const flushTimers = () => { for (let i = 0; i < 20 && timers.length; i += 1) { const now = timers; timers = []; for (const t of now) t.fn(); } };
/** The page moves to y (the browser's own scroll, a frame of it). */
const scrollTo = (y) => { win.scrollY = y; fire('window', 'scroll'); flushFrames(); };
const touch = (type, y, t, target) => fire('window', type, { touches: type === 'touchend' ? [] : [{ clientX: 120, clientY: y }], timeStamp: t, target, cancelable: true, preventDefault() {} });

const ctrl = await import('./storyController.mjs');

// The tour: five tools, its track 2,000 px down the page, a 2,000 px hold (track 2,844 less the 844 px stage).
function story({ free }) {
  const state = { step: 0, shown: [] };
  const track = { isConnected: true, offsetHeight: 2844, getBoundingClientRect: () => ({ top: 2000 - win.scrollY }), classList: { add() {}, remove() {} }, contains: () => true };
  const stage = { isConnected: true, offsetHeight: 844, dataset: {}, style: { transform: '', removeProperty() {} } };
  const handle = { id: free ? 'tour' : 'control', root: {}, track, stage, steps: 5, step: () => state.step, show: (k) => { state.step = k; state.shown.push(k); }, reduced: () => false, flow: () => true, land: true, free };
  return { handle, state, track };
}

/** A calm swipe that starts above the story and whose momentum carries the page into its hold (1,500 to 2,150). */
function swipeInFromAbove(track) {
  win.scrollY = 1500;
  let t = 1000;
  touch('touchstart', 600, t, track);
  for (const [y, page] of [[520, 1580], [440, 1660], [360, 1740], [300, 1800]]) { t += 60; touch('touchmove', y, t, track); scrollTo(page); }
  touch('touchend', 300, t + 10, track);
  for (const y of [1880, 1960, 2040, 2100, 2150]) scrollTo(y);
}

test('a story without `free` (the control) is landed: the swipe that brings it on puts the page on its first rest', () => {
  puts.length = 0;
  const { handle, track } = story({ free: false });
  const off = ctrl.register(handle);
  ctrl.near(handle, true);
  swipeInFromAbove(track);
  flushTimers();
  assert.ok(puts.includes(restY(2000, 2000, 5, 0)), `the control was put on its first rest: ${puts.join(', ')}`);
  ctrl.near(handle, false);
  off();
});

test('the free tour is never landed, steered or settled: the page stays wherever the finger and its momentum left it', () => {
  puts.length = 0;
  const { handle, state, track } = story({ free: true });
  const off = ctrl.register(handle);
  ctrl.near(handle, true);
  swipeInFromAbove(track);
  flushTimers(); // every settle the controller asked for has run
  assert.deepEqual(puts, [], 'nothing put the page');
  assert.equal(win.scrollY, 2150, 'the page rests where the momentum stopped, 150 px into the first tool');
  assert.deepEqual(state.shown, [], 'the controller showed no step: the beat under the window shows it (ScrollStory)');
  // A swipe that starts and ends inside the hold: still nothing puts the page.
  let t = 5000;
  touch('touchstart', 600, t, track);
  for (const [y, page] of [[500, 2250], [400, 2350], [320, 2430]]) { t += 70; touch('touchmove', y, t, track); scrollTo(page); }
  touch('touchend', 320, t + 10, track);
  for (const y of [2500, 2560, 2600]) scrollTo(y);
  flushTimers();
  assert.deepEqual(puts, [], 'a swipe inside the tour is the browser\'s own scroll');
  // A tab: the reader picked the fourth tool, so the page goes to its rest and the stage shows it.
  ctrl.goTo(handle, 3);
  assert.deepEqual(puts, [restY(2000, 2000, 5, 3)], 'a pick puts the page on that tool\'s rest');
  assert.equal(state.step, 3);
  assert.equal(handle.stage.dataset.lean, undefined, 'and the stage is not nudged: the tab stays under the finger');
  flushTimers();
  assert.deepEqual(puts, [restY(2000, 2000, 5, 3)], 'the settle after a pick moves nothing more');
  ctrl.near(handle, false);
  off();
});
