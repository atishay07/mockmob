"use client";
// One read of the daily streak (GET /api/me/streak) shared by the top bar chip, Today, You and the streak sheet, so every place
// prints the same number and a pause set in the sheet shows everywhere at once. A failed read is { status: 'error' }: the chip
// and the blocks step aside, nothing guesses a number.
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { api } from '@/lib/fetcher';
import { grewFrom, readSeen, seenKey, writeSeen } from '@/lib/streak/streakCopy.mjs';

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

/** Read the streak again for whoever it was last read for (the preview's `grow` fixture uses it to show the number rising). */
export function refreshStreak() { return state.user ? loadStreak(state.user, { force: true }) : Promise.resolve(null); }

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

// The moment it grows (21 Nov 2026, owner LK365): when the day number rises past what this device last saw, the number steps up
// once (the old figure out, the new in, about 400 ms, streak.css .stk-tick) and Mobi lights. Returns the figure to step up from
// while that moment plays, else null. Decided in the first render that has the new number (a read of this device's record, so
// the new figure is never drawn plain first and then stepped), once per (account, number, today counted): a second mount
// (React's development double run, the sheet opened after the chip) never plays it again. The record is written after commit.
// Reduced motion: the CSS shows the new figure at once.
const grewDecided = new Map();
export function useStreakGrow(userId, body, active = true) {
  const days = Number.isFinite(body?.days) ? body.days : null;
  const done = Boolean(body?.today?.done);
  const on = Boolean(active && userId && days !== null && typeof window !== 'undefined');
  const id = `${userId}:${days}:${done}`;
  const [over, setOver] = useState(null);
  let from = null;
  if (on) {
    if (!grewDecided.has(id)) {
      let prev = null;
      try { prev = readSeen(window.localStorage.getItem(seenKey(userId))); } catch { prev = null; }
      grewDecided.set(id, grewFrom(prev, { days, done }));
    }
    from = grewDecided.get(id);
  }
  useEffect(() => {
    if (!on) return undefined;
    try { window.localStorage.setItem(seenKey(userId), writeSeen(days, done)); } catch { /* the moment may show again */ }
    if (grewDecided.get(id) === null || grewDecided.get(id) === undefined) return undefined;
    const t = window.setTimeout(() => { grewDecided.set(id, null); setOver(id); }, 1100);
    // Leaving mid-moment counts as seen: the next page never plays it again (the figures drawn are already the final ones).
    return () => { window.clearTimeout(t); grewDecided.set(id, null); };
  }, [on, id, userId, days, done]);
  return over === id ? null : from;
}
