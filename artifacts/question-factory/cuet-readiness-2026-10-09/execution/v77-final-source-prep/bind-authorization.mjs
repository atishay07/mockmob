// Offline V7.7 authorization binder. Invoke only after both studies are frozen and independently reviewed.
// This helper reads study/contract/history/pricing inputs and writes ONLY the scope-bound auth JSON
// using exclusive-create semantics. It never writes plans, calls the runner, opens the ledger, or calls providers.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashJSON, provenanceReasons } from '../../../../../data/question_factory_policy.mjs';
import { REQUIRED_SUBJECTS } from '../../../../../scripts/pipeline/lib/releaseEvidenceV77.mjs';
import { payloadHash } from '../../../../../scripts/pipeline/lib/cuetFitBenchmark.mjs';
import { structureVerdict } from '../../../../../scripts/pipeline/lib/evidencePipeline.mjs';
import { presentationLint } from '../../../../../data/question_presentation.mjs';
import {
  assertFreshV77Study, assertNoPriorV75V76CaseReuse, assertV77StudySlotBinding,
  normalizedCaseFingerprint, verifyV77Freeze, verifyV77TransportFreeze, expectedReleaseBindingV77, assertPriceExpiryV77,
  V77_TRANSPORT_DEPENDENCIES, QUALIFICATION_V77_PREFIX, QUALIFICATION_V77_CAP_USD,
  LIFETIME_CAP_USD,
} from '../../../../../scripts/pipeline/lib/freshCuetReadinessV77Guards.mjs';
import { assertBenchmarkProvenanceV73, assertCustodySetV73, assertReleaseEvidenceRoleV73, FRESH_V73_PROVENANCE_NOTICE } from '../../../../../scripts/pipeline/lib/freshCuetReadinessV73Guards.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../../');
const registeredRoot = resolve(repoRoot, 'artifacts/question-factory/cuet-readiness-2026-10-09/v77-qualification');
const HISTORY_REVIEW_PATH = 'artifacts/question-factory/cuet-readiness-2026-10-09/execution/v76-case-freshness-check.md';
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
const EXPECTED_V76_REGRESSION = 'artifacts/question-factory/cuet-readiness-2026-10-09/benchmark/v76-qualification-2026-10-09-regression-bounded-input/frozen.json';
const USER_AUTHORIZATION_QUOTE = 'yes continue to make improvements in V7.7 but this time i was you to treat this as your last chance to perfecting this to best of your capabilities';

function fail(message) { throw new Error(message); }
function readJson(path) { return JSON.parse(readFileSync(resolve(repoRoot, path), 'utf8')); }
function sha(path) { return createHash('sha256').update(readFileSync(resolve(repoRoot, path))).digest('hex'); }
function arg(name) { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] || null; }
function resolveStudyDir(value, label) {
  if (!value) fail(`missing_${label}_study_directory`);
  const path = resolve(repoRoot, value);
  const rel = relative(registeredRoot, path);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) fail(`study_directory_outside_fixed_v77_scope:${label}`);
  return path;
}
function checkSources(fixtures, registry) {
  for (const fixture of fixtures) for (const ref of fixture.candidate?.source_refs || []) {
    const source = registry.sources?.[ref.id];
    if (source?.state !== 'active' || source.reuse_permitted !== true || source.version !== ref.version ||
        source.supports?.[ref.locator] !== ref.support_hash ||
        hashJSON(source.facts?.[ref.locator]?.text) !== ref.support_hash) {
      fail(`registered_support_contract_changed:${fixture.id}`);
    }
  }
}

const freshDir = resolveStudyDir(arg('--fresh-dir'), 'fresh');
const regressionDir = resolveStudyDir(arg('--regression-dir'), 'regression');
const authOutArg = arg('--authorization-out');
if (!authOutArg) fail('missing_authorization_output_path');
const authOut = resolve(repoRoot, authOutArg);
if (!relative(repoRoot, authOut) || relative(repoRoot, authOut).startsWith('..') || isAbsolute(relative(repoRoot, authOut)))
  fail('authorization_output_must_be_inside_repository');
