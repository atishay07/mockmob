import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createProviderRuntime, classifyProviderError, classifyGuardMessage, anthropicRequestBody, openaiRequestBody,
  outputBound, MIN_ATTEMPT_MS,
} from '../../src/services/ai/providerCore.js';

// Fakes only: no SDK, no network, no database, no paid model.
class ApiError extends Error {
  constructor(status, code, message = 'provider said no', name = 'APIError') { super(message); this.name = name; this.status = status; this.code = code; this.type = code; }
}
class TimeoutError extends Error { constructor() { super('Request timed out.'); this.name = 'APIConnectionTimeoutError'; } }

const STUDENT_TEXT = 'PRIVATE-STUDENT-QUESTION-TEXT';
const schema = { required: ['solved_index'], types: { solved_index: 'number' } };
const okOpenAI = (raw = '{"solved_index":2}') => ({ choices: [{ message: { content: raw } }], usage: { prompt_tokens: 100, completion_tokens: 50 } });
const okAnthropic = (raw = '{"solved_index":2}') => ({ content: [{ type: 'text', text: raw }], stop_reason: 'end_turn', usage: { input_tokens: 100, output_tokens: 50 } });

function harness({ openai, anthropic, reserve, now = () => 1_000_000, hardStopGraceMs } = {}) {
  const log = { reserve: [], receipt: [], openai: [], anthropic: [] };
  const clients = {
    openai: openai === null ? null : { chat: { completions: { create: async (body, opts) => { log.openai.push({ body, opts }); return openai(body, opts, log.openai.length); } } } },
    anthropic: anthropic === null || anthropic === undefined ? null : { messages: { create: async (body, opts) => { log.anthropic.push({ body, opts }); return anthropic(body, opts, log.anthropic.length); } } },
  };
  const runtime = createProviderRuntime({
    getClient: (provider) => clients[provider] ?? null,
    reserveRuntime: async (args) => { log.reserve.push(args); return reserve ? reserve(args, log.reserve.length) : { dispatch: true, inputRate: 0.1, outputRate: 0.5 }; },
    receiptRuntime: async (key, cost, receipt) => { log.receipt.push({ key, cost, receipt }); },
    now, hardStopGraceMs,
  });
  return { ...runtime, log };
}
const run = (h, extra = {}) => h.generateAIResponse({ requestKey: 'repair:abc:req_0123456789abcdef', tier: 'fast', systemPrompt: 'sys', userMessage: STUDENT_TEXT, responseSchema: schema, provider: 'openai', model: 'gpt-6-luna', reasoningEffort: 'low', ...extra });
const HAIKU = { provider: 'anthropic', model: 'claude-haiku-5-5', reasoningEffort: 'low' };

test('failures are sorted by what the provider said, keeping status and code', () => {
  const kind = (err) => classifyProviderError(err);
  assert.deepEqual(kind(new ApiError(429, 'insufficient_quota', 'You exceeded your current quota, please check your plan and billing details.')), { kind: 'quota', status: 429, code: 'insufficient_quota', type: 'insufficient_quota' });
  assert.equal(kind(new ApiError(429, 'rate_limit_exceeded', 'Rate limit reached')).kind, 'rate_limit');
  assert.equal(kind(new TimeoutError()).kind, 'timeout');
  assert.equal(kind(Object.assign(new Error('Request timed out.'), { hardTimeout: true })).kind, 'timeout');
  assert.deepEqual(kind(new ApiError(400, 'unsupported_parameter', "Unsupported parameter: 'reasoning_effort'")), { kind: 'bad_request', status: 400, code: 'unsupported_parameter', type: 'unsupported_parameter' });
  assert.equal(kind(new ApiError(503, null)).kind, 'server');
  assert.equal(kind(new ApiError(529, null)).kind, 'server');
  assert.equal(kind(new ApiError(401, 'invalid_api_key')).kind, 'auth');
  assert.equal(kind(Object.assign(new Error('Connection error.'), { name: 'APIConnectionError' })).kind, 'network');
  assert.equal(kind(new Error('something odd')).kind, 'unknown');
  // Anthropic nests its code: { error: { type: 'error', error: { type: 'rate_limit_error' } } }
  const nested = Object.assign(new Error('429 rate limited'), { name: 'RateLimitError', status: 429, error: { type: 'error', error: { type: 'rate_limit_error', message: 'x' } } });
  assert.deepEqual(kind(nested), { kind: 'rate_limit', status: 429, code: null, type: 'rate_limit_error' });
  const credit = Object.assign(new Error('Your credit balance is too low to access the Anthropic API.'), { status: 400, error: { type: 'error', error: { type: 'invalid_request_error' } } });
  assert.equal(kind(credit).kind, 'quota');
});

