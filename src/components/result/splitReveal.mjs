// When "Where your marks went" reveals. PURE, so the rule is tested without a browser.
//
// The ledger is held back (phase 'armed') only until its bar is first reached. The bar is 14 px tall, so it is never gated on
// being wholly in view (threshold 1 left the whole panel blank when the page opened below it: a scroll restore, a deep link,
// a keyboard jump to the part). The reveal is:
//   'split'  the bar has any part in view (the bottom 12 percent of the screen does not count), play the split once
//   'still'  the bar is already above the viewport, so the page was opened past it: show the final state, no animation
//   null     the bar is still below the fold, or not laid out yet: keep waiting
// A bar with no height is not laid out (its part is closed, display: none): that is not "above the viewport", keep waiting.
export function splitPhaseFor({ isIntersecting, bottom, height = 14, rootTop = 0 }) {
  if (isIntersecting) return 'split';
  if (height > 0 && Number.isFinite(bottom) && bottom <= rootTop) return 'still';
  return null;
}
export const SPLIT_OBSERVER = Object.freeze({ threshold: 0, rootMargin: '0px 0px -12% 0px' });
