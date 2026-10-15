// Provider runtime for student-facing AI: request bodies, error classification, timeouts, the guard
// reservation around every physical call, and the primary -> JSON retry -> fallback ladder.
//
// No 'server-only' and no alias imports on purpose: src/services/ai/providers.js wires the real SDK clients and
// the runtime guard in, and data/tests/provider_runtime.test.mjs wires fakes in, so every failure path (quota,
// timeout, a rejected parameter, a fallback to another provider) is tested without a live provider or database.

// Owner rule (5 Oct 2026): GPT-6 Luna is the only OpenAI model MockMob calls. 'fast' = no reasoning, 'smart' = low.
// Owner decision D2 (14 Oct 2026): Mistake Repair may fall back, once, to Anthropic claude-haiku-5-5 when Luna
// fails with quota or a rate limit, a timeout, a 5xx or a rejected parameter (see fallbackRoute below).
export const LUNA_MODEL = process.env.AI_LUNA_MODEL || 'gpt-6-luna';
export const DEFAULT_EFFORT = Object.freeze({ fast: 'none', smart: 'low' });
export function pickModelForTier() {
  return LUNA_MODEL;
}

// Rough cost table (USD per 1M tokens). Used for telemetry only, never billing.
// Update freely; missing entries fall back to 0.
const COST_TABLE = {
  'deepseek-chat': { in: 0.27, out: 1.1 },
  'deepseek-reasoner': { in: 0.55, out: 2.19 },
  'gpt-4.1-mini': { in: 0.4, out: 1.6 },
  'gpt-5-nano': { in: 0.05, out: 0.4 },
  'gpt-4o-mini': { in: 0.15, out: 0.6 },
  'gpt-4o': { in: 2.5, out: 10 },
  'gpt-6-luna': { in: 0.1, out: 0.5 },
  'claude-haiku-4-5': { in: 1, out: 5 },
  // Haiku 5.5, prompts up to 100K tokens (a repair prompt is a few thousand). The guard's own price row is
  // supabase/migrations/20261014120000_runtime_ai_price_claude_haiku_5_5.sql.
  'claude-haiku-5-5': { in: 0.1, out: 0.5 },
  'claude-sonnet-5-5': { in: 2, out: 10 },
};

// OpenAI reasoning models (GPT-5 and later, o-series) reject temperature and max_tokens. Their hidden
// reasoning is billed as output, so the output bound grows with the effort level. Claude Haiku 5.5 thinks
// adaptively by default and its thinking also counts against max_tokens, so it gets the same headroom.
const REASONING_HEADROOM = { none: 0, minimal: 500, low: 2500, medium: 5000, high: 10000, xhigh: 16000, max: 32000 };
export function isReasoningModel(model) { return /^(gpt-(5|6)|o\d)/.test(String(model || '')); }
// Claude Haiku 5.5: adaptive thinking on by default, `output_config.effort` is the only control, `temperature` and
// `thinking.budget_tokens` are rejected with a 400.
export function isAdaptiveClaude(model) { return /^claude-haiku-5/.test(String(model || '')); }
const ANTHROPIC_EFFORTS = new Set(['low', 'medium', 'high', 'xhigh', 'max']);
export function anthropicEffort(reasoningEffort) { return ANTHROPIC_EFFORTS.has(reasoningEffort) ? reasoningEffort : 'low'; }
export function outputBound(model, maxTokens, reasoningEffort) {
  if (isAdaptiveClaude(model)) return maxTokens + (REASONING_HEADROOM[anthropicEffort(reasoningEffort)] ?? REASONING_HEADROOM.low);
  if (!isReasoningModel(model)) return maxTokens;
  return maxTokens + (REASONING_HEADROOM[reasoningEffort || 'none'] ?? REASONING_HEADROOM.medium);
}

