import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hashJSON } from '../../../data/question_factory_policy.mjs';
import { createCampaignGuardV713 } from '../lib/campaignGuardV713.mjs';
import { BatchPending } from '../lib/factoryTransportV713.mjs';
import { preparePublicationUnitV716, publishUnitV716 } from '../lib/publicationBridgeV716.mjs';
import { openCampaignSessionV716 } from '../lib/campaignSessionV716.mjs';
import { GENERATION_PROMPT_V716 } from '../lib/generationPromptV716.mjs';
import { authorOriginal, SETTER_RULES } from '../lib/factoryCore.mjs';
import { maximumRequestMicro } from '../lib/campaignExecutionV7.mjs';
import { scorecardPromptHashV716 } from '../lib/scorecardReviewV716.mjs';
import { validationContractV716, FACTORY_VERIFIER_VERSION_V716 } from '../lib/contractV716.mjs';
import { buildExecutionFreezeV716 } from '../lib/executionFreezeV716.mjs';

// One real execution freeze of the current checkout, bound by every offline registration below.
let freezeBinding;
function executionFreeze() {
  if (!freezeBinding) {
    const directory = mkdtempSync(join(tmpdir(), 'mockmob-v716-freeze-')), file = join(directory, 'freeze.json');
    const bytes = JSON.stringify(buildExecutionFreezeV716());
    writeFileSync(file, bytes);
    freezeBinding = { path: file, sha256: createHash('sha256').update(bytes).digest('hex') };
    process.on('exit', () => { try { unlinkSync(file); rmdirSync(directory); } catch { /* absent */ } });
  }
  return freezeBinding;
}

const prices = () => ({ models: {
  'gpt-6-luna': { max_input_tokens: 1000, input_per_million: 100, output_per_million: 100 },
  'gemini-3.8-flash': { max_input_tokens: 1000, batch: { input_per_million: 50, output_per_million: 50 } },
} });
const body = candidateId => ({ model: 'gpt-6-luna', max_output_tokens: 10,
  input: [{ role: 'user', content: JSON.stringify({ candidate_id: candidateId }) }] });

function fakeLedger({ batchState = null, requestState = null, cache = null } = {}) {
  const db = { prepare(sql) {
    return {
      get(key) {
        if (sql.includes('FROM provider_batches')) return batchState;
        if (sql.includes('FROM provider_requests')) return requestState;
        return null;
      },
      all() { return []; },
    };
  } };
  return { db, getCache: () => cache };
}

test('V713 guard preserves raw native response and binds request to registered candidate', async () => {
  const ledger = fakeLedger(), calls = [], keys = new Set(), response = { output_text: '{"ok":true}' };
  const guard = createCampaignGuardV713({ ledger, native: { generate: async (...args) => { calls.push(args); return response; } },
    campaignId: 'v716-smoke', candidateIds: ['candidate-1'], capUsd: 1, prices, keys });
  const result = await guard.generate('openai', body('candidate-1'), { key: 'stable-parent', stage: 'authoring' });
  assert.equal(result, response);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][2].candidate_id, 'v716-smoke:candidate-1');
  assert.equal(calls[0][2].batch, false);
  assert.equal(keys.size, 1);
  await assert.rejects(() => guard.generate('openai', body('outside'), { key: 'other', stage: 'authoring' }), /candidate_outside_registration/);
});

test('V713 guard refuses queued accepted work with the same logical key and no second native call', async () => {
  const campaignId = 'v716-smoke', parent = 'stable-parent';
  const nativeKey = hashJSON({ campaign: campaignId, parent });
  const ledger = fakeLedger({ batchState: { state: 'queued', provider_id: null } });
  const calls = [];
  const guard = createCampaignGuardV713({ ledger, native: { generate: async (...args) => { calls.push(args); } },
    campaignId, candidateIds: ['candidate-1'], capUsd: 1, prices, keys: new Set() });
  await assert.rejects(() => guard.generate('gemini', { generationConfig: { maxOutputTokens: 10 },
    contents: [{ role: 'user', parts: [{ text: JSON.stringify({ candidate_id: 'candidate-1' }) }] }] },
  { key: parent, stage: 'independent_evaluation' }), error => error instanceof BatchPending && error.batchId === nativeKey);
  assert.equal(calls.length, 0);
});

