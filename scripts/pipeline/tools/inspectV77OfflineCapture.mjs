// Local-only prospective V7.7 qualification runner. Default report is read-only and never opens the budget DB.
import { createHash } from 'node:crypto';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { resolve, relative, isAbsolute, join } from 'node:path';
import { BudgetLedger } from '../lib/budgetLedger.mjs';
import { createFactoryTransport } from '../lib/factoryTransport.mjs';
import { createFactoryEvidenceV77, blindViewV77, TOPOLOGIES } from '../lib/factoryEvidenceV77.mjs';
import { validateFactoryCandidateV77 } from '../lib/verifyV77.mjs';
import { expectedReleaseBindingV77, verifyV77Freeze, verifyV77TransportFreeze, V77_TRANSPORT_DEPENDENCIES, assertV77Authorization, assertExecutionPlanV77, assertRequestBodyBoundV77, assertLifetimeBoundV77, assertPriceExpiryV77, acquireQualificationLeaseV77, assertFreshV77Study, assertNoPriorV75V76CaseReuse, assertV77StudySlotBinding, appendV77RecoveryHistory, normalizedCaseFingerprint, QUALIFICATION_V77_PREFIX, QUALIFICATION_V77_CAP_USD, LIFETIME_CAP_USD, MAX_INPUT_BODY_BYTES_V77, qualificationAccountingV77, dispatchV77NativeRequest } from '../lib/freshCuetReadinessV77Guards.mjs';
import { REQUIRED_SUBJECTS, assessReleaseEvidenceV77 } from '../lib/releaseEvidenceV77.mjs';
import { payloadHash } from '../lib/cuetFitBenchmark.mjs';
import { assertReleaseEvidenceRoleV73, assertBenchmarkProvenanceV73, assertCustodySetV73, FRESH_V73_PROVENANCE_NOTICE,
  acceptedNativeRequestV73, evaluationFailureStatusV73, evaluationResumeActionV73, retainedAcceptedEvaluationV73, inspectBlindCaptureV73 } from '../lib/freshCuetReadinessV73Guards.mjs';
import { assertCampaignBudget, maximumRequestMicro, requestNeedsReservation } from '../lib/campaignExecutionV7.mjs';
import { saveAtomicArtifact, drainConcurrent } from '../lib/atomicArtifact.mjs';
import { bodyCandidateId, scopedAccounting } from '../lib/scopedAccounting.mjs';
import { hashJSON, provenanceReasons } from '../../../data/question_factory_policy.mjs';
import { effortsFor } from '../../../data/cuet_fit_evidence.mjs';
import { structureVerdict } from '../lib/evidencePipeline.mjs';
import { presentationLint } from '../../../data/question_presentation.mjs';

const action = process.argv[2] || 'report';
const arg = name => { const i = process.argv.indexOf(name); return i < 0 ? null : process.argv[i + 1] || null; };
const repoRoot = resolve('.');
const freezeInfo = verifyV77Freeze(repoRoot);
const binding = expectedReleaseBindingV77();
const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const json = path => JSON.parse(readFileSync(path, 'utf8'));
const registeredRoot = resolve('artifacts/question-factory/cuet-readiness-2026-10-09/v77-qualification');
const PRIOR_FROZEN_PATHS = Object.freeze([
  'artifacts/question-factory/cuet-readiness-2026-10-08/benchmark/fresh-official-source-v73/frozen.json',
  'artifacts/question-factory/cuet-readiness-2026-10-08/benchmark/fresh-official-source-v73-model/frozen.json',
  'artifacts/question-factory/cuet-readiness-2026-10-08/benchmark/v73-regression-proposal-2026-10-08/frozen.json',
  'artifacts/question-factory/cuet-readiness-2026-10-08/benchmark/v73-regression-semantic-view-2026-10-08/frozen.json',
  'artifacts/question-factory/cuet-readiness-2026-10-08/benchmark/v73-regression-semantic-view-final-2026-10-08/frozen.json',
  'artifacts/question-factory/cuet-readiness-2026-10-08/benchmark/v74-known-critical-regression-2026-10-08/frozen.json',
  'artifacts/question-factory/cuet-readiness-2026-10-08/benchmark/v74-prerequisite-diagnostic-2026-10-08/frozen.json',
  'artifacts/question-factory/cuet-readiness-2026-10-09/benchmark/v75-fresh-cbse2022-2026-10-09/frozen.json',
  'artifacts/question-factory/cuet-readiness-2026-10-09/benchmark/v75-known-critical-regression-2026-10-09/frozen.json',
  'artifacts/question-factory/cuet-readiness-2026-10-09/benchmark/v76-qualification-2026-10-09-fresh/frozen.json',
  'artifacts/question-factory/cuet-readiness-2026-10-09/benchmark/v76-qualification-2026-10-09-regression/frozen.json',
  'artifacts/question-factory/cuet-readiness-2026-10-09/benchmark/v76-qualification-2026-10-09-fresh-bounded-input/frozen.json',
  'artifacts/question-factory/cuet-readiness-2026-10-09/benchmark/v76-qualification-2026-10-09-regression-bounded-input/frozen.json',
]);
const HISTORY_REVIEW_PATH = 'artifacts/question-factory/cuet-readiness-2026-10-09/execution/v76-case-freshness-check.md';
const studyDirs = { fresh: arg('--fresh-dir'), regression: arg('--regression-dir') };
const inside = path => { const r = relative(registeredRoot, path); return Boolean(r) && !r.startsWith('..') && !isAbsolute(r); };

