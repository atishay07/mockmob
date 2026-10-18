// GET /api/me/credits (audit findings 12 and 13): both credit pools, the plan and one merged history.
// Read-only over the two ledgers that already exist: credit_transactions (Practice credits) and
// ai_credit_ledger (AI credits). Nothing here writes, spends, resets or grants.
//
// The body is the fixed contract in data/tests/fixtures/credits/contract_credits_v1.json, shared byte for byte
// with the app (flutter_app/test/fixtures/credits/):
//   { practice:{balance,renewsOn,label}, ai:{balance,renewsOn,label}, plan:{name,until},
//     history:[{at,pool,what,delta,balanceAfter}], nextCursor }
// Rules:
//   * Two names only: "Practice credits" and "AI credits".
//   * A balance that cannot be read is null, never 0. renewsOn is null when a pool does not renew.
//   * History is newest first, 30 a page. ?cursor= is opaque; it carries where the page stopped and the running
//     balance of each pool, so every page states its own balance after each line with no recount.
//   * Every line says what happened in plain words, with the question and subject for a repair when they can be found.
import { mistakeKey, repairIdFromOperationKey } from './repairRecord.js';
import { subjectName } from '../../components/profile/accountModel.mjs';

export const PAGE_SIZE = 30;
export const PRACTICE_LABEL = 'Practice credits';
export const AI_LABEL = 'AI credits';
export const CREDITS_COPY = Object.freeze({
  unavailable: 'Your credits could not be loaded. Try again shortly.',
  badCursor: 'That page marker is not valid. Start again from the newest line.',
});

const REPAIR_WINDOW = 300; // most recent attempts scanned to name a repair line (the repair record's own window)
const IST_MS = (5 * 60 + 30) * 60 * 1000;

const int = (v) => (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '')) && Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : null;

/** "YYYY-MM-DD" in India time, or null. */
export function istDate(value) {
  const t = Date.parse(value);
  return Number.isFinite(t) ? new Date(t + IST_MS).toISOString().slice(0, 10) : null;
}

/** A sortable microsecond key for a Postgres timestamp, so ordering never loses the digits a Date would drop. */
export function tsKey(raw) {
  const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(?:\.(\d+))?(Z|[+-]00(?::?00)?)?$/.exec(String(raw || ''));
  if (m) return `${m[1]}T${m[2]}.${(m[3] || '').padEnd(6, '0').slice(0, 6)}`;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? `${new Date(t).toISOString().slice(0, 19)}.${String(t % 1000).padStart(3, '0')}000` : '';
}

const newer = (a, b) => (a.key !== b.key ? (a.key < b.key ? 1 : -1) : a.id < b.id ? 1 : a.id > b.id ? -1 : 0);

// ---------------------------------------------------------------------------------------------
// Cursor

export function encodeCursor({ at, id, practice, ai }) {
  return Buffer.from(JSON.stringify({ at, id, p: practice, a: ai }), 'utf8').toString('base64url');
}

/** The cursor, or undefined when it is not one of ours (the route answers 422). null when absent. */
export function parseCursor(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw !== 'string' || raw.length > 400 || !/^[A-Za-z0-9_-]+$/.test(raw)) return undefined;
  try {
    const c = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    if (typeof c?.at !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:?\d{2})?$/.test(c.at) || typeof c?.id !== 'string' || !/^[0-9a-fA-F-]{8,64}$/.test(c.id)) return undefined;
    const p = c.p === null ? null : int(c.p);
    const a = c.a === null ? null : int(c.a);
    if ((c.p !== null && p === null) || (c.a !== null && a === null)) return undefined;
    return { at: c.at, id: c.id.toLowerCase(), practice: p, ai: a };
  } catch { return undefined; }
}

// ---------------------------------------------------------------------------------------------
// Words

const PRACTICE_SPEND = Object.freeze({ attempt: 'Practice set', attempt_5: 'Practice set', attempt_10: 'Practice set', attempt_15: 'Practice set', attempt_20: 'Practice set', attempt_full: 'Full mock', generate: 'Practice set' });

