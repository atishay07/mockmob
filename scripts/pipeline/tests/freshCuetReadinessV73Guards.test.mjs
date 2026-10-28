import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { scopedAccounting } from '../lib/scopedAccounting.mjs';
import {
  assertCustodySetV73, assertExecutionPlanV73, acceptedNativeRequestV73, reservePendingCostV73,
  inspectBlindCaptureV73, evaluationResumeActionV73, evaluationFailureStatusV73, providerOutcomeSummaryV73,
  validatePreflightManifestV73, assertReleaseEvidenceRoleV73, assertBenchmarkProvenanceV73,
  resumeTerminalFixtureHaikuV73, reportLedgerV73, retainedAcceptedEvaluationV73, FRESH_V73_PROVIDERS,
  providersForEvidenceRoleV73, haikuRoleForEvidenceV73
} from '../lib/freshCuetReadinessV73Guards.mjs';
import { V73_ADDITIVE_FILES } from '../lib/contractV73.mjs';

test('read-only reporting retains conservative holds, excludes unrelated spend, and cannot write', () => {
  const directory = mkdtempSync(join(tmpdir(), 'mockmob-v73-report-'));
  const path = join(directory, 'ledger.sqlite');
  try {
    const seed = new DatabaseSync(path);
    seed.exec('CREATE TABLE requests(id TEXT PRIMARY KEY,model TEXT,reserved INTEGER,actual INTEGER,state TEXT,receipt_json TEXT); CREATE TABLE provider_requests(reservation_id TEXT,request_json TEXT); CREATE TABLE provider_batches(reservation_id TEXT,request_json TEXT);');
    const insert = seed.prepare('INSERT INTO requests VALUES(?,?,?,?,?,?)');
    insert.run('paid', 'model', 100, 75, 'settled', JSON.stringify({ candidate_id: 'study:a' }));
    insert.run('hold', 'model', 100, 125, 'held', JSON.stringify({ candidate_id: 'study:b' }));
    insert.run('other', 'model', 200, 200, 'settled', JSON.stringify({ candidate_id: 'elsewhere:c' }));
    seed.close();
    const ledger = reportLedgerV73(new DatabaseSync(path, { readOnly: true }));
    const cost = scopedAccounting(ledger, 'study:');
    assert.equal(cost.settled_micro, 75);
    assert.equal(cost.held_micro, 125);
    assert.equal(cost.committed_micro, 200);
    assert.equal(cost.requests.length, 2);
    assert.equal(cost.receipt_complete, false);
    assert.throws(() => ledger.db.exec("UPDATE requests SET reserved=0"), /readonly|read-only/i);
    ledger.close();
    assert.throws(() => ledger.db.prepare('SELECT 1'), /closed|not open/i);
  } finally {
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
    assert.equal(basename(directory).startsWith('mockmob-v73-report-'), true);
    rmSync(directory, { recursive: true, force: true });
  }
});

test('accepted evaluations keep their request identity without entering a dispatch path', () => {
  const prior = { status: 'guard_blocked', native_key: 'accepted-identity', error: 'old guard' };
  const retained = retainedAcceptedEvaluationV73(prior, evaluationResumeActionV73(prior, true, true));
  assert.equal(retained.status, 'error');
  assert.equal(retained.native_key, 'accepted-identity');
  assert.equal(retained.error, 'accepted_provider_request_exists_no_resubmit');
  assert.equal(prior.status, 'guard_blocked');
  assert.equal(retainedAcceptedEvaluationV73(prior, 'retry_same_key'), null);
});

test('custody coverage is exact and rejects duplicate, omitted, or unrelated positive keys', () => {
  const args = { fixtureIds: ['a', 'b', 'c'], positiveIds: ['a', 'b'], custody: { complete: true, problems: [], positive_ids: ['b', 'a'] } };
  assert.equal(assertCustodySetV73(args), true);
  assert.throws(() => assertCustodySetV73({ ...args, custody: { ...args.custody, positive_ids: ['a', 'a'] } }), /unique/);
  assert.throws(() => assertCustodySetV73({ ...args, custody: { ...args.custody, positive_ids: ['a', 'c'] } }), /custody/);
  assert.throws(() => assertCustodySetV73({ ...args, fixtureIds: ['a', 'a', 'c'] }), /unique/);
});