if (action === 'report' && !studyDirs.fresh && !studyDirs.regression) {
  const transportFreeze = verifyV77TransportFreeze(repoRoot, V77_TRANSPORT_DEPENDENCIES, { required: false });
  console.log(JSON.stringify({ mode: 'local_only', v77_freeze_sha256: freezeInfo.raw_sha256, validation_contract_hash: freezeInfo.validation_contract_hash,
    scope_prefix: QUALIFICATION_V77_PREFIX, shared_cap_usd: QUALIFICATION_V77_CAP_USD, lifetime_cap_usd: LIFETIME_CAP_USD,
    max_full_request_body_bytes: MAX_INPUT_BODY_BYTES_V77, transport_freeze_sha256: transportFreeze?.raw_sha256 || null,
    native_execution_enabled: false, registered_studies: [],
    note: 'No V77 study registration, cases, authorization evidence, budget database access, or provider activity was created.' }, null, 2));
  process.exit(0);
}
if (!['prepare', 'preflight', 'report', 'execute', 'recover'].includes(action)) throw new Error('unknown_v77_runner_action');
const transportFreeze = verifyV77TransportFreeze(repoRoot, V77_TRANSPORT_DEPENDENCIES, { required: true });
const registeredPrices = json('data/pipeline-prices.json');
if (!['report','recover'].includes(action)) assertPriceExpiryV77(registeredPrices);
if (!studyDirs.fresh || !studyDirs.regression) throw new Error('both_fixed_v77_study_directories_required');
for (const [name, value] of Object.entries(studyDirs)) {
  studyDirs[name] = resolve(value);
  if (!inside(studyDirs[name])) throw new Error('v77_study_directory_outside_fixed_local_scope');
}
const frozen = Object.fromEntries(Object.entries(studyDirs).map(([name, dir]) => [name, json(join(dir, 'frozen.json'))]));
const ids = Object.fromEntries(Object.entries(frozen).map(([name, f]) => [name, f.id]));
const authorizationPath = arg('--authorization');
if (ids.fresh === ids.regression || !ids.fresh?.startsWith(QUALIFICATION_V77_PREFIX) || !ids.regression?.startsWith(QUALIFICATION_V77_PREFIX)) throw new Error('fixed_v77_fresh_and_regression_ids_required');

const snapshots = {};
for (const path of PRIOR_FROZEN_PATHS) if (!existsSync(path)) throw new Error(`required_prior_case_history_missing:${path}`);
if (!existsSync(HISTORY_REVIEW_PATH)) throw new Error('required_v76_case_freshness_review_missing');
const historyReview = readFileSync(HISTORY_REVIEW_PATH, 'utf8');
if (!historyReview.includes('264 fixture rows') || !historyReview.includes('90 distinct subject/stem/options records')) throw new Error('prior_case_history_review_contract_changed');
const priorHistory = Object.fromEntries(PRIOR_FROZEN_PATHS.map(path => {
  const prior = json(path), fixtureHashes = Object.fromEntries((prior.fixtures || []).map(f => [f.id, hashJSON({ id: f.id, fingerprint: normalizedCaseFingerprint(f) })]));
  if (!prior.fixtures?.length) throw new Error(`required_prior_case_history_empty:${path}`);
  return [path, { sha256: sha(path), fixture_hashes: fixtureHashes, fixtures: prior.fixtures }];
}));
for (const name of ['fresh', 'regression']) {
  const f = frozen[name], dir = studyDirs[name], overlay = json(join(dir, 'scratch-registry-overlay.json')), custody = json(join(dir, 'independent-key-custody.json'));
  const fixtureIds = f.fixtures?.map(x => x.id) || [], positive = f.fixtures?.filter(x => x.expected_valid === true) || [], defects = f.fixtures?.filter(x => x.expected_valid === false) || [];
  if (!fixtureIds.length || new Set(fixtureIds).size !== fixtureIds.length || payloadHash(f.fixtures) !== f.payload_hash || JSON.stringify(f.contract_binding) !== JSON.stringify(binding)) throw new Error(`frozen_v77_study_contract_invalid:${name}`);
  if (fixtureIds.length !== f.denominator || positive.length !== f.valid_roots || defects.length !== f.controlled_defects) throw new Error(`fixed_v77_denominator_mismatch:${name}`);
  if (name === 'fresh') for (const subject of REQUIRED_SUBJECTS) if (!positive.some(x => x.candidate?.subject === subject)) throw new Error('four_subject_positive_coverage_required');
  assertReleaseEvidenceRoleV73(f.release_eligibility);
  assertBenchmarkProvenanceV73(f.fixtures, f.release_eligibility.classification);
  assertCustodySetV73({ fixtureIds, positiveIds: positive.map(x => x.id), custody });
  if (name === 'fresh') {
    const caseReviewPath = join(dir, 'case-freshness-review.json'), caseReview = json(caseReviewPath);
    assertFreshV77Study({ frozen: f, custody, freezeSha256: freezeInfo.raw_sha256, freezeAt: freezeInfo.freeze.frozen_at,
      transportFreezeSha256: transportFreeze.raw_sha256, transportFreezeAt: transportFreeze.frozen_at,
      custodySha256: sha(join(dir, 'independent-key-custody.json')), caseReview, caseReviewSha256: sha(caseReviewPath) });
    assertNoPriorV75V76CaseReuse(f.fixtures, Object.values(priorHistory).flatMap(item => item.fixtures));
  }
  snapshots[name] = { f, overlay, fixtureIds, positive, defects, run: join(dir, 'run'), classification: name };
}
assertV77StudySlotBinding(ids.fresh, ids.regression, snapshots.fresh.f, snapshots.regression.f);
const sourceRegistry = json('data/source_registry.json');
for (const [name, s] of Object.entries(snapshots)) {
  const localRegistry = { ...sourceRegistry, sources: { ...sourceRegistry.sources, ...s.overlay.sources },
    families: { ...sourceRegistry.families, ...s.overlay.families }, packs: { ...sourceRegistry.packs, ...s.overlay.packs } };
  if (action !== 'recover') {
    const localFailures = s.positive.map(fixture => ({ id: fixture.id, reasons: [...structureVerdict(fixture.candidate).reasons,
      ...presentationLint(fixture.candidate), ...provenanceReasons(fixture.candidate, localRegistry)] })).filter(x => x.reasons.length);
    if (localFailures.length) throw new Error(`positive_fixture_local_failures_before_spend:${name}:${JSON.stringify(localFailures)}`);
  }
  s.localRegistry = localRegistry;
}

