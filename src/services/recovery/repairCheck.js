// Mistake Repair, the check: the whole lifecycle with every dependency injected (no 'server-only' and no alias imports,
// like repairFlow.js, so data/tests/repair_check_flow.test.mjs runs it over fakes). src/services/recovery/repairCheckDeps.js
// wires the real database in.
//
//   openCheck     GET  /api/recovery/check    the one fresh question, or why there is none, or the stored answer
//   answerCheck   POST /api/recovery/check    marks it against today's key and stores the result
//   checkStatus   the `check` field on the repair response (no question text, no key)
//
// The check is part of the repair the student already paid for: nothing here reserves, charges or releases a credit and
// no model is called. The result lives on the repair's committed reservation receipt (receipt.check), claimed once, so
// the first answer counts and a second request for the same repair gets the stored result back unchanged.
import { repairEligibility } from '../../../data/mistake_repair.js';
import { isPassageLinkedQuestion } from '../../../data/nta_question_selector.js';
import {
  CHECK_REQUEST_ID, CHECK_VERSION, checkReasonMessage, selectCheckQuestion, chooseVerified, checkIsStillOffered, shuffledOrder,
  checkQuestionView, markCheck, bankExplanation, outcomeLine, planReviseCards, reviseSummary,
} from '../../../data/repair_check.js';
import { mistakeId } from './repairFlow.js';

const out = (http, body) => ({ http, body });
// How many ranked candidates the publication gate (which needs the full row) looks at per read, and in total.
export const VERIFY_BATCH = 12;
export const VERIFY_MAX = 96;
const ID_LIMIT = 160;
const validId = (value) => typeof value === 'string' && value.length > 0 && value.length <= ID_LIMIT;

/** The seed of the display order. The same on every reload and in the marking, so the client never sends the order back. */
export const orderSeed = (userId, mistakeKey, checkQuestionId) => `${userId}|${mistakeKey}|${checkQuestionId}`;

/** Where the client finds the check and the Ask Mobi follow-up for one mistake. Relative links. */
export function checkLinks(attemptId, questionId) {
  return {
    href: `/api/recovery/check?attemptId=${encodeURIComponent(attemptId)}&questionId=${encodeURIComponent(questionId)}`,
    askHref: `/mentor?tab=ask&q=${encodeURIComponent(attemptId)}:${encodeURIComponent(questionId)}`,
  };
}

const failure = (http, status, reason, extra = {}) => out(http, { ok: false, status, error: reason, reason, message: checkReasonMessage(reason), charged: 0, ...extra });

async function prepare({ user, attemptId, questionId, deps, preloaded }) {
  const attempt = preloaded?.attempt !== undefined ? preloaded.attempt : await deps.loadAttempt(attemptId).catch(() => null);
  let current = preloaded?.current;
  if (current === undefined) {
    const loaded = await deps.loadQuestion(questionId);
    if (loaded?.error) return { fail: out(503, { ok: false, error: 'question_unavailable', message: 'This question could not be loaded.', charged: 0 }) };
    current = loaded?.data ?? null;
  }
  const eligible = repairEligibility({ attempt, questionId, userId: user.id, current });
  if (!eligible.ok) return { fail: out(eligible.http, { ok: false, error: eligible.code, message: eligible.message, charged: 0 }) };
  const id = mistakeId(user.id, attemptId, questionId);
  let reservation = null;
  try { reservation = preloaded?.reservation !== undefined ? preloaded.reservation : await deps.findRepairReservation(user.id, id); }
  catch { return { fail: failure(503, 'none', 'check_unavailable') }; }
  return { attempt, current, eligible, id, reservation };
}

const hasRepair = (reservation) => !!reservation?.receipt?.repair;

/** What the student sees of an answered check: no internals. */
export function publicResult(stored) {
  return {
    right: stored.right,
    checkQuestionId: stored.checkQuestionId,
    pick: stored.pick,
    key: stored.key,
    picked: stored.picked,
    explanation: stored.explanation,
    ruleLine: stored.ruleLine ?? null,
    line: stored.line,
    basis: stored.basis,
    basisLine: stored.basisLine,
    options: stored.options,
    answeredAt: stored.answeredAt,
    revise: stored.revise ?? null,
  };
}
const publicCheck = (stored) => ({
  checkQuestionId: stored.checkQuestionId, subject: stored.subject ?? null, chapter: stored.chapter ?? null, topic: stored.topic ?? null,
  format: stored.format ?? 'mcq', question: stored.question, options: stored.options.map((o) => ({ index: o.index, text: o.text })),
  basis: stored.basis, basisLine: stored.basisLine, rule: stored.ruleLine ?? null,
});

