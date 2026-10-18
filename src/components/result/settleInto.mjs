// Bring a row to the top of the page and keep it there while the page settles (R7 M6). A jump (?q=N, a chip, Repair next)
// opens a part and a row in the same frame it scrolls, so the part's 8 px rise and anything above that is still growing move
// the row after the scroll has aimed: it ended up to 50 px off, sometimes under the sticky part heading. This aims again
// once the scroll ends (or after `wait` ms where `scrollend` is missing), at most `tries` more times, and stops the moment
// the student scrolls, taps or presses a key, so it never pulls the page away from them.

const USER = ['wheel', 'touchstart', 'pointerdown', 'keydown'];

// One settle at a time: a new jump ends the one still running (kept here, not in the component, so the page holds no ref for it).
let active = null;

/** Ends the settle that is running, if any (a page leaving, or a new jump starting). */
export function cancelSettle() { if (active) active(); }

/** Scroll `el` to `block: 'start'` (its scroll-margin-top clears the sticky bars) and correct once the layout settles. Returns stop(). */
export function settleInto(el, { behavior = 'smooth', tolerance = 4, tries = 2, wait = 900 } = {}) {
  cancelSettle();
  if (!el || typeof window === 'undefined') return () => {};
  let left = tries;
  let timer = 0;
  let stopped = false;
  const offset = () => el.getBoundingClientRect().top - (parseFloat(window.getComputedStyle(el).scrollMarginTop) || 0);
  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (active === stop) active = null;
    window.clearTimeout(timer);
    window.removeEventListener('scrollend', onEnd);
    for (const t of USER) window.removeEventListener(t, stop, true);
  };
  const check = () => {
    if (stopped) return;
    if (!el.isConnected || Math.abs(offset()) <= tolerance || left <= 0) { stop(); return; }
    left -= 1;
    el.scrollIntoView({ behavior, block: 'start' });
    window.clearTimeout(timer);
    timer = window.setTimeout(check, wait);
  };
  // A frame after the scroll ends, so a layout change in that frame is measured too.
  function onEnd() { window.clearTimeout(timer); timer = window.setTimeout(check, 60); }
  el.scrollIntoView({ behavior, block: 'start' });
  window.addEventListener('scrollend', onEnd);
  for (const t of USER) window.addEventListener(t, stop, { capture: true, passive: true });
  timer = window.setTimeout(check, wait);
  active = stop;
  return stop;
}
