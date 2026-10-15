// How the landing moves the page for its own links (DemoJump.jsx): from far down it cuts most of the way at once
// and glides the last screen, rather than whirling through every section (a long smooth scroll over this page
// stalls where sections draw in, which is how the logo and the in-page links used to fail). The reader always
// wins: a wheel, a touch or a key during the glide hands the page back at once and nothing pulls it again.
// Reduce motion jumps.

export const reducedNow = () => {
  if (document.documentElement.dataset.motion === 'reduced') return true;
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

/** The bottom edge of the bar's own row (the menu sheet, when open, hangs below it and is not counted). */
export function navBottom() {
  const row = document.querySelector('.mm-nav__row') || document.querySelector('.mm-nav');
  if (!row) return 0;
  const box = row.getBoundingClientRect();
  return box.bottom > 0 ? box.bottom + 6 : 0;
}

/** Page scroll that puts `node` just under the bar. */
export function topFor(node, gap = 12) {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const top = window.scrollY + node.getBoundingClientRect().top - navBottom() - gap;
  return Math.round(Math.max(0, Math.min(max, top)));
}

const TAKE_BACK = ['wheel', 'touchstart', 'keydown', 'pointerdown'];

/**
 * Scroll to the place `topOf()` names (read again as the page settles, since sections above it may change height).
 * Calls `done` once the page has arrived (not when the reader took over). Returns a function that cancels it.
 */
export function glideTo(topOf, done) {
  let frame = 0;
  let timer = 0;
  let live = true;
  let unwatch = () => {};

  const stop = () => {
    live = false;
    cancelAnimationFrame(frame);
    window.clearTimeout(timer);
    unwatch();
  };
  const watchReader = () => {
    const handBack = () => stop();
    for (const type of TAKE_BACK) window.addEventListener(type, handBack, { passive: true, once: true, capture: true });
    unwatch = () => { for (const type of TAKE_BACK) window.removeEventListener(type, handBack, { capture: true }); };
  };
  const arrive = () => {
    if (!live) return;
    const top = topOf();
    if (Math.abs(window.scrollY - top) > 6) window.scrollTo({ top, behavior: 'instant' });
    stop();
    if (done) done();
  };
  const smoothTo = () => {
    window.addEventListener('scrollend', arrive, { once: true });
    const base = unwatch;
    unwatch = () => { base(); window.removeEventListener('scrollend', arrive); };
    timer = window.setTimeout(arrive, 1200);
    window.scrollTo({ top: topOf(), behavior: 'smooth' });
  };

  const top = topOf();
  if (reducedNow() || Math.abs(window.scrollY - top) < 2) {
    window.scrollTo({ top, behavior: 'instant' });
    stop();
    if (done) done();
    return stop;
  }
  watchReader();
  if (Math.abs(window.scrollY - top) > window.innerHeight * 2) {
    const lead = Math.round(window.innerHeight * 0.85);
    window.scrollTo({ top: window.scrollY > top ? top + lead : Math.max(0, top - lead), behavior: 'instant' });
    // A frame for the sections around the target to draw, then the glide to its final place.
    frame = requestAnimationFrame(() => { frame = requestAnimationFrame(() => { if (live) smoothTo(); }); });
  } else {
    smoothTo();
  }
  return stop;
}
