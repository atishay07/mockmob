// The cue below the fold on Today (W-044, release 10): where its circle sits and when a key is under it. PURE.
// The circle's band, from the viewport's bottom edge: its bottom is 96 px up (the dock is 64 px tall, 12 px above the safe
// area, so the circle keeps 20 px clear of it) and it is 44 px tall, 16 px in from the right. 8 px of air counts as covered.
export const CUE_BOTTOM = 96;
export const CUE_SIZE = 44;
export const CUE_RIGHT = 16;
const AIR = 8;

/** Whether a rect (a DOMRect's top, bottom, left, right) overlaps the circle's band in a viewport of `height` x `width`. */
export function coversCue(rect, { height, width }) {
  if (!rect) return false;
  const top = height - CUE_BOTTOM - CUE_SIZE - AIR;
  const bottom = height - CUE_BOTTOM + AIR;
  const left = width - CUE_RIGHT - CUE_SIZE - AIR;
  return rect.bottom > top && rect.top < bottom && rect.right > left && rect.left < width;
}
