// Server reads behind the Rule book, the rule for the next mock and its check (spec tmp/mistake-lab-v4/SPEC.md 4.8,
// 4.10, 4.12). The arithmetic is pure, in data/rule_book.js and data/across_mocks.js; this file only reads:
//   repairs   committed repair receipts (ai_credit_reservations, action score_recovery_repair), matched to the
//             student's own wrong answers exactly as the repair record does (src/lib/server/repairRecord.js), each
//             with its rule and memory hook through the one payload reader (data/repair_presentation.mjs repairBlocks)
//   playbook  the student's rule rows in recovery_playbook (strategy `rule:<id>`); the old free-text notes are kept,
//             untouched, and never read here
// Read-only except writeRule, which keeps one rule in force per student. No model call, no credit.
import { mistakeKey, repairIdFromOperationKey } from './repairRecord.js';
import { repairBlocks } from '../../../data/repair_presentation.mjs';
import { chapterOf } from '../../../data/attempt_ledger.js';
import { RULE_RULES, buildRuleBook, ruleRows, strategyFor } from '../../../data/rule_book.js';
import { dayLabel, istDate } from '../../../data/revise.js';

const RESERVATION_WINDOW = 500; // the repair record's own window
const PLAYBOOK_WINDOW = 200;

export const fail = (code, cause) => Object.assign(new Error(code), { code, cause });
const iso = (v) => { const t = Date.parse(v); return Number.isFinite(t) ? new Date(t).toISOString() : null; };

/**
 * Pure mapping: reservations [{ operation_key, updated_at, repair }] and the student's attempts (camelCase, as
 * Database.getAttempts returns them) -> [{ id, attemptId, questionId, number, chapter, subject, repairedAt, rule, hook }].
 * A receipt whose payload cannot be shown in full (repairBlocks null) or has no rule gives no row.
 */
export function repairRulesFrom({ userId, reservations, attempts }) {
  const latest = new Map(); // repairId -> { at, repair }
  for (const r of reservations || []) {
    const repair = r?.repair ?? r?.receipt?.repair;
    if (!repair || typeof repair !== 'object') continue;
    const id = repairIdFromOperationKey(r.operation_key);
    const at = iso(r.updated_at);
    if (!id || !at) continue;
    if (!latest.has(id) || at > latest.get(id).at) latest.set(id, { at, repair });
  }
  if (!latest.size) return [];
  const rows = [];
  for (const a of attempts || []) {
    const snap = Array.isArray(a?.questionsSnapshot) ? a.questionsSnapshot : [];
    const numberOf = new Map(snap.map((q, i) => [q?.id, i + 1]));
    const byId = new Map(snap.map((q) => [q?.id, q]));
    for (const d of Array.isArray(a?.details) ? a.details : []) {
      if (!d || d.isCorrect !== false || typeof d.qid !== 'string') continue;
      const id = mistakeKey(userId, a.id, d.qid);
      const found = latest.get(id);
      if (!found) continue;
      const blocks = repairBlocks(found.repair);
      if (!blocks?.rule) continue;
      rows.push({
        id, attemptId: a.id, questionId: d.qid, number: numberOf.get(d.qid) ?? null,
        chapter: chapterOf(byId.get(d.qid)), subject: a.subject ?? null, repairedAt: found.at,
        rule: blocks.rule, hook: blocks.hook ?? null,
      });
    }
  }
  return rows;
}

/**
 * The rule of the student's own repair of one question, for Revise (the rule comes back with the question): the newest committed
 * repair of this question across the student's papers, { rule, hook, repairedAt, day }, or null when they never repaired it or a
 * read failed. `attemptsOf()` returns the student's attempts (Database.getAttempts). Read-only; no model, no credit.
 */
