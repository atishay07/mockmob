import 'server-only';
// Loads the student's own records and returns the finished badge list (badges.js), cached per student.
//
// Cost: the rhythm reads that `getRhythm` already makes, plus ONE slim read of the student's own attempts
// (id, subject, correct, wrong, total, completed_at, mode, scoringVersion; oldest first; never details, keys
// or question snapshots). The finished answer is kept in memory per student for 5 minutes, and the route adds
// `private, max-age=60` and an ETag, so repeat calls cost nothing. A badge once earned is never taken back,
// so a cached answer can only lack a very new badge, never show a wrong one. An answer with an unreadable
// part (`unavailable` not empty) is not cached.
import { supabaseAdmin } from '@/lib/supabase';
import { getRhythm } from './appPrefs';
import { buildBadges, etagOf, ATTEMPT_LIMIT, SERVER_SCORING } from './badges';

export const CACHE_MS = 5 * 60 * 1000;
const CACHE_MAX = 500;
const cache = new Map(); // userId -> { at, body, etag }

const fail = (msg, cause) => Object.assign(new Error(msg), { cause });

async function loadAttemptRows(userId) {
  const { data, error } = await supabaseAdmin().from('attempts')
    .select('id,subject,correct,wrong,total,completed_at,mode:selection_meta->>mode,scoringVersion:selection_meta->>scoringVersion')
    .eq('user_id', userId).in('selection_meta->>scoringVersion', SERVER_SCORING)
    .order('completed_at', { ascending: true }).limit(ATTEMPT_LIMIT);
  if (error) throw fail('BADGES_UNAVAILABLE', error);
  return data || [];
}

/** { body, etag } for this student. Own rows only: the id comes from the session. Throws when a read fails. */
export async function getBadges(userId, now = Date.now()) {
  const hit = cache.get(userId);
  if (hit && now - hit.at < CACHE_MS) return { body: hit.body, etag: hit.etag, cached: true };
  const [rhythm, attemptRows] = await Promise.all([getRhythm(userId, now), loadAttemptRows(userId)]);
  const body = buildBadges({ rhythm, attemptRows, generatedAt: now });
  const etag = etagOf(body);
  if (!body.unavailable.length) {
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
    cache.set(userId, { at: now, body, etag });
  }
  return { body, etag, cached: false };
}

/** Drops a student's cached list (tests, and a future caller that writes a record behind a badge). */
export function forgetBadges(userId) { cache.delete(userId); }
