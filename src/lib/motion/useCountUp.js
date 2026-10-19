'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useMobiPrefs } from '@/lib/mobiPrefs';
import { curves, durations } from './tokens.g.js';
import { inkFor, numberDirection, recallNumber, rememberNumber } from './numberMemory';
import { cubicAt } from './swap';
import { COUNT_UP_SETTLE, planCountUp, settleStep } from './countUpPlan.js';

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;
// The count-up curve: emphasized over 720 ms, as deploy/1015-night and the app (restored 19 Oct, owner G31: the
// 420 ms ease-out roll of pass 1016e read as rushed). A caller may name another curve from the token file (`curve`).
const curveFor = (name) => {
  const c = curves[name] || curves.emphasized;
  return (t) => cubicAt(c, t);
};

/**
 * A number that rolls to its new value, with its tint: { value, ink }.
 *
 * It rolls from whatever it is showing right now, so a change that arrives mid-roll carries on
 * smoothly. The first value is shown as it is, unless `from` is given (then it rolls up from it).
 * The server and the first paint always show the real value: a count never reads as a made-up zero.
 * Reduced motion shows the value at once. It rolls on the app's emphasized curve over the countUp token (720 ms, the app's value; restored 19 Oct, owner G31) unless told
 * (countUpPlan.js holds the rules, with its unit test).
 *
 * With a `memoryKey` it remembers (the app's number memory, see numberMemory.js): coming back to a
 * value it already showed draws it at once with no roll; a new value rolls from the remembered one,
 * and `ink` is 'rise' or 'fall' while it rolls and for 300 ms after it lands, then null (put it on
 * data-ink with the .mk-num class, and the colour settles back over 200 ms). Without a memoryKey,
 * ink is always null. Under reduced motion there is no roll and no tint.
 *
 * With `settle` the roll waits (showing where it starts) until the page has stopped dropping frames (countUpPlan.js
 * COUNT_UP_SETTLE), and a frame that still comes late moves the roll on by one smooth frame at most, so a number that
 * arrives with its whole page is seen rolling from the start to the end.
 *
 *   useCountUpState(value, { from, duration = 720, decimals = 0, enabled = true, memoryKey, curve = 'emphasized', settle = false })
 */
export function useCountUpState(value, { from, duration = durations.countUp, decimals = 0, enabled = true, memoryKey, curve = 'emphasized', settle = false } = {}) {
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

    const { origin, roll, span } = planCountUp({ value, first, remembered, from, shown: shownRef.current, enabled, reduced, duration });
    if (!roll) {
      shownRef.current = target;
      setShown(target);
      setInk(null);
      return undefined;
    }

    const tint = key !== null ? inkFor(numberDirection(before, value)) : null;
    const ease = curveFor(curve);
    let raf = 0;
    let timer = 0;
    let begin = 0;
    let last = 0;
    let elapsed = 0;
    let wait = settle ? {} : null;
    shownRef.current = origin;
    setShown(origin);
    setInk(tint);
    const frame = (now) => {
      if (wait) {
        wait = settleStep(wait, now);
        if (!wait.ready) { raf = requestAnimationFrame(frame); return; }
        wait = null;
      }
      if (!begin) { begin = now; last = now; }
      // A settled roll never skips: a late frame moves it on by one smooth frame at most, so every part of the curve is drawn.
      elapsed += settle ? Math.min(now - last, COUNT_UP_SETTLE.smoothMs) : now - last;
      last = now;
      const t = Math.min(1, elapsed / span);
      const next = t >= 1 ? target : origin + (target - origin) * ease(t);
      shownRef.current = next;
      setShown(next);
      if (t < 1) raf = requestAnimationFrame(frame);
      else if (tint) timer = window.setTimeout(() => setInk(null), durations.numberInk);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); window.clearTimeout(timer); };
  }, [value, from, duration, enabled, reduced, key, curve, settle]);

  const n = Number(shown);
  return { value: Number.isFinite(n) ? Math.round(n * factor) / factor : shown, ink: reduced ? null : ink };
}

/**
 * The rolling value only (see useCountUpState for the rules and the memoryKey option).
 *
 *   useCountUp(value, { from, duration = 720, decimals = 0, enabled = true, memoryKey, curve, settle })
 */
export function useCountUp(value, options) {
  return useCountUpState(value, options).value;
}
