// The peek's arithmetic for the sideways-scroll cue (owner G27, 19 Oct 2026; railCue.js uses it). PURE, so it is tested on
// its own in src/components/start/__tests__/startModel.test.mjs.

/** The share of the last item in view that shows: "cut at about 60% of its width". */
export const PEEK = 0.6;

/**
 * The shared width for the row's items, or null when the row needs none (it fits, or no width can give the peek).
 * Arithmetic over measured numbers:
 *   avail  the row's visible width from the first item's start to the place the peek is measured to
 *   gap    the space between items;  n  how many items;  min / max  the allowed item width
 * The largest k (items fully in view) whose width W = (avail - k * gap) / (k + peek) is at least `min` wins, when W is
 * also no wider than `max`; otherwise there is no width that gives the peek and the row keeps its natural widths. k stops
 * at n - 1, so the row always still overflows.
 */
export function peekWidth({ avail, gap = 0, n, min, max = Infinity, peek = PEEK }) {
  if (!(avail > 0) || !(n > 1) || min > max) return null;
  for (let k = n - 1; k >= 1; k -= 1) {
    const w = (avail - k * gap) / (k + peek);
    if (w >= min) return w <= max ? Math.round(w * 10) / 10 : null;
  }
  return null;
}

