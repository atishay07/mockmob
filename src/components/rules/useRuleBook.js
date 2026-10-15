"use client";
// GET /api/me/rules ({ book, acrossMocks }, spec tmp/mistake-lab-v4/SPEC.md 4.9 and 4.10) for the Rule book, Radar
// and Review. state: loading | ready | error. `message` is the server's own words when it sent some.
import { useCallback, useEffect, useState } from 'react';
import { apiGet } from '@/lib/fetcher';

export const RULES_UNAVAILABLE = 'Your rules could not be loaded. Try again shortly.';

export function useRuleBook({ enabled = true } = {}) {
  const [nonce, setNonce] = useState(0);
  const [read, setRead] = useState({ state: 'loading', data: null, message: null });
  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    queueMicrotask(() => { if (alive) setRead((r) => (r.state === 'loading' ? r : { state: 'loading', data: r.data, message: null })); });
    apiGet('/api/me/rules')
      .then((data) => {
        if (!alive) return;
        if (!data || typeof data !== 'object' || !data.book) throw new Error('bad_rules');
        setRead({ state: 'ready', data, message: null });
      })
      .catch((e) => { if (alive) setRead({ state: 'error', data: null, message: e?.body?.message || RULES_UNAVAILABLE }); });
    return () => { alive = false; };
  }, [enabled, nonce]);
  const retry = useCallback(() => setNonce((n) => n + 1), []);
  const setBook = useCallback((fn) => setRead((r) => (r.data ? { ...r, data: { ...r.data, book: fn(r.data.book) } } : r)), []);
  return { ...read, retry, setBook };
}