test('V713 guard preserves uncertain realtime outcomes and does not redispatch them', async () => {
  const ledger = fakeLedger({ requestState: { state: 'unresolved' } }), calls = [];
  const guard = createCampaignGuardV713({ ledger, native: { generate: async (...args) => { calls.push(args); } },
    campaignId: 'v716-smoke', candidateIds: ['candidate-1'], capUsd: 1, prices, keys: new Set() });
  await assert.rejects(() => guard.generate('openai', body('candidate-1'), { key: 'stable-parent', stage: 'authoring' }), /uncertain_request_never_resubmit/);
  assert.equal(calls.length, 0);
});

test('V716 bridge fails closed on missing scorecard evidence without writing', async () => {
  const question = { id: 'candidate-1', family_id: 'family-1', route: 'conceptual', body: 'Q', options: ['A', 'B', 'C', 'D'],
    difficulty: 'medium', source_refs: [], provenance: {}, evidence: null };
  const registry = { version: 'r1', sources: {}, families: {}, exam_specs: {} };
  const context = { registry, manifest: {}, secret: 'test-only-secret' };
  const prepared = preparePublicationUnitV716({ questions: [question], inventory: [], familyHolds: [], ...context, target: 'local' });
  assert.equal(prepared.ready, false);
  assert.ok(prepared.reasons.includes('scorecard_or_passage_group_ineligible'));
  let reads = 0, writes = 0;
  const result = await publishUnitV716({ questions: [question], target: 'local', ...context, adapter: {
    readInventory: async () => { reads++; return []; }, readFamilyHolds: async () => { reads++; return []; }, inventoryVersion: async () => 'v0',
    getWriteState: async () => { reads++; return null; }, saveWriteState: async () => { writes++; },
    writeAtomic: async () => { writes++; return { committed: true }; }, readReceipt: async () => null,
  } });
  assert.equal(result.state, 'withheld');
  assert.equal(writes, 0);
});

test('V716 publication preparation rejects production target before any adapter is involved', () => {
  assert.throws(() => preparePublicationUnitV716({ questions: [], inventory: [], familyHolds: [], target: 'production' }), /production_requires_separate_explicit_approval/);
});

const sha = value => createHash('sha256').update(value).digest('hex');
const temporaryDirectory = t => {
  const directory = mkdtempSync(join(tmpdir(), 'mockmob-v716-session-'));
  t.after(() => {
    for (const name of ['state.json', 'preflight.json', 'restart.json']) {
      try { unlinkSync(join(directory, name)); } catch { /* absent */ }
    }
    rmdirSync(directory);
  });
  return directory;
};

function sourceRegistry() {
  const excerpt = 'Cash receipts from sale of goods and rendering of services are operating cash flows.';
  const support = hashJSON(excerpt);
  const sourceRef = { id: 'source-session', version: 1, locator: 'excerpt', support_hash: support };
  return {
    version: 'offline-session-registry', sources: { 'source-session': { state: 'active', reuse_permitted: true,
      identity_sha256: 'a'.repeat(64), extraction_checked: true, version: 1, kind: 'textbook',
      supports: { excerpt: support }, facts: { excerpt: { text: excerpt } } } },
    packs: { 'pack-session': { state: 'active', version: 1, subject: 'accountancy' } },
    families: { 'family-session': { state: 'active', version: 1 } },
    exam_specs: { accountancy: { state: 'verified', included_topics: ['Cash Flow Statement'], excluded_topics: [],
      syllabus_version: 'offline', pattern_version: 'offline', pattern_rules: {}, exam_rule_version: 'offline' } },
    sourceRef, excerpt,
  };
}

function authoredPayload(excerpt) {
  return { body: 'A retailer receives cash from customers for goods sold. How should the receipt be classified?',
    options: ['Operating activity.', 'Investing activity.', 'Financing activity.', 'No cash flow.'],
    correct_answer: 'A', explanation: 'Cash received from customers for goods sold is an operating activity.',
    difficulty: 'medium', route: 'conceptual', passage_text: '', question_type: 'conceptual_mcq', concept_id: 'cash-receipts',
    evidence_quotes: [excerpt], stated_assumptions: [], option_analysis: ['It is the operating receipt.', 'It is not an investment receipt.',
      'It is not a financing receipt.', 'Cash is received.'] };
}

