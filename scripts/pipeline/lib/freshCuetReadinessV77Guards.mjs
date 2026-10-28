import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { scopedAccounting, bodyCandidateId } from './scopedAccounting.mjs';
import { hashJSON } from '../../../data/question_factory_policy.mjs';
import { validationContractV77, FACTORY_VERIFIER_VERSION_V77, V77_ADDITIVE_FILES } from './contractV77.mjs';
import { V77_PROMPT_HASH, V77_EXPLANATION_AUDIT_INSTRUCTIONS } from './factoryEvidenceV77.mjs';
import { expectedReleaseBindingV76 } from './releaseEvidenceV76.mjs';

export const QUALIFICATION_V77_PREFIX = 'v77-qualification-2026-10-09-';
export const QUALIFICATION_V77_CAP_USD = 4;
export const LIFETIME_CAP_USD = 50;
export const MAX_INPUT_BODY_BYTES_V77 = 50_000;
export const V77_FREEZE_PATH = 'artifacts/question-factory/cuet-readiness-2026-10-09/v77-local-contract-freeze.json';
export const V77_TRANSPORT_FREEZE_PATH = 'artifacts/question-factory/cuet-readiness-2026-10-09/v77-local-transport-freeze.json';
export const V77_TRANSPORT_DEPENDENCIES = Object.freeze([
  "data/canonical_json.mjs",
  "data/canonical_syllabus.js",
  "data/content_evidence.js",
  "data/cuet_fit_evidence.mjs",
  "data/cuet_fit_rubric.mjs",
  "data/evidence_registry.js",
  "data/factory_runtime_evidence.mjs",
  "data/question_factory_criteria.mjs",
  "data/question_factory_policy.mjs",
  "data/question_factory_scope.json",
  "data/question_presentation.mjs",
  "data/v73_runtime_contract.mjs",
  "data/v73_runtime_evidence.mjs",
  "data/v74_runtime_contract.mjs",
  "scripts/pipeline/lib/atomicArtifact.mjs",
  "scripts/pipeline/lib/batchInspection.mjs",
  "scripts/pipeline/lib/budgetLedger.mjs",
  "scripts/pipeline/lib/campaignExecutionV7.mjs",
  "scripts/pipeline/lib/contractV7.mjs",
  "scripts/pipeline/lib/contractV73.mjs",
  "scripts/pipeline/lib/contractV74.mjs",
  "scripts/pipeline/lib/contractV76.mjs",
  "scripts/pipeline/lib/contractV77.mjs",
  "scripts/pipeline/lib/cuetExemplarPolicyVNext.mjs",
  "scripts/pipeline/lib/cuetFit.mjs",
  "scripts/pipeline/lib/cuetFitBenchmark.mjs",
  "scripts/pipeline/lib/currentCuetCalibrationGateVNext.mjs",
  "scripts/pipeline/lib/evidencePipeline.mjs",
  "scripts/pipeline/lib/factoryCore.mjs",
  "scripts/pipeline/lib/factoryEvidence.mjs",
  "scripts/pipeline/lib/factoryEvidenceV7.mjs",
  "scripts/pipeline/lib/factoryEvidenceV73.mjs",
  "scripts/pipeline/lib/factoryEvidenceV74.mjs",
  "scripts/pipeline/lib/factoryEvidenceV76.mjs",
  "scripts/pipeline/lib/factoryEvidenceV77.mjs",
  "scripts/pipeline/lib/factoryTransport.mjs",
  "scripts/pipeline/lib/freshCuetReadinessV73Guards.mjs",
  "scripts/pipeline/lib/freshCuetReadinessV77Guards.mjs",
  "scripts/pipeline/lib/optionResolutionAuditV77.mjs",
  "scripts/pipeline/lib/optionResolutionV77.mjs",
  "scripts/pipeline/lib/preparationValueV76.mjs",
  "scripts/pipeline/lib/releaseEvidenceV7.mjs",
  "scripts/pipeline/lib/releaseEvidenceV76.mjs",
  "scripts/pipeline/lib/releaseEvidenceV77.mjs",
  "scripts/pipeline/lib/savedRequestBody.mjs",
  "scripts/pipeline/lib/scopedAccounting.mjs",
  "scripts/pipeline/lib/verifyV77.mjs",
  "scripts/pipeline/tools/cuetFitBenchmarkItems.mjs",
  "scripts/pipeline/tools/cuetFitBenchmarkItemsV2.mjs",
  "scripts/pipeline/tools/cuetFitBenchmarkItemsV3.mjs",
  "scripts/pipeline/tools/runFreshCuetReadinessV77.mjs"
]);
export const V77_VALIDATION_CONTRACT_HASH = '614d423f795314c7661e952ca1f1bf41258b005586744172dd8ec3b32021ecd1';
export const V77_RAW_FREEZE_SHA256 = '632109c8225bd754326e3e47f7c0e2ab64428a9cb42f5288923115ce7b76c7ba';

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

