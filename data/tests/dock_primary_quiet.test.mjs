// W-075 (release 8): on a phone the dock's lime Start key steps back to its quiet look while the page's own lime key is on
// screen, and returns to lime when that key has gone. The logic (src/components/start/pagePrimary.mjs) is driven here with fake
// browser objects, so every case runs in plain Node: the hysteresis, the settle time, the first reading, keys that come and
// go, the band under the top bar and above the dock, and the clean-up. The wiring and the CSS are checked at source level;
// the browser walk (390 px, Night and Day, real wheel events) is in tmp/r8fixes/fix2.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  HIDE_AT, PRIMARY_SELECTOR, SETTLE_MS, SHOW_AT, THRESHOLDS,
  bandMargin, createPrimaryWatch, nextInView, watchPagePrimary,
} from '../../src/components/start/pagePrimary.mjs';

const root = new URL('../../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

// A clock the test moves by hand, in the shape setTimeout and clearTimeout have.
function clock() {
  let now = 0;
  let id = 0;
  let queue = [];
  return {
    setTimeout(fn, ms) { id += 1; queue.push({ id, fn, at: now + ms }); return id; },
    clearTimeout(handle) { queue = queue.filter((t) => t.id !== handle); },
    advance(ms) {
      const end = now + ms;
      for (;;) {
        const due = queue.filter((t) => t.at <= end).sort((a, b) => a.at - b.at)[0];
        if (!due) break;
        queue = queue.filter((t) => t !== due);
        now = due.at;
        due.fn();
      }
      now = end;
    },
    get pending() { return queue.length; },
  };
}

test('the dead band: in view from 30 percent, gone at 10 percent, and unchanged in between', () => {
  assert.equal(SHOW_AT, 0.3, 'a third of the key on screen is enough: two lime keys are never on screen for long');
  assert.equal(HIDE_AT, 0.1, 'it counts as gone only when almost all of it has left');
  assert.ok(HIDE_AT < SHOW_AT);
  assert.equal(nextInView(false, 1), true);
  assert.equal(nextInView(false, SHOW_AT), true);
  assert.equal(nextInView(false, SHOW_AT - 0.01), false, 'not yet in view');
  assert.equal(nextInView(false, 0.2), false);
  assert.equal(nextInView(true, 0.2), true, 'a key leaving stays counted until almost all of it is gone');
  assert.equal(nextInView(true, HIDE_AT + 0.01), true);
  assert.equal(nextInView(true, HIDE_AT), false);
  assert.equal(nextInView(true, 0), false);
  assert.equal(nextInView(true, Number.NaN), true, 'a bad reading changes nothing');
  assert.equal(nextInView(false, undefined), false);
  // Every edge of the band is a threshold, so the observer reports each crossing.
  assert.ok(THRESHOLDS.includes(SHOW_AT) && THRESHOLDS.includes(HIDE_AT) && THRESHOLDS.includes(0) && THRESHOLDS.includes(1));
});

test('the band is what a student sees: under the top bar and above the dock', () => {
  assert.equal(bandMargin({ topEdge: 63, dockTop: 768, viewportHeight: 844 }), '-63px 0px -76px 0px');
  assert.equal(bandMargin({ topEdge: 62.6, dockTop: 767.4, viewportHeight: 844 }), '-63px 0px -77px 0px', 'whole pixels');
  assert.equal(bandMargin({ topEdge: 0, dockTop: null, viewportHeight: 900 }), '-0px 0px -0px 0px', 'no dock drawn (from 1024 px)');
  assert.equal(bandMargin({ topEdge: -5, dockTop: 900, viewportHeight: 844 }), '-0px 0px -0px 0px', 'never a negative band');
  assert.equal(bandMargin(), '-0px 0px -0px 0px');
});

test('the first reading is applied at once: a page that opens with its key on screen never shows two lime keys', () => {
  const t = clock();
  const seen = [];
  const watch = createPrimaryWatch({ onChange: (v) => seen.push(v), setTimer: t.setTimeout, clearTimer: t.clearTimeout });
  const key = {};
  watch.report(key, 0.95);
  assert.deepEqual(seen, [true], 'quiet at once, no settle time');
  assert.equal(t.pending, 0);
  assert.equal(watch.quiet, true);
});

test('a key leaving the screen brings the lime key back, after the settle time and not before', () => {
  const t = clock();
  const seen = [];
  const watch = createPrimaryWatch({ onChange: (v) => seen.push(v), setTimer: t.setTimeout, clearTimer: t.clearTimeout });
  const key = {};
  watch.report(key, 1);
  watch.report(key, 0);
  assert.deepEqual(seen, [true], 'nothing yet');
  t.advance(SETTLE_MS - 1);
  assert.deepEqual(seen, [true], 'still settling');
  t.advance(1);
  assert.deepEqual(seen, [true, false], 'lime again once it has been gone for the settle time');
  // And coming back into view is settled the same way.
  watch.report(key, 0.9);
  assert.deepEqual(seen, [true, false]);
  t.advance(SETTLE_MS);
  assert.deepEqual(seen, [true, false, true]);
});

test('a fast flick past the key changes nothing: a move that reverses inside the settle time is dropped', () => {
  const t = clock();
  const seen = [];
  const watch = createPrimaryWatch({ onChange: (v) => seen.push(v), setTimer: t.setTimeout, clearTimer: t.clearTimeout });
  const key = {};
  watch.report(key, 1); // quiet, first reading
  watch.report(key, 0);
  t.advance(SETTLE_MS - 40);
  watch.report(key, 0.8); // back in view before the lime key came back
  assert.equal(t.pending, 0, 'the waiting change was dropped');
  t.advance(SETTLE_MS * 4);
  assert.deepEqual(seen, [true], 'the dock key never flickered');
  // The other direction: lime, a key crosses the band in less than the settle time.
  watch.report(key, 0);
  t.advance(SETTLE_MS);
  assert.deepEqual(seen, [true, false]);
  watch.report(key, 0.7);
  t.advance(60);
  watch.report(key, 0);
  t.advance(SETTLE_MS * 4);
  assert.deepEqual(seen, [true, false], 'a key that was in view for 60 ms did not quiet the dock key');
});

test('a key resting on an edge cannot flip the dock key: between 10 and 30 percent nothing changes', () => {
  const t = clock();
  const seen = [];
  const watch = createPrimaryWatch({ onChange: (v) => seen.push(v), setTimer: t.setTimeout, clearTimer: t.clearTimeout });
  const key = {};
  watch.report(key, 0.9);
  for (const ratio of [0.2, 0.15, 0.29, 0.11, 0.25, 0.12, 0.28]) { watch.report(key, ratio); t.advance(SETTLE_MS * 2); }
  assert.deepEqual(seen, [true], 'in view, then only readings inside the dead band');
  watch.report(key, 0.05);
  t.advance(SETTLE_MS);
  assert.deepEqual(seen, [true, false]);
  for (const ratio of [0.12, 0.2, 0.29, 0.15, 0.25]) { watch.report(key, ratio); t.advance(SETTLE_MS * 2); }
  assert.deepEqual(seen, [true, false], 'lime, then only readings inside the dead band');
});

test('with several keys the best one decides: one leaving while another arrives keeps the dock key quiet', () => {
  const t = clock();
  const seen = [];
  const watch = createPrimaryWatch({ onChange: (v) => seen.push(v), setTimer: t.setTimeout, clearTimer: t.clearTimeout });
  const a = {};
  const b = {};
  watch.report(a, 0.9);
  watch.report(b, 0);
  watch.report(a, 0.1);
  watch.report(b, 0.8);
  t.advance(SETTLE_MS * 2);
  assert.deepEqual(seen, [true]);
  watch.report(b, 0);
  t.advance(SETTLE_MS);
  assert.deepEqual(seen, [true, false], 'lime when no key is left in view');
});

test('a key removed from the page stops counting, and the swap of one key for another inside a frame changes nothing', () => {
  const t = clock();
  const seen = [];
  const watch = createPrimaryWatch({ onChange: (v) => seen.push(v), setTimer: t.setTimeout, clearTimer: t.clearTimeout });
  const old = {};
  const next = {};
  watch.report(old, 1);
  watch.forget(old);
  watch.report(next, 1); // a chapter was opened: one key replaced by the next, in the same frame
  t.advance(SETTLE_MS * 3);
  assert.deepEqual(seen, [true]);
  watch.forget(next);
  t.advance(SETTLE_MS);
  assert.deepEqual(seen, [true, false], 'the last key left the page: lime again');
  watch.forget({}); // an element it never saw is ignored
});

test('dispose puts the dock key back to lime and stops listening', () => {
  const t = clock();
  const seen = [];
  const watch = createPrimaryWatch({ onChange: (v) => seen.push(v), setTimer: t.setTimeout, clearTimer: t.clearTimeout });
  const key = {};
  watch.report(key, 1);
  watch.report(key, 0);
  watch.dispose();
  assert.deepEqual(seen, [true, false], 'lime at once');
  assert.equal(t.pending, 0, 'the waiting change is cancelled');
  watch.report(key, 1);
  t.advance(SETTLE_MS * 3);
  assert.deepEqual(seen, [true, false], 'nothing after dispose');
});

// ---------------------------------------------------------------------------------------------------------------------
// The browser glue, driven with fake observers.
// ---------------------------------------------------------------------------------------------------------------------

function shell({ bar = 63, dockTop = 768, dockHeight = 64, height = 844 } = {}) {
  const t = clock();
  const frames = [];
  const listeners = new Map();
  const made = [];
  class IO {
    constructor(callback, options) { this.callback = callback; this.options = options; this.targets = new Set(); this.closed = false; made.push(this); }
    observe(el) { this.targets.add(el); }
    unobserve(el) { this.targets.delete(el); }
    disconnect() { this.targets.clear(); this.closed = true; }
    see(el, ratio) { this.callback([{ target: el, isIntersecting: ratio > 0, intersectionRatio: ratio }]); }
  }
  const mutation = { observed: null, disconnected: false, callback: null };
  class MO {
    constructor(callback) { mutation.callback = callback; }
    observe(node, options) { mutation.observed = { node, options }; }
    disconnect() { mutation.disconnected = true; }
  }
  // The top bar rests 143 px down here (the preview's note sits above it) but sticks at the top, 63 px tall.
  const geometry = { bar, barTop: 143, barPosition: 'sticky', dockTop, dockHeight };
  const win = {
    innerHeight: height,
    addEventListener: (type, fn) => listeners.set(type, fn),
    removeEventListener: (type) => listeners.delete(type),
  };
  const doc = {
    querySelector(selector) {
      if (selector === '.arena-topbar') return { getBoundingClientRect: () => ({ top: geometry.barTop, bottom: geometry.barTop + geometry.bar, height: geometry.bar }) };
      if (selector === '.arena-dock') return { getBoundingClientRect: () => ({ top: geometry.dockTop, height: geometry.dockHeight }) };
      return null;
    },
  };
  const keys = [];
  const main = { querySelectorAll: (selector) => { main.asked = selector; return [...keys]; } };
  const env = {
    window: win, document: doc, IntersectionObserver: IO, MutationObserver: MO,
    getComputedStyle: () => ({ position: geometry.barPosition, top: '0px' }),
    requestAnimationFrame: (fn) => { frames.push(fn); return frames.length; },
    cancelAnimationFrame: () => {},
    setTimeout: t.setTimeout, clearTimeout: t.clearTimeout,
  };
  const flush = () => { while (frames.length) frames.shift()(); };
  return { env, main, keys, made, mutation, listeners, geometry, t, flush, io: () => made[made.length - 1] };
}

test('the glue watches the marked keys inside the band, and reports through onChange', () => {
  const s = shell();
  const key = { id: 'move' };
  s.keys.push(key);
  const seen = [];
  const stop = watchPagePrimary(s.main, { onChange: (v) => seen.push(v), env: s.env });
  assert.equal(s.main.asked, PRIMARY_SELECTOR, 'it asks for both marks');
  assert.match(PRIMARY_SELECTOR, /data-page-primary/);
  assert.match(PRIMARY_SELECTOR, /data-phone-primary/);
  assert.equal(s.made.length, 1);
  assert.equal(s.io().options.rootMargin, '-63px 0px -76px 0px', 'the band between the top bar and the dock');
  assert.deepEqual(s.io().options.threshold, [...THRESHOLDS]);
  assert.ok(s.io().targets.has(key));
  assert.deepEqual(s.mutation.observed.options, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-page-primary', 'data-phone-primary'] });
  s.io().see(key, 0.92);
  assert.deepEqual(seen, [true]);
  s.io().see(key, 0);
  s.t.advance(SETTLE_MS);
  assert.deepEqual(seen, [true, false]);
  stop();
});

test('the band starts where the top bar sticks, not where it rests: a note above it moves nothing', () => {
  const stuck = shell();
  stuck.keys.push({});
  const a = watchPagePrimary(stuck.main, { onChange() {}, env: stuck.env });
  assert.equal(stuck.io().options.rootMargin, '-63px 0px -76px 0px', 'the bar sticks at 0 and is 63 px tall, wherever it rests at the top of the page');
  a();
  // A top bar that is not sticky scrolls away with the page and hides nothing.
  const loose = shell();
  loose.geometry.barPosition = 'static';
  loose.keys.push({});
  const b = watchPagePrimary(loose.main, { onChange() {}, env: loose.env });
  assert.equal(loose.io().options.rootMargin, '-0px 0px -76px 0px');
  b();
  // No top bar at all (a public page): the band starts at the top.
  const none = shell();
  const find = none.env.document.querySelector;
  none.env.document.querySelector = (selector) => (selector === '.arena-topbar' ? null : find(selector));
  none.keys.push({});
  const c = watchPagePrimary(none.main, { onChange() {}, env: none.env });
  assert.equal(none.io().options.rootMargin, '-0px 0px -76px 0px');
  c();
});

test('a key that appears later is observed, one that goes is dropped, and a swap inside a frame does not blink', () => {
  const s = shell();
  const seen = [];
  const stop = watchPagePrimary(s.main, { onChange: (v) => seen.push(v), env: s.env });
  assert.equal(s.io().targets.size, 0, 'a loading page has no key yet: the dock key stays lime');
  const first = { id: 'first' };
  s.keys.push(first);
  s.mutation.callback([]);
  s.flush();
  assert.ok(s.io().targets.has(first));
  s.io().see(first, 1);
  assert.deepEqual(seen, [true]);
  // Another chapter opened: the old key goes and the new one arrives in the same batch.
  const second = { id: 'second' };
  s.keys.splice(0, 1, second);
  s.mutation.callback([]);
  s.flush();
  assert.ok(!s.io().targets.has(first) && s.io().targets.has(second));
  s.io().see(second, 1);
  s.t.advance(SETTLE_MS * 3);
  assert.deepEqual(seen, [true], 'never lime in between');
  // A late reading for the key that is gone is ignored.
  s.io().see(first, 0);
  s.t.advance(SETTLE_MS * 3);
  assert.deepEqual(seen, [true]);
  stop();
});

test('the observer is rebuilt only when the band really moved', () => {
  const s = shell();
  const key = { id: 'k' };
  s.keys.push(key);
  const seen = [];
  const stop = watchPagePrimary(s.main, { onChange: (v) => seen.push(v), env: s.env });
  const first = s.io();
  // The address bar slides: a resize event, the same band.
  s.listeners.get('resize')();
  s.flush();
  assert.equal(s.made.length, 1, 'the same band keeps the same observer');
  // A rotation: a different viewport and dock position.
  s.geometry.dockTop = 330;
  s.env.window.innerHeight = 400;
  s.listeners.get('resize')();
  s.flush();
  assert.equal(s.made.length, 2);
  assert.ok(first.closed, 'the old observer is disconnected');
  assert.equal(s.io().options.rootMargin, '-63px 0px -70px 0px');
  assert.ok(s.io().targets.has(key), 'the key is observed again');
  stop();
});

test('stopping disconnects everything and leaves the dock key lime', () => {
  const s = shell();
  const key = { id: 'k' };
  s.keys.push(key);
  const seen = [];
  const stop = watchPagePrimary(s.main, { onChange: (v) => seen.push(v), env: s.env });
  s.io().see(key, 1);
  stop();
  assert.deepEqual(seen, [true, false]);
  assert.ok(s.io().closed);
  assert.equal(s.mutation.disconnected, true);
  assert.equal(s.listeners.has('resize'), false);
  // Late callbacks after the stop do nothing.
  s.io().see(key, 1);
  s.mutation.callback([]);
  s.flush();
  s.t.advance(SETTLE_MS * 3);
  assert.deepEqual(seen, [true, false]);
});

test('without IntersectionObserver the dock key simply stays lime', () => {
  const s = shell();
  delete s.env.IntersectionObserver;
  const seen = [];
  const stop = watchPagePrimary(s.main, { onChange: (v) => seen.push(v), env: { ...s.env, window: { ...s.env.window }, IntersectionObserver: undefined } });
  assert.equal(typeof stop, 'function');
  stop();
  assert.deepEqual(seen, []);
  assert.equal(typeof watchPagePrimary(null, { onChange() {}, env: s.env }), 'function');
});

// ---------------------------------------------------------------------------------------------------------------------
// The wiring and the look, at source level.
// ---------------------------------------------------------------------------------------------------------------------

test('the shell watches the keys on every signed-in page and feeds the dock key through its store', () => {
  const layout = read('src/app/(app)/AppLayoutClient.jsx');
  assert.match(layout, /import \{ watchPagePrimary \} from '@\/components\/start\/pagePrimary\.mjs'/);
  assert.match(layout, /import \{ setStartQuiet \} from '@\/components\/start\/startQuietStore'/);
  const at = layout.indexOf('watchPagePrimary(main');
  assert.ok(at > 0, 'the shell starts the watch');
  const effect = layout.slice(layout.lastIndexOf('useEffect(', at), layout.indexOf('\n  }, [', at) + 40);
  assert.match(effect, /document\.getElementById\('app-main'\)/);
  assert.match(effect, /onChange: setStartQuiet/);
  assert.match(effect, /return \(\) => \{[\s\S]*stop\(\)[\s\S]*setStartQuiet\(false\)/, 'the clean-up stops the watch and puts the key back to lime');
  assert.match(effect, /\[activePath, status, isTestRoute\]/, 'rebuilt for every page, never on the timed runner');
  // The desktop sidebar rule is unchanged: it still reads data-page-primary and data-owns-start only.
  assert.match(layout, /main\.querySelector\('\[data-page-primary\], \[data-owns-start\]'\)/);
});

test('the dock key draws data-quiet from the store, and only the dock key does', () => {
  const key = read('src/components/start/StartKey.jsx');
  assert.match(key, /import \{ useStartQuiet \} from '\.\/startQuietStore'/);
  assert.match(key, /const quiet = useStartQuiet\(\)/);
  assert.match(key, /data-quiet=\{variant === 'bar' && quiet \? '' : undefined\}/);
  const store = read('src/components/start/startQuietStore.js');
  assert.match(store, /useSyncExternalStore\(subscribe, startQuiet, \(\) => false\)/, 'the server render is lime');
});

test('quiet keeps the key where it is, as big as it is, and draws it without the lime fill', () => {
  const css = stripComments(read('src/components/start/start.css'));
  const phone = css.slice(css.indexOf('@media (max-width: 1023px)'), css.indexOf('/* Wide screens'));
  const quiet = [...phone.matchAll(/([^{}]*\.stk--bar\[data-quiet\][^{}]*)\{([^{}]*)\}/g)];
  assert.ok(quiet.length >= 2, 'the key and its play mark both have a quiet rule');
  const body = quiet.map((m) => m[2]).join('\n');
  assert.doesNotMatch(body, /var\(--volt\)|#d2f000|#dcfa1e/i, 'no lime fill in the quiet look');
  assert.doesNotMatch(body, /\b(width|height|padding|margin|top|left|position|display|grid-template|border-radius)\s*:/, 'quiet changes the colours only: same shape, same place, same 64 px target');
  assert.match(body, /background:\s*var\(--dock-glass\)/, 'the capsule glass, so the page never reads through the key');
  assert.match(body, /color:\s*var\(--a-ink\)/);
  assert.match(quiet.map((m) => m[1]).join('\n'), /\.stk__disc/);
  assert.match(body, /color:\s*var\(--a-accent-text\)/, 'the play mark keeps the accent');
  // Reduced motion: the swap is instant, in both ways the app asks for it.
  assert.match(phone, /html\[data-motion='reduced'\] \.app-shell \.arena-dock > \.stk--bar\s*\{[^}]*transition:\s*none/);
  assert.match(phone, /@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*\.arena-dock > \.stk--bar\s*\{[^}]*transition:\s*none/);
});

test('the quiet rule is the dock key’s only page-dependent look, and it is not keyed on the old scroll rules (F12)', () => {
  const css = read('src/components/start/start.css');
  assert.equal(/data-primary-shown|pr-dock\[data-shown\]|data-cta-shown/.test(css), false, 'the F12 selectors stay gone');
  const dockRules = css.split('}').filter((rule) => rule.includes('stk--bar'));
  for (const rule of dockRules) assert.doesNotMatch(rule, /:has\(|student-page--result|aria-expanded/, `no page-state selector on the dock key: ${rule.trim().slice(0, 100)}`);
  const page = read('src/app/(app)/dashboard/DashboardPageClient.jsx');
  assert.equal(/IntersectionObserver|addEventListener\('scroll'/.test(page), false, 'Practice still has no scroll script of its own (F12)');
});

test('the phone-only lime keys carry data-phone-primary, so they quiet the dock key and never the desktop sidebar', () => {
  const practice = read('src/app/(app)/dashboard/DashboardPageClient.jsx');
  assert.match(practice, /data-page-primary=\{short \? undefined : ''\} data-phone-primary=\{short \? '' : undefined\}/, 'the session bar key (phones) is marked; the card key (desktop) keeps data-page-primary');
  const calculator = read('src/components/du/CutoffCalculator.jsx');
  assert.match(calculator, /<button type="button" data-primary data-phone-primary onClick=\{\(\) => goTo\(resultsRef\)\}>View courses<\/button>/);
  // The summary bar is hidden from 1100 px, which is exactly why it must not use data-page-primary.
  assert.match(stripComments(read('src/components/du/du.css')), /@media \(min-width: 1100px\)\s*\{\s*\.du-sum\s*\{\s*display: none;/);
});

test('every page that owns a lime key marks it, so the dock key can step back', () => {
  const marked = {
    'src/components/today/TodayMove.jsx': /data-page-primary/,
    'src/components/review/ReviewChapters.jsx': /data-page-primary=""/,
    'src/components/review/ReviewNextMove.jsx': /data-page-primary=""/,
    'src/components/result/NextMove.jsx': /'data-page-primary': ''/,
    'src/app/(app)/leaderboard/LeaderboardPageClient.jsx': /className="lb-go" data-page-primary=""/,
    'src/components/mob/MobPage.jsx': /data-page-primary/,
    'src/components/study/StudyLibrary.jsx': /data-page-primary=""/,
    'src/components/study/LessonOverview.jsx': /data-page-primary=""/,
  };
  for (const [file, pattern] of Object.entries(marked)) assert.match(read(file), pattern, `${file} marks its lime key`);
});
