'use client';

// React side of Mobi's discipline (mobiRation.js): ask a gate exactly once, and stage a wait.

import { useEffect, useRef, useState } from 'react';
import { WAIT_DELAY_MS, WAIT_LONG_MS, oopsRun } from './mobiRation.js';

/**
 * Asks a gate (a function from mobiRation.js) exactly once after the page has mounted and returns
 * what it said (`initial` until then). A ref guards it, so React's StrictMode double mount does not
 * consume the gate twice. Never ask a gate during render.
 */
export function useMobiGate(ask, initial = null) {
  const [value, setValue] = useState(initial);
  const asked = useRef(false);
  const askRef = useRef(ask);
  useEffect(() => {
    if (asked.current) return undefined;
    asked.current = true;
    let alive = true;
    queueMicrotask(() => { if (alive) setValue(askRef.current()); });
    return () => { alive = false; asked.current = false; };
  }, []);
  return value;
}

/**
 * How long a wait has gone on: 'none' for the first 300 ms (no Mobi, the space is held), 'wait'
 * until 2 s (he stands there), then 'long' (the loading act). `active` false resets it.
 */
export function useWaitStage(active, { delay = WAIT_DELAY_MS, long = WAIT_LONG_MS } = {}) {
  const [stage, setStage] = useState('none');
  useEffect(() => {
    if (!active) { queueMicrotask(() => setStage('none')); return undefined; }
    const first = window.setTimeout(() => setStage('wait'), delay);
    const second = window.setTimeout(() => setStage('long'), long);
    return () => { window.clearTimeout(first); window.clearTimeout(second); };
  }, [active, delay, long]);
  return stage;
}

/**
 * True when `failed` is true and this failure is the first of a run on `screen` (the app's
 * MobiRation.oopsRun, 90 s): he shrugs once, and stays calm when a retry fails again.
 */
export function useShrug(failed, screen) {
  const [shrug, setShrug] = useState(false);
  useEffect(() => {
    if (!failed) { queueMicrotask(() => setShrug(false)); return undefined; }
    let alive = true;
    queueMicrotask(() => { if (alive) setShrug(oopsRun(screen)); });
    return () => { alive = false; };
  }, [failed, screen]);
  return failed && shrug;
}
