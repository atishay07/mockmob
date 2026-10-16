// The key-quality loop's write (data/trap_atlas.js keyQualityFlags; spec tmp/mistake-lab-v4/SPEC.md "Slice 4"): a wrong
// option picked by 20 or more other students, and by more of them than the key, sends the question to the existing
// re-check queue. That queue is the held state the AI key dispute already uses (src/services/recovery/mistakeRepair.js
// withheldForRecheck): the question is held (status pending, verification state disputed, exploration state
// pending_review) until it is re-checked, so it leaves practice, NTA papers and repairs, and shows to students who met it
// as "under re-check". Only a live question is held, and only by a conditional update, so a question already held, rejected
// or being edited is left as it is. No model call. The evidence (the counts) goes to the script's report; no student id is
// involved, so no interaction row is written (that table needs a student).
// Used by scripts/cohort/key-quality-loop.mjs, which defaults to a dry run. No 'server-only', so node:test can load it.

/** Hold one flagged question. Returns { held: boolean, reason? }. Throws when a read or write fails. */
export async function recheckFlaggedKey(db, { qid, now = new Date() }) {
  if (!qid) return { held: false, reason: 'no_question' };
  const current = await db.from('questions').select('id,status,verification_state').eq('id', qid).maybeSingle();
  if (current.error) throw current.error;
  if (!current.data) return { held: false, reason: 'not_found' };
  if (current.data.status !== 'live') return { held: false, reason: 'not_live' };
  const held = await db.from('questions')
    .update({ status: 'pending', verification_state: 'disputed', exploration_state: 'pending_review', updated_at: now.toISOString() })
    .eq('id', qid).eq('status', 'live').select('id');
  if (held.error) throw held.error;
  return held.data?.length ? { held: true } : { held: false, reason: 'not_live' };
}
