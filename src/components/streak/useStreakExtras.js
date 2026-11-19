"use client";
// Two small reads the streak's useful lines need (19 Nov 2026), each once per visit and shared by every place the streak shows:
//   useExamDay   the exam day Road to CUET shows (GET /api/me/road, then roadFigures: the student's own date, else the expected
//                window's first day). A failed read is null, and the pace line is left out (never a guessed date).
//   useDailyToday whether today's Daily Five is still to play: 'open', 'begun', 'played', or null while unknown. This device's
//                record first, then the account (GET /api/daily/me), the same two sources the Daily Five row on Today reads.
// And usePreviewHref: inside the preview, a start key opens the preview's own page with its fixtures, never the real one.
import { useEffect, useState, useSyncExternalStore } from 'react';
import { apiGet } from '@/lib/fetcher';
import { roadFigures } from '@/lib/today/road.mjs';
import { DAILY_FIVE_STORE, readRecord, resultFor, todayDaily } from '@/lib/dailyFive.mjs';
import { DAILY_FIVE_ME_ROUTE, acceptAccount } from '@/lib/dailyFiveAccount.mjs';
import { previewHref } from '@/lib/search/searchSources.mjs';

function store(load) {
  let state = { key: null, status: 'idle', data: null };
  const listeners = new Set();
  const set = (next) => { state = next; for (const l of listeners) l(); };
  return {
    subscribe: (l) => { listeners.add(l); return () => listeners.delete(l); },
    snap: () => state,
    ask(key) {
      if (!key || state.key === key) return;
      set({ key, status: 'loading', data: null });
      load(key).then((data) => { if (state.key === key) set({ key, status: 'ready', data }); })
        .catch(() => { if (state.key === key) set({ key, status: 'error', data: null }); });
    },
  };
}

const road = store(() => apiGet('/api/me/road'));
const IDLE = { key: null, status: 'idle', data: null };

/** { examDay, own } for `today` (the streak's IST day), or null while unknown or when the road did not load. */
export function useExamDay(userId, today) {
  const s = useSyncExternalStore(road.subscribe, road.snap, () => IDLE);
  useEffect(() => { if (userId) road.ask(String(userId)); }, [userId]);
  if (!userId || !today || s.key !== String(userId) || s.status !== 'ready') return null;
  const fig = roadFigures({ today, plan: { examDate: s.data?.examDate ?? null } });
  return fig?.exam ? { examDay: fig.exam, own: Boolean(fig.own) } : null;
}

const daily = store((date) => fetch(DAILY_FIVE_ME_ROUTE, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((b) => {
  const acc = acceptAccount(b);
  return acc && acc.date === date ? acc : null;
}));

/** Today's Daily Five on this account: 'open' | 'begun' | 'played', or null until both sources have answered. */
export function useDailyToday(active = true) {
  const [device, setDevice] = useState(null);
  useEffect(() => {
    if (!active) return undefined;
    const t = window.setTimeout(() => {
      const date = todayDaily(Date.now()).date;
      let record = null;
      try { record = readRecord(window.localStorage.getItem(DAILY_FIVE_STORE)); } catch { record = readRecord(null); }
      setDevice({ date, record });
      daily.ask(date);
    }, 0);
    return () => window.clearTimeout(t);
  }, [active]);
  const s = useSyncExternalStore(daily.subscribe, daily.snap, () => IDLE);
  if (!active || !device) return null;
  const { date, record } = device;
  if (resultFor(record, date, null)) return 'played';
  if (s.key !== date || s.status === 'loading' || s.status === 'idle') return null;
  if (s.status === 'ready' && s.data?.record) return 'played';
  const run = record?.run && record.run.date === date ? record.run : null;
  return run && run.picks.some((p) => p !== null) ? 'begun' : 'open';
}

/** Inside the preview (/preview/arena), a product address becomes the preview's own page for it, keeping the fixture flags. */
export function usePreviewHref(href) {
  const [base, setBase] = useState(null);
  useEffect(() => {
    if (!window.location.pathname.startsWith('/preview/arena')) return undefined;
    const t = window.setTimeout(() => setBase(window.location.search), 0);
    return () => window.clearTimeout(t);
  }, []);
  if (!base || !href) return href;
  const params = new URLSearchParams(base);
  const next = new URLSearchParams();
  for (const k of ['plan', 'data', 'student', 'decks', 'study', 'theme']) if (params.get(k)) next.set(k, params.get(k));
  next.set('view', 'dashboard');
  return previewHref(href, { dashboard: `/preview/arena?${next.toString()}` });
}
