"use client";
// GET /api/me/traps (Traps you meet, spec tmp/mistake-lab-v4/SPEC.md 4.11), read once when the sheet is opened.
// state: idle | loading | ready | error. `message` is the server's own words when it sent some.
import { useCallback, useEffect, useState } from 'react';
import { apiGet } from '@/lib/fetcher';

export const TRAPS_UNAVAILABLE = 'Your traps could not be loaded. Try again shortly.';

export function useTrapsMeet({ enabled = false } = {}) {
  const [nonce, setNonce] = useState(0);
  const [read, setRead] = useState({ state: 'idle', data: null, message: null });
  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    queueMicrotask(() => { if (alive) setRead((r) => (r.state === 'ready' ? r : { state: 'loading', data: null, message: null })); });
    apiGet('/api/me/traps')
      .then((data) => {
        if (!alive) return;
        if (!data || typeof data !== 'object' || !Array.isArray(data.rows)) throw new Error('bad_traps');
        setRead({ state: 'ready', data, message: null });
      })
      .catch((e) => { if (alive) setRead({ state: 'error', data: null, message: e?.body?.message || TRAPS_UNAVAILABLE }); });
    return () => { alive = false; };
  }, [enabled, nonce]);
  const retry = useCallback(() => setNonce((n) => n + 1), []);
  return { ...read, retry };
}
