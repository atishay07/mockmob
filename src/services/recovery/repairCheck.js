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
//
// The offer. The first GET picks the question and records it on the same receipt (receipt.offered: the question id, the
// hash of each option's text in the order shown, and whether its `seen` row is written). From then on:
//   - the same question is offered on every reload, in the same option order, for as long as it can be offered;
//   - POST accepts only that question: any other id is refused as invalid_pick and nothing is written;
//   - the pick is matched by option text hash, so a row re-ordered or re-keyed after the offer still marks the option the
//     student chose (data/repair_check.js orderFromHashes);
//   - the question counts as seen from the moment it is shown, answered or not (one `seen` interaction, written before the
//     question leaves the server, so a failed write shows nothing). Other repairs' checks, practice and learning therefore
//     never offer it as fresh, however the answer's own progress write turns out.
import { repairEligibility } from '../../../data/mistake_repair.js';
import { isPassageLinkedQuestion } from '../../../data/nta_question_selector.js';
import {
  CHECK_REQUEST_ID, CHECK_VERSION, checkReasonMessage, selectCheckQuestion, chooseVerified, checkIsStillOffered,
  checkQuestionView, markCheck, bankExplanation, outcomeLine, planReviseCards, reviseSummary, ruleOf, optionTextHashes, orderFromHashes,
  NOT_OFFERED_MESSAGE,
} from '../../../data/repair_check.js';
import { mistakeId } from './repairFlow.js';
import { slotKeys } from './repairCheckStore.js';
import { heldOf } from '../../../data/mobi_fix.js';

const out = (http, body) => ({ http, body });
// How many ranked candidates the publication gate (which needs the full row) looks at per read, and in total.
export const VERIFY_BATCH = 12;
export const VERIFY_MAX = 96;
const ID_LIMIT = 160;
const validId = (value) => typeof value === 'string' && value.length > 0 && value.length <= ID_LIMIT;

