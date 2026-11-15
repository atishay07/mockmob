// The database side of the welcome and day-2 emails, on a Supabase client passed in (the service-role client in production,
// a fake in the tests). No 'server-only' import for that reason; only src/lib/email/studentMailServer.js wires it.
//
// Tables:
//   email_sends, email_optouts   new (supabase/migrations/20261115180000_student_emails.sql). Until that migration is applied,
//                                ready() is false and nothing is sent.
//   persistent_rate_limits        read: the sign-in emails' daily count; written only through take_rate_limit and
//                                rate_limit_give_back, for this email's own daily cap.
//   users, attempts, user_question_progress, ai_credit_reservations, account_deletion_requests   read only.
import { mistakeKey, repairIdFromOperationKey } from '../server/repairRecord.js';
import { getSubjectById } from '../../../data/subjects.js';
import {
  DAILY_SLOT_WINDOW_MS, answeredSince, dailySlotBucket, dayTwoState, signInCeilingBucket,
} from './studentMailModel.mjs';

export const SENDS = 'email_sends';
export const OPTOUTS = 'email_optouts';
const ID_CHUNK = 100;
const ATTEMPTS_READ = 10;

const fail = (error) => Object.assign(new Error('EMAIL_STORE_UNAVAILABLE'), { cause: error });
const iso = (ms) => new Date(ms).toISOString();
const chunks = (list, size) => {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
};

/** The name a student sees for a subject id, or ''. */
export function subjectNameOf(id) {
  if (typeof id !== 'string' || !id) return '';
  try { return getSubjectById(id)?.name || ''; } catch { return ''; }
}

/**
 * @param db a Supabase client (db.from(table) ..., db.rpc(name, args))
 * @param env for the sign-in ceiling's bucket name
 */
