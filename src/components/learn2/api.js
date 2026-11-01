'use client';
// Learn v2 client calls. The shapes are the contract in docs/brain/learn-1031/API-CONTRACT.md: add fields there first, never
// rename. In production these are the routes of src/app/api/learn/** (src/lib/server/learn.js); in the development preview
// (?decks=real) the same handlers answer over the bundled decks and an in-memory student (src/lib/server/learnPreview.js).
//
// Starts carry a request key (BUILD-1101 1.3): one id per start tap, kept in sessionStorage for the page, so a retried or
// reloaded start returns the same run instead of a second one. A new tap (or `fresh: true`, "Another 10 minutes") takes a
// new key; ending a run lets its key go.
//
// Errors: every failure throws an Error with `status` and `data` (as before), plus `code` and a `kind` the pages can switch on:
//   402 FREE_SESSION_USED                          kind 'session_used'      (data.line, data.options, data.resume)
//   402 PRO_REQUIRED                               kind 'pro_required'
//   409 QUESTION_CHANGED | QUESTION_HELD           kind 'question_changed' | 'question_held'   (skip the item with one line)
//   409 RUN_EXPIRED | RUN_ENDED                    kind 'run_expired' | 'run_ended'           (go to the end screen, data.endHref)
//   404 LEARN_OFF                                  kind 'off'
//   404 CHAPTER_NOT_FOUND                          kind 'chapter_not_found'  (a chapter that is not there: its own state, not a retry)
import { useCallback, useEffect, useRef, useState } from 'react';

const KINDS = Object.freeze({
  FREE_SESSION_USED: 'session_used', PRO_REQUIRED: 'pro_required', QUESTION_CHANGED: 'question_changed', QUESTION_HELD: 'question_held',
  RUN_EXPIRED: 'run_expired', RUN_ENDED: 'run_ended', LEARN_OFF: 'off', CHAPTER_NOT_FOUND: 'chapter_not_found',
});

/** A failed Learn call. `kind` is one of the KINDS values, or 'error'. */
export class LearnError extends Error {
  constructor(status, data) {
    super(data?.error || `Request failed (${status})`);
    this.name = 'LearnError';
    this.status = status;
    this.data = data;
    this.code = data?.error || null;
    this.kind = KINDS[this.code] || 'error';
  }
}
/** Free's Learn session for today is used (402): show `error.data.line`, never a modal. */
export const isSessionUsed = (error) => error?.kind === 'session_used';
/** The question changed or is held by an open Mob paper (409): skip the item with one line. */
export const isQuestionSkipped = (error) => error?.kind === 'question_changed' || error?.kind === 'question_held';
/** The run ended or expired (409): go to its end screen (`error.data.endHref`). */
export const isRunClosed = (error) => error?.kind === 'run_expired' || error?.kind === 'run_ended';
/** The chapter is not there (404 CHAPTER_NOT_FOUND): draw the missing-chapter state; trying again would not help. */
export const isChapterMissing = (error) => error?.kind === 'chapter_not_found';

async function call(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    cache: 'no-store',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new LearnError(res.status, data);
  return data;
}

const q = (params) => new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '')).toString();

// ---------------------------------------------------------------- request keys (one per start tap, kept for the page)

const KEY_PREFIX = 'learn2:start:';
const store = () => { try { return typeof window !== 'undefined' ? window.sessionStorage : null; } catch { return null; } };
const randomHex = (n) => {
  const bytes = new Uint8Array(n);
  try { globalThis.crypto.getRandomValues(bytes); } catch { for (let i = 0; i < n; i += 1) bytes[i] = Math.floor(Math.random() * 256); }
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
};
/** A new request key: 'lk_' and 24 hex characters (the server takes 8 to 100 of [A-Za-z0-9_-]). */
export const newRequestKey = () => `lk_${randomHex(12)}`;
/** The start's place on this page: the path, the kind and the chapter (or the first card of a set). */
export const startScope = ({ kind = 'mix', chapterKey = null, cardIds = null } = {}) => {
  const page = typeof window !== 'undefined' ? window.location.pathname : '';
  return `${page}|${kind}|${chapterKey || (Array.isArray(cardIds) && cardIds[0]) || ''}`;
};
/** The request key of a start on this page: the kept one (a reload or a retry), or a new one when `renew` (a new tap). */
export function requestKeyFor(scope, { renew = false } = {}) {
  const s = store();
  const slot = `${KEY_PREFIX}${scope}`;
  if (!renew && s) {
    try { const kept = JSON.parse(s.getItem(slot) || 'null'); if (kept?.key) return kept.key; } catch { /* a new key */ }
  }
  const key = newRequestKey();
  try { s?.setItem(slot, JSON.stringify({ key, runId: null })); } catch { /* storage off: the key lives for this call */ }
  return key;
}
function keepRun(scope, key, runId) {
  try { store()?.setItem(`${KEY_PREFIX}${scope}`, JSON.stringify({ key, runId })); } catch { /* storage off */ }
}
/** Let the key of an ended run go, so the next tap on the page starts a new run. */
export function forgetRun(runId) {
  const s = store();
  if (!s || !runId) return;
  try {
    for (let i = s.length - 1; i >= 0; i -= 1) {
      const name = s.key(i);
      if (!name?.startsWith(KEY_PREFIX)) continue;
      const kept = JSON.parse(s.getItem(name) || 'null');
      if (kept?.runId === runId) s.removeItem(name);
    }
  } catch { /* storage off */ }
}

