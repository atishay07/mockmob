"use client";

// Whether the first full mock in a subject is still free for this student (C-dec 1, data/first_full_mock.js), read the way the
// Practice screen reads it: from the server quote for a Full mock in that subject (GET /api/practice/quote, mode=full). The quote
// is read-only: it never charges, reserves or creates a session. One read per student and subject is shared for a minute by every
// surface that prices a full mock outside Practice (the Start sheet's Full mock row, Today's mock price line), so one full mock
// never reads "free" in one place and "50 credits" in another. Returns 'available' | 'used' | 'unknown': 'unknown' until the read
// lands, when it fails, with no subject and for a signed-out visitor, and 'unknown' is never priced as free. Pro needs no read:
// nothing is priced for Pro.
import { useEffect, useState } from 'react';
import { TEST_MODES } from '../../data/test_modes.js';
import { FIRST_FULL_MOCK_ON, FIRST_FULL_MOCK_STATE, firstFullMockFromQuote } from '../../data/first_full_mock.js';

const FRESH_MS = 60_000;
// `${userId}|${subject}` -> { at, state } once read, { promise, at } while it is on its way
const reads = new Map();

/** One shared read of the rule's state for a student and a subject. Resolves 'available' | 'used' | 'unknown'; never rejects. */
export function readFirstFullMock(userId, subject, { fetcher = (...args) => fetch(...args), now = () => Date.now() } = {}) {
  if (!userId || !subject) return Promise.resolve(FIRST_FULL_MOCK_STATE.unknown);
  const key = `${userId}|${subject}`;
  const hit = reads.get(key);
  if (hit?.state && now() - hit.at < FRESH_MS) return Promise.resolve(hit.state);
  if (hit?.promise) return hit.promise;
  const params = new URLSearchParams({ subject: String(subject), mode: 'full', count: String(TEST_MODES.full.fixedCount) });
  const promise = Promise.resolve()
    .then(() => fetcher(`/api/practice/quote?${params}`, { cache: 'no-store', credentials: 'same-origin' }))
    .then((res) => (res.ok ? res.json() : null))
    .then((body) => firstFullMockFromQuote(body))
    .catch(() => FIRST_FULL_MOCK_STATE.unknown)
    .then((state) => {
      // A failed read is never kept: the next surface asks again.
      if (state === FIRST_FULL_MOCK_STATE.unknown) reads.delete(key); else reads.set(key, { at: now(), state });
      return state;
    });
  reads.set(key, { promise, at: now() });
  return promise;
}

/** Forget what was read (a test, or after a session was started and the free full mock may have been taken). */
export function forgetFirstFullMock(userId = null) {
  if (!userId) { reads.clear(); return; }
  for (const key of [...reads.keys()]) if (key.startsWith(`${userId}|`)) reads.delete(key);
}

/**
 * { state, settled }: the rule's state for this student and subject, and whether the read has landed (a failed read is settled
 * as 'unknown'). With the rule's switch off (FIRST_FULL_MOCK_ENABLED=false) nothing is read and the state is null, which every
 * surface prices as before the rule.
 */
export function useFirstFullMockRead({ userId = null, premium = false, subject = null } = {}) {
  const [read, setRead] = useState({ key: null, state: FIRST_FULL_MOCK_STATE.unknown });
  const key = FIRST_FULL_MOCK_ON && userId && subject && !premium ? `${userId}|${subject}` : null;
  useEffect(() => {
    if (!key) return undefined;
    let live = true;
    readFirstFullMock(userId, subject).then((state) => { if (live) setRead({ key, state }); });
    return () => { live = false; };
  }, [key, userId, subject]);
  if (!FIRST_FULL_MOCK_ON) return { state: null, settled: true };
  if (!key) return { state: FIRST_FULL_MOCK_STATE.unknown, settled: true };
  return read.key === key ? { state: read.state, settled: true } : { state: FIRST_FULL_MOCK_STATE.unknown, settled: false };
}

/** The state alone: 'available' | 'used' | 'unknown', or null when the rule's switch is off. */
export function useFirstFullMock(options = {}) {
  return useFirstFullMockRead(options).state;
}
