// "Bring a mistake from any test": one more Ask Mobi ask kind, inside the SAME spend path as every signed-in written reply.
//
// No 'server-only' and no alias imports on purpose: src/services/mobi/mistakeDeps.js wires the wallet RPCs, the guarded
// provider call and the history store in, and data/tests/bring_mistake_1116.test.mjs wires fakes (and the real provider
// runtime with a fake client) in, so every rule below is tested without a database or a paid model.
//
// Order, always (each step ends the request before the next one can spend):
//   1. distress    the fixed support reply (Tele-MANAS 14416, 112) for words that sound like a student at risk, in the paste or
//                  in either answer box. Free, no model, no credit (src/services/ai/supportCheck.js, as the chat route).
//   2. request     readMistakeRequest: the paste is required and counted (1,500), the two answers are short (160 each), the
//                  subject is one of the student's own CUET subjects.
//   3. study?      studyCheck: too short, instructions aimed at Mobi, or plainly not a test question gets a short refusal. Free.
//   4. the ask     runModelReply (src/services/prepos/modelReply.js), exactly as a doubt or a question reply: ONE credit reserved
//                  under ONE operation key per student action (mm_ai_reserve_credits), marked executing, then the model, then
//                  commit, or release on any failure. The model call is ONE physical call (callOnce: the model allowlist, then
//                  reserve_runtime_ai with the student and plan, so the student's own monthly rupee cap in runtime_ai_budget
//                  applies and a failed or invalid call still counts there), with no JSON retry and no fallback.
//   5. the reply   readMistakeReply holds it to the contract. Invalid -> the credit is released and the student sees an honest
//                  error with Try again. The model's own "not a study question" or "support" -> the credit is released too,
//                  and the student sees the refusal or the fixed support reply (never model-written words).
import { runModelReply, operationKeyFor } from '../prepos/modelReply.js';
import { needsSupport, SUPPORT_REPLY } from '../ai/supportCheck.js';
import { LUNA_MODEL } from '../ai/providerCore.js';
import {
  MISTAKE_COPY, MISTAKE_CREDITS, MISTAKE_EFFORT, MISTAKE_MAX_TOKENS, MISTAKE_TIMEOUT_MS, mistakeReplyText, mistakeSystemPrompt,
  mistakeUserMessage, readMistakeReply, readMistakeRequest, readStoredMistake, refusalFor, studyCheck,
} from './bringMistake.mjs';

export const MISTAKE_MODE = 'mistake';
const NO_CHARGE = Object.freeze({ kind: 'included', creditUnits: 0, amount: 0 });

/**
 * The model step for runModelReply: ONE call through the guarded provider runtime (`callOnce`, src/services/ai/providerCore.js),
 * then the strict reply check. `spendUser` is { userId, userTier } (replyDeps spendUserFor), so the call counts against this
 * student's own monthly cap. `onVerdict` hears the model's "not_study" or "support" (both release the credit).
 */
export function mistakeGenerate({ value, callOnce, spendUser, timeoutMs = MISTAKE_TIMEOUT_MS, onVerdict = () => {} }) {
  return async ({ requestKey }) => {
    let result;
    try {
      result = await callOnce({
        requestKey: `${requestKey}:mistake`.slice(0, 180), provider: 'openai', model: LUNA_MODEL, reasoningEffort: MISTAKE_EFFORT,
        systemPrompt: mistakeSystemPrompt(), userMessage: mistakeUserMessage(value), context: null, jsonMode: true,
        maxTokens: MISTAKE_MAX_TOKENS, timeoutMs, userId: spendUser?.userId ?? null, userTier: spendUser?.userTier ?? null,
      });
    } catch {
      result = { ok: false, errorKind: 'unknown' };
    }
    const usage = result?.usage || null;
    if (!result?.ok) return { ok: false, data: null, usage, failure: { kind: result?.errorKind || 'unknown' } };
    const read = readMistakeReply(result.raw, { request: value });
    if (!read.ok) return { ok: false, data: null, usage, schemaValid: false, failure: { kind: 'invalid_output', reason: read.reason } };
    if (read.kind !== 'answer') {
      onVerdict({ kind: read.kind });
      return { ok: false, data: null, usage, failure: { kind: read.kind } };
    }
    return { ok: true, data: read.mistake, usage, schemaValid: true, fallbackUsed: false };
  };
}

