// node --test src/components/landing/opening.test.mjs
// The home page's opening (LK74, SPEC-HOME-1104 decisions 1 and 6; L-043): the app's "mo" opening in CSS (OpeningMo.jsx,
// opening.css), its run gate (openingGate.mjs) and the per-letter logo (logoLetters.mjs, generated). Source-level and
// pure; the filmstrips, elementFromPoint and LCP/CLS are measured in a real browser (tmp/home-1104/build-p3/).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LOGO_B_LETTERS, LOGO_B_MOBI, LOGO_B_VIEWBOX } from '../brand/logoB.js';
import { LOGO_DOT, LOGO_LETTER_PARTS, LOGO_LETTER_X, LOGO_MO, LOGO_MOBI_INDEX, LOGO_MOBI_PARTS, LOGO_OPEN_BOX, LOGO_OPEN_VIEWBOX, LOGO_UNFOLD, LOGO_WORD } from '../brand/logoLetters.mjs';
import { OPENING_FIRST_MS, OPENING_HAND_MS, OPENING_KEYS, OPENING_SHORT_MS, OPENING_SKIP_EVENTS, OPENING_LATE_MS, OPENING_SNAPS, OPENING_WAIT_MS, openingGate, openingGateScript } from './openingGate.mjs';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const CSS = read('../../app/opening.css');
const OPENING = read('./OpeningMo.jsx');
const LOGO = read('../Logo.jsx');
const rules = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const ms = (name) => Number(rules(CSS).match(new RegExp(`${name}: (\\d+)ms`))[1]);

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

