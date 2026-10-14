// Score Recovery · Mistake Repair: the whole lifecycle, with every dependency injected.
//
// No 'server-only' and no alias imports on purpose: src/services/recovery/mistakeRepair.js wires the real database,
// wallet and model client in, and data/tests/repair_flow.test.mjs wires fakes in, so each failure path (a timeout, a
// stuck reservation, quota, a failed commit) is tested without a database or a paid model.
//
// One AI repair per wrong answer, charged 1 PrepOS credit through reserve -> execute -> commit | release.
// The rule that matters most: a credit is kept only for a repair the student actually received and the server
// acknowledged. Every other ending, a timeout included, releases it.
import { createHash } from 'node:crypto';
import { answerReview } from '../../../data/answer_corrections.mjs';
import {
  repairEligibility, buildRepairPrompt, buildBlindSolvePrompt, interpretRepair,
  MISTAKE_REPAIR_SCHEMA, REPAIR_CREDIT_COST, practiceHref,
} from '../../../data/mistake_repair.js';
import { repairFailureForKind, composeFailureMessage, WALLET_UNAVAILABLE } from '../../../data/repair_failures.js';
import { PREPOS_PAUSED_MESSAGE } from '../prepos/modelReply.js';

export const REQUEST_ID = /^[A-Za-z0-9_-]{16,64}$/;
const out = (http, body) => ({ http, body });
// A short digest keeps operation keys inside the runtime guard's key format whatever the IDs contain.
export const mistakeId = (userId, attemptId, questionId) => createHash('sha256').update(`${userId}|${attemptId}|${questionId}`).digest('hex').slice(0, 24);

/**
 * The time budget, in milliseconds from the start of the request. The route allows 90 s (maxDuration), so the model
 * work is planned to finish by about 78 s, and the worst case, a hard stop included, is about 81 s:
 *   main explanation  25 s per call, finished (a fallback to Haiku 5.5 included) by 45 s
 *   blind key check   30 s per call, finished by 78 s; the check is never given less than 6 s
 */
export const REPAIR_BUDGET = Object.freeze({
  totalMs: 78_000,
  mainMs: 45_000,
  callMs: 25_000,
  blindCallMs: 30_000,
  // The route cannot run longer than 90 s, so a reservation still open 150 s after it was made cannot belong to a
  // running function. It is released at once instead of waiting for its ten-minute expiry.
  deadAfterMs: 150_000,
  // A last-resort stop beyond the SDK's own timeouts.
  hardStopSlackMs: 5_000,
});

/** An open reservation that can no longer be running: past its expiry, or older than any function can live. */
export function isDeadReservation(row, nowMs, budget = REPAIR_BUDGET) {
  const expires = Date.parse(row?.expires_at);
  const created = Date.parse(row?.created_at);
  return (Number.isFinite(expires) && expires < nowMs) || (Number.isFinite(created) && nowMs - created > budget.deadAfterMs);
}

function hardStop(promise, ms, fallback) {
  let timer;
  const stop = new Promise((resolve) => { timer = setTimeout(() => resolve(fallback), Math.max(1, ms)); });
  return Promise.race([promise, stop]).finally(() => clearTimeout(timer));
}
const timedOut = (stage) => ({ ok: false, data: null, raw: null, usage: null, fallbackUsed: false, failure: { stage, provider: null, model: null, kind: 'timeout', status: null, code: null } });

