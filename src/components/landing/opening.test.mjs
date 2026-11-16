// node --test src/components/landing/opening.test.mjs
// The home page's opening, "answer sheet rain" (LK74; LK299, 17 Nov 2026: "grand ... with even some animation falling
// through it ... merge it into the MockMob logo at the top and animate the logo a little bit"): OpeningMo.jsx, opening.css,
// its run gate (openingGate.mjs) and the logo's parts (logoLetters.mjs, generated). Source-level and pure; the frames,
// the landing on the bar logo, LCP and CLS are measured in a real browser (wt-1117-opening/tmp/cap.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LOGO_B_LETTERS, LOGO_B_MOBI, LOGO_B_VIEWBOX } from '../brand/logoB.js';
import { LOGO_DOT, LOGO_LETTER_PARTS, LOGO_LETTER_X, LOGO_MO, LOGO_MOBI_INDEX, LOGO_MOBI_PARTS, LOGO_OPEN_BOX, LOGO_OPEN_VIEWBOX, LOGO_WORD } from '../brand/logoLetters.mjs';
import { OPENING_FIRST_MS, OPENING_FLIP_MS, OPENING_HAND_MS, OPENING_KEYS, OPENING_LATE, OPENING_SETTLE_MS, OPENING_SHORT_MS, OPENING_SKIP_EVENTS, OPENING_LATE_MS, OPENING_WAIT_MS, openingGate, openingGateScript } from './openingGate.mjs';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const CSS = read('../../app/opening.css');
const OPENING = read('./OpeningMo.jsx');
const LOGO = read('../Logo.jsx');
const rules = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

// ---------- the letters (logoLetters.mjs) ----------

test('the letters rebuild logo B byte for byte, in order, and each sits in its own pen box', () => {
  assert.equal(LOGO_WORD, 'mockmob');
  assert.equal(LOGO_MOBI_INDEX, 5);
  assert.deepEqual([...LOGO_LETTER_X], [0, 865, 1445, 1968, 2549, 3423.22, 3987.35], 'logo_geometry.g.dart letterX');
  assert.deepEqual(LOGO_LETTER_PARTS.map((l) => l.char).join(''), 'mockmb');
  assert.equal(LOGO_LETTER_PARTS.map((l) => l.d).join(''), LOGO_B_LETTERS.match(/M[^M]*/g).map((s) => s.trim()).join(''));
  // Ink boxes in word units = logo_geometry.g.dart bounds shifted by each letter's pen x.
  const dart = { 0: [40, 820], 1: [885, 1407], 2: [1465, 1953], 3: [2008, 2555], 4: [2589, 3369], 6: [4027.35, 4544.35] };
  for (const l of LOGO_LETTER_PARTS) assert.deepEqual([l.ink[0], l.ink[2]], dart[l.index], `${l.char} (${l.index}) ink`);
  assert.deepEqual([LOGO_MOBI_PARTS.ink[0], LOGO_MOBI_PARTS.ink[2]], [3423.21, 3968.1], 'Mobi ink ends at the dart moRight 3968.1');
  assert.deepEqual(LOGO_MO.ink.slice(0, 1).concat(LOGO_MO.ink.slice(2, 3)), [2589, 3968.1], 'the "mo" is moLeft..moRight');
  // The right eye: the full master's empty bubble (outer plus hole) and its outer oval alone for the ink.
  assert.ok(LOGO_B_MOBI.full.eyes.includes(LOGO_MOBI_PARTS.eyeRightInked));
  assert.ok(LOGO_B_MOBI.full.eyes.endsWith(LOGO_MOBI_PARTS.eyeRightRing));
});