test('the runtime guard raises one exception per rule and each is told apart', () => {
  assert.equal(classifyGuardMessage('runtime budget exhausted'), 'budget');
  assert.equal(classifyGuardMessage('verified model price required'), 'price');
  assert.equal(classifyGuardMessage('runtime funding unavailable'), 'guard_paused');
  assert.equal(classifyGuardMessage('something else'), 'guard_unavailable');
});

test('Haiku 5.5 request: no temperature, no thinking budget, low effort through output_config, room for thinking tokens', () => {
  const messages = [{ role: 'system', content: 'sys' }, { role: 'user', content: 'hello' }];
  const body = anthropicRequestBody({ model: 'claude-haiku-5-5', messages, jsonMode: true, maxTokens: 950, reasoningEffort: 'low' });
  assert.ok(!('temperature' in body), 'claude-haiku-5-5 returns a 400 on any non-default temperature');
  assert.ok(!('thinking' in body), 'no thinking config: adaptive is the default and budget_tokens is rejected');
  assert.deepEqual(body.output_config, { effort: 'low' });
  assert.equal(body.max_tokens, 950 + 2500);
  assert.equal(body.model, 'claude-haiku-5-5');
  assert.match(body.system, /one JSON object only/);
  // An effort the API does not know (or "none") falls back to low rather than being sent.
  assert.deepEqual(anthropicRequestBody({ model: 'claude-haiku-5-5', messages, jsonMode: false, maxTokens: 100, reasoningEffort: 'none' }).output_config, { effort: 'low' });
  assert.equal(outputBound('claude-haiku-5-5', 950, 'low'), 3450);
});

test('older Claude models keep their own request shape', () => {
  const messages = [{ role: 'system', content: 'sys' }, { role: 'user', content: 'hello' }];
  const h45 = anthropicRequestBody({ model: 'claude-haiku-4-5', messages, jsonMode: true, maxTokens: 950 });
  assert.equal(h45.temperature, 0.4); assert.equal(h45.max_tokens, 950); assert.ok(!('output_config' in h45));
  const s55 = anthropicRequestBody({ model: 'claude-sonnet-5-5', messages, jsonMode: true, maxTokens: 950 });
  assert.ok(!('temperature' in s55)); assert.deepEqual(s55.thinking, { type: 'between_tools' });
  const luna = openaiRequestBody({ model: 'gpt-6-luna', messages, jsonMode: true, maxTokens: 950, reasoningEffort: 'low' });
  assert.equal(luna.max_completion_tokens, 3450); assert.equal(luna.reasoning_effort, 'low'); assert.ok(!('temperature' in luna));
});

test('a per-call timeout reaches the SDK as its `timeout` option, capped by the time left', async () => {
  let t = 1_000_000;
  const h = harness({ openai: async () => okOpenAI(), now: () => t });
  await run(h, { deadlineAt: t + 40_000, callTimeoutMs: 25_000 });
  assert.equal(h.log.openai[0].opts.timeout, 25_000, 'the per-call cap');
  const h2 = harness({ openai: async () => okOpenAI(), now: () => t });
  await run(h2, { deadlineAt: t + 9_000, callTimeoutMs: 25_000 });
  assert.equal(h2.log.openai[0].opts.timeout, 9_000, 'never more than what is left');
  const h3 = harness({ openai: async () => okOpenAI() });
  await run(h3);
  assert.equal(h3.log.openai[0].opts, undefined, 'no deadline: the client default applies');
});

test('an attempt that cannot finish before the deadline is not started', async () => {
  const t = 1_000_000;
  const h = harness({ openai: async () => okOpenAI(), anthropic: async () => okAnthropic(), now: () => t });
  const out = await run(h, { deadlineAt: t + MIN_ATTEMPT_MS - 1, fallbackRoute: HAIKU });
  assert.equal(out.ok, false);
  assert.equal(out.failure.kind, 'timeout');
  assert.equal(h.log.openai.length + h.log.anthropic.length, 0, 'no call and no guard reservation');
  assert.equal(h.log.reserve.length, 0);
});