test('in-flight maximum reservations serialize against one cap and reject the racing overrun', async () => {
  let pending = 0, release;
  const gate = new Promise(resolve => { release = resolve; });
  const reserve = async () => {
    pending = reservePendingCostV73({ committedMicro: 0, pendingMicro: pending, maximumMicro: 700_000,
      capUsd: 1, assertBudget: (committed, next, cap) => { if (committed + next > cap * 1e6) throw Error('campaign_budget_exhausted'); } });
    await gate;
    pending -= 700_000;
  };
  const first = reserve();
  await assert.rejects(reserve(), /campaign_budget_exhausted/);
  release(); await first;
  assert.equal(pending, 0);
});

test('offline capture requires the real blinded phase, candidate identity, and hidden key canary', () => {
  const capture = (provider, phase, raw = '{"candidate_id":"fixture-1","body":"example"}') => inspectBlindCaptureV73({
    fixtureId: 'fixture-1', provider, phase, raw, body: { input: raw }, inputLimitTokens: 1000
  });
  assert.equal(capture('openai', 'blind_solution').key_canary_absent, true);
  assert.equal(capture('gemini', 'independent_evaluation').phase, 'independent_evaluation');
  assert.equal(capture('anthropic', 'independent_evaluation').provider, 'anthropic');
  assert.throws(() => capture('openai', 'independent_evaluation'), /phase/);
  assert.throws(() => capture('gemini', 'independent_evaluation', '{"candidate_id":"fixture-1","correct_answer":"A"}'), /leak/);
  assert.throws(() => capture('anthropic', 'independent_evaluation', '{"candidate_id":"fixture-1","x":"FRESH_BLIND_KEY_CANARY"}'), /leak/);
  assert.throws(() => capture('openai', 'blind_solution', '{"candidate_id":"other"}'), /identity/);
});

test('fresh and regression evidence retain distinct preregistered honesty roles', () => {
  const fresh = { classification: 'fresh', scope: 'full_cuet_release', preregistration_id: 'pre-1',
    approved_before_evaluation: true, previously_read: false, tuned_on: false };
  const regression = { classification: 'regression', scope: 'regression', preregistration_id: 'pre-2',
    approved_before_evaluation: true, previously_read: true, tuned_on: true };
  assert.equal(assertReleaseEvidenceRoleV73(fresh), true);
  assert.equal(assertReleaseEvidenceRoleV73(regression), true);
  assert.throws(() => assertReleaseEvidenceRoleV73({ ...fresh, previously_read: true }), /role/);
  assert.throws(() => assertReleaseEvidenceRoleV73({ ...regression, scope: 'full_cuet_release' }), /role/);
});

test('authentic CUET PYQ provenance is preserved only in regression fixtures', () => {
  const fixtures = [{ candidate: { provenance: { kind: 'authentic_pyq', anchor_id: 'pyq-1' } } }];
  assert.equal(assertBenchmarkProvenanceV73(fixtures, 'regression'), true);
  assert.throws(() => assertBenchmarkProvenanceV73(fixtures, 'fresh'), /authentic_pyq/);
  assert.equal(fixtures[0].candidate.provenance.kind, 'authentic_pyq');
  assert.equal(assertBenchmarkProvenanceV73([{ candidate: { provenance: { kind: 'original_practice' } } }], 'fresh'), true);
});