if (existsSync(authOut)) fail('authorization_output_already_exists_refusing_overwrite');
if (freshDir === regressionDir) fail('fresh_and_regression_directories_must_differ');

// Verify the frozen raw/semantic contract and every transport dependency before hashing intent.
const core = verifyV77Freeze(repoRoot);
const transport = verifyV77TransportFreeze(repoRoot, V77_TRANSPORT_DEPENDENCIES, { required: true });
assertPriceExpiryV77(JSON.parse(readFileSync(resolve(repoRoot, 'data/pipeline-prices.json'), 'utf8')));
const binding = expectedReleaseBindingV77();
const studyDirs = { fresh: freshDir, regression: regressionDir };
const frozen = Object.fromEntries(Object.entries(studyDirs).map(([name, dir]) => [name, JSON.parse(readFileSync(join(dir, 'frozen.json'), 'utf8'))]));
const ids = Object.fromEntries(Object.entries(frozen).map(([name, row]) => [name, row.id]));
if (ids.fresh === ids.regression || !ids.fresh?.startsWith(QUALIFICATION_V77_PREFIX) || !ids.regression?.startsWith(QUALIFICATION_V77_PREFIX))
  fail('fixed_v77_fresh_and_regression_ids_required');

// Reproduce the runner's prior-history binding and freshness checks without importing/executing it.
for (const path of PRIOR_FROZEN_PATHS) if (!existsSync(resolve(repoRoot, path))) fail(`required_prior_case_history_missing:${path}`);
if (!existsSync(resolve(repoRoot, HISTORY_REVIEW_PATH))) fail('required_v76_case_freshness_review_missing');
const historyReview = readFileSync(resolve(repoRoot, HISTORY_REVIEW_PATH), 'utf8');
if (!historyReview.includes('264 fixture rows') || !historyReview.includes('90 distinct subject/stem/options records'))
  fail('prior_case_history_review_contract_changed');
const priorHistory = Object.fromEntries(PRIOR_FROZEN_PATHS.map(path => {
  const prior = readJson(path);
  const fixtureHashes = Object.fromEntries((prior.fixtures || []).map(f => [f.id, hashJSON({ id: f.id, fingerprint: normalizedCaseFingerprint(f) })]));
  if (!prior.fixtures?.length) fail(`required_prior_case_history_empty:${path}`);
  return [path, { sha256: sha(path), fixture_hashes: fixtureHashes, fixtures: prior.fixtures }];
}));

