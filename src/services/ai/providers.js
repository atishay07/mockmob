import 'server-only';
import OpenAI from 'openai';

/**
 * AI provider abstraction for MockMob.
 *
 * Tiered model routing (env-driven, no hard-coded model names):
 *   AI_DEFAULT_PROVIDER   = 'openai' | 'deepseek'   (default 'openai')
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

function getDeepseekClient() {
  if (_deepseek) return _deepseek;
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;
  _deepseek = new OpenAI({
    apiKey,
    baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
  });
  return _deepseek;
}

function getOpenAIClient() {
  if (_openai) return _openai;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  _openai = new OpenAI({ apiKey });
  return _openai;
}

function getClient(provider) {
  if (provider === 'deepseek') return getDeepseekClient();
  if (provider === 'openai') return getOpenAIClient();
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
};

function estimateCostUsd(model, inputTokens, outputTokens) {
  const rates = COST_TABLE[model];
  if (!rates) return 0;
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

async function callOnce({ provider, model, systemPrompt, userMessage, context, jsonMode, maxTokens = 950 }) {
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
    return {
      ok: true,
      raw: text,
      usage: {
        provider,
        model,
        inputTokens: usage.prompt_tokens || 0,
        outputTokens: usage.completion_tokens || 0,
        estimatedCostUsd: estimateCostUsd(
          model,
          usage.prompt_tokens || 0,
          usage.completion_tokens || 0,
        ),
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: `${provider}:${err?.code || err?.name || 'request_failed'}:${err?.message || ''}`.slice(0, 240),
    };
  }
}

/**
 * Generate a strict-JSON AI response with provider/model fallback and
 * one repair retry on invalid JSON. Always returns an object; never throws.
 */
export async function generateAIResponse({
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
    ok: true,
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
