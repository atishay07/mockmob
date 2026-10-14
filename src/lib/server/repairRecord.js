// Cross-device repair record (module B7). One row per mistake whose explained repair was stored.
// Source of truth: committed `ai_credit_reservations` rows (action score_recovery_repair) holding a
// stored repair receipt, matched to the student's own attempts. Never returns keys or explanations.
import { createHash } from 'node:crypto';
import { RELEASE_GATES, recoveryReleased } from '../../../data/capabilities.js';

export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 100;
const ATTEMPT_WINDOW = 300; // most recent attempts scanned for matches (documented limit)
const RESERVATION_WINDOW = 500;

export const fail = (code, cause) => Object.assign(new Error(code), { code, cause });

export function parseLimit(raw) {
  if (raw === null || raw === undefined || raw === '') return DEFAULT_LIMIT;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return null;
  return Math.min(n, MAX_LIMIT);
}

// Must stay identical to mistakeId() in src/services/recovery/mistakeRepair.js (that module is
// server-only and not importable from node tests); operation_key is `repair:${id}:${requestId}`.
export const mistakeKey = (userId, attemptId, questionId) =>
  createHash('sha256').update(`${userId}|${attemptId}|${questionId}`).digest('hex').slice(0, 24);

export function repairIdFromOperationKey(key) {
  const m = /^repair:([0-9a-f]{24}):/.exec(String(key || ''));
  return m ? m[1] : null;
}

const iso = v => { const t = Date.parse(v); return Number.isFinite(t) ? new Date(t).toISOString() : null; };

/**
 * Pure mapping. reservations: [{operation_key, updated_at, receipt}], attempts: [{id, subject,
 * completed_at, details, questions_snapshot}]. checks: optional Map<repairId, 'passed'|'not_passed'>
 * (no storage exists yet, so an open gate yields 'pending'). Newest repair first.
 */
export function buildRepairRecord({ userId, reservations, attempts, gates = RELEASE_GATES, checks = new Map(), limit = DEFAULT_LIMIT }) {
  const open = recoveryReleased(gates);
  const wanted = new Map(); // repairId -> repairedAt (latest acknowledgment)
  for (const r of reservations || []) {
    if (!r?.receipt?.repair) continue;
    const id = repairIdFromOperationKey(r.operation_key);
    const at = iso(r.updated_at);
    if (!id || !at) continue;
    if (!wanted.has(id) || at > wanted.get(id)) wanted.set(id, at);
  }
  const rows = [];
  for (const a of attempts || []) {
    const snap = Array.isArray(a.questions_snapshot) ? a.questions_snapshot : [];
    const byId = new Map(snap.map(q => [q?.id, q]));
    for (const d of Array.isArray(a.details) ? a.details : []) {
      if (!d || d.isCorrect !== false || typeof d.qid !== 'string') continue;
      const id = mistakeKey(userId, a.id, d.qid);
      if (!wanted.has(id)) continue;
      const q = byId.get(d.qid);
      const check = checks.get(id);
      rows.push({
        attemptId: a.id,
        questionId: d.qid,
        chapter: (q && typeof q.chapter === 'string' && q.chapter) || null,
        subject: a.subject ?? null,
        foundAt: iso(a.completed_at),
        repairedAt: wanted.get(id),
        checkedState: !open ? 'not_available' : check === 'passed' || check === 'not_passed' ? check : 'pending',
        retriedAt: null,
      });
    }
  }
  rows.sort((x, y) => (y.repairedAt > x.repairedAt ? 1 : y.repairedAt < x.repairedAt ? -1 : 0));
  return rows.slice(0, limit);
}

export async function getRepairRecord(userId, { limit = DEFAULT_LIMIT } = {}) {
  const { supabaseAdmin } = await import('../supabase');
  const db = supabaseAdmin();
  const res = await db.from('ai_credit_reservations').select('operation_key,updated_at,receipt')
    .eq('user_id', userId).eq('state', 'committed').eq('action', 'score_recovery_repair')
    .not('receipt->repair', 'is', null).order('updated_at', { ascending: false }).limit(RESERVATION_WINDOW);
  if (res.error) throw fail('REPAIR_RECORD_UNAVAILABLE', res.error);
  if (!res.data?.length) return [];
  const att = await db.from('attempts').select('id,subject,completed_at,details,questions_snapshot')
    .eq('user_id', userId).order('completed_at', { ascending: false }).limit(ATTEMPT_WINDOW);
  if (att.error) throw fail('REPAIR_RECORD_UNAVAILABLE', att.error);
  return buildRepairRecord({ userId, reservations: res.data, attempts: att.data || [], limit });
}