test('preflight requires a unique complete candidate-provider-phase matrix within a conservative byte bound', () => {
  const fixtureIds = ['f1', 'f2'];
  const limits = { openai: 1000, gemini: 900, anthropic: 800 };
  const manifest = fixtureIds.flatMap(fixture_id => FRESH_V73_PROVIDERS.map(provider => ({ fixture_id, provider,
    phase: provider === 'openai' ? 'blind_solution' : 'independent_evaluation', bytes: 10, provider_input_limit_tokens: limits[provider],
    request_size_bound: 'utf8_bytes_at_most_input_token_limit', key_canary_absent: true })));
  assert.equal(validatePreflightManifestV73({ manifest, fixtureIds, limits }), true);
  assert.throws(() => validatePreflightManifestV73({ manifest: [...manifest, manifest[0]], fixtureIds, limits }), /matrix/);
  assert.throws(() => validatePreflightManifestV73({ manifest: manifest.slice(1), fixtureIds, limits }), /matrix/);
  const wrongPhase = manifest.map((x, i) => i === 0 ? { ...x, phase: 'explanation_support' } : x);
  assert.throws(() => validatePreflightManifestV73({ manifest: wrongPhase, fixtureIds, limits }), /contract/);
  const tooLarge = manifest.map((x, i) => i === 0 ? { ...x, bytes: limits[x.provider] + 1 } : x);
  assert.throws(() => validatePreflightManifestV73({ manifest: tooLarge, fixtureIds, limits }), /contract/);
  assert.throws(() => inspectBlindCaptureV73({ fixtureId: 'fixture-1', provider: 'openai', phase: 'blind_solution', raw: 'fixture-1',
    body: { input: 'x'.repeat(1001) }, inputLimitTokens: 1000 }), /size_bound/);
});

test('saved errors stay terminal; only known pre-dispatch refusals can retry the same key', () => {
  assert.equal(evaluationResumeActionV73(null, false), 'dispatch_new_key');
  assert.equal(evaluationResumeActionV73(null, true), 'stop_accepted_request_without_result');
  assert.equal(evaluationResumeActionV73({ status: 'judged' }, true), 'reuse_saved_judgment');
  assert.equal(evaluationResumeActionV73({ status: 'error' }, false), 'keep_terminal_error');
  assert.equal(evaluationResumeActionV73({ status: 'guard_blocked' }, false), 'keep_terminal_error');
  assert.equal(evaluationResumeActionV73({ status: 'guard_blocked' }, false, true), 'retry_same_key');
  assert.equal(evaluationResumeActionV73({ status: 'guard_blocked' }, true), 'promote_to_terminal_error');
  assert.equal(evaluationResumeActionV73({ status: 'unknown' }, false), 'stop_unknown_saved_state');
  assert.equal(evaluationFailureStatusV73(Object.assign(new Error('budget'), { dispatchState: 'guard_blocked' }), false), 'guard_blocked');
  assert.equal(evaluationFailureStatusV73(new Error('schema failure'), false), 'error');
  assert.equal(evaluationFailureStatusV73(Object.assign(new Error('request may have been accepted'), { dispatchState: 'accepted' }), false), 'error');
  assert.equal(evaluationFailureStatusV73(Object.assign(new Error('budget'), { dispatchState: 'guard_blocked' }), true), 'error');
});

test('completed terminal fixture resumes only Haiku and preserves the saved dual-blind verdict', async () => {
  const counters = { openai: 0, gemini: 0, anthropic: 0, verify: 0, paid: 0 };
  const verdict = { id: 'fixture-a', state: 'eligible', reasons: [] };
  const evaluations = { openai: { status: 'judged' }, gemini: { status: 'judged' }, anthropic: { status: 'guard_blocked', native_key: 'refused-key' } };
  const result = await resumeTerminalFixtureHaikuV73({ verdict, evaluations,
    acceptedNativeRequest: key => key === 'accepted-key',
    evaluateProvider: async provider => { counters[provider]++; if (provider === 'openai' || provider === 'gemini') counters.paid++; return { solved_key: 'A' }; },
    validateTopology: async () => { counters.verify++; return { state: 'eligible' }; },
    save: () => {} });
  counters.paid += counters.anthropic;
  assert.equal(result.handled, true);
  assert.equal(result.verdict, verdict);
  assert.equal(evaluations.anthropic.status, 'judged');
  assert.deepEqual(counters, { openai: 0, gemini: 0, anthropic: 1, verify: 0, paid: 1 });
});