/**
 * Finds the check question for one prepared mistake: cheap filters over the chapter first (never seen, not held, not the
 * same family, not a near copy), then the publication gate on full rows, walking down the ranked list.
 * Returns { ok:true, chosen, full, selection } | { ok:false, status:'none', reason, pool } | { ok:false, status:'failed', reason }.
 */
async function findCheck({ user, p, deps }) {
  const { current, eligible, attempt, id } = p;
  if (isPassageLinkedQuestion(current) || isPassageLinkedQuestion(eligible.question)) return { ok: false, status: 'none', reason: 'passage_format', pool: { ofChapter: 0, unseen: 0 } };
  if (!current.subject || !current.chapter) return { ok: false, status: 'none', reason: 'no_unseen', pool: { ofChapter: 0, unseen: 0 } };
  let candidates;
  try { candidates = await deps.loadChapterCandidates({ subject: current.subject, chapter: current.chapter }); }
  catch { return { ok: false, status: 'failed', reason: 'check_unavailable' }; }
  const ids = candidates.map((row) => row.id);
  let seen; let excluded;
  try { seen = await deps.loadSeen({ userId: user.id, subject: current.subject, candidateIds: ids, attempt }); }
  catch { return { ok: false, status: 'failed', reason: 'lookup_failed' }; }
  try { excluded = await deps.loadExcluded(ids); }
  catch { return { ok: false, status: 'failed', reason: 'check_unavailable' }; }
  // The mistake itself and every question of this very attempt count as seen, whatever the progress table says.
  for (const q of attempt.questionsSnapshot || []) if (q?.id) seen.add(q.id);
  seen.add(current.id);
  const selection = selectCheckQuestion({ mistake: current, candidates, seen, excluded, userId: user.id, mistakeKey: id });
  if (!selection.ok) return { ok: false, status: 'none', reason: selection.reason, pool: selection.pool };
  const full = new Map();
  let verified = 0;
  for (let at = 0; at < Math.min(selection.ranked.length, VERIFY_MAX); at += VERIFY_BATCH) {
    const batch = selection.ranked.slice(at, at + VERIFY_BATCH).map((r) => r.id);
    let rows;
    try { rows = await deps.verifyPublished(batch); } catch { return { ok: false, status: 'failed', reason: 'check_unavailable' }; }
    for (const [rowId, row] of rows) { full.set(rowId, row); verified += 1; }
    const chosen = chooseVerified(selection, new Set(full.keys()));
    if (chosen) return { ok: true, chosen, full: full.get(chosen.id), selection: { ...selection, pool: { ofChapter: selection.pool.ofChapter, unseen: selection.pool.unseen } } };
  }
  return { ok: false, status: 'none', reason: 'no_unseen', pool: { ofChapter: selection.pool.ofChapter, unseen: verified } };
}

/** GET: the check question, the stored answer, or a plain reason. */
export async function openCheck({ user, attemptId, questionId, deps, preloaded }) {
  if (!validId(attemptId) || !validId(questionId)) return out(422, { ok: false, error: 'invalid_request', message: 'That check request was incomplete.' });
  const p = await prepare({ user, attemptId, questionId, deps, preloaded });
  if (p.fail) return p.fail;
  const links = checkLinks(attemptId, questionId);
  if (!hasRepair(p.reservation)) return failure(409, 'repair_first', 'repair_first', links);
  const stored = p.reservation.receipt.check;
  if (stored) return out(200, { ok: true, status: 'answered', charged: 0, check: publicCheck(stored), result: publicResult(stored), ...links });
  const found = await findCheck({ user, p, deps });
  if (!found.ok && found.status === 'failed') return failure(503, 'none', found.reason, links);
  if (!found.ok) return out(200, { ok: true, status: 'none', charged: 0, reason: found.reason, message: checkReasonMessage(found.reason), pool: found.pool, ...links });
  const order = shuffledOrder(orderSeed(user.id, p.id, found.chosen.id));
  const view = checkQuestionView(found.full, order);
  return out(200, {
    ok: true, status: 'ready', charged: 0,
    check: {
      checkQuestionId: view.id, subject: view.subject, chapter: view.chapter, topic: view.topic, format: view.format, question: view.question, options: view.options,
      basis: found.chosen.basis, basisLine: found.chosen.basisLine, pool: found.selection.pool, rule: p.reservation.receipt.repair.rule ?? null,
    },
    ...links,
  });
}

