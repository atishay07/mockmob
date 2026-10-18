// The cue below the fold on Today (W-044, release 10): where its circle sits, when a key is under it, and when it shows. PURE.
// The circle's band, from the viewport's bottom edge: its bottom is 92 px up (the dock is 64 px tall, 12 px above the safe area, so the
// circle keeps 16 px clear of it), it is 40 px tall and centred. 8 px of air counts as covered.
export const CUE_BOTTOM = 92;
export const CUE_SIZE = 40;
/** The cue shows while the week's top is lower than this far above the viewport's bottom edge (the circle's band and its air). */
export const CUE_FOLD = 96;
/** The first scroll of this many px says the student has found the page goes on; the cue then steps away for the visit. */
export const CUE_SCROLLED = 24;
const AIR = 8;

/**
 * Whether a rect (a DOMRect's top, bottom, left, right) overlaps the circle's band in a viewport of `height` x `width`. `half` is half
 * the cue's own width (20 for the circle; more while it still carries its words).
 */
export function coversCue(rect, { height, width, half = CUE_SIZE / 2 }) {
  if (!rect) return false;
  const top = height - CUE_BOTTOM - CUE_SIZE - AIR;
  const bottom = height - CUE_BOTTOM + AIR;
  const left = width / 2 - half - AIR;
  const right = width / 2 + half + AIR;
  return rect.bottom > top && rect.top < bottom && rect.right > left && rect.left < right;
}

/** Whether the week starts below the fold: its top is more than `height - CUE_FOLD` down the viewport. */
export const belowFold = (weekTop, height) => Number.isFinite(weekTop) && weekTop > height - CUE_FOLD;
