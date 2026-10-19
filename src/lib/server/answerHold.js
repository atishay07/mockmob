// The Mob paper's answer hold on the server (src/lib/mob/paperHold.mjs has the rule and the copy). Every route that can
// show a key, an explanation or a per-question right or wrong of a paper reads its attempts through these helpers, so a
// Mob paper that is still open for the Mob shows its marks and nothing that gives an answer away.
// No 'server-only' and no '@/' imports, so node:test drives it (data/tests/mob_paper_hold.test.mjs).
import { attemptHold, isHeld } from '../mob/paperHold.mjs';

export { attemptForClient, attemptHold, heldAttemptView, heldCompare, isHeld, openAttemptsOnly } from '../mob/paperHold.mjs';

// A weekly paper holds to the end of its week and an extra paper to the end of the following week at the latest, so an
// attempt finished more than 16 days ago is never held.
export const HOLD_LOOKBACK_DAYS = 16;

/**
 * The student's Mob papers that are still held at `now`, from one small read (the tagged attempts of the last
 * HOLD_LOOKBACK_DAYS days; only their ids, tags and per-question ids): { byId: Map(attemptId -> hold), qids: Set }.
 * For lists whose rows no longer carry the tag (the summary function) and for Revise, which works from question ids.
 * Throws the database error; each caller decides what a failed read means for it.
 */
export async function readHeldMobPapers(db, userId, now = Date.now()) {
  const byId = new Map();
  const qids = new Set();
  if (!db || !userId) return { byId, qids };
  const since = new Date(now - HOLD_LOOKBACK_DAYS * 86_400_000).toISOString();
  const { data, error } = await db.from('attempts')
    .select('id,completed_at,mobPaper:selection_meta->mobPaper,details')
    .eq('user_id', userId)
    .not('selection_meta->mobPaper', 'is', null)
    .gte('completed_at', since);
  if (error) throw error;
  for (const row of data || []) {
    const hold = attemptHold({ mobPaper: row.mobPaper }, now);
    if (!hold) continue;
    byId.set(row.id, hold);
    for (const d of Array.isArray(row.details) ? row.details : []) if (d && typeof d.qid === 'string') qids.add(d.qid);
  }
  return { byId, qids };
}

/** The same, never throwing: a failed read holds nothing and says so in the log. */
export async function readHeldMobPapersSafe(db, userId, now = Date.now(), where = 'mob hold') {
  try { return await readHeldMobPapers(db, userId, now); } catch (e) {
    console.warn(`[${where}] held Mob papers unread:`, e?.message || e);
    return { byId: new Map(), qids: new Set(), failed: true };
  }
}

/**
 * Wraps an attempt loader for the routes that work on ONE question of ONE paper (repair, check it held, Ask Mobi about a
 * question, doubt threads, replay): a held Mob paper reads as not found, so none of them can open its key early.
 */
export const openAttemptLoader = (load, now = () => Date.now()) => async (id) => {
  const attempt = await load(id);
  return attempt && isHeld(attempt, now()) ? null : attempt;
};
