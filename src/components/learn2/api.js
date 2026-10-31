'use client';
// Learn v2 client calls. The shapes are the contract in mockmob-next/docs/brain/learn-1031/API-CONTRACT.md:
// add fields there first, never rename. In the development preview (?decks=real) these routes are answered by
// the real handlers over the bundled decks and an in-memory student (src/lib/server/learnPreview.js).
import { useCallback, useEffect, useRef, useState } from 'react';

async function call(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    cache: 'no-store',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const error = new Error(data?.error || `Request failed (${res.status})`);
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}

const q = (params) => new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '')).toString();

export const learnSubject = (subject) => call(`/api/learn/subject?${q({ subject })}`);
export const previewRun = ({ chapterKey, minutes, leaveOut = [] }) => call('/api/learn/runs/preview', { method: 'POST', body: { chapterKey, minutes, leaveOut } });
export const startRun = ({ chapterKey, cardIds, minutes, leaveOut = [], kind = 'mix' }) => call('/api/learn/runs', { method: 'POST', body: { chapterKey, cardIds, minutes, leaveOut, kind } });
export const answerItem = (runId, { itemId, choice }) => call(`/api/learn/runs/${encodeURIComponent(runId)}/answer`, { method: 'POST', body: { itemId, choice } });
export const rateItem = (runId, { itemId, rating }) => call(`/api/learn/runs/${encodeURIComponent(runId)}/rate`, { method: 'POST', body: { itemId, rating } });
export const runEnd = (runId) => call(`/api/learn/runs/${encodeURIComponent(runId)}/end`);
export const chapterCards = ({ chapter, filter = 'all' }) => call(`/api/learn/cards?${q({ chapter, filter })}`);
export const learnShelves = (subject) => call(`/api/learn/shelves?${q({ subject })}`);
export const learnSearch = ({ subject, query }) => call(`/api/learn/search?${q({ subject, q: query })}`);
export const feedCovers = (subject) => call(`/api/learn/covers?${q({ subject })}`);
/** The feed's Keep: the card joins Revise with its first real schedule (402: past Free's allowance). */
export const keepItem = (runId, itemId) => call(`/api/learn/runs/${encodeURIComponent(runId)}/rate`, { method: 'POST', body: { itemId, keep: true } });
/** Save a question to Saved (the same route as Explore's save; 402 is Free's save limit). */
export const saveQuestion = (questionId) => call('/api/bookmarks', { method: 'POST', body: { questionId, saved: true } });

/** One read with loading, error and a refresh that keeps the previous data on screen while it runs. */
export function useLearnRead(read, deps) {
  const [state, setState] = useState({ status: 'loading', data: null, error: null });
  const seq = useRef(0);
  const load = useCallback(async () => {
    const mine = ++seq.current;
    setState((s) => ({ ...s, status: s.data ? 'refreshing' : 'loading' }));
    try {
      const data = await read();
      if (mine === seq.current) setState({ status: 'ready', data, error: null });
      return data;
    } catch (error) {
      if (mine === seq.current) setState((s) => ({ status: s.data ? 'ready' : 'error', data: s.data, error }));
      return null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { load(); }, [load]);
  return { ...state, refresh: load };
}