function buildRegistration({ registry, prices, job, authorBody, candidateHash = null } = {}) {
  const stages = ['authoring', 'blind_solution', 'independent_evaluation', 'explanation_support', 'repair'];
  const requests = [];
  for (const stage of stages) for (const variant of ['base', 'completion_retry']) {
    const provider = stage === 'independent_evaluation' ? 'gemini' : 'openai';
    const body = stage === 'authoring' ? structuredClone(authorBody) : provider === 'openai'
      ? { model: 'gpt-6-luna', max_output_tokens: 20, input: [{ role: 'user', content: JSON.stringify({ candidate_id: job.id, stage }) }] }
      : { generationConfig: { maxOutputTokens: 20 }, contents: [{ role: 'user', parts: [{ text: JSON.stringify({ candidate_id: job.id, stage }) }] }] };
    if (stage === 'authoring') { const system = body.input.find(row => row.role === 'system'); system.content = GENERATION_PROMPT_V716 + system.content.slice(SETTER_RULES.length); }
    const baseCap = provider === 'openai' ? body.max_output_tokens : body.generationConfig.maxOutputTokens;
    if (variant === 'completion_retry') {
      if (provider === 'openai') body.max_output_tokens = baseCap * 2;
      else body.generationConfig.maxOutputTokens = baseCap * 2;
    }
    const serialized = JSON.stringify(body);
    requests.push({ candidate_id: job.id, stage, provider, variant,
      request_key: sha(`${job.id}:${stage}:${variant}`), output_cap: variant === 'base' ? baseCap : baseCap * 2,
      input_bound_bytes: 33024, request_bytes: Buffer.byteLength(serialized), body_sha256: sha(serialized), body });
  }
  const binding = { contract_hash: validationContractV716(), prompt_hash: scorecardPromptHashV716(), campaign_sha256: 'b'.repeat(64),
    registry_sha256: hashJSON(registry), runner_sha256: 'c'.repeat(64), engine_sha256: 'd'.repeat(64) };
  const preflight = { passed: true, coverage: 'all-five-stages-and-retries', ...binding, pricing_hash: hashJSON(prices), requests };
  const profile = { pricing_hash: hashJSON(prices), input_byte_bounds: { 'gpt-6-luna': 33024, 'gemini-3.8-flash': 33024 } };
  const registration = { id: 'v716-offline-session', profile: FACTORY_VERIFIER_VERSION_V716,
    contract_hash: binding.contract_hash, prompt_hash: binding.prompt_hash, registry_hash: binding.registry_sha256,
    registry_sha256: binding.registry_sha256,
    pricing_hash: hashJSON(prices), runner_sha256: binding.runner_sha256, engine_sha256: binding.engine_sha256,
    campaign_sha256: binding.campaign_sha256, jobs: [{ ...job, ...(candidateHash ? { candidate_hash: candidateHash } : {}),
      author_body_hash: hashJSON(authorBody) }], cost_profile: profile, qualification: false, cap_usd: 3,
    publication: 'never', max_repairs: 0, standard_full_bound_usd: 0, budget_stop_possible: true,
    input_byte_bound: 33024, full_retry_bounds: true, preflight_hash: hashJSON(preflight), execution_freeze: executionFreeze() };
  registration.standard_full_bound_usd = requests.reduce((sum, row) => sum + maximumRequestMicro(row.provider, row.body, prices), 0) / 1e6;
  return { registration, preflight };
}

function sessionPrices() {
  return { expires_at: new Date(Date.now() + 86400000).toISOString(), models: {
    'gpt-6-luna': { max_input_tokens: 33024, input_per_million: 1, output_per_million: 1 },
    'gemini-3.8-flash': { max_input_tokens: 33024, input_per_million: 1, output_per_million: 1 },
  } };
}

function fakeSessionDependencies({ events = [], nativeGenerate = async () => ({ output_text: '{}' }), nativeFlush = async () => {} } = {}) {
  const ledger = { assertHistoryReconciled() { events.push('ledger-open'); }, close() { events.push('ledger-close'); },
    getCache: () => null, setCache: () => {}, db: { prepare(sql) { return { get() { return null; }, all() { return []; } }; } } };
  const store = { claim() { events.push('store-claim'); }, release() { events.push('store-release'); } };
  const deps = { events, ledger, store, flushes: [],
    ledgerFactory: () => { events.push('ledger-factory'); return ledger; },
    storeFactory: () => store,
    nativeFactory: () => ({ generate: nativeGenerate, reconcile: async () => {}, flush: async options => { deps.flushes.push(options); return nativeFlush(options); } }),
    save: (path, state) => writeFileSync(path, JSON.stringify(state)),
  };
  return deps;
}

