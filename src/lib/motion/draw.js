// Stroke draw-on: a line that inks itself in. Works on any SVG path or polyline.
// CSS route: give the element pathLength="1" and the class "mk-draw" (see motion-kit.css).
// Script route: drawOn(element, { duration, delay }) for a path that is already in the page.

export function isMotionReduced() {
  if (typeof document === 'undefined') return false;
  if (document.documentElement.dataset.motion === 'reduced') return true;
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

/** Inks a stroke from its start to its end. Resolves when done. Reduced motion shows it finished. */
export function drawOn(element, { duration = 420, delay = 0, easing = 'cubic-bezier(0.23, 1, 0.32, 1)' } = {}) {
  if (!element || isMotionReduced() || typeof element.animate !== 'function') return Promise.resolve();
  let length = 0;
  try { length = element.getTotalLength(); } catch { length = 0; }
  if (!length) return Promise.resolve();
  const animation = element.animate(
    [{ strokeDasharray: `${length} ${length}`, strokeDashoffset: length }, { strokeDasharray: `${length} ${length}`, strokeDashoffset: 0 }],
    { duration, delay, easing, fill: 'both' },
  );
  return animation.finished
    .then(() => { try { animation.cancel(); } catch { /* The finished line stays as drawn. */ } })
    .catch(() => {});
}
