// Where the page's own volt key is, and whether it is on screen (W-075, release 8).
//
// A page that owns a volt action marks that key data-page-primary (AppLayoutClient reads the mark for the desktop sidebar's
// Start key: from the route, for the whole visit). A key that only exists on a phone, such as the Colleges summary bar or
// Practice's session bar, marks itself data-phone-primary instead, so it never quiets the sidebar of a page that has no key
// there. On a phone the dock has its own lime Start key; while one of these keys is on screen the dock key steps back to its
// quiet look (start.css), so a phone never holds two lime fills, and when the page's key has scrolled away the dock key is
// lime again.
//
// The dock key follows one thing: whether the page's own key is in view. The owner's F12 complaint ("what state is it really
// following?") was a rule that could not tell a key not reached yet from one already passed, and flipped with the scroll
// position; here the answer is always "is that key in the viewport right now", and three things keep it from flickering:
//   1. the view is the band between the top bar and the dock, since a key under either is not seen;
//   2. a key counts as in view once a third of it is (SHOW_AT) and as gone once almost all of it has left (HIDE_AT), so a
//      key resting on an edge cannot flip it back and forth;
//   3. a change waits SETTLE_MS and is dropped if the key moves back first, so a fast flick past a key changes nothing.
// The first reading after a page opens is applied at once, so a page that opens with its key on screen never shows two lime
// keys for even a moment. Pure logic: the browser objects come in through `env`, so a test can drive every case.

export const PRIMARY_SELECTOR = '[data-page-primary], [data-phone-primary]';
export const SHOW_AT = 0.3;
export const HIDE_AT = 0.1;
export const SETTLE_MS = 140;
// Every edge of the dead band is a threshold, so the observer reports each crossing.
export const THRESHOLDS = Object.freeze([0, HIDE_AT, 0.2, SHOW_AT, 0.5, 0.75, 1]);

/** The hysteresis: in view from SHOW_AT up, gone at HIDE_AT and below, and whatever it was in between. The key counts as in
 *  view early (a third of it) so two lime keys are never on screen for long, and as gone late (almost all of it). */
export function nextInView(previous, ratio) {
  if (!(ratio >= 0)) return Boolean(previous);
  if (ratio >= SHOW_AT) return true;
  if (ratio <= HIDE_AT) return false;
  return Boolean(previous);
}

/** The observer's rootMargin for the band a student actually sees: under the top bar, above the dock. */
export function bandMargin({ topEdge = 0, dockTop = null, viewportHeight = 0 } = {}) {
  const top = Math.max(0, Math.round(Number(topEdge) || 0));
  const bottom = dockTop == null || !viewportHeight ? 0 : Math.max(0, Math.round(viewportHeight - dockTop));
  return `-${top}px 0px -${bottom}px 0px`;
}

/**
 * The state machine. report(el, ratio) says how much of one key is in the band, forget(el) says it is gone from the page.
 * onChange(true | false) is called when the dock key should be quiet (true) or lime (false).
 */
export function createPrimaryWatch({ onChange, settleMs = SETTLE_MS, setTimer = globalThis.setTimeout, clearTimer = globalThis.clearTimeout } = {}) {
  const ratios = new Map();
  let shown = false; // what the dock key is showing: true is quiet
  let wanted = false; // what the keys on screen ask for, through the hysteresis
  let timer = null;
  let first = true;
  let live = true;

  const best = () => { let top = 0; for (const value of ratios.values()) if (value > top) top = value; return top; };
  const apply = () => {
    timer = null;
    if (!live || wanted === shown) return;
    shown = wanted;
    onChange?.(shown);
  };
  function update() {
    wanted = nextInView(wanted, best());
    if (wanted === shown) {
      if (timer !== null) { clearTimer(timer); timer = null; }
      first = false;
      return;
    }
    if (first) { first = false; apply(); return; }
    if (timer === null) timer = setTimer(apply, settleMs);
  }
  return {
    report(el, ratio) { if (live) { ratios.set(el, Number(ratio) || 0); update(); } },
    forget(el) { if (live && ratios.delete(el)) update(); },
    dispose() {
      live = false;
      if (timer !== null) { clearTimer(timer); timer = null; }
      ratios.clear();
      if (shown) { shown = false; onChange?.(false); }
    },
    get quiet() { return shown; },
  };
}

