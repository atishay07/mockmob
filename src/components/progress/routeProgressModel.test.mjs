// node --test src/components/progress/routeProgressModel.test.mjs
// The route progress bar (owner, 16 Nov 2026): its timing model (routeProgressModel.mjs), the one bar per page
// (routeProgressBus.mjs), and the pinned parts of its drawing (route-progress.css) and mount (RouteProgress.jsx, the root
// layout). A real browser walk is in tmp/1116-tools/ (the bar seen starting, ending and never sticking on slow 4G).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ROUTE_PROGRESS, createRouteProgress, linkStartsNavigation, pageKey, trickleAt } from './routeProgressModel.mjs';
import { attachRouteProgress, finishRouteProgress, resetRouteProgress, routerHooked, routerTransitionStarted, startRouteProgress, wireRouterProgress } from './routeProgressBus.mjs';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const CSS = read('./route-progress.css');
const BAR = read('./RouteProgress.jsx');
const LAYOUT = read('../../app/layout.js');
const rules = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

// A fake clock: timers fire when the test advances time.
function clock() {
  let now = 0;
  let next = 1;
  const timers = new Map();
  return {
    setTimer: (fn, ms) => { const id = next++; timers.set(id, { fn, at: now + ms }); return id; },
    clearTimer: (id) => { timers.delete(id); },
    advance(ms) {
      const end = now + ms;
      for (;;) {
        const due = [...timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        timers.delete(due[0]);
        now = due[1].at;
        due[1].fn();
      }
      now = end;
    },
    pending: () => timers.size,
  };
}
function bar(params) {
  const c = clock();
  const drawn = [];
  const model = createRouteProgress({ setTimer: c.setTimer, clearTimer: c.clearTimer, render: (p) => drawn.push(p), params });
  return { c, drawn, model };
}

test('a navigation that lands within 120 ms shows nothing at all', () => {
  const { c, drawn, model } = bar();
  model.start();
  c.advance(119);
  model.finish();
  c.advance(1000);
  assert.deepEqual(drawn, []);
  assert.equal(model.phase(), 'idle');
  assert.equal(c.pending(), 0, 'no timer is left behind');
});

test('pending past 120 ms it shows and trickles; on arrival it completes and is gone 200 ms later', () => {
  const { c, drawn, model } = bar();
  model.start();
  c.advance(120);
  assert.deepEqual(drawn, ['run']);
  c.advance(1500);
  model.finish();
  assert.deepEqual(drawn, ['run', 'done']);
  c.advance(199);
  assert.equal(model.phase(), 'done');
  c.advance(1);
  assert.deepEqual(drawn, ['run', 'done', 'idle']);
  assert.equal(c.pending(), 0);
});

test('it can never stay on screen: 10 s after the start it finishes by itself', () => {
  const { c, drawn, model } = bar();
  model.start();
  c.advance(ROUTE_PROGRESS.safetyMs);
  assert.deepEqual(drawn, ['run', 'done']);
  c.advance(ROUTE_PROGRESS.finishMs);
  assert.equal(model.phase(), 'idle');
  assert.equal(ROUTE_PROGRESS.safetyMs, 10000);
  // A shorter stop for a doubtful start.
  const doubt = bar();
  doubt.model.start({ safetyMs: 6000 });
  doubt.c.advance(6000 + ROUTE_PROGRESS.finishMs);
  assert.deepEqual(doubt.drawn, ['run', 'done', 'idle']);
});

test('a second start while one runs keeps the one bar going; a start during the fade begins a fresh bar', () => {
  const { c, drawn, model } = bar();
  model.start();
  c.advance(300);
  model.start();
  c.advance(300);
  assert.deepEqual(drawn, ['run'], 'one bar, not restarted');
  model.finish();
  c.advance(50);
  model.start();
  assert.deepEqual(drawn, ['run', 'done', 'idle'], 'the fading bar is cleared at once');
  c.advance(120);
  assert.deepEqual(drawn, ['run', 'done', 'idle', 'run']);
  model.finish();
  c.advance(200);
  assert.equal(model.phase(), 'idle');
});

test('a doubtful start (a click the page took over) never shows when its check says no; a sure start overrides the doubt', () => {
  const no = bar();
  no.model.start({ confirm: () => false });
  no.c.advance(5000);
  assert.deepEqual(no.drawn, []);
  assert.equal(no.model.phase(), 'idle');
  assert.equal(no.c.pending(), 0, 'its safety stop is cleared too');
  const yes = bar();
  yes.model.start({ confirm: () => false });
  yes.model.start();
  yes.c.advance(120);
  assert.deepEqual(yes.drawn, ['run']);
});

test('reset: back to hidden at once (a page restored from the back-forward cache)', () => {
  const { c, drawn, model } = bar();
  model.start();
  c.advance(500);
  model.reset();
  assert.deepEqual(drawn, ['run', 'idle']);
  assert.equal(c.pending(), 0);
});

test('which clicks start it: same-origin page changes only', () => {
  const here = 'https://www.mockmob.in/pricing?from=nav#plans';
  const plain = { button: 0 };
  const go = (href, link = {}, click = plain) => linkStartsNavigation(click, { href, ...link }, here);
  assert.equal(go('https://www.mockmob.in/signup'), true);
  assert.equal(go('https://www.mockmob.in/pricing'), true, 'the same path with another query is another page');
  assert.equal(go('https://www.mockmob.in/pricing?from=nav#faq'), false, 'a #fragment of this page');
  assert.equal(go('https://www.mockmob.in/pricing?from=nav'), false, 'this page');
  assert.equal(go('https://mockmob.in/signup'), false, 'another origin');
  assert.equal(go('https://www.instagram.com/mockmob'), false);
  assert.equal(go('mailto:hello@mockmob.in'), false);
  assert.equal(go('tel:+910000000000'), false);
  for (const k of ['metaKey', 'ctrlKey', 'shiftKey', 'altKey']) assert.equal(go('https://www.mockmob.in/signup', {}, { button: 0, [k]: true }), false, k);
  assert.equal(go('https://www.mockmob.in/signup', {}, { button: 1 }), false, 'a middle click opens a tab');
  assert.equal(go('https://www.mockmob.in/signup', { target: '_blank' }), false);
  assert.equal(go('https://www.mockmob.in/signup', { target: '_self' }), true);
  assert.equal(go('https://www.mockmob.in/receipt.pdf', { download: true }), false);
  assert.equal(go('https://www.mockmob.in/signup', { optOut: true }), false);
  assert.equal(go('https://www.mockmob.in/signup', { disabled: true }), false);
  assert.equal(go('https://www.mockmob.in/mentor', { popup: true }), false, 'a link that opens a sheet');
  assert.equal(go(''), false);
  assert.equal(pageKey('https://www.mockmob.in/a?b=1#c'), 'https://www.mockmob.in/a?b=1');
});

test('the trickle eases toward 90 % and never claims to be done; the CSS keyframes are this curve', () => {
  assert.ok(Math.abs(trickleAt(0) - ROUTE_PROGRESS.from) < 1e-9);
  assert.ok(trickleAt(1000) > 0.44 && trickleAt(1000) < 0.48, `about 46 % at 1 s (${trickleAt(1000)})`);
  assert.ok(trickleAt(60000) <= ROUTE_PROGRESS.cap);
  assert.equal(ROUTE_PROGRESS.cap, 0.9);
  const css = rules(CSS);
  const body = css.slice(css.indexOf('@keyframes mm-rp-trickle'));
  const frames = [...body.matchAll(/([\d.]+)% \{ transform: scaleX\(([\d.]+)\); \}/g)].slice(0, 11);
  assert.equal(frames.length, 11);
  for (const [, at, s] of frames) {
    const ms = (Number(at) / 100) * ROUTE_PROGRESS.trickleMs;
    assert.ok(Math.abs(Number(s) - trickleAt(ms)) < 0.002, `${at}%: ${s} against ${trickleAt(ms).toFixed(3)}`);
  }
  assert.match(css, new RegExp(`animation: mm-rp-trickle ${ROUTE_PROGRESS.trickleMs}ms linear both;`));
});

test('the drawing: 2 px, fixed, over the bars, no input, ink by theme, transform and opacity only, still under Reduce motion', () => {
  const css = rules(CSS);
  assert.match(css, /\.mm-rp \{[^}]*position: fixed;[^}]*height: 2px;[^}]*pointer-events: none;/);
  assert.match(css, /z-index: 1200;/);
  assert.match(css, /--mm-rp-ink: #17150f;/, 'Day: ink');
  assert.match(css, /html\[data-theme='dark'\] \.mm-rp \{ --mm-rp-ink: #f4f0e6; \}/, 'Night: the Night ink');
  assert.doesNotMatch(css, /d2f000|volt/i, 'never the volt: too pale on Day paper');
  // 120 + 80 = 200 ms from arrival to gone.
  assert.match(css, /transition: transform 120ms cubic-bezier\([^)]*\), opacity 120ms ease-out 80ms;/);
  assert.equal(ROUTE_PROGRESS.finishMs, 200);
  for (const [, props] of css.matchAll(/transition: ([^;]+);/g)) for (const p of props.replace(/\([^)]*\)/g, '').split(',').map((s) => s.trim().split(' ')[0])) assert.ok(['transform', 'opacity', 'none'].includes(p), p);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.mm-rp\[data-phase\] \.mm-rp__bar \{ animation: none; transition: none; \}\s*\.mm-rp\[data-phase='run'\] \.mm-rp__bar \{ transform: scaleX\(1\); \}/);
  assert.match(css, /html\[data-motion='reduced'\] \.mm-rp\[data-phase\] \.mm-rp__bar \{ animation: none; transition: none; \}/);
  assert.match(BAR, /className="mm-rp" data-phase="idle" aria-hidden="true"/);
});