const inputHashes = () => ({ freeze: freezeInfo.raw_sha256, v77_contract: freezeInfo.validation_contract_hash,
  fresh: { frozen: sha(join(studyDirs.fresh, 'frozen.json')), overlay: sha(join(studyDirs.fresh, 'scratch-registry-overlay.json')),
    custody: sha(join(studyDirs.fresh, 'independent-key-custody.json')), case_review: sha(join(studyDirs.fresh, 'case-freshness-review.json')) },
  regression: { frozen: sha(join(studyDirs.regression, 'frozen.json')), overlay: sha(join(studyDirs.regression, 'scratch-registry-overlay.json')),
    custody: sha(join(studyDirs.regression, 'independent-key-custody.json')) },
  source_registry: sha('data/source_registry.json'), prices: sha('data/pipeline-prices.json'), binding,
  transport_freeze: transportFreeze.raw_sha256, transport_dependency_hash: transportFreeze.transport_hash,
  transport_dependencies: Object.fromEntries(V77_TRANSPORT_DEPENDENCIES.map(path => [path, sha(path)])),
  prior_case_history_review: sha(HISTORY_REVIEW_PATH),
  prior_case_frozen_hashes: Object.fromEntries(Object.entries(priorHistory).map(([path, value]) => [path, value.sha256])),
  prior_case_fixture_hashes: Object.fromEntries(Object.entries(priorHistory).map(([path, value]) => [path, value.fixture_hashes])) });
const registryFor = s => s.localRegistry;
const checkSources = (fixtures, registry) => {
  for (const f of fixtures) for (const ref of f.candidate.source_refs || []) {
    const source = registry.sources?.[ref.id];
    if (source?.state !== 'active' || !source.reuse_permitted || source.version !== ref.version || source.supports?.[ref.locator] !== ref.support_hash ||
        hashJSON(source.facts?.[ref.locator]?.text) !== ref.support_hash) throw new Error(`registered_support_contract_changed:${f.id}`);
  }
};
const planPaths = Object.fromEntries(Object.entries(studyDirs).map(([n,d]) => [n, join(d, 'run', 'execution-plan.json')]));
const plans = {};
for (const [name, s] of Object.entries(snapshots)) {
  const registry = registryFor(s); checkSources(s.f.fixtures, registry);
  const localFailures = s.positive.map(fixture => ({ id: fixture.id, reasons: [...structureVerdict(fixture.candidate).reasons,
    ...presentationLint(fixture.candidate), ...provenanceReasons(fixture.candidate, registry)] })).filter(x => x.reasons.length);
  if (localFailures.length) throw new Error(`positive_fixture_local_failures:${JSON.stringify(localFailures)}`);
  plans[name] = { id: ids[name], classification: name, cap_usd: QUALIFICATION_V77_CAP_USD, lifetime_cap_usd: LIFETIME_CAP_USD,
    qualification_budget_prefix: QUALIFICATION_V77_PREFIX, contract_binding: binding, denominator: s.fixtureIds.length,
    valid_roots: s.positive.length, controlled_defects: s.defects.length, source_registry: registry,
    source_registry_hash: hashJSON(registry), input_hashes: action === 'recover' ? json(planPaths[name]).input_hashes : inputHashes(), max_input_body_bytes: MAX_INPUT_BODY_BYTES_V77,
    maximum_content_repairs: 0, publication: 'never', regeneration: false, topology: 'dual_blind', providers: ['openai','gemini'], native_batch: false,
    transport_mode: 'openai_explicit_flex_only_no_fallback;gemini_realtime', transport_freeze_sha256: transportFreeze.raw_sha256,
    provenance_notice: FRESH_V73_PROVENANCE_NOTICE };
}
const planIntentHash = plan => hashJSON({ ...plan, created_at: undefined });
const studyPayloads = Object.fromEntries(['fresh','regression'].map(name => [name, ({ payload_hash: frozen[name].payload_hash,
  frozen_sha256: sha(join(studyDirs[name], 'frozen.json')), custody_sha256: sha(join(studyDirs[name], 'independent-key-custody.json')) })]));
const executionPlanHashes = { fresh: planIntentHash(plans.fresh), regression: planIntentHash(plans.regression) };
if (action === 'prepare' || action === 'execute') {
  if (!authorizationPath) throw new Error('explicit_scope_bound_v77_user_authorization_required');
  assertV77Authorization(json(resolve(authorizationPath)), { freezeSha256: freezeInfo.raw_sha256, contractHash: freezeInfo.validation_contract_hash,
    freshId: ids.fresh, regressionId: ids.regression, studyPayloads, transportFreezeHash: transportFreeze.raw_sha256, executionPlanHashes });
}