/** Where the client finds the check and the Ask Mobi follow-up for one mistake. Relative links. */
export function checkLinks(attemptId, questionId, slot = 1) {
  return {
    href: `/api/recovery/check?attemptId=${encodeURIComponent(attemptId)}&questionId=${encodeURIComponent(questionId)}${slot === 2 ? '&slot=2' : ''}`,
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
/** 1 or 2: Fix it for good asks two fresh questions (C-dec 3). Anything else is the first. */
export const checkSlot = (value) => (Number(value) === 2 ? 2 : 1);
const otherSlot = (slot) => (slot === 2 ? 1 : 2);
const offeredOf = (reservation, slot = 1) => {
  const offer = reservation?.receipt?.[slotKeys(slot).offered];
  return offer && typeof offer.checkQuestionId === 'string' && Array.isArray(offer.optionHashes) ? offer : null;
};

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
 * The questions that could be offered for one prepared mistake: the chapter's candidates, what the student has seen (the
 * mistake and every question of this very attempt count as seen, whatever the progress table says), and open disputes.
 * `ownOfferId` is the question this repair already offered: it is in the seen set because offering it wrote its `seen` row, so
 * it is let back in for this repair only. Returns { ok:true, selection } | { ok:false, status, reason, pool? }.
 */
async function buildSelection({ user, p, deps, ownOfferId = null, slot = 1 }) {
  const { current, eligible, attempt, id } = p;
  if (isPassageLinkedQuestion(current) || isPassageLinkedQuestion(eligible.question)) return { ok: false, status: 'none', reason: 'passage_format', pool: { ofChapter: 0, unseen: 0 } };
  if (!current.subject || !current.chapter) return { ok: false, status: 'none', reason: 'no_unseen', pool: { ofChapter: 0, unseen: 0 } };
  let candidates;
  try { candidates = await deps.loadChapterCandidates({ subject: current.subject, chapter: current.chapter }); }
  catch { return { ok: false, status: 'failed', reason: 'check_unavailable' }; }
  const ids = candidates.map((row) => row.id);
  let seen; let excluded;
  try { seen = await deps.loadSeen({ userId: user.id, subject: current.subject, candidateIds: ids, attempt, candidates }); }
  catch { return { ok: false, status: 'failed', reason: 'lookup_failed' }; }
  try { excluded = await deps.loadExcluded(ids); }
  catch { return { ok: false, status: 'failed', reason: 'check_unavailable' }; }
  for (const q of attempt.questionsSnapshot || []) if (q?.id) seen.add(q.id);
  seen.add(current.id);
  if (ownOfferId && ownOfferId !== current.id) seen.delete(ownOfferId);
  // The other check of the same repair is never this one's question, whatever its `seen` row says.
  const other = slotKeys(otherSlot(slot));
  for (const id of [p.reservation?.receipt?.[other.offered]?.checkQuestionId, p.reservation?.receipt?.[other.check]?.checkQuestionId]) if (id) seen.add(id);
  const selection = selectCheckQuestion({ mistake: current, candidates, seen, excluded, userId: user.id, mistakeKey: id });
  if (!selection.ok) return { ok: false, status: 'none', reason: selection.reason, pool: selection.pool };
  return { ok: true, selection };
}

/**
 * Finds the check question for one prepared mistake: cheap filters over the chapter first (never seen, not held, not the
 * same family, not a near copy), then the publication gate on full rows, walking down the ranked list.
 * Returns { ok:true, chosen, full, selection } | { ok:false, status:'none', reason, pool } | { ok:false, status:'failed', reason }.
 */
async function findCheck({ user, p, deps, slot = 1 }) {
  const built = await buildSelection({ user, p, deps, slot });
  if (!built.ok) return built;
  const { selection } = built;
  const full = new Map();
  let verified = 0;
  for (let at = 0; at < Math.min(selection.ranked.length, VERIFY_MAX); at += VERIFY_BATCH) {
    const batch = selection.ranked.slice(at, at + VERIFY_BATCH).map((r) => r.id);
    let rows;
    try { rows = await deps.verifyPublished(batch); } catch { return { ok: false, status: 'failed', reason: 'check_unavailable' }; }
    for (const [rowId, row] of rows) {
      // An option set that cannot be told apart by its text cannot be marked by text, so it is never offered.
      if (!orderFromHashes(row, optionTextHashes(row))) continue;
      full.set(rowId, row); verified += 1;
    }
    const chosen = chooseVerified(selection, new Set(full.keys()));
    if (chosen) return { ok: true, chosen, full: full.get(chosen.id), selection: { ...selection, pool: { ofChapter: selection.pool.ofChapter, unseen: selection.pool.unseen } } };
  }
  return { ok: false, status: 'none', reason: 'no_unseen', pool: { ofChapter: selection.pool.ofChapter, unseen: verified } };
}

/**
 * The question this repair already offered, by id: it must still be one that could be offered now (not held, same chapter,
 * not seen anywhere else), pass the gate, and its options must still map one to one onto the offered hashes.
 * Returns { ok:true, full, order, basis, basisLine, selection } | { ok:false, status:'none', reason:'check_changed' } | { ok:false, status:'failed', reason }.
 */
async function findOffered({ user, p, deps, offer, slot = 1 }) {
  const built = await buildSelection({ user, p, deps, ownOfferId: offer.checkQuestionId, slot });
  if (!built.ok) return built.status === 'failed' ? built : { ok: false, status: 'none', reason: 'check_changed' };
  const { selection } = built;
  if (!checkIsStillOffered(selection, offer.checkQuestionId)) return { ok: false, status: 'none', reason: 'check_changed' };
  let rows;
  try { rows = await deps.verifyPublished([offer.checkQuestionId]); } catch { return { ok: false, status: 'failed', reason: 'check_unavailable' }; }
  const full = rows.get(offer.checkQuestionId);
  const order = full ? orderFromHashes(full, offer.optionHashes) : null;
  if (!full || !order) return { ok: false, status: 'none', reason: 'check_changed' };
  const entry = selection.ranked.find((r) => r.id === offer.checkQuestionId);
  return { ok: true, full, order, basis: entry.basis, basisLine: entry.basisLine, selection: { pool: { ofChapter: selection.pool.ofChapter, unseen: selection.pool.unseen } } };
}

const readyBody = ({ view, basis, basisLine, pool, rule, links }) => ({
  ok: true, status: 'ready', charged: 0,
  check: {
    checkQuestionId: view.id, subject: view.subject, chapter: view.chapter, topic: view.topic, format: view.format, question: view.question, options: view.options,
    basis, basisLine, pool, rule,
  },
  ...links,
});

/** Makes sure the offered question's `seen` row is written before the question is shown. Throws when it cannot be. */
async function ensureSeen({ user, p, deps, offer, slot = 1 }) {
  if (offer.recorded === true) return;
  await deps.recordSeen({ userId: user.id, questionId: offer.checkQuestionId, mistakeKey: p.id });
  try { await deps.patchOffer({ operationKey: p.reservation.operation_key, userId: user.id, checkQuestionId: offer.checkQuestionId, patch: { recorded: true }, ...(slot === 2 ? { slot } : {}) }); }
  catch { /* the row is written; at worst the next open writes one more `seen` row */ }
}

/** GET: the check question, the stored answer, or a plain reason. */
export async function openCheck({ user, attemptId, questionId, deps, preloaded, slot: rawSlot = 1 }) {
  if (!validId(attemptId) || !validId(questionId)) return out(422, { ok: false, error: 'invalid_request', message: 'That check request was incomplete.' });
  const slot = checkSlot(rawSlot);
  const k = slotKeys(slot);
  const p = await prepare({ user, attemptId, questionId, deps, preloaded });
  if (p.fail) return p.fail;
  const links = { ...checkLinks(attemptId, questionId, slot), ...(slot === 2 ? { slot } : {}) };
  if (!hasRepair(p.reservation)) return failure(409, 'repair_first', 'repair_first', links);
  const stored = p.reservation.receipt[k.check];
  if (stored) return out(200, { ok: true, status: 'answered', charged: 0, check: publicCheck(stored), result: publicResult(stored), ...heldOf(p.reservation.receipt), ...links });
  const rule = ruleOf(p.reservation.receipt.repair);

  let offer = offeredOf(p.reservation, slot);
  // At most one lost race (another request offered first): its offer is then the one to show.
  for (let round = 0; round < 2; round += 1) {
    if (offer) {
      const kept = await findOffered({ user, p, deps, offer, slot });
      if (kept.ok) {
        try { await ensureSeen({ user, p, deps, offer, slot }); } catch { return failure(503, 'none', 'check_unavailable', links); }
        return out(200, readyBody({ view: checkQuestionView(kept.full, kept.order), basis: kept.basis, basisLine: kept.basisLine, pool: kept.selection.pool, rule, links }));
      }
      if (kept.status === 'failed') return failure(503, 'none', kept.reason, links);
      // The offered question can no longer be offered (withdrawn, held, its options changed): another one replaces it below.
    }
    const found = await findCheck({ user, p, deps, slot });
    if (!found.ok && found.status === 'failed') return failure(503, 'none', found.reason, links);
    if (!found.ok) return out(200, { ok: true, status: 'none', charged: 0, reason: found.reason, message: checkReasonMessage(found.reason), pool: found.pool, ...(slot === 2 ? heldOf(p.reservation.receipt, { secondOffered: false }) : {}), ...links });
    const fresh = { checkQuestionId: found.chosen.id, optionHashes: optionTextHashes(found.full), offeredAt: new Date(deps.now()).toISOString(), recorded: false };
    let claimed;
    try { claimed = await deps.claimOffer({ operationKey: p.reservation.operation_key, userId: user.id, offer: fresh, replaces: offer?.checkQuestionId ?? null, ...(slot === 2 ? { slot } : {}) }); }
    catch { return failure(503, 'none', 'check_unavailable', links); }
    if (claimed?.ok) {
      try { await ensureSeen({ user, p, deps, offer: fresh, slot }); } catch { return failure(503, 'none', 'check_unavailable', links); }
      const view = checkQuestionView(found.full, orderFromHashes(found.full, fresh.optionHashes));
      return out(200, readyBody({ view, basis: found.chosen.basis, basisLine: found.chosen.basisLine, pool: found.selection.pool, rule, links }));
    }
    if (claimed?.existing && offeredOf({ receipt: { [k.offered]: claimed.existing } }, slot)) { offer = claimed.existing; continue; }
    return failure(503, 'none', 'check_unavailable', links);
  }
  return failure(503, 'none', 'check_unavailable', links);
}

/**
 * The `check` field for the repair response. No question text and no key, and nothing is written (an offer is recorded when
 * the question is opened, not when its availability is read). `committed` is false when the repair was shown but could not be
 * saved (then there is no receipt to attach the check to).
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
    const offer = offeredOf(p.reservation);
    if (offer) {
      const kept = await findOffered({ user, p, deps, offer });
      if (kept.ok) return { ...base, available: true, status: 'ready' };
      if (kept.status === 'failed') return { ...base, status: 'unchecked', reason: kept.reason, message: checkReasonMessage(kept.reason) };
    }
    const found = await findCheck({ user, p, deps });
    if (found.ok) return { ...base, available: true, status: 'ready' };
    if (found.status === 'none') return { ...base, status: 'none', reason: found.reason, message: checkReasonMessage(found.reason) };
    return { ...base, status: 'unchecked', reason: found.reason, message: checkReasonMessage(found.reason) };
  } catch {
    return { ...base, status: 'unchecked', reason: 'check_unavailable', message: checkReasonMessage('check_unavailable') };
  }
}

/** POST: marks one answer. Idempotent per repair: the first stored answer is returned for every later request. */
export async function answerCheck({ user, attemptId, questionId, checkQuestionId, pick, requestId, deps, preloaded, slot: rawSlot = 1 }) {
  const slot = checkSlot(rawSlot);
  const k = slotKeys(slot);
  if (!validId(attemptId) || !validId(questionId) || !validId(checkQuestionId) || !CHECK_REQUEST_ID.test(String(requestId || ''))) {
    return out(422, { ok: false, error: 'invalid_request', message: 'That check request was incomplete.' });
  }
  if (!Number.isInteger(pick) || pick < 0 || pick > 3) return failure(422, 'invalid_pick', 'invalid_pick');
  const p = await prepare({ user, attemptId, questionId, deps, preloaded });
  if (p.fail) return p.fail;
  if (!hasRepair(p.reservation)) return failure(409, 'repair_first', 'repair_first');

  // Only the question that was offered for this repair (or, once answered, the one that was answered) is accepted. Any other
  // id, a real bank question or not, is refused before anything is read about it, and nothing is written.
  const receipt = p.reservation.receipt;
  const offer = offeredOf(p.reservation, slot);
  const acceptedId = receipt[k.check] ? receipt[k.check].checkQuestionId : offer?.checkQuestionId;
  if (!acceptedId || acceptedId !== checkQuestionId) return failure(422, 'invalid_pick', 'invalid_pick', { message: NOT_OFFERED_MESSAGE });

  const replay = (stored) => out(200, { ok: true, status: 'answered', replayed: true, charged: 0, result: publicResult(stored), ...heldOf({ ...receipt, [k.check]: stored }) });
  if (receipt[k.check]) return replay(receipt[k.check]);

  // The offered question must still be one that could be offered now (never seen elsewhere, not held, same chapter), pass the
  // gate, and have the options it was offered with: the pick is matched by their text.
  const found = await findOffered({ user, p, deps, offer, slot });
  if (!found.ok) return failure(found.status === 'failed' && found.reason === 'lookup_failed' ? 503 : 409, 'none', found.status === 'failed' ? found.reason : 'check_changed');

  const order = found.order;
  const marked = markCheck({ row: found.full, order, pick });
  if (!marked.ok) return failure(marked.reason === 'invalid_pick' ? 422 : 409, 'none', marked.reason);

  const nowMs = deps.now();
  const view = checkQuestionView(found.full, order);
  const rule = ruleOf(receipt.repair);
  const base = {
    version: CHECK_VERSION, requestId, checkQuestionId, order,
    subject: view.subject, chapter: view.chapter, topic: view.topic, format: view.format, question: view.question,
    basis: found.basis, basisLine: found.basisLine,
    right: marked.right, pick, key: { index: marked.keyDisplay, text: marked.keyText }, picked: { index: pick, text: marked.pickedText },
    explanation: bankExplanation(found.full), ruleLine: rule,
    options: view.options.map((o) => ({ ...o, isKey: o.index === marked.keyDisplay, isPick: o.index === pick })),
    answeredAt: new Date(nowMs).toISOString(), revise: null, progressRecorded: false,
  };
  const claimed = await claim({ deps, user, reservation: p.reservation, slot, check: { ...base, line: outcomeLine({ right: marked.right, basis: found.basis, revise: null }) } });
  if (claimed.error) return failure(503, 'none', 'check_unavailable');
  if (!claimed.won) return replay(claimed.existing);

  // From here the answer is stored. Progress and Revise are best effort: a failure is recorded on the result, never an error.
  // The question stays seen either way: its `seen` row was written when it was offered, so a failed progress write never
  // puts it back in the pool of fresh questions.
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
  try { await deps.patchCheck({ operationKey: p.reservation.operation_key, userId: user.id, patch: { progressRecorded, revise, line: final.line }, ...(slot === 2 ? { slot } : {}) }); } catch { /* the answer is stored; only the extras are missing on a reload */ }
  // Held (Fix it for good): every check right. It is read from the answers stored on the receipt, so the record reads it too.
  return out(200, { ok: true, status: 'answered', replayed: false, charged: 0, result: publicResult(final), ...heldOf({ ...receipt, [k.check]: final }) });
}

async function claim({ deps, user, reservation, check, slot = 1 }) {
  try {
    const res = await deps.claimCheck({ operationKey: reservation.operation_key, userId: user.id, check, ...(slot === 2 ? { slot } : {}) });
    if (res?.ok) return { won: true };
    if (res?.existing) return { won: false, existing: res.existing };
    return { error: true };
  } catch { return { error: true }; }
}

