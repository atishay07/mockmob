"use client";
// The Mob on the website: one read of GET /api/mob and the writes, all against the same server state the app uses.
// Nothing is shown as done before the server answers (standards 7): a write keeps the last good view until its reply.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ERRORS } from '@/lib/mob/model.mjs';

const messageFor = (status, body) => body?.error?.message || (status === 0 ? 'You seem to be offline. Check your connection and try again.' : ERRORS.UNAVAILABLE[1]);

export async function mobFetch(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(path, { method, headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store' });
  } catch {
    return { ok: false, status: 0, code: 'NETWORK', message: messageFor(0) };
  }
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  if (!res.ok) return { ok: false, status: res.status, code: data?.error?.code || 'UNAVAILABLE', message: messageFor(res.status, data) };
  return { ok: true, status: res.status, data };
}

/**
 * status: idle | loading | ready | error | disabled. mob: the server's view or null (not in a Mob).
 * run(path, body, { method, keep }) -> the reply; a reply in the GET shape replaces the view.
 */
export function useMob(userId) {
  const [state, setState] = useState({ status: 'idle', mob: null, error: null });
  const [busy, setBusy] = useState(null);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, status: s.status === 'ready' ? 'ready' : 'loading', error: null }));
    const r = await mobFetch('/api/mob');
    if (!alive.current) return r;
    if (r.ok) setState({ status: 'ready', mob: r.data?.mob || null, error: null });
    else setState((s) => ({ ...s, status: r.code === 'MOB_DISABLED' ? 'disabled' : 'error', error: r.message }));
    return r;
  }, []);

  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    Promise.resolve().then(() => { if (!cancelled) load(); });
    return () => { cancelled = true; };
  }, [userId, load]);

  const run = useCallback(async (path, body, { method = 'POST', name = path } = {}) => {
    setBusy(name);
    const r = await mobFetch(path, { method, body });
    if (alive.current) {
      setBusy(null);
      if (r.ok && r.data && Object.prototype.hasOwnProperty.call(r.data, 'mob')) setState({ status: 'ready', mob: r.data.mob, error: null });
    }
    return r;
  }, []);

  return { ...state, busy, load, run, setMob: (mob) => setState({ status: 'ready', mob, error: null }) };
}

/** The runner's start for a Mob paper (/test?mob=1): the same reply as a practice start, or an Error with a plain sentence. */
export async function startMobPaper(startReceipt) {
  const r = await mobFetch('/api/mob/paper/start', { method: 'POST', body: startReceipt ? { startReceipt } : {} });
  if (r.ok) return r.data;
  throw Object.assign(new Error(r.message), { status: r.status, code: r.code });
}
