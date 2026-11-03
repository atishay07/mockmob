import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BudgetLedger } from '../lib/budgetLedger.mjs';
import { BatchPending, createFactoryTransportV713 } from '../lib/factoryTransportV713.mjs';
import { createCampaignGuardV713 } from '../lib/campaignGuardV713.mjs';
import { expectedFreshState } from '../lib/cuetPilotV75Run.mjs';
import { runPilotV713 } from '../lib/cuetPilotRunV713.mjs';
import { hashJSON } from '../../../data/question_factory_policy.mjs';
import { assertFullBodyPreflightV713 } from '../lib/preflightV713.mjs';
import { completeJSON } from '../lib/factoryTransportV713.mjs';
import { adaptEvaluationRequestV713 } from '../lib/factoryEvidenceV713.mjs';
import { validationContractV713 } from '../lib/contractV713.mjs';

const prices = () => ({ source_url: 'https://offline.invalid/prices', expires_at: '2099-01-01', models: {
  'gpt-6-luna': { provider_host: 'api.openai.com', max_input_tokens: 12000, input_per_million: 1, output_per_million: 2,
    flex: { input_per_million: 0.5, output_per_million: 1 } },
  'gemini-3.8-flash': { provider_host: 'generativelanguage.googleapis.com', max_input_tokens: 12000,
    input_per_million: 4, output_per_million: 8, batch: { input_per_million: 0.5, output_per_million: 1.5 } },
} });
const ledgerPath = () => join(mkdtempSync(join(tmpdir(), 'mm-v713-recovery-')), 'budget.sqlite');
function openLedger(path = ledgerPath()) {
  const ledger = new BudgetLedger(path);
  ledger.reconcileHistory({ spent_usd: 0, basis: 'Isolated offline V713 transport test; no provider spend.', confirmed_at: new Date().toISOString() });
  return ledger;
}
const bodyFor = id => ({ contents: [{ role: 'user', parts: [{ text: JSON.stringify({ candidate_id: id, evidence_catalog: [] }) }] }],
  generationConfig: { maxOutputTokens: 100 } });

test('Gemini campaign batch survives queue, acceptance, reconciliation, and exact-key replay without another POST', async () => {
  const ledger = openLedger(); let batchPosts = 0, polls = 0, acceptedKey = null;
  const native = createFactoryTransportV713({ ledger, prices, queueGemini: true,
    env: { GEMINI_API_KEY: 'fixture-only' }, fetchImpl: async (url, init = {}) => {
      if (init.method === 'POST') {
        batchPosts++;
        const request = JSON.parse(init.body).batch.inputConfig.requests.requests[0];
        acceptedKey = request.metadata.key;
        assert.equal(request.request.generationConfig.maxOutputTokens, 100);
        return Response.json({ name: 'batches/v713-offline-accepted' });
      }
      polls++;
      return Response.json({ done: true, metadata: { state: 'JOB_STATE_SUCCEEDED' }, response: { inlinedResponses: [{
        metadata: { key: acceptedKey }, response: { responseId: 'fixture-response', usageMetadata: {
          promptTokenCount: 100, candidatesTokenCount: 20, thoughtsTokenCount: 5,
        }, candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"offline":"verified"}' }] } }] },
      }] } });
    } });
  const keys = new Set(), guard = createCampaignGuardV713({ ledger, native, campaignId: 'offline-v713', candidateIds: ['candidate-1'],
    capUsd: 3, prices, keys });
  const body = bodyFor('candidate-1'), originalKey = 'same-logical-independent-evaluation';
  let first;
  try { await guard.generate('gemini', body, { key: originalKey, stage: 'independent_evaluation' }); }
  catch (error) { first = error; }
  assert.ok(first instanceof BatchPending); assert.equal(first.stage, 'independent_evaluation');
  const durableKey = first.batchId; assert.ok(keys.has(durableKey)); assert.equal(batchPosts, 0);
  await assert.rejects(guard.generate('gemini', body, { key: originalKey, stage: 'independent_evaluation' }), error => error instanceof BatchPending && error.batchId === durableKey);
  assert.equal(batchPosts, 0, 'queued re-entry does not submit twice');

  const flushed = await native.flush({ candidateIds: ['offline-v713:candidate-1'], maxRequests: 1 });
  assert.equal(flushed.submissions[0].requests, 1); assert.equal(batchPosts, 1);
  await assert.rejects(guard.generate('gemini', body, { key: originalKey, stage: 'independent_evaluation' }), error => error instanceof BatchPending && error.batchId === durableKey);
  assert.equal(batchPosts, 1, 'accepted re-entry only reports pending');
  assert.equal(ledger.db.prepare('SELECT state,provider_id FROM provider_batches WHERE id=?').get(durableKey).state, 'submitted');

  const reconciled = await native.reconcile(durableKey);
  assert.equal(reconciled.candidates[0].content.parts[0].text, '{"offline":"verified"}');
  assert.equal(polls, 1); assert.equal(ledger.db.prepare('SELECT state FROM provider_batches WHERE id=?').get(durableKey).state, 'complete');
  const saved = await guard.generate('gemini', body, { key: originalKey, stage: 'independent_evaluation' });
  assert.equal(saved.candidates[0].content.parts[0].text, '{"offline":"verified"}');
  assert.equal(batchPosts, 1); assert.equal(polls, 1, 'complete replay uses the exact saved body and receipt');
  const receipt = JSON.parse(ledger.db.prepare('SELECT receipt_json FROM requests WHERE id=(SELECT reservation_id FROM provider_batches WHERE id=?)').get(durableKey).receipt_json);
  assert.deepEqual(receipt.usage, { promptTokenCount: 100, candidatesTokenCount: 20, thoughtsTokenCount: 5 });
  assert.equal(receipt.execution_mode, 'batch');
  assert.equal(ledger.db.prepare('SELECT actual FROM requests WHERE id=(SELECT reservation_id FROM provider_batches WHERE id=?)').get(durableKey).actual, 88);
  assert.equal(ledger.snapshot().unresolved, 0); ledger.close();
});