/** What a Practice credits line says, in plain words. */
export function practiceWhat(row) {
  const ref = String(row?.reference || '');
  const action = String(row?.action || '');
  const delta = int(row?.credit_delta ?? row?.amount) ?? 0;
  if (ref.startsWith('daily_login:')) return 'Daily bonus';
  if (ref.startsWith('vote:')) return 'Rated a question';
  if (/^attempt:.+:question:/.test(ref)) return 'Practice answers';
  if (action === 'contribute' || ref.startsWith('question_approved_')) return 'Question approved';
  if (delta < 0) return PRACTICE_SPEND[action] || 'Practice';
  return 'Credits added';
}

const AI_FEATURE = (feature) => {
  const f = String(feature || '');
  if (f === 'score_recovery_repair') return 'Repair';
  if (f.startsWith('prepos_')) return 'Ask Mobi';
  if (/rival/i.test(f)) return 'Rival battle';
  return 'AI help';
};

/** What an AI credits line says. `detail` is "Q7 Accountancy" for a repair when it could be found. */
export function aiWhat(row, detail = null) {
  const reason = String(row?.reason || '');
  const name = AI_FEATURE(row?.feature);
  const tail = detail ? `, ${detail}` : '';
  if (reason === 'monthly_grant') return 'Free credits for the month';
  if (reason === 'pack_purchase') return 'Credits added';
  if (reason === 'admin_adjustment') return 'Adjustment from MockMob';
  if (reason === 'expiry') return 'Free credits ended';
  if (reason === 'ai_release') return `${name} returned${tail}`;
  return `${name}${tail}`;
}

// ---------------------------------------------------------------------------------------------
// Repair lines: the ledger keeps an operation key (repair:<id>:<request>); the id is a hash of the student, attempt and
// question. Matching it against the student's own attempts names the question number and subject.

