// The home page's opening (LK74, LK299): when it plays, and the hand-off. Pure and dependency free, because
// OpeningMo.jsx inlines `openingGate` as a script that runs before the layer is parsed (before paint and before React),
// and opening.test.mjs calls it with a fake window and document.
//
// Modes, written to <html data-opening>:
//   'first'  the first visit ever on this device (localStorage has no mark): the word lands on the bar logo
//            OPENING_FIRST_MS after the release (1,750 ms; the page is usable from 1,250 ms);
//   'short'  the first load of a new browser session (sessionStorage has no mark): OPENING_SHORT_MS (800 ms; usable from
//            420 ms). The same grand picture at a quicker pace: this is the one a returning student sees;
//   'skip'   everything else: a load later in the same session, reduced motion (the device setting or the site's own
//            data-motion switch), a hash or deep entry (a #section link, a back/forward load, a page already scrolled,
//            the app's own web view), a same-origin referrer (coming back to / from inside the site), a signed-in
//            student (the Supabase session cookie, readable before paint), a bot or a driven browser
//            (navigator.webdriver), and any storage error (so it can never run twice in a session).
//   'done'   set when the word has landed; the layer is display:none from then on (opening.css).
// It also writes <html data-signed-in="1"> when the session cookie is there (the opening skips; since round 4, LK120, the
// typed line types for a signed-in visitor too: that skip was why the line was "sometimes there, sometimes gone").
//
// The layer never takes pointer input (opening.css: pointer-events none from its first frame), so a scroll, a wheel or a
// key goes straight to the page. Any pointerdown, touchstart, wheel or keydown also jumps to the hand-off (the sheet
// lifts and the word lands in OPENING_HAND_MS). One thing is held back: the click of a tap that began while the sheet
// still covered the page, so a tap to skip never presses a button the student could not see. The hand-off is the sheet
// rising like a curtain while the composed word FLIPs onto the bar logo's own box (both are Logo.jsx's viewBox, so it
// is a pure translate plus scale). Every visual step is CSS (opening.css) and ends on visibility:hidden by itself; this
// script only measures the FLIP, handles a skip and says when it is done: window event 'mm:opening' with detail
// { phase: 'handoff' | 'done', mode }, and window.__mmOpening for late readers.
//
// The clock starts on the layer's first painted frame (LK87, 5 Nov 2026), not when this script runs. The live site
// reported its first paint 340 to 730 ms after the script (the page's scripts hold the callback), so the layer waits on
// its first pose (html[data-opening-hold] pauses every part) until the browser reports the first contentful paint. That
// first pose is the whole picture (the word, Mobi, the answer bubbles in the air), so nothing is missed while it waits;
// every beat plays from the release. A first visit released later than OPENING_LATE.short plays the session pace
// instead; a release later than OPENING_LATE.out dissolves the still in OPENING_LATE_MS: a student who has already
// waited is not held for a brand moment. Without paint timing (or if no paint is reported within OPENING_WAIT_MS) it
// starts at once.

/** A first-ever visit: the word lands on the bar logo this long after the release (LK299, 17 Nov 2026). */
export const OPENING_FIRST_MS = 1750;
/** The first load of a new session: the same, at the session pace. */
export const OPENING_SHORT_MS = 800;
/** The hand-off at the end of each: the sheet rises and the word FLIPs onto the bar logo. The page is usable from its start. */
export const OPENING_FLIP_MS = Object.freeze({ first: 500, short: 380 });
/** The same hand-off after a skip. */
export const OPENING_HAND_MS = 280;
/** After the landing the bar logo settles (opening.css: its dot drops in, Mobi blinks and hops once). */
export const OPENING_SETTLE_MS = 300;
/** Storage marks (the site's mm:*:vN convention; v2 from 17 Nov 2026, so the new first visit is seen once). */
export const OPENING_KEYS = Object.freeze({ ever: 'mm:opened:v2', session: 'mm:opening:v2' });
/** The inputs that skip to the hand-off. */
export const OPENING_SKIP_EVENTS = Object.freeze(['pointerdown', 'touchstart', 'wheel', 'keydown']);
/** A release this many ms after the script: later than `short`, a first visit plays the session pace; later than `out`, the still dissolves. */
export const OPENING_LATE = Object.freeze({ short: 900, out: 1800 });
/** The longest the layer waits on its first pose for a paint report before it starts anyway. */
export const OPENING_WAIT_MS = 3000;
/** A release past OPENING_LATE.out: the held still dissolves this fast (opening.css html[data-opening-late]). */
export const OPENING_LATE_MS = 160;