export function expectedReleaseBindingV77() {
  return Object.freeze({
    ...expectedReleaseBindingV76(), verifier_version: FACTORY_VERIFIER_VERSION_V77,
    prompt_hash: V77_PROMPT_HASH, validation_contract_hash: validationContractV77(),
    parent_policy: 'cuet-fit-release-v2', fresh_false_accepts_max: 0,
    regression_false_accepts_max: 0, valid_survival_min: .85, per_subject_valid_survival_min: .7,
  });
}

export function verifyV77Freeze(repoRoot) {
  const path = join(repoRoot, V77_FREEZE_PATH), raw = readFileSync(path), freeze = JSON.parse(raw.toString('utf8'));
  if (sha256(raw) !== V77_RAW_FREEZE_SHA256 || freeze.validation_contract_hash !== V77_VALIDATION_CONTRACT_HASH ||
      validationContractV77() !== V77_VALIDATION_CONTRACT_HASH || freeze.verifier_version !== FACTORY_VERIFIER_VERSION_V77 ||
      freeze.prompt_hash !== V77_PROMPT_HASH || freeze.explanation_audit_instructions_sha256 !== sha256(V77_EXPLANATION_AUDIT_INSTRUCTIONS)) {
    throw new Error('v77_freeze_binding_mismatch');
  }
  for (const file of V77_ADDITIVE_FILES) {
    const relative = `scripts/pipeline/lib/${file}`;
    if (freeze.file_sha256?.[relative] !== sha256(readFileSync(join(repoRoot, relative)))) throw new Error(`v77_core_file_hash_mismatch:${relative}`);
  }
  if (freeze.qualification_state !== 'unqualified' || freeze.native_calls !== 0 || freeze.release_profile_created !== false || freeze.publication_enabled !== false)
    throw new Error('v77_local_unqualified_freeze_required');
  return { freeze, raw_sha256: V77_RAW_FREEZE_SHA256, validation_contract_hash: V77_VALIDATION_CONTRACT_HASH };
}

export function verifyV77TransportFreeze(repoRoot, dependencyFiles, { required = true } = {}) {
  const path = join(repoRoot, V77_TRANSPORT_FREEZE_PATH);
  if (!existsSync(path)) {
    if (required) throw new Error('v77_transport_freeze_required');
    return null;
  }
  const raw = readFileSync(path), freeze = JSON.parse(raw.toString('utf8'));
  const expectedFiles = [...dependencyFiles].sort(), actualFiles = Object.keys(freeze.files || {}).sort();
  if (freeze.schema !== 'v77-local-runner-transport-freeze-v1' || freeze.qualified !== false ||
      freeze.core_freeze_sha256 !== V77_RAW_FREEZE_SHA256 || freeze.validation_contract_hash !== V77_VALIDATION_CONTRACT_HASH ||
      !same(actualFiles, expectedFiles) || !Number.isFinite(Date.parse(freeze.frozen_at))) throw new Error('v77_transport_freeze_binding_mismatch');
  for (const file of expectedFiles) if (freeze.files[file] !== sha256(readFileSync(join(repoRoot, file)))) throw new Error(`v77_transport_dependency_hash_mismatch:${file}`);
  return { freeze, raw_sha256: sha256(raw), transport_hash: hashJSON(freeze.files), frozen_at: freeze.frozen_at };
}

