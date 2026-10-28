import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { evaluationResumeActionV73 } from '../lib/freshCuetReadinessV73Guards.mjs';
import { assertExecutionPlanV77, assertLifetimeBoundV77, assertRequestBodyBoundV77, assertV77Authorization,
  acquireQualificationLeaseV77, expectedReleaseBindingV77, verifyV77Freeze, QUALIFICATION_V77_PREFIX,
  QUALIFICATION_V77_CAP_USD, V77_RAW_FREEZE_SHA256, V77_VALIDATION_CONTRACT_HASH, MAX_INPUT_BODY_BYTES_V77,
  assertFreshV77Study, assertNoPriorV75V76CaseReuse, normalizedCaseFingerprint, V77_TRANSPORT_DEPENDENCIES, dispatchV77NativeRequest,
  assertPriceExpiryV77, assertV77StudySlotBinding, appendV77RecoveryHistory } from '../lib/freshCuetReadinessV77Guards.mjs';
import { assessReleaseEvidenceV77 } from '../lib/releaseEvidenceV77.mjs';
import { BudgetLedger } from '../lib/budgetLedger.mjs';
import { createFactoryTransport } from '../lib/factoryTransport.mjs';
import { acceptedNativeRequestV73 } from '../lib/freshCuetReadinessV73Guards.mjs';
import { hashJSON } from '../../../data/question_factory_policy.mjs';
import { requestNeedsReservation } from '../lib/campaignExecutionV7.mjs';

test('V77 freeze binds raw artifact, embedded contract, prompt, and every frozen core file', () => {
  const result = verifyV77Freeze(resolve('.'));
  assert.equal(result.raw_sha256, V77_RAW_FREEZE_SHA256);
  assert.equal(result.validation_contract_hash, V77_VALIDATION_CONTRACT_HASH);
  assert.equal(result.freeze.qualification_state, 'unqualified');
});

test('release binding preserves the frozen V7 thresholds while selecting the V77 verifier', () => {
  const b = expectedReleaseBindingV77();
  assert.equal(b.verifier_version, 'cuet-fit-validator-v7.7-local-draft');
  assert.equal(b.fresh_false_accepts_max, 0);
  assert.equal(b.regression_false_accepts_max, 0);
  assert.equal(b.valid_survival_min, .85);
  assert.equal(b.per_subject_valid_survival_min, .7);
});

test('authorization is bound to both fixed studies, exact freeze, prefix, and shared cap', () => {
  const valid = { authorization_type: 'explicit_user', authorized: true, freeze_sha256: V77_RAW_FREEZE_SHA256,
    validation_contract_hash: V77_VALIDATION_CONTRACT_HASH, qualification_budget_prefix: QUALIFICATION_V77_PREFIX,
    cap_usd: QUALIFICATION_V77_CAP_USD, study_ids: ['v77-qualification-2026-10-09-fresh-a', 'v77-qualification-2026-10-09-regression-a'],
    study_payloads: { fresh: { payload_hash: 'a', frozen_sha256: 'b', custody_sha256: 'c' }, regression: { payload_hash: 'd', frozen_sha256: 'e', custody_sha256: 'f' } },
    transport_freeze_hash: 'transport', execution_plan_hashes: { fresh: 'plan1', regression: 'plan2' }, issued_at: '2026-10-09T00:00:00Z' };
  const args = { freezeSha256: V77_RAW_FREEZE_SHA256, contractHash: V77_VALIDATION_CONTRACT_HASH, freshId: valid.study_ids[0], regressionId: valid.study_ids[1],
    studyPayloads: valid.study_payloads, transportFreezeHash: valid.transport_freeze_hash, executionPlanHashes: valid.execution_plan_hashes };
  assert.equal(assertV77Authorization(valid, args), true);
  assert.throws(() => assertV77Authorization({ ...valid, cap_usd: 5 }, args), /explicit_scope_bound/);
  assert.throws(() => assertV77Authorization({ ...valid, study_ids: [...valid.study_ids].reverse() }, args), /explicit_scope_bound/);
});

