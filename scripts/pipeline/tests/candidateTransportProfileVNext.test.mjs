import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BudgetLedger } from '../lib/budgetLedger.mjs';
import { BatchPending, FACTORY_MODELS, createFactoryTransport } from '../lib/factoryTransport.mjs';
import {
  C_TRANSPORT_PROFILE_VNEXT_HASH,
  C_TRANSPORT_PROFILE_VNEXT,
  createCandidateTransportProfileVNext
} from '../lib/candidateTransportProfileVNext.mjs';
import { maximumRequestMicro } from '../lib/campaignExecutionV7.mjs';

const ledgerAt = () => join(mkdtempSync(join(tmpdir(), 'mm-c-transport-')), 'budget.sqlite');
const prices = () => ({
  source_url: 'https://provider.test/pricing-v1',
  expires_at: '2099-01-01T00:00:00.000Z',
  models: {
    'gpt-6-luna': {
      provider_host: 'api.openai.com', max_input_tokens: 1000,
      input_per_million: 0.1, output_per_million: 0.5,
      flex: { input_per_million: 0.05, output_per_million: 0.25 },
      batch: { input_per_million: 0.05, output_per_million: 0.25 }
    },
    'gemini-3.8-flash': {
      provider_host: 'generativelanguage.googleapis.com', max_input_tokens: 1000,
      input_per_million: 1, output_per_million: 3,
      batch: { input_per_million: 0.5, output_per_million: 2 }
    }
  }
});
const makeTransport = (ledger, opts = {}) => createCandidateTransportProfileVNext({
  ledger,
  profileName: C_TRANSPORT_PROFILE_VNEXT.policy_name,
  profileHash: C_TRANSPORT_PROFILE_VNEXT_HASH,
  candidateIds: opts.candidateIds || Array.from({ length: 20 }, (_, i) => `candidate-${i}`),
  phaseCapUsd: opts.phaseCapUsd ?? 0.02,
  fetchImpl: opts.fetchImpl || (async () => { throw new Error('unexpected_provider_call'); }),
  prices: opts.prices || prices,
  env: { OPENAI_API_KEY: 'fixture', GEMINI_API_KEY: 'fixture' },
  now: opts.now
});
const lunaBody = id => ({
  model: FACTORY_MODELS.openai,
  max_output_tokens: 100,
  input: [{ role: 'user', content: JSON.stringify({ candidate_id: id, task: 'fixture' }) }]
});
const geminiBody = id => ({
  generationConfig: { maxOutputTokens: 100 },
  contents: [{ parts: [{ text: JSON.stringify({ candidate_id: id, task: 'fixture' }) }] }]
});
const expectedBatch = (ledger, key) => ledger.db.prepare('SELECT * FROM provider_batches WHERE id=?').get(key);

test('profile identity is exact and unsupported mode/provider overrides cannot dispatch', async () => {
  const ledger = new BudgetLedger(ledgerAt());
  try {
    ledger.reconcileHistory({ spent_usd: 0, basis: 'Isolated software transport test fixture; no provider spend.', confirmed_at: new Date().toISOString() });
    assert.throws(() => createCandidateTransportProfileVNext({
      ledger, profileName: C_TRANSPORT_PROFILE_VNEXT.policy_name, profileHash: 'wrong',
      candidateIds: ['candidate-0'], phaseCapUsd: 1
    }), /transport_profile_identity_mismatch/);
    const t = makeTransport(ledger);
    await assert.rejects(t.generate('anthropic', {}, { key: 'bad-provider', candidate_id: 'candidate-0' }), /transport_profile_provider_unsupported/);
    await assert.rejects(t.generate('gemini', geminiBody('candidate-0'), { key: 'bad-mode', mode: 'realtime', candidate_id: 'candidate-0' }), /transport_profile_mode_mismatch/);
    await assert.rejects(t.generate('openai', lunaBody('candidate-0'), { key: 'bad-luna-mode', mode: 'batch', candidate_id: 'candidate-0' }), /transport_profile_mode_mismatch/);
    await assert.rejects(t.generate('openai', lunaBody('outside'), { key: 'bad-scope', candidate_id: 'outside' }), /transport_profile_candidate_outside_campaign/);
    await assert.rejects(t.generate('openai', lunaBody('candidate-1'), { key: 'bad-body-scope', candidate_id: 'candidate-0' }), /transport_profile_candidate_body_mismatch/);
    assert.equal(ledger.db.prepare('SELECT COUNT(*) n FROM provider_requests').get().n, 0);
    assert.equal(ledger.db.prepare('SELECT COUNT(*) n FROM provider_batches').get().n, 0);
  } finally { ledger.close(); }
});