test('V716 session validates bindings before network, then probes network before opening writable ledger', async t => {
  const directory = temporaryDirectory(t), statePath = join(directory, 'state.json'), registry = sourceRegistry(), prices = sessionPrices();
  const job = { id: 'candidate-session', subject: 'accountancy', chapter: 'Cash Flow Statement', topic: 'cash receipts',
    format: 'conceptual_mcq', difficulty: 'medium', kind: 'original_practice', family_id: 'family-session',
    source_pack_id: 'pack-session', source_pack_version: 1, source_refs: [registry.sourceRef] };
  let authorBody;
  await authorOriginal(job, { registry, transport: { generate: async (_provider, body) => {
    authorBody = body; return { output_text: JSON.stringify(authoredPayload(registry.excerpt)) };
  } } });
  const { registration, preflight } = buildRegistration({ registry, prices, job, authorBody });
  const initial = { registration_hash: hashJSON(registration), request_keys: [], cases: {} };
  writeFileSync(statePath, JSON.stringify(initial));
  const deps = fakeSessionDependencies();
  let session;
  session = await openCampaignSessionV716({ registration, registry, prices, preflight, statePath, inventory: [], secret: 'local-test-secret',
    network: async () => { deps.events.push('network'); }, ...deps });
  assert.deepEqual(deps.events.slice(0, 3), ['network', 'ledger-factory', 'ledger-open']);
  await session.flush();
  assert.equal(deps.flushes.length, 1);
  assert.deepEqual(deps.flushes[0], { candidateIds: ['v716-offline-session:candidate-session'], maxRequests: 10 });
  session.close();

  const bad = structuredClone(preflight); bad.requests[0].body.input[0].content += ' changed';
  const badSerialized = JSON.stringify(bad.requests[0].body);
  bad.requests[0].request_bytes = Buffer.byteLength(badSerialized); bad.requests[0].body_sha256 = sha(badSerialized);
  const mutatedRegistration = { ...registration, preflight_hash: hashJSON(bad) };
  const blocked = fakeSessionDependencies();
  await assert.rejects(() => openCampaignSessionV716({ registration: mutatedRegistration, registry, prices, preflight: bad, statePath,
    inventory: [], secret: 'local-test-secret', network: async () => { blocked.events.push('network'); }, ...blocked }), /v716_state_registration_changed/);
  assert.deepEqual(blocked.events, [], 'wrong registration binding must fail before probing or opening ledger');
  const changedPreflight = structuredClone(preflight); changedPreflight.prompt_hash = 'f'.repeat(64);
  const changed = structuredClone(registration); changed.preflight_hash = hashJSON(changedPreflight);
  const blockedAgain = fakeSessionDependencies();
  await assert.rejects(() => openCampaignSessionV716({ registration: changed, registry, prices, preflight: changedPreflight, statePath,
    inventory: [], secret: 'local-test-secret', network: async () => { blockedAgain.events.push('network'); }, ...blockedAgain }), /v713_preflight_binding_mismatch/);
  assert.deepEqual(blockedAgain.events, []);
});

test('V716 registered author helper sends the real adapted body and refuses unregistered author payloads', async t => {
  const directory = temporaryDirectory(t), statePath = join(directory, 'state.json'), registry = sourceRegistry(), prices = sessionPrices();
  const job = { id: 'candidate-author', subject: 'accountancy', chapter: 'Cash Flow Statement', topic: 'cash receipts',
    format: 'conceptual_mcq', difficulty: 'medium', kind: 'original_practice', family_id: 'family-session',
    source_pack_id: 'pack-session', source_pack_version: 1, source_refs: [registry.sourceRef] };
  let rawAuthorBody;
  await authorOriginal(job, { registry, transport: { generate: async (_provider, body) => { rawAuthorBody = body; return { output_text: JSON.stringify(authoredPayload(registry.excerpt)) }; } } });
  const { registration, preflight } = buildRegistration({ registry, prices, job, authorBody: rawAuthorBody });
  writeFileSync(statePath, JSON.stringify({ registration_hash: hashJSON(registration), request_keys: [], cases: {} }));
  let captured, generated = 0;
  const deps = fakeSessionDependencies({ nativeGenerate: async (_provider, body, options) => {
    generated++; captured = { body, options }; return { output_text: JSON.stringify(authoredPayload(registry.excerpt)) };
  } });
  const session = await openCampaignSessionV716({ registration, registry, prices, preflight, statePath, inventory: [], secret: 'local-test-secret',
    network: async () => {}, ...deps });
  const result = await session.author(job.id);
  assert.equal(result.id, job.id);
  const sent = captured.body.input[0].content, mechanics = rawAuthorBody.input[0].content.slice(SETTER_RULES.length);
  assert.ok(sent.startsWith(GENERATION_PROMPT_V716), 'V716 author prompt replaces the accumulated setter rules');
  assert.ok(mechanics.includes('evidence_quotes') && sent.endsWith(mechanics), 'the brief mechanics (exact evidence quotes, empty passage_text) are preserved');
  assert.equal(sent.includes(SETTER_RULES), false);
  assert.equal(captured.options.candidate_id, `${registration.id}:${job.id}`);
  assert.equal(generated, 1);
  await assert.rejects(() => session.generate({ ...rawAuthorBody, max_output_tokens: rawAuthorBody.max_output_tokens + 1 }, { stage: 'authoring' }), /v716_author_body_not_registered/);
  assert.equal(generated, 1, 'unregistered bodies must be blocked before the transport');
  session.close();
});

