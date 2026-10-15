"use client";

// Facts that pages hand to the shell, and requests the shell answers (web IA plan 2.1, 5.2, 3).
//
// Today (IA2) works out Tonight's move and the Review hub (IA6) works out tonight's repair. They
// publish them here so the Start sheet's hero and the Review badge say exactly what those pages say,
// without the shell fetching and computing the same thing a second time:
//
//   publishNextMove(userId, move)                 nextMove() from data/next_step_rules.mjs
//   publishTonightRepair(userId, { count, attemptId })  real count of mistakes in tonight's repair
//
// Requests the shell answers from anywhere in the signed-in pages:
//   openStartSheet({ row })                       row: resume | quick | full | nta | repair, or null
//   openGuide({ mode: 'replay' | 'first' })       You > Help replays it; the first repair's ending
//                                                 asks once with 'first' (or links to /today?guide=first)
//
// Signals are kept per account in memory and in sessionStorage (wrapped: storage can be missing),
// and expire, so a stale move never outlives the evening it was made for.
import { useSyncExternalStore } from 'react';
import { VISITOR_KEY } from '@/lib/navigation';

const STORE_KEY = 'mm:shell-signals:v1';
const MAX_AGE_MS = Object.freeze({ move: 10 * 60 * 1000, tonight: 30 * 60 * 1000 });
export const START_SHEET_EVENT = 'mm:start-sheet';
export const GUIDE_EVENT = 'mm:guide';

let state = null; // { move: { userId, at, value }, tonight: { userId, at, value } }
const listeners = new Set();

function load() {
  if (state) return state;
  state = {};
  try {
    const raw = JSON.parse(window.sessionStorage.getItem(STORE_KEY) || 'null');
    if (raw && typeof raw === 'object') state = raw;
  } catch { /* storage unavailable or corrupt: start empty */ }
  return state;
}

function save() {
  try { window.sessionStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* memory still holds it */ }
}

function publish(name, userId, value) {
  if (typeof window === 'undefined' || !userId) return;
  load();
  state = { ...state, [name]: value == null ? null : { userId, at: Date.now(), value } };
  save();
  for (const notify of listeners) notify();
}

export function publishNextMove(userId, move) {
  publish('move', userId, move && move.primary?.href ? move : null);
}

export function publishTonightRepair(userId, tonight) {
  const count = Math.max(0, Math.trunc(Number(tonight?.count) || 0));
  publish('tonight', userId, tonight ? { count, attemptId: tonight.attemptId ? String(tonight.attemptId) : null } : null);
}

const snapshots = new Map();
function read(name, userId) {
  if (typeof window === 'undefined' || !userId) return null;
  const entry = load()[name];
  if (!entry || entry.userId !== userId || Date.now() - entry.at > (MAX_AGE_MS[name] || 0)) return null;
  // useSyncExternalStore needs a stable reference while nothing changed.
  const cacheKey = `${name}:${userId}`;
  const cached = snapshots.get(cacheKey);
  if (cached?.entry === entry) return cached.value;
  snapshots.set(cacheKey, { entry, value: entry.value });
  return entry.value;
}

function subscribe(notify) {
  listeners.add(notify);
  const onStorage = (event) => { if (event.key === STORE_KEY) { state = null; notify(); } };
  window.addEventListener('storage', onStorage);
  return () => { listeners.delete(notify); window.removeEventListener('storage', onStorage); };
}

/** The current value of a signal ('move' or 'tonight') for this account, or null. */
export function useShellSignal(name, userId) {
  return useSyncExternalStore(subscribe, () => read(name, userId), () => null);
}

export function openStartSheet({ row = null } = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(START_SHEET_EVENT, { detail: { row } }));
}

export function openGuide({ mode = 'replay', stop = 0 } = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(GUIDE_EVENT, { detail: { mode, stop } }));
}

/**
 * Call after a deliberate sign-out (You > Settings): the next visit is a returning visitor, so the
 * public header offers Log in first and the login page may say "Welcome back". No personal data.
 */
export function rememberSignedOut() {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(VISITOR_KEY, JSON.stringify({ kind: 'returning' })); } catch { /* the hint is a convenience */ }
  const root = document.documentElement;
  root.dataset.visitor = 'returning';
  delete root.dataset.plan;
  delete root.dataset.started;
}
