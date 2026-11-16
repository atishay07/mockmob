"use client";
// Class leagues on the website: the reads of GET /api/class (your class and its latest closed Sunday), /api/class/lookup (the
// join page) and /api/class/week (a Sunday paper's result), and the writes (create, join, leave, close, report). One read of
// the status is shared by every surface on the page for a minute and forgotten after any write.
// status: loading | ready | off. Each surface mounts only while the switch is on (./ClassSwitch.jsx), so nothing here runs
// while it is off; a 404 or 401 is still kept as off for the page's life, and a failed read draws nothing new.
import { useCallback, useEffect, useState } from 'react';
import { PENDING_CLASS_KEY, normalizeClassCode, readPendingCode } from '@/lib/classLeague/model.mjs';

const KEEP_MS = 60_000;
let shared = null; // { at, promise }
let off = false;

/** fetch -> { ok, status, data, code, message }. Never throws. */
export async function classFetch(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(path, { method, cache: 'no-store', ...(body !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
  } catch {
    return { ok: false, status: 0, data: null, code: 'NETWORK', message: 'No connection. Check your internet and try again.' };
  }
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  if (res.ok) return { ok: true, status: res.status, data };
  return { ok: false, status: res.status, data, code: data?.error?.code || null, message: data?.error?.message || 'Something went wrong. Try again.', detail: data?.error?.detail || null };
}

/** Forget the shared status (after a write). */
export function forgetClass() { shared = null; }

function readStatus(fresh = false) {
  if (!fresh && shared && Date.now() - shared.at < KEEP_MS) return shared.promise;
  const promise = classFetch('/api/class');
  shared = { at: Date.now(), promise };
  promise.then((r) => { if (!r.ok && shared?.promise === promise) shared = null; });
  return promise;
}

// 404 (switched off) and 401 (signed out) are off for the page's life. A failed read (no network, a 5xx) is off too, unless
// the block already drew: then it keeps what it drew (review, 16 Nov 2026: a failed read must not put a new error on a page).
const outcome = (r, prev) => {
  if (r.ok) return { status: 'ready', data: r.data };
  if (r.status === 404 || r.status === 401) { off = true; return { status: 'off', data: null }; }
  return prev?.status === 'ready' ? prev : { status: 'off', data: null };
};

/** Your class for the signed-in student. `enabled` false reads nothing (status 'off'). */
export function useClassLeague(enabled = true) {
  const [state, setState] = useState(() => ({ status: enabled && !off ? 'loading' : 'off', data: null }));
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!enabled || off) return undefined;
    let alive = true;
    readStatus(tick > 0).then((r) => { if (alive) setState((prev) => outcome(r, prev)); });
    return () => { alive = false; };
  }, [enabled, tick]);
  const reload = useCallback(() => { setState((s) => ({ ...s, status: s.data ? s.status : 'loading' })); setTick((n) => n + 1); }, []);
  /** Put a write's answer (the status) in place without another read. */
  const accept = useCallback((data) => {
    shared = { at: Date.now(), promise: Promise.resolve({ ok: true, status: 200, data }) };
    setState({ status: 'ready', data });
  }, []);
  return { ...state, reload, accept };
}

/** The writes. Each answers classFetch's shape; a success forgets the shared status. */
export async function classWrite(path, body = {}) {
  const r = await classFetch(path, { method: 'POST', body });
  if (r.ok) forgetClass();
  return r;
}

/** One closed Sunday's figure in one subject, for that paper's result: { figure, className } or null. */
export function useClassWeek(week, subject) {
  const [value, setValue] = useState(null);
  useEffect(() => {
    if (!week || !subject || off) return undefined;
    let alive = true;
    classFetch(`/api/class/week?${new URLSearchParams({ week, subject })}`).then((r) => {
      if (!alive) return;
      if (r.status === 404 && r.code === 'CLASS_OFF') off = true;
      setValue(r.ok && r.data?.figure ? r.data : null);
    });
    return () => { alive = false; };
  }, [week, subject]);
  return value;
}

/** The public lookup of a code: { status: loading | ready | missing | off | error, data }. */
export function useClassLookup(code, signedIn) {
  const [state, setState] = useState({ status: code ? 'loading' : 'missing', data: null });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!code) return undefined;
    let alive = true;
    classFetch(`/api/class/lookup?${new URLSearchParams({ code })}`).then((r) => {
      if (!alive) return;
      if (r.ok) setState({ status: 'ready', data: r.data });
      else if (r.code === 'CLASS_NOT_FOUND') setState({ status: 'missing', data: null });
      else if (r.code === 'CLASS_OFF') setState({ status: 'off', data: null });
      else setState({ status: 'error', data: null, message: r.message });
    });
    return () => { alive = false; };
  }, [code, signedIn, tick]);
  const retry = useCallback(() => { setState({ status: 'loading', data: null }); setTick((n) => n + 1); }, []);
  return { ...state, retry };
}

// The code this tab keeps across sign-up (sessionStorage, as the Mob keeps its invite): read on Today after the first setup.
export function rememberClassCode(code) {
  try { window.sessionStorage.setItem(PENDING_CLASS_KEY, JSON.stringify({ code, at: Date.now() })); } catch { /* the sign-up return path still carries it */ }
}
export function pendingClassCode() {
  try { return readPendingCode(window.sessionStorage.getItem(PENDING_CLASS_KEY), Date.now()); } catch { return null; }
}
export function forgetClassCode() {
  try { window.sessionStorage.removeItem(PENDING_CLASS_KEY); } catch { /* nothing kept */ }
}
export { normalizeClassCode };