if (action === 'prepare') {
  // Validate both existing-or-proposed registrations before writing either. A partial prior write
  // is accepted only when it matches the same immutable intent; missing peers can then be added.
  for (const name of ['fresh','regression']) if (existsSync(planPaths[name])) {
    const saved = json(planPaths[name]), expected = plans[name];
    assertExecutionPlanV77(saved, { id: ids[name], binding, inputHashes: inputHashes(), registryHash: expected.source_registry_hash,
      denominator: expected.denominator, validRoots: expected.valid_roots, controlledDefects: expected.controlled_defects, classification: name });
    if (planIntentHash(saved) !== executionPlanHashes[name]) throw new Error(`existing_v77_registration_intent_mismatch:${name}`);
  }
  for (const name of ['fresh','regression']) if (!existsSync(planPaths[name])) {
    mkdirSync(snapshots[name].run, { recursive: true });
    saveAtomicArtifact(planPaths[name], { ...plans[name], created_at: new Date().toISOString() });
  }
  console.log(JSON.stringify({ registered: true, study_ids: [ids.fresh, ids.regression], paid_calls: 0 })); process.exit(0);
}

const preflights = {};
for (const [name, s] of Object.entries(snapshots)) {
  const plan = json(planPaths[name]);
  const boundInputHashes = action === 'recover' ? plan.input_hashes : inputHashes();
  if (action === 'recover' && (plan.input_hashes?.freeze !== freezeInfo.raw_sha256 || plan.input_hashes?.v77_contract !== freezeInfo.validation_contract_hash ||
      plan.input_hashes?.transport_freeze !== transportFreeze.raw_sha256 || JSON.stringify(plan.input_hashes?.transport_dependencies) !== JSON.stringify(transportFreeze.freeze.files)))
    throw new Error(`receipt_recovery_frozen_inputs_mismatch:${name}`);
  assertExecutionPlanV77(plan, { id: ids[name], binding, inputHashes: boundInputHashes,
    registryHash: action === 'recover' ? plan.source_registry_hash : hashJSON(registryFor(s)), denominator: s.fixtureIds.length,
    validRoots: s.positive.length, controlledDefects: s.defects.length, classification: name });
  checkSources(s.f.fixtures, plan.source_registry);
  if (plan.provenance_notice !== FRESH_V73_PROVENANCE_NOTICE) throw new Error('v77_provenance_notice_changed');
  const file = join(s.run, 'preflight.json');
  if (action === 'report' || action === 'recover') {
    const saved = json(file);
    const expectedBlind = s.fixtureIds.flatMap(id => [{ fixture_id: id, provider: 'openai', phase: 'blind_solution' },
      { fixture_id: id, provider: 'gemini', phase: 'independent_evaluation' }]).map(x => `${x.fixture_id}\0${x.provider}\0${x.phase}`).sort();
    const actualBlind = saved.blind_capture_manifest.map(x => `${x.fixture_id}\0${x.provider}\0${x.phase}`).sort();
    const expectedAudit = [...s.fixtureIds].sort(), actualAudit = saved.audit_capture_manifest.map(x => x.fixture_id).sort();
    const captureKeys = saved.capture_manifest.map(x => `${x.fixture_id}\0${x.provider}\0${x.stage}`);
    const expectedCaptureKeys = [...expectedBlind, ...s.fixtureIds.map(id => `${id}\0openai\0explanation_support`)].sort();
    const actualCaptureKeys = [...captureKeys].sort();
    if (saved.input_hashes?.freeze !== freezeInfo.raw_sha256 || saved.contract_binding?.validation_contract_hash !== freezeInfo.validation_contract_hash ||
        saved.sizing_mock_only !== true || saved.audit_full_matrices_checked_during_offline_capture !== true ||
        !saved.conservative_audit_reservation_micro_by_provider || !Array.isArray(saved.blind_capture_manifest) || !Array.isArray(saved.audit_capture_manifest) ||
        !Array.isArray(saved.capture_manifest) ||
        saved.blind_capture_manifest.length !== s.fixtureIds.length * 2 || saved.audit_capture_manifest.length !== s.fixtureIds.length ||
        JSON.stringify(actualBlind) !== JSON.stringify(expectedBlind) || JSON.stringify(actualAudit) !== JSON.stringify(expectedAudit) ||
        saved.capture_manifest.length !== s.fixtureIds.length * 3 || new Set(captureKeys).size !== captureKeys.length ||
        JSON.stringify(actualCaptureKeys) !== JSON.stringify(expectedCaptureKeys) ||
        saved.capture_manifest.some(c => !/^[0-9a-f]{64}$/.test(c.body_hash || '') || !Number.isSafeInteger(c.bytes) || c.bytes <= 0) ||
        JSON.stringify(saved.input_hashes) !== JSON.stringify(action === 'recover' ? plan.input_hashes : inputHashes()) ||
        saved.capture_manifest.some(c => !s.fixtureIds.includes(c.fixture_id) || !['openai','gemini'].includes(c.provider) || c.bytes > MAX_INPUT_BODY_BYTES_V77))
      throw new Error('current_v77_preflight_required');
    preflights[name] = saved;
  } else {
    // Offline captures run the actual V77 request adapters. No native transport or cache writes are available here.
    const captures = [], blindCaptures = [], auditCaptures = [], providers = ['openai','gemini'];
    const prices = structuredClone(registeredPrices);
    for (const model of ['gpt-6-luna','gemini-3.8-flash']) prices.models[model].max_input_tokens = MAX_INPUT_BODY_BYTES_V77;
    const userRaw = (provider, body) => provider === 'openai' ? body.input?.find(row => row.role === 'user')?.content : body.contents?.find(row => row.role === 'user')?.parts?.[0]?.text;
    const cacheJudgment = { solved_key: 'A', evidence_ids: [], cuet_fit: {}, answer_conditions: [], option_challenges: [], blocking_defects: [],
      principle_applicability: 'skill_from_stem', decisive_principle_in_excerpts: true };
    const transport = { generate: async (provider, body, options) => {
      const finalBody = provider === 'openai' && ['blind_solution','independent_evaluation','explanation_support'].includes(options.stage) && !body.service_tier
        ? { ...body, service_tier: 'flex' } : body;
      const bytes = assertRequestBodyBoundV77(provider, finalBody);
      const raw = userRaw(provider, finalBody), fixtureId = bodyCandidateId(provider, finalBody);
      const capture = { study: name, fixture_id: fixtureId, provider, stage: options.stage, phase: options.stage, bytes, body_hash: hashJSON(finalBody),
        output_bound: provider === 'openai' ? finalBody.max_output_tokens : finalBody.generationConfig?.maxOutputTokens,
        has_two_blind_matrices: options.stage !== 'explanation_support' || false };
      if (['blind_solution','independent_evaluation'].includes(options.stage)) {
        const verified = inspectBlindCaptureV73({ fixtureId, provider, phase: options.stage, raw, body: finalBody, inputLimitTokens: MAX_INPUT_BODY_BYTES_V77 });
        capture.key_canary_absent = verified.key_canary_absent; blindCaptures.push(capture);
      }
      if (options.stage === 'explanation_support') {
        const input = JSON.parse(raw);
        const schema = finalBody.text?.format?.schema || finalBody.generationConfig?.responseFormat?.text?.schema;
        if (input.option_resolution_matrices?.length !== 2 || !schema?.properties?.option_resolution_audits) throw new Error('offline_v77_audit_capture_missing_both_matrices_or_schema');
        capture.has_two_blind_matrices = true; capture.audit_matrix_solvers = input.option_resolution_matrices.map(row => row.solver);
        auditCaptures.push(capture);
      }
      captures.push(capture); throw Object.assign(new Error('offline_capture_complete'), { dispatchState: 'guard_blocked' });
    } };
    const ledger = { getCache: key => key.includes('evaluation:') ? cacheJudgment : null, setCache: () => { throw new Error('offline_cache_write_forbidden'); } };
    for (const fixture of s.f.fixtures) for (const provider of providers) {
      const adapters = createFactoryEvidenceV77({ registry: plan.source_registry, ledger, transport, topology: TOPOLOGIES.dual_blind, calibrationPurpose: true, efforts: effortsFor(fixture.candidate) });
      const canary = blindViewV77({ ...fixture.candidate, correct_answer: 'FRESH_BLIND_KEY_CANARY', explanation: 'FRESH_BLIND_KEY_CANARY' }, fixture.candidate.source_refs);
      try { await adapters.__evaluation(canary, provider); } catch (e) { if (e.message !== 'offline_capture_complete') throw e; }
    }
    for (const fixture of s.f.fixtures) {
      const adapters = createFactoryEvidenceV77({ registry: plan.source_registry, ledger, transport, topology: TOPOLOGIES.dual_blind, calibrationPurpose: true, efforts: effortsFor(fixture.candidate) });
      const view = blindViewV77(fixture.candidate, fixture.candidate.source_refs), matrix = fixture.candidate.options.map(option => ({ option: option.key,
        exact_option_text: option.text, clauses: [{ clause: option.text, status: 'unresolved' }] }));
      for (const [stage, provider] of [['blind_solution','openai'],['independent_evaluation','gemini']]) {
        if (adapters.__freezeResolution(stage, view, { candidate_id: view.candidate_id, content_hash: view.content_hash, provider, solved_key: fixture.candidate.correct_answer,
          option_resolution: { passed: true }, option_resolution_matrix: matrix }) !== true) throw new Error('offline_v77_synthetic_matrix_size_setup_failed');
      }
      try { await adapters.explanation_support({ ...view, proposed_explanation: fixture.candidate.explanation }); }
      catch (e) { if (e.message !== 'offline_capture_complete') throw e; }
    }
    const required = s.fixtureIds.length * providers.length;
    const blindPairs = new Set(blindCaptures.map(c => `${c.fixture_id}\0${c.provider}`));
    if (blindCaptures.length !== required || blindPairs.size !== required || s.fixtureIds.some(id => providers.some(provider => !blindPairs.has(`${id}\0${provider}`))) ||
        auditCaptures.length !== s.fixtureIds.length || new Set(auditCaptures.map(c => c.fixture_id)).size !== s.fixtureIds.length)
      throw new Error(JSON.stringify({diagnostic_only:true,study:name,blind:blindCaptures.length,expected_blind:required,audit:auditCaptures.length,expected_audit:s.fixtureIds.length,total:captures.length}));
    if (captures.some(c => c.bytes > MAX_INPUT_BODY_BYTES_V77)) throw new Error('v77_full_request_body_over_reserved_bytes');
    const stageCaps = { blind_solution: 7500, independent_evaluation: 4500, explanation_support: 5000 }, auditReserve = {};
    const stageProviders = { blind_solution: 'openai', independent_evaluation: 'gemini', explanation_support: 'openai' };
    let caseWorst = 0;
    for (const [stage, provider] of Object.entries(stageProviders)) {
      const model = provider === 'openai' ? 'gpt-6-luna' : 'gemini-3.8-flash', price = prices.models[model], outputBound = stageCaps[stage];
      const conservativeInputRate = Math.max(price.input_per_million, price.cache_write_per_million || 0);
      const first = Math.ceil(MAX_INPUT_BODY_BYTES_V77 * conservativeInputRate + outputBound * price.output_per_million);
      const billedRetry = Math.ceil(MAX_INPUT_BODY_BYTES_V77 * conservativeInputRate + (outputBound * 2) * price.output_per_million);
      const stageBound = first + billedRetry; auditReserve[stage] = { provider, input_bound_tokens: MAX_INPUT_BODY_BYTES_V77, output_bound: outputBound,
        complete_json_retry_output_bound: outputBound * 2, first_request_max_micro: first, retry_max_micro: billedRetry, combined_max_micro: stageBound };
      caseWorst += stageBound;
    }
    auditReserve.all_stage_case_max_micro = caseWorst;
    auditReserve.study_max_micro = caseWorst * s.fixtureIds.length;
    const manifest = { at: new Date().toISOString(), input_hashes: inputHashes(), contract_binding: binding, captures: captures.length,
      expected_blind: required, expected_audit: s.fixtureIds.length, blind_capture_manifest: blindCaptures, audit_capture_manifest: auditCaptures,
      capture_manifest: captures, maximum_bytes: Math.max(...captures.map(c => c.bytes)), answers_hidden: true, paid_calls: 0,
      conservative_audit_reservation_required: true, conservative_audit_reservation_micro_by_provider: auditReserve,
      full_body_byte_reserve: MAX_INPUT_BODY_BYTES_V77, sizing_mock_only: true, not_native_qualification: true,
      audit_full_matrices_checked_during_offline_capture: true, synthetic_audit_matrices_used_for_sizing_only: true,
      audit_full_matrices_runtime_gate: 'Before dispatch, final explanation_support body must contain both actual frozen blind matrices and expanded audit schema and stay within 50000 UTF-8 bytes.' };
    saveAtomicArtifact(file, manifest); preflights[name] = manifest;
  }
}
if (action === 'preflight') { console.log(JSON.stringify(preflights)); process.exit(0); }
if (action === 'report') {
  console.log(JSON.stringify({ study_ids: [ids.fresh, ids.regression], freeze_sha256: freezeInfo.raw_sha256, binding,
    preflight_capture_counts: Object.fromEntries(Object.entries(preflights).map(([n,p]) => [n,p.captures])), native_execution_enabled: false,
    note: 'Local report only; it does not open the budget database.' }, null, 2)); process.exit(0);
}

