"use client";
// The Sunday Mock on the website: the reads of GET /api/sunday (the student's week), /api/sunday/mob (the den) and
// /api/sunday/stats (after the close), and the runner's start. One read of the status is shared by every surface on the page
// for a minute (Today's card and Practice's row read it once each), and forgotten when a paper starts or is sent.
// status: loading | ready | off (SUNDAY_MOCK_ENABLED=false, or signed out) | error. Nothing here writes.
import { useCallback, useEffect, useState } from 'react';
import { apiPost } from '@/lib/fetcher';
import { sundayWeekOf } from '@/lib/sundayMock.mjs';

const KEEP_MS = 60_000;
let shared = null; // { at, promise }

async function read(path) {
  let res;
  try { res = await fetch(path, { cache: 'no-store' }); } catch { return { ok: false, status: 0 }; }
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  return res.ok ? { ok: true, data } : { ok: false, status: res.status, code: data?.error || null };
}

/** Forget the shared status (a paper started or was sent). */
export function forgetSunday() { shared = null; }

function readStatus(fresh = false) {
  if (!fresh && shared && Date.now() - shared.at < KEEP_MS) return shared.promise;
  const promise = read('/api/sunday');
  shared = { at: Date.now(), promise };
  promise.then((r) => { if (!r.ok && shared?.promise === promise) shared = null; });
  return promise;
}

const outcome = (r) => (r.ok ? { status: 'ready', data: r.data } : r.status === 404 || r.status === 401 ? { status: 'off', data: null } : { status: 'error', data: null });

/** This week's Sunday Mock for the signed-in student. `enabled` false reads nothing (status 'off'). */
export function useSunday(enabled = true) {
  const [state, setState] = useState({ status: enabled ? 'loading' : 'off', data: null });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    readStatus(tick > 0).then((r) => { if (alive) setState(outcome(r)); });
    return () => { alive = false; };
  }, [enabled, tick]);
  const reload = useCallback(() => { setState((s) => ({ ...s, status: 'loading' })); setTick((n) => n + 1); }, []);
  return { ...state, reload };
}

/** The den's block: this week's Sunday Mock in the Mob's subject. */
export function useSundayMob(mobId) {
  const [state, setState] = useState({ status: mobId ? 'loading' : 'off', data: null });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!mobId) return undefined;
    let alive = true;
    read(`/api/sunday/mob?${new URLSearchParams({ mob: mobId })}`).then((r) => { if (alive) setState(outcome(r)); });
    return () => { alive = false; };
  }, [mobId, tick]);
  const reload = useCallback(() => { setState((s) => ({ ...s, status: 'loading' })); setTick((n) => n + 1); }, []);
  return { ...state, reload };
}

/**
 * After the close, the counts for a Sunday paper's result: { sat, shares } or null (not a Sunday paper, still held, not closed,
 * or the read failed: the result then shows no counts, never a wrong one).
 */
export function useSundayStats(attempt) {
  const week = attempt && !attempt.mobHold ? sundayWeekOf(attempt) : null;
  const subject = attempt?.subject || null;
  const [stats, setStats] = useState(null);
  useEffect(() => {
    if (!week || !subject) return undefined;
    let alive = true;
    read(`/api/sunday/stats?${new URLSearchParams({ week, subject })}`).then((r) => { if (alive) setStats(r.ok ? r.data : null); });
    return () => { alive = false; };
  }, [week, subject]);
  return week ? stats : null;
}

/** The runner's start of a Sunday paper: the practice start response, or the fetch error (message = code, body). */
export async function startSundayMock(subject, startReceipt) {
  forgetSunday();
  return apiPost('/api/sunday/start', { subject, ...(startReceipt ? { startReceipt } : {}) });
}