const normalizeCaseText = value => String(value ?? '').normalize('NFKC').toLocaleLowerCase('en').replace(/\s+/g, ' ').trim();
const optionText = option => typeof option === 'string' ? option : typeof option?.text === 'string' ? option.text : JSON.stringify(option ?? null);
export function normalizedCaseFingerprint(fixture) {
  const candidate = fixture?.candidate || {};
  return hashJSON({ body: normalizeCaseText(candidate.body), passage: normalizeCaseText(candidate.passage_text),
    options: (candidate.options || []).map(option => normalizeCaseText(optionText(option))).sort() });
}
export function assertNoPriorV75V76CaseReuse(freshFixtures, priorFixtures) {
  const prior = new Map((priorFixtures || []).map(f => [normalizedCaseFingerprint(f), f.id]));
  const duplicates = (freshFixtures || []).filter(f => prior.has(normalizedCaseFingerprint(f))).map(f => ({ id: f.id, prior_id: prior.get(normalizedCaseFingerprint(f)) }));
  if (duplicates.length) throw new Error(`prior_inspected_case_reused_as_fresh:${JSON.stringify(duplicates)}`);
  return true;
}
export function assertV77StudySlotBinding(freshId, regressionId, freshFixtures, regressionFixtures) {
  if (!freshId?.startsWith(QUALIFICATION_V77_PREFIX) || !regressionId?.startsWith(QUALIFICATION_V77_PREFIX) || freshId === regressionId ||
      freshFixtures?.release_eligibility?.classification !== 'fresh' || regressionFixtures?.release_eligibility?.classification !== 'regression')
    throw new Error('v77_study_slot_or_classification_mismatch');
  const freshIds = new Set((freshFixtures.fixtures || []).map(f => f.id));
  const overlap = (regressionFixtures.fixtures || []).filter(f => freshIds.has(f.id)).map(f => f.id);
  if (overlap.length) throw new Error(`fresh_and_regression_fixture_ids_overlap:${overlap.join(',')}`);
  return true;
}
export function appendV77RecoveryHistory(results, { studyId, fixtureId, recordKind, priorRecord, nativeKey, at = new Date().toISOString() }) {
  if (!priorRecord || priorRecord.state !== 'error' && priorRecord.status !== 'error') return false;
  results.recovery_history ||= [];
  results.recovery_history.push({ at, study_id: studyId, fixture_id: fixtureId, record_kind: recordKind,
    native_key: nativeKey || priorRecord.native_key || null, prior_record: JSON.parse(JSON.stringify(priorRecord)) });
  return true;
}
export function assertFreshV77Study({ frozen, custody, caseReview, freezeSha256, freezeAt, transportFreezeSha256, transportFreezeAt, custodySha256, caseReviewSha256 }) {
  const times = [frozen?.created_at, frozen?.freshness_custody?.case_construction_started_at,
    frozen?.freshness_custody?.source_derivations_completed_at, frozen?.freshness_custody?.labels_custody_completed_at, custody?.at];
  const freezeTime = Math.max(Date.parse(freezeAt), Date.parse(transportFreezeAt)), registered = Date.parse(frozen?.registered_at || '');
  if (!Number.isFinite(freezeTime) || !Number.isFinite(registered) || registered <= freezeTime || times.some(t => !Number.isFinite(Date.parse(t)) || Date.parse(t) <= freezeTime || Date.parse(t) > registered))
    throw new Error('v77_fresh_cases_and_custody_must_follow_freeze_and_precede_registration');
  const ids = (frozen.fixtures || []).map(f => f.id), positive = frozen.fixtures.filter(f => f.expected_valid === true).map(f => f.id), invalid = frozen.fixtures.filter(f => f.expected_valid === false).map(f => f.id);
  const freshness = frozen.freshness_custody;
  if (!freshness || !Array.isArray(freshness.case_ids) || !Array.isArray(custody?.case_ids) || !Array.isArray(custody?.positive_ids) || !Array.isArray(custody?.invalid_ids) ||
      freshness.contract_freeze_sha256 !== freezeSha256 || freshness.cases_created_after_contract_freeze !== true ||
      freshness.transport_freeze_sha256 !== transportFreezeSha256 ||
      freshness.labels_locked_before_registration !== true || freshness.custody_sha256 !== custodySha256 ||
      freshness.case_level_review_sha256 !== caseReviewSha256 || !Array.isArray(caseReview?.fixture_ids) || caseReview?.freeze_sha256 !== freezeSha256 ||
      caseReview?.transport_freeze_sha256 !== transportFreezeSha256 ||
      caseReview?.reviewer_independent !== true || caseReview?.semantic_case_reuse_review !== true || caseReview?.number_only_variants_reviewed !== true ||
      !same([...caseReview.fixture_ids].sort(), [...ids].sort()) || !Number.isFinite(Date.parse(caseReview.reviewed_at)) ||
      Date.parse(caseReview.reviewed_at) <= freezeTime || Date.parse(caseReview.reviewed_at) > registered ||
      JSON.stringify([...freshness.case_ids].sort()) !== JSON.stringify([...ids].sort()) ||
      JSON.stringify([...custody.case_ids].sort()) !== JSON.stringify([...ids].sort()) ||
      JSON.stringify([...custody.positive_ids].sort()) !== JSON.stringify([...positive].sort()) ||
      JSON.stringify([...custody.invalid_ids].sort()) !== JSON.stringify([...invalid].sort()))
    throw new Error('v77_fresh_case_label_custody_binding_required');
  return true;
}