export function createStudentMailStore(db, { env = process.env } = {}) {
  const rows = async (query) => {
    const { data, error } = await query;
    if (error) throw fail(error);
    return Array.isArray(data) ? data : [];
  };
  const idsIn = async (ids, build) => {
    const found = new Set();
    for (const part of chunks(ids, ID_CHUNK)) for (const r of await rows(build(part))) found.add(r.user_id);
    return found;
  };

  return {
    /** Both tables answer (the migration is applied). Any error, missing table or not, reads as not ready. */
    async ready() {
      try {
        const [a, b] = await Promise.all([db.from(SENDS).select('user_id').limit(1), db.from(OPTOUTS).select('user_id').limit(1)]);
        return !a.error && !b.error;
      } catch { return false; }
    },

    async optedOut(userId) {
      return (await rows(db.from(OPTOUTS).select('user_id').eq('user_id', userId).limit(1))).length > 0;
    },

    async wasSent(userId, kind) {
      return (await rows(db.from(SENDS).select('user_id').eq('user_id', userId).eq('kind', kind).limit(1))).length > 0;
    },

    /** The atomic claim: true only for the one call whose insert made the row. A duplicate is false; any other error throws. */
    async claim(userId, kind, now = Date.now()) {
      const { data, error } = await db.from(SENDS).insert({ user_id: userId, kind, claimed_at: iso(now) }).select('user_id');
      if (error) {
        if (String(error.code) === '23505') return false;
        throw fail(error);
      }
      return Array.isArray(data) && data.length === 1;
    },

    async markSent(userId, kind, providerId, now = Date.now()) {
      const patch = { sent_at: iso(now), provider_id: providerId ? String(providerId).slice(0, 120) : null };
      const { error } = await db.from(SENDS).update(patch).eq('user_id', userId).eq('kind', kind);
      if (error) throw fail(error);
    },

    async markFailed(userId, kind, reason, now = Date.now()) {
      const { error } = await db.from(SENDS).update({ failed_at: iso(now), failure: String(reason || 'failed').slice(0, 120) }).eq('user_id', userId).eq('kind', kind);
      if (error) throw fail(error);
    },

    /** Turns both emails off for one student. Idempotent. */
    async optOut(userId, now = Date.now()) {
      const { error } = await db.from(OPTOUTS).upsert({ user_id: userId, created_at: iso(now) }, { onConflict: 'user_id', ignoreDuplicates: true });
      if (error) throw fail(error);
      return true;
    },

    /** The sign-in emails' daily count: { count, resetAt } or null when the bucket has no row. */
    async signInUse() {
      const found = await rows(db.from('persistent_rate_limits').select('count,reset_at').eq('bucket', signInCeilingBucket(env)).limit(1));
      return found[0] ? { count: found[0].count, resetAt: found[0].reset_at } : null;
    },

    /** One slot of today's cap (atomic, in the database). */
    async takeDailySlot(day, cap) {
      const { data, error } = await db.rpc('take_rate_limit', { p_bucket: dailySlotBucket(day), p_limit: cap, p_window_ms: DAILY_SLOT_WINDOW_MS });
      if (error) throw fail(error);
      return data === true;
    },

    async giveBackDailySlot(day) {
      const { error } = await db.rpc('rate_limit_give_back', { p_bucket: dailySlotBucket(day) });
      if (error) throw fail(error);
    },

    /** Accounts made in [from, to) (ms), oldest first. */
    async dayTwoCandidates({ from, to, limit = 500 }) {
      return rows(db.from('users').select('id,email,subjects,created_at,deleted_at')
        .gte('created_at', iso(from)).lt('created_at', iso(to)).is('deleted_at', null)
        .order('created_at', { ascending: true }).limit(limit));
    },

    /** Of these ids: who unsubscribed, who was already sent the day-2 email, who asked for their account to be deleted. */
    async dayTwoFilters(ids) {
      const list = [...new Set(ids)].filter(Boolean);
      const [optedOut, sent, pendingDeletion] = await Promise.all([
        idsIn(list, (part) => db.from(OPTOUTS).select('user_id').in('user_id', part)),
        idsIn(list, (part) => db.from(SENDS).select('user_id').eq('kind', 'day2').in('user_id', part)),
        idsIn(list, (part) => db.from('account_deletion_requests').select('user_id').eq('status', 'pending').in('user_id', part)),
      ]);
      return { optedOut, sent, pendingDeletion };
    },

    /** True when the student answered anything since `since` (ms): one row of each kind is enough. */
    async answeredSince(userId, since) {
      const at = iso(since);
      const [attempts, progress, repairs] = await Promise.all([
        rows(db.from('attempts').select('completed_at,correct,wrong').eq('user_id', userId).gte('completed_at', at).order('completed_at', { ascending: false }).limit(20)),
        rows(db.from('user_question_progress').select('last_attempted_at').eq('user_id', userId).gte('last_attempted_at', at).limit(1)),
        rows(db.from('ai_credit_reservations').select('updated_at').eq('user_id', userId).eq('state', 'committed').eq('action', 'score_recovery_repair').gte('updated_at', at).limit(1)),
      ]);
      return answeredSince({ attempts, progress, repairs }, since);
    },

    /** The day-2 email's action for one student, with the subject's name for the words. */
    async dayTwoState(user) {
      const [attempts, repairs] = await Promise.all([
        rows(db.from('attempts').select('id,subject,completed_at,details').eq('user_id', user.id).order('completed_at', { ascending: false }).limit(ATTEMPTS_READ)),
        rows(db.from('ai_credit_reservations').select('operation_key').eq('user_id', user.id).eq('state', 'committed').eq('action', 'score_recovery_repair').not('receipt->repair', 'is', null).limit(1000)),
      ]);
      const repaired = new Set(repairs.map((r) => repairIdFromOperationKey(r.operation_key)).filter(Boolean));
      const state = dayTwoState({ attempts, isRepaired: (attemptId, qid) => repaired.has(mistakeKey(user.id, attemptId, qid)) });
      const chosen = Array.isArray(user.subjects) ? user.subjects.find((s) => typeof s === 'string') : null;
      const subject = state.kind === 'first' ? chosen || null : state.subject;
      return { ...state, subject, subjectName: subjectNameOf(subject) };
    },
  };
}
