"use client";
// Loads the signed-in student's PrepOS insights once. Returns an explicit status so the
// UI can show loading, empty, ready or unavailable instead of zeros.
// Optional `after`: a function returning a promise; the request waits for it, so secondary
// content (the record line on Today) never competes with the plan for the network.
import { useEffect, useRef, useState } from 'react';

export function useInsights(userId, { after } = {}) {
  const [state, setState] = useState({ userId: null, status: 'loading', insights: null, findings: [] });
  const afterRef = useRef(after);
  useEffect(() => { afterRef.current = after; }, [after]);
  useEffect(() => {
    if (!userId) return undefined;
    let alive = true;
    const load = () => {
      fetch('/api/prepos/insights', { cache: 'no-store' })
        .then(async (res) => {
          const body = await res.json().catch(() => null);
          if (!alive) return;
          if (!res.ok || !body?.insights) throw new Error('unavailable');
          setState({ userId, status: body.insights.state === 'ready' ? 'ready' : 'empty', insights: body.insights, findings: body.findings || [] });
        })
        .catch(() => { if (alive) setState({ userId, status: 'unavailable', insights: null, findings: [] }); });
    };
    let timer;
    const wait = afterRef.current;
    if (wait) Promise.resolve().then(wait).catch(() => {}).then(() => { if (alive) load(); });
    else timer = window.setTimeout(load, 0);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [userId]);
  return state.userId === userId ? state : { userId, status: 'loading', insights: null, findings: [] };
}