// Validate both durable results and their fixed fixture sets before acquiring the phase owner
// or making the first native call. Persist empty denominator files up front for drain recovery.
const resultBundles = {};
for (const [name, s] of Object.entries(snapshots)) {
  const resultsPath = join(s.run, 'results.json');
  const results = existsSync(resultsPath) ? json(resultsPath) : { benchmark: { id: ids[name], payload_hash: s.f.payload_hash },
    verifier_version: binding.verifier_version, contract_binding: binding, release_eligibility: s.f.release_eligibility, evaluations: {}, topologies: { dual_blind: [] } };
  if (results.benchmark?.id !== ids[name] || results.benchmark?.payload_hash !== s.f.payload_hash || results.verifier_version !== binding.verifier_version ||
      JSON.stringify(results.contract_binding) !== JSON.stringify(binding) || JSON.stringify(results.release_eligibility) !== JSON.stringify(s.f.release_eligibility) ||
      !results.evaluations || !Array.isArray(results.topologies?.dual_blind)) throw new Error(`saved_v77_results_binding_or_schema_invalid:${name}`);
  const knownIds = new Set(s.fixtureIds);
  if (Object.keys(results.evaluations).some(id => !knownIds.has(id)) || results.topologies.dual_blind.some(row => !knownIds.has(row.id)) ||
      new Set(results.topologies.dual_blind.map(row => row.id)).size !== results.topologies.dual_blind.length) throw new Error(`saved_v77_results_fixture_set_invalid:${name}`);
  resultBundles[name] = { path: resultsPath, results };
  if (!existsSync(resultsPath) && action !== 'recover') saveAtomicArtifact(resultsPath, results);
}