test('accepted Haiku guard record is promoted without dispatch and keeps the completed verdict', async () => {
  let dispatches = 0, paid = 0, saves = 0, verifications = 0;
  const verdict = { id: 'fixture-b', state: 'quarantined', reasons: ['saved-verdict'] };
  const evaluations = { openai: { status: 'judged' }, gemini: { status: 'judged' }, anthropic: { status: 'guard_blocked', native_key: 'accepted-key' } };
  const result = await resumeTerminalFixtureHaikuV73({ verdict, evaluations, acceptedNativeRequest: key => key === 'accepted-key',
    evaluateProvider: async () => { dispatches++; paid++; return {}; },
    validateTopology: async () => { verifications++; return {}; }, save: () => { saves++; } });
  assert.equal(result.handled, true);
  assert.equal(result.verdict, verdict);
  assert.equal(evaluations.anthropic.status, 'error');
  assert.equal(evaluations.anthropic.native_key, 'accepted-key');
  assert.equal(dispatches, 0);
  assert.equal(paid, 0);
  assert.equal(verifications, 0);
  assert.equal(saves, 1);
});

test('missing Haiku resumes through the deterministic transport key and its accepted-request guard', async () => {
  let paid = 0, guardHits = 0, verifications = 0;
  const acceptedKeys = new Set(['stable-haiku-key']);
  const verdict = { id: 'fixture-c', state: 'eligible' };
  const evaluations = { openai: { status: 'judged' }, gemini: { status: 'judged' } };
  const result = await resumeTerminalFixtureHaikuV73({ verdict, evaluations,
    acceptedNativeRequest: key => acceptedKeys.has(key),
    evaluateProvider: async () => {
      const key = 'stable-haiku-key';
      if (acceptedKeys.has(key)) { guardHits++; throw Object.assign(new Error('accepted_provider_request_exists_no_resubmit'), { nativeKey: key, dispatchState: 'accepted' }); }
      paid++; return { solved_key: 'A' };
    },
    validateTopology: async () => { verifications++; return {}; }, save: () => {} });
  assert.equal(result.handled, true);
  assert.equal(evaluations.anthropic.status, 'error');
  assert.equal(evaluations.anthropic.native_key, 'stable-haiku-key');
  assert.equal(guardHits, 1);
  assert.equal(paid, 0);
  assert.equal(verifications, 0);
});

test('native request lookup treats complete receipts as replayable and unresolved requests as no-resubmit', () => {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE provider_requests(id TEXT PRIMARY KEY,state TEXT); CREATE TABLE provider_batches(id TEXT PRIMARY KEY,state TEXT);');
  db.prepare('INSERT INTO provider_requests VALUES(?,?)').run('complete-key', 'complete');
  db.prepare('INSERT INTO provider_requests VALUES(?,?)').run('held-key', 'unresolved');
  db.prepare('INSERT INTO provider_requests VALUES(?,?)').run('refused-key', 'credit_refused');
  db.prepare('INSERT INTO provider_batches VALUES(?,?)').run('queued-key', 'submitted');
  assert.equal(acceptedNativeRequestV73(db, 'complete-key'), false);
  assert.equal(acceptedNativeRequestV73(db, 'held-key'), true);
  assert.equal(acceptedNativeRequestV73(db, 'refused-key'), false);
  assert.equal(acceptedNativeRequestV73(db, 'queued-key'), true);
  db.close();
});

test('provider denominators expose every provider and never mark Haiku complete with gaps or errors', () => {
  const evaluations = { a: { openai: { status: 'judged' }, gemini: { status: 'judged' }, anthropic: { status: 'judged' } },
    b: { openai: { status: 'judged' }, gemini: { status: 'judged' }, anthropic: { status: 'error' } },
    c: { openai: { status: 'judged' }, gemini: { status: 'judged' }, anthropic: { status: 'guard_blocked' } } };
  const result = providerOutcomeSummaryV73({ fixtureIds: ['a', 'b', 'c'], positiveIds: ['a', 'b'], evaluations });
  assert.deepEqual(Object.keys(result), FRESH_V73_PROVIDERS);
  assert.equal(result.anthropic.denominator, 3);
  assert.equal(result.anthropic.counts.error, 1);
  assert.equal(result.anthropic.counts.guard_blocked, 1);
  assert.equal(result.anthropic.positive_comparison_complete, false);
  assert.equal(result.openai.complete, true);
  assert.equal(result.gemini.complete, true);
});

