import 'server-only';
// Score Recovery · Mistake Repair. One AI repair per wrong answer, charged 1 PrepOS credit through
// the same reserve -> execute -> commit | release lifecycle as PrepOS replies. Provider spend is
// separately reserved and receipted by the runtime guard (USD 25 / IST month cap).
import { createHash } from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { Database } from '@/../data/db';
import { generateAIResponse } from '@/services/ai/providers';
import { buildReplyDeps, modelRepliesOpen } from '@/services/prepos/replyDeps';
import { PREPOS_PAUSED_MESSAGE } from '@/services/prepos/modelReply';
import { readAIWallet } from '@/services/credits/aiCreditWallet';
import {
  repairEligibility, buildRepairPrompt, buildBlindSolvePrompt, interpretRepair,
  MISTAKE_REPAIR_SCHEMA, REPAIR_CREDIT_COST, practiceHref,
} from '@/../data/mistake_repair';

const REQUEST_ID = /^[A-Za-z0-9_-]{16,64}$/;
const out = (http, body) => ({ http, body });
// A short digest keeps operation keys inside the runtime guard's key format whatever the IDs contain.
const mistakeId = (userId, attemptId, questionId) => createHash('sha256').update(`${userId}|${attemptId}|${questionId}`).digest('hex').slice(0, 24);

async function withheldForRecheck(db, { questionId, userId, attemptId, firstIndex, blindIndex, model }) {
  // Same path as a student report: recorded, then withheld from practice until re-checked.
  await db.from('question_interactions').insert({
    question_id: questionId, user_id: userId, interaction_type: 'report', flow_context: 'review', session_id: attemptId,
    metadata: { source: 'ai_key_dispute', solved_index: firstIndex, blind_index: blindIndex, model },
  });
  await db.from('questions').update({ status: 'pending', verification_state: 'disputed', exploration_state: 'pending_review', updated_at: new Date().toISOString() })
    .eq('id', questionId).neq('status', 'rejected');
}

// Owner, 5 October 2026: GPT-6 Luna for Mistake Repair; low effort for the repair, high for the blind
// second opinion. AI_REPAIR_MODEL overrides the model; the fallback is Luna with no reasoning.
export const REPAIR_ROUTE = Object.freeze({ provider: 'openai', model: process.env.AI_REPAIR_MODEL || 'gpt-6-luna' });
export const REPAIR_EFFORT = Object.freeze({ repair: 'low', secondOpinion: 'high' });

