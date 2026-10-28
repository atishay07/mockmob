import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { createCampaignGuardV713 } from '../lib/campaignGuardV713.mjs';
import { runPilotV713R2 } from '../lib/cuetPilotRunV713R2.mjs';
import { archiveRefusedAttemptsV713R2, capacityRefusedV713R2, restoreCapacityRefusalsV713R2 } from '../lib/providerAvailabilityV713R2.mjs';

const campaignId = 'offline-r2';
const candidateIds = ['capacity-validating', ...Array.from({ length: 6 }, (_, i) => `unknown-${i}`), 'accepted-batch', 'bad-receipt', 'academic-failure'];
const flexError = () => Object.assign(new Error('provider_http_429:Flex processing is temporarily unavailable.'),
  { flexUnavailable: true, rejectedBeforeInference: true });
const requestRow = (id, candidate, state = 'flex_unavailable') => ({ id, provider: 'openai', state,
  reservation_id: `reservation-${id}`, request_json: JSON.stringify({ body: { saved_prompt: 'SENSITIVE-FIXTURE' },
    config: { candidate_id: `${campaignId}:${candidate}`, stage: 'blind_solution' } }) });
const settledReceipt = id => ({ id: `reservation-${id}`, state: 'settled', reserved: 12128, actual: 0,
  receipt_json: JSON.stringify({ provider: 'openai', http_status: 429, type: 'resource_unavailable',
    idempotency_key: id, candidate_id: `${campaignId}:${id === 'valid-refusal' ? 'capacity-validating' : 'bad-receipt'}` }) });
function fakeLedger({ requests = [], providerRequests = [], batches = [] } = {}) {
  const req = new Map(requests.map(row => [row.id, row]));
  const provider = new Map(providerRequests.map(row => [row.id, row]));
  const db = { prepare(sql) {
    if (sql.includes('FROM requests WHERE id=?')) return { get: id => req.get(id) };
    if (sql.includes('FROM provider_requests WHERE id=?')) return { get: id => provider.get(id) };
    if (sql.includes('FROM provider_requests WHERE json_extract')) return { all: id => providerRequests.filter(row => {
      try { return JSON.parse(row.request_json).config.candidate_id === id; } catch { return false; }
    }) };
    if (sql.includes('FROM provider_batches WHERE json_extract')) return { all: id => batches.filter(row => row.candidate_id === id) };
    if (sql.includes('FROM provider_batches WHERE id=?')) return { get: () => undefined };
    throw new Error(`unexpected_fake_query:${sql}`);
  } };
  return { db, requests: req, providerRequests: provider };
}

test('capacity-recovery detector requires both typed Flex refusal flags', () => {
  assert.equal(capacityRefusedV713R2(flexError()), true);
  assert.equal(capacityRefusedV713R2(Object.assign(new Error('429'), { flexUnavailable: true })), false);
  assert.equal(capacityRefusedV713R2(Object.assign(new Error('429'), { rejectedBeforeInference: true })), false);
});

test('restore reopens only ledger-proven settled-zero resource_unavailable refusals', () => {
  const valid = requestRow('valid-refusal', 'capacity-validating');
  const unknownRows = Array.from({ length: 6 }, (_, i) => requestRow(`unknown-key-${i}`, `unknown-${i}`, 'unresolved'));
  const bad = requestRow('bad-refusal', 'bad-receipt');
  const badRequest = settledReceipt('bad-refusal');
  badRequest.receipt_json = JSON.stringify({ provider: 'openai', http_status: 429, type: 'resource_unavailable',
    idempotency_key: 'different-key', candidate_id: `${campaignId}:bad-receipt` });
  const ledger = fakeLedger({
    requests: [settledReceipt('valid-refusal'), badRequest],
    providerRequests: [valid, ...unknownRows, bad],
    batches: [{ candidate_id: `${campaignId}:accepted-batch`, state: 'submitted', provider_id: 'accepted-batch-id' }],
  });
  const job = (id, result) => ({ id, state: 'quarantined', candidate: { body: `saved ${id}` }, repair_count: 0, result });
  const state = { jobs: {
    'capacity-validating': job('capacity-validating', { failed_stage: 'validating', reasons: ['provider_http_429:resource_unavailable'] }),
    ...Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`unknown-${i}`, job(`unknown-${i}`, { failed_stage: 'validating', reasons: ['provider_http_429:network_unknown'] })])),
    'accepted-batch': job('accepted-batch', { failed_stage: 'validating', reasons: ['provider_http_429:resource_unavailable'] }),
    'bad-receipt': job('bad-receipt', { failed_stage: 'validating', reasons: ['provider_http_429:resource_unavailable'] }),
    'academic-failure': job('academic-failure', { failed_stage: 'validating', reasons: ['failed:source_support'] }),
  } };
  const changes = restoreCapacityRefusalsV713R2(state, { ledger, campaignId });
  assert.equal(changes.length, 1);
  assert.equal(state.jobs['capacity-validating'].state, 'generated');
  assert.equal(state.jobs['capacity-validating'].repair_count, 0);
  assert.equal(state.jobs['capacity-validating'].result, undefined);
  assert.equal(state.jobs['capacity-validating'].transport_outcome_history[0].result.failed_stage, 'validating');
  assert.deepEqual(state.jobs['capacity-validating'].transport_outcome_history[0].request_keys, ['valid-refusal']);
  for (const id of ['unknown-0', 'unknown-1', 'unknown-2', 'unknown-3', 'unknown-4', 'unknown-5', 'accepted-batch', 'bad-receipt', 'academic-failure'])
    assert.equal(state.jobs[id].state, 'quarantined', `${id} must not be reopened`);
});

