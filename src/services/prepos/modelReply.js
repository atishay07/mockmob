// PrepOS model reply orchestration. Dependencies are injected so every failure path is
// tested without a live provider or database. Nothing here is reachable until the release
// gate in data/capabilities.js (RELEASE_GATES.runtimeAi) is flipped after staging evidence.
//
// Order, always:
//   1. gate closed        -> paused message, nothing reserved, nothing called
//   2. reserve student credits (durable, keyed by ONE operation key per student action)
//   3. mark executing, then call the provider (provider spend is reserved and receipted
//      separately by the runtime guard, under the same stable key)
//   4. usable reply       -> commit the student credits
//      anything else      -> release them. A failed request never costs the student a credit.
export const PREPOS_PAUSED_MESSAGE = 'PrepOS paid features are temporarily unavailable. Your credits have not been used.';
const REQUEST_ID = /^[A-Za-z0-9_-]{16,64}$/;

export function operationKeyFor(userId, requestId) {
  if (!userId || !REQUEST_ID.test(String(requestId || ''))) return null;
  return `prepos:${userId}:${requestId}`.slice(0, 160);
}

const done = (http, body) => ({ http, ...body });

export async function runModelReply({
  user, message, mode = 'mentor', requestId, context = null, creditCost = 1, tier = 'fast', gateOpen, deps,
}) {
  if (!gateOpen) return done(503, { status: 'paused', message: PREPOS_PAUSED_MESSAGE, charged: 0 });
  const operationKey = operationKeyFor(user?.id, requestId);
  if (!operationKey) return done(400, { status: 'invalid', error: 'request_id_required', message: 'Something went wrong sending that. Nothing was charged. Try again.', charged: 0 });

  let reserved;
  try {
    reserved = await deps.reserve({ userId: user.id, amount: creditCost, action: `prepos_${mode}`, operationKey });
  } catch {
    return done(503, { status: 'paused', message: PREPOS_PAUSED_MESSAGE, charged: 0 });
  }
  if (!reserved.ok) {
    if (reserved.error === 'insufficient_ai_credits') {
      return done(402, { status: 'blocked', error: reserved.error, balance: reserved.balance ?? 0, required: creditCost, message: `You need ${creditCost} PrepOS credit for a reply and have ${reserved.balance ?? 0}. Questions about your own record are free.`, charged: 0 });
    }
    if (reserved.error === 'operation_released') {
      return done(409, { status: 'resend', error: reserved.error, message: 'That attempt did not go through and nothing was charged. Send it again.', charged: 0 });
    }
    if (/rpc|unavailable|schema/i.test(reserved.error || '')) return done(503, { status: 'paused', message: PREPOS_PAUSED_MESSAGE, charged: 0 });
    return done(500, { status: 'failed', error: reserved.error || 'reserve_failed', message: 'PrepOS could not start that reply. Nothing was charged.', charged: 0 });
  }
  if (reserved.idempotent) {
    // The same student action arrived twice. Never run the model a second time.
    return done(409, reserved.state === 'committed'
      ? { status: 'duplicate', message: 'That question was already answered. Nothing more was charged.', charged: 0 }
      : { status: 'in_progress', message: 'That reply is still being prepared. Nothing extra is charged.', charged: 0 });
  }

  const fail = async (reason, http, message) => {
    let restored = true;
    try { await deps.release(operationKey, reason); } catch { restored = false; }
    // If the release call itself failed, the expiry sweep returns the credit; say so honestly.
    return done(http, { status: 'failed', error: reason, message: restored ? `${message} No credits were used.` : `${message} Your credit is held briefly and returns automatically.`, charged: 0 });
  };

  try {
    const marked = await deps.markExecuting(operationKey, operationKey);
    if (!marked?.ok) return await fail('could_not_start', 503, 'PrepOS could not start that reply.');
  } catch {
    return await fail('could_not_start', 503, 'PrepOS could not start that reply.');
  }

  let ai;
  try {
    ai = await deps.generate({ requestKey: operationKey, tier, mode, message, context });
  } catch {
    return await fail('provider_error', 502, 'The reply service did not answer.');
  }
  if (!ai?.ok || !ai.data || ai.schemaValid === false) return await fail('unusable_output', 502, 'PrepOS could not produce a reliable reply this time.');

  const response = deps.sanitize(ai.data);
  if (!response?.reply || !String(response.reply).trim()) return await fail('empty_reply', 502, 'PrepOS could not produce a reliable reply this time.');

  const receipt = { provider: ai.usage?.provider || null, model: ai.usage?.model || null, inputTokens: ai.usage?.inputTokens || 0, outputTokens: ai.usage?.outputTokens || 0, fallbackUsed: Boolean(ai.fallbackUsed) };
  let commitDeferred = false;
  try {
    const committed = await deps.commit(operationKey, receipt);
    if (!committed?.ok) commitDeferred = true;
  } catch {
    commitDeferred = true; // the reply stands; the sweep returns the credit rather than double-charging
  }
  return done(200, { status: 'answered', response, receipt, charged: commitDeferred ? 0 : creditCost, commitDeferred, operationKey });
}