test('uncertain accepted Gemini keys never resubmit and retain the full request bound', async () => {
  const ledger = openLedger(); let posts = 0;
  const native = createFactoryTransportV713({ ledger, prices, queueGemini: false, env: { GEMINI_API_KEY: 'fixture-only' },
    fetchImpl: async (_url, init = {}) => { if (init.method === 'POST') { posts++; throw Error('connection reset after acceptance'); } throw Error('must not poll without accepted id'); } });
  const guard = createCampaignGuardV713({ ledger, native, campaignId: 'offline-uncertain', candidateIds: ['candidate-2'], capUsd: 3, prices, keys: new Set() });
  const body = bodyFor('candidate-2'), option = { key: 'unknown-outcome', stage: 'independent_evaluation' };
  await assert.rejects(guard.generate('gemini', body, option), /connection reset/);
  const key = hashJSON({ campaign: 'offline-uncertain', parent: option.key });
  assert.equal(posts, 1); assert.equal(ledger.db.prepare('SELECT state,provider_id FROM provider_batches WHERE id=?').get(key).state, 'unresolved');
  const reserved = ledger.db.prepare('SELECT reserved FROM requests WHERE id=(SELECT reservation_id FROM provider_batches WHERE id=?)').get(key).reserved;
  assert.ok(reserved > 0); assert.equal(ledger.snapshot().committed_micro, reserved); assert.equal(ledger.snapshot().unbounded_unresolved, 0);
  await assert.rejects(guard.generate('gemini', body, option), /uncertain_request_never_resubmit/);
  await assert.rejects(native.generate('gemini', body, { ...option, key }), /batch_submission_unresolved/);
  assert.equal(posts, 1); assert.equal(ledger.snapshot().committed_micro, reserved); ledger.close();
});