export async function runRepair({ user, attemptId, questionId, requestId, startedAt, deps, config }) {
  const { route, effort, fallbackRoute = null, budget = REPAIR_BUDGET } = config;
  const t0 = Number.isFinite(startedAt) ? startedAt : deps.now();
  const elapsed = () => deps.now() - t0;

  if (!REQUEST_ID.test(String(requestId || ''))) return out(400, { ok: false, error: 'request_id_required', message: 'Something went wrong. Nothing was charged. Try again.' });
  const attempt = await deps.loadAttempt(attemptId).catch(() => null);
  const { data: current, error } = await deps.loadQuestion(questionId);
  if (error) return out(503, { ok: false, error: 'question_unavailable', message: 'This question could not be loaded. Nothing was charged.' });
  const eligible = repairEligibility({ attempt, questionId, userId: user.id, current });
  if (!eligible.ok) {
    const snapshot = (attempt?.questionsSnapshot || []).find(q => q.id === questionId);
    const detail = (attempt?.details || []).find(d => d.qid === questionId);
    const review = snapshot && attempt.userId === user.id ? answerReview(snapshot, current, detail, { evidenceEligible: deps.evidenceEligible(current) }) : null;
    return out(eligible.http, { ok: false, error: eligible.code, message: eligible.message, ...(review ? { review, charged: 0 } : {}) });
  }

  const id = mistakeId(user.id, attemptId, questionId);
  const base = { practiceHref: practiceHref({ subject: attempt.subject, chapter: eligible.question.chapter, attemptId }), chosenIndex: eligible.chosenIndex, keyIndex: eligible.keyIndex };

  // A finished repair is stored on its committed reservation and reopens free.
  const stored = await deps.findStored(user.id, id);
  if (stored) return out(200, { ok: true, status: 'stored', repair: stored, charged: 0, ...base });

  if (!deps.gateOpen()) return out(503, { ok: false, error: 'paused', charged: 0, message: PREPOS_PAUSED_MESSAGE });
  const operationKey = `repair:${id}:${requestId}`;

  // Reservations already open for this mistake. One that cannot still be running (expired, or older than any
  // function can live) is released now: its credit goes back, and the student is not left on "still being
  // prepared" until a sweep happens to run. One that may still be running blocks a second charge for the same mistake.
  let open = [];
  try { open = await deps.findOpenReservations(user.id, id); } catch { open = []; }
  let sameOperationReleased = false;
  let running = false;
  for (const row of open) {
    if (isDeadReservation(row, deps.now(), budget)) {
      let released = false;
      try { released = (await deps.release(row.operation_key, 'expired'))?.ok !== false; } catch { released = false; }
      if (released && row.operation_key === operationKey) sameOperationReleased = true;
      if (!released) running = true;
    } else running = true;
  }
  if (sameOperationReleased) return out(409, { ok: false, error: 'operation_released', charged: 0, message: 'That attempt did not go through and nothing was charged. Try again.' });
  if (running) return out(409, { ok: false, error: 'in_progress', message: 'This repair is still being prepared. Nothing extra is charged.' });

  const logFailure = (stage, code, extra = {}) => deps.log?.(JSON.stringify({
    route: 'repair', stage, code, kind: extra.kind ?? null, providerStatus: extra.status ?? null, providerCode: extra.providerCode ?? null,
    model: extra.model ?? null, ms: elapsed(), ...(extra.released === undefined ? {} : { released: extra.released }),
  }));

  let reserved;
  try { reserved = await deps.reserve({ userId: user.id, amount: REPAIR_CREDIT_COST, action: 'score_recovery_repair', operationKey }); }
  catch { logFailure('reserve', WALLET_UNAVAILABLE.error); return out(WALLET_UNAVAILABLE.http, { ok: false, error: WALLET_UNAVAILABLE.error, charged: 0, message: WALLET_UNAVAILABLE.message }); }
  if (!reserved?.ok) {
    if (reserved?.error === 'insufficient_ai_credits') return out(402, { ok: false, error: reserved.error, balance: reserved.balance ?? 0, message: `Mistake Repair uses ${REPAIR_CREDIT_COST} PrepOS credit and you have ${reserved.balance ?? 0} left this month. The stored explanation and fresh practice are still free.` });
    if (reserved?.error === 'operation_released') return out(409, { ok: false, error: reserved.error, charged: 0, message: 'That attempt did not go through and nothing was charged. Try again.' });
    logFailure('reserve', WALLET_UNAVAILABLE.error);
    return out(WALLET_UNAVAILABLE.http, { ok: false, error: WALLET_UNAVAILABLE.error, charged: 0, message: WALLET_UNAVAILABLE.message });
  }
  if (reserved.idempotent) return out(409, { ok: false, error: 'in_progress', message: 'This repair is still being prepared. Nothing extra is charged.' });

  // From here the credit is taken. Every way out below either commits it (a repair was delivered) or releases it.
  const fail = async (code, http, message, extra = {}) => {
    let restored = true;
    try { restored = (await deps.release(operationKey, code))?.ok !== false; } catch { restored = false; }
    logFailure(extra.stage || 'generate', code, { ...extra, released: restored });
    return out(http, { ok: false, error: code, charged: 0, message: composeFailureMessage(message, restored) });
  };
  const failForModel = (ai, stage) => {
    const kind = ai?.failure?.kind ?? null;
    const failure = repairFailureForKind(kind, { now: new Date(deps.now()) });
    return fail(failure.error, failure.http, failure.message, { stage, kind, status: ai?.failure?.status, providerCode: ai?.failure?.code, model: ai?.failure?.model || route.model });
  };

  try { const marked = await deps.markExecuting(operationKey, operationKey); if (!marked?.ok) return await fail('could_not_start', 503, 'The repair could not start.', { stage: 'start' }); }
  catch { return await fail('could_not_start', 503, 'The repair could not start.', { stage: 'start' }); }

  const prompt = buildRepairPrompt({ question: eligible.question, chosenIndex: eligible.chosenIndex, keyIndex: eligible.keyIndex, subject: attempt.subject });
  const mainDeadline = Math.min(t0 + budget.totalMs, t0 + budget.mainMs);
  let ai;
  try {
    ai = await hardStop(
      deps.generate({
        requestKey: operationKey, tier: 'fast', ...route, reasoningEffort: effort.repair, systemPrompt: prompt.system, userMessage: prompt.user, responseSchema: MISTAKE_REPAIR_SCHEMA,
        fallbackRoute, deadlineAt: mainDeadline, callTimeoutMs: budget.callMs,
      }),
      mainDeadline - deps.now() + budget.hardStopSlackMs, timedOut('service_deadline'),
    );
  } catch { return await fail('provider_error', 502, 'The repair service did not answer.', { stage: 'generate' }); }
  if (!ai?.data) return await failForModel(ai, 'generate');
  const verdict = interpretRepair(ai.data, { keyIndex: eligible.keyIndex, optionCount: eligible.question.options.length });
  if (verdict.kind === 'unusable') return await fail('unusable_output', 502, 'The repair could not be prepared reliably this time.', { stage: 'interpret', model: ai.usage?.model });

  if (verdict.kind === 'disputed') {
    // Second, blind opinion (the key is not shown). Two disagreements withhold the question.
    const blindPrompt = buildBlindSolvePrompt({ question: eligible.question, subject: attempt.subject });
    const totalDeadline = t0 + budget.totalMs;
    let blind = null;
    try {
      blind = await hardStop(
        deps.generate({
          requestKey: `${operationKey}:blind`, tier: 'smart', ...route, reasoningEffort: effort.secondOpinion, systemPrompt: blindPrompt.system, userMessage: blindPrompt.user,
          responseSchema: { required: ['solved_index'], types: { solved_index: 'number' } }, deadlineAt: totalDeadline, callTimeoutMs: budget.blindCallMs,
        }),
        totalDeadline - deps.now() + budget.hardStopSlackMs, null,
      );
    } catch { blind = null; }
    const blindIndex = blind?.data?.solved_index;
    const confirmed = Number.isInteger(blindIndex) && blindIndex >= 0 && blindIndex < eligible.question.options.length && blindIndex !== eligible.keyIndex;
    if (confirmed) {
      try { await deps.withhold({ questionId, userId: user.id, attemptId, firstIndex: verdict.solvedIndex, blindIndex, model: ai.usage?.model || null }); }
      catch { return await fail('quarantine_not_confirmed', 503, 'Our checks disagree with the key, but we could not confirm that the question was withheld. Please report this question.', { stage: 'withhold' }); }
    }
    try { await deps.release(operationKey, confirmed ? 'ai_key_dispute' : 'ai_inconsistent'); } catch { /* the expiry sweep returns it */ }
    return out(200, confirmed
      ? { ok: true, status: 'held_for_recheck', charged: 0, ...base, dispute: { ourIndex: verdict.solvedIndex, secondIndex: blindIndex }, message: 'Our check of this question didn’t match its answer key, so we’ve held it for review instead of explaining it. You weren’t charged, and it won’t appear in practice until it’s cleared.' }
      : { ok: true, status: 'not_explained', charged: 0, ...base, storedExplanation: eligible.question.explanation || null, message: 'We couldn’t write a repair for this one that met our bar, so we’re not showing one. You weren’t charged.' });
  }

  // The receipt names the provider and model that actually produced the repair (Haiku 5.5 after a fallback).
  const repair = { ...verdict.repair, model: ai.usage?.model || null, generatedAt: new Date(deps.now()).toISOString() };
  const receipt = {
    provider: ai.usage?.provider || null, model: ai.usage?.model || null, inputTokens: ai.usage?.inputTokens || 0, outputTokens: ai.usage?.outputTokens || 0,
    repair, fallbackUsed: !!ai.fallbackUsed, fallbackReason: ai.fallbackReason || null,
  };
  const tryCommit = async () => { try { return (await deps.commit(operationKey, receipt))?.ok === true; } catch { return false; } };
  let charged = REPAIR_CREDIT_COST;
  if (!(await tryCommit()) && !(await tryCommit())) {
    // The repair exists but the charge could not be finalised. Hand the credit back rather than keep it: the student
    // is shown the repair, it is not stored, and a reopen will ask for the credit again. If the first commit did
    // land after all, the release says so and the credit stays charged.
    let released = null;
    try { released = await deps.release(operationKey, 'commit_failed'); } catch { released = null; }
    charged = released?.ok === false && released?.error === 'already_committed' ? REPAIR_CREDIT_COST : 0;
    logFailure('commit', 'commit_failed', { model: ai.usage?.model, released: charged === 0 && released?.ok !== false });
  }
  const wallet = await deps.readWallet(user);
  return out(200, { ok: true, status: 'explained', repair, charged, wallet: wallet ? { total: wallet.total, state: wallet.state } : null, ...base });
}
