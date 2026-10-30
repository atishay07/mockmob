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

/** GET /api/keycards: { enabled, isPro, subjects: [...], today: { due, newLeft, reviewsLeft, minutes } } */
export const readHome = () => apiGet('/api/keycards');
/** GET /api/keycards/deck?chapter=: { chapter, cards, counts: { total, mustKnow, locked }, added } */
export const readDeck = (chapterKey) => apiGet(`/api/keycards/deck?chapter=${q(chapterKey)}`);
/** POST /api/keycards/add with { chapter } or { cardIds }: { added, today } */
export const addToRevise = (input) => apiPost('/api/keycards/add', input?.chapter ? { chapter: input.chapter } : { cardIds: [...(input?.cardIds || [])] });
/** GET /api/keycards/due?limit=: { cards, today } */
export const readDue = (limit = 20) => apiGet(`/api/keycards/due?limit=${q(limit)}`);
/** POST /api/keycards/review: { ok, next: { due_at, interval_days }, today }; 402 PRO_REQUIRED for Free over the day's reviews. */
export const sendReview = ({ cardId, rating, mode, clientReviewedAt = new Date().toISOString() }) => apiPost('/api/keycards/review', { cardId, rating, mode, clientReviewedAt });
/** GET /api/keycards/line?questionId=: { cards, source: 'linked' | 'matched' | 'none', left? } */
export const readLine = (questionId) => apiGet(`/api/keycards/line?questionId=${q(questionId)}`);
/** POST /api/keycards/report: { ok } */
export const sendReport = ({ cardId, reason }) => apiPost('/api/keycards/report', { cardId, reason: String(reason || '').slice(0, 300) });
/** GET /api/me/chapters?subject=: { subject, option, units } (n, right, reason and memory for Pro only) */
export const readChapters = (subject) => apiGet(`/api/me/chapters?subject=${q(subject)}`);
/** PUT /api/me/subject-options: { subject, option } */
export const saveOption = ({ subject, option }) => api('/api/me/subject-options', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subject, option }) });

// ---------------------------------------------------------------- the home read, shared by every entry point on a page

// One read per page visit: the Learn row, the chapter links in Review and /cards all ask for the same body. A write that
// changes it (add, option) calls refreshHome() so the next read is fresh.
let homeRead = null;
const listeners = new Set();
export function refreshHome() {
  homeRead = null;
  for (const fn of listeners) fn();
}
function sharedHome() {
  homeRead ||= readHome().catch((e) => { homeRead = null; throw e; });
  return homeRead;
}

/** { state: 'loading' | 'ready' | 'off' | 'error', data, retry } for GET /api/keycards. `enabled: false` skips the read. */
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
      .catch((e) => { if (alive) setRead({ state: isOff(e) ? 'off' : 'error', data: null }); });
    return () => { alive = false; };
  }, [enabled, nonce]);
  const retry = useCallback(() => { homeRead = null; setRead({ state: 'loading', data: null }); setNonce((n) => n + 1); }, []);
  return { ...read, retry };
}