export async function ruleForQuestion(userId, questionId, { attemptsOf, db } = {}) {
  if (typeof questionId !== 'string' || !questionId || typeof attemptsOf !== 'function') return null;
  const client = db || (await import('../supabase')).supabaseAdmin();
  const res = await client.from('ai_credit_reservations').select('operation_key,updated_at,repair:receipt->repair')
    .eq('user_id', userId).eq('state', 'committed').eq('action', 'score_recovery_repair')
    .not('receipt->repair', 'is', null).order('updated_at', { ascending: false }).limit(RESERVATION_WINDOW);
  if (res.error || !res.data?.length) return null;
  const attempts = await attemptsOf();
  const mine = repairRulesFrom({ userId, reservations: res.data, attempts }).filter((r) => r.questionId === questionId)
    .sort((a, b) => (a.repairedAt < b.repairedAt ? 1 : a.repairedAt > b.repairedAt ? -1 : 0));
  const newest = mine[0];
  if (!newest) return null;
  return { rule: newest.rule, hook: newest.hook, repairedAt: newest.repairedAt, day: dayLabel(istDate(Date.parse(newest.repairedAt))) };
}

/** The student's repairs with rules and their playbook rule rows. Throws RULES_UNAVAILABLE when a read fails. */
export async function loadRuleSources(userId, attempts, { db } = {}) {
  const client = db || (await import('../supabase')).supabaseAdmin();
  const [res, book] = await Promise.all([
    client.from('ai_credit_reservations').select('operation_key,updated_at,repair:receipt->repair')
      .eq('user_id', userId).eq('state', 'committed').eq('action', 'score_recovery_repair')
      .not('receipt->repair', 'is', null).order('updated_at', { ascending: false }).limit(RESERVATION_WINDOW),
    client.from('recovery_playbook').select('id,attempt_id,strategy,reflection,evidence_state,created_at')
      .eq('user_id', userId).like('strategy', `${RULE_RULES.strategyPrefix}%`).order('created_at', { ascending: false }).limit(PLAYBOOK_WINDOW),
  ]);
  if (res.error || book.error) throw fail('RULES_UNAVAILABLE', res.error || book.error);
  return { repairs: repairRulesFrom({ userId, reservations: res.data || [], attempts }), playbook: book.data || [] };
}

/** The Rule book for the student as it stands now. */
export async function readRuleBook(userId, attempts, { db } = {}) {
  const sources = await loadRuleSources(userId, attempts, { db });
  return { sources, book: buildRuleBook({ attempts, repairs: sources.repairs, playbook: sources.playbook }) };
}

/**
 * Keep `rule` as the one rule in force. The row is anchored to the student's newest attempt (recovery_playbook needs
 * an attempt), so the rows of one stretch between two papers share an anchor: choosing again before the next paper
 * replaces that stretch's choice, and the rows of earlier stretches stay as the record of what was in force then.
 * Idempotent: the same choice twice leaves one active row. Every other rule row of the student is marked retired.
 */
export async function writeRule(userId, rule, { anchorAttemptId, db, now = Date.now() } = {}) {
  if (!anchorAttemptId) throw fail('NO_ATTEMPT');
  const client = db || (await import('../supabase')).supabaseAdmin();
  const strategy = strategyFor(rule.id);
  const at = new Date(now).toISOString();
  const up = await client.from('recovery_playbook').upsert(
    { user_id: userId, attempt_id: anchorAttemptId, strategy, reflection: rule.text, evidence_state: 'active', created_at: at },
    { onConflict: 'user_id,attempt_id,strategy' },
  ).select('id').single();
  if (up.error || !up.data?.id) throw fail('PLAYBOOK_UNAVAILABLE', up.error);
  // Retire the rest after the write, so a failure part-way never leaves the student with no rule they chose. Readers
  // take the newest row in any case (data/rule_book.js activeRule), so a retire that fails changes nothing they show.
  const retire = await client.from('recovery_playbook').update({ evidence_state: 'retired' })
    .eq('user_id', userId).like('strategy', `${RULE_RULES.strategyPrefix}%`).eq('evidence_state', 'active').neq('id', up.data.id);
  if (retire.error) console.warn('[ruleBook] retire skipped:', retire.error?.message);
  return { id: rule.id, kind: rule.kind, text: rule.text, since: at };
}

export { ruleRows };
