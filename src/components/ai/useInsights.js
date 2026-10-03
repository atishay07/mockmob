"use client";
// Loads the signed-in student's PrepOS insights once. Returns an explicit status so the
// UI can show loading, empty, ready or unavailable instead of zeros.
import { useEffect, useState } from 'react';

export function useInsights(userId) {
  const [state, setState] = useState({ userId: null, status: 'loading', insights: null, findings: [] });
  useEffect(() => {
    if (!userId) return undefined;
    let alive = true;
    const timer = window.setTimeout(() => {
      fetch('/api/prepos/insights', { cache: 'no-store' })
        .then(async (res) => {
          const body = await res.json().catch(() => null);
          if (!alive) return;
          if (!res.ok || !body?.insights) throw new Error('unavailable');
          setState({ userId, status: body.insights.state === 'ready' ? 'ready' : 'empty', insights: body.insights, findings: body.findings || [] });
        })
        .catch(() => { if (alive) setState({ userId, status: 'unavailable', insights: null, findings: [] }); });
    }, 0);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [userId]);
  return state.userId === userId ? state : { userId, status: 'loading', insights: null, findings: [] };
}
