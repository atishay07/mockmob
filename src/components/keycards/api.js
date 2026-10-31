"use client";
// The one fetch layer for Key cards (KEYCARDS-BUILD-SPEC.md section 2e). Every screen reads and writes through these
// functions, so integrating the real server is this one file. Shapes are exactly the spec's; the fixtures in ./fixtures.js
// answer the same paths in the development preview.
//
// Errors: the shared fetcher throws an Error with `status` and `body`. `isOff(e)` is the feature flag being off (404
// KEY_CARDS_OFF), which every screen treats as "hide", never as a failure. `isProRequired(e)` is a Free limit (402).
import { useCallback, useEffect, useState } from 'react';
import { api, apiGet, apiPost } from '@/lib/fetcher';

const q = (v) => encodeURIComponent(String(v));

export const isOff = (e) => e?.status === 404 && e?.body?.error === 'KEY_CARDS_OFF';
export const isProRequired = (e) => e?.status === 402 && e?.body?.error === 'PRO_REQUIRED';

/** The server's reason on a 402 ('keycard_reviews', 'keycard_new', 'keycards'), or null. */
export const proReason = (e) => (isProRequired(e) && typeof e.body.reason === 'string' ? e.body.reason : null);

// Free's 5 new cards a day are used (402 keycard_new): Study stops offering new cards for the rest of this day on this page visit.
let newCardsUsedOn = null;
const dayKey = () => new Date().toISOString().slice(0, 10);
export const markNewCardsUsed = () => { newCardsUsedOn = dayKey(); };
export const newCardsUsedToday = () => newCardsUsedOn === dayKey();

/** GET /api/keycards: { enabled, isPro, subjects: [...], today: { due, newLeft, reviewsLeft, minutes } } */
export const readHome = () => apiGet('/api/keycards');
/** GET /api/keycards/deck?chapter=: { chapter, cards, counts: { total, mustKnow, locked }, added } */
export const readDeck = (chapterKey) => apiGet(`/api/keycards/deck?chapter=${q(chapterKey)}`);
/**
 * POST /api/keycards/add with { chapter } or { cardIds }: { added, today }. "The line you needed" also sends from: 'mistake'
 * (the kc-server route records it as added_from 'mistake'; without it a card list is 'manual').
 */
export const addToRevise = (input) => apiPost('/api/keycards/add', input?.chapter
  ? { chapter: input.chapter }
  : { cardIds: [...(input?.cardIds || [])], ...(input?.from === 'mistake' ? { from: 'mistake' } : {}) });
/** GET /api/keycards/due?limit=: { cards, today } */
export const readDue = (limit = 20) => apiGet(`/api/keycards/due?limit=${q(limit)}`);
/** POST /api/keycards/review: { ok, next, today } or { ok, late: true } (logged, not scheduled: done, nothing to show); 402 PRO_REQUIRED
 *  with reason keycard_reviews (the day's reviews), keycard_new (the day's new cards) or keycards (a card Free cannot hold). */
export const sendReview = ({ cardId, rating, mode, clientReviewedAt = new Date().toISOString() }) => apiPost('/api/keycards/review', { cardId, rating, mode, clientReviewedAt });
/** GET /api/keycards/line?questionId=: { cards, source: 'linked' | 'matched' | 'none', left? } */
export const readLine = (questionId) => apiGet(`/api/keycards/line?questionId=${q(questionId)}`);
/** POST /api/keycards/report: { ok } */
export const sendReport = ({ cardId, reason }) => apiPost('/api/keycards/report', { cardId, reason: String(reason || '').slice(0, 300) });
/** GET /api/me/chapters?subject=: { subject, option, units } (n, right, reason and memory for Pro only; a chapter state may be 'unknown') */
export const readChapters = (subject) => apiGet(`/api/me/chapters?subject=${q(subject)}`);
/** PUT /api/me/subject-options: { subject, option } */
export const saveOption = ({ subject, option }) => api('/api/me/subject-options', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subject, option }) });

// ---------------------------------------------------------------- the home read, shared by every entry point on a page

// One read per page visit: the Learn row, the chapter links in Review and /cards all ask for the same body. A write that
// changes it (add, option) calls refreshHome() so the next read is fresh.
let homeRead = null;
const listeners = new Set();
/**
 * Drops the shared read and, when a screen is listening, starts the new one now. Returns that read's promise (the new body,
 * or a rejection when it failed) so a caller that must wait for the fresh data, such as the option picker, can: the screens
 * listening keep the body they have until the new one lands. With nobody listening it only drops the cache and resolves null.
 */
export function refreshHome() {
  homeRead = null;
  const read = listeners.size ? sharedHome() : null;
  for (const fn of listeners) fn();
  if (read) read.catch(() => { /* every listener and the caller handle their own failure */ });
  return read || Promise.resolve(null);
}
function sharedHome() {
  homeRead ||= readHome().catch((e) => { homeRead = null; throw e; });
  return homeRead;
}

/**
 * { state: 'loading' | 'ready' | 'off' | 'error', data, retry } for GET /api/keycards. `enabled: false` skips the read.
 * A re-read (refreshHome) that fails after the page already has its body keeps that body and state; only a first read that
 * fails is the error state.
 */
export function useKeycardsHome({ enabled = true } = {}) {
  const [read, setRead] = useState({ state: 'loading', data: null });
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    const bump = () => setNonce((n) => n + 1);
    listeners.add(bump);
    return () => { listeners.delete(bump); };
  }, []);
  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    sharedHome()
      .then((data) => { if (alive) setRead({ state: data && data.enabled !== false ? 'ready' : 'off', data }); })
      .catch((e) => { if (alive) setRead((prev) => (isOff(e) ? { state: 'off', data: null } : prev.data ? prev : { state: 'error', data: null })); });
    return () => { alive = false; };
  }, [enabled, nonce]);
  const retry = useCallback(() => { homeRead = null; setRead({ state: 'loading', data: null }); setNonce((n) => n + 1); }, []);
  return { ...read, retry };
}