test('a call that stalls past its timeout is stopped and reported as a timeout', async () => {
  const h = harness({ openai: () => new Promise(() => {}), hardStopGraceMs: 5 });
  const out = await run(h, { callTimeoutMs: 20, maxRetries: 0 });
  assert.equal(out.ok, false);
  assert.equal(out.failure.kind, 'timeout');
  assert.equal(h.log.receipt.at(-1).receipt.errorKind, 'timeout', 'the guard receipt says why, so the spend is booked');
});

test('a failed call keeps its status and code in the result and in the guard receipt, with no student text', async () => {
  const h = harness({ openai: async () => { throw new ApiError(429, 'insufficient_quota', 'You exceeded your current quota'); } });
  const out = await run(h);
  assert.equal(out.ok, false);
  assert.equal(out.data, null);
  assert.deepEqual(out.failure, { stage: 'primary', provider: 'openai', model: 'gpt-6-luna', kind: 'quota', status: 429, code: 'insufficient_quota' });
  const receipt = h.log.receipt[0];
  assert.deepEqual(receipt.receipt, { error: 'physical_request_failed', errorKind: 'quota', status: 429, code: 'insufficient_quota', type: 'insufficient_quota' });
  assert.equal(receipt.cost, null, 'unknown spend books the full reservation');
  assert.doesNotMatch(JSON.stringify(h.log.receipt), new RegExp(STUDENT_TEXT));
});

test('GPT-6 Luna failing with quota falls back once to claude-haiku-5-5, after the primary, and records what ran', async () => {
  const order = [];
  const h = harness({
    openai: async () => { order.push('openai'); throw new ApiError(429, 'insufficient_quota'); },
    anthropic: async () => { order.push('anthropic'); return okAnthropic(); },
  });
  const out = await run(h, { fallbackRoute: HAIKU });
  assert.deepEqual(order, ['openai', 'anthropic'], 'fallback strictly after the primary failed');
  assert.equal(out.ok, true);
  assert.deepEqual(out.data, { solved_index: 2 });
  assert.equal(out.fallbackUsed, true);
  assert.equal(out.fallbackReason, 'quota');
  assert.equal(out.usage.provider, 'anthropic'); assert.equal(out.usage.model, 'claude-haiku-5-5');
  assert.equal(h.log.openai.length, 1, 'no same-provider retry after a quota failure');
  assert.deepEqual(h.log.reserve.map(r => r.requestKey), ['repair:abc:req_0123456789abcdef:primary', 'repair:abc:req_0123456789abcdef:provider_fallback'], 'two separate guard reservations, one per physical call');
  assert.deepEqual(h.log.reserve.map(r => [r.provider, r.model]), [['openai', 'gpt-6-luna'], ['anthropic', 'claude-haiku-5-5']]);
  assert.equal(out.failure.kind, 'quota', 'the Luna failure is still reported');
});

test('the Haiku call carries no temperature and low effort on the wire, and its timeout', async () => {
  const h = harness({ openai: async () => { throw new TimeoutError(); }, anthropic: async () => okAnthropic() });
  const out = await run(h, { fallbackRoute: HAIKU, deadlineAt: 1_000_000 + 45_000, callTimeoutMs: 25_000 });
  assert.equal(out.ok, true);
  const { body, opts } = h.log.anthropic[0];
  assert.ok(!('temperature' in body), 'no temperature is sent for claude-haiku-5-5');
  assert.ok(!('thinking' in body));
  assert.deepEqual(body.output_config, { effort: 'low' });
  assert.equal(body.model, 'claude-haiku-5-5');
  assert.equal(opts.timeout, 25_000);
});

test('every failure kind the owner named reaches the fallback: timeout, 429, 5xx and a rejected parameter', async () => {
  for (const err of [new TimeoutError(), new ApiError(429, 'rate_limit_exceeded'), new ApiError(502, null), new ApiError(400, 'unsupported_parameter')]) {
    const h = harness({ openai: async () => { throw err; }, anthropic: async () => okAnthropic() });
    const out = await run(h, { fallbackRoute: HAIKU });
    assert.equal(out.fallbackUsed, true, `${err.status ?? err.name} should fall back`);
    assert.equal(h.log.anthropic.length, 1);
  }
});