export function estimateCostUsd(model, inputTokens, outputTokens) {
  const rates = COST_TABLE[model];
  if (!rates) return null;
  const cost = (inputTokens / 1_000_000) * rates.in + (outputTokens / 1_000_000) * rates.out;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

export function safeParseJson(text) {
  if (typeof text !== 'string') return null;
  // Strip ```json fences if the model wrapped them.
  const stripped = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  try {
    return JSON.parse(stripped);
  } catch {
    // Try to find the first balanced JSON object as a last resort.
    const start = stripped.indexOf('{');
    const end = stripped.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(stripped.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Lightweight schema sanity check. Not a full validator; checks that
 * declared required keys exist and have roughly the right type. Intentional
 * minimum so we never break the UI on a slightly off-shape model reply.
 */
export function validateAgainstSchema(value, schema) {
  if (!schema) return true;
  if (typeof value !== 'object' || value === null) return false;

  for (const key of schema.required || []) {
    if (!(key in value)) return false;
  }
  if (schema.types) {
    for (const [key, expected] of Object.entries(schema.types)) {
      if (!(key in value)) continue;
      const v = value[key];
      if (expected === 'string' && typeof v !== 'string') return false;
      if (expected === 'number' && typeof v !== 'number') return false;
      if (expected === 'array' && !Array.isArray(v)) return false;
      if (expected === 'object' && (typeof v !== 'object' || v === null || Array.isArray(v))) return false;
    }
  }
  return true;
}

// ---- Why a call failed ------------------------------------------------------------------------------------
// The kinds a failure is sorted into. Nothing here carries prompt text, student data or a key: only the HTTP status,
// the provider's error code/type and a kind.
//   timeout        our deadline or the SDK's per-call timeout
//   quota          the provider account is out of credit or over its quota (429 insufficient_quota, 402, "credit balance")
//   rate_limit     429 without a quota code
//   server         5xx or 529 overloaded
//   network        the connection failed before any reply
//   auth           401 / 403 (bad key, no access to the model)
//   bad_request    400 / 404 / 422, for example 400 unsupported_parameter or an unknown model
//   budget         the monthly student-AI cap in the runtime guard is used up
//   guard_paused   the runtime guard is paused or has no funding row
//   price          the guard has no fresh price row for this model
//   provider_unavailable   no client or key for the provider
const str = (value) => (typeof value === 'string' ? value : '');
const NETWORK_CODES = /^(?:ECONNRESET|ECONNREFUSED|ECONNABORTED|ENOTFOUND|EAI_AGAIN|EPIPE|UND_ERR_\w+)$/;

export function classifyProviderError(err) {
  const status = Number.isInteger(err?.status) ? err.status : null;
  const nested = err?.error?.error;
  const code = str(err?.code) || str(nested?.code) || str(err?.error?.code) || null;
  const bodyType = str(err?.error?.type) !== 'error' ? str(err?.error?.type) : '';
  const type = str(nested?.type) || bodyType || str(err?.type) || null;
  const name = str(err?.name);
  const message = str(err?.message);
  let kind = 'unknown';
  if (err?.hardTimeout || name === 'APIConnectionTimeoutError' || name === 'TimeoutError' || code === 'ETIMEDOUT' || (status === null && /\btimed? ?out\b/i.test(message))) kind = 'timeout';
  else if (status === 429 && (code === 'insufficient_quota' || type === 'insufficient_quota' || /insufficient[_ ]quota|exceeded your current quota|credit balance/i.test(message))) kind = 'quota';
  else if (status === 402 || ((status === 400 || status === 403) && /credit balance is too low/i.test(message)) || type === 'billing_error') kind = 'quota';
  else if (status === 429) kind = 'rate_limit';
  else if (status === 401 || status === 403) kind = 'auth';
  else if (status !== null && status >= 500) kind = 'server';
  else if (status === 400 || status === 404 || status === 409 || status === 422) kind = 'bad_request';
  else if (name === 'APIConnectionError' || NETWORK_CODES.test(code || '') || (status === null && /fetch failed|network|socket|connect/i.test(message))) kind = 'network';
  return { kind, status, code, type };
}

/** The runtime guard raises plain database exceptions; their text says which rule stopped the call. */
export function classifyGuardMessage(message) {
  const text = String(message || '');
  if (/budget exhausted/i.test(text)) return 'budget';
  if (/verified model price/i.test(text)) return 'price';
  if (/funding unavailable/i.test(text)) return 'guard_paused';
  return 'guard_unavailable';
}

// After these, trying another provider can help. Not guard stops (the cap is shared by every provider) and not
// a successful call with unusable output.
export const FALLBACK_KINDS = new Set(['timeout', 'quota', 'rate_limit', 'server', 'network', 'auth', 'bad_request', 'price', 'provider_unavailable']);
// A same-provider retry can still succeed after these (a rejected parameter, a flaky 5xx), unlike a timeout or quota.
const SAME_PROVIDER_MAY_HELP = new Set(['bad_request', 'server', 'rate_limit', 'network']);
// After these, a second call is certain to fail the same way, so none is made.
const NO_RETRY_KINDS = new Set(['budget', 'guard_paused']);

// ---- Request bodies ---------------------------------------------------------------------------------------
export function openaiRequestBody({ model, messages, jsonMode, maxTokens, reasoningEffort }) {
  return {
    model,
    messages,
    ...(isReasoningModel(model)
      ? { max_completion_tokens: outputBound(model, maxTokens, reasoningEffort), reasoning_effort: reasoningEffort || 'none' }
      : { temperature: 0.4, max_tokens: maxTokens }),
    ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
  };
}

export function anthropicRequestBody({ model, messages, jsonMode, maxTokens, reasoningEffort }) {
  const system = jsonMode ? `${messages[0].content}

Reply with one JSON object only. No prose outside it, no code fences.` : messages[0].content;
  const base = { model, system, messages: [{ role: 'user', content: messages[1].content }] };
  // Haiku 5.5 rejects any non-default temperature and any thinking budget with a 400, and thinks adaptively by
  // default: send neither, ask for low effort through output_config, and leave room for the thinking tokens.
  if (isAdaptiveClaude(model)) return { ...base, max_tokens: outputBound(model, maxTokens, reasoningEffort), output_config: { effort: anthropicEffort(reasoningEffort) } };
  // Haiku 4.5 accepts sampling and does not think unless asked. Sonnet 5.5 rejects custom
  // sampling and thinks by default; short grounded replies run without thinking there.
  return { ...base, max_tokens: maxTokens, ...(/^claude-sonnet-5/.test(model) ? { thinking: { type: 'between_tools' } } : { temperature: 0.4 }) };
}

// The SDK's `timeout` covers the request up to the reply headers. A hard stop just past it makes sure a stalled body
// cannot hold the function (and the student's credit reservation) until the platform kills it.
const HARD_STOP_GRACE_MS = 3_000;
function withHardStop(promise, timeoutMs, graceMs = HARD_STOP_GRACE_MS) {
  if (!timeoutMs) return promise;
  let timer;
  const stop = new Promise((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error('Request timed out.'), { name: 'APIConnectionTimeoutError', hardTimeout: true })), timeoutMs + graceMs);
  });
  return Promise.race([promise, stop]).finally(() => clearTimeout(timer));
}

// No attempt is started with less than this left before the caller's deadline.
export const MIN_ATTEMPT_MS = 6_000;

// The visible-output cap per call. A caller may ask for its own (Mistake Repair v3 asks for 1,400 so a long answer is
// not cut into invalid JSON); it is clamped to 200..2,000. The same value feeds the request body and the guard's
// output bound, so the runtime reservation always covers what the provider may bill.
export const DEFAULT_MAX_TOKENS = Object.freeze({ fast: 950, smart: 900 });
export const MAX_TOKENS_RANGE = Object.freeze({ min: 200, max: 2_000 });
export function resolveMaxTokens(tier, requested) {
  if (Number.isFinite(requested)) return Math.min(MAX_TOKENS_RANGE.max, Math.max(MAX_TOKENS_RANGE.min, Math.round(requested)));
  return tier === 'smart' ? DEFAULT_MAX_TOKENS.smart : DEFAULT_MAX_TOKENS.fast;
}

export function createProviderRuntime({ getClient, reserveRuntime, receiptRuntime, now = Date.now, hardStopGraceMs = HARD_STOP_GRACE_MS }) {
  async function failure(err, { requestKey, provider, model }) {
    const info = classifyProviderError(err);
    await receiptRuntime(requestKey, null, { error: 'physical_request_failed', errorKind: info.kind, status: info.status, code: info.code, type: info.type }).catch(() => {});
    return {
      ok: false,
      error: `${provider}:${info.code || (info.status ? `status_${info.status}` : err?.name) || 'request_failed'}:${err?.message || ''}`.slice(0, 240),
      errorKind: info.kind, status: info.status, code: info.code, type: info.type, provider, model,
    };
  }

  async function callOpenAICompatible({ client, requestKey, provider, model, messages, jsonMode, maxTokens, reasoningEffort, timeoutMs, reservation }) {
    try {
      const body = openaiRequestBody({ model, messages, jsonMode, maxTokens, reasoningEffort });
      const completion = await withHardStop(client.chat.completions.create(body, timeoutMs ? { timeout: timeoutMs } : undefined), timeoutMs, hardStopGraceMs);
      const choice = completion.choices?.[0];
      const text = choice?.message?.content || '';
      const usage = completion.usage || {};
      const result = {
        ok: true,
        raw: text,
        usage: {
          provider,
          model,
          inputTokens: usage.prompt_tokens || 0,
          outputTokens: usage.completion_tokens || 0,
          estimatedCostUsd: Number.isFinite(usage.prompt_tokens) && Number.isFinite(usage.completion_tokens) ? (usage.prompt_tokens * reservation.inputRate + usage.completion_tokens * reservation.outputRate) / 1_000_000 : null,
        },
      };
      await receiptRuntime(requestKey, result.usage.estimatedCostUsd, { response: result, usage });
      if (result.usage.estimatedCostUsd === null) return { ok: false, error: 'provider_usage_missing', errorKind: 'usage_missing' };
      return result;
    } catch (err) {
      return failure(err, { requestKey, provider, model });
    }
  }

  // Claude Messages API: system prompt is top-level; JSON is requested by instruction and parsed
  // tolerantly (fences stripped). Usage is always returned, so receipts carry exact token counts.
  async function callAnthropic({ client, requestKey, provider, model, messages, jsonMode, maxTokens, reasoningEffort, timeoutMs, reservation }) {
    try {
      const body = anthropicRequestBody({ model, messages, jsonMode, maxTokens, reasoningEffort });
      const response = await withHardStop(client.messages.create(body, timeoutMs ? { timeout: timeoutMs } : undefined), timeoutMs, hardStopGraceMs);
      const text = (response.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
      const usage = response.usage || {};
      const input = (usage.input_tokens || 0) + (usage.cache_creation_input_tokens || 0) + (usage.cache_read_input_tokens || 0);
      const output = usage.output_tokens;
      const result = {
        ok: response.stop_reason !== 'refusal',
        raw: text,
        usage: { provider, model, inputTokens: input, outputTokens: output || 0,
          estimatedCostUsd: Number.isFinite(output) ? (input * reservation.inputRate + output * reservation.outputRate) / 1_000_000 : null },
        ...(response.stop_reason === 'refusal' ? { error: 'anthropic:refusal', errorKind: 'refusal' } : {}),
      };
      await receiptRuntime(requestKey, result.usage.estimatedCostUsd, { response: result, usage, stopReason: response.stop_reason });
      if (result.usage.estimatedCostUsd === null) return { ok: false, error: 'provider_usage_missing', errorKind: 'usage_missing' };
      return result;
    } catch (err) {
      return failure(err, { requestKey, provider, model });
    }
  }

  async function callOnce({ requestKey, provider, model, systemPrompt, userMessage, context, jsonMode, maxTokens = 950, reasoningEffort = null, timeoutMs = null }) {
    const client = getClient(provider);
    if (!client) {
      return { ok: false, error: `provider_unavailable:${provider}`, errorKind: 'provider_unavailable', provider, model };
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content:
          typeof context === 'object' && context !== null
            ? `STUDENT_CONTEXT_JSON:\n${JSON.stringify(context)}\n\nUSER_MESSAGE:\n${userMessage}`
            : userMessage,
      },
    ];

    let reservation;
    try {
      reservation = await reserveRuntime({ requestKey, provider, model, messages, maxTokens: outputBound(model, maxTokens, reasoningEffort) });
      if (!reservation.dispatch) return reservation.receipt?.response || { ok: false, error: 'runtime_request_pending', errorKind: 'pending' };
    } catch (err) {
      return { ok: false, error: 'runtime_ai_temporarily_unavailable', errorKind: err?.kind || 'guard_unavailable', provider, model };
    }
    const call = provider === 'anthropic' ? callAnthropic : callOpenAICompatible;
    return call({ client, requestKey, provider, model, messages, jsonMode, maxTokens, reasoningEffort, timeoutMs, reservation });
  }

  /**
   * Generate a strict-JSON AI response with provider/model fallback and one repair retry on invalid JSON.
   * Always returns an object; never throws.
   *
   * Time: `deadlineAt` (epoch ms) is the moment the caller needs an answer by. No attempt starts with less than
   * MIN_ATTEMPT_MS left, and every attempt gets at most what is left (and at most `callTimeoutMs`), passed to the SDK
   * as its per-request `timeout`. Without a deadline the SDK client's own default applies.
   *
   * Fallback: when `fallbackRoute` ({ provider, model, reasoningEffort, callTimeoutMs? }) is given and the primary
   * call FAILED (timeout, quota, rate limit, 5xx, network, auth, a rejected parameter, a missing price), one more
   * call goes to that route, after the primary has failed and never alongside it. Invalid JSON from a call that
   * did succeed keeps the older ladder: one same-model JSON retry, then GPT-6 Luna with no reasoning.
   *
   * On failure the result carries `failure` ({ stage, provider, model, kind, status, code }): the first call that
   * really failed. No prompt text, no student data.
   */
  async function generateAIResponse({
    requestKey,
    tier = 'smart',
    systemPrompt,
    userMessage,
    context = null,
    responseSchema = null,
    maxRetries = 1,
    // Optional per-call routing (for example Mistake Repair pins GPT-6 Luna and its effort level).
    provider = null,
    model = null,
    reasoningEffort = null,
    fallbackRoute = null,
    deadlineAt = null,
    callTimeoutMs = null,
    // Optional visible-output cap (see resolveMaxTokens). Absent: 950 fast, 900 smart, as before.
    maxTokens: requestedMaxTokens = null,
  } = {}) {
    if (!systemPrompt || !userMessage) {
      return {
        ok: false,
        error: 'missing_prompt',
        data: null,
        raw: null,
        usage: { provider: 'none', model: 'none', inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
        fallbackUsed: false,
        failure: null,
      };
    }

    const primaryProvider = provider || 'openai';
    const fallbackProvider = 'openai';
    const primaryModel = model || pickModelForTier(tier);
    const fallbackModel = LUNA_MODEL;
    reasoningEffort = reasoningEffort || DEFAULT_EFFORT[tier] || DEFAULT_EFFORT.fast;
    const maxTokens = resolveMaxTokens(tier, requestedMaxTokens);

    const failures = [];
    const timeoutFor = (cap) => {
      if (deadlineAt === null || deadlineAt === undefined) return cap || null;
      const left = deadlineAt - now();
      if (left < MIN_ATTEMPT_MS) return 0;
      return cap ? Math.min(cap, left) : left;
    };
    const attemptCall = async (stage, route, extra) => {
      const timeoutMs = timeoutFor(extra.capMs ?? callTimeoutMs);
      const result = timeoutMs === 0
        ? { ok: false, error: 'deadline_exceeded', errorKind: 'timeout', skipped: true }
        : await callOnce({
          requestKey: requestKey ? `${requestKey}:${stage}` : null,
          provider: route.provider,
          model: route.model,
          reasoningEffort: route.reasoningEffort,
          systemPrompt: extra.systemPrompt ?? systemPrompt,
          userMessage,
          context,
          jsonMode: true,
          maxTokens,
          timeoutMs,
        });
      if (!result.ok) failures.push({ stage, provider: route.provider, model: route.model, kind: result.errorKind || 'unknown', status: result.status ?? null, code: result.code ?? null, skipped: !!result.skipped });
      return result;
    };

    // ---- attempt 1: primary provider, JSON mode ----
    let attempt = await attemptCall('primary', { provider: primaryProvider, model: primaryModel, reasoningEffort }, {});

    let parsed = attempt.ok ? safeParseJson(attempt.raw) : null;
    let validationOk = parsed ? validateAgainstSchema(parsed, responseSchema) : false;

    // ---- repair retry: same model, harder JSON instruction ----
    if (attempt.ok && (!parsed || !validationOk) && maxRetries > 0) {
      const repaired = await attemptCall('repair', { provider: primaryProvider, model: primaryModel, reasoningEffort }, {
        systemPrompt: `${systemPrompt}\n\nCRITICAL: Your previous reply was not valid JSON in the required schema. Return ONLY a single JSON object that exactly matches the schema. No prose, no markdown, no code fences.`,
      });
      if (repaired.ok) {
        attempt = repaired;
        parsed = safeParseJson(repaired.raw);
        validationOk = parsed ? validateAgainstSchema(parsed, responseSchema) : false;
      }
    }

    // ---- fallback ----
    let fallbackUsed = false;
    let fallbackReason = null;
    const accept = (fb, reason) => {
      if (!fb.ok) return;
      const fbParsed = safeParseJson(fb.raw);
      if (fbParsed && validateAgainstSchema(fbParsed, responseSchema)) {
        attempt = fb;
        parsed = fbParsed;
        validationOk = true;
        fallbackUsed = true;
        fallbackReason = reason;
      } else if (!parsed && fbParsed) {
        // Take fallback parse even if schema is partial; better than nothing.
        attempt = fb;
        parsed = fbParsed;
        validationOk = false;
        fallbackUsed = true;
        fallbackReason = reason;
      }
    };
    const sameProviderFallback = () => attemptCall('fallback', { provider: fallbackProvider, model: fallbackModel, reasoningEffort: 'none' }, {});
    if (!attempt.ok || !parsed || !validationOk) {
      const lastFailure = [...failures].reverse().find((f) => !f.skipped) || null;
      if (!(lastFailure && NO_RETRY_KINDS.has(lastFailure.kind))) {
        const cross = !!(fallbackRoute && lastFailure && FALLBACK_KINDS.has(lastFailure.kind)
          && !(fallbackRoute.provider === primaryProvider && fallbackRoute.model === primaryModel));
        if (cross) {
          const route = { provider: fallbackRoute.provider, model: fallbackRoute.model, reasoningEffort: fallbackRoute.reasoningEffort || 'low' };
          const other = await attemptCall('provider_fallback', route, { capMs: fallbackRoute.callTimeoutMs });
          accept(other, lastFailure.kind);
          // The other provider is not set up (no key, no price row yet): where asking the same provider again can
          // help, that is still tried, as it was before the cross-provider fallback existed. A timeout or a quota
          // failure never is: the retry would burn the time left or fail the same way.
          if (!other.ok && (other.errorKind === 'provider_unavailable' || other.errorKind === 'price') && SAME_PROVIDER_MAY_HELP.has(lastFailure.kind)) {
            accept(await sameProviderFallback(), lastFailure.kind);
          }
        } else {
          accept(await sameProviderFallback(), 'invalid_output');
        }
      }
    }

    const first = failures.find((f) => !f.skipped) || failures[0] || null;
    const failureInfo = first ? { stage: first.stage, provider: first.provider, model: first.model, kind: first.kind, status: first.status, code: first.code } : null;

    if (!parsed) {
      return {
        ok: false,
        error: attempt.error || 'no_parseable_json',
        data: null,
        raw: attempt.raw || null,
        usage:
          attempt.usage ||
          { provider: 'none', model: 'none', inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
        fallbackUsed,
        failure: failureInfo,
      };
    }

    return {
      ok: validationOk,
      data: parsed,
      raw: attempt.raw,
      usage: attempt.usage,
      fallbackUsed,
      fallbackReason,
      failure: failureInfo,
      schemaValid: validationOk,
    };
  }

  return { callOnce, generateAIResponse };
}