export function assertV77Authorization(evidence, { freezeSha256, contractHash, freshId, regressionId, studyPayloads, transportFreezeHash, executionPlanHashes }) {
  if (!evidence || evidence.authorization_type !== 'explicit_user' || evidence.authorized !== true ||
      evidence.freeze_sha256 !== freezeSha256 || evidence.validation_contract_hash !== contractHash ||
      evidence.qualification_budget_prefix !== QUALIFICATION_V77_PREFIX || evidence.cap_usd !== QUALIFICATION_V77_CAP_USD ||
      !Array.isArray(evidence.study_ids) || !same(evidence.study_ids, [freshId, regressionId]) ||
      !same(evidence.study_payloads, studyPayloads) || evidence.transport_freeze_hash !== transportFreezeHash ||
      !same(evidence.execution_plan_hashes, executionPlanHashes) ||
      typeof evidence.issued_at !== 'string' || !Number.isFinite(Date.parse(evidence.issued_at))) {
    throw new Error('explicit_scope_bound_v77_user_authorization_required');
  }
  return true;
}

export function assertExecutionPlanV77(plan, { id, binding, inputHashes, registryHash, denominator, validRoots, controlledDefects, classification }) {
  if (!id?.startsWith(QUALIFICATION_V77_PREFIX) || plan?.id !== id || plan.publication !== 'never' ||
      plan.maximum_content_repairs !== 0 || plan.regeneration !== false || plan.cap_usd !== QUALIFICATION_V77_CAP_USD ||
      plan.lifetime_cap_usd !== LIFETIME_CAP_USD || plan.qualification_budget_prefix !== QUALIFICATION_V77_PREFIX ||
      plan.topology !== 'dual_blind' || plan.denominator !== denominator || plan.valid_roots !== validRoots ||
      plan.controlled_defects !== controlledDefects || plan.classification !== classification ||
      !same(plan.contract_binding, binding) || !same(plan.input_hashes, inputHashes) || plan.source_registry_hash !== registryHash ||
      plan.max_input_body_bytes !== MAX_INPUT_BODY_BYTES_V77 || plan.native_batch !== false || plan.providers?.join(',') !== 'openai,gemini' ||
      plan.transport_mode !== 'openai_explicit_flex_only_no_fallback;gemini_realtime')
    throw new Error('registered_v77_inputs_or_runner_changed');
  return true;
}