test('decision 1: the opening draws Logo.jsx\'s own volt dot, and the bar logo keeps it', () => {
  const [x, y, w, h] = LOGO_B_VIEWBOX.split(' ').map(Number);
  assert.equal(Number(LOGO.match(/const DOT_R = (\d+);/)[1]), LOGO_DOT.r);
  assert.equal(Number(LOGO.match(/const DOT_GAP = (\d+);/)[1]), LOGO_DOT.gap);
  assert.equal(LOGO_DOT.cx, Math.round((x + w + LOGO_DOT.gap + LOGO_DOT.r) * 100) / 100);
  assert.equal(LOGO_DOT.cy, -LOGO_DOT.r);
  assert.equal(LOGO_OPEN_VIEWBOX, `${x} ${y} ${Math.round((w + LOGO_DOT.gap + LOGO_DOT.r * 2) * 100) / 100} ${h}`, 'the opening box is Logo.jsx\'s VIEWBOX');
  assert.deepEqual([LOGO_OPEN_BOX.x, LOGO_OPEN_BOX.y, LOGO_OPEN_BOX.h], [x, y, h]);
  // In the opening SVG: a volt circle at the dot, the unfold's last beat (scale .6 to 1 with its opacity, 160 ms, ~860 ms).
  assert.match(OPENING, /<Part className="mo-dot"[^>]*>\s*<circle fill=\{LOGO_B_COLORS\.volt\} cx=\{LOGO_DOT\.cx\} cy=\{LOGO_DOT\.cy\} r=\{LOGO_DOT\.r\} \/>/);
  assert.match(rules(CSS), /\.mo-dot \{\s*transform-origin: var\(--dot\);\s*animation: mo-dot 160ms cubic-bezier\(0\.23, 1, 0\.32, 1\) 860ms both;/);
  assert.match(rules(CSS), /@keyframes mo-dot \{ from \{ opacity: 0; transform: scale\(0\.6\); \} to \{ opacity: 1; transform: scale\(1\); \} \}/);
  // In the bar logo (LogoMark, which the site bar draws).
  assert.match(LOGO, /<circle className="dot logo-b__dot" cx=\{DOT_CX\} cy=\{DOT_CY\} r=\{DOT_R\}/);
});

test('the unfold: "mock" leftwards from the m, nearest first, the b rightwards from Mobi; hinges and slots tile the word', () => {
  const left = LOGO_UNFOLD.filter((u) => u.side === 'left');
  const right = LOGO_UNFOLD.filter((u) => u.side === 'right');
  assert.deepEqual(left.map((u) => u.index), [3, 2, 1, 0]);
  assert.deepEqual(left.map((u) => u.k), [0, 1, 2, 3]);
  assert.deepEqual(right.map((u) => [u.index, u.k]), [[6, 0]]);
  // Each left letter's hinge is the previous one's hinge minus its slot: the slots tile from the m's left edge to the word's.
  const frac = (x) => (x - LOGO_OPEN_BOX.x) / LOGO_OPEN_BOX.w;
  let edge = frac(2589);
  for (const u of left) { assert.ok(Math.abs(u.hinge - edge) < 1e-4, `hinge of ${u.index}`); edge -= u.slot; }
  assert.ok(Math.abs(edge - frac(40)) < 1e-4, 'the last slot ends at the word\'s left ink');
  assert.ok(Math.abs(right[0].hinge - frac(3968.1)) < 1e-4 && Math.abs(right[0].hinge + right[0].slot - frac(4544.35)) < 1e-4);
});

// ---------- the timeline (opening.css) ----------

test('L-043 and decision 6: one constant each, about 1.3 to 1.6 s, the hand-off is the last 280 ms', () => {
  assert.equal(OPENING_FIRST_MS, 1600);
  assert.equal(OPENING_SHORT_MS, 1280);
  assert.equal(OPENING_HAND_MS, 280);
  const css = rules(CSS);
  assert.match(css, /html\[data-opening='short'\] \.mo-open \{\s*--mo-hand: 1000ms;\s*--mo-end: 1280ms;/);
  assert.match(css, /html\[data-opening='first'\] \.mo-open \{ --mo-hand: 1320ms; --mo-end: 1600ms; \}/);
  assert.equal(1000 + OPENING_HAND_MS, OPENING_SHORT_MS);
  assert.equal(1320 + OPENING_HAND_MS, OPENING_FIRST_MS);
  // It ends hidden on its own (fill-mode forwards) and only 'first' and 'short' ever draw it.
  assert.match(css, /\.mo-open \{ display: none; \}/);
  assert.match(css, /animation: mo-gone 1ms linear var\(--mo-end\) forwards;/);
  assert.match(css, /@keyframes mo-gone \{ to \{ visibility: hidden; pointer-events: none; \} \}/);
  assert.match(css, /html\[data-opening-phase='out'\] \.mo-open,\s*html\[data-opening-cut\] \.mo-open \{ pointer-events: none; \}/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.mo-open \{ display: none !important; \}/);
  assert.match(css, /html\[data-motion='reduced'\] \.mo-open \{ display: none !important; \}/);
  // Above the site bar (z 60/70), below the site's dialogs (1000).
  assert.match(css, /z-index: 95;/);
});

test('the beats keep the app\'s timeline (brand_opening.dart OpeningTimeline)', () => {
  const css = rules(CSS);
  assert.match(css, /animation: mo-blink 160ms [^;]* 150ms;/, 'blink at 150 ms, 160 ms');
  assert.match(css, /mo-ink 200ms cubic-bezier\(0\.23, 1, 0\.32, 1\) 320ms both/, 'the bubble eye inks 320 to 520');
  assert.match(css, /animation: mo-camera 500ms linear 500ms both;/, 'the camera 500 to 1000');
  assert.match(css, /mo-unfold 300ms cubic-bezier\(0\.34, 1\.36, 0\.64, 1\) calc\(520ms \+ var\(--k\) \* 40ms\) both/, 'letters from 520, 40 ms apart');
  assert.match(css, /mo-slide 300ms cubic-bezier\(0\.34, 1\.36, 0\.64, 1\) calc\(520ms \+ var\(--k\) \* 40ms\) both/);
  assert.match(css, /@keyframes mo-show \{ 0%, 3% \{ opacity: 0; \} 13%, 100% \{ opacity: 1; \} \}/, 'hidden until 12 % open, whole at 45 %');
  assert.match(css, /mo-glance 120ms cubic-bezier\(0\.23, 1, 0\.32, 1\) 860ms both/, 'Mobi glances toward the word at 860');
  // LK87 (5 Nov 2026, D5): the FLIP keeps its 280 ms on a gentler start and a long soft landing, and the ground clears once
  // the word is all but home (from 120 ms, 150 ms), so the word never crosses the headline on a half-clear ground.
  assert.match(css, /mo-word-flip 280ms cubic-bezier\(0\.32, 0\.72, 0, 1\) var\(--mo-flip-delay, 0ms\) forwards/, 'the FLIP is 280 ms');
  assert.match(css, /mo-ground-out 150ms cubic-bezier\(0\.23, 1, 0\.32, 1\) calc\(var\(--mo-hand\) \+ 120ms\) forwards/);
  assert.ok(120 + 150 <= OPENING_HAND_MS, 'the ground is clear by the landing');
  assert.match(css, /@keyframes mo-ground-out \{ to \{ opacity: 0; transform: translateY\(-4vh\); \} \}/);
  assert.match(css, /html\[data-opening='first'\] \.mo-breath \{ animation: mo-breath 320ms [^;]* 1000ms; \}/, 'first visit: the 320 ms hold breathes');
  assert.match(css, /50% \{ transform: scale\(1\.03\); \}/, 'a 3 % breath');
});

test('the camera keyframes are the app\'s log-scale pull-back, 2.2x to 1, recomputed', () => {
  const bez = (x1, y1, x2, y2) => (x) => {
    const cx = 3 * x1; const bx = 3 * (x2 - x1) - cx; const ax = 1 - cx - bx;
    const cy = 3 * y1; const by = 3 * (y2 - y1) - cy; const ay = 1 - cy - by;
    let lo = 0; let hi = 1;
    for (let i = 0; i < 60; i += 1) { const m = (lo + hi) / 2; if (((ax * m + bx) * m + cx) * m < x) lo = m; else hi = m; }
    const t = (lo + hi) / 2;
    return ((ay * t + by) * t + cy) * t;
  };
  const camera = bez(0.5, 0, 0.15, 1);
  const frames = [...rules(CSS).matchAll(/(\d+)% \{ transform: scale\(([\d.]+)\) translate\(calc\(var\(--mo-dx\) \* ([\d.]+)\), calc\(var\(--mo-dy\) \* ([\d.]+)\)\); \}/g)];
  assert.equal(frames.length, 21, 'every 25 ms of the 500 ms pull-back');
  for (const [, at, s, fx, fy] of frames) {
    const c = camera(Number(at) / 100);
    assert.ok(Math.abs(Number(s) - 2.2 ** (1 - c)) < 1e-3, `scale at ${at}%`);
    assert.ok(Math.abs(Number(fx) - (1 - c)) < 1e-3 && fx === fy, `focus at ${at}%`);
  }
  // The "mo" offset the focus starts from is the generated one.
  assert.match(OPENING, /'--mo-dx': pct\(-LOGO_MO\.dx\), '--mo-dy': pct\(-LOGO_MO\.dy\)/);
  assert.ok(LOGO_MO.dx > 0.15 && LOGO_MO.dx < 0.2, 'the "mo" sits right of the word\'s centre');
});

test('only transform, opacity and the end state animate; nothing loops', () => {
  const css = rules(CSS);
  for (const [, name, body] of css.matchAll(/@keyframes ([\w-]+) \{([^@]*?)\}\s*(?=@keyframes|\.|html|$|\/\*)/g)) {
    const props = [...body.matchAll(/([a-z-]+):/g)].map((m) => m[1]);
    for (const p of props) assert.ok(['transform', 'opacity', 'visibility', 'pointer-events'].includes(p), `${name} animates ${p}`);
  }
  assert.doesNotMatch(css, /infinite/);
  assert.doesNotMatch(css, /transition: all/);
  // The layer has no text and no image: it can never be the LCP.
  assert.doesNotMatch(OPENING, /<img|<text|<image/);
  assert.match(OPENING, /<div className="mo-open" aria-hidden="true"/);
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
const cfg = { first: OPENING_FIRST_MS, short: OPENING_SHORT_MS, hand: OPENING_HAND_MS, ever: OPENING_KEYS.ever, session: OPENING_KEYS.session, events: [...OPENING_SKIP_EVENTS], snaps: OPENING_SNAPS.map((x) => [...x]), wait: OPENING_WAIT_MS, late: OPENING_LATE_MS };
const run = (opts) => { const env = fakeEnv(opts); const mode = openingGate(env.w, env.d, cfg); return { mode, ...env }; };

test('the gate: first ever, then short once per session, then skip; never twice in a session', () => {
  const first = run();
  assert.equal(first.mode, 'first');
  assert.equal(first.attrs['data-opening'], 'first');
  assert.equal(first.w.localStorage.m.get(OPENING_KEYS.ever), '1');
  assert.equal(first.w.sessionStorage.m.get(OPENING_KEYS.session), '1');
  assert.deepEqual([first.w.__mmOpening.hand, first.w.__mmOpening.end], [1320, 1600]);
  const short = run({ local: { [OPENING_KEYS.ever]: '1' } });
  assert.equal(short.mode, 'short');
  assert.deepEqual([short.w.__mmOpening.hand, short.w.__mmOpening.end], [1000, 1280]);
  assert.ok(short.timers.some((t) => t.delay === 1000) && short.timers.some((t) => t.delay === 1320), 'hand-off at 1000, done just after 1280');
  assert.equal(run({ local: { [OPENING_KEYS.ever]: '1' }, session: { [OPENING_KEYS.session]: '1' } }).mode, 'skip', 'a reload in the same session');
  assert.equal(run({ storageThrows: true }).mode, 'skip', 'no storage: it could not tell, so it never risks running twice');
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

test('the gate: any pointerdown, touchstart, wheel or keydown jumps to the hand-off, once', () => {
  for (const type of OPENING_SKIP_EVENTS) {
    const r = run({ local: { [OPENING_KEYS.ever]: '1' } });
    assert.equal(typeof r.listeners[type], 'function', `${type} is listened for`);
    r.listeners[type]();
    assert.ok('data-opening-cut' in r.attrs, `${type}: the opening is cut`);
    assert.equal(r.attrs['data-opening-phase'], 'out', `${type}: it takes no more input`);
    assert.equal(Object.keys(r.layerAttrs).length, 0, 'the layer itself is never touched (React hydrates it as drawn)');
    assert.equal(r.w.__mmOpening.phase, 'handoff');
    assert.ok(r.timers.filter((t) => !t.cleared).some((t) => t.delay === OPENING_HAND_MS + 40), 'done after the 280 ms hand-off');
    assert.ok(r.timers.filter((t) => t.cleared).length >= 2, 'the planned hand-off and end are cancelled');
  }
});

test('the inline script is self-contained and placed before the layer', () => {
  const script = openingGateScript();
  assert.doesNotThrow(() => new Function(script), 'it parses');
  assert.doesNotMatch(script, /\bimport\b|\brequire\(|\bexport\b/);
  assert.ok(script.length < 6000, `small enough to inline (${script.length} chars)`);
  assert.match(script, /"first":1600,"short":1280,"hand":280/);
  assert.ok(OPENING.indexOf('<script id="mm-opening-gate"') < OPENING.indexOf('<div className="mo-open"'), 'the gate runs before the layer is parsed');
  // A server component: no client hooks, no 'use client'.
  assert.doesNotMatch(OPENING, /'use client'|useEffect|useState/);
});

// ---------- LK87 (5 Nov 2026, D5): the clock starts on the first painted frame ----------
// The live site first painted about 600 ms after the gate ran (a 50 ms film of www.mockmob.in at 390x844), so the blink,
// the inked eye and the start of the pull-back played behind a blank screen. The layer now holds its first pose until the
// browser reports the first contentful paint and starts from a rest pose picked by how long that took.
const SESSION = { [OPENING_KEYS.ever]: '1' };
const liveDelays = (r) => r.timers.filter((t) => !t.cleared).map((t) => t.delay);

test('LK87 the layer holds its first pose until the first paint is reported, then starts its clock there', () => {
  const r = run({ local: SESSION, paintTiming: true });
  assert.equal(r.mode, 'short');
  assert.ok('data-opening-hold' in r.attrs, 'held on the first pose');
  assert.equal(r.observers.length, 1);
  assert.deepEqual(r.observers[0].opts, { type: 'paint', buffered: true }, 'a paint that came before the observer still counts');
  assert.deepEqual(liveDelays(r), [OPENING_WAIT_MS], 'nothing but the fallback start waits before the paint');
  r.clock.now = 120;
  r.paint(110);
  assert.ok(!('data-opening-hold' in r.attrs), 'released on the paint');
  assert.equal(r.w.__mmOpening.from, 0, 'a prompt paint plays every beat');
  assert.equal(r.w.__mmOpening.base, 120, 'the timeline starts when it can first move');
  assert.equal(r.w.__mmOpening.paint, 110);
  assert.ok(liveDelays(r).includes(1000) && liveDelays(r).includes(1320), `hand-off 1000 ms and done just after 1280 ms from there (${liveDelays(r)})`);
  const before = r.timers.length;
  r.paint(400);
  assert.equal(r.timers.length, before, 'it starts once');
});

test('LK87 a late paint starts from a rest pose (0, 310 or 500 ms in) and never adds the skipped beats to the wait; past the last snap the held splash dissolves', () => {
  assert.deepEqual(OPENING_SNAPS.map((x) => [...x]), [[200, 0], [450, 310], [1100, 500]]);
  // The rest poses: 0 before the blink (150 ms), 310 once the 160 ms blink is over and before the eye inks (320 ms), 500 the
  // eye inked (it ends at 520) and the camera about to pull back (500 ms).
  const css = rules(CSS);
  assert.match(css, /animation: mo-blink 160ms [^;]* 150ms;/);
  assert.match(css, /mo-ink 200ms cubic-bezier\(0\.23, 1, 0\.32, 1\) 320ms both/);
  assert.match(css, /animation: mo-camera 500ms linear 500ms both;/);
  for (const [late, from] of [[0, 0], [200, 0], [201, 310], [450, 310], [451, 500], [800, 500], [1100, 500]]) {
    const anims = [{ currentTime: 0 }, { currentTime: 0 }, { currentTime: 0 }];
    const r = run({ local: SESSION, paintTiming: true, anims });
    r.clock.now = late;
    r.paint(Math.max(0, late - 30));
    const st = r.w.__mmOpening;
    assert.equal(st.from, from, `${late} ms late starts at ${from}`);
    assert.ok(anims.every((a) => a.currentTime === from), `${late}: every part of the layer jumps to ${from}`);
    assert.equal(st.base, late - from);
    assert.ok(liveDelays(r).includes(1000 - from), `${late}: the hand-off comes ${1000 - from} ms after the start (${liveDelays(r)})`);
    assert.ok(!('data-opening-cut' in r.attrs) && !('data-opening-hold' in r.attrs));
  }
  const r = run({ local: SESSION, paintTiming: true });
  r.clock.now = 1101;
  r.paint(1000);
  // Before, a page that painted after the opening's end showed no opening at all; now the splash it paints dissolves in
  // 160 ms where it stands (no flight from a pose the student never saw arrive, no jump).
  assert.ok('data-opening-late' in r.attrs && !('data-opening-cut' in r.attrs), 'past the last snap: the splash dissolves');
  assert.ok(!('data-opening-hold' in r.attrs));
  assert.equal(r.w.__mmOpening.phase, 'handoff');
  assert.equal(OPENING_LATE_MS, 160);
  assert.deepEqual(liveDelays(r), [OPENING_LATE_MS + 40]);
  const css2 = rules(CSS);
  assert.match(css2, /html\[data-opening-late\] \.mo-open \{ pointer-events: none; animation: mo-late-out 160ms cubic-bezier\(0\.23, 1, 0\.32, 1\) forwards; \}/);
  assert.match(css2, /html\[data-opening-late\] \.mo-open \* \{ animation-play-state: paused !important; \}/, 'every part stays still while it dissolves');
  assert.match(css2, /\[data-opening-late\] \.mm-nav \.logo-b \{ animation: none; \}/, 'the bar logo is simply there under it');
});

test('LK87 a tap while the layer holds skips to the hand-off; without paint timing it starts at once, as before', () => {
  const r = run({ local: SESSION, paintTiming: true });
  r.listeners.pointerdown();
  assert.ok('data-opening-cut' in r.attrs && !('data-opening-hold' in r.attrs));
  assert.equal(r.w.__mmOpening.phase, 'handoff');
  r.paint(100);
  assert.equal(r.w.__mmOpening.phase, 'handoff', 'a paint after the skip changes nothing');
  const plain = run({ local: SESSION });
  assert.ok(!('data-opening-hold' in plain.attrs), 'no paint timing: no hold');
  assert.ok(liveDelays(plain).includes(1000) && liveDelays(plain).includes(1320));
  // No paint report within OPENING_WAIT_MS: it starts from the top anyway.
  const quiet = run({ local: SESSION, paintTiming: true });
  quiet.clock.now = OPENING_WAIT_MS;
  quiet.timers.find((t) => t.delay === OPENING_WAIT_MS).fn();
  assert.ok(!('data-opening-hold' in quiet.attrs));
  assert.equal(quiet.w.__mmOpening.from, 0);
});

test('LK87 CSS: the hold pauses every part; the word lands whole in Night and the bar logo appears on its landing, on the word\'s own clock', () => {
  const css = rules(CSS);
  assert.match(css, /html\[data-opening-hold\] \.mo-open,\s*html\[data-opening-hold\] \.mo-open \* \{ animation-play-state: paused !important; \}/);
  assert.match(css, /html\[data-opening-flip\] \.mo-word \{\s*animation: mo-word-flip 280ms cubic-bezier\(0\.32, 0\.72, 0, 1\) var\(--mo-flip-delay, 0ms\) forwards;\s*\}/, 'Night: no fade, it lands');
  assert.match(css, /html\[data-theme='light'\]\[data-opening-flip\] \.mo-word \{[^}]*mo-word-fade 120ms linear calc\(var\(--mo-flip-delay, 0ms\) \+ 100ms\) forwards/, 'Day: the warm-white word dissolves on the dark ground before the cream shows');
  assert.match(css, /html\[data-theme='light'\] \.mo-open__ground \{ animation-duration: 130ms; animation-delay: calc\(var\(--mo-hand\) \+ 150ms\); \}/, 'Day: the cream comes after the word has gone');
  const bar = String.raw`html:is\(\[data-opening='first'\], \[data-opening='short'\]\)`;
  assert.match(css, new RegExp(String.raw`${bar} \.mm-nav \.logo-b \{ animation: mo-bar-wait 1ms linear 6000ms both; \}`), 'hidden under the layer, shown by 6 s whatever happens');
  // Every rule that times the landing has its own animation name, so its delay counts from when it applies (the flip or
  // the skip), never from the gate: the 5 Nov replay of an 800 ms hold showed the bar logo early when the names were shared.
  for (const name of ['mo-bar-wait', 'mo-bar-in', 'mo-bar-in-cut', 'mo-word-fade', 'mo-word-flip', 'mo-word-flip-cut', 'mo-word-fade-cut']) assert.ok(css.includes(`@keyframes ${name} {`), name);
  assert.doesNotMatch(css.slice(css.indexOf("html[data-theme='light'][data-opening-flip] .mo-word")).split('}')[0], /mo-word-out/, 'the Day flip fade is not the no-script fade');
  assert.match(css, new RegExp(String.raw`${bar}\[data-opening-flip\] \.mm-nav \.logo-b \{ animation: mo-bar-in 1ms linear calc\(var\(--mo-flip-delay, 0ms\) \+ 280ms\) both; \}`), 'Night: on the landing');
  assert.match(css, new RegExp(String.raw`${bar}\[data-theme='light'\]\[data-opening-flip\] \.mm-nav \.logo-b \{ animation: mo-bar-in 130ms linear calc\(var\(--mo-flip-delay, 0ms\) \+ 150ms\) both; \}`), 'Day: the ink logo comes up with the cream, ending on the landing');
  assert.match(css, new RegExp(String.raw`${bar}\[data-opening-cut\] \.mm-nav \.logo-b \{ animation: mo-bar-in-cut 1ms linear 280ms both; \}`));
  assert.match(css, /@keyframes mo-bar-in \{ from \{ opacity: 0; \} to \{ opacity: 1; \} \}/);
  assert.match(openingGateScript(), /"snaps":\[\[200,0\],\[450,310\],\[1100,500\]\],"wait":3000/);
});
