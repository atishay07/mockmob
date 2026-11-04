// The home page's opening (LK74, SPEC-HOME-1104 decision 6): when it plays, and the hand-off. Pure and dependency
// free, because OpeningMo.jsx inlines `openingGate` as a script that runs before the layer is parsed (before paint and
// before React), and opening.test.mjs calls it with a fake window and document.
//
// Modes, written to <html data-opening>:
//   'first'  the first visit ever on this device (localStorage has no mark): OPENING_FIRST_MS in all;
//   'short'  the first load of a new browser session (sessionStorage has no mark): OPENING_SHORT_MS;
//   'skip'   everything else: a load later in the same session, reduced motion (the device setting or the site's own
//            data-motion switch), a hash or deep entry (a #section link, a back/forward load, a page already scrolled,
//            the app's own web view), a same-origin referrer (coming back to / from inside the site), a signed-in
//            student (the Supabase session cookie, readable before paint), a bot or a driven browser
//            (navigator.webdriver), and any storage error (so it can never run twice in a session).
//   'done'   set when the hand-off has finished; the layer is display:none from then on (opening.css).
// It also writes <html data-signed-in="1"> when the session cookie is there, which HeroTyped reads (no typing then).
//
// While it runs, any pointerdown, touchstart, wheel or keydown jumps straight to the hand-off, so it never holds a
// student. The hand-off is a FLIP of the composed word onto the bar logo's own box (both are Logo.jsx's viewBox, so
// it is a pure translate plus scale) while the ground fades and lifts. Every visual step is CSS (opening.css) and ends
// on visibility:hidden by itself; this script only measures the FLIP, handles a skip and says when it is done:
// window event 'mm:opening' with detail { phase: 'handoff' | 'done', mode }, and window.__mmOpening for late readers.

/** The whole opening on a first-ever visit, ms from first paint (L-043: logo B, about 1.3 to 1.6 s, skippable). */
export const OPENING_FIRST_MS = 1600;
/** The whole opening on the first load of a new session. */
export const OPENING_SHORT_MS = 1280;
/** The hand-off at the end of either: the FLIP onto the bar logo and the ground's lift. */
export const OPENING_HAND_MS = 280;
/** Storage marks (the site's mm:*:v1 convention). */
export const OPENING_KEYS = Object.freeze({ ever: 'mm:opened:v1', session: 'mm:opening:v1' });
/** The inputs that skip to the hand-off. */
export const OPENING_SKIP_EVENTS = Object.freeze(['pointerdown', 'touchstart', 'wheel', 'keydown']);

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

  var t0 = w.performance.now();
  var total = mode === 'first' ? cfg.first : cfg.short;
  st.t0 = t0;
  st.hand = total - cfg.hand;
  st.end = total;
  var timers = [];
  var later = function (fn, ms) { timers.push(w.setTimeout(fn, Math.max(0, ms))); };
  var now = function () { return w.performance.now() - t0; };
  var layer = function () { return d.querySelector('.mo-open'); };
  var emit = function (phase) {
    st.phase = phase;
    try { w.dispatchEvent(new w.CustomEvent('mm:opening', { detail: { phase: phase, mode: mode } })); } catch (e) { /* old browser */ }
  };
  // FLIP: the composed word's box (never transformed itself) onto the bar logo's box. `delay` is ms from now.
  // Everything the script writes goes on <html> (suppressHydrationWarning, like the theme script), never on the
  // layer, so React hydrates the layer exactly as the server drew it.
  var flip = function (delay) {
    var el = layer();
    var word = el && el.querySelector('.mo-word');
    var target = d.querySelector('.mm-nav .logo-b');
    if (!word || !target) return false;
    var a = word.getBoundingClientRect();
    var b = target.getBoundingClientRect();
    if (!a.width || !b.width) return false;
    html.style.setProperty('--mo-fx', (b.left + b.width / 2 - (a.left + a.width / 2)).toFixed(2) + 'px');
    html.style.setProperty('--mo-fy', (b.top + b.height / 2 - (a.top + a.height / 2)).toFixed(2) + 'px');
    html.style.setProperty('--mo-fs', (b.width / a.width).toFixed(4));
    html.style.setProperty('--mo-flip-delay', Math.max(0, Math.round(delay)) + 'ms');
    html.setAttribute('data-opening-flip', '');
    return true;
  };
  var off = function () { for (var i = 0; i < cfg.events.length; i++) w.removeEventListener(cfg.events[i], cut, true); };
  var done = function () {
    off();
    for (var i = 0; i < timers.length; i++) w.clearTimeout(timers[i]);
    html.setAttribute('data-opening', 'done');
    emit('done');
  };
  var handoff = function () {
    html.setAttribute('data-opening-phase', 'out');
    emit('handoff');
  };
  // A skip: everything jumps to its rest pose and the hand-off starts now (opening.css html[data-opening-cut]).
  function cut() {
    if (st.phase !== 'run') return;
    st.cutAt = now();
    for (var i = 0; i < timers.length; i++) w.clearTimeout(timers[i]);
    timers = [];
    html.setAttribute('data-opening-cut', '');
    flip(0);
    handoff();
    later(done, cfg.hand + 40);
  }
  for (var i = 0; i < cfg.events.length; i++) w.addEventListener(cfg.events[i], cut, { capture: true, passive: true });
  // The bar logo is parsed just after the layer: measure it on the first frames, before the hand-off starts.
  var tries = 0;
  var seek = function () {
    if (st.phase !== 'run' || html.hasAttribute('data-opening-flip')) return;
    if (flip(st.hand - now())) return;
    tries += 1;
    if (tries < 90 && now() < st.hand - 16) w.requestAnimationFrame(seek);
  };
  w.requestAnimationFrame(seek);
  later(handoff, st.hand);
  later(done, st.end + 40);
  return mode;
}

/** The inline script OpeningMo.jsx renders (before its layer). */
export function openingGateScript() {
  const cfg = { first: OPENING_FIRST_MS, short: OPENING_SHORT_MS, hand: OPENING_HAND_MS, ever: OPENING_KEYS.ever, session: OPENING_KEYS.session, events: [...OPENING_SKIP_EVENTS] };
  return `(${openingGate.toString()})(window,document,${JSON.stringify(cfg)})`;
}