const snapshots = {};
for (const name of ['fresh', 'regression']) {
  const dir = studyDirs[name], f = frozen[name];
  const overlay = JSON.parse(readFileSync(join(dir, 'scratch-registry-overlay.json'), 'utf8'));
  const custody = JSON.parse(readFileSync(join(dir, 'independent-key-custody.json'), 'utf8'));
  const fixtureIds = f.fixtures?.map(x => x.id) || [];
  const positive = f.fixtures?.filter(x => x.expected_valid === true) || [];
  const defects = f.fixtures?.filter(x => x.expected_valid === false) || [];
  if (!fixtureIds.length || new Set(fixtureIds).size !== fixtureIds.length || payloadHash(f.fixtures) !== f.payload_hash ||
      JSON.stringify(f.contract_binding) !== JSON.stringify(binding)) fail(`frozen_v77_study_contract_invalid:${name}`);
  if (fixtureIds.length !== f.denominator || positive.length !== f.valid_roots || defects.length !== f.controlled_defects)
    fail(`fixed_v77_denominator_mismatch:${name}`);
  if (name === 'fresh') {
    if (fixtureIds.length !== 28 || positive.length !== 16 || defects.length !== 12) fail('fresh_fixed_28_16_12_denominator_required');
    for (const subject of REQUIRED_SUBJECTS) {
      if (positive.filter(x => x.candidate?.subject === subject).length !== 4 || defects.filter(x => x.candidate?.subject === subject).length !== 3)
        fail(`fresh_subject_quota_invalid:${subject}`);
    }
  } else {
    if (fixtureIds.length !== 13 || positive.length !== 4 || defects.length !== 9) fail('regression_fixed_13_case_denominator_required');
    const v76 = readJson(EXPECTED_V76_REGRESSION);
    if (hashJSON(f.fixtures) !== hashJSON(v76.fixtures)) fail('v76_bounded_regression_fixtures_must_be_unchanged');
  }
  assertReleaseEvidenceRoleV73(f.release_eligibility);
  assertBenchmarkProvenanceV73(f.fixtures, f.release_eligibility.classification);
  assertCustodySetV73({ fixtureIds, positiveIds: positive.map(x => x.id), custody });
  if (name === 'fresh') {
    const caseReviewPath = join(dir, 'case-freshness-review.json');
    const caseReview = JSON.parse(readFileSync(caseReviewPath, 'utf8'));
    assertFreshV77Study({ frozen: f, custody, freezeSha256: core.raw_sha256, freezeAt: core.freeze.frozen_at,
      transportFreezeSha256: transport.raw_sha256, transportFreezeAt: transport.frozen_at,
      custodySha256: sha(relative(repoRoot, join(dir, 'independent-key-custody.json'))),
      caseReviewSha256: sha(relative(repoRoot, caseReviewPath)), caseReview });
    assertNoPriorV75V76CaseReuse(f.fixtures, Object.values(priorHistory).flatMap(row => row.fixtures));
  }
  snapshots[name] = { f, overlay, fixtureIds, positive, defects, custody };
}
assertV77StudySlotBinding(ids.fresh, ids.regression, snapshots.fresh.f, snapshots.regression.f);

const sourceRegistry = readJson('data/source_registry.json');
for (const [name, snapshot] of Object.entries(snapshots)) {
  const localRegistry = { ...sourceRegistry, sources: { ...sourceRegistry.sources, ...snapshot.overlay.sources },
    families: { ...sourceRegistry.families, ...snapshot.overlay.families }, packs: { ...sourceRegistry.packs, ...snapshot.overlay.packs } };
  checkSources(snapshot.f.fixtures, localRegistry);
  const localFailures = snapshot.positive.map(fixture => ({ id: fixture.id, reasons: [
    ...structureVerdict(fixture.candidate).reasons, ...presentationLint(fixture.candidate), ...provenanceReasons(fixture.candidate, localRegistry),
  ] })).filter(row => row.reasons.length);
  if (localFailures.length) fail(`positive_fixture_local_failures_before_spend:${name}:${JSON.stringify(localFailures)}`);
  snapshot.localRegistry = localRegistry;
}

// Preserve the exact insertion order and data shape of inputHashes() in the frozen runner.
const inputHashes = () => ({ freeze: core.raw_sha256, v77_contract: core.validation_contract_hash,
  fresh: { frozen: sha(relative(repoRoot, join(freshDir, 'frozen.json'))), overlay: sha(relative(repoRoot, join(freshDir, 'scratch-registry-overlay.json'))),
    custody: sha(relative(repoRoot, join(freshDir, 'independent-key-custody.json'))), case_review: sha(relative(repoRoot, join(freshDir, 'case-freshness-review.json'))) },
  regression: { frozen: sha(relative(repoRoot, join(regressionDir, 'frozen.json'))), overlay: sha(relative(repoRoot, join(regressionDir, 'scratch-registry-overlay.json'))),
    custody: sha(relative(repoRoot, join(regressionDir, 'independent-key-custody.json')) ) },
  source_registry: sha('data/source_registry.json'), prices: sha('data/pipeline-prices.json'), binding,
  transport_freeze: transport.raw_sha256, transport_dependency_hash: transport.transport_hash,
  transport_dependencies: Object.fromEntries(V77_TRANSPORT_DEPENDENCIES.map(path => [path, sha(path)])),
  prior_case_history_review: sha(HISTORY_REVIEW_PATH),
  prior_case_frozen_hashes: Object.fromEntries(Object.entries(priorHistory).map(([path, row]) => [path, row.sha256])),
  prior_case_fixture_hashes: Object.fromEntries(Object.entries(priorHistory).map(([path, row]) => [path, row.fixture_hashes])) });

