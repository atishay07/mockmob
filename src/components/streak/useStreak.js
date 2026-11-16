"use client";
// One read of the daily streak (GET /api/me/streak) shared by the top bar chip, Today, You and the streak sheet, so every place
// prints the same number and a pause set in the sheet shows everywhere at once. A failed read is { status: 'error' }: the chip
// and the blocks step aside, nothing guesses a number.
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { api } from '@/lib/fetcher';

let state = { status: 'idle', data: null, user: null, at: 0 };
// A read is kept for a minute: a page change after that (a paper just finished) reads again, quietly, keeping the old number meanwhile.
const FRESH_MS = 60_000;
const listeners = new Set();
let inFlight = null;
const emit = () => { for (const l of listeners) l(); };
const set = (next) => { state = next; emit(); };
const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l); };
const snapshot = () => state;
const IDLE = { status: 'idle', data: null, user: null, at: 0 };

export function loadStreak(userId, { force = false } = {}) {
  if (!userId) return Promise.resolve(null);
  if (inFlight && state.user === userId) return inFlight;
  if (!force && state.user === userId && state.status === 'ready' && Date.now() - state.at < FRESH_MS) return Promise.resolve(state.data);
  if (state.user !== userId || state.status !== 'ready') set({ status: 'loading', data: state.user === userId ? state.data : null, user: userId, at: state.at });
  const run = api('/api/me/streak').then((data) => { set({ status: 'ready', data, user: userId, at: Date.now() }); return data; })
    .catch(() => { set({ status: state.data ? 'ready' : 'error', data: state.data, user: userId, at: Date.now() }); return null; })
    .finally(() => { inFlight = null; });
  inFlight = run;
  return run;
}

/** Put a fresh body in (after a pause is set or cleared). */
export function putStreak(userId, data) { if (userId && data) set({ status: 'ready', data, user: userId, at: Date.now() }); }

/** Pause days: POST to set, DELETE to clear. Returns { ok, data } or { ok: false, message }. */
export async function sendPause(userId, method, days) {
  try {
    const data = await api('/api/me/streak/pause', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ days }) });
    putStreak(userId, data);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, message: e?.body?.error?.message || (e?.kind === 'network' ? 'No connection. Your pause days were not changed.' : 'Your pause days were not changed. Try again.') };
  }
}

/** `key`: a value that changes on navigation (the path), so a stale read is refreshed when the student moves on. */
export function useStreak(userId, key = null) {
  const s = useSyncExternalStore(subscribe, snapshot, () => IDLE);
  useEffect(() => { if (userId) loadStreak(userId); }, [userId, key]);
  const reload = useCallback(() => loadStreak(userId, { force: true }), [userId]);
  const mine = s.user === userId ? s : IDLE;
  return { status: userId ? (mine.status === 'idle' ? 'loading' : mine.status) : 'idle', data: mine.data, reload };
}

// The sheet is one per page: any place opens it through this tiny event store ({ open, view: 'streak' | 'pause' }).
let sheet = { open: false, view: 'streak' };
const sheetListeners = new Set();
const sheetSub = (l) => { sheetListeners.add(l); return () => sheetListeners.delete(l); };
const sheetSnap = () => sheet;
const CLOSED = { open: false, view: 'streak' };
export function openStreakSheet(view = 'streak') { sheet = { open: true, view }; for (const l of sheetListeners) l(); }
export function closeStreakSheet() { sheet = { ...sheet, open: false }; for (const l of sheetListeners) l(); }
export const useStreakSheet = () => useSyncExternalStore(sheetSub, sheetSnap, () => CLOSED);