test('no fallback while the primary works', async () => {
  const h = harness({ openai: async () => okOpenAI(), anthropic: async () => okAnthropic() });
  const out = await run(h, { fallbackRoute: HAIKU });
  assert.equal(out.ok, true);
  assert.equal(out.fallbackUsed, false);
  assert.equal(h.log.anthropic.length, 0, 'the second provider is never called, never reserved');
  assert.equal(h.log.reserve.length, 1);
});

test('invalid JSON from a call that worked keeps the old ladder: one same-model retry, then Luna with no reasoning, never Haiku', async () => {
  const h = harness({ openai: async (body, opts, n) => okOpenAI(n < 3 ? 'not json at all' : '{"solved_index":1}'), anthropic: async () => okAnthropic() });
  const out = await run(h, { fallbackRoute: HAIKU });
  assert.equal(out.ok, true);
  assert.equal(out.fallbackUsed, true);
  assert.equal(out.fallbackReason, 'invalid_output');
  assert.deepEqual(h.log.openai.map(c => c.body.reasoning_effort), ['low', 'low', 'none']);
  assert.equal(h.log.anthropic.length, 0);
});

test('when both providers fail, the Luna failure is the one reported and nothing is invented', async () => {
  const h = harness({ openai: async () => { throw new ApiError(429, 'insufficient_quota'); }, anthropic: async () => { throw new ApiError(529, null); } });
  const out = await run(h, { fallbackRoute: HAIKU });
  assert.equal(out.ok, false);
  assert.equal(out.data, null);
  assert.equal(out.failure.kind, 'quota');
  assert.equal(out.fallbackUsed, false);
  assert.equal(h.log.openai.length + h.log.anthropic.length, 2, 'exactly one retry, on the other provider');
});

test('no Anthropic key: the fallback is skipped cleanly and the Luna failure stands', async () => {
  const h = harness({ openai: async () => { throw new ApiError(500, null); }, anthropic: null });
  const out = await run(h, { fallbackRoute: HAIKU });
  assert.equal(out.ok, false);
  assert.equal(out.failure.kind, 'server');
  assert.ok(h.log.reserve.every(r => r.provider === 'openai'), 'nothing reserved for a provider that cannot be called');
});

test('a missing Haiku price row stops the fallback at the guard, with no spend', async () => {
  const h = harness({
    openai: async () => { throw new ApiError(429, 'insufficient_quota'); }, anthropic: async () => okAnthropic(),
    reserve: (args) => { if (args.provider === 'anthropic') throw Object.assign(new Error('runtime_ai_funding_or_verified_prices_unavailable'), { kind: 'price' }); return { dispatch: true, inputRate: 0.1, outputRate: 0.5 }; },
  });
  const out = await run(h, { fallbackRoute: HAIKU });
  assert.equal(out.ok, false);
  assert.equal(out.failure.kind, 'quota');
  assert.equal(h.log.anthropic.length, 0, 'the provider was never called');
});

test('the monthly cap is shared by every provider, so a cap stop makes no second call', async () => {
  const h = harness({ openai: async () => okOpenAI(), anthropic: async () => okAnthropic(), reserve: () => { throw Object.assign(new Error('runtime_ai_funding_or_verified_prices_unavailable'), { kind: 'budget' }); } });
  const out = await run(h, { fallbackRoute: HAIKU });
  assert.equal(out.ok, false);
  assert.equal(out.failure.kind, 'budget');
  assert.equal(h.log.reserve.length, 1);
  assert.equal(h.log.openai.length + h.log.anthropic.length, 0);
  const paused = harness({ openai: async () => okOpenAI(), reserve: () => { throw Object.assign(new Error('x'), { kind: 'guard_paused' }); } });
  assert.equal((await run(paused)).failure.kind, 'guard_paused');
});

test('without a fallbackRoute the earlier ladder is unchanged: a failed primary is followed by Luna with no reasoning', async () => {
  const h = harness({ openai: async (body, opts, n) => { if (n === 1) throw new ApiError(500, null); return okOpenAI(); } });
  const out = await run(h);
  assert.equal(out.ok, true);
  assert.equal(out.fallbackUsed, true);
  assert.deepEqual(h.log.openai.map(c => c.body.reasoning_effort), ['low', 'none']);
});