test('Luna uses realtime flex with a standard-priced conservative reservation and replays saved content without dispatch', async () => {
  const ledger = new BudgetLedger(ledgerAt());
  ledger.reconcileHistory({ spent_usd: 0, basis: 'Isolated software transport test fixture; no provider spend.', confirmed_at: new Date().toISOString() });
  let posts = 0, sentBody, priceReads = 0;
  const t = makeTransport(ledger, {
    prices: () => {
      priceReads++;
      const snapshot = prices();
      if (priceReads > 1) snapshot.models['gpt-6-luna'].input_per_million = 99;
      return snapshot;
    },
    fetchImpl: async (url, init) => {
    posts++;
    assert.ok(url.endsWith('/v1/responses'));
    sentBody = JSON.parse(init.body);
    return Response.json({
      id: 'resp-flex-fixture', service_tier: 'flex', output_text: '{"answer":"ok"}',
      usage: { input_tokens: 20, output_tokens: 10 }
    });
  } });
  const body = lunaBody('candidate-0');
  try {
    const result = await t.generate('openai', body, { key: 'luna-realtime', stage: 'blind_solution', candidate_id: 'candidate-0' });
    assert.equal(result.id, 'resp-flex-fixture');
    assert.equal(posts, 1);
    assert.equal(sentBody.service_tier, 'flex');
    assert.equal(priceReads, 1, 'phase maximum and transport reservation use the same dispatch-time price snapshot');
    const req = ledger.db.prepare('SELECT * FROM provider_requests WHERE id=?').get('luna-realtime');
    const saved = JSON.parse(req.request_json);
    const reserved = ledger.db.prepare('SELECT reserved,actual,state FROM requests WHERE id=?').get(req.reservation_id);
    assert.equal(saved.config.execution_mode, 'realtime');
    assert.equal(reserved.reserved, maximumRequestMicro('openai', sentBody, prices(), { batch: false }));
    assert.equal(reserved.state, 'settled');
    assert.ok(reserved.actual <= reserved.reserved);
    assert.deepEqual(JSON.parse(req.response_json), result);

    // An explicit different mode on a completed key must replay the saved
    // realtime config and receipt; it must neither dispatch nor charge again.
    const replay = await t.generate('openai', body, { key: 'luna-realtime', mode: 'batch', candidate_id: 'candidate-0' });
    assert.deepEqual(replay, result);
    assert.equal(posts, 1);
    assert.equal(ledger.db.prepare('SELECT COUNT(*) n FROM provider_requests').get().n, 1);
    const changedBody = lunaBody('candidate-0');
    changedBody.input[0].content = JSON.stringify({ candidate_id: 'candidate-0', task: 'changed content' });
    await assert.rejects(t.generate('openai', changedBody, { key: 'luna-realtime', candidate_id: 'candidate-0' }), /saved_request_content_mismatch/);
    ledger.db.prepare('UPDATE requests SET reserved=reserved+1 WHERE id=?').run(req.reservation_id);
    await assert.rejects(t.generate('openai', body, { key: 'luna-realtime', candidate_id: 'candidate-0' }), /saved_request_reservation_mismatch/);
    assert.equal(posts, 1, 'mismatched saved body or reservation cannot reach provider');
  } finally { ledger.close(); }
});

test('flex-capacity fallback reuses the same dispatch-time price snapshot and remains inside the phase maximum', async () => {
  const ledger = new BudgetLedger(ledgerAt());
  ledger.reconcileHistory({ spent_usd: 0, basis: 'Isolated software transport test fixture; no provider spend.', confirmed_at: new Date().toISOString() });
  let priceReads = 0, requests = 0;
  const t = makeTransport(ledger, {
    candidateIds: ['candidate-0'], phaseCapUsd: 0.00015,
    prices: () => {
      priceReads++;
      const snapshot = prices();
      if (priceReads > 1) snapshot.models['gpt-6-luna'].input_per_million = 99;
      return snapshot;
    },
    fetchImpl: async (_url, init) => {
      requests++;
      const sent = JSON.parse(init.body);
      if (sent.service_tier === 'flex') {
        return Response.json({ error: { code: 'RESOURCE_UNAVAILABLE', message: 'Resource unavailable' } }, { status: 429 });
      }
      return Response.json({ id: 'standard-fallback', service_tier: 'standard', output_text: '{"ok":true}', usage: { input_tokens: 10, output_tokens: 5 } });
    }
  });
  try {
    const result = await t.generate('openai', lunaBody('candidate-0'), { key: 'flex-fallback', stage: 'blind_solution', candidate_id: 'candidate-0' });
    assert.equal(result.id, 'standard-fallback');
    assert.equal(requests, 2);
    assert.equal(priceReads, 1, 'flex and standard retry use one exact policy price snapshot');
    const rows = ledger.db.prepare("SELECT reserved,actual,state FROM requests WHERE id<>'historical-content-spend' ORDER BY rowid").all();
    assert.equal(rows.length, 2);
    assert.equal(rows[0].reserved, 150);
    assert.equal(rows[0].actual, 0);
    assert.equal(rows[0].state, 'settled');
    assert.equal(rows[1].reserved, 150);
    assert.ok(rows[1].actual <= rows[1].reserved);
    assert.equal(ledger.snapshot().unresolved, 0);
  } finally { ledger.close(); }
});