const held = (message) => /returns automatically/i.test(String(message || ''));
const creditWords = (message) => (held(message) ? 'Your credit is held briefly and returns automatically.' : 'No credits were used.');
const SUPPORT = (extra = {}) => ({ http: 200, kind: 'support', body: { ok: true, kind: 'support', reply: SUPPORT_REPLY, origin: 'safety', charge: NO_CHARGE, charged: 0, ...extra } });
const REFUSED = (reason, extra = {}) => ({ http: 200, kind: 'refused', body: { ok: true, kind: 'refused', reply: refusalFor(reason), origin: 'status', charge: NO_CHARGE, charged: 0, ...extra } });

/**
 * One "bring a mistake" ask. `user` is the STORED user (its plan sets the monthly cap). `deps`:
 *   wallet:     { reserve, markExecuting, commit, release }  (replyDeps' RPC wrappers, unchanged)
 *   callOnce:   the guarded single provider call (providers.js callProviderOnce)
 *   spendUser:  spendUserFor(user)
 *   findReplay: async (operationKey) -> the stored answer payload of an ask already charged, or null
 *   now:        () => ms
 * -> { http, kind, body, value? }   kind: 'support' | 'refused' | 'answer' | 'error'
 */
export async function runMistakeAsk({ user, body, gateOpen, deps }) {
  // 1. Distress first, on whatever words came, before the request is even checked (a long paste still reaches it).
  const words = body && typeof body === 'object' ? [body.question, body.chosen, body.key].filter((t) => typeof t === 'string') : [];
  if (words.some((t) => needsSupport(t))) return SUPPORT();

  // 2. The request.
  const read = readMistakeRequest(body, { subjects: user?.subjects });
  if (!read.ok) return { http: read.http, kind: 'error', body: { ok: false, error: read.error, message: read.message, charged: 0 } };
  const value = read.value;

  // 3. Not a study question: a short refusal, free.
  const study = studyCheck(value);
  if (!study.ok) return REFUSED(study.reason);

  // 4. The ask, through the one credit lifecycle every written reply uses.
  let verdict = null;
  const generate = mistakeGenerate({ value, callOnce: deps.callOnce, spendUser: deps.spendUser, onVerdict: (v) => { verdict = v; } });
  const out = await runModelReply({
    user, message: value.question, mode: MISTAKE_MODE, requestId: body?.requestId, creditCost: MISTAKE_CREDITS, tier: 'smart', gateOpen,
    context: null,
    deps: {
      ...deps.wallet, generate, now: deps.now,
      // runModelReply needs a non-empty reply to commit; the answer itself travels beside it.
      sanitize: (data) => ({ reply: mistakeReplyText(data), mistake: data }),
    },
  });

  if (out.status === 'answered') {
    return {
      http: 200, kind: 'answer', value,
      body: {
        ok: true, kind: 'answer', origin: 'model', mistake: out.response.mistake, reply: out.response.reply, subject: value.subject,
        charge: { kind: 'prepos_credit', creditUnits: MISTAKE_CREDITS, amount: out.charged, reference: out.operationKey },
        usage: out.receipt, charged: out.charged,
      },
    };
  }
  // The model's own verdicts: the credit was released by runModelReply; the student sees fixed words.
  if (verdict?.kind === 'support') return SUPPORT();
  if (verdict?.kind === 'not_study') {
    const refused = REFUSED('not_study');
    if (held(out.message)) refused.body.reply = refused.body.reply.replace('Nothing was charged.', creditWords(out.message));
    return refused;
  }
  // The same ask sent again after its answer was lost: the credit was taken once, so the stored answer is shown again. Never
  // a second model call, never a second charge.
  if (out.status === 'duplicate') {
    const key = operationKeyFor(user?.id, body?.requestId);
    let saved = null;
    try { saved = key && deps.findReplay ? await deps.findReplay(key) : null; } catch { saved = null; }
    const mistake = readStoredMistake(saved?.mistake);
    if (mistake) {
      return { http: 200, kind: 'answer', value, replayed: true, body: { ok: true, kind: 'answer', origin: 'model', replayed: true, mistake, reply: mistakeReplyText(mistake), subject: saved.subject || value.subject, charge: { ...NO_CHARGE }, charged: 0 } };
    }
  }
  // Everything else is runModelReply's honest failure (paused, no credits, this month's AI limit, in progress, released), with
  // Mobi's words for an answer that could not be written.
  const message = out.error === 'unusable_output' || out.error === 'provider_error' || out.error === 'empty_reply'
    ? `${MISTAKE_COPY.failed} ${creditWords(out.message)}`
    : out.message;
  return { http: out.http, kind: 'error', body: { ok: false, error: out.error || out.status, status: out.status, message, required: out.required, balance: out.balance, charged: 0 } };
}