test('V716 session close refuses in-flight work, flush remains registration-scoped, and novelty survives restart', async t => {
  const directory = temporaryDirectory(t), statePath = join(directory, 'state.json'), registry = sourceRegistry(), prices = sessionPrices();
  const job = { id: 'candidate-inflight', subject: 'accountancy', chapter: 'Cash Flow Statement', topic: 'cash receipts',
    format: 'conceptual_mcq', difficulty: 'medium', kind: 'original_practice', family_id: 'family-session',
    source_pack_id: 'pack-session', source_pack_version: 1, source_refs: [registry.sourceRef] };
  let rawAuthorBody;
  await authorOriginal(job, { registry, transport: { generate: async (_provider, body) => { rawAuthorBody = body; return { output_text: JSON.stringify(authoredPayload(registry.excerpt)) }; } } });
  const candidate = { id: 'prior-eligible', subject: 'accountancy', chapter: 'Cash Flow Statement', family_id: 'family-session', route: 'conceptual',
    question_type: 'conceptual_mcq', difficulty: 'medium', body: 'A retailer receives cash from customers for goods sold. How should the receipt be classified?',
    options: [{ key: 'A', text: 'Operating activity.' }, { key: 'B', text: 'Investing activity.' }, { key: 'C', text: 'Financing activity.' }, { key: 'D', text: 'No cash flow.' }],
    correct_answer: 'A', explanation: 'Cash received from customers for goods sold is an operating activity.',
    provenance: { kind: 'original_practice', adaptation_family: 'family-session', syllabus_version: 'offline', pattern_version: 'offline',
      source_pack_id: 'pack-session', source_pack_version: 1 }, source_refs: [registry.sourceRef], evidence_quotes: [registry.excerpt] };
  const nextCandidate = { ...candidate, id: job.id };
  const { registration, preflight } = buildRegistration({ registry, prices, job, authorBody: rawAuthorBody, candidateHash: hashJSON(nextCandidate) });
  const state = { registration_hash: hashJSON(registration), request_keys: [], cases: { 'prior-eligible': { state: 'eligible', question: candidate } } };
  writeFileSync(statePath, JSON.stringify(state));
  let release, entered;
  const enteredPromise = new Promise(resolve => { entered = resolve; });
  const releasePromise = new Promise(resolve => { release = resolve; });
  const deps = fakeSessionDependencies({ nativeGenerate: async () => { entered(); await releasePromise; return { output_text: JSON.stringify(authoredPayload(registry.excerpt)) }; } });
  const session = await openCampaignSessionV716({ registration, registry, prices, preflight, statePath, inventory: [], secret: 'local-test-secret',
    network: async () => {}, ...deps });
  const active = session.author(job.id);
  await enteredPromise;
  assert.throws(() => session.close(), /v716_drain_active_operations_before_close/);
  release();
  await active;
  session.close();

  const restartPath = join(directory, 'restart.json');
  const secondJob = { ...job, id: 'candidate-restart-duplicate' };
  const secondRaw = { model: 'gpt-6-luna', max_output_tokens: 6500, input: [{ role: 'system', content: 'brief' },
    { role: 'user', content: JSON.stringify({ job_id: secondJob.id, candidate_id: secondJob.id }) }] };
  const restartRegistration = buildRegistration({ registry, prices, job: secondJob, authorBody: secondRaw,
    candidateHash: hashJSON({ ...nextCandidate, id: secondJob.id }) });
  const persisted = { registration_hash: hashJSON(restartRegistration.registration), request_keys: [],
    cases: { 'persisted-eligible': { state: 'eligible', question: candidate } } };
  writeFileSync(restartPath, JSON.stringify(persisted));
  const restartSession = await openCampaignSessionV716({ registration: restartRegistration.registration, preflight: restartRegistration.preflight,
    registry, prices, statePath: restartPath, inventory: [], secret: 'local-test-secret',
    network: async () => {}, ...fakeSessionDependencies() });
  const duplicate = await restartSession.validate({ ...candidate, id: secondJob.id });
  assert.equal(duplicate.state, 'quarantined');
  assert.ok(duplicate.reasons.includes('local_check_failed:novelty'));
  restartSession.close();
});