// ---------------------------------------------------------------- the routes

export const learnSubject = (subject) => call(`/api/learn/subject?${q({ subject })}`);
export const previewRun = ({ chapterKey, minutes, leaveOut = [], addNext }) => call('/api/learn/runs/preview', { method: 'POST', body: { chapterKey, minutes, leaveOut, ...(addNext ? { addNext: true } : {}) } });
/**
 * Start a run or a feed (or pick one up). `requestKey` defaults to the page's kept key for this start (see requestKeyFor);
 * `fresh: true` never resumes and takes a new key; `resume` names a run to pick up. A start from an Explore cover sends
 * `source: 'explore_cover'`, `forYou` (the cover was the For you one) and `position` (0-based place in the row); the server
 * keeps them in the run's start_state.
 */
export async function startRun({ chapterKey, cardIds, minutes, leaveOut = [], kind = 'mix', requestKey, resume, fresh, addNext, source, forYou, position } = {}) {
  const scope = startScope({ kind, chapterKey, cardIds });
  const key = requestKey || requestKeyFor(scope, { renew: fresh === true });
  const data = await call('/api/learn/runs', {
    method: 'POST',
    body: { chapterKey, cardIds, minutes, leaveOut, kind, requestKey: key, ...(resume ? { resume } : {}), ...(fresh ? { fresh: true } : {}), ...(addNext ? { addNext: true } : {}),
      ...(source ? { source, ...(forYou === true ? { forYou: true } : {}), ...(Number.isInteger(position) ? { position } : {}) } : {}) },
  });
  if (data?.id) keepRun(scope, key, data.id);
  return data;
}
/** A run as it stands (a reload with ?run=<id>): only the items not done, `resumed: { done, of }`. */
export const getRun = (runId) => call(`/api/learn/runs/${encodeURIComponent(runId)}`);
export const answerItem = (runId, { itemId, choice }) => call(`/api/learn/runs/${encodeURIComponent(runId)}/answer`, { method: 'POST', body: { itemId, choice } });
export const rateItem = (runId, { itemId, rating }) => call(`/api/learn/runs/${encodeURIComponent(runId)}/rate`, { method: 'POST', body: { itemId, rating } });
/**
 * A run's end. Every kind carries `done: { reached, of, minutes }` ("You stopped at 8 of 21." / "All 21 done in 9 min.");
 * a feed's `feed.done` is the same object.
 */
export async function runEnd(runId) {
  const data = await call(`/api/learn/runs/${encodeURIComponent(runId)}/end`);
  forgetRun(runId);
  return data;
}
export const chapterCards = ({ chapter, filter = 'all' }) => call(`/api/learn/cards?${q({ chapter, filter })}`);
/** Find's shelf over a whole subject in one request: { plan, filter, lockedCount, chapters: [{ key, title, ref, counts, cards }] }. */
export const subjectCards = ({ subject, filter = 'all' }) => call(`/api/learn/cards?${q({ subject, filter })}`);
export const learnShelves = (subject) => call(`/api/learn/shelves?${q({ subject })}`);

/** The Key cards due today over every subject: the sum of each subject's own count (shelves.due.bySubject), so the sidebar's badge and the subject rows add up (M5). */
export const dueTotal = (shelves) => {
  const by = shelves?.due?.bySubject;
  if (by && typeof by === 'object') return Object.values(by).reduce((s, n) => s + (Number(n) || 0), 0);
  return Number(shelves?.due?.all) || 0;
};

/**
 * { due: number | null } for the shell's Learn badge under Learn v2: the due count summed over the subjects, read again whenever
 * `refreshKey` changes (a student coming back from a run), null while it loads or when the read fails (no badge, never a wrong one).
 */
export function useLearnDue({ enabled = true, refreshKey = '' } = {}) {
  const [due, setDue] = useState(null);
  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    learnShelves().then((d) => { if (alive) setDue(dueTotal(d)); }).catch(() => { if (alive) setDue((prev) => prev); });
    return () => { alive = false; };
  }, [enabled, refreshKey]);
  return due;
}
export const learnSearch = ({ subject, query }) => call(`/api/learn/search?${q({ subject, q: query })}`);
/**
 * The Explore covers. Each cover's `counts[m]` (m = 5, 10, 20) is `{ cards, questions, minutes, hook, shrink?, capped? }`: `hook` is the
 * first card of the feed a start at that length serves (null: no card, show the questions face), `shrink.reason` is why that length
 * was cut (pool | cap | mistakes), `capped` is true only when Free's 10-minute clamp really cut the run. `cover.hook` is `counts[10].hook`.
 */
export const feedCovers = (subject) => call(`/api/learn/covers?${q({ subject })}`);
/** The feed's Keep: the card joins Revise as a new card (402 only for a locked card). */
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