test('campaign guard replays completed OpenAI receipts and blocks unknown realtime outcomes', async () => {
  const ledger = openLedger(); let posts = 0;
  const native = createFactoryTransportV713({ ledger, prices, realtimeStages: ['authoring'], env: { OPENAI_API_KEY: 'fixture-only' },
    fetchImpl: async (_url, init = {}) => { assert.equal(init.method, 'POST'); posts++;
      return Response.json({ id: 'resp-v713-fixture', output_text: '{"authored":true}', usage: { input_tokens: 100, output_tokens: 20 } }); } });
  const keys = new Set(), guard = createCampaignGuardV713({ ledger, native, campaignId: 'offline-openai', candidateIds: ['candidate-3'], capUsd: 3, prices, keys });
  const body = { model: 'gpt-6-luna', input: [{ role: 'user', content: JSON.stringify({ candidate_id: 'candidate-3' }) }], max_output_tokens: 100 };
  const options = { key: 'authoring-key', stage: 'authoring' };
  assert.equal((await guard.generate('openai', body, options)).output_text, '{"authored":true}');
  assert.equal((await guard.generate('openai', body, options)).output_text, '{"authored":true}');
  assert.equal(posts, 1, 'saved completed realtime receipt replays without provider work'); ledger.close();

  const uncertainLedger = openLedger(); let uncertainPosts = 0;
  const uncertainNative = createFactoryTransportV713({ ledger: uncertainLedger, prices, realtimeStages: ['authoring'], env: { OPENAI_API_KEY: 'fixture-only' },
    fetchImpl: async () => { uncertainPosts++; throw Error('connection reset after request dispatch'); } });
  const uncertain = createCampaignGuardV713({ ledger: uncertainLedger, native: uncertainNative, campaignId: 'offline-openai-unknown',
    candidateIds: ['candidate-4'], capUsd: 3, prices, keys: new Set() });
  const uncertainBody = { ...body, input: [{ role: 'user', content: JSON.stringify({ candidate_id: 'candidate-4' }) }] };
  const uncertainOptions = { key: 'unknown-authoring-key', stage: 'authoring' };
  await assert.rejects(uncertain.generate('openai', uncertainBody, uncertainOptions), /connection reset/);
  await assert.rejects(uncertain.generate('openai', uncertainBody, uncertainOptions), /uncertain_request_never_resubmit/);
  assert.equal(uncertainPosts, 1); assert.equal(uncertainLedger.snapshot().unbounded_unresolved, 0);
  assert.ok(uncertainLedger.snapshot().committed_micro > 0); uncertainLedger.close();
});

test('stop/drain guard blocks before creating a provider request or spending reservation', async () => {
  const ledger = openLedger(); let calls = 0;
  const guard = createCampaignGuardV713({ ledger, native: { generate: async () => { calls++; } }, campaignId: 'offline-stop',
    candidateIds: ['candidate-stop'], capUsd: 3, prices, keys: new Set(), stopRequested: () => true });
  await assert.rejects(guard.generate('gemini', bodyFor('candidate-stop'), { key: 'stopped-before-dispatch', stage: 'independent_evaluation' }), /study_draining_stop/);
  assert.equal(calls, 0); assert.equal(ledger.db.prepare('SELECT COUNT(*) AS n FROM provider_batches').get().n, 0);
  assert.equal(ledger.db.prepare('SELECT COUNT(*) AS n FROM provider_requests').get().n, 0); ledger.close();
});

test('full-body preflight binds exactly 400 stage and bounded-retry rows to registered candidates and byte limits', () => {
  const campaign = { jobs: Array.from({ length: 40 }, (_, i) => ({ id: `candidate-${i}` })) };
  const registration = { contract_hash: 'contract', prompt_hash: 'prompt', campaign_sha256: 'campaign', registry_sha256: 'registry',
    runner_sha256: 'runner', engine_sha256: 'engine', cost_profile: { pricing_hash: 'prices', input_byte_bounds: { 'gpt-6-luna': 33024, 'gemini-3.8-flash': 33024 } } };
  const requests = [];
  for (const job of campaign.jobs) for (const stage of ['authoring', 'blind_solution', 'independent_evaluation', 'explanation_support', 'repair']) {
    const provider = stage === 'independent_evaluation' ? 'gemini' : 'openai';
    for (const [variant, cap] of [['base', 100], ['completion_retry', 200]]) {
      const body = provider === 'openai' ? { candidate_id: job.id, max_output_tokens: cap }
        : { candidate_id: job.id, generationConfig: { maxOutputTokens: cap } };
      const serialized = JSON.stringify(body);
      requests.push({ candidate_id: job.id, stage, variant, provider, request_bytes: Buffer.byteLength(serialized, 'utf8'),
        input_bound_bytes: 33024, body_sha256: createHash('sha256').update(serialized).digest('hex'), body,
        request_key: `${job.id}:${stage}:${variant}`, output_cap: cap });
    }
  }
  const preflight = { ...Object.fromEntries(['contract_hash','prompt_hash','campaign_sha256','registry_sha256','runner_sha256','engine_sha256'].map(k => [k, registration[k]])),
    pricing_hash: 'prices', passed: true, coverage: 'all-five-stages-and-retries', requests };
  assert.equal(requests.length, 400); assert.equal(assertFullBodyPreflightV713(preflight, registration, campaign), true);
  assert.throws(() => assertFullBodyPreflightV713({ ...preflight, requests: requests.slice(1) }, registration, campaign), /preflight_incomplete/);
  assert.throws(() => assertFullBodyPreflightV713({ ...preflight, campaign_sha256: 'stale-campaign' }, registration, campaign), /preflight_binding_mismatch/);
  assert.throws(() => assertFullBodyPreflightV713({ ...preflight, requests: requests.map((row, i) => i === 0 ? { ...row, request_bytes: 33025 } : row) }, registration, campaign), /preflight_request_invalid/);
  assert.throws(() => assertFullBodyPreflightV713({ ...preflight, requests: requests.map((row, i) => i === 0 ? { ...row, body: { ...row.body, max_output_tokens: 999 } } : row) }, registration, campaign), /preflight_body_changed/);
  assert.throws(() => assertFullBodyPreflightV713({ ...preflight, requests: requests.map((row, i) => i === 1 ? { ...row, request_key: requests[0].request_key } : row) }, registration, campaign), /preflight_retry_not_independent_bounded/);
  assert.throws(() => assertFullBodyPreflightV713({ ...preflight, requests: requests.map((row, i) => i === 1 ? { ...row, output_cap: 201 } : row) }, registration, campaign), /preflight_body_changed/);
});