test('refused-attempt archive preserves the entire full-body request and settled receipt before native retry', async () => {
  const root = mkdtempSync(join(tmpdir(), 'v713-r2-archive-'));
  try {
    const row = requestRow('refused-key', 'candidate-1');
    const ledger = fakeLedger({ requests: [settledReceipt('refused-key')], providerRequests: [row] });
    let calls = 0;
    const native = { async generate() { calls++; row.state = 'complete'; return { output_text: '{"ok":true}' }; } };
    const wrapped = archiveRefusedAttemptsV713R2(native, { ledger, directory: join(root, 'attempts') });
    const response = await wrapped.generate('openai', { input: 'same request' }, { key: 'refused-key' });
    assert.deepEqual(response, { output_text: '{"ok":true}' });
    assert.equal(calls, 1);
    const files = readdirSync(join(root, 'attempts'));
    assert.equal(files.length, 1);
    const archived = JSON.parse(readFileSync(join(root, 'attempts', files[0]), 'utf8'));
    assert.match(archived.provider_request.request_json, /SENSITIVE-FIXTURE/);
    assert.equal(JSON.parse(archived.reservation.receipt_json).idempotency_key, 'refused-key');
    // Once native has replaced the retryable row with a complete row, normal saved-response replay is delegated unchanged.
    await wrapped.generate('openai', { input: 'same request' }, { key: 'refused-key' });
    assert.equal(calls, 2);
    assert.equal(readdirSync(join(root, 'attempts')).length, 1);
  } finally {
    const rootPath = resolve(root), tempPath = resolve(tmpdir());
    assert.ok(rootPath.startsWith(tempPath + sep), 'test cleanup must stay inside the OS temp directory');
    rmSync(rootPath, { recursive: true, force: true });
  }
});

test('archive refuses a Flex row unless its settled zero-cost typed receipt is proven', async () => {
  const root = mkdtempSync(join(tmpdir(), 'v713-r2-invalid-archive-'));
  try {
    const row = requestRow('refused-key', 'candidate-1');
    const request = settledReceipt('refused-key');
    request.receipt_json = JSON.stringify({ provider: 'openai', http_status: 429, type: 'resource_unavailable', idempotency_key: 'other' });
    const ledger = fakeLedger({ requests: [request], providerRequests: [row] });
    let calls = 0;
    const wrapped = archiveRefusedAttemptsV713R2({ async generate() { calls++; } }, { ledger, directory: join(root, 'attempts') });
    await assert.rejects(wrapped.generate('openai', {}, { key: 'refused-key' }), /refused_attempt_receipt_not_established/);
    assert.equal(calls, 0);
    assert.equal(readdirSync(root).length, 0);
  } finally {
    const rootPath = resolve(root), tempPath = resolve(tmpdir());
    assert.ok(rootPath.startsWith(tempPath + sep), 'test cleanup must stay inside the OS temp directory');
    rmSync(rootPath, { recursive: true, force: true });
  }
});

