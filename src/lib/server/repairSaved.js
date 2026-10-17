// Saved repairs (F17). A finished Mistake Repair is stored on its committed `ai_credit_reservations` row
// (action score_recovery_repair, operation_key `repair:<mistakeId>:<requestId>`, receipt.repair). Two readers share
// the same rule so the screen and the paid route can never disagree:
//   findStoredRepair      the route's "reopen free" lookup for one mistake (src/services/recovery/mistakeRepair.js);
//   savedRepairsForAttempt which wrong answers of one paper already hold a saved repair (the result page opens them
//                          at once and never offers a second paid repair).
// Pure mapping first, then the thin reads. No key, explanation or receipt body leaves this file except the one
// stored repair the route is about to return to its own student.
import { mistakeKey, repairIdFromOperationKey } from './repairRecord.js';

export const SAVED_WINDOW = 500; // newest committed repairs scanned for one paper (the same documented limit as the repair record)

export const lookupFailed = (cause) => Object.assign(new Error('repair_lookup_unavailable'), { code: 'repair_lookup_unavailable', cause });

const iso = (v) => { const t = Date.parse(v); return Number.isFinite(t) ? new Date(t).toISOString() : null; };

/** The stored repair on a receipt, or null. PostgREST returns jsonb as an object; a JSON string is accepted too. */
export function repairFromReceipt(receipt) {
  let r = receipt;
  if (typeof r === 'string') { try { r = JSON.parse(r); } catch { return null; } }
  const repair = r && typeof r === 'object' ? r.repair : null;
  return repair && typeof repair === 'object' && !Array.isArray(repair) ? repair : null;
}

/**
 * The newest stored repair for one mistake, or null when there is none. A failed read THROWS: "could not look" must
 * never read as "nothing saved", because the caller would then reserve and charge a second credit for a repair the
 * student already owns. `db` is a supabase-js client (PostgREST).
 */
export async function findStoredRepair(db, userId, id) {
  const { data, error } = await db.from('ai_credit_reservations').select('receipt,created_at').eq('user_id', userId).eq('state', 'committed')
    .like('operation_key', `repair:${id}:%`).order('created_at', { ascending: false }).limit(20);
  if (error) throw lookupFailed(error);
  for (const row of Array.isArray(data) ? data : []) {
    const repair = repairFromReceipt(row?.receipt);
    if (repair) return repair;
  }
  return null;
}

/**
 * Which wrong answers of this paper already hold a saved repair: { [questionId]: { repairedAt } }, latest
 * acknowledgment per mistake. reservations: [{ operation_key, updated_at, receipt }] (committed, any attempt).
 * Only the student's own mistakes of this attempt match, because the id is a hash of user, attempt and question.
 */
export function savedRepairsForAttempt({ userId, attempt, reservations }) {
  const at = new Map(); // mistakeId -> latest repairedAt
  for (const r of reservations || []) {
    if (!repairFromReceipt(r?.receipt)) continue;
    const id = repairIdFromOperationKey(r.operation_key);
    const when = iso(r.updated_at ?? r.created_at);
    if (!id || !when) continue;
    if (!at.has(id) || when > at.get(id)) at.set(id, when);
  }
  const out = {};
  for (const d of Array.isArray(attempt?.details) ? attempt.details : []) {
    if (!d || d.isCorrect !== false || typeof d.qid !== 'string') continue;
    const when = at.get(mistakeKey(userId, attempt.id, d.qid));
    if (when) out[d.qid] = { repairedAt: when };
  }
  return out;
}

/** One read for the paper on screen. Throws on a failed read; the caller leaves the field out (the result still loads). */
export async function getSavedRepairs(db, userId, attempt) {
  if (!attempt?.id) return {};
  const wrong = (Array.isArray(attempt.details) ? attempt.details : []).some((d) => d?.isCorrect === false);
  if (!wrong) return {};
  const res = await db.from('ai_credit_reservations').select('operation_key,updated_at,receipt')
    .eq('user_id', userId).eq('state', 'committed').eq('action', 'score_recovery_repair')
    .not('receipt->repair', 'is', null).order('updated_at', { ascending: false }).limit(SAVED_WINDOW);
  if (res.error) throw lookupFailed(res.error);
  return savedRepairsForAttempt({ userId, attempt, reservations: res.data || [] });
}

/**
 * Per paper, how many of its wrong answers hold a saved repair: { [attemptId]: n }. For the Review list, which
 * shows each session with "2 repaired". attempts: [{ id, details }]; reservations as above.
 */
export function repairedCounts({ userId, attempts, reservations }) {
  const ids = new Set();
  for (const r of reservations || []) {
    if (!repairFromReceipt(r?.receipt)) continue;
    const id = repairIdFromOperationKey(r.operation_key);
    if (id) ids.add(id);
  }
  const out = {};
  for (const a of attempts || []) {
    let n = 0;
    for (const d of Array.isArray(a?.details) ? a.details : []) {
      if (d && d.isCorrect === false && typeof d.qid === 'string' && ids.has(mistakeKey(userId, a.id, d.qid))) n += 1;
    }
    if (n) out[a.id] = n;
  }
  return out;
}

export async function getRepairedCounts(db, userId, attempts) {
  return (await getRepairedByPaper(db, userId, attempts)).counts;
}

/**
 * Per paper, which wrong answers hold a saved repair: { [attemptId]: [questionId, ...] }. Review's Mistakes view marks each
 * of those rows "repaired, opens free" (F17). Same reservations and rule as repairedCounts.
 */
export function repairedQids({ userId, attempts, reservations }) {
  const ids = new Set();
  for (const r of reservations || []) {
    if (!repairFromReceipt(r?.receipt)) continue;
    const id = repairIdFromOperationKey(r.operation_key);
    if (id) ids.add(id);
  }
  const out = {};
  for (const a of attempts || []) {
    const qids = [];
    for (const d of Array.isArray(a?.details) ? a.details : []) {
      if (d && d.isCorrect === false && typeof d.qid === 'string' && ids.has(mistakeKey(userId, a.id, d.qid))) qids.push(d.qid);
    }
    if (qids.length) out[a.id] = qids;
  }
  return out;
}

/** One read for both: { counts: { [attemptId]: n }, qids: { [attemptId]: [questionId] } }. Throws on a failed read. */
export async function getRepairedByPaper(db, userId, attempts) {
  if (!(attempts || []).some((a) => (a?.details || []).some((d) => d?.isCorrect === false))) return { counts: {}, qids: {} };
  const res = await db.from('ai_credit_reservations').select('operation_key,receipt')
    .eq('user_id', userId).eq('state', 'committed').eq('action', 'score_recovery_repair')
    .not('receipt->repair', 'is', null).order('updated_at', { ascending: false }).limit(SAVED_WINDOW);
  if (res.error) throw lookupFailed(res.error);
  const reservations = res.data || [];
  return { counts: repairedCounts({ userId, attempts, reservations }), qids: repairedQids({ userId, attempts, reservations }) };
}