/** Map repairId -> "Q7 Accountancy" for the repair ids wanted. attempts are snake_case rows. */
export function repairDetails({ userId, ids, attempts }) {
  const out = new Map();
  if (!ids?.size) return out;
  for (const a of attempts || []) {
    const snap = Array.isArray(a?.questions_snapshot) ? a.questions_snapshot : [];
    const numberOf = new Map(snap.map((q, i) => [q?.id, i + 1]));
    for (const d of Array.isArray(a?.details) ? a.details : []) {
      if (!d || typeof d.qid !== 'string') continue;
      const id = mistakeKey(userId, a.id, d.qid);
      if (!ids.has(id) || out.has(id)) continue;
      const n = numberOf.get(d.qid);
      const subject = a.subject ? subjectName(a.subject) : null;
      const text = [n ? `Q${n}` : null, subject].filter(Boolean).join(' ');
      if (text) out.set(id, text);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// The history

/**
 * One page. practiceRows are credit_transactions rows and aiRows are ai_credit_ledger rows, each already limited to
 * what is older than the cursor and fetched newest first (PAGE_SIZE + 1 of each is enough). Returns { history, next }
 * where next is the cursor for the page after this one, or null.
 */
export function buildHistory({ practiceRows, aiRows, practiceBalance, aiBalance, total, periodStart = null, cursor = null, details = new Map(), pageSize = PAGE_SIZE }) {
  // One credits balance (18 Oct 2026, D78): with `total` passed, every line states the ONE balance after it, counted back
  // from the live total across both ledgers. The free monthly credits come back silently at the IST month start (no ledger
  // row), so a line older than `periodStart` has no balance to state (null, never a guessed number).
  if (total !== undefined) return buildOneBalanceHistory({ practiceRows, aiRows, total, periodStart, cursor, details, pageSize });
  const lines = [];
  for (const r of practiceRows || []) {
    const delta = int(r?.credit_delta ?? r?.amount);
    if (delta === null || !r?.id || !r.created_at) continue;
    lines.push({ pool: 'practice', id: String(r.id).toLowerCase(), raw: r.created_at, key: tsKey(r.created_at), delta, row: r });
  }
  for (const r of aiRows || []) {
    const delta = int(r?.amount);
    if (delta === null || !r?.id || !r.created_at) continue;
    lines.push({ pool: 'ai', id: String(r.id).toLowerCase(), raw: r.created_at, key: tsKey(r.created_at), delta, row: r });
  }
  lines.sort(newer);
  const page = lines.slice(0, pageSize);
  let p = cursor ? cursor.practice : practiceBalance;
  let a = cursor ? cursor.ai : aiBalance;
  const history = [];
  let next = null;
  for (const line of page) {
    let balanceAfter;
    if (line.pool === 'practice') {
      balanceAfter = p;
      p = p === null ? null : p - line.delta;
      history.push({ at: new Date(line.raw).toISOString(), pool: 'practice', what: practiceWhat(line.row), delta: line.delta, balanceAfter });
    } else {
      const recorded = int(line.row.balance_after);
      balanceAfter = recorded !== null ? recorded : a;
      a = balanceAfter === null ? null : balanceAfter - line.delta;
      const repairId = String(line.row.feature) === 'score_recovery_repair' ? repairIdFromOperationKey(line.row.reference) : null;
      history.push({ at: new Date(line.raw).toISOString(), pool: 'ai', what: aiWhat(line.row, repairId ? details.get(repairId) || null : null), delta: line.delta, balanceAfter });
    }
  }
  if (lines.length > pageSize) {
    const last = page[page.length - 1];
    next = encodeCursor({ at: last.raw, id: last.id, practice: p, ai: a });
  }
  return { history, next };
}

function mergedLines(practiceRows, aiRows) {
  const lines = [];
  for (const r of practiceRows || []) {
    const delta = int(r?.credit_delta ?? r?.amount);
    if (delta === null || !r?.id || !r.created_at) continue;
    lines.push({ pool: 'practice', id: String(r.id).toLowerCase(), raw: r.created_at, key: tsKey(r.created_at), delta, row: r });
  }
  for (const r of aiRows || []) {
    const delta = int(r?.amount);
    if (delta === null || !r?.id || !r.created_at) continue;
    lines.push({ pool: 'ai', id: String(r.id).toLowerCase(), raw: r.created_at, key: tsKey(r.created_at), delta, row: r });
  }
  return lines.sort(newer);
}

function buildOneBalanceHistory({ practiceRows, aiRows, total, periodStart, cursor, details, pageSize }) {
  const lines = mergedLines(practiceRows, aiRows);
  const page = lines.slice(0, pageSize);
  const since = periodStart ? tsKey(periodStart) : '';
  // The cursor's `p` carries the one running balance (its `a` stays null in this mode).
  let running = cursor ? cursor.practice : int(total);
  const history = [];
  for (const line of page) {
    if (since && line.key < since) running = null;
    const balanceAfter = running;
    running = running === null ? null : running - line.delta;
    if (line.pool === 'practice') {
      history.push({ at: new Date(line.raw).toISOString(), pool: 'practice', what: practiceWhat(line.row), delta: line.delta, balanceAfter });
    } else {
      const repairId = String(line.row.feature) === 'score_recovery_repair' ? repairIdFromOperationKey(line.row.reference) : null;
      history.push({ at: new Date(line.raw).toISOString(), pool: 'ai', what: aiWhat(line.row, repairId ? details.get(repairId) || null : null), delta: line.delta, balanceAfter });
    }
  }
  let next = null;
  if (lines.length > pageSize) {
    const last = page[page.length - 1];
    next = encodeCursor({ at: last.raw, id: last.id, practice: running, ai: null });
  }
  return { history, next };
}

/** The ids of the repair lines in a set of ledger rows, for the one attempts read that names them. */
export function repairIdsIn(aiRows) {
  const ids = new Set();
  for (const r of aiRows || []) {
    if (String(r?.feature) !== 'score_recovery_repair') continue;
    const id = repairIdFromOperationKey(r.reference);
    if (id) ids.add(id);
  }
  return ids;
}

// ---------------------------------------------------------------------------------------------
// The body

/** The plan, from the one entitlement rule. until is the paid-through date in India time, or null. */
export function planOf({ paid, premiumUntil }) {
  return { name: paid ? 'Pro' : 'Free', until: paid ? istDate(premiumUntil) : null };
}

/**
 * The AI-wallet pool only (this month's free credits + bonus credits), or null when unknown. Since the one credits balance
 * (18 Oct 2026) readAIWallet's total also counts users.credit_balance; the contract's two pools must not count it twice,
 * so practice.balance + ai.balance is the one total.
 */
export function aiPoolBalance(wallet) {
  if (!wallet?.known || int(wallet.total) === null) return null;
  return int(wallet.total) - (int(wallet.balanceCredits) ?? 0);
}

/**
 * The whole response. wallet is readAIWallet's view (known: false when it could not be read).
 * Practice credits do not renew, so their renewsOn is null.
 */
export function creditsBody({ practiceBalance, wallet, paid, premiumUntil, history, next, unified }) {
  const aiBalance = aiPoolBalance(wallet);
  const aiKnown = aiBalance !== null;
  const body = {
    practice: { balance: int(practiceBalance), renewsOn: null, label: PRACTICE_LABEL },
    ai: { balance: aiBalance, renewsOn: aiKnown ? istDate(wallet.resetAt) : null, label: AI_LABEL },
    plan: planOf({ paid, premiumUntil }),
    history,
    nextCursor: next,
  };
  // One credits balance (18 Oct 2026, D78): the one figure every screen shows, from getUnifiedWallet. Additive: older
  // readers keep the two stored parts above (practice.balance + ai.balance = total.balance).
  if (unified !== undefined) body.total = oneBalanceBlock(unified);
  return body;
}

/** { balance, freeLeft, freeAllowance, held, renewsOn, label } from getUnifiedWallet's view; every number null when unknown. */
export function oneBalanceBlock(unified) {
  const known = Boolean(unified?.known) && int(unified.total) !== null;
  return {
    balance: known ? int(unified.total) : null,
    freeLeft: known ? int(unified.freeLeft) : null,
    freeAllowance: known ? int(unified.freeAllowance) : null,
    held: known ? int(unified.held) : null,
    renewsOn: known ? istDate(unified.resetAt) : null,
    label: 'Credits',
  };
}

// ---------------------------------------------------------------------------------------------
// Reads (server only)

const missing = (error) => /42p01|does not exist|schema cache/i.test(`${error?.code || ''} ${error?.message || ''}`);
const fail = (code, cause) => Object.assign(new Error(code), { code, cause });

// Rows strictly older than the cursor in (created_at, id) order. The cursor's own timestamp is reused as written,
// so no microsecond is lost between pages.
function olderThan(query, cursor) {
  if (!cursor) return query;
  return query.or(`created_at.lt.${cursor.at},and(created_at.eq.${cursor.at},id.lt.${cursor.id})`);
}

/** One page of the history for a student: { history, next }. Throws CREDITS_UNAVAILABLE on a read failure. */
export async function loadHistory({ userId, practiceBalance, aiBalance, total, periodStart = null, cursor = null, db, pageSize = PAGE_SIZE }) {
  const client = db || (await import('../supabase')).supabaseAdmin();
  const take = pageSize + 1;
  const practiceQuery = olderThan(client.from('credit_transactions')
    .select('id,created_at,amount,credit_delta,type,action,reference').eq('user_id', userId), cursor)
    .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(take);
  const aiQuery = olderThan(client.from('ai_credit_ledger')
    .select('id,created_at,amount,reason,feature,reference,balance_after').eq('user_id', userId), cursor)
    .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(take);
  const [practice, ai] = await Promise.all([practiceQuery, aiQuery]);
  if (practice.error && !missing(practice.error)) throw fail('CREDITS_UNAVAILABLE', practice.error);
  if (ai.error && !missing(ai.error)) throw fail('CREDITS_UNAVAILABLE', ai.error);
  const practiceRows = practice.error ? [] : practice.data || [];
  const aiRows = ai.error ? [] : ai.data || [];

  let details = new Map();
  const ids = repairIdsIn(aiRows);
  if (ids.size) {
    // Naming a repair is a nicety: if the attempts read fails the line still says "Repair".
    try {
      const att = await client.from('attempts').select('id,subject,details,questions_snapshot')
        .eq('user_id', userId).order('completed_at', { ascending: false }).limit(REPAIR_WINDOW);
      if (!att.error) details = repairDetails({ userId, ids, attempts: att.data || [] });
    } catch { /* keep the plain line */ }
  }
  return buildHistory({ practiceRows, aiRows, practiceBalance, aiBalance, total, periodStart, cursor, details, pageSize });
}