test('Gemini batches at most one ten-item wave, preserves original prices over restart, and replays saved receipts without reposting', async () => {
  const path = ledgerAt();
  let ledger = new BudgetLedger(path), submissions = 0, requestsInBatch = 0, polls = 0;
  ledger.reconcileHistory({ spent_usd: 0, basis: 'Isolated software transport test fixture; no provider spend.', confirmed_at: new Date().toISOString() });
  const ids = Array.from({ length: 10 }, (_, i) => `candidate-${i}`);
  const t = makeTransport(ledger, { candidateIds: ids, phaseCapUsd: 0.007, fetchImpl: async (url, init = {}) => {
    if (url.endsWith(':batchGenerateContent')) {
      submissions++;
      const input = JSON.parse(init.body).batch.inputConfig.requests.requests;
      requestsInBatch = input.length;
      assert.equal(requestsInBatch, 10);
      return Response.json({ name: 'batches/c-wave10-fixture' });
    }
    throw new Error(`unexpected first-pass request ${url}`);
  } });
  try {
    for (let i = 0; i < ids.length; i++) {
      const options = { key: `gem-${i}`, stage: 'blind_solution', mode: 'native_batch', ...(i ? { candidate_id: ids[i] } : {}) };
      await assert.rejects(t.generate('gemini', geminiBody(ids[i]), {
        ...options
      }), BatchPending);
      const row = expectedBatch(ledger, `gem-${i}`);
      const saved = JSON.parse(row.request_json);
      assert.equal(saved.config.candidate_id, ids[i], 'candidate scope can be recovered from the exact structured request');
      assert.equal(saved.config.execution_mode, 'batch');
      const request = ledger.db.prepare('SELECT reserved FROM requests WHERE id=?').get(row.reservation_id);
      assert.equal(request.reserved, maximumRequestMicro('gemini', geminiBody(ids[i]), prices(), { batch: true }));
    }
    assert.deepEqual(await t.flush(), { provider_id: 'batches/c-wave10-fixture', requests: 10 });
    assert.equal(submissions, 1);
    assert.equal(requestsInBatch, 10);
    assert.equal(ledger.snapshot().unresolved, 0);
  } finally { ledger.close(); }

  // New verified prices deliberately differ. Receipt collection after restart
  // must settle from each saved request's dispatch-time config and rates.
  ledger = new BudgetLedger(path);
  const changedPrices = () => {
    const p = prices();
    p.source_url = 'https://provider.test/pricing-v2';
    p.models['gemini-3.8-flash'].batch = { input_per_million: 90, output_per_million: 120 };
    return p;
  };
  const afterRestart = makeTransport(ledger, {
    candidateIds: ids,
    phaseCapUsd: 0.007,
    prices: changedPrices,
    fetchImpl: async url => {
      polls++;
      assert.ok(url.endsWith('/v1beta/batches/c-wave10-fixture'));
      return Response.json({
        done: true,
        metadata: { state: 'JOB_STATE_SUCCEEDED' },
        response: { inlinedResponses: ids.map((id, i) => ({
          metadata: { key: `gem-${i}` },
          response: {
            responseId: `gem-response-${i}`,
            usageMetadata: { promptTokenCount: 20, candidatesTokenCount: 5, thoughtsTokenCount: 2 },
            candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ id }) }] } }]
          }
        })) }
      });
    }
  });
  try {
    for (let i = 0; i < ids.length; i++) {
      const result = await afterRestart.reconcile(`gem-${i}`);
      assert.equal(result.responseId, `gem-response-${i}`);
      const batchRow = expectedBatch(ledger, `gem-${i}`);
      const saved = JSON.parse(batchRow.request_json);
      const request = ledger.db.prepare('SELECT reserved,actual,state,receipt_json FROM requests WHERE id=?').get(batchRow.reservation_id);
      assert.equal(saved.config.pricing.source_url, 'https://provider.test/pricing-v1');
      assert.equal(saved.config.rates.input_per_million, 0.5);
      assert.equal(request.state, 'settled');
      assert.ok(request.actual <= request.reserved);
      assert.equal(JSON.parse(request.receipt_json).source_url, 'https://provider.test/pricing-v1');
    }
    assert.equal(polls, 1, 'terminal batch result is reused while item receipts settle individually');
    assert.equal(ledger.snapshot().unresolved, 0);
    const savedBody = geminiBody(ids[0]);
    const replay = await afterRestart.generate('gemini', savedBody, { key: 'gem-0', mode: 'realtime', candidate_id: ids[0] });
    assert.equal(replay.responseId, 'gem-response-0');
    assert.equal(polls, 1);
    assert.equal(submissions, 1, 'restart and alternate-mode replay never resubmit the accepted batch');
  } finally { ledger.close(); }
});

