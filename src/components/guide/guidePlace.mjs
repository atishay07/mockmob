// Where the guide's card stands (pure, so a test can hold it). The card sits on the side of the target with the most room,
// GUIDE_GAP px from it and GUIDE_EDGE px inside the screen, and never over the target. `safe` is the band the card may use:
// below the top bar and above the dock, so it never sits under either. All numbers are CSS px in the viewport.

export const GUIDE_GAP = 14;
export const GUIDE_EDGE = 16;
/** The ring stands this far outside the target. */
export const GUIDE_RING_PAD = 4;
/** The card's width on a screen `screenWidth` wide: the screen less 32 px, 380 px at most. */
export const GUIDE_CARD_MAX = 380;
export function guideCardWidth(screenWidth) {
  return Math.max(0, Math.min(GUIDE_CARD_MAX, Math.round(screenWidth) - GUIDE_EDGE * 2));
}

const clamp = (n, lo, hi) => Math.min(Math.max(n, lo), Math.max(lo, hi));
// How close to a corner of the card the nub may stand.
const NUB_INSET = 22;

/**
 * target: { left, top, width, height } (the ring's box); card: { width, height }; screen: { width, height };
 * safe: { top, bottom } (the top bar's lower edge and the dock's upper edge; 0 and the screen's height when there is none).
 * Returns { left, top, side, nub, fits }: `side` is where the card is from the target ('above', 'below', 'left', 'right'),
 * `nub` is how far along the card's facing edge its pointer stands (px from the card's left or top), and `fits` is false only
 * when no side has room (the card then takes the roomiest side and may touch the target).
 */
export function placeGuideCard({ target, card, screen, safe = {} }) {
  const right = target.left + target.width;
  const bottom = target.top + target.height;
  const bandTop = Math.max(GUIDE_EDGE, Number.isFinite(safe.top) ? safe.top + 8 : 0);
  const bandBottom = Math.min(screen.height - GUIDE_EDGE, Number.isFinite(safe.bottom) ? safe.bottom - 8 : screen.height);
  const minLeft = GUIDE_EDGE;
  const maxLeft = screen.width - GUIDE_EDGE - card.width;
  const cx = target.left + target.width / 2;
  const cy = target.top + target.height / 2;

  const sides = {
    below: { room: bandBottom - bottom, top: Math.max(bottom + GUIDE_GAP, bandTop), left: clamp(cx - card.width / 2, minLeft, maxLeft) },
    above: { room: target.top - bandTop, top: Math.min(target.top - GUIDE_GAP, bandBottom) - card.height, left: clamp(cx - card.width / 2, minLeft, maxLeft) },
    right: { room: screen.width - GUIDE_EDGE - right, left: right + GUIDE_GAP, top: clamp(cy - card.height / 2, bandTop, bandBottom - card.height) },
    left: { room: target.left - GUIDE_EDGE, left: target.left - GUIDE_GAP - card.width, top: clamp(cy - card.height / 2, bandTop, bandBottom - card.height) },
  };
  sides.below.ok = sides.below.top + card.height <= bandBottom && maxLeft >= minLeft;
  sides.above.ok = sides.above.top >= bandTop && maxLeft >= minLeft;
  // Beside the target only when the card can stand level with it: a key in the top bar or the dock, which the band keeps the
  // card clear of, gets its card below or above instead, so the nub always points at the key.
  const level = bandBottom - bandTop >= card.height && cy >= sides.right.top + NUB_INSET && cy <= sides.right.top + card.height - NUB_INSET;
  sides.right.ok = level && sides.right.left + card.width <= screen.width - GUIDE_EDGE;
  sides.left.ok = level && sides.left.left >= GUIDE_EDGE;

  const order = ['below', 'above', 'right', 'left'];
  const fitting = order.filter((name) => sides[name].ok);
  const pool = fitting.length ? fitting : ['below', 'above'];
  const side = pool.reduce((best, name) => (sides[name].room > sides[best].room ? name : best), pool[0]);
  let { left, top } = sides[side];
  if (!fitting.length) {
    left = clamp(left, minLeft, maxLeft);
    top = clamp(top, bandTop, bandBottom - card.height);
  }
  const vertical = side === 'above' || side === 'below';
  const nub = vertical
    ? clamp(cx - left, NUB_INSET, card.width - NUB_INSET)
    : clamp(cy - top, NUB_INSET, card.height - NUB_INSET);
  return { left: Math.round(left), top: Math.round(top), side, nub: Math.round(nub), fits: fitting.length > 0 };
}

/** True when two boxes ({ left, top, width, height }) share any area. */
export function boxesOverlap(a, b) {
  return a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height;
}