test('mounted once, in the root layout, and finished by the path or the query changing', () => {
  assert.match(LAYOUT, /import RouteProgress from "@\/components\/progress\/RouteProgress";/);
  assert.equal((LAYOUT.match(/<RouteProgress \/>/g) || []).length, 1);
  assert.match(BAR, /const pathname = usePathname\(\);\s*const search = useSearchParams\(\)/);
  assert.match(BAR, /<Suspense fallback=\{null\}>\s*<Arrival \/>/, 'useSearchParams sits in its own Suspense boundary');
  assert.match(BAR, /window\.addEventListener\('click', before, true\);/);
  assert.match(BAR, /window\.addEventListener\('popstate', onPop\);/);
  assert.match(BAR, /if \(event\.persisted\) resetRouteProgress\(\);/);
});

// ---------- the bus ----------
function fakeWindow() {
  const c = clock();
  return { c, w: { setTimeout: c.setTimer, clearTimeout: c.clearTimer, location: { href: 'https://www.mockmob.in/dashboard' } } };
}

test('the bus: a start before the bar mounts plays when it mounts; the router hook marks itself wired', () => {
  const { c, w } = fakeWindow();
  startRouteProgress({}, w);
  const drawn = [];
  const detach = attachRouteProgress((p) => drawn.push(p), { w });
  c.advance(120);
  assert.deepEqual(drawn, ['run']);
  finishRouteProgress(w);
  c.advance(200);
  assert.deepEqual(drawn, ['run', 'done', 'idle']);
  assert.equal(routerHooked(w), false);
  wireRouterProgress(w);
  assert.equal(routerHooked(w), true);
  // The router hook ignores the same page again (a refresh-like replace) and back/forward (the popstate path starts those).
  routerTransitionStarted('/dashboard#plans', 'replace', w);
  routerTransitionStarted('/today', 'traverse', w);
  c.advance(500);
  assert.equal(drawn.at(-1), 'idle', 'nothing started');
  routerTransitionStarted('/today', 'push', w);
  c.advance(120);
  assert.equal(drawn.at(-1), 'run');
  resetRouteProgress(w);
  assert.equal(drawn.at(-1), 'idle');
  detach();
  // Detached: a start is kept for the next bar, and nothing throws.
  startRouteProgress({}, w);
  finishRouteProgress(w);
  assert.equal(w.__mmRouteProgress.queued, null, 'a finish drops a start that never showed');
});