test('decision 1, kept: the opening box is Logo.jsx\'s box, and the bar logo keeps its own volt dot, which drops in after the landing', () => {
  const [x, y, w, h] = LOGO_B_VIEWBOX.split(' ').map(Number);
  assert.equal(Number(LOGO.match(/const DOT_R = (\d+);/)[1]), LOGO_DOT.r);
  assert.equal(Number(LOGO.match(/const DOT_GAP = (\d+);/)[1]), LOGO_DOT.gap);
  assert.equal(LOGO_DOT.cx, Math.round((x + w + LOGO_DOT.gap + LOGO_DOT.r) * 100) / 100);
  assert.equal(LOGO_DOT.cy, -LOGO_DOT.r);
  assert.equal(LOGO_OPEN_VIEWBOX, `${x} ${y} ${Math.round((w + LOGO_DOT.gap + LOGO_DOT.r * 2) * 100) / 100} ${h}`, 'the opening box is Logo.jsx\'s VIEWBOX');
  assert.deepEqual([LOGO_OPEN_BOX.x, LOGO_OPEN_BOX.y, LOGO_OPEN_BOX.h], [x, y, h]);
  // 17 Nov 2026: the opening draws no dot of its own; the bar logo's dot drops in as the last bubble once the word has landed.
  assert.match(rules(CSS), /html\[data-opening='done'\]\[data-opening-flip\] \.mm-nav \.logo-b__dot \{ animation: mo-settle-dot 300ms /);
  // In the bar logo (LogoMark, which the site bar draws).
  assert.match(LOGO, /<circle className="dot logo-b__dot" cx=\{DOT_CX\} cy=\{DOT_CY\} r=\{DOT_R\}/);
});

// ---------- the timings (L-043 as of LK299) ----------

test('LK299: a first visit lands at 1,200 ms and is still by 1,500; a session lands at 800 and is still by 1,100', () => {
  assert.equal(OPENING_FIRST_MS, 1200);
  assert.equal(OPENING_SHORT_MS, 800);
  assert.deepEqual({ ...OPENING_FLIP_MS }, { first: 500, short: 380 });
  assert.equal(OPENING_HAND_MS, 280);
  assert.equal(OPENING_SETTLE_MS, 300);
  assert.ok(OPENING_FIRST_MS + OPENING_SETTLE_MS <= 1500 && OPENING_SHORT_MS + OPENING_SETTLE_MS <= 1100);
  assert.deepEqual({ ...OPENING_KEYS }, { ever: 'mm:opened:v2', session: 'mm:opening:v2' }, 'v2: the new first visit is seen once');
  const css = rules(CSS);
  assert.match(css, /--mo-end: 1200ms;\s*--mo-flip: 500ms;/);
  assert.match(css, /html\[data-opening='short'\] \.mo-open \{ --mo-end: 800ms; --mo-flip: 380ms; --mo-pace: 0\.62; \}/);
  assert.match(css, /--mo-w: min\(88vw, 960px\);/, 'grand on every screen');
});

test('the ground is the page\'s own (paper in Day, charcoal in Night), so the word lands as the bar logo with no dark flash', () => {
  const css = rules(CSS);
  assert.match(css, /\.mo-open__ground \{[^}]*background: var\(--paper, #12110e\);/);
  assert.match(css, /\.mo-word \{[^}]*color: var\(--ink, #f4f0e6\);/);
  assert.match(OPENING, /<path fill="currentColor" d=\{LOGO_B_LETTERS\} \/>/, 'the letters take the page\'s ink');
  assert.doesNotMatch(css, /mo-word-fade/, 'no faked cross-fade in Day');
  assert.match(css, /html\[data-opening-flip\] \.mo-open__ground \{ animation: mo-curtain var\(--mo-flip\) cubic-bezier\(0\.7, 0, 0\.2, 1\) var\(--mo-flip-delay, 0ms\) forwards; \}/, 'the sheet rises like a curtain');
  assert.match(css, /html\[data-opening-flip\] \.mo-word \{ animation: mo-word-flip var\(--mo-flip\) cubic-bezier\(0\.32, 0\.72, 0, 1\) var\(--mo-flip-delay, 0ms\) forwards; \}/);
});

test('something falls through it: answer bubbles, rows and question tiles at three depths, more on a wide screen', () => {
  assert.match(OPENING, /const PIECES = \[/);
  for (const kind of ['ring', 'ink', 'dark', 'row', 'tile']) assert.match(OPENING, new RegExp(`${kind}: \\{\\s*box:`), kind);
  const css = rules(CSS);
  assert.match(css, /animation: mo-fall calc\(var\(--dur\) \* var\(--mo-pace\)\) cubic-bezier\(0\.55, 0, 1, 0\.45\) calc\(var\(--at\) \* var\(--mo-pace\)\) forwards;/);
  assert.match(css, /\.mo-p--wide \{ display: none; \}/);
  assert.match(css, /\.mo-p \{ width: calc\(var\(--s\) \* 1\.5px\); \}\s*\.mo-p--wide \{ display: block; \}/);
  // A first visit: one bubble drops into Mobi's empty bubble eye and inks it; a session: he blinks instead.
  assert.match(css, /\.mo-drop \{[^}]*animation: mo-drop 360ms [^;]* 140ms both;/);
  assert.match(css, /mo-ink 200ms cubic-bezier\(0\.23, 1, 0\.32, 1\) 500ms both/);
  assert.match(css, /html\[data-opening='short'\] \.mo-drop \{ display: none; \}/);
});

test('only transform, opacity and the end state animate; nothing loops; the layer never takes a tap', () => {
  const css = rules(CSS);
  for (const [, name, body] of css.matchAll(/@keyframes ([\w-]+) \{([^@]*?)\}\s*(?=@keyframes|\.|html|$|@media)/g)) {
    const props = [...body.matchAll(/([a-z-]+):/g)].map((m) => m[1]);
    for (const p of props) assert.ok(['transform', 'opacity', 'visibility', 'pointer-events'].includes(p), `${name} animates ${p}`);
  }
  assert.doesNotMatch(css, /infinite/);
  assert.match(css, /html\[data-opening='first'\] \.mo-open,\s*html\[data-opening='short'\] \.mo-open \{[^}]*pointer-events: none;/);
  assert.match(css, /animation: mo-gone 1ms linear var\(--mo-end\) forwards;/, 'it ends hidden by itself, even if JS fails');
  assert.doesNotMatch(OPENING, /<img|<text|<image/, 'no text and no image: it can never be the largest paint');
  assert.match(OPENING, /<div className="mo-open" aria-hidden="true"/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.mo-open \{ display: none !important; \}/);
  assert.match(css, /html\[data-motion='reduced'\] \.mo-open \{ display: none !important; \}/);
});

// ---------- the gate (openingGate.mjs) ----------

function fakeEnv({ session = null, local = null, cookie = '', referrer = '', hash = '', scrollY = 0, motion = null, reduce = false, webdriver = false, ua = 'Mozilla/5.0 Chrome/150', appView = false, storageThrows = false, navType = 'navigate', paintTiming = false, anims = null } = {}) {
  const attrs = {};
  if (motion) attrs['data-motion'] = motion;
  if (appView) attrs['data-app-view'] = '1';
  const html = {
    style: { setProperty() {} },
    getAttribute: (k) => (k in attrs ? attrs[k] : null),
    setAttribute: (k, v) => { attrs[k] = String(v); },
    removeAttribute: (k) => { delete attrs[k]; },
    hasAttribute: (k) => k in attrs,
  };
  // A controllable clock and, with paintTiming, a PerformanceObserver whose paint report the test delivers by hand.
  const clock = { now: 0 };
  const observers = [];
  const store = (init) => {
    const m = new Map(Object.entries(init || {}));
    return { getItem: (k) => { if (storageThrows) throw new Error('blocked'); return m.has(k) ? m.get(k) : null; }, setItem: (k, v) => { if (storageThrows) throw new Error('blocked'); m.set(k, v); }, m };
  };
  const listeners = {};
  const timers = [];
  const layerAttrs = {};
  const layer = { setAttribute: (k, v) => { layerAttrs[k] = v; }, style: { setProperty() {} }, querySelector: () => null, ...(anims ? { getAnimations: () => anims } : {}) };
  const w = {
    navigator: { webdriver, userAgent: ua },
    matchMedia: () => ({ matches: reduce }),
    location: { hash, host: 'www.mockmob.in' },
    scrollY,
    performance: { now: () => clock.now, getEntriesByType: () => [{ type: navType }] },
    sessionStorage: store(session),
    localStorage: store(local),
    setTimeout: (fn, delay) => { timers.push({ fn, delay }); return timers.length; },
    clearTimeout: (id) => { if (timers[id - 1]) timers[id - 1].cleared = true; },
    requestAnimationFrame: () => 0,
    addEventListener: (t, fn) => { listeners[t] = fn; },
    removeEventListener: (t) => { delete listeners[t]; },
    dispatchEvent: () => true,
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } },
  };
  const d = { documentElement: html, cookie, referrer, querySelector: (sel) => (sel === '.mo-open' ? layer : null) };
  if (paintTiming) {
    w.PerformanceObserver = class {
      constructor(cb) { this.cb = cb; this.on = false; observers.push(this); }
      observe(opts) { this.opts = opts; this.on = true; }
      disconnect() { this.on = false; }
    };
    w.PerformanceObserver.supportedEntryTypes = ['paint', 'largest-contentful-paint'];
  }
  // The browser reports the first contentful paint at `at` (ms), and this callback runs at clock.now.
  const paint = (at) => observers.filter((o) => o.on).forEach((o) => o.cb({ getEntriesByName: (n) => (n === 'first-contentful-paint' ? [{ name: n, startTime: at }] : []) }));
  return { w, d, attrs, listeners, timers, layerAttrs, clock, observers, paint };
}
const cfg = { first: OPENING_FIRST_MS, short: OPENING_SHORT_MS, flip: { ...OPENING_FLIP_MS }, hand: OPENING_HAND_MS, settle: OPENING_SETTLE_MS, ever: OPENING_KEYS.ever, session: OPENING_KEYS.session, events: [...OPENING_SKIP_EVENTS], late: { ...OPENING_LATE }, wait: OPENING_WAIT_MS, out: OPENING_LATE_MS };
const run = (opts) => { const env = fakeEnv(opts); const mode = openingGate(env.w, env.d, cfg); return { mode, ...env }; };
const SESSION = { [OPENING_KEYS.ever]: '1' };
const liveDelays = (r) => r.timers.filter((t) => !t.cleared).map((t) => t.delay);

test('the gate: first ever, then short once per session, then skip; never twice in a session', () => {
  const first = run();
  assert.equal(first.mode, 'first');
  assert.equal(first.w.localStorage.m.get(OPENING_KEYS.ever), '1');
  assert.equal(first.w.sessionStorage.m.get(OPENING_KEYS.session), '1');
  assert.deepEqual([first.w.__mmOpening.hand, first.w.__mmOpening.end], [700, 1200]);
  const short = run({ local: SESSION });
  assert.equal(short.mode, 'short');
  assert.deepEqual([short.w.__mmOpening.hand, short.w.__mmOpening.end], [420, 800]);
  assert.ok(liveDelays(short).includes(420) && liveDelays(short).includes(840), `hand-off at 420, done just after 800 (${liveDelays(short)})`);
  assert.equal(run({ local: SESSION, session: { [OPENING_KEYS.session]: '1' } }).mode, 'skip', 'a reload in the same session');
  assert.equal(run({ storageThrows: true }).mode, 'skip');
});

test('the gate: always skip for reduced motion, deep entries, coming back from inside the site, a signed-in student and bots', () => {
  const skip = (why, opts) => { const r = run(opts); assert.equal(r.mode, 'skip', why); assert.equal(r.attrs['data-opening'], 'skip', why); assert.equal(r.timers.length, 0, `${why}: no timers`); return r; };
  skip('reduced motion (device)', { reduce: true });
  skip('reduced motion (the site switch)', { motion: 'reduced' });
  skip('a hash entry', { hash: '#exam-experience' });
  skip('a page already scrolled', { scrollY: 400 });
  skip('back/forward', { navType: 'back_forward' });
  skip('the app\'s web view', { appView: true });
  skip('same-origin referrer', { referrer: 'https://www.mockmob.in/pricing' });
  skip('same site without www', { referrer: 'https://mockmob.in/dashboard' });
  const signed = skip('signed in', { cookie: 'theme=1; sb-abcdefgh-auth-token.0=base64-xyz' });
  assert.equal(signed.attrs['data-signed-in'], '1', 'HeroTyped reads this');
  skip('a driven browser', { webdriver: true });
  skip('a crawler', { ua: 'Mozilla/5.0 (compatible; Googlebot/2.1)' });
  skip('Lighthouse', { ua: 'Mozilla/5.0 Chrome-Lighthouse' });
  // An outside referrer still plays.
  assert.equal(run({ referrer: 'https://www.google.com/' }).mode, 'first');
});

test('the gate: any pointerdown, touchstart, wheel or keydown jumps to the hand-off; a tap begun under the sheet presses nothing', () => {
  for (const type of OPENING_SKIP_EVENTS) {
    const r = run({ local: SESSION });
    assert.equal(typeof r.listeners[type], 'function', `${type} is listened for`);
    r.listeners[type]({ type, preventDefault() {}, stopPropagation() {} });
    assert.ok('data-opening-cut' in r.attrs, `${type}: the opening is cut`);
    assert.equal(r.attrs['data-opening-phase'], 'out');
    assert.equal(Object.keys(r.layerAttrs).length, 0, 'the layer itself is never touched (React hydrates it as drawn)');
    assert.ok(r.timers.filter((t) => !t.cleared).some((t) => t.delay === OPENING_HAND_MS + 40), 'done after the 280 ms hand-off');
  }
  assert.match(openingGate.toString(), /w\.addEventListener\('click', blind, true\)/);
});

test('the inline script is self-contained and placed before the layer', () => {
  const script = openingGateScript();
  assert.doesNotThrow(() => new Function(script), 'it parses');
  assert.doesNotMatch(script, /\bimport\b|\brequire\(|\bexport\b/);
  assert.ok(script.length < 6000, `small enough to inline (${script.length} chars)`);
  assert.match(script, /"first":1200,"short":800,"flip":\{"first":500,"short":380\},"hand":280,"settle":300/);
  assert.ok(OPENING.indexOf('<script id="mm-opening-gate"') < OPENING.indexOf('<div className="mo-open"'));
  assert.doesNotMatch(OPENING, /'use client'|useEffect|useState/);
});

test('LK87 the layer holds its first (whole) pose until the first paint, then plays every beat from there', () => {
  const r = run({ local: SESSION, paintTiming: true });
  assert.ok('data-opening-hold' in r.attrs);
  assert.deepEqual(liveDelays(r), [OPENING_WAIT_MS]);
  r.clock.now = 120;
  r.paint(110);
  assert.ok(!('data-opening-hold' in r.attrs), 'released on the paint');
  assert.equal(r.w.__mmOpening.base, 120);
  assert.ok(liveDelays(r).includes(420) && liveDelays(r).includes(840), `${liveDelays(r)}`);
  const css = rules(CSS);
  assert.match(css, /html\[data-opening-hold\] \.mo-open,\s*html\[data-opening-hold\] \.mo-open \* \{ animation-play-state: paused !important; \}/);
});

test('LK87 late: a first visit released after 900 ms plays the session pace; after 1,800 ms the still dissolves in 160 ms', () => {
  const slow = run({ paintTiming: true });
  slow.clock.now = 901;
  slow.paint(850);
  assert.equal(slow.attrs['data-opening'], 'short');
  assert.ok(liveDelays(slow).includes(420));
  const gone = run({ paintTiming: true });
  gone.clock.now = 1801;
  gone.paint(1700);
  assert.ok('data-opening-late' in gone.attrs && !('data-opening-hold' in gone.attrs));
  assert.deepEqual(liveDelays(gone), [OPENING_LATE_MS + 40]);
  const css = rules(CSS);
  assert.match(css, /html\[data-opening-late\] \.mo-open \{ animation: mo-late-out 160ms cubic-bezier\(0\.23, 1, 0\.32, 1\) forwards; \}/);
  assert.match(css, /\[data-opening-late\] \.mm-nav \.logo-b \{ animation: none; \}/);
});

test('the bar logo is hidden while it runs, shown the frame the word lands, then settles: the dot drops in, Mobi hops and blinks', () => {
  const css = rules(CSS);
  const bar = String.raw`html:is\(\[data-opening='first'\], \[data-opening='short'\]\)`;
  assert.match(css, new RegExp(String.raw`${bar} \.mm-nav \.logo-b \{ animation: mo-bar-wait 1ms linear 6000ms both; \}`));
  assert.match(css, new RegExp(String.raw`${bar}\[data-opening-flip\] \.mm-nav \.logo-b \{ animation: mo-bar-in 1ms linear var\(--mo-land, 0ms\) both; \}`));
  assert.match(css, new RegExp(String.raw`${bar}\[data-opening-cut\] \.mm-nav \.logo-b \{ animation: mo-bar-in-cut 1ms linear 280ms both; \}`));
  for (const part of ['logo-b__dot', 'logo-b__mobi', 'logo-b__eyes']) assert.match(css, new RegExp(String.raw`html\[data-opening='done'\]\[data-opening-flip\] \.mm-nav \.${part} \{ animation: mo-settle-`), part);
  assert.match(openingGateScript(), /--mo-land/);
});