test('campaign guard blocks the six unknown realtime keys without calling native transport', async () => {
  const ids = Array.from({ length: 6 }, (_, i) => `unknown-${i}`), parentKeys = ids.map((_, i) => `saved-blind-request-${i}`);
  const { hashJSON } = await import('../../../data/question_factory_policy.mjs');
  const keys = parentKeys.map(parent => hashJSON({ campaign: campaignId, parent }));
  const ledger = fakeLedger({ providerRequests: keys.map(id => ({ id, state: 'unresolved' })) });
  let calls = 0;
  const guard = createCampaignGuardV713({ ledger, native: { async generate() { calls++; } }, campaignId,
    candidateIds: ids, capUsd: 3, prices: () => ({}), keys: new Set(keys) });
  for (const [index, id] of ids.entries()) {
    const body = { tools: [], input: [{ role: 'user', content: JSON.stringify({ candidate_id: id }) }] };
    await assert.rejects(guard.generate('openai', body, { key: parentKeys[index], stage: 'blind_solution' }), /v713_uncertain_request_never_resubmit/);
  }
  assert.equal(calls, 0);
});

for (const mode of ['authoring', 'validation', 'repair']) {
  test(`R2 engine pauses at the exact ${mode} stage after a typed Flex refusal`, async () => {
    const jobs = Array.from({ length: 40 }, (_, i) => ({ id: `candidate-${i}`, subject: ['english', 'accountancy', 'business_studies', 'economics'][Math.floor(i / 10)],
      chapter: 'Test chapter', state: 'queued', repair_count: 0 }));
    const campaign = { id: campaignId, jobs };
    const state = { jobs: Object.fromEntries(jobs.map(j => [j.id, { ...j, candidate: null }])), waves: [], weak_waves: 0,
      circuit_open: false, systemic_errors: 0, request_keys: [], stop_reason: null, runs: [] };
    const first = state.jobs['candidate-0'];
    if (mode === 'validation') {
      first.state = 'generated'; first.candidate = { id: first.id, body: 'Saved candidate body.' };
    } else if (mode === 'repair') {
      first.state = 'repair_started'; first.repair_count = 1; first.candidate = { id: first.id, body: 'Saved repaired candidate.' };
      first.first_result = { reasons: ['failed:source_support'] };
    }
    let calls = 0;
    const deps = {
      async author() { calls++; if (mode === 'authoring') throw flexError(); throw new Error('unexpected_author'); },
      prepare(candidate) { return { candidate, notes: [], quote: { passed: true, methods: [] } }; },
      async validate() { calls++; if (mode === 'validation') throw flexError(); throw new Error('unexpected_validate'); },
      async repair() { calls++; if (mode === 'repair') throw flexError(); throw new Error('unexpected_repair'); },
    };
    const result = await runPilotV713R2({ campaign, state, saveState() {}, deps, concurrency: 1 });
    assert.equal(result.status, 'stopped');
    assert.equal(calls, 1);
    assert.equal(first.state, mode === 'authoring' ? 'authoring' : mode === 'validation' ? 'validating' : 'repair_started');
    assert.equal(first.last_stop, 'provider_http_429:Flex processing is temporarily unavailable.');
    assert.equal(first.repair_count, mode === 'repair' ? 1 : 0);
    assert.equal(first.result, undefined);
    assert.equal(state.jobs['candidate-1'].state, 'queued');
    assert.equal(state.jobs['candidate-39'].state, 'queued');
    assert.equal(state.waves.length, 0);
  });
}

test('R2 runner fails closed if a delta-bound execution source changes', () => {
  const target = 'scripts/pipeline/lib/providerAvailabilityV713R2.mjs';
  const deltaPath = 'artifacts/question-factory/cuet-readiness-2026-10-09/execution/final-pass-v713/EXECUTION-CORRECTION-R2.json';
  const delta = JSON.parse(readFileSync(deltaPath, 'utf8'));
  const original = readFileSync(target), expectedHash = delta.files[target];
  assert.equal(createHash('sha256').update(original).digest('hex'), expectedHash);
  try {
    writeFileSync(target, Buffer.concat([original, Buffer.from('\n// offline tamper probe\n')]));
    assert.throws(() => execFileSync(process.execPath,
      ['--use-system-ca', 'scripts/pipeline/tools/runFinalGeneratorV713R2.mjs', 'report'],
      { encoding: 'utf8', cwd: process.cwd() }), error => /execution_delta_file_changed:scripts\/pipeline\/lib\/providerAvailabilityV713R2\.mjs/.test(`${error.stdout || ''}${error.stderr || ''}`));
  } finally {
    writeFileSync(target, original);
  }
  assert.equal(createHash('sha256').update(readFileSync(target)).digest('hex'), expectedHash);
});
