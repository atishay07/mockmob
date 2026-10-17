"use client";
// GET /api/me/revise (Revise, feature wave F1; data/revise.js, spec tmp/mistake-lab-v4/SPEC.md 4.8): today's questions with the
// stem and options and no key. state: loading | ready | unavailable | error. A table the server does not have yet is
// "unavailable" and every surface hides itself. `queue: true` (the Revise run) also asks for the merged queue (LEARN-REVIEW-1017 5.8). The daily cap (5 or 10) is the student's choice and is remembered on this device.
import { useCallback, useEffect, useState } from 'react';
import { apiGet } from '@/lib/fetcher';

export const REVISE_ERROR = 'Revise could not be loaded. Try again shortly.';
const CAP_KEY = 'mm.revise.cap';

export function readCap() {
  try { return window.localStorage.getItem(CAP_KEY) === '5' ? 5 : 10; } catch { return 10; }
}
export function saveCap(cap) {
  try { window.localStorage.setItem(CAP_KEY, String(cap)); } catch { /* the choice just is not remembered */ }
}

export function useRevise({ cap = 10, enabled = true, queue = false } = {}) {
  const [nonce, setNonce] = useState(0);
  const [read, setRead] = useState({ state: 'loading', data: null, message: null });
  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    queueMicrotask(() => { if (alive) setRead((r) => (r.state === 'loading' ? r : { state: 'loading', data: r.data, message: null })); });
    apiGet(`/api/me/revise?cap=${cap}${queue ? '&queue=1' : ''}`)
      .then((data) => {
        if (!alive) return;
        if (!data || typeof data !== 'object' || !Array.isArray(data.items)) throw new Error('bad_revise');
        setRead({ state: data.state === 'unavailable' ? 'unavailable' : 'ready', data, message: data.message || null });
      })
      .catch((e) => {
        if (!alive) return;
        if (e?.body?.state === 'unavailable') setRead({ state: 'unavailable', data: null, message: e.body.message || REVISE_ERROR });
        else setRead({ state: 'error', data: null, message: e?.body?.message || REVISE_ERROR });
      });
    return () => { alive = false; };
  }, [enabled, cap, queue, nonce]);
  const retry = useCallback(() => setNonce((n) => n + 1), []);
  return { ...read, retry };
}