test('V713 execution engine preserves pending batch candidates instead of quarantining them', async () => {
  const candidate = { id: 'pending-candidate', body: 'An offline synthetic item.' };
  const campaign = { id: 'pending-v713', jobs: [{ id: candidate.id, subject: 'English', chapter: 'Reading', state: 'queued' }] };
  const state = expectedFreshState(campaign); let calls = 0;
  const deps = { author: async () => candidate, prepare: value => ({ candidate: value, quote: { passed: true, methods: [] }, notes: [] }),
    validate: async () => { calls++; if (calls === 1) throw new BatchPending('durable-batch-key', 'independent_evaluation');
      return { state: 'eligible', question: candidate }; }, repair: async () => candidate };
  const first = await runPilotV713({ campaign, state, saveState: () => {}, deps, concurrency: 1 });
  assert.equal(first.status, 'pending'); assert.equal(state.jobs[candidate.id].state, 'validating');
  assert.equal(state.jobs[candidate.id].pending_batch, 'durable-batch-key'); assert.equal(state.jobs[candidate.id].result, undefined);
  const resumed = await runPilotV713({ campaign, state, saveState: () => {}, deps, concurrency: 1 });
  assert.equal(resumed.status, 'complete'); assert.equal(state.jobs[candidate.id].state, 'eligible');
  assert.equal(state.jobs[candidate.id].pending_batch, undefined); assert.equal(state.jobs[candidate.id].result.state, 'eligible');
});

test('default V713 transport does not silently fall back after a Flex capacity rejection', async () => {
  const ledger = openLedger(); let calls = 0;
  const transport = createFactoryTransportV713({ ledger, prices, env: { OPENAI_API_KEY: 'fixture-only' }, realtimeStages: ['authoring'], flexStages: ['authoring'],
    fetchImpl: async (_url, init = {}) => { calls++; const request = JSON.parse(init.body); assert.equal(request.service_tier, 'flex');
      return new Response(JSON.stringify({ error: { code: 'resource_unavailable', message: 'Flex capacity unavailable' } }), { status: 429 }); } });
  const body = { model: 'gpt-6-luna', input: [{ role: 'user', content: JSON.stringify({ candidate_id: 'candidate-flex' }) }], max_output_tokens: 100 };
  await assert.rejects(transport.generate('openai', body, { key: 'flex-capacity', stage: 'authoring', candidate_id: 'candidate-flex' }), /provider_http_429/);
  assert.equal(calls, 1); assert.equal(ledger.db.prepare('SELECT state FROM provider_requests WHERE id=?').get('flex-capacity').state, 'flex_unavailable');
  ledger.close();
});

