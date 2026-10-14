'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useMobiPrefs } from '@/lib/mobiPrefs';

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;
const easeOutExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

/**
 * A number that rolls to its new value. It rolls from whatever it is showing right now, so a
 * change that arrives mid-roll carries on smoothly. The first value is shown as it is, unless
 * `from` is given (then the first value rolls up from it). Reduced motion shows the value at once.
 * The server and the first paint always show the real value: a count never reads as a made-up zero.
 *
 *   useCountUp(value, { from, duration = 700, decimals = 0, enabled = true })
 */
export function useCountUp(value, { from, duration = 700, decimals = 0, enabled = true } = {}) {
  const { reduced } = useMobiPrefs();
  const [shown, setShown] = useState(value);
  const shownRef = useRef(value);
  const seen = useRef(false);
  const factor = Math.pow(10, decimals);

  useIsoLayoutEffect(() => {
    const target = Number(value);
    const first = !seen.current;
    seen.current = true;
    if (!Number.isFinite(target)) { shownRef.current = value; setShown(value); return undefined; }
    const origin = first ? (typeof from === 'number' ? from : target) : Number(shownRef.current);
    if (!enabled || reduced || !Number.isFinite(origin) || origin === target) {
      shownRef.current = target;
      setShown(target);
      return undefined;
    }
    let raf = 0;
    let begin = 0;
    const span = Math.max(180, duration);
    shownRef.current = origin;
    setShown(origin);
    const frame = (now) => {
      if (!begin) begin = now;
      const t = Math.min(1, (now - begin) / span);
      const next = t >= 1 ? target : origin + (target - origin) * easeOutExpo(t);
      shownRef.current = next;
      setShown(next);
      if (t < 1) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [value, from, duration, enabled, reduced]);

  const n = Number(shown);
  return Number.isFinite(n) ? Math.round(n * factor) / factor : shown;
}