// Mirror the runner's plan fields and property order exactly; no plan files are written.
const plans = {};
for (const name of ['fresh', 'regression']) {
  const snapshot = snapshots[name], registry = snapshot.localRegistry;
  plans[name] = { id: ids[name], classification: name, cap_usd: QUALIFICATION_V77_CAP_USD, lifetime_cap_usd: LIFETIME_CAP_USD,
    qualification_budget_prefix: QUALIFICATION_V77_PREFIX, contract_binding: binding, denominator: snapshot.fixtureIds.length,
    valid_roots: snapshot.positive.length, controlled_defects: snapshot.defects.length, source_registry: registry,
    source_registry_hash: hashJSON(registry), input_hashes: inputHashes(), max_input_body_bytes: 50_000,
    maximum_content_repairs: 0, publication: 'never', regeneration: false, topology: 'dual_blind', providers: ['openai','gemini'], native_batch: false,
    transport_mode: 'openai_explicit_flex_only_no_fallback;gemini_realtime', transport_freeze_sha256: transport.raw_sha256,
    provenance_notice: FRESH_V73_PROVENANCE_NOTICE };
}
const planIntentHash = plan => hashJSON({ ...plan, created_at: undefined });
const studyPayloads = Object.fromEntries(['fresh','regression'].map(name => [name, ({ payload_hash: frozen[name].payload_hash,
  frozen_sha256: sha(relative(repoRoot, join(studyDirs[name], 'frozen.json'))),
  custody_sha256: sha(relative(repoRoot, join(studyDirs[name], 'independent-key-custody.json'))) })]));
const executionPlanHashes = { fresh: planIntentHash(plans.fresh), regression: planIntentHash(plans.regression) };

// Preserve the user's exact quoted authorization as provenance, while binding the concrete scope.
const authorization = { authorization_type: 'explicit_user', authorized: true,
  authorization_quote: USER_AUTHORIZATION_QUOTE, authorization_scope: 'one final V7.7 qualification only; $4 stop cap within $50 lifetime cap; no publication',
  freeze_sha256: core.raw_sha256, validation_contract_hash: core.validation_contract_hash,
  qualification_budget_prefix: QUALIFICATION_V77_PREFIX, cap_usd: QUALIFICATION_V77_CAP_USD,
  study_ids: [ids.fresh, ids.regression], study_payloads, transport_freeze_hash: transport.raw_sha256,
  execution_plan_hashes, issued_at: new Date().toISOString() };
// Guard-equivalent binding checks before the exclusive write.
if (authorization.authorization_type !== 'explicit_user' || authorization.authorized !== true ||
    authorization.freeze_sha256 !== core.raw_sha256 || authorization.validation_contract_hash !== core.validation_contract_hash ||
    authorization.qualification_budget_prefix !== QUALIFICATION_V77_PREFIX || authorization.cap_usd !== QUALIFICATION_V77_CAP_USD ||
    JSON.stringify(authorization.study_ids) !== JSON.stringify([ids.fresh, ids.regression]) ||
    JSON.stringify(authorization.study_payloads) !== JSON.stringify(studyPayloads) ||
    authorization.transport_freeze_hash !== transport.raw_sha256 ||
    JSON.stringify(authorization.execution_plan_hashes) !== JSON.stringify(executionPlanHashes)) fail('authorization_self_binding_failed');
writeFileSync(authOut, JSON.stringify(authorization, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ authorization_path: relative(repoRoot, authOut), study_ids: authorization.study_ids,
  payload_hashes: Object.fromEntries(Object.entries(studyPayloads).map(([name, value]) => [name, value.payload_hash])),
  execution_plan_hashes: executionPlanHashes, core_freeze_sha256: core.raw_sha256,
  validation_contract_hash: core.validation_contract_hash, transport_freeze_sha256: transport.raw_sha256,
  written_exclusively: true, plans_written: false, native_or_database_activity: false }, null, 2));



