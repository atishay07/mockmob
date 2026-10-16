"use client";
// The Mob on the website: one read of GET /api/mob and the writes, all against the same server state the app uses.
// Nothing is shown as done before the server answers (standards 7): a write keeps the last good view until its reply.
// A student can be in several Mobs (Pro: up to 3). The one on screen is remembered on this device (a per-viewer
// convenience, never state that matters) and named on every read and write, so a write can never land in another Mob.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ERRORS, UUID_RE } from '@/lib/mob/model.mjs';

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

const SELECTED_KEY = 'mockmob_mob_selected';
const readSelected = () => {
  try { const v = window.localStorage.getItem(SELECTED_KEY); return v && UUID_RE.test(v) ? v : null; } catch { return null; }
};
const writeSelected = (id) => {
  try { if (id) window.localStorage.setItem(SELECTED_KEY, id); else window.localStorage.removeItem(SELECTED_KEY); } catch { /* the default Mob shows next time */ }
};
const query = (params) => {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''));
  return q.size ? `?${q}` : '';
};

// These two routes make or join a Mob, so they name no existing one.
const UNSCOPED = new Set(['/api/mob', '/api/mob/join']);

/**
 * status: idle | loading | ready | error | disabled. mob: the server's view or null (not in a Mob).
 * run(path, body, { method, name }) -> the reply; a reply in the GET shape replaces the view and becomes the Mob on screen.
 * select(id) shows another of your Mobs. compare({ week, extra }) and history() read the Pro views for the Mob on screen.
 */
export function useMob(userId) {
  const [state, setState] = useState({ status: 'idle', mob: null, error: null });
  const [busy, setBusy] = useState(null);
  const alive = useRef(true);
  const current = useRef(null);
  // Set on every mount: React's development double mount runs the cleanup once, and a ref left false would drop every
  // reply (the view would sit at loading).
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const adopt = useCallback((mob) => {
    current.current = mob?.id || null;
    // Remember the choice only when there is a choice to remember.
    writeSelected(mob && (mob.mobs || []).length > 1 ? mob.id : null);
  }, []);

  const load = useCallback(async (mobId) => {
    const wanted = typeof mobId === 'string' ? mobId : current.current || readSelected();
    setState((s) => ({ ...s, status: s.status === 'ready' ? 'ready' : 'loading', error: null }));
    const r = await mobFetch(`/api/mob${query({ mob: wanted })}`);
    if (!alive.current) return r;
    if (r.ok) { adopt(r.data?.mob); setState({ status: 'ready', mob: r.data?.mob || null, error: null }); }
    else setState((s) => ({ ...s, status: r.code === 'MOB_DISABLED' ? 'disabled' : 'error', error: r.message }));
    return r;
  }, [adopt]);

  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    Promise.resolve().then(() => { if (!cancelled) load(); });
    return () => { cancelled = true; };
  }, [userId, load]);

  const run = useCallback(async (path, body, { method = 'POST', name = path } = {}) => {
    setBusy(name);
    const scoped = current.current && !UNSCOPED.has(path);
    const sent = scoped ? { mob: current.current, ...(body || {}) } : body;
    const r = await mobFetch(path, { method, body: sent });
    if (alive.current) {
      setBusy(null);
      if (r.ok && r.data && Object.prototype.hasOwnProperty.call(r.data, 'mob')) { adopt(r.data.mob); setState({ status: 'ready', mob: r.data.mob, error: null }); }
    }
    return r;
  }, [adopt]);

  const select = useCallback((id) => { current.current = id; writeSelected(id); return load(id); }, [load]);
  const compare = useCallback(({ week, extra } = {}) => mobFetch(`/api/mob/compare${query({ mob: current.current, week, extra })}`), []);
  const history = useCallback(() => mobFetch(`/api/mob/history${query({ mob: current.current })}`), []);

  return { ...state, busy, load, run, select, compare, history, setMob: (mob) => { adopt(mob); setState({ status: 'ready', mob, error: null }); } };
}

/** The runner's start for a Mob paper (/test?mob=1): the same reply as a practice start, or an Error with a plain sentence. */
export async function startMobPaper(startReceipt, { mobId, extraId } = {}) {
  const body = { ...(startReceipt ? { startReceipt } : {}), ...(mobId ? { mob: mobId } : {}), ...(extraId ? { extra: extraId } : {}) };
  const r = await mobFetch('/api/mob/paper/start', { method: 'POST', body });
  if (r.ok) return r.data;
  throw Object.assign(new Error(r.message), { status: r.status, code: r.code });
}
