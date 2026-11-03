import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BudgetLedger } from '../lib/budgetLedger.mjs';
import { BatchPending, FACTORY_MODELS, createFactoryTransport } from '../lib/factoryTransport.mjs';

const ledgerAt = () => join(mkdtempSync(join(tmpdir(), 'mm-scoped-flush-')), 'budget.sqlite');
const prices = () => ({
  source_url: 'https://provider.test/pricing-v1', expires_at: '2099-01-01T00:00:00.000Z',
  models: {
    'gpt-6-luna': { provider_host: 'api.openai.com', max_input_tokens: 5000, input_per_million: 0.1, output_per_million: 0.5, batch: { input_per_million: 0.05, output_per_million: 0.25 } },
    'gemini-3.8-flash': { provider_host: 'generativelanguage.googleapis.com', max_input_tokens: 5000, input_per_million: 1, output_per_million: 3, batch: { input_per_million: 0.5, output_per_million: 2 } },
  },
});
const openaiBody = id => ({ model: FACTORY_MODELS.openai, max_output_tokens: 100, input: [{ role: 'user', content: JSON.stringify({ candidate_id: id, task: 'mock' }) }] });
const geminiBody = id => ({ generationConfig: { maxOutputTokens: 100 }, contents: [{ parts: [{ text: JSON.stringify({ candidate_id: id, task: 'mock' }) }] }] });
const createLedger = () => {
  const ledger = new BudgetLedger(ledgerAt());
  ledger.reconcileHistory({ spent_usd: 0, basis: 'Isolated offline transport test fixture; no provider spend.', confirmed_at: new Date().toISOString() });
  return ledger;
};
const createQueuedTransport = (ledger, fetchImpl) => createFactoryTransport({
  ledger, fetchImpl, prices, env: { OPENAI_API_KEY: 'fixture', GEMINI_API_KEY: 'fixture' }, queueOpenAI: true, queueGemini: true,
});
const queue = async (transport, provider, id, key) => {
  await assert.rejects(transport.generate(provider, provider === 'openai' ? openaiBody(id) : geminiBody(id), {
    key, stage: 'blind_solution', candidate_id: id,
  }), BatchPending);
};

test('scoped flush dispatches matching saved identities and leaves foreign queued requests unchanged', async () => {
  const ledger = createLedger();
  const sent = { openai: [], gemini: [] };
  const fetchImpl = async (url, init = {}) => {
    if (url.endsWith('/v1/files')) {
      const payload = await init.body.get('file').text();
      sent.openai.push(...payload.trim().split('\n').map(line => JSON.parse(line).custom_id));
      return Response.json({ id: 'file_scoped' });
    }
    if (url.endsWith('/v1/batches')) return Response.json({ id: 'batch_scoped' });
    if (url.endsWith(':batchGenerateContent')) {
      const requests = JSON.parse(init.body).batch.inputConfig.requests.requests;
      sent.gemini.push(...requests.map(row => row.metadata.key));
      return Response.json({ name: 'batches/scoped' });
    }
    throw new Error(`unexpected mock URL: ${url}`);
  };
  const transport = createQueuedTransport(ledger, fetchImpl);
  try {
    await queue(transport, 'openai', 'target-openai', 'oa-target');
    await queue(transport, 'openai', 'historical-openai', 'oa-foreign');
    await queue(transport, 'gemini', 'target-gemini', 'gem-target');
    await queue(transport, 'gemini', 'study-gemini', 'gem-foreign');
    const result = await transport.flush({ candidateIds: ['target-openai', 'target-gemini'], maxRequests: 10 });
    assert.deepEqual(result.submissions.map(row => row.requests), [1, 1]);
    assert.deepEqual(sent.openai, ['oa-target']);
    assert.deepEqual(sent.gemini, ['gem-target']);
    for (const id of ['oa-foreign', 'gem-foreign']) {
      assert.equal(ledger.db.prepare('SELECT state FROM provider_batches WHERE id=?').get(id).state, 'queued');
    }
    for (const id of ['oa-target', 'gem-target']) {
      assert.equal(ledger.db.prepare('SELECT state FROM provider_batches WHERE id=?').get(id).state, 'submitted');
    }
  } finally { ledger.close(); }
});