test('a refusal or an unusable reply is not a transport failure and does not trigger the cross-provider fallback', async () => {
  const h = harness({ openai: async () => okOpenAI('{"wrong":"shape"}'), anthropic: async () => okAnthropic() });
  const out = await run(h, { fallbackRoute: HAIKU });
  assert.equal(h.log.anthropic.length, 0);
  assert.equal(out.failure, null, 'every call worked; the output was the problem');
});

test('where Haiku is not set up yet, a rejected parameter still gets the older same-provider retry; a timeout or quota does not', async () => {
  const rejected = harness({ openai: async (body, opts, n) => { if (n === 1) throw new ApiError(400, 'unsupported_parameter'); return okOpenAI(); }, anthropic: null });
  const out = await run(rejected, { fallbackRoute: HAIKU });
  assert.equal(out.ok, true);
  assert.equal(out.fallbackUsed, true);
  assert.deepEqual(rejected.log.openai.map(c => c.body.reasoning_effort), ['low', 'none']);

  for (const err of [new TimeoutError(), new ApiError(429, 'insufficient_quota')]) {
    const h = harness({ openai: async () => { throw err; }, anthropic: null });
    const result = await run(h, { fallbackRoute: HAIKU });
    assert.equal(result.ok, false);
    assert.equal(h.log.openai.length, 1, 'no second call that would burn time or fail the same way');
  }
});

// ---- Optional maxTokens (Mistake Repair v3 asks for 1,400) ----
import { resolveMaxTokens, DEFAULT_MAX_TOKENS } from '../../src/services/ai/providerCore.js';

test('no maxTokens: the request body and the guard reservation bound are exactly as before', async () => {
  const fast = harness({ openai: async () => okOpenAI() });
  await run(fast);
  assert.equal(fast.log.openai[0].body.max_completion_tokens, 950 + 2500);
  assert.equal(fast.log.reserve[0].maxTokens, 950 + 2500, 'reservation bound for fast Luna at low effort');
  const smart = harness({ openai: async () => okOpenAI() });
  await run(smart, { tier: 'smart' });
  assert.equal(smart.log.openai[0].body.max_completion_tokens, 900 + 2500);
  assert.equal(smart.log.reserve[0].maxTokens, 900 + 2500);
  const none = harness({ openai: async () => okOpenAI() });
  await run(none, { reasoningEffort: 'none' });
  assert.equal(none.log.openai[0].body.max_completion_tokens, 950);
  assert.equal(none.log.reserve[0].maxTokens, 950);
  assert.deepEqual(DEFAULT_MAX_TOKENS, { fast: 950, smart: 900 });
});

test('maxTokens 1400 reaches the OpenAI body, the Haiku body and both guard reservations (1,400 + 2,500 = 3,900)', async () => {
  const h = harness({ openai: async () => { throw new ApiError(429, 'insufficient_quota'); }, anthropic: async () => okAnthropic() });
  const out = await run(h, { maxTokens: 1400, fallbackRoute: HAIKU });
  assert.equal(out.ok, true);
  assert.equal(h.log.openai[0].body.max_completion_tokens, 3900);
  assert.equal(h.log.anthropic[0].body.max_tokens, 3900);
  assert.deepEqual(h.log.reserve.map((r) => r.maxTokens), [3900, 3900]);
  const retry = harness({ openai: async (body, opts, n) => okOpenAI(n < 3 ? 'not json' : '{"solved_index":1}') });
  await run(retry, { maxTokens: 1400 });
  assert.deepEqual(retry.log.openai.map((c) => c.body.max_completion_tokens), [3900, 3900, 1400], 'the JSON retry keeps the cap; the no-reasoning fallback has no headroom');
});

test('maxTokens is clamped to 200..2,000; anything else falls back to the default', () => {
  assert.equal(resolveMaxTokens('fast', 1400), 1400);
  assert.equal(resolveMaxTokens('fast', 50), 200);
  assert.equal(resolveMaxTokens('fast', 99_999), 2000);
  assert.equal(resolveMaxTokens('fast', 1400.6), 1401);
  assert.equal(resolveMaxTokens('fast', null), 950);
  assert.equal(resolveMaxTokens('smart', undefined), 900);
  assert.equal(resolveMaxTokens('fast', '1400'), 950, 'a string is not a number');
  assert.equal(resolveMaxTokens('fast', Number.NaN), 950);
});
