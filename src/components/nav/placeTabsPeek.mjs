// The sideways cue for the phone's row of place tabs (owner G27, as on the Start sheet and the Practice shelf; WEB-NAV-1019
// option A). PURE, so data/tests/web_nav_a_1019.test.mjs checks it on its own; PlaceTabs.jsx measures and applies it.
//
// A tab cut at the screen's edge says "there is more this way"; a whole tab and an empty edge say "this is the end". The tabs
// keep their own widths (they are words, not tiles), so the cut is steered with their side padding instead: the padding
// closest to the designed 16 px that puts the right edge between 30% and 70% of a tab is used.

/** The designed side padding of a tab, and the range the peek may move it in (a 44 px tall pill stays a pill). */
export const TAB_PAD = 16;
export const TAB_PAD_MIN = 12;
export const TAB_PAD_MAX = 22;
/** The share of the last tab in view that should show. */
export const PEEK_LO = 0.3;
export const PEEK_HI = 0.7;

/** The first-open nudge, the same move as the Start sheet's rail (railCue.js): 24 px out on ease-out, back on the settle. */
export const NUDGE_PX = 24;
export const NUDGE_OUT_MS = 300;
export const NUDGE_BACK_MS = 460;
export const NUDGE_EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
export const NUDGE_SETTLE = 'cubic-bezier(0.22, 1, 0.36, 1)';
/** Waits for the page's own entrance (the place transition is about 420 ms) before the row moves. */
export const NUDGE_DELAY_MS = 700;
/** Once per device. */
export const NUDGE_KEY = 'mm:cue:place-tabs:v1';

const widths = (contents, pad) => contents.map((w) => w + 2 * pad);
const total = (contents, pad, gap) => widths(contents, pad).reduce((sum, w) => sum + w, 0) + gap * Math.max(0, contents.length - 1);

/**
 * How much of the tab under the right edge shows, 0 to 1. 0 when the edge falls in a gap (no tab is cut); 1 when nothing
 * reaches the edge.
 *   contents  each tab's width without its side padding (px);  pad  the side padding;  gap  the space between tabs;
 *   avail     the visible width from the first tab's left edge to the row's right edge
 */
export function cutShare({ contents, pad, gap = 0, avail }) {
  let x = 0;
  for (const w of widths(contents, pad)) {
    if (x >= avail) return 0;
    if (x + w > avail) return (avail - x) / w;
    x += w + gap;
  }
  return 1;
}

/**
 * The side padding for the row, or null when the row fits at the designed padding (no cue is needed then).
 * Tries TAB_PAD first, then 1 px either side of it outward; the first padding at which the row still overflows and the cut
 * shows between PEEK_LO and PEEK_HI of a tab wins. When none does, the designed padding stays.
 */
export function peekPadding({ contents, gap = 0, avail, base = TAB_PAD, min = TAB_PAD_MIN, max = TAB_PAD_MAX, lo = PEEK_LO, hi = PEEK_HI }) {
  if (!Array.isArray(contents) || contents.length < 2 || !(avail > 0)) return null;
  if (total(contents, base, gap) <= avail) return null;
  const tries = [base];
  for (let step = 1; base - step >= min || base + step <= max; step += 1) {
    if (base - step >= min) tries.push(base - step);
    if (base + step <= max) tries.push(base + step);
  }
  for (const pad of tries) {
    if (total(contents, pad, gap) <= avail) continue;
    const share = cutShare({ contents, pad, gap, avail });
    if (share >= lo && share <= hi) return { pad, share };
  }
  return { pad: base, share: cutShare({ contents, pad: base, gap, avail }) };
}

/** Where the row should start so the current tab is in view: 0 when it already is, else the current tab centred. */
export function scrollToShow({ left, width, view, scrollWidth, edge = 24 }) {
  if (left + width <= view - edge) return 0;
  const centred = left - (view - width) / 2;
  return Math.max(0, Math.min(scrollWidth - view, Math.round(centred)));
}