test('actual V713 adapter completion retries double caps, use fresh keys, and reserve both full bounds', async () => {
  const ledger = openLedger(), contract = validationContractV713(), frozen = () => [
    { solver: 'openai', solved_key: 'A', rows: [] }, { solver: 'gemini', solved_key: 'A', rows: [] },
  ];
  const seen = []; let posts = 0;
  const pricesForReservations = () => ({ source_url: 'https://offline.invalid/prices', expires_at: '2099-01-01', models: {
    'gpt-6-luna': { provider_host: 'api.openai.com', max_input_tokens: 33024, input_per_million: 1, output_per_million: 2 },
    'gemini-3.8-flash': { provider_host: 'generativelanguage.googleapis.com', max_input_tokens: 33024, input_per_million: 4, output_per_million: 8,
      batch: { input_per_million: 0.5, output_per_million: 1.5 } },
  } });
  const native = createFactoryTransportV713({ ledger, prices: pricesForReservations, realtimeStages: ['blind_solution','independent_evaluation','explanation_support'],
    env: { OPENAI_API_KEY: 'fixture-only', GEMINI_API_KEY: 'fixture-only' }, fetchImpl: async url => {
      posts++;
      const attempt = posts, content = attempt % 2 ? '{' : '{}';
      return url.includes('openai.com')
        ? Response.json({ id: `retry-openai-${attempt}`, output_text: content, usage: { input_tokens: 5, output_tokens: 2 } })
        : Response.json({ responseId: `retry-gemini-${attempt}`, candidates: [{ finishReason: 'STOP', content: { parts: [{ text: content }] } }],
            usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 2, thoughtsTokenCount: 1 } });
    } });
  const guard = createCampaignGuardV713({ ledger, native, campaignId: 'offline-retry-reservations', candidateIds: ['retry-candidate'], capUsd: 3,
    prices: pricesForReservations, keys: new Set() });
  const transport = { generate(provider, body, options = {}) {
    const adapted = adaptEvaluationRequestV713(provider, body, options, frozen);
    seen.push({ provider, stage: options.stage, cap: provider === 'openai' ? adapted.max_output_tokens : adapted.generationConfig.maxOutputTokens,
      key: hashJSON({ contract, previous_key: options.key, provider, body: adapted }) });
    return guard.generate(provider, adapted, { ...options, key: hashJSON({ contract, previous_key: options.key, provider, body: adapted }) });
  } };
  const user = { candidate_id: 'retry-candidate', content_hash: 'retry-hash', evidence_catalog: [], options: [
    { key: 'A', text: 'Supported' }, { key: 'B', text: 'Wrong' }, { key: 'C', text: 'Wrong' }, { key: 'D', text: 'Wrong' },
  ], proposed_explanation: 'A is supported.', option_resolutions: [] };
  for (const [provider, stage, inheritedCap, base, retry] of [
    ['openai', 'blind_solution', 7500, 16000, 32000],
    ['gemini', 'independent_evaluation', 4500, 6000, 12000],
    ['openai', 'explanation_support', 5000, 8000, 16000],
  ]) {
    const schema = { type: 'object', required: ['option_challenges'], properties: { option_challenges: { type: 'array', items: { type: 'object' } } } };
    const body = provider === 'openai'
      ? { model: 'gpt-6-luna', input: [{ role: 'system', content: 'V7.6 evaluator.' }, { role: 'user', content: JSON.stringify(user) }],
          text: { format: { type: 'json_schema', schema } }, max_output_tokens: inheritedCap }
      : { model: 'gemini-3.8-flash', systemInstruction: { parts: [{ text: 'V7.6 evaluator.' }] },
          contents: [{ role: 'user', parts: [{ text: JSON.stringify(user) }] }],
          generationConfig: { maxOutputTokens: inheritedCap, responseFormat: { text: { schema } } } };
    await completeJSON(transport, provider, body, { candidate_id: 'retry-candidate', stage, key: `base:${stage}` });
    const pair = seen.filter(row => row.stage === stage);
    // The actual transport observes and reserves the adapted request at this seam.
    assert.equal(posts, seen.length);
    assert.deepEqual(pair.map(row => row.cap), [base, retry], stage);
    assert.notEqual(pair[0].key, pair[1].key, `${stage} retry must have a distinct request key`);
  }
  const rows = ledger.db.prepare("SELECT r.reserved,p.request_json FROM requests r JOIN provider_requests p ON p.reservation_id=r.id ORDER BY r.rowid").all();
  assert.equal(rows.length, 6);
  const expected = [16000, 32000, 6000, 12000, 8000, 16000];
  for (let i = 0; i < rows.length; i++) {
    const { config, body } = JSON.parse(rows[i].request_json), price = pricesForReservations().models[config.model];
    const output = config.provider === 'openai' ? body.max_output_tokens : body.generationConfig.maxOutputTokens;
    assert.equal(output, expected[i]);
    const rates = config.rates;
    const full = Math.ceil(price.max_input_tokens * Math.max(rates.input_per_million, rates.cache_write_per_million || 0) + output * rates.output_per_million);
    assert.equal(rows[i].reserved, full, `reservation ${i} must cover its complete retry body and output cap`);
  }
  assert.equal(ledger.snapshot().unresolved, 0); ledger.close();
});