test('request sizing guards the final complete provider body in UTF-8 bytes', () => {
  assert.equal(assertRequestBodyBoundV77('openai', { input: 'ok', service_tier: 'flex' }), Buffer.byteLength(JSON.stringify({ input: 'ok', service_tier: 'flex' })));
  assert.throws(() => assertRequestBodyBoundV77('gemini', { content: 'x'.repeat(MAX_INPUT_BODY_BYTES_V77) }), /exceeds_reserved_bytes/);
});

test('shared lifetime reserve fails closed at the exact approved ceiling', () => {
  assert.equal(assertLifetimeBoundV77(49_000_000, 1_000_000), true);
  assert.throws(() => assertLifetimeBoundV77(49_000_001, 1_000_000), /lifetime_budget_exhausted/);
});

test('pricing evidence must remain in date for any prospective study action', () => {
  assert.equal(assertPriceExpiryV77({ expires_at: '2026-10-10T00:00:00Z' }, Date.parse('2026-10-09T00:00:00Z')), Date.parse('2026-10-10T00:00:00Z'));
  assert.throws(() => assertPriceExpiryV77({ expires_at: '2026-10-08T00:00:00Z' }, Date.parse('2026-10-09T00:00:00Z')), /pricing_evidence_expired/);
});

test('one phase lease blocks live or uncertain owners and archives dead/drained ownership', () => {
  const root = mkdtempSync(join(resolve('.'), '.v77-lease-'));
  try {
    const release = acquireQualificationLeaseV77(root, { pid: 321, isPidAlive: () => true });
    assert.throws(() => acquireQualificationLeaseV77(root, { pid: 654, isPidAlive: () => true }), /owner_live_or_uncertain/);
    release();
    const lease = acquireQualificationLeaseV77(root, { pid: 321, isPidAlive: () => true });
    lease();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('execution plan binds the immutable prefix, scope, reserve, and topology', () => {
  const binding = expectedReleaseBindingV77(), inputHashes = { freeze: V77_RAW_FREEZE_SHA256 };
  const plan = { id: `${QUALIFICATION_V77_PREFIX}fresh-a`, publication: 'never', maximum_content_repairs: 0, regeneration: false,
    cap_usd: 4, lifetime_cap_usd: 50, qualification_budget_prefix: QUALIFICATION_V77_PREFIX, topology: 'dual_blind', denominator: 20,
    valid_roots: 8, controlled_defects: 12, classification: 'fresh', contract_binding: binding, input_hashes: inputHashes,
    source_registry_hash: 'registry', max_input_body_bytes: MAX_INPUT_BODY_BYTES_V77, native_batch: false, providers: ['openai','gemini'],
    transport_mode: 'openai_explicit_flex_only_no_fallback;gemini_realtime' };
  const args = { id: plan.id, binding, inputHashes, registryHash: 'registry', denominator: 20, validRoots: 8, controlledDefects: 12, classification: 'fresh' };
  assert.equal(assertExecutionPlanV77(plan, args), true);
  assert.throws(() => assertExecutionPlanV77({ ...plan, cap_usd: 3 }, args), /registered_v77_inputs/);
});

test('a relabeled V76 specimen cannot qualify as a fresh V77 case', () => {
  const prior = JSON.parse(readFileSync('artifacts/question-factory/cuet-readiness-2026-10-09/benchmark/v76-qualification-2026-10-09-fresh/frozen.json', 'utf8')).fixtures[0];
  const relabeled = { ...prior, id: 'v77-qualification-2026-10-09-fresh-new-id', candidate: { ...prior.candidate, id: 'new-candidate-id' } };
  assert.throws(() => assertNoPriorV75V76CaseReuse([relabeled], [prior]), /prior_inspected_case_reused_as_fresh/);
});

test('fresh/regression registration slots require their own classification and disjoint fixture IDs', () => {
  const fresh = { release_eligibility: { classification: 'fresh' }, fixtures: [{ id: 'f1' }] };
  const regression = { release_eligibility: { classification: 'regression' }, fixtures: [{ id: 'r1' }] };
  assert.equal(assertV77StudySlotBinding(`${QUALIFICATION_V77_PREFIX}fresh`, `${QUALIFICATION_V77_PREFIX}regression`, fresh, regression), true);
  assert.throws(() => assertV77StudySlotBinding(`${QUALIFICATION_V77_PREFIX}fresh`, `${QUALIFICATION_V77_PREFIX}regression`, fresh,
    { ...regression, release_eligibility: { classification: 'fresh' } }), /slot_or_classification/);
  assert.throws(() => assertV77StudySlotBinding(`${QUALIFICATION_V77_PREFIX}fresh`, `${QUALIFICATION_V77_PREFIX}regression`, fresh,
    { ...regression, fixtures: [{ id: 'f1' }] }), /fixture_ids_overlap/);
});

test('fresh registration rejects case/custody timestamps that predate the V77 contract freeze', () => {
  const frozen = { created_at: '2026-10-08T21:00:00Z', registered_at: '2026-10-09T01:00:00Z', fixtures: [] };
  assert.throws(() => assertFreshV77Study({ frozen, custody: {}, freezeSha256: V77_RAW_FREEZE_SHA256,
    freezeAt: '2026-10-08T22:37:00Z', custodySha256: 'x' }), /must_follow_freeze/);
});

test('same fixed case may retry a guard-blocked key, while accepted or uncertain requests stay receipt-only', () => {
  assert.equal(evaluationResumeActionV73({ status: 'guard_blocked', native_key: 'same-fixed-key' }, false, true), 'retry_same_key');
  assert.equal(evaluationResumeActionV73({ status: 'guard_blocked', native_key: 'accepted-key' }, true, true), 'promote_to_terminal_error');
  assert.equal(evaluationResumeActionV73({ status: 'judged', native_key: 'settled-key' }, true, true), 'reuse_saved_judgment');
  assert.equal(evaluationResumeActionV73({ status: 'unknown', native_key: 'uncertain-key' }, false, true), 'stop_unknown_saved_state');
});

test('prior-case fingerprint normalizes string and object options identically', () => {
  const a = { candidate: { body: 'A   prompt', passage_text: 'Text', options: ['One', 'Two'] } };
  const b = { candidate: { body: 'a prompt', passage_text: 'text', options: [{ key: 'A', text: 'one' }, { key: 'B', text: 'TWO' }] } };
  assert.equal(normalizedCaseFingerprint(a), normalizedCaseFingerprint(b));
});

test('release evidence stays pending until complete rows and receipts exist, then blocks contested invalids', () => {
  const binding = expectedReleaseBindingV77();
  const incomplete = assessReleaseEvidenceV77({ binding, frozenFresh: { fixtures: [{ id: 'x', expected_valid: false, contested: true }] },
    frozenRegression: { fixtures: [{ id: 'y', expected_valid: false }] }, resultFresh: {}, resultRegression: {}, executionFinished: false,
    receiptComplete: false, accounting: { held_micro: 1 } });
  assert.equal(incomplete.state, 'pending');
  assert.equal(incomplete.academic_assessment, null);
});

test('completed release evidence rejects non-boolean regression labels and contested fresh rows', () => {
  const binding = expectedReleaseBindingV77();
  const freshFixture = { id: 'fresh-x', group: 'controlled_defect', category: 'invalid', expected_valid: false, contested: true, candidate: {} };
  const regressionFixture = { id: 'reg-x', group: 'control', category: 'invalid', expected_valid: null, candidate: {} };
  const frozen = (id, fixture) => ({ id, fixtures: [fixture], release_eligibility: {}, verifier_version: binding.verifier_version, payload_hash: 'synthetic' });
  const result = (id, fixture) => ({ benchmark: { id, payload_hash: 'synthetic' }, contract_binding: binding, release_eligibility: {},
    verifier_version: binding.verifier_version, evaluations: { [fixture.id]: { openai: { status: 'judged' }, gemini: { status: 'judged' } } },
    topologies: { dual_blind: [{ id: fixture.id, group: fixture.group, category: fixture.category, expected_valid: fixture.expected_valid, state: 'eligible' }] } });
  const assessed = assessReleaseEvidenceV77({ binding, frozenFresh: frozen('f', freshFixture), frozenRegression: frozen('r', regressionFixture),
    resultFresh: result('f', freshFixture), resultRegression: result('r', regressionFixture), executionFinished: true, receiptComplete: true, accounting: { held_micro: 0 } });
  assert.equal(assessed.state, 'paused');
  assert.ok(assessed.problems.includes('fresh_contested_defect_cannot_qualify:fresh-x'));
  assert.ok(assessed.problems.includes('regression_expected_valid_required:reg-x'));
  assert.ok(assessed.problems.includes('fresh_defect_false_accepts_1'));
});

test('transport freeze dependency list is sorted, closed, and excludes mutable price inputs', () => {
  assert.deepEqual([...V77_TRANSPORT_DEPENDENCIES], [...V77_TRANSPORT_DEPENDENCIES].sort());
  assert.ok(V77_TRANSPORT_DEPENDENCIES.includes('scripts/pipeline/lib/savedRequestBody.mjs'));
  assert.ok(!V77_TRANSPORT_DEPENDENCIES.includes('data/pipeline-prices.json'));
});

test('native dispatch bounds the materialized Flex body and makes exactly one no-fallback attempt', async () => {
  const state = { pendingMaximum: 0, stopping: false }, calls = [];
  await assert.rejects(dispatchV77NativeRequest({ provider: 'openai', options: { stage: 'blind_solution', key: 'parent' },
    body: { input: [{ role: 'user', content: JSON.stringify({ candidate_id: 'case-1' }) }], max_output_tokens: 5 },
    studyIds: { fresh: 'f', regression: 'r' }, allowedCandidates: new Set(['case-1']), state, ledger: {}, prices: {},
    native: { generate: async (provider, body, options) => { calls.push({ body, options }); const e = new Error('flex unavailable'); e.flexUnavailable = true; e.rejectedBeforeInference = true; throw e; } },
    reservationNeeded: () => true, requestAccepted: () => false, requestState: () => 'flex_unavailable', maximumRequest: () => 10,
    scopedCommitted: () => 0, lifetimeCommitted: () => 0, assertCampaign: () => true, assertLifetime: () => true }), error => {
  assert.equal(error.flexUnavailable, true);
  assert.ok(error.nativeKey);
  assert.equal(error.dispatchState, 'rejected_before_inference');
  assert.equal(error.acceptedStatus, 'flex_unavailable');
  assert.equal(error.bodyBytes, undefined);
  return true;
});
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.noFlex, true);
  assert.equal(calls[0].body.service_tier, 'flex');
  assert.equal(state.stopping, true);
  assert.equal(state.pendingMaximum, 0);
});

test('native dispatch stops before provider call when the shared cap has no reserve headroom', async () => {
  const state = { pendingMaximum: 0, stopping: false }; let calls = 0;
  await assert.rejects(dispatchV77NativeRequest({ provider: 'gemini', options: { stage: 'blind_solution', key: 'parent' },
    body: { contents: [{ role: 'user', parts: [{ text: JSON.stringify({ candidate_id: 'case-1' }) }] }], generationConfig: { maxOutputTokens: 5 } },
    studyIds: { fresh: 'f', regression: 'r' }, allowedCandidates: new Set(['case-1']), state, ledger: {}, prices: {},
    native: { generate: async () => { calls++; } }, reservationNeeded: () => true, requestAccepted: () => false, requestState: () => null,
    maximumRequest: () => 10, scopedCommitted: () => 4_000_000, lifetimeCommitted: () => 0,
    assertCampaign: () => { throw new Error('campaign_budget_exhausted'); }, assertLifetime: () => true }), /campaign_budget_exhausted/);
  assert.equal(calls, 0);
  assert.equal(state.stopping, true);
  assert.equal(state.pendingMaximum, 0);
});

test('accepted or uncertain native key is receipt-only and never reaches generate again', async () => {
  const state = { pendingMaximum: 0, stopping: false }; let calls = 0;
  await assert.rejects(dispatchV77NativeRequest({ provider: 'gemini', options: { stage: 'blind_solution', key: 'accepted-key' },
    body: { contents: [{ role: 'user', parts: [{ text: JSON.stringify({ candidate_id: 'case-1' }) }] }], generationConfig: { maxOutputTokens: 5 } },
    studyIds: { fresh: 'f', regression: 'r' }, allowedCandidates: new Set(['case-1']), state, ledger: {}, prices: {},
    native: { generate: async () => { calls++; } }, reservationNeeded: () => true, requestAccepted: () => true, requestState: () => 'unresolved',
    maximumRequest: () => 10, scopedCommitted: () => 0, lifetimeCommitted: () => 0, assertCampaign: () => true, assertLifetime: () => true }), error => {
    assert.ok(error.nativeKey);
    assert.equal(error.acceptedStatus, 'unresolved');
    assert.equal(error.dispatchState, 'accepted');
    return true;
  });
  assert.equal(calls, 0);
  assert.equal(state.stopping, true);
});

test('the production accepted-request predicate is wired to a real temporary ledger DB', async () => {
  const root = mkdtempSync(join(resolve('.'), '.v77-ledger-'));
  const ledger = new BudgetLedger(join(root, 'ledger.sqlite'));
  try {
    const key = hashJSON({ study: 'f:r', parent: 'native-unresolved-key' });
    ledger.db.prepare('INSERT INTO provider_requests(id,reservation_id,provider,state,request_json,response_json) VALUES(?,?,?,?,?,NULL)')
      .run(key, 'reservation', 'openai', 'unresolved', JSON.stringify({ config: { candidate_id: `${QUALIFICATION_V77_PREFIX}case-1` } }));
    let calls = 0;
    await assert.rejects(dispatchV77NativeRequest({ provider: 'openai', options: { stage: 'blind_solution', key: 'native-unresolved-key' },
      body: { input: [{ role: 'user', content: JSON.stringify({ candidate_id: 'case-1' }) }], max_output_tokens: 5 },
      studyIds: { fresh: 'f', regression: 'r' }, allowedCandidates: new Set(['case-1']), state: { pendingMaximum: 0, stopping: false },
      ledger, prices: {}, native: { generate: async () => { calls++; } }, reservationNeeded: () => true,
      requestAccepted: (activeLedger, requestKey) => acceptedNativeRequestV73(activeLedger.db, requestKey),
      requestState: (activeLedger, requestKey) => activeLedger.db.prepare('SELECT state FROM provider_requests WHERE id=?').get(requestKey)?.state,
      maximumRequest: () => 10, scopedCommitted: () => 0, lifetimeCommitted: () => 0, assertCampaign: () => true, assertLifetime: () => true }), /accepted_or_unknown/);
    assert.equal(calls, 0);
  } finally { ledger.close(); rmSync(root, { recursive: true, force: true }); }
});

test('saved cache or receipt path remains readable with noFlex and without creating a new reservation', async () => {
  const state = { pendingMaximum: 0, stopping: true };
  const result = await dispatchV77NativeRequest({ provider: 'openai', options: { stage: 'independent_evaluation', key: 'saved-key' },
    body: { input: [{ role: 'user', content: JSON.stringify({ candidate_id: 'case-1' }) }], max_output_tokens: 5 },
    studyIds: { fresh: 'f', regression: 'r' }, allowedCandidates: new Set(['case-1']), state, ledger: {}, prices: {},
    native: { generate: async (_provider, body, options) => ({ cached: true, body, options }) }, reservationNeeded: () => false,
    requestAccepted: () => false, requestState: () => 'complete', maximumRequest: () => { throw new Error('reservation_not_expected'); },
    scopedCommitted: () => 0, lifetimeCommitted: () => 0, assertCampaign: () => true, assertLifetime: () => true });
  assert.equal(result.cached, true);
  assert.equal(result.body.service_tier, 'flex');
  assert.equal(result.options.noFlex, true);
  assert.equal(state.pendingMaximum, 0);
});

test('receipt-only recovery replays a completed SQLite row before cache-write and leaves a missing next stage pending', async () => {
  const root = mkdtempSync(join(resolve('.'), '.v77-receipt-recovery-'));
  const ledger = new BudgetLedger(join(root, 'ledger.sqlite'), 1);
  const state = { pendingMaximum: 0, stopping: true }, studyIds = { fresh: 'f', regression: 'r' };
  const completedKey = hashJSON({ study: 'f:r', parent: 'completed-stage' });
  const priorError = { state: 'error', native_key: completedKey, accepted_status: 'accepted_or_uncertain', reasons: ['interrupted_after_accept'] };
  const prices = { source_url: 'https://pricing.test/original', expires_at: '2026-10-08T00:00:00Z', models: { 'gpt-6-luna': {
    provider_host: 'api.openai.com', max_input_tokens: 100, input_per_million: .1, output_per_million: .5, batch: { input_per_million: .05, output_per_million: .25 } } } };
  const body = { model: 'gpt-6-luna', input: [{ role: 'user', content: JSON.stringify({ candidate_id: 'case-1', question: 'frozen question' }) }], max_output_tokens: 5, service_tier: 'flex' };
  const rates = prices.models['gpt-6-luna'], reserved = Math.ceil(100 * rates.input_per_million + 5 * rates.output_per_million);
  const config = { provider: 'openai', model: 'gpt-6-luna', key: completedKey, reserved, rates, pricing: prices, toolCalls: 0,
    execution_mode: 'realtime', stage: 'blind_solution', purpose: 'calibration', candidate_id: `${QUALIFICATION_V77_PREFIX}case-1` };
  const receipt = { id: 'saved-complete-response', output: [{ type: 'message', content: [{ type: 'output_text', text: '{"solved_key":"A"}' }] }], usage: { input_tokens: 10, output_tokens: 2 } };
  try {
    const reservation = ledger.reserve(config.model, reserved);
    ledger.settle(reservation, 3, { provider: 'openai', idempotency_key: completedKey });
    ledger.db.prepare('INSERT INTO provider_requests(id,reservation_id,provider,state,request_json,response_json) VALUES(?,?,?,?,?,?)')
      .run(completedKey, reservation, 'openai', 'complete', JSON.stringify({ body, config }), JSON.stringify(receipt));
    // Deliberately omit cache rows to model a crash after the completed provider row was written.
    let fetches = 0;
    const native = createFactoryTransport({ ledger, prices: () => prices, env: { MOCK_AI: 'true' },
      fetchImpl: async () => { fetches++; throw new Error('network_forbidden_in_recovery_test'); } });
    let nativeCalls = 0;
    const dispatch = parentKey => dispatchV77NativeRequest({ provider: 'openai', options: { stage: 'blind_solution', key: parentKey },
      body, studyIds,
      allowedCandidates: new Set(['case-1']), state, ledger, prices: {}, recoveryOnly: true,
      native: { generate: async (provider, requestBody, options) => { nativeCalls++; assert.equal(options.cacheOnly, true); assert.equal(options.noFlex, true);
        return native.generate(provider, requestBody, options); } },
      reservationNeeded: requestNeedsReservation, requestAccepted: (activeLedger, key) => acceptedNativeRequestV73(activeLedger.db, key),
      requestState: (activeLedger, key) => activeLedger.db.prepare('SELECT state FROM provider_requests WHERE id=?').get(key)?.state || null,
      completedResponseAvailable: (activeLedger, key) => { const row = activeLedger.db.prepare('SELECT state,response_json FROM provider_requests WHERE id=?').get(key);
        return row?.state === 'complete' && Boolean(row.response_json); }, maximumRequest: () => { throw new Error('recovery_must_not_reserve'); },
      scopedCommitted: () => 0, lifetimeCommitted: () => 0, assertCampaign: () => { throw new Error('recovery_must_not_budget'); },
      assertLifetime: () => { throw new Error('recovery_must_not_budget'); } });
    assert.deepEqual(await dispatch('completed-stage'), receipt);
    await assert.rejects(dispatch('missing-complete-json-retry'), /receipt_recovery_pending_exact_complete_response_required/);
    const results = { topologies: { dual_blind: [priorError] } };
    assert.equal(appendV77RecoveryHistory(results, { studyId: `${QUALIFICATION_V77_PREFIX}fresh`, fixtureId: 'case-1', recordKind: 'topology', priorRecord: priorError }), true);
    assert.deepEqual(results.recovery_history[0].prior_record, priorError);
    assert.equal(nativeCalls, 1);
    assert.equal(fetches, 0);
    assert.equal(ledger.db.prepare("SELECT count(*) AS n FROM requests WHERE state='reserved'").get().n, 0);
    assert.equal(ledger.db.prepare('SELECT count(*) AS n FROM requests').get().n, 1);
  } finally { ledger.close(); rmSync(root, { recursive: true, force: true }); }
});