export async function repairMistake({ user, attemptId, questionId, requestId, generate = generateAIResponse }) {
  if (!REQUEST_ID.test(String(requestId || ''))) return out(400, { ok: false, error: 'request_id_required', message: 'Something went wrong. Nothing was charged. Try again.' });
  const db = supabaseAdmin();
  const attempt = await Database.getAttemptById(attemptId).catch(() => null);
  const { data: current, error } = await db.from('questions').select('*').eq('id', questionId).maybeSingle();
  if (error) return out(503, { ok: false, error: 'question_unavailable', message: 'This question could not be loaded. Nothing was charged.' });
  const eligible = repairEligibility({ attempt, questionId, userId: user.id, current });
  if (!eligible.ok) return out(eligible.http, { ok: false, error: eligible.code, message: eligible.message });

  const id = mistakeId(user.id, attemptId, questionId);
  const base = { practiceHref: practiceHref({ subject: attempt.subject, chapter: eligible.question.chapter, attemptId }), chosenIndex: eligible.chosenIndex, keyIndex: eligible.keyIndex };

  // A finished repair is stored on its committed reservation and reopens free.
  const { data: prior } = await db.from('ai_credit_reservations').select('receipt').eq('user_id', user.id).eq('state', 'committed')
    .like('operation_key', `repair:${id}:%`).order('created_at', { ascending: false }).limit(1);
  if (prior?.[0]?.receipt?.repair) return out(200, { ok: true, status: 'stored', repair: prior[0].receipt.repair, charged: 0, ...base });

  if (!modelRepliesOpen()) return out(503, { ok: false, error: 'paused', message: PREPOS_PAUSED_MESSAGE });
  const operationKey = `repair:${id}:${requestId}`;
  const deps = buildReplyDeps({ user });

  let reserved;
  try { reserved = await deps.reserve({ userId: user.id, amount: REPAIR_CREDIT_COST, action: 'score_recovery_repair', operationKey }); }
  catch { return out(503, { ok: false, error: 'paused', message: PREPOS_PAUSED_MESSAGE }); }
  if (!reserved.ok) {
    if (reserved.error === 'insufficient_ai_credits') return out(402, { ok: false, error: reserved.error, balance: reserved.balance ?? 0, message: `Mistake Repair uses ${REPAIR_CREDIT_COST} PrepOS credit and you have ${reserved.balance ?? 0} left this month. The stored explanation and fresh practice are still free.` });
    if (reserved.error === 'operation_released') return out(409, { ok: false, error: reserved.error, message: 'That attempt did not go through and nothing was charged. Try again.' });
    return out(503, { ok: false, error: 'paused', message: PREPOS_PAUSED_MESSAGE });
  }
  if (reserved.idempotent) return out(409, { ok: false, error: 'in_progress', message: 'This repair is still being prepared. Nothing extra is charged.' });

  const fail = async (reason, http, message) => {
    let restored = true;
    try { await deps.release(operationKey, reason); } catch { restored = false; }
    return out(http, { ok: false, error: reason, charged: 0, message: restored ? `${message} You were not charged.` : `${message} Your credit is held briefly and returns automatically.` });
  };
  try { const marked = await deps.markExecuting(operationKey, operationKey); if (!marked?.ok) return await fail('could_not_start', 503, 'The repair could not start.'); }
  catch { return await fail('could_not_start', 503, 'The repair could not start.'); }

  const prompt = buildRepairPrompt({ question: eligible.question, chosenIndex: eligible.chosenIndex, keyIndex: eligible.keyIndex, subject: attempt.subject });
  let ai;
  try { ai = await generate({ requestKey: operationKey, tier: 'fast', ...REPAIR_ROUTE, reasoningEffort: REPAIR_EFFORT.repair, systemPrompt: prompt.system, userMessage: prompt.user, responseSchema: MISTAKE_REPAIR_SCHEMA }); }
  catch { return await fail('provider_error', 502, 'The repair service did not answer.'); }
  if (!ai?.data) return await fail('unusable_output', 502, 'The repair could not be prepared reliably this time.');
  const verdict = interpretRepair(ai.data, { keyIndex: eligible.keyIndex, optionCount: eligible.question.options.length });
  if (verdict.kind === 'unusable') return await fail('unusable_output', 502, 'The repair could not be prepared reliably this time.');

  if (verdict.kind === 'disputed') {
    // Second, blind opinion (the key is not shown). Two disagreements withhold the question.
    const blindPrompt = buildBlindSolvePrompt({ question: eligible.question, subject: attempt.subject });
    let blind = null;
    try { blind = await generate({ requestKey: `${operationKey}:blind`, tier: 'smart', ...REPAIR_ROUTE, reasoningEffort: REPAIR_EFFORT.secondOpinion, systemPrompt: blindPrompt.system, userMessage: blindPrompt.user, responseSchema: { required: ['solved_index'], types: { solved_index: 'number' } } }); }
    catch { blind = null; }
    const blindIndex = blind?.data?.solved_index;
    const confirmed = Number.isInteger(blindIndex) && blindIndex !== eligible.keyIndex;
    if (confirmed) await withheldForRecheck(db, { questionId, userId: user.id, attemptId, firstIndex: verdict.solvedIndex, blindIndex, model: ai.usage?.model || null }).catch(() => {});
    try { await deps.release(operationKey, confirmed ? 'ai_key_dispute' : 'ai_inconsistent'); } catch { /* the expiry sweep returns it */ }
    return out(200, confirmed
      ? { ok: true, status: 'held_for_recheck', charged: 0, ...base, dispute: { ourIndex: verdict.solvedIndex, secondIndex: blindIndex }, message: 'Our check of this question didn’t match its answer key, so we’ve held it for review instead of explaining it. You weren’t charged, and it won’t appear in practice until it’s cleared.' }
      : { ok: true, status: 'not_explained', charged: 0, ...base, storedExplanation: eligible.question.explanation || null, message: 'We couldn’t write a repair for this one that met our bar, so we’re not showing one. You weren’t charged.' });
  }

  const repair = { ...verdict.repair, model: ai.usage?.model || null, generatedAt: new Date().toISOString() };
  let charged = REPAIR_CREDIT_COST;
  try {
    const committed = await deps.commit(operationKey, { provider: ai.usage?.provider || null, model: ai.usage?.model || null, inputTokens: ai.usage?.inputTokens || 0, outputTokens: ai.usage?.outputTokens || 0, repair });
    if (!committed?.ok) charged = 0;
  } catch { charged = 0; }
  const wallet = await readAIWallet(user).catch(() => null);
  return out(200, { ok: true, status: 'explained', repair, charged, wallet: wallet ? { total: wallet.total, state: wallet.state } : null, ...base });
}
