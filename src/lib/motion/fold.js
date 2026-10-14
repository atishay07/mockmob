import { isMotionReduced } from './draw';

/**
 * Folds a row away: its height, spacing and opacity close together so the rows below slide up
 * instead of jumping. Resolves when finished (immediately with reduced motion); the caller then
 * removes the row from state.
 */
export function foldExit(element, { duration = 260 } = {}) {
  if (!element || isMotionReduced() || typeof element.animate !== 'function') return Promise.resolve();
  const box = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  element.style.overflow = 'hidden';
  const animation = element.animate(
    [
      { height: `${box.height}px`, opacity: 1, marginTop: style.marginTop, marginBottom: style.marginBottom, paddingTop: style.paddingTop, paddingBottom: style.paddingBottom },
      { height: '0px', opacity: 0, marginTop: '0px', marginBottom: '0px', paddingTop: '0px', paddingBottom: '0px' },
    ],
    { duration, easing: 'cubic-bezier(0.32, 0.72, 0, 1)', fill: 'forwards' },
  );
  return animation.finished.then(() => undefined).catch(() => undefined);
}