test('maxRequests is a total cross-provider wave bound, not a per-provider bound', async () => {
  const ledger = createLedger();
  const sent = { openai: [], gemini: [] };
  const fetchImpl = async (url, init = {}) => {
    if (url.endsWith('/v1/files')) {
      const payload = await init.body.get('file').text();
      sent.openai.push(...payload.trim().split('\n').map(line => JSON.parse(line).custom_id));
      return Response.json({ id: 'file_bounded' });
    }
    if (url.endsWith('/v1/batches')) return Response.json({ id: 'batch_bounded' });
    if (url.endsWith(':batchGenerateContent')) {
      const requests = JSON.parse(init.body).batch.inputConfig.requests.requests;
      sent.gemini.push(...requests.map(row => row.metadata.key));
      return Response.json({ name: 'batches/bounded' });
    }
    throw new Error(`unexpected mock URL: ${url}`);
  };
  const transport = createQueuedTransport(ledger, fetchImpl);
  try {
    for (let i = 0; i < 6; i++) {
      await queue(transport, 'gemini', `candidate-${i}`, `g${String(i).padStart(2, '0')}`);
      await queue(transport, 'openai', `candidate-${i}`, `o${String(i).padStart(2, '0')}`);
    }
    const candidateIds = Array.from({ length: 6 }, (_, i) => `candidate-${i}`);
    const result = await transport.flush({ candidateIds, maxRequests: 10 });
    assert.equal(result.submissions.reduce((n, row) => n + row.requests, 0), 10);
    assert.equal(sent.gemini.length + sent.openai.length, 10);
    assert.deepEqual(sent.gemini, ['g00', 'g01', 'g02', 'g03', 'g04', 'g05']);
    assert.deepEqual(sent.openai, ['o00', 'o01', 'o02', 'o03']);
    assert.equal(ledger.db.prepare("SELECT COUNT(*) n FROM provider_batches WHERE state='queued'").get().n, 2);
    assert.equal(ledger.db.prepare("SELECT COUNT(*) n FROM provider_batches WHERE state='submitted'").get().n, 10);
  } finally { ledger.close(); }
});

test('scope rejects invalid candidate lists and request bounds before touching queued rows', async () => {
  const ledger = createLedger();
  const transport = createQueuedTransport(ledger, async () => { throw new Error('must not dispatch'); });
  try {
    await queue(transport, 'openai', 'candidate-0', 'oa-0');
    for (const scope of [
      {}, { candidateIds: [], maxRequests: 1 }, { candidateIds: ['x', 'x'], maxRequests: 1 },
      { candidateIds: ['x'], maxRequests: 0 }, { candidateIds: ['x'], maxRequests: 11 },
      { candidateIds: ['x'], maxRequests: 1, unrecognized: true },
    ]) await assert.rejects(transport.flush(scope), /invalid_flush_scope/);
    assert.equal(ledger.db.prepare("SELECT state FROM provider_batches WHERE id='oa-0'").get().state, 'queued');
  } finally { ledger.close(); }
});

test('accepted batch IDs survive restart and scoped flush never resubmits them', async () => {
  const path = ledgerAt();
  let ledger = new BudgetLedger(path), calls = 0;
  ledger.reconcileHistory({ spent_usd: 0, basis: 'Isolated offline transport test fixture; no provider spend.', confirmed_at: new Date().toISOString() });
  const first = createQueuedTransport(ledger, async (url, init = {}) => {
    calls++;
    if (url.endsWith('/v1/files')) return Response.json({ id: 'file_accepted' });
    if (url.endsWith('/v1/batches')) return Response.json({ id: 'batch_accepted' });
    throw new Error(`unexpected mock URL: ${url}`);
  });
  try {
    await queue(first, 'openai', 'new-candidate', 'accepted-key');
    await first.flush({ candidateIds: ['new-candidate'], maxRequests: 10 });
    assert.equal(calls, 2);
    assert.equal(ledger.db.prepare("SELECT provider_id,state FROM provider_batches WHERE id='accepted-key'").get().state, 'submitted');
  } finally { ledger.close(); }

  ledger = new BudgetLedger(path);
  const afterRestart = createQueuedTransport(ledger, async () => { calls++; throw new Error('accepted request must never be resubmitted'); });
  try {
    assert.deepEqual(await afterRestart.flush({ candidateIds: ['new-candidate'], maxRequests: 10 }), { submissions: [] });
    assert.equal(calls, 2);
    const accepted = ledger.db.prepare("SELECT provider_id,state FROM provider_batches WHERE id='accepted-key'").get();
    assert.equal(accepted.provider_id, 'batch_accepted');
    assert.equal(accepted.state, 'submitted');
  } finally { ledger.close(); }
});