test('phase cap blocks on the conservative next-request maximum and includes a concurrent in-flight hold', async () => {
  const ledger = new BudgetLedger(ledgerAt());
  ledger.reconcileHistory({ spent_usd: 0, basis: 'Isolated software transport test fixture; no provider spend.', confirmed_at: new Date().toISOString() });
  let completeFetch, enteredFetch;
  const entered = new Promise(resolve => { enteredFetch = resolve; });
  const t = makeTransport(ledger, {
    candidateIds: ['candidate-0', 'candidate-1'], phaseCapUsd: 0.00015,
    fetchImpl: async () => {
      enteredFetch();
      return new Promise(resolve => { completeFetch = resolve; });
    }
  });
  try {
    const first = t.generate('openai', lunaBody('candidate-0'), { key: 'cap-first', stage: 'blind_solution', candidate_id: 'candidate-0' });
    await entered;
    await assert.rejects(t.generate('openai', lunaBody('candidate-1'), { key: 'cap-second', stage: 'blind_solution', candidate_id: 'candidate-1' }), /campaign_budget_exhausted/);
    assert.equal(ledger.db.prepare('SELECT COUNT(*) n FROM provider_requests').get().n, 1);
    const request = ledger.db.prepare("SELECT r.reserved,r.state,pr.request_json FROM requests r JOIN provider_requests pr ON pr.reservation_id=r.id WHERE pr.id='cap-first'").get();
    assert.equal(request.state, 'reserved');
    assert.equal(request.reserved, 150);
    assert.equal(JSON.parse(request.request_json).config.execution_mode, 'realtime');
    completeFetch(Response.json({ id: 'cap-response', service_tier: 'standard', output_text: '{"ok":true}', usage: { input_tokens: 10, output_tokens: 5 } }));
    await first;
    assert.equal(ledger.db.prepare('SELECT COUNT(*) n FROM provider_requests').get().n, 1);
    assert.equal(ledger.snapshot().unresolved, 0);
  } finally { ledger.close(); }
});

test('flush refuses more than ten queued Gemini requests and does not consume any provider call', async () => {
  const ledger = new BudgetLedger(ledgerAt());
  ledger.reconcileHistory({ spent_usd: 0, basis: 'Isolated software transport test fixture; no provider spend.', confirmed_at: new Date().toISOString() });
  let calls = 0;
  const ids = Array.from({ length: 11 }, (_, i) => `candidate-${i}`);
  const t = makeTransport(ledger, { candidateIds: ids, phaseCapUsd: 0.008, fetchImpl: async () => { calls++; throw new Error('must not dispatch'); } });
  try {
    for (let i = 0; i < ids.length; i++) {
      await assert.rejects(t.generate('gemini', geminiBody(ids[i]), { key: `overflow-${i}`, candidate_id: ids[i] }), BatchPending);
    }
    await assert.rejects(t.flush(), /transport_profile_wave_size_exceeded/);
    assert.equal(calls, 0);
    assert.equal(ledger.db.prepare("SELECT COUNT(*) n FROM provider_batches WHERE provider='gemini' AND state='queued'").get().n, 11);
  } finally { ledger.close(); }
});

test('flush refuses an unrelated queued OpenAI batch instead of dispatching it through the Gemini delegate', async () => {
  const ledger = new BudgetLedger(ledgerAt());
  ledger.reconcileHistory({ spent_usd: 0, basis: 'Isolated software transport test fixture; no provider spend.', confirmed_at: new Date().toISOString() });
  let calls = 0;
  const fetchImpl = async () => { calls++; throw new Error('must not dispatch unrelated provider queue'); };
  const t = makeTransport(ledger, { fetchImpl });
  const oldMode = createFactoryTransport({ ledger, queueOpenAI: true, fetchImpl, prices, env: { OPENAI_API_KEY: 'fixture' } });
  try {
    await assert.rejects(oldMode.generate('openai', lunaBody('candidate-0'), { key: 'saved-openai-batch', stage: 'blind_solution', candidate_id: 'candidate-0' }), BatchPending);
    await assert.rejects(t.flush(), /queued_openai_batch_requires_original_profile_recovery/);
    assert.equal(calls, 0);
    assert.equal(ledger.db.prepare("SELECT state FROM provider_batches WHERE id='saved-openai-batch'").get().state, 'queued');
  } finally { ledger.close(); }
});
