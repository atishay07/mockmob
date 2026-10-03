import 'server-only';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { reserveRuntime, receiptRuntime } from './runtimeGuard';

/**
 * AI provider abstraction for MockMob.
 *
 * Tiered model routing (env-driven, no hard-coded model names):
 *   AI_DEFAULT_PROVIDER   = 'anthropic' | 'openai' | 'deepseek'   (default 'openai')
 *   ANTHROPIC_API_KEY     (owner choice 4 Oct 2026: claude-haiku-4-5 fast, claude-sonnet-5-5 smart)
 *   AI_FAST_MODEL         = e.g. 'gpt-4o-mini'      (cheap PrepOS chat)
 *   AI_SMART_MODEL        = e.g. 'gpt-4.1-mini'     (autopsy / recovery)
 *   AI_FALLBACK_PROVIDER  = e.g. 'openai'
 *   AI_FAST_PROVIDER      = optional override for fast replies
 *   AI_FALLBACK_MODEL     = e.g. 'gpt-5-nano'
 *   DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL (default https://api.deepseek.com)
 *   OPENAI_API_KEY
 *
 * Public API:
 *   generateAIResponse({ tier, systemPrompt, userMessage, context, responseSchema, maxRetries })
 *     -> { ok, data, raw, usage, fallbackUsed, error }
 *
 *   tier is 'smart' or 'fast' (smart -> AI_SMART_MODEL, fast -> AI_FAST_MODEL)
 */

let _deepseek = null;
let _openai = null;
let _anthropic = null;

function getAnthropicClient() {
  if (_anthropic) return _anthropic;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  // SDK retries off: every physical request must pass through the runtime reservation.
  _anthropic = new Anthropic({ apiKey, maxRetries: 0, timeout: 45_000 });
  return _anthropic;
}

function getDeepseekClient() {
  if (_deepseek) return _deepseek;
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;
  _deepseek = new OpenAI({
    maxRetries: 0,
    apiKey,
    baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
  });
  return _deepseek;
}

function getOpenAIClient() {
  if (_openai) return _openai;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  _openai = new OpenAI({ apiKey, maxRetries: 0 });
  return _openai;
}

function getClient(provider) {
  if (provider === 'deepseek') return getDeepseekClient();
  if (provider === 'openai') return getOpenAIClient();
  if (provider === 'anthropic') return getAnthropicClient();
  return null;
}

function pickModelForTier(tier) {
  const fast = process.env.AI_FAST_MODEL || 'gpt-4o-mini';
  const smart = process.env.AI_SMART_MODEL || 'gpt-4.1-mini';
  return tier === 'smart' ? smart : fast;
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
  'claude-haiku-4-5': { in: 1, out: 5 },
  'claude-sonnet-5-5': { in: 2, out: 10 },
};

function estimateCostUsd(model, inputTokens, outputTokens) {
  const rates = COST_TABLE[model];
  if (!rates) return null;
  const cost = (inputTokens / 1_000_000) * rates.in + (outputTokens / 1_000_000) * rates.out;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

function safeParseJson(text) {
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

async function callOnce({ requestKey, provider, model, systemPrompt, userMessage, context, jsonMode, maxTokens = 950 }) {
  const client = getClient(provider);
  if (!client) {
    return { ok: false, error: `provider_unavailable:${provider}` };
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
    reservation = await reserveRuntime({requestKey,provider,model,messages,maxTokens});
    if (!reservation.dispatch) return reservation.receipt?.response || {ok:false,error:'runtime_request_pending'};
  } catch { return {ok:false,error:'runtime_ai_temporarily_unavailable'}; }
  if (provider === 'anthropic') return callAnthropic({ client, requestKey, provider, model, messages, jsonMode, maxTokens, reservation });
  try {
    const completion = await client.chat.completions.create({
      model,
      messages,
      temperature: 0.4,
      max_tokens: maxTokens,
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
    });
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
    await receiptRuntime(requestKey,result.usage.estimatedCostUsd,{response:result,usage});
    if (result.usage.estimatedCostUsd === null) return {ok:false,error:'provider_usage_missing'};
    return result;
  } catch (err) {
    await receiptRuntime(requestKey,null,{error:'physical_request_failed_or_receipt_unavailable'}).catch(()=>{});
    return {
      ok: false,
      error: `${provider}:${err?.code || err?.name || 'request_failed'}:${err?.message || ''}`.slice(0, 240),
    };
  }
}

// Claude Messages API: system prompt is top-level; JSON is requested by instruction and parsed
// tolerantly (fences stripped). Usage is always returned, so receipts carry exact token counts.
async function callAnthropic({ client, requestKey, provider, model, messages, jsonMode, maxTokens, reservation }) {
  try {
    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      // Haiku 4.5 accepts sampling and does not think unless asked. Sonnet 5.5 rejects custom
      // sampling and thinks by default; short grounded replies run without thinking there.
      ...(/^claude-sonnet-5/.test(model) ? { thinking: { type: 'between_tools' } } : { temperature: 0.4 }),
      system: jsonMode ? `${messages[0].content}

Reply with one JSON object only. No prose outside it, no code fences.` : messages[0].content,
      messages: [{ role: 'user', content: messages[1].content }],
    });
    const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    const usage = response.usage || {};
    const input = (usage.input_tokens || 0) + (usage.cache_creation_input_tokens || 0) + (usage.cache_read_input_tokens || 0);
    const output = usage.output_tokens;
    const result = {
      ok: response.stop_reason !== 'refusal',
      raw: text,
      usage: { provider, model, inputTokens: input, outputTokens: output || 0,
        estimatedCostUsd: Number.isFinite(output) ? (input * reservation.inputRate + output * reservation.outputRate) / 1_000_000 : null },
      ...(response.stop_reason === 'refusal' ? { error: 'anthropic:refusal' } : {}),
    };
    await receiptRuntime(requestKey, result.usage.estimatedCostUsd, { response: result, usage, stopReason: response.stop_reason });
    if (result.usage.estimatedCostUsd === null) return { ok: false, error: 'provider_usage_missing' };
    return result;
  } catch (err) {
    await receiptRuntime(requestKey, null, { error: 'physical_request_failed_or_receipt_unavailable' }).catch(() => {});
    const kind = err instanceof Anthropic.RateLimitError ? 'rate_limited' : err instanceof Anthropic.APIError ? `status_${err.status}` : err?.name || 'request_failed';
    return { ok: false, error: `anthropic:${kind}:${err?.message || ''}`.slice(0, 240) };
  }
}

