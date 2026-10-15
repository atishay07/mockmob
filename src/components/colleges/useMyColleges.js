"use client";
// The student's one list of colleges, shared by Today, Compass and Account. One store per page, so a
// college added on a Compass row shows on the Account list without another fetch. Every change is
// shown at once and then confirmed by the server's own answer; when the server refuses or cannot be
// reached the list goes back to what the server last confirmed and says so. Changes run one at a time,
// so two quick taps cannot reorder each other. Rules: src/lib/colleges/model.mjs. Route: /api/me/colleges.
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { api } from '@/lib/fetcher';
import {
  COLLEGES_PATH, errorLine, fromServer, normalizeEntry, withAdded, withMoved, withRemoved,
} from '@/lib/colleges/model.mjs';

const IDLE = Object.freeze({ status: 'idle', colleges: [], busy: false, notice: '' });
const FRESH_MS = 30000;

const store = { userId: null, state: IDLE, loadedAt: 0, loading: false, listeners: new Set(), chain: Promise.resolve(), token: 0 };

function set(patch) {
  store.state = { ...store.state, ...patch };
  store.listeners.forEach((l) => l());
}
const subscribe = (l) => { store.listeners.add(l); return () => store.listeners.delete(l); };
const snapshot = () => store.state;
const serverSnapshot = () => IDLE;

const JSON_HEADERS = { 'Content-Type': 'application/json' };

async function load(userId, { quiet = false } = {}) {
  if (!userId) return;
  if (store.userId !== userId) {
    store.userId = userId; store.token += 1; store.loadedAt = 0; store.loading = false; store.chain = Promise.resolve();
    store.state = { ...IDLE, status: 'loading' };
    store.listeners.forEach((l) => l());
  } else if (store.loading || (store.state.status === 'ready' && Date.now() - store.loadedAt < FRESH_MS)) return;
  else if (store.state.status !== 'ready' && !quiet) set({ status: 'loading' });
  const token = store.token;
  store.loading = true;
  try {
    const colleges = fromServer(await api(COLLEGES_PATH, { cache: 'no-store' }));
    if (token !== store.token) return;
    if (!colleges) { set({ status: 'error' }); return; }
    store.loadedAt = Date.now();
    // A change still in flight owns the list; it will set the server's answer itself.
    if (!store.state.busy) set({ status: 'ready', colleges, notice: '' });
    else set({ status: 'ready' });
  } catch {
    if (token === store.token && store.state.status !== 'ready') set({ status: 'error' });
  } finally {
    if (token === store.token) store.loading = false;
  }
}

/** Runs one change after the earlier ones. `next` is the list to show now; `send` returns the server body. */
function change(next, send) {
  const token = store.token;
  const before = store.state.colleges;
  set({ colleges: next, busy: true, notice: '' });
  const run = async () => {
    try {
      const body = await send();
      if (token !== store.token) return true;
      const confirmed = fromServer(body);
      if (!confirmed) throw new Error('unexpected answer');
      store.loadedAt = Date.now();
      set({ status: 'ready', colleges: confirmed, busy: false, notice: '' });
      return true;
    } catch (error) {
      if (token !== store.token) return false;
      // A full list answers with the server's list; anything else goes back to what was shown before.
      const theirs = error?.status === 409 ? fromServer(error.body) : null;
      set({ colleges: theirs || before, busy: false, notice: errorLine(error) });
      return false;
    }
  };
  const result = store.chain.then(run, run);
  store.chain = result.then(() => undefined, () => undefined);
  return result;
}

/**
 * The list and what can be done to it. `colleges` is [] until `status` is 'ready'. Every action
 * returns a promise for whether the server confirmed it.
 */
export function useMyColleges(userId) {
  const state = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  useEffect(() => { load(userId); }, [userId]);
  const mine = store.userId === userId ? state : IDLE;

  const add = useCallback((raw) => {
    const entry = normalizeEntry(raw);
    if (!entry || !userId) return Promise.resolve(false);
    return change(withAdded(store.state.colleges, entry), () => api(COLLEGES_PATH, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(entry) }));
  }, [userId]);
  const remove = useCallback((raw) => {
    const entry = normalizeEntry(raw);
    if (!entry || !userId) return Promise.resolve(false);
    const q = new URLSearchParams({ programmeId: entry.programmeId, college: entry.college });
    return change(withRemoved(store.state.colleges, entry), () => api(`${COLLEGES_PATH}?${q}`, { method: 'DELETE' }));
  }, [userId]);
  const replace = useCallback((list) => {
    if (!userId) return Promise.resolve(false);
    const entries = list.map(normalizeEntry).filter(Boolean);
    return change(entries.map((e, i) => ({ ...e, position: i + 1 })), () => api(COLLEGES_PATH, { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify({ colleges: entries }) }));
  }, [userId]);
  const move = useCallback((from, to) => {
    const next = withMoved(store.state.colleges, from, to);
    if (next === store.state.colleges || !userId) return Promise.resolve(false);
    return replace(next);
  }, [userId, replace]);
  const retry = useCallback(() => { store.loadedAt = 0; load(userId); }, [userId]);

  return { ...mine, add, remove, move, replace, retry };
}