/**
 * The `check` field for the repair response. No question text and no key. `committed` is false when the repair was shown
 * but could not be saved (then there is no receipt to attach the check to).
 */
export const CHECK_STATUS_BUDGET_MS = 3_000;
export async function checkStatus({ user, attemptId, questionId, deps, preloaded, committed = true, budgetMs = CHECK_STATUS_BUDGET_MS }) {
  const links = checkLinks(attemptId, questionId);
  const base = { available: false, reason: null, message: null, ...links };
  if (!committed) return { ...base, status: 'none', reason: 'not_saved', message: checkReasonMessage('not_saved') };
  const unchecked = { ...base, status: 'unchecked', reason: 'check_unavailable', message: checkReasonMessage('check_unavailable') };
  // A free extra on the repair response: it never holds the repair back for more than its budget.
  let timer;
  const stop = new Promise((resolve) => { timer = setTimeout(() => resolve(unchecked), Math.max(1, budgetMs)); });
  try { return await Promise.race([statusOf({ user, attemptId, questionId, deps, preloaded, base }), stop]); }
  finally { clearTimeout(timer); }
}

async function statusOf({ user, attemptId, questionId, deps, preloaded, base }) {
  try {
    const p = await prepare({ user, attemptId, questionId, deps, preloaded });
    if (p.fail) return { ...base, status: 'unchecked', reason: 'check_unavailable', message: checkReasonMessage('check_unavailable') };
    if (!hasRepair(p.reservation)) return { ...base, status: 'none', reason: 'not_saved', message: checkReasonMessage('not_saved') };
    if (p.reservation.receipt.check) return { ...base, status: 'answered' };
    const found = await findCheck({ user, p, deps });
    if (found.ok) return { ...base, available: true, status: 'ready' };
    if (found.status === 'none') return { ...base, status: 'none', reason: found.reason, message: checkReasonMessage(found.reason) };
    return { ...base, status: 'unchecked', reason: found.reason, message: checkReasonMessage(found.reason) };
  } catch {
    return { ...base, status: 'unchecked', reason: 'check_unavailable', message: checkReasonMessage('check_unavailable') };
  }
}

