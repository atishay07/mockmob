'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useMobiPrefs } from '@/lib/mobiPrefs';
import { curves, durations } from './tokens.g.js';
import { inkFor, numberDirection, recallNumber, rememberNumber } from './numberMemory';
import { cubicAt } from './swap';

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;
// The app's count-up curve (MmCountUp): emphasized.
const emphasized = (t) => cubicAt(curves.emphasized, t);

/**
 * A number that rolls to its new value, with its tint: { value, ink }.
 *
 * It rolls from whatever it is showing right now, so a change that arrives mid-roll carries on
 * smoothly. The first value is shown as it is, unless `from` is given (then it rolls up from it).
 * The server and the first paint always show the real value: a count never reads as a made-up zero.
 * Reduced motion shows the value at once. It rolls on the app's emphasized curve, 720 ms unless told.
 *
 * With a `memoryKey` it remembers (the app's number memory, see numberMemory.js): coming back to a
 * value it already showed draws it at once with no roll; a new value rolls from the remembered one,
 * and `ink` is 'rise' or 'fall' while it rolls and for 300 ms after it lands, then null (put it on
 * data-ink with the .mk-num class, and the colour settles back over 200 ms). Without a memoryKey,
 * ink is always null. Under reduced motion there is no roll and no tint.
 *
 *   useCountUpState(value, { from, duration = 720, decimals = 0, enabled = true, memoryKey })
 */
export function useCountUpState(value, { from, duration = durations.countUp, decimals = 0, enabled = true, memoryKey } = {}) {
  const { reduced } = useMobiPrefs();
  const [shown, setShown] = useState(value);
  const [ink, setInk] = useState(null);
  const shownRef = useRef(value);
  const lastTarget = useRef(undefined);
  const seen = useRef(false);
  const factor = Math.pow(10, decimals);
  const key = memoryKey == null ? null : String(memoryKey);

  useIsoLayoutEffect(() => {
    const target = Number(value);
    const first = !seen.current;
    seen.current = true;
    const remembered = key !== null ? recallNumber(key) : undefined;
    const before = first ? remembered : lastTarget.current;
    lastTarget.current = value;
    if (key !== null) rememberNumber(key, value);
    if (!Number.isFinite(target)) { shownRef.current = value; setShown(value); setInk(null); return undefined; }

    let origin;
    if (first) origin = remembered !== undefined && Number.isFinite(Number(remembered)) ? Number(remembered) : (typeof from === 'number' ? from : target);
    else origin = Number(shownRef.current);
    if (!enabled || reduced || !Number.isFinite(origin) || origin === target) {
      shownRef.current = target;
      setShown(target);
      setInk(null);
      return undefined;
    }

    const tint = key !== null ? inkFor(numberDirection(before, value)) : null;
    let raf = 0;
    let timer = 0;
    let begin = 0;
    const span = Math.max(180, duration);
    shownRef.current = origin;
    setShown(origin);
    setInk(tint);
    const frame = (now) => {
      if (!begin) begin = now;
      const t = Math.min(1, (now - begin) / span);
      const next = t >= 1 ? target : origin + (target - origin) * emphasized(t);
      shownRef.current = next;
      setShown(next);
      if (t < 1) raf = requestAnimationFrame(frame);
      else if (tint) timer = window.setTimeout(() => setInk(null), durations.numberInk);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); window.clearTimeout(timer); };
  }, [value, from, duration, enabled, reduced, key]);

  const n = Number(shown);
  return { value: Number.isFinite(n) ? Math.round(n * factor) / factor : shown, ink: reduced ? null : ink };
}

/**
 * The rolling value only (see useCountUpState for the rules and the memoryKey option).
 *
 *   useCountUp(value, { from, duration = 720, decimals = 0, enabled = true, memoryKey })
 */
export function useCountUp(value, options) {
  return useCountUpState(value, options).value;
}