/**
 * Watches the keys a page marks inside `main` and calls onChange(true | false) as the dock key should step back or return.
 * Returns the function that stops it (the dock key goes lime again). Without IntersectionObserver the key stays lime.
 */
export function watchPagePrimary(main, { onChange, env = {}, settleMs = SETTLE_MS } = {}) {
  const win = env.window || globalThis.window;
  const doc = env.document || globalThis.document;
  const IO = env.IntersectionObserver || win?.IntersectionObserver;
  const MO = env.MutationObserver || win?.MutationObserver;
  const raf = env.requestAnimationFrame || win?.requestAnimationFrame?.bind(win);
  const caf = env.cancelAnimationFrame || win?.cancelAnimationFrame?.bind(win);
  if (!main || !IO || !MO || !raf || !caf) return () => {};

  const watch = createPrimaryWatch({ onChange, settleMs, setTimer: env.setTimeout, clearTimer: env.clearTimeout });
  const observed = new Set();
  let io = null;
  let margin = null;
  let syncFrame = 0;
  let sizeFrame = 0;
  let stopped = false;

  const onEntries = (entries) => {
    for (const entry of entries) if (observed.has(entry.target)) watch.report(entry.target, entry.isIntersecting ? entry.intersectionRatio : 0);
  };
  const styleOf = env.getComputedStyle || ((el) => win.getComputedStyle(el));
  // The top bar hides what is under it only where it sticks (top 0, 63 px tall), not where it rests when the page is at its
  // top: something may sit above it there (the preview's note does), which would push a rect-based edge down by that much.
  const barEdge = (bar) => {
    if (!bar) return 0;
    const style = styleOf(bar);
    if (style.position !== 'sticky' && style.position !== 'fixed') return 0;
    return (Number.parseFloat(style.top) || 0) + bar.getBoundingClientRect().height;
  };
  const measure = () => {
    const dock = doc.querySelector('.arena-dock');
    const dockRect = dock?.getBoundingClientRect();
    return bandMargin({ topEdge: barEdge(doc.querySelector('.arena-topbar')), dockTop: dockRect && dockRect.height ? dockRect.top : null, viewportHeight: win.innerHeight });
  };
  // The observer is rebuilt only when the band really moved (a rotation, a taller bar), never on every resize event: a phone
  // browser fires them as its address bar slides, and the band does not change when it does.
  const build = () => {
    const next = measure();
    if (io && next === margin) return;
    margin = next;
    io?.disconnect();
    io = new IO(onEntries, { rootMargin: margin, threshold: [...THRESHOLDS] });
    for (const el of observed) io.observe(el);
  };
  const sync = () => {
    if (stopped) return;
    const now = new Set(main.querySelectorAll(PRIMARY_SELECTOR));
    for (const el of [...observed]) if (!now.has(el)) { observed.delete(el); io.unobserve(el); watch.forget(el); }
    for (const el of now) if (!observed.has(el)) { observed.add(el); io.observe(el); }
  };

  build();
  sync();
  const mo = new MO(() => { if (!syncFrame) syncFrame = raf(() => { syncFrame = 0; sync(); }); });
  mo.observe(main, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-page-primary', 'data-phone-primary'] });
  const onResize = () => { if (!sizeFrame) sizeFrame = raf(() => { sizeFrame = 0; if (!stopped) build(); }); };
  win.addEventListener('resize', onResize);

  return () => {
    stopped = true;
    mo.disconnect();
    io?.disconnect();
    win.removeEventListener('resize', onResize);
    if (syncFrame) caf(syncFrame);
    if (sizeFrame) caf(sizeFrame);
    observed.clear();
    watch.dispose();
  };
}
