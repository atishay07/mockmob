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

// What the student saw last time, so the Record can say what changed since then. Only the one
// real figure (accuracy, in whole percent) is kept, per student, in this browser. Every access is
// inside try/catch: private windows and blocked storage just mean there is nothing to compare.
const lookKey = (userId) => `mm:record-look:v1:${userId}`;

/** The accuracy shown at the last look, or null when there is none. */
export function readLastLook(userId) {
  if (!userId) return null;
  try {
    const raw = window.localStorage.getItem(lookKey(userId));
    const value = raw ? JSON.parse(raw)?.pct : null;
    return Number.isFinite(value) ? value : null;
  } catch { return null; }
}

/** Remembers the figure shown now, for the next look. */
export function rememberLook(userId, pct) {
  if (!userId || !Number.isFinite(pct)) return;
  try { window.localStorage.setItem(lookKey(userId), JSON.stringify({ pct, at: Date.now() })); } catch { /* Nothing to remember it in. */ }
}

/** The change, in words, or null when nothing moved. Points are percentage points of accuracy. */
export function lookChange(from, now) {
  if (!Number.isFinite(from) || !Number.isFinite(now) || from === now) return null;
  const d = Math.abs(now - from);
  return { delta: now - from, text: `${now > from ? 'Up' : 'Down'} ${d} point${d === 1 ? '' : 's'} since your last look` };
}
