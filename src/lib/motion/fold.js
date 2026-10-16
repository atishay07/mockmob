import { isMotionReduced } from './draw';
import { durations, ease } from './tokens.g.js';

/**
 * Folds a row away: its height, spacing and opacity close together so the rows below slide up
 * instead of jumping. 200 ms on ease-out (pass 1016e WA-06, the app's M24): after a swipe the row has
 * already left on the lift spring, so the gap closes at once; a tap removal folds the same way.
 * Resolves when finished (immediately with reduced motion); the caller then removes the row from state.
 */
export function foldExit(element, { duration = durations.ui } = {}) {
  if (!element || isMotionReduced() || typeof element.animate !== 'function') return Promise.resolve();
  const box = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  element.style.overflow = 'hidden';
  const animation = element.animate(
    [
      { height: `${box.height}px`, opacity: 1, marginTop: style.marginTop, marginBottom: style.marginBottom, paddingTop: style.paddingTop, paddingBottom: style.paddingBottom },
      { height: '0px', opacity: 0, marginTop: '0px', marginBottom: '0px', paddingTop: '0px', paddingBottom: '0px' },
    ],
    { duration, easing: ease.out, fill: 'forwards' },
  );
  return animation.finished.then(() => undefined).catch(() => undefined);
}