/** POST: marks one answer. Idempotent per repair: the first stored answer is returned for every later request. */
export async function answerCheck({ user, attemptId, questionId, checkQuestionId, pick, requestId, deps, preloaded }) {
  if (!validId(attemptId) || !validId(questionId) || !validId(checkQuestionId) || !CHECK_REQUEST_ID.test(String(requestId || ''))) {
    return out(422, { ok: false, error: 'invalid_request', message: 'That check request was incomplete.' });
  }
  if (!Number.isInteger(pick) || pick < 0 || pick > 3) return failure(422, 'invalid_pick', 'invalid_pick');
  const p = await prepare({ user, attemptId, questionId, deps, preloaded });
  if (p.fail) return p.fail;
  if (!hasRepair(p.reservation)) return failure(409, 'repair_first', 'repair_first');

  const replay = (stored) => out(200, { ok: true, status: 'answered', replayed: true, charged: 0, result: publicResult(stored) });
  if (p.reservation.receipt.check) return replay(p.reservation.receipt.check);

  // The question must still be one that could be offered now (never seen, not held, same chapter), and pass the gate.
  const found = await findCheckById({ user, p, deps, checkQuestionId });
  if (!found.ok) return failure(found.status === 'failed' && found.reason === 'lookup_failed' ? 503 : 409, 'none', found.status === 'failed' ? found.reason : 'check_changed');

  const order = shuffledOrder(orderSeed(user.id, p.id, checkQuestionId));
  const marked = markCheck({ row: found.full, order, pick });
  if (!marked.ok) return failure(marked.reason === 'invalid_pick' ? 422 : 409, 'none', marked.reason);

  const nowMs = deps.now();
  const view = checkQuestionView(found.full, order);
  const rule = p.reservation.receipt.repair.rule ?? null;
  const base = {
    version: CHECK_VERSION, requestId, checkQuestionId, order,
    subject: view.subject, chapter: view.chapter, topic: view.topic, format: view.format, question: view.question,
    basis: found.basis, basisLine: found.basisLine,
    right: marked.right, pick, key: { index: marked.keyDisplay, text: marked.keyText }, picked: { index: pick, text: marked.pickedText },
    explanation: bankExplanation(found.full), ruleLine: rule,
    options: view.options.map((o) => ({ ...o, isKey: o.index === marked.keyDisplay, isPick: o.index === pick })),
    answeredAt: new Date(nowMs).toISOString(), revise: null, progressRecorded: false,
  };
  const claimed = await claim({ deps, user, reservation: p.reservation, check: { ...base, line: outcomeLine({ right: marked.right, basis: found.basis, revise: null }) } });
  if (claimed.error) return failure(503, 'none', 'check_unavailable');
  if (!claimed.won) return replay(claimed.existing);

  // From here the answer is stored. Progress and Revise are best effort: a failure is recorded on the result, never an error.
  let progressRecorded = false;
  try { await deps.recordProgress({ userId: user.id, row: found.full, pickedStored: marked.pickedStored, right: marked.right }); progressRecorded = true; }
  catch { progressRecorded = false; }
  let revise = reviseSummary({ written: 0 });
  try {
    const plan = planReviseCards({ mistake: p.current, checkRow: found.full, right: marked.right, nowMs, mistakeWrongAt: p.attempt.completedAt ? new Date(p.attempt.completedAt).toISOString() : null });
    // scheduleRevise returns { count, dueDay } for the cards now in place, or null when the table does not exist (yet).
    const placed = await deps.scheduleRevise({ userId: user.id, rows: plan.rows, dueRowId: marked.right ? plan.rows[0].question_id : plan.rows[plan.rows.length - 1].question_id });
    revise = placed?.count ? reviseSummary({ written: placed.count, dueDay: placed.dueDay || plan.dueDay, nowMs }) : reviseSummary({ written: 0 });
  } catch { revise = reviseSummary({ written: 0 }); }
  const final = { ...base, progressRecorded, revise, line: outcomeLine({ right: marked.right, basis: found.basis, revise }) };
  try { await deps.patchCheck({ operationKey: p.reservation.operation_key, userId: user.id, patch: { progressRecorded, revise, line: final.line } }); } catch { /* the answer is stored; only the extras are missing on a reload */ }
  return out(200, { ok: true, status: 'answered', replayed: false, charged: 0, result: publicResult(final) });
}

async function claim({ deps, user, reservation, check }) {
  try {
    const res = await deps.claimCheck({ operationKey: reservation.operation_key, userId: user.id, check });
    if (res?.ok) return { won: true };
    if (res?.existing) return { won: false, existing: res.existing };
    return { error: true };
  } catch { return { error: true }; }
}

/** The offered check question by id: it must still be among the questions that could be offered, and pass the gate. */
async function findCheckById({ user, p, deps, checkQuestionId }) {
  const { current: mistake, attempt, id } = p;
  if (isPassageLinkedQuestion(mistake) || isPassageLinkedQuestion(p.eligible.question)) return { ok: false, status: 'none', reason: 'passage_format' };
  let candidates;
  try { candidates = await deps.loadChapterCandidates({ subject: mistake.subject, chapter: mistake.chapter }); } catch { return { ok: false, status: 'failed', reason: 'check_unavailable' }; }
  const ids = candidates.map((row) => row.id);
  let seen; let excluded;
  try { seen = await deps.loadSeen({ userId: user.id, subject: mistake.subject, candidateIds: ids, attempt }); } catch { return { ok: false, status: 'failed', reason: 'lookup_failed' }; }
  try { excluded = await deps.loadExcluded(ids); } catch { return { ok: false, status: 'failed', reason: 'check_unavailable' }; }
  for (const q of attempt.questionsSnapshot || []) if (q?.id) seen.add(q.id);
  seen.add(mistake.id);
  const selection = selectCheckQuestion({ mistake, candidates, seen, excluded, userId: user.id, mistakeKey: id });
  if (!checkIsStillOffered(selection, checkQuestionId)) return { ok: false, status: 'none', reason: 'check_changed' };
  let rows;
  try { rows = await deps.verifyPublished([checkQuestionId]); } catch { return { ok: false, status: 'failed', reason: 'check_unavailable' }; }
  const full = rows.get(checkQuestionId);
  if (!full) return { ok: false, status: 'none', reason: 'check_changed' };
  const entry = selection.ranked.find((r) => r.id === checkQuestionId);
  return { ok: true, full, basis: entry.basis, basisLine: entry.basisLine };
}
