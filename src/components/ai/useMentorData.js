"use client";

// What Ask Mobi's page reads once and shares between its two views (Chat, Your record): the newest paper, the saved
// exchanges and where the student stands. Each read is the route the page read before it became a chat; nothing new is asked
// of the server.
import { useEffect, useState } from 'react';
import { analyseSession } from '../../../data/session_recovery.js';
import { paperIsOpen } from './askDoors.mjs';
import { exchangesFrom } from './mentorHistory.mjs';

/** The newest paper, read from its own answers: the summary row first, then the saved paper for the chapters that cost the most. */
export function useLastPaper(enabled, userId) {
  const [state, setState] = useState({ userId: null, item: null, analysis: null });
  useEffect(() => {
    if (!enabled || !userId) return undefined;
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/attempts/summary?limit=1', { cache: 'no-store' });
        const body = await res.json().catch(() => null);
        const item = res.ok && Array.isArray(body?.items) ? body.items[0] || null : null;
        if (!alive) return;
        if (!paperIsOpen(item)) { setState({ userId, item, analysis: null }); return; }
        setState({ userId, item, analysis: null });
        const paper = await fetch(`/api/attempts/${encodeURIComponent(item.id)}`, { cache: 'no-store' });
        if (!paper.ok) return;
        const attempt = await paper.json();
        if (alive) setState({ userId, item, analysis: analyseSession(attempt) });
      } catch { /* Without the paper the ask is simply not offered (or answers from its marks alone). */ }
    })();
    return () => { alive = false; };
  }, [enabled, userId]);
  return state.userId === userId ? state : { item: null, analysis: null };
}

/** History: what the history route saved, newest first. null while reading. `tick` reads it again (after a new exchange). */
export function useRecent(userId, tick = 0) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    if (!userId) return undefined;
    let alive = true;
    fetch('/api/ai/mentor/history', { cache: 'no-store' })
      .then((res) => res.json().then((data) => ({ res, data })))
      .then(({ res, data }) => { if (alive) setRows(res.ok && data?.ok ? exchangesFrom(data.messages) : []); })
      .catch(() => { if (alive) setRows([]); });
    return () => { alive = false; };
  }, [userId, tick]);
  return rows;
}

/** Where you stand (GET /api/mobi/standing, free): { read: { phase, body }, retry }. One read for the context line and the card. */
export function useStanding(userId) {
  const [read, setRead] = useState({ phase: 'loading', body: null });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!userId) return undefined;
    let alive = true;
    fetch('/api/mobi/standing', { cache: 'no-store' })
      .then(async (res) => ({ res, body: await res.json().catch(() => null) }))
      .then(({ res, body }) => { if (alive) setRead(res.ok && body?.ok ? { phase: 'done', body } : { phase: 'error', body: null }); })
      .catch(() => { if (alive) setRead({ phase: navigator.onLine === false ? 'offline' : 'error', body: null }); });
    return () => { alive = false; };
  }, [userId, tick]);
  return { read, retry: () => { setRead({ phase: 'loading', body: null }); setTick((n) => n + 1); } };
}