/**
 * Generate a strict-JSON AI response with provider/model fallback and
 * one repair retry on invalid JSON. Always returns an object; never throws.
 */
export async function generateAIResponse({
  requestKey,
  tier = 'smart',
  systemPrompt,
  userMessage,
  context = null,
  responseSchema = null,
  maxRetries = 1,
} = {}) {
  if (!systemPrompt || !userMessage) {
    return {
      ok: false,
      error: 'missing_prompt',
      data: null,
      raw: null,
      usage: { provider: 'none', model: 'none', inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
      fallbackUsed: false,
    };
  }

  const primaryProvider =
    tier === 'fast'
      ? (process.env.AI_FAST_PROVIDER || process.env.AI_DEFAULT_PROVIDER || 'openai')
      : (process.env.AI_DEFAULT_PROVIDER || 'openai');
  const fallbackProvider = process.env.AI_FALLBACK_PROVIDER || 'openai';
  const primaryModel = pickModelForTier(tier);
  const fallbackModel = process.env.AI_FALLBACK_MODEL || 'gpt-4o-mini';
  const maxTokens = tier === 'smart' ? 900 : 950;

  // ---- attempt 1: primary provider, JSON mode ----
  let attempt = await callOnce({
    requestKey: requestKey ? `${requestKey}:primary` : null,
    provider: primaryProvider,
    model: primaryModel,
    systemPrompt,
    userMessage,
    context,
    jsonMode: true,
    maxTokens,
  });

  let parsed = attempt.ok ? safeParseJson(attempt.raw) : null;
  let validationOk = parsed ? validateAgainstSchema(parsed, responseSchema) : false;

  // ---- repair retry: same model, harder JSON instruction ----
  if (attempt.ok && (!parsed || !validationOk) && maxRetries > 0) {
    const repaired = await callOnce({
      requestKey: requestKey ? `${requestKey}:repair` : null,
      provider: primaryProvider,
      model: primaryModel,
      systemPrompt:
        systemPrompt +
        '\n\nCRITICAL: Your previous reply was not valid JSON in the required schema. Return ONLY a single JSON object that exactly matches the schema. No prose, no markdown, no code fences.',
      userMessage,
      context,
      jsonMode: true,
      maxTokens,
    });
    if (repaired.ok) {
      attempt = repaired;
      parsed = safeParseJson(repaired.raw);
      validationOk = parsed ? validateAgainstSchema(parsed, responseSchema) : false;
    }
  }

  // ---- fallback provider ----
  let fallbackUsed = false;
  if (!attempt.ok || !parsed || !validationOk) {
    const fb = await callOnce({
      requestKey: requestKey ? `${requestKey}:fallback` : null,
      provider: fallbackProvider,
      model: fallbackModel,
      systemPrompt,
      userMessage,
      context,
      jsonMode: true,
      maxTokens,
    });
    if (fb.ok) {
      const fbParsed = safeParseJson(fb.raw);
      if (fbParsed && validateAgainstSchema(fbParsed, responseSchema)) {
        attempt = fb;
        parsed = fbParsed;
        validationOk = true;
        fallbackUsed = true;
      } else if (!parsed && fbParsed) {
        // Take fallback parse even if schema is partial; better than nothing.
        attempt = fb;
        parsed = fbParsed;
        validationOk = false;
        fallbackUsed = true;
      }
    }
  }

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
    };
  }

  return {
    ok: validationOk,
    data: parsed,
    raw: attempt.raw,
    usage: attempt.usage,
    fallbackUsed,
    schemaValid: validationOk,
  };
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

export const __testing = { safeParseJson, estimateCostUsd, pickModelForTier };
