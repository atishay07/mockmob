"use client";

import { useEffect, useRef, useState } from 'react';

// The home page's count-up (from the numbers band, LiveStatsBand, which R3-D7 folded into the plan card): a true number counts
// up once, when its block is 40% in view (R3-D10, the loading kit), in 900 ms with an ease-out, then rests on the real value.
// Hand-rolled so the page pulls in no animation runtime for a few numbers on a budget Android. Reduced motion draws the real
// value straight away. The number a screen reader hears is always the real one (the caller keeps the counting digits
// aria-hidden), and the count never rests on a figure that is not true.

/** Flips true once `ref`'s element is `threshold` in view (or on the next frame without IntersectionObserver). */
export function useSeenOnce(ref, threshold = 0.4) {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      const id = requestAnimationFrame(() => setSeen(true));
      return () => cancelAnimationFrame(id);
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) { setSeen(true); observer.disconnect(); }
    }, { threshold });
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, threshold]);
  return seen;
}

const reducedMotion = () => typeof window !== 'undefined'
  && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduced');

/**
 * The number to draw for `target` (null while it is not known). Before the block is seen it waits at 0, so the count starts
 * from 0 the moment it is (no frame of the full figure first); once seen it counts to `target` and rests there.
 */
export function useCountUp(target, seen, duration = 900) {
  const [shown, setShown] = useState(null);
  const [done, setDone] = useState(false);
  const frame = useRef(0);
  const known = typeof target === 'number' && Number.isFinite(target);
  useEffect(() => {
    if (!seen || !known || done || reducedMotion()) return undefined;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      setShown(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame.current = requestAnimationFrame(tick);
      else setDone(true);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [target, seen, known, done, duration]);
  if (!known) return null;
  if (done || reducedMotion()) return target;
  return shown ?? 0;
}
