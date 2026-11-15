// The route progress bar's one instance per page (window.__mmRouteProgress), so every caller reaches the same bar: the bar
// itself (RouteProgress.jsx), any code that navigates by hand (startRouteProgress before a slow router.push), and the
// router's own start hook (src/instrumentation-client.js, onRouterTransitionStart, when it is wired: see wireRouterProgress).
// A start that comes before the bar has mounted is kept and played when it does.

import { ROUTE_PROGRESS, createRouteProgress, pageKey } from './routeProgressModel.mjs';

const KEY = '__mmRouteProgress';

function bus(w = typeof window === 'undefined' ? null : window) {
  if (!w) return null;
  if (!w[KEY]) {
    w[KEY] = { model: null, queued: null, hooked: false };
  }
  return w[KEY];
}

/** RouteProgress.jsx: hand the bus a renderer. Returns the detach function. */
export function attachRouteProgress(render, { w, setTimer, clearTimer } = {}) {
  const win = w || (typeof window === 'undefined' ? null : window);
  const b = bus(win);
  if (!b) return () => {};
  b.model = createRouteProgress({
    setTimer: setTimer || ((fn, ms) => win.setTimeout(fn, ms)),
    clearTimer: clearTimer || ((id) => win.clearTimeout(id)),
    render,
  });
  if (b.queued) { const opts = b.queued; b.queued = null; b.model.start(opts); }
  const model = b.model;
  return () => { if (b.model === model) { model.reset(); b.model = null; } };
}

/**
 * A navigation is starting. Call it just before a slow router.push or router.replace (a link click and the back button
 * start it by themselves). `confirm` (internal) is asked when the bar is about to show.
 */
export function startRouteProgress(opts = {}, w) {
  const b = bus(w);
  if (!b) return;
  if (b.model) b.model.start(opts);
  else b.queued = { ...opts, safetyMs: opts.safetyMs ?? ROUTE_PROGRESS.safetyMs };
}

/** The new page is on screen (RouteProgress.jsx calls it when the path or the query changes). */
export function finishRouteProgress(w) {
  const b = bus(w);
  if (!b) return;
  b.queued = null;
  if (b.model) b.model.finish();
}

/** A page restored from the back-forward cache: nothing is loading. */
export function resetRouteProgress(w) {
  const b = bus(w);
  if (!b) return;
  b.queued = null;
  if (b.model) b.model.reset();
}

/**
 * The router's start hook. In src/instrumentation-client.js, call wireRouterProgress() once at the top and
 * routerTransitionStarted(url, navigationType) first thing in onRouterTransitionStart: then every navigation the router
 * makes (links, router.push and replace, back and forward) starts the bar exactly, and a link whose click was taken over
 * by its page (a sheet that opens instead) never starts it.
 */
export function wireRouterProgress(w) {
  const b = bus(w);
  if (b) b.hooked = true;
}
export function routerTransitionStarted(url, navigationType, w) {
  const win = w || (typeof window === 'undefined' ? null : window);
  const b = bus(win);
  if (!b) return;
  b.hooked = true;
  // Only a move to another page: the same address again (a refresh-like replace) would never change the path or the
  // query, and the back and forward buttons have already moved the address (RouteProgress.jsx's popstate starts those).
  let here = '';
  let to = '';
  try {
    here = pageKey(win.location.href);
    to = pageKey(new URL(url, win.location.href).href);
  } catch { return; }
  if (navigationType === 'traverse' || !to || to === here) return;
  startRouteProgress({}, win);
}
/** Is the router's start hook wired (so a link click the page took over can be told from a navigation)? */
export function routerHooked(w) {
  const b = bus(w);
  return Boolean(b && b.hooked);
}