// Written in plain ES2017 with no outside references: OpeningMo.jsx inlines it as `(${openingGate})(window, document, cfg)`.
export function openingGate(w, d, cfg) {
  var html = d.documentElement;
  var mode = 'skip';
  var signed = false;
  try { signed = /(?:^|;\s*)sb-[^=;]+-auth-token(?:\.\d+)?=/.test(d.cookie); } catch (e) { signed = false; }
  if (signed) html.setAttribute('data-signed-in', '1');
  var nav = w.navigator || {};
  var bot = !!nav.webdriver || /bot|crawl|spider|slurp|lighthouse|headless|preview|facebookexternalhit|embedly|whatsapp/i.test(nav.userAgent || '');
  var reduced = html.getAttribute('data-motion') === 'reduced';
  try { reduced = reduced || w.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { reduced = true; }
  var deep = !!w.location.hash || (w.scrollY || 0) > 0 || html.getAttribute('data-app-view') === '1';
  try { var entry = w.performance.getEntriesByType('navigation')[0]; if (entry && entry.type === 'back_forward') deep = true; } catch (e) { /* no timing api */ }
  var inside = false;
  try { inside = !!d.referrer && new URL(d.referrer).host.replace(/^www\./, '') === w.location.host.replace(/^www\./, ''); } catch (e) { inside = false; }
  if (!signed && !bot && !reduced && !deep && !inside) {
    try {
      if (!w.sessionStorage.getItem(cfg.session)) {
        w.sessionStorage.setItem(cfg.session, '1');
        mode = 'short';
        try { if (!w.localStorage.getItem(cfg.ever)) { w.localStorage.setItem(cfg.ever, '1'); mode = 'first'; } } catch (e) { mode = 'short'; }
      }
    } catch (e) { mode = 'skip'; }
  }
  html.setAttribute('data-opening', mode);
  var st = { mode: mode, phase: mode === 'skip' ? 'done' : 'run', t0: 0, hand: 0, end: 0 };
  w.__mmOpening = st;
  if (mode === 'skip') return mode;

  // `base` is the performance.now() of the timeline's 0 ms: t0 until the clock starts on the first paint (start below).
  var base = w.performance.now();
  st.t0 = st.base = base;
  var plan = function () { st.end = cfg[mode]; st.hand = st.end - cfg.flip[mode]; };
  plan();
  var timers = [];
  var later = function (fn, ms) { timers.push(w.setTimeout(fn, Math.max(0, ms))); };
  var clear = function () { for (var i = 0; i < timers.length; i++) w.clearTimeout(timers[i]); timers = []; };
  var now = function () { return w.performance.now() - base; };
  var emit = function (phase) {
    st.phase = phase;
    try { w.dispatchEvent(new w.CustomEvent('mm:opening', { detail: { phase: phase, mode: mode } })); } catch (e) { /* old browser */ }
  };
  // FLIP: the composed word's box (never transformed itself) onto the bar logo's box. `delay` is ms from now until it
  // starts and `ms` its length; --mo-land is when the word lands (the bar logo shows and settles on it).
  // Everything the script writes goes on <html> (suppressHydrationWarning, like the theme script), never on the
  // layer, so React hydrates the layer exactly as the server drew it.
  var flip = function (delay, ms) {
    var word = d.querySelector('.mo-word');
    var target = d.querySelector('.mm-nav .logo-b');
    if (!word || !target) return false;
    var a = word.getBoundingClientRect();
    var b = target.getBoundingClientRect();
    if (!a.width || !b.width) return false;
    var s = html.style;
    delay = Math.max(0, Math.round(delay));
    s.setProperty('--mo-fx', (b.left + b.width / 2 - (a.left + a.width / 2)).toFixed(2) + 'px');
    s.setProperty('--mo-fy', (b.top + b.height / 2 - (a.top + a.height / 2)).toFixed(2) + 'px');
    s.setProperty('--mo-fs', (b.width / a.width).toFixed(4));
    s.setProperty('--mo-flip-delay', delay + 'ms');
    s.setProperty('--mo-land', delay + ms + 'ms');
    html.setAttribute('data-opening-flip', '');
    return true;
  };
  var po = null;
  var off = function () {
    for (var i = 0; i < cfg.events.length; i++) w.removeEventListener(cfg.events[i], cut, true);
    if (po) { try { po.disconnect(); } catch (e) { /* gone */ } po = null; }
  };
  var done = function () {
    off();
    clear();
    html.setAttribute('data-opening', 'done');
    emit('done');
    // Once the bar logo has settled, its own hover and wink rules take over again.
    w.setTimeout(function () { html.removeAttribute('data-opening-flip'); html.removeAttribute('data-opening-cut'); }, cfg.settle + 200);
  };
  var handoff = function () {
    html.setAttribute('data-opening-phase', 'out');
    emit('handoff');
  };
  // The click of a tap that began under the sheet goes nowhere: nobody presses a button they could not see.
  var blind = function (e) { e.preventDefault(); e.stopPropagation(); };
  // A skip: everything jumps to its rest pose and the hand-off starts now (opening.css html[data-opening-cut]).
  function cut(e) {
    if (st.phase !== 'run') return;
    st.cutAt = now();
    clear();
    if (e && /^[pt]/.test(e.type)) {
      w.addEventListener('click', blind, true);
      w.setTimeout(function () { w.removeEventListener('click', blind, true); }, cfg.hand);
    }
    html.removeAttribute('data-opening-hold');
    html.setAttribute('data-opening-cut', '');
    flip(0, cfg.hand);
    handoff();
    later(done, cfg.hand + 40);
  }
  for (var i = 0; i < cfg.events.length; i++) w.addEventListener(cfg.events[i], cut, { capture: true, passive: true });
  // The bar logo is parsed just after the layer: measure it on the first frames, before the hand-off starts.
  var tries = 0;
  var seek = function () {
    if (st.phase !== 'run' || html.hasAttribute('data-opening-flip')) return;
    if (flip(st.hand - now(), cfg.flip[mode])) return;
    tries += 1;
    if (tries < 90 && now() < st.hand - 16) w.requestAnimationFrame(seek);
  };
  // The clock starts once the first frame has been painted (`paintAt`, the paint's performance.now() time; null: no
  // paint report). How late is measured to now, not to the paint: the layer can only move once this callback runs.
  var started = false;
  var start = function (paintAt) {
    if (started || st.phase !== 'run') return;
    started = true;
    var late = paintAt == null ? 0 : Math.max(0, w.performance.now() - st.t0);
    if (paintAt != null) st.paint = Math.round(paintAt - st.t0);
    st.late = Math.round(late);
    clear();
    html.removeAttribute('data-opening-hold');
    if (late > cfg.late.out) {
      // The held still dissolves where it stands (cfg.out ms) and the page is there: no flight, no wait.
      html.setAttribute('data-opening-late', '');
      handoff();
      later(done, cfg.out + 40);
      return;
    }
    if (late > cfg.late.short && mode === 'first') {
      mode = st.mode = 'short';
      html.setAttribute('data-opening', mode);
      plan();
    }
    base = st.base = w.performance.now();
    w.requestAnimationFrame(seek);
    later(handoff, st.hand);
    later(done, st.end + 40);
  };
  html.setAttribute('data-opening-hold', '');
  try {
    var types = (w.PerformanceObserver && w.PerformanceObserver.supportedEntryTypes) || [];
    if (types.indexOf('paint') >= 0) {
      po = new w.PerformanceObserver(function (list) {
        var fcp = list.getEntriesByName('first-contentful-paint')[0];
        if (fcp) start(fcp.startTime);
      });
      po.observe({ type: 'paint', buffered: true });
    }
  } catch (e) { po = null; }
  if (po) later(function () { start(null); }, cfg.wait);
  else start(null);
  return mode;
}

/** The inline script OpeningMo.jsx renders (before its layer). */
export function openingGateScript() {
  const cfg = { first: OPENING_FIRST_MS, short: OPENING_SHORT_MS, flip: { ...OPENING_FLIP_MS }, hand: OPENING_HAND_MS, settle: OPENING_SETTLE_MS, ever: OPENING_KEYS.ever, session: OPENING_KEYS.session, events: [...OPENING_SKIP_EVENTS], late: { ...OPENING_LATE }, wait: OPENING_WAIT_MS, out: OPENING_LATE_MS };
  // Every visitor downloads it in the HTML: whole-line comments and indentation stay in this file, not in the page.
  const source = openingGate.toString().replace(/^[ \t]*\/\/.*\r?\n/gm, '').replace(/^[ \t]+/gm, '');
  return `(${source})(window,document,${JSON.stringify(cfg)})`;
}
