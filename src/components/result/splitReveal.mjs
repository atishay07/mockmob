// When "Where your marks went" reveals. PURE, so the rule is tested without a browser.
//
// The ledger is held back (phase 'armed') only until its bar is first reached. The bar is 14 px tall, so it is never gated on
// being wholly in view (threshold 1 left the whole panel blank when the page opened below it: a scroll restore, a deep link,
// a keyboard jump to the part). An IntersectionObserver is not enough either: a jump from above the bar to below it crosses no
// threshold and never fires. So the page asks on mount and on every scroll and resize, and the answer is:
//   'split'  the bar has any part in view (the bottom 12 percent of the screen does not count), play the split once
//   'still'  the bar is already above the viewport, so the page was opened past it: show the final state, no animation
//   null     the bar is still below the fold, or not laid out (its part is closed): keep waiting
export const SPLIT_BOTTOM_INSET = 0.12;
export function splitPhaseAt({ top, bottom, height, viewport }) {
  if (!(height > 0) || !(viewport > 0)) return null;
  if (bottom <= 0) return 'still';
  if (top < viewport * (1 - SPLIT_BOTTOM_INSET)) return 'split';
  return null;
}
