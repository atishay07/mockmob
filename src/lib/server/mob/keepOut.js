// S1 (security audit 15 Nov 2026): a member the owner removed must not walk back in with the link they joined by.
// mob_remove deletes the membership and nothing else, and an invite stays usable for its 7 days, so the removed member
// could post the same code to /api/mob/join and be back.
//
// The rule: a removed member stays out of that Mob through every link that existed when they were removed; a fresh
// link the owner makes afterwards lets them back in (the owner invited them again). Today's schema has no ban table,
// so the mark is a row in the database limiter (public.persistent_rate_limits through take_rate_limit, the store the
// guest Ask Mobi and sign-in limits already use): one bucket per (link code, member), HMAC-keyed so no user id is
// stored, kept a day past the longest a link can live. A Mob has one live link at a time (mob_invite_new revokes the
// old one), so marking that link covers every link that still works. No migration is needed.
import { createHmac } from 'node:crypto';

const DAY_MS = 86_400_000;
// An invite lives INVITE_DAYS (7); one more day so a link made just before the removal is still covered at its end.
// take_rate_limit's window is an int4 of milliseconds: 8 days is 691,200,000, well under 2,147,483,647.
export const KEEP_OUT_MS = 8 * DAY_MS;

export function keepOutBucket(secret, code, userId) {
  return `mob_keep_out:${createHmac('sha256', String(secret || 'mob')).update(`${code}:${userId}`).digest('hex').slice(0, 40)}`;
}

/** rpc: the service's rpc (Supabase in production, PGlite in tests). Both calls throw on a database error. */
export function createKeepOut({ rpc, secret }) {
  return {
    /** Mark `userId` as kept out of the Mob that link `code` belongs to. */
    async mark(code, userId) {
      await rpc('take_rate_limit', { p_bucket: keepOutBucket(secret, code, userId), p_limit: 1_000_000, p_window_ms: KEEP_OUT_MS });
    },
    /** True when `userId` was removed from that link's Mob while the link existed. */
    async has(code, userId) {
      const until = await rpc('rate_limit_reset_at', { p_bucket: keepOutBucket(secret, code, userId) });
      return until !== null && until !== undefined;
    },
  };
}