export function qualificationAccountingV77(ledger) { return scopedAccounting(ledger, QUALIFICATION_V77_PREFIX); }

export function assertRequestBodyBoundV77(provider, body, limit = MAX_INPUT_BODY_BYTES_V77) {
  const bytes = Buffer.byteLength(JSON.stringify(body), 'utf8');
  if (!Number.isSafeInteger(limit) || limit !== MAX_INPUT_BODY_BYTES_V77 || bytes > limit)
    throw Object.assign(new Error(`v77_full_request_body_exceeds_reserved_bytes:${bytes}/${limit}`), { dispatchState: 'guard_blocked', bodyBytes: bytes });
  return bytes;
}

// The production runner and mocked tests share this dispatch seam. All request bodies are
// materialized and bounded before keys/reservations; OpenAI gets one explicit Flex-only attempt.
export async function dispatchV77NativeRequest({ provider, body, options = {}, studyIds, allowedCandidates, native, ledger, prices,
  state, reservationNeeded, requestAccepted, requestState, maximumRequest, scopedCommitted, lifetimeCommitted, assertCampaign, assertLifetime,
  auditGuard, recoveryOnly = false, completedResponseAvailable = () => false }) {
  const finalBody = provider === 'openai' && ['blind_solution','independent_evaluation','explanation_support'].includes(options.stage) && !body.service_tier
    ? { ...body, service_tier: 'flex' } : body;
  const key = hashJSON({ study: `${studyIds.fresh}:${studyIds.regression}`, parent: options.key });
  const stop = message => { state.stopping = true; return Object.assign(new Error(message), { nativeKey: key, acceptedStatus: 'not_dispatched', dispatchState: 'guard_blocked' }); };
  try {
    assertRequestBodyBoundV77(provider, finalBody);
    if (options.stage === 'explanation_support') auditGuard?.(provider, finalBody);
  } catch (error) {
    error.nativeKey = key; error.acceptedStatus = 'not_dispatched'; error.dispatchState = 'guard_blocked'; state.stopping = true; throw error;
  }
  if (requestAccepted(ledger, key)) {
    state.stopping = true;
    throw Object.assign(new Error('accepted_or_unknown_provider_request_exists_no_resubmit'), { nativeKey: key,
      acceptedStatus: requestState(ledger, key) || 'accepted_or_uncertain', dispatchState: 'accepted' });
  }
  const generate = async (extra = {}) => {
    try { return await native.generate(provider, finalBody, { ...options, ...extra, key, batch: false, noFlex: true, ...(recoveryOnly ? { cacheOnly: true } : {}) }); }
    catch (error) {
      const stateValue = requestState(ledger, key);
      const accepted = requestAccepted(ledger, key);
      error.nativeKey = key;
      error.nativeRequestState = stateValue;
      error.acceptedStatus = accepted ? 'accepted_or_uncertain' : stateValue || (error.rejectedBeforeInference ? 'rejected_before_inference' : 'unknown');
      error.dispatchState = error.rejectedBeforeInference === true ? 'rejected_before_inference' : accepted ? 'accepted' : 'unknown';
      state.stopping = true;
      throw error;
    }
  };
  // Saved complete receipts/cache entries remain readable during a drain. The native adapter
  // checks the durable key before any provider path; stop only prevents a new reservation.
  const needsReservation = reservationNeeded(ledger, key);
  if (recoveryOnly) {
    if (needsReservation || requestState(ledger, key) !== 'complete' || !completedResponseAvailable(ledger, key)) {
      state.stopping = true;
      throw Object.assign(new Error('v77_receipt_recovery_pending_exact_complete_response_required'), {
        nativeKey: key, acceptedStatus: requestState(ledger, key) || 'missing', nativeRequestState: requestState(ledger, key), dispatchState: 'guard_blocked' });
    }
    return generate();
  }
  if (!needsReservation) return generate();
  if (state.stopping) throw stop('v77_phase_draining_stop');
  const candidate = bodyCandidateId(provider, finalBody);
  if (!allowedCandidates.has(candidate)) throw stop('registered_v77_study_candidate_required');
  const maximum = maximumRequest(provider, finalBody, prices);
  try {
    assertCampaign(scopedCommitted(ledger) + state.pendingMaximum, maximum);
    assertLifetime(lifetimeCommitted(ledger) + state.pendingMaximum, maximum);
  } catch (error) {
    error.nativeKey = key; error.acceptedStatus = 'not_dispatched'; error.dispatchState = 'guard_blocked'; state.stopping = true; throw error;
  }
  state.pendingMaximum += maximum;
  try { return await generate({ purpose: 'calibration', candidate_id: QUALIFICATION_V77_PREFIX + candidate }); }
  finally { state.pendingMaximum -= maximum; }
}

