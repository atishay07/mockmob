"use client";

// Whether today's included 10-question set is free for this student, read the way the Practice screen reads it: from the server
// quote (GET /api/practice/quote, a Quick set of 10), which looks at the allowance. One read per student per minute is shared by
// every surface on the page (Today, the Start sheet, the result and Review next moves), so the same set never reads two ways.
// Read-only: the quote never charges, reserves or creates a session. Returns 'free' | 'priced' | 'unknown' (src/lib/dailySet.mjs);
// 'unknown' until the read lands, when it fails, and for a signed-out visitor. Pro needs no read: nothing is priced for Pro.
import { useEffect, useState } from 'react';
import { LAUNCH_SUBJECT_IDS } from '../../data/capabilities.js';
import { DAILY_SET, DAILY_SET_QUESTIONS, dailySetFromQuote } from './dailySet.mjs';

const FRESH_MS = 60_000;
// userId -> { at, state } once read, { promise } while it is on its way
const reads = new Map();

const subjectFor = (subject) => (LAUNCH_SUBJECT_IDS.includes(subject) ? subject : LAUNCH_SUBJECT_IDS[0]);

/** One shared read of the quote's allowance. Resolves 'free' | 'priced' | 'unknown'; never rejects. */
export function readDailySet(userId, subject = null, { fetcher = (...args) => fetch(...args), now = () => Date.now() } = {}) {
  if (!userId) return Promise.resolve(DAILY_SET.unknown);
  const hit = reads.get(userId);
  if (hit?.state && now() - hit.at < FRESH_MS) return Promise.resolve(hit.state);
  if (hit?.promise) return hit.promise;
  const params = new URLSearchParams({ subject: subjectFor(subject), mode: 'quick', count: String(DAILY_SET_QUESTIONS) });
  const promise = Promise.resolve()
    .then(() => fetcher(`/api/practice/quote?${params}`, { cache: 'no-store', credentials: 'same-origin' }))
    .then((res) => (res.ok ? res.json() : null))
    .then((body) => dailySetFromQuote(body))
    .catch(() => DAILY_SET.unknown)
    .then((state) => {
      // A failed read is never kept: the next surface asks again.
      if (state === DAILY_SET.unknown) reads.delete(userId); else reads.set(userId, { at: now(), state });
      return state;
    });
  reads.set(userId, { promise, at: now() });
  return promise;
}

/** Forget what was read (a test, or after a session was started and the allowance moved). */
export function forgetDailySet(userId = null) {
  if (userId) reads.delete(userId); else reads.clear();
}

export function useDailySet({ userId = null, premium = false, subject = null } = {}) {
  const [read, setRead] = useState({ userId: null, state: DAILY_SET.unknown });
  useEffect(() => {
    if (!userId || premium) return undefined;
    let live = true;
    readDailySet(userId, subject).then((state) => { if (live) setRead({ userId, state }); });
    return () => { live = false; };
  }, [userId, premium, subject]);
  if (premium) return DAILY_SET.priced;
  return read.userId === userId && userId ? read.state : DAILY_SET.unknown;
}
