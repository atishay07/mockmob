// The route progress bar (owner, 16 Nov 2026: "an overall progress bar on the top for the website"): when it starts, when
// it shows, when it ends. Pure and dependency free: RouteProgress.jsx and routeProgressBus.mjs give it real timers and a
// renderer, routeProgressModel.test.mjs a fake clock.
//
//   start    a navigation began (a same-origin link, the router, the back button). Nothing shows yet.
//   +120 ms  still pending: the bar shows and trickles toward 90 % (route-progress.css, trickleAt below). A navigation that
//            lands sooner shows nothing at all.
//   finish   the new address is on screen: the bar completes and fades (200 ms), then it is idle again.
//   safety   10 s after the start it finishes whatever happened, so it can never stay on screen.
//
// Phases the renderer is told about: 'run' (show and trickle), 'done' (complete and fade), 'idle' (hidden).

export const ROUTE_PROGRESS = Object.freeze({
  /** A navigation pending for less than this shows nothing. */
  delayMs: 120,
  /** Complete and fade, from arrival to hidden. */
  finishMs: 200,
  /** The longest it ever runs: then it finishes by itself. */
  safetyMs: 10000,
  /** Where the trickle starts and where it stops: it never claims to be done before the page is. */
  from: 0.08,
  cap: 0.9,
  /** The trickle's time constant: about 46 % at 1 s, 67 % at 2 s, 86 % at 5 s. */
  tauMs: 1600,
  /** The CSS trickle's length (route-progress.css keyframes); it holds at its last value after. */
  trickleMs: 8000,
});

/** The bar's scale `ms` after it shows: an ease toward the cap that slows as it goes (route-progress.css samples it). */
export function trickleAt(ms, p = ROUTE_PROGRESS) {
  const t = Math.max(0, ms);
  return p.cap - (p.cap - p.from) * Math.exp(-t / p.tauMs);
}

/** The address a navigation lands on, without its #fragment: two addresses that differ only by a hash are one page. */
export function pageKey(href) {
  try {
    const u = new URL(href);
    return `${u.origin}${u.pathname}${u.search}`;
  } catch {
    return '';
  }
}

/**
 * Does this click on this link start a page navigation the bar should follow? Plain data in, so it is testable:
 *   click  { button, metaKey, ctrlKey, shiftKey, altKey }
 *   link   { href (resolved, absolute), target, download, optOut, disabled, popup }
 *   here   the current address (absolute)
 * No for: another button or a modified click (a new tab or window), target other than _self, a download, another origin,
 * a non-web scheme (mailto:, tel:), the same page (same path and query, a #fragment only), and links that say they open
 * something on this page instead (aria-haspopup, aria-controls, role=button, aria-disabled, data-no-route-progress).
 */
export function linkStartsNavigation(click, link, here) {
  if (!click || !link || !link.href) return false;
  if ((click.button ?? 0) !== 0) return false;
  if (click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) return false;
  if (link.target && link.target !== '_self') return false;
  if (link.download || link.optOut || link.disabled || link.popup) return false;
  let to;
  let from;
  try {
    to = new URL(link.href);
    from = new URL(here);
  } catch {
    return false;
  }
  if (to.protocol !== 'http:' && to.protocol !== 'https:') return false;
  if (to.origin !== from.origin) return false;
  return pageKey(to.href) !== pageKey(from.href);
}

/**
 * The bar's state machine. `setTimer(fn, ms)` returns an id for `clearTimer(id)`; `render(phase)` draws 'run', 'done' or
 * 'idle'. `start({ confirm })`: `confirm()` is asked when the delay is up (false: it was not a navigation after all, for
 * example a link that opened a sheet instead) and the bar never shows.
 */
export function createRouteProgress({ setTimer, clearTimer, render, params = ROUTE_PROGRESS }) {
  let phase = 'idle'; // 'idle' | 'wait' | 'run' | 'done'
  let showTimer = null;
  let safetyTimer = null;
  let endTimer = null;
  let confirm = null;
  const clear = (id) => { if (id != null) clearTimer(id); return null; };

  const to = (next) => {
    const was = phase;
    phase = next;
    if (next === 'run' || next === 'done') render(next);
    else if (next === 'idle' && (was === 'run' || was === 'done')) render('idle');
  };

  function finish() {
    showTimer = clear(showTimer);
    safetyTimer = clear(safetyTimer);
    confirm = null;
    if (phase === 'wait') { to('idle'); return; }
    if (phase !== 'run') return;
    to('done');
    endTimer = setTimer(() => { endTimer = null; to('idle'); }, params.finishMs);
  }

  function start(opts = {}) {
    safetyTimer = clear(safetyTimer);
    safetyTimer = setTimer(finish, opts.safetyMs ?? params.safetyMs);
    if (phase === 'wait' || phase === 'run') {
      // Another navigation while one is pending: the bar keeps going; a later doubtful start never cancels a sure one.
      if (phase === 'wait' && confirm && !opts.confirm) confirm = null;
      return;
    }
    endTimer = clear(endTimer);
    if (phase === 'done') to('idle');
    confirm = opts.confirm || null;
    phase = 'wait';
    showTimer = setTimer(() => {
      showTimer = null;
      if (confirm && !confirm()) { safetyTimer = clear(safetyTimer); confirm = null; to('idle'); return; }
      confirm = null;
      to('run');
    }, params.delayMs);
  }

  /** Back to idle at once with nothing drawn (a page restored from the back-forward cache). */
  function reset() {
    showTimer = clear(showTimer);
    safetyTimer = clear(safetyTimer);
    endTimer = clear(endTimer);
    confirm = null;
    to('idle');
  }

  return { start, finish, reset, phase: () => phase };
}