test('immutable plan guard checks provider set, cost cap, denominator, code/input hashes, and registry snapshot', () => {
  const plan = { id: 'study', publication: 'never', maximum_content_repairs: 0, regeneration: false, cap_usd: 4,
    topology: 'dual_blind', denominator: 3, valid_roots: 2, controlled_defects: 1, contract_binding: { v: 73 },
    input_hashes: { frozen: 'f' }, source_registry_hash: 'r', providers: FRESH_V73_PROVIDERS,
    haiku_role: 'Fresh blinded key and CUET-fit comparison only; never substituted into publication topology.' };
  const expected = { id: 'study', binding: plan.contract_binding, inputHashes: plan.input_hashes, registryHash: 'r', denominator: 3, validRoots: 2, controlledDefects: 1 };
  assert.equal(assertExecutionPlanV73(plan, expected), true);
  assert.throws(() => assertExecutionPlanV73({ ...plan, cap_usd: 8 }, expected), /changed/);
  assert.throws(() => assertExecutionPlanV73({ ...plan, providers: ['openai'] }, expected), /changed/);
  assert.throws(() => assertExecutionPlanV73(plan, { ...expected, registryHash: 'changed' }), /changed/);
  assert.ok(V73_ADDITIVE_FILES.includes('releaseEvidenceV73.mjs'));
});

test('regression registration retains both validators and refuses a fresh Haiku role or reduced topology', () => {
  const plan = { id: 'regression', publication: 'never', maximum_content_repairs: 0, regeneration: false, cap_usd: 4,
    topology: 'dual_blind', denominator: 4, valid_roots: 2, controlled_defects: 2, contract_binding: { v: 73 },
    input_hashes: { frozen: 'f' }, source_registry_hash: 'r', providers: providersForEvidenceRoleV73('regression'),
    haiku_role: haikuRoleForEvidenceV73('regression') };
  const expected = { id: 'regression', binding: plan.contract_binding, inputHashes: plan.input_hashes, registryHash: 'r',
    denominator: 4, validRoots: 2, controlledDefects: 2, classification: 'regression' };
  assert.equal(assertExecutionPlanV73(plan, expected), true);
  assert.deepEqual(plan.providers, ['openai', 'gemini']);
  assert.throws(() => assertExecutionPlanV73({ ...plan, providers: ['gemini'] }, expected), /changed/);
  assert.throws(() => assertExecutionPlanV73({ ...plan, providers: FRESH_V73_PROVIDERS }, expected), /changed/);
  assert.throws(() => assertExecutionPlanV73({ ...plan, haiku_role: haikuRoleForEvidenceV73('fresh') }, expected), /role_changed/);
  assert.throws(() => assertExecutionPlanV73(plan, { ...expected, classification: 'fresh' }), /changed/);
  assert.throws(() => providersForEvidenceRoleV73('unknown'), /classification/);
});

test('regression blinded preflight requires exactly Luna and Gemini for every case', () => {
  const fixtureIds = ['r1', 'r2'], providers = providersForEvidenceRoleV73('regression'), limits = { openai: 1000, gemini: 1000 };
  const manifest = fixtureIds.flatMap(fixtureId => providers.map(provider => inspectBlindCaptureV73({ fixtureId, provider,
    phase: provider === 'openai' ? 'blind_solution' : 'independent_evaluation', raw: JSON.stringify({ candidate_id: fixtureId }),
    body: { text: fixtureId }, inputLimitTokens: limits[provider] })));
  assert.equal(validatePreflightManifestV73({ manifest, fixtureIds, providers, limits }), true);
  assert.throws(() => validatePreflightManifestV73({ manifest: manifest.slice(0, 3), fixtureIds, providers, limits }), /incomplete/);
  assert.throws(() => validatePreflightManifestV73({ manifest, fixtureIds, providers: FRESH_V73_PROVIDERS, limits }), /incomplete/);
  const outcomes = providerOutcomeSummaryV73({ fixtureIds, positiveIds: fixtureIds, providers,
    evaluations: Object.fromEntries(fixtureIds.map(id => [id, { openai: { status: 'judged' }, gemini: { status: 'judged' } }])) });
  assert.equal(outcomes.openai.complete && outcomes.gemini.complete, true);
  assert.equal(Object.hasOwn(outcomes, 'anthropic'), false);
});