// The execute path is deliberately reachable only with the human-provided authorization file above.
const releaseLease = acquireQualificationLeaseV77('data/question-factory-runtime');
let ledger, native, pendingMaximum = 0, stopping = false;
const stopAfterCurrent = () => { stopping = true; };
process.on('SIGINT', stopAfterCurrent); process.on('SIGTERM', stopAfterCurrent);
try {
  if (action === 'execute' && existsSync('.env.local')) loadEnvFile('.env.local');
  ledger = new BudgetLedger('data/pipeline-budget.sqlite'); ledger.assertHistoryReconciled();
  const prices = structuredClone(registeredPrices);
  for (const model of ['gpt-6-luna', 'gemini-3.8-flash']) prices.models[model].max_input_tokens = MAX_INPUT_BODY_BYTES_V77;
  native = createFactoryTransport({ ledger, prices: () => prices, realtimeStages: ['blind_solution','independent_evaluation','explanation_support'],
    flexStages: ['blind_solution','independent_evaluation','explanation_support'] });
  const lifetimeCommitted = () => ledger.snapshot().committed_micro;
  const studyScope = new Set([...snapshots.fresh.fixtureIds, ...snapshots.regression.fixtureIds]);
  const dispatchState = { get stopping() { return stopping || existsSync('data/question-factory-runtime/STOP_AFTER_V77_REQUEST'); },
    set stopping(value) { stopping = value; }, get pendingMaximum() { return pendingMaximum; }, set pendingMaximum(value) { pendingMaximum = value; }, lastNativeRequest: null };
  const completedResponse = key => {
    if (!key) return false;
    const row = ledger.db.prepare('SELECT state,response_json FROM provider_requests WHERE id=?').get(key);
    return row?.state === 'complete' && Boolean(row.response_json);
  };
  const transport = { generate: async (provider, body, options = {}) => {
    const nativeKey = hashJSON({ study: `${ids.fresh}:${ids.regression}`, parent: options.key });
    const candidateId = bodyCandidateId(provider, body);
    try {
      const response = await dispatchV77NativeRequest({ provider, body, options, studyIds: ids, allowedCandidates: studyScope, native, ledger, prices, state: dispatchState,
      reservationNeeded: requestNeedsReservation, requestAccepted: (activeLedger, key) => acceptedNativeRequestV73(activeLedger.db, key),
      requestState: (activeLedger, key) => activeLedger.db.prepare('SELECT state FROM provider_requests WHERE id=?').get(key)?.state || null,
      maximumRequest: maximumRequestMicro, scopedCommitted: activeLedger => scopedAccounting(activeLedger, QUALIFICATION_V77_PREFIX).committed_micro,
      lifetimeCommitted: activeLedger => activeLedger.snapshot().committed_micro,
      assertCampaign: (committed, maximum) => assertCampaignBudget(committed, maximum, QUALIFICATION_V77_CAP_USD),
      assertLifetime: assertLifetimeBoundV77,
      recoveryOnly: action === 'recover',
      completedResponseAvailable: (activeLedger, key) => completedResponse(key),
      auditGuard: (providerName, finalBody) => {
        const parsed = providerName === 'openai' ? JSON.parse(finalBody.input.find(x => x.role === 'user').content) : JSON.parse(finalBody.contents.find(x => x.role === 'user').parts[0].text);
        if (parsed.option_resolution_matrices?.length !== 2 || !JSON.stringify(finalBody).includes('option_resolution_audits')) throw new Error('v77_both_frozen_matrices_must_be_in_full_audit_request');
      } });
      dispatchState.lastNativeRequest = { key: nativeKey, candidate_id: candidateId, provider, stage: options.stage };
      return response;
    } catch (error) {
      dispatchState.lastNativeRequest = { key: error.nativeKey || nativeKey, candidate_id: candidateId, provider, stage: options.stage };
      throw error;
    }
  } };
  const bindLastNativeError = (error, fixtureId) => {
    const last = dispatchState.lastNativeRequest;
    if (!error.nativeKey && last?.candidate_id === fixtureId) error.nativeKey = last.key;
    if (error.nativeKey) {
      const persisted = ledger.db.prepare('SELECT state FROM provider_requests WHERE id=?').get(error.nativeKey)?.state || null;
      error.nativeRequestState ||= persisted;
      error.acceptedStatus ||= acceptedNativeRequestV73(ledger.db, error.nativeKey) ? 'accepted_or_uncertain' : persisted || 'unknown';
    }
    return error;
  };
  for (const [name, s] of Object.entries(snapshots)) {
    const { path: resultsPath, results } = resultBundles[name];
    const canRecoverFixture = fixture => {
      const evaluation = results.evaluations?.[fixture.id] || {};
      const row = results.topologies.dual_blind.find(item => item.id === fixture.id);
      return ['openai','gemini'].some(provider => evaluation[provider]?.status === 'error' && completedResponse(evaluation[provider].native_key)) ||
        row?.state === 'error' && completedResponse(row.native_key);
    };
    const workFixtures = action === 'recover' ? s.f.fixtures.filter(canRecoverFixture) : s.f.fixtures;
    await drainConcurrent(workFixtures, async fixture => {
      const existingIndex = results.topologies.dual_blind.findIndex(row => row.id === fixture.id), existing = results.topologies.dual_blind[existingIndex];
      if (action === 'recover') {
        if (!canRecoverFixture(fixture)) return;
      } else if (existing && !(existing.state === 'error' && existing.resume_safe === true)) return;
      results.evaluations[fixture.id] ||= {};
      const preserveError = (kind, prior, key) => {
        appendV77RecoveryHistory(results, { studyId: ids[name], fixtureId: fixture.id, recordKind: kind, priorRecord: prior, nativeKey: key });
      };
      const recoveredNativeKeys = [];
      const adapters = createFactoryEvidenceV77({ registry: json(planPaths[name]).source_registry, ledger, transport, topology: TOPOLOGIES.dual_blind,
        calibrationPurpose: true, efforts: effortsFor(fixture.candidate) });
      for (const provider of ['openai','gemini']) {
        const prior = results.evaluations[fixture.id][provider];
        if (action === 'recover') {
          if (prior?.status !== 'error' || !completedCache(prior.native_key)) continue;
          try {
            const recovered = await adapters.__evaluation(blindViewV77(fixture.candidate, fixture.candidate.source_refs), provider);
            preserveError(`evaluation:${provider}`, prior, prior.native_key);
            recoveredNativeKeys.push(prior.native_key);
            results.evaluations[fixture.id][provider] = { status: 'judged', ...recovered,
              receipt_recovered: { native_key: prior.native_key, source_status: 'complete_cache', recovered_at: new Date().toISOString() } };
          } catch (error) {
            results.recovery_attempts ||= [];
            results.recovery_attempts.push({ at: new Date().toISOString(), study_id: ids[name], fixture_id: fixture.id, provider,
              native_key: error.nativeKey || prior.native_key, error: error.message, dispatch_state: error.dispatchState || 'unknown' });
          }
          saveAtomicArtifact(resultsPath, results);
          continue;
        }
        const accepted = Boolean(prior?.native_key && acceptedNativeRequestV73(ledger.db, prior.native_key));
        // A guard-blocked request is retryable only because it never reached the provider;
        // this reuses the same durable key and this exact preregistered case.
        const resume = evaluationResumeActionV73(prior, accepted, true);
        if (resume === 'reuse_saved_judgment' || resume === 'keep_terminal_error') continue;
        const retained = retainedAcceptedEvaluationV73(prior, resume);
        if (retained) { results.evaluations[fixture.id][provider] = retained; saveAtomicArtifact(resultsPath, results); continue; }
        if (resume === 'stop_unknown_saved_state') {
          results.evaluations[fixture.id][provider] = { status: 'error', error: 'unknown_saved_evaluation_state_requires_manual_reconciliation' };
          saveAtomicArtifact(resultsPath, results); continue;
        }
        try {
          results.evaluations[fixture.id][provider] = { status: 'judged', ...await adapters.__evaluation(blindViewV77(fixture.candidate, fixture.candidate.source_refs), provider) };
        } catch (error) {
          bindLastNativeError(error, fixture.id);
          const isAccepted = error.nativeKey && acceptedNativeRequestV73(ledger.db, error.nativeKey);
          results.evaluations[fixture.id][provider] = { status: evaluationFailureStatusV73(error, isAccepted), error: error.message,
            ...(error.nativeKey ? { native_key: error.nativeKey } : {}), ...(error.acceptedStatus ? { accepted_status: error.acceptedStatus } : {}),
            ...(error.nativeRequestState ? { native_request_state: error.nativeRequestState } : {}) };
        }
        saveAtomicArtifact(resultsPath, results);
      }
      const blindFailed = ['openai','gemini'].find(provider => results.evaluations[fixture.id]?.[provider]?.status !== 'judged');
      let verdict;
      if (blindFailed) {
        if (action === 'recover' && existing?.state === 'error') return;
        verdict = { state: 'error', stage_error: `blind_evaluation:${blindFailed}`, reasons: [results.evaluations[fixture.id][blindFailed].error || 'blind_evaluation_incomplete'],
          resume_safe: results.evaluations[fixture.id][blindFailed].status === 'guard_blocked' };
      }
      else try { verdict = await validateFactoryCandidateV77(fixture.candidate, { registry: json(planPaths[name]).source_registry, ledger, transport,
        topology: TOPOLOGIES.dual_blind, calibrationPurpose: true, efforts: effortsFor(fixture.candidate), seen: new Set() }); }
      catch (error) {
        bindLastNativeError(error, fixture.id);
        const accepted = error.nativeKey && acceptedNativeRequestV73(ledger.db, error.nativeKey);
        verdict = { state: 'error', stage_error: 'dual_blind_verification', reasons: [error.message],
          resume_safe: error.dispatchState === 'guard_blocked' && !accepted,
          ...(error.nativeKey ? { native_key: error.nativeKey } : {}), ...(error.acceptedStatus ? { accepted_status: error.acceptedStatus } : {}),
          ...(error.nativeRequestState ? { native_request_state: error.nativeRequestState } : {}) };
      }
      const row = { id: fixture.id, group: fixture.group, category: fixture.category, expected_valid: fixture.expected_valid, ...verdict };
      if (action === 'recover' && existing?.state === 'error') preserveError('topology', existing, existing.native_key);
      if (action === 'recover' && verdict.state !== 'error') row.receipt_recovered = {
        native_keys: [...new Set([...recoveredNativeKeys, ...(existing?.native_key ? [existing.native_key] : [])])],
        source_status: 'complete_cache', recovered_at: new Date().toISOString() };
      if (existingIndex >= 0) results.topologies.dual_blind[existingIndex] = row; else results.topologies.dual_blind.push(row);
      saveAtomicArtifact(resultsPath, results);
    }, { concurrency: 1, shouldStop: () => stopping });
  }
  const resultFresh = json(join(studyDirs.fresh,'run/results.json')), resultRegression = json(join(studyDirs.regression,'run/results.json'));
  const accounting = qualificationAccountingV77(ledger);
  const executionFinished = [resultFresh,resultRegression].every((result,index) => {
    const expected = snapshots[index === 0 ? 'fresh' : 'regression'].fixtureIds;
    const rows = result.topologies?.dual_blind || [];
    return rows.length === expected.length && expected.every(id => rows.some(row => row.id === id && ['eligible','quarantined'].includes(row.state))) &&
      expected.every(id => ['openai','gemini'].every(provider => result.evaluations?.[id]?.[provider]?.status === 'judged'));
  });
  const assessed = assessReleaseEvidenceV77({ resultFresh, frozenFresh: frozen.fresh, resultRegression, frozenRegression: frozen.regression,
    binding, accounting, receiptComplete: accounting.receipt_complete && accounting.held_micro === 0, executionFinished });
  saveAtomicArtifact(join(registeredRoot, 'execution', 'v77-release-assessment.json'), assessed);
  console.log(JSON.stringify({ release_assessment: assessed, pending_maximum_micro: pendingMaximum,
    accounting: { settled_micro: accounting.settled_micro, held_micro: accounting.held_micro, committed_micro: accounting.committed_micro,
      receipt_complete: accounting.receipt_complete }, execution_finished: executionFinished }));
} finally { ledger?.close(); releaseLease(); process.removeListener('SIGINT', stopAfterCurrent); process.removeListener('SIGTERM', stopAfterCurrent); }