export function assertLifetimeBoundV77(lifetimeCommittedMicro, maximumMicro) {
  if (!Number.isSafeInteger(lifetimeCommittedMicro) || lifetimeCommittedMicro < 0 || !Number.isSafeInteger(maximumMicro) || maximumMicro <= 0 ||
      lifetimeCommittedMicro + maximumMicro > Math.floor(LIFETIME_CAP_USD * 1e6)) throw new Error('v77_persistent_lifetime_budget_exhausted');
  return true;
}

export function assertPriceExpiryV77(prices, now = Date.now()) {
  const expiry = Date.parse(prices?.expires_at || '');
  if (!Number.isFinite(expiry) || !Number.isFinite(now) || expiry <= now) throw new Error('v77_pricing_evidence_expired_or_missing');
  return expiry;
}

// One lease covers the complete fresh + regression qualification phase.
export function acquireQualificationLeaseV77(directory, { pid = process.pid, isPidAlive = value => {
  try { process.kill(value, 0); return true; } catch (e) { if (e.code === 'ESRCH') return false; return true; }
} } = {}) {
  mkdirSync(directory, { recursive: true });
  const file = join(directory, 'v77-qualification-owner.json'), owner = { pid, nonce: randomUUID(), started_at: new Date().toISOString() };
  try { writeFileSync(file, JSON.stringify(owner), { flag: 'wx' }); }
  catch (e) {
    if (e.code !== 'EEXIST') throw e;
    let old;
    try { old = JSON.parse(readFileSync(file, 'utf8')); } catch { throw new Error('qualification_owner_live_or_uncertain_no_duplicate_runner'); }
    if (!Number.isInteger(old.pid) || isPidAlive(old.pid)) throw new Error('qualification_owner_live_or_uncertain_no_duplicate_runner');
    renameSync(file, join(directory, `v77-qualification-owner-ended-${old.nonce || randomUUID()}.json`));
    writeFileSync(file, JSON.stringify(owner), { flag: 'wx' });
  }
  return () => {
    const current = JSON.parse(readFileSync(file, 'utf8'));
    if (current.nonce !== owner.nonce || current.pid !== pid) throw new Error('qualification_owner_changed_preserve_lease');
    renameSync(file, join(directory, `v77-qualification-owner-drained-${owner.nonce}.json`));
  };
}
