import 'server-only';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { reserveRuntime, receiptRuntime } from './runtimeGuard';
import {
  createProviderRuntime, LUNA_MODEL, DEFAULT_EFFORT, isReasoningModel, outputBound,
  validateAgainstSchema, safeParseJson, estimateCostUsd, pickModelForTier,
} from './providerCore';

/**
 * AI provider abstraction for MockMob.
 *
 * The request ladder, error classification, per-call timeouts and request bodies live in providerCore.js (no
 * server-only, no aliases, so they are tested with fake clients). This file owns the real SDK clients.
 *
 * Tiered model routing (env-driven, no hard-coded model names):
 * Owner rule (5 Oct 2026): GPT-6 Luna only. 'fast' = no reasoning, 'smart' = low reasoning.
 * Callers that solve or generate questions pass reasoningEffort explicitly (medium or higher).
 *   OPENAI_API_KEY
 *   AI_LUNA_MODEL         = optional model-id override (default 'gpt-6-luna')
 *
 * Public API:
 *   generateAIResponse({ tier, systemPrompt, userMessage, context, responseSchema, maxRetries,
 *                        fallbackRoute, deadlineAt, callTimeoutMs })
 *     -> { ok, data, raw, usage, fallbackUsed, error, failure }
 *
 *   tier is 'smart' (low effort) or 'fast' (no reasoning); both run GPT-6 Luna
 */

let _deepseek = null;
let _openai = null;
let _anthropic = null;

// Every client has a finite default timeout (the SDK's own default is 10 minutes, far past any serverless limit).
// A caller that has a deadline passes a tighter per-request `timeout`. Milliseconds. OPENAI_TIMEOUT_MS overrides.
const DEFAULT_TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS) > 0 ? Number(process.env.OPENAI_TIMEOUT_MS) : 45_000;

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
    timeout: DEFAULT_TIMEOUT_MS,
    apiKey,
    baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
  });
  return _deepseek;
}

function getOpenAIClient() {
  if (_openai) return _openai;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  _openai = new OpenAI({ apiKey, maxRetries: 0, timeout: DEFAULT_TIMEOUT_MS });
  return _openai;
}

function getClient(provider) {
  if (provider === 'deepseek') return getDeepseekClient();
  if (provider === 'openai') return getOpenAIClient();
  if (provider === 'anthropic') return getAnthropicClient();
  return null;
}

const runtime = createProviderRuntime({ getClient, reserveRuntime, receiptRuntime });

/**
 * Generate a strict-JSON AI response with provider/model fallback and
 * one repair retry on invalid JSON. Always returns an object; never throws.
 */
export const generateAIResponse = runtime.generateAIResponse;

export { LUNA_MODEL, DEFAULT_EFFORT, isReasoningModel, outputBound, validateAgainstSchema };
export const __testing = { safeParseJson, estimateCostUsd, pickModelForTier };
