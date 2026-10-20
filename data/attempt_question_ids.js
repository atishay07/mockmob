// The question ids of a student's newest attempts, through public.attempt_question_ids (migration 20261020150100, written, NOT applied;
// egress items A9, F13, F14, 20 Oct 2026). No 'server-only' and no alias imports: the database is passed in.
//
// The recency lookup of a practice start, the seen set and the previous NTA papers of an NTA start need only the ids of the questions
// of the newest few papers, and read whole attempt rows (a snapshot is 32 KB on average). The function returns the ids (and family
// ids) of each snapshot in order and nothing else, with the same filter and limit as the callers' own query, so the sets are exactly
// the old ones. A function that is not there (PostgREST PGRST202, Postgres 42883) answers null and is not asked again for five
// minutes: the caller reads the snapshots as before. Any other error comes back as { error } and the caller treats it as it treated
// an error of its own read (recency and seen degrade to "nothing seen" and say so; the previous-papers lookup is marked failed).
const RETRY_MS = 5 * 60 * 1000;
let missingAt = null;

export const questionIdsFunctionMissing = (error) => error?.code === 'PGRST202' || error?.code === '42883';

/** Test hook. */
export function resetAttemptQuestionIdsState() { missingAt = null; }

/**
 * { rows: [{ attemptId, questionIds, familyIds }] } (newest first), { error }, or null when the function is not there.
 * `subject` and `mode` filter when given; `limit` is the newest N.
 */
export async function readAttemptQuestionIds(db, { userId, subject = null, mode = null, limit = null, now = Date.now, signal = null } = {}) {
  if (!userId || typeof db?.rpc !== 'function') return null;
  if (missingAt !== null && now() - missingAt < RETRY_MS) return null;
  let call = db.rpc('attempt_question_ids', { p_user_id: userId, p_subject: subject, p_mode: mode, p_limit: limit });
  if (signal && typeof call.abortSignal === 'function') call = call.abortSignal(signal);
  const { data, error } = await call;
  if (error) {
    if (questionIdsFunctionMissing(error)) { missingAt = now(); return null; }
    return { error };
  }
  return { rows: (data || []).map((row) => ({ attemptId: row.attempt_id, questionIds: row.question_ids || [], familyIds: row.family_ids || [] })) };
}
