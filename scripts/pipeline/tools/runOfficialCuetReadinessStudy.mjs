// Limited official-key CUET-fit measurement. This is calibration only: it never publishes.
// Default command is read-only. Paid evaluation requires --execute after an explicit study approval.
// Usage:
//   node scripts/pipeline/tools/runOfficialCuetReadinessStudy.mjs --plan [--partition all|limited_heldout|existing_regression|reserved_nonexemplar] [--count N]
//   node scripts/pipeline/tools/runOfficialCuetReadinessStudy.mjs --freeze
//   node --use-system-ca scripts/pipeline/tools/runOfficialCuetReadinessStudy.mjs --execute --partition limited_heldout --cap-usd 6
//   node scripts/pipeline/tools/runOfficialCuetReadinessStudy.mjs --report
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadEnvFile } from 'node:process';
import { BudgetLedger } from '../lib/budgetLedger.mjs';
import { createFactoryTransport, FACTORY_MODELS } from '../lib/factoryTransport.mjs';
import { anthropicSchema, createFactoryEvidenceV7, evalSchemaV7, FACTORY_VERIFIER_VERSION_V7, V7_PROMPT_HASH } from '../lib/factoryEvidenceV7.mjs';
import { blindView } from '../lib/evidencePipeline.mjs';
import { CUET_FIT_VERSION } from '../lib/cuetFit.mjs';
import { EFFORT_POLICY_ID, effortsFor as measuredEffortsFor } from '../../../data/cuet_fit_evidence.mjs';
import { hashJSON } from '../../../data/question_factory_policy.mjs';

const ROOT = 'artifacts/question-factory/cuet-readiness-2026-10-08/benchmark';
const FIXTURE_PATH = `${ROOT}/source-keyed-fixtures.json`;
const CHECKSUM_PATH = `${ROOT}/SHA256SUMS.txt`;
const STUDY_DIR = `${ROOT}/official-readiness-study-v1`;
const FREEZE_PATH = `${STUDY_DIR}/freeze.json`;
const REGISTRY_SNAPSHOT_PATH = `${STUDY_DIR}/registry-snapshot.json`;
const RUN_PATH = `${STUDY_DIR}/run.json`;
const PROGRESS_PATH = `${STUDY_DIR}/progress.json`;
const REPORT_PATH = `${STUDY_DIR}/report.json`;
const INFRA_RESUME_PATH = `${STUDY_DIR}/infrastructure-resume-v1.json`;
const STOP_FILE_PATH = `${STUDY_DIR}/STOP_AFTER_PROVIDER_PAIR`;
const DEFAULT_CAP_USD = 6;
const PROVIDERS = ['openai', 'gemini', 'anthropic'];
const MODEL_BY_PROVIDER = { openai: FACTORY_MODELS.openai, gemini: FACTORY_MODELS.gemini, anthropic: FACTORY_MODELS.anthropic };
const STUDY_ID = 'cuet-official-key-limited-readiness-v1-2026-10-08';
const hash = value => createHash('sha256').update(value).digest('hex');
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const save = (path, value) => { mkdirSync(STUDY_DIR, { recursive: true }); writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`); };
const arg = name => { const i = process.argv.indexOf(name); return i < 0 ? null : process.argv[i + 1]; };
const has = name => process.argv.includes(name);
const mode = has('--execute') ? 'execute' : has('--freeze') ? 'freeze' : has('--prepare-infra-resume') ? 'prepare-infra-resume' : has('--self-test') ? 'self-test' : has('--report') ? 'report' : 'plan';
const usage = () => console.log('Commands: --plan (default, no calls), --freeze, --prepare-infra-resume (preserve existing freeze/results), --self-test (offline), --execute --approved, --report. Create STOP_AFTER_PROVIDER_PAIR in the study folder to pause between provider judgments. Options: --providers openai,gemini,anthropic --partition all|limited_heldout|existing_regression|reserved_nonexemplar --count N --cap-usd 6');
const partition = arg('--partition') || 'limited_heldout';
const providers = (arg('--providers') || 'openai,gemini,anthropic').split(',').filter(Boolean);
const countArg = arg('--count');
const count = countArg == null ? null : Number(countArg);
const capUsd = Number(arg('--cap-usd') || DEFAULT_CAP_USD);
const geminiModel = FACTORY_MODELS.gemini;
const allowedPartitions = new Set(['all', 'limited_heldout', 'existing_regression', 'reserved_nonexemplar']);
if (!allowedPartitions.has(partition)) throw new Error(`invalid_partition:${partition}`);
if (!providers.length || new Set(providers).size !== providers.length || providers.some(p => !PROVIDERS.includes(p))) throw new Error('providers_must_be_unique_openai_gemini_anthropic');
if (count !== null && (!Number.isSafeInteger(count) || count < 1)) throw new Error('count_must_be_positive_integer');
if (!Number.isFinite(capUsd) || capUsd <= 0 || capUsd > DEFAULT_CAP_USD) throw new Error('cap_must_be_between_zero_and_six_usd');
if (arg('--gemini-model') && arg('--gemini-model') !== geminiModel) throw new Error('study_gemini_model_is_frozen');

function checkedFixtures() {
  if (!existsSync(FIXTURE_PATH) || !existsSync(CHECKSUM_PATH)) throw new Error('frozen_fixture_or_checksum_missing');
  const sums = readFileSync(CHECKSUM_PATH, 'utf8');
  const expected = sums.match(/^([a-f0-9]{64})\s+source-keyed-fixtures\.json$/im)?.[1];
  const actual = hash(readFileSync(FIXTURE_PATH));
  if (!expected || expected.toLowerCase() !== actual) throw new Error('fixture_hash_mismatch');
  const benchmark = read(FIXTURE_PATH);
  if (benchmark.frozen !== true || benchmark.id !== 'cuet-readiness-source-keyed-v4-2026-10-08' || benchmark.fixtures.length !== 173) throw new Error('expected_frozen_v4_173_fixture_bundle');
  const ids = new Set(benchmark.fixtures.map(f => f.anchor_id));
  if (ids.size !== 173 || benchmark.partition_counts?.existing_regression !== 95 || benchmark.partition_counts?.limited_heldout !== 42 || benchmark.partition_counts?.reserved_nonexemplar !== 36) throw new Error('fixture_partition_contract_mismatch');
  for (const f of benchmark.fixtures) {
    if (f.expected_valid !== true || f.oracle?.key !== f.candidate?.correct_answer || !/^[ABCD]$/.test(f.oracle?.key || '')) throw new Error(`official_key_or_valid_case_contract_mismatch:${f.id}`);
  }
  return { benchmark, fixtureHash: actual };
}

function makeControls(fixtures) {
  // Eight deterministic controls, each on a distinct source root. These are authored mutations,
  // not independent items; the official key establishes only the unmutated source truth.
  const ordered = [...fixtures].sort((a, b) => a.anchor_id.localeCompare(b.anchor_id));
  const used = new Set(), controls = [];
  for (const subject of ['english', 'accountancy', 'business_studies', 'economics']) {
    for (const kind of ['option_overlap', 'wrong_key']) {
      const eligible = ordered.filter(f => f.candidate.subject === subject && !used.has(f.anchor_id) && /^[ABCD]$/.test(f.oracle.key) && Array.isArray(f.candidate.options) && f.candidate.options.length === 4);
      const base = eligible.find(f => f.case_partition !== 'existing_regression') || eligible[0];
      if (!base) throw new Error(`control_root_unavailable:${subject}:${kind}`);
      used.add(base.anchor_id);
      const candidate = structuredClone(base.candidate);
      const keyedIndex = 'ABCD'.indexOf(base.oracle.key);
      let mutation;
      if (kind === 'option_overlap') {
        const duplicateIndex = (keyedIndex + 1) % 4;
        candidate.options[duplicateIndex] = candidate.options[keyedIndex];
        mutation = { kind, original_key_label: base.oracle.key, duplicated_option_label: 'ABCD'[duplicateIndex], deterministic_condition: 'A distractor is an exact duplicate of the officially keyed option.' };
      } else {
        const replacement = 'ABCD'.split('').find(k => k !== base.oracle.key);
        candidate.correct_answer = replacement;
        mutation = { kind, proposed_key_label: replacement, deterministic_condition: 'The proposed answer label is changed while the option order and official keyed text stay unchanged.' };
      }
      candidate.id = `${base.candidate.id}-control-${kind}`;
      controls.push({ id: `control-${kind}-${base.anchor_id}`, group: 'authored_control', category: kind, case_partition: base.case_partition, source_family_id: base.source_family_id,
        anchor_id: base.anchor_id, candidate, oracle: { key: base.oracle.key, basis: 'Official NTA final OMR key for the unmutated source question; mutation is deterministic and linked to this root.' }, control: mutation, base_fixture_id: base.id });
    }
  }
  return controls;
}

const { benchmark, fixtureHash } = checkedFixtures();
const allControls = makeControls(benchmark.fixtures);
const registryPath = 'data/source_registry.json';
const registryOriginal = read(registryPath);
const custodyInventoryHash = hash(readFileSync(`${ROOT}/source-inventory.json`));
const priorExemplarIds = new Set(benchmark.fixtures.filter(f => f.case_partition === 'existing_regression').map(f => f.anchor_id));
function buildRegistrySnapshot(registry) {
  const locatorsBySource = new Map();
  for (const fixture of benchmark.fixtures) for (const ref of fixture.candidate.source_refs || []) {
    const locators = locatorsBySource.get(ref.id) || new Set(); locators.add(ref.locator); locatorsBySource.set(ref.id, locators);
  }
  const sources = {};
  for (const id of [...locatorsBySource.keys()].sort()) {
    const source = registry.sources?.[id];
    if (!source) throw new Error(`frozen_source_missing:${id}`);
    const locators = [...locatorsBySource.get(id)].sort();
    const facts = {}, supports = {};
    for (const locator of locators) {
      const text = source.facts?.[locator]?.text;
      if (typeof text !== 'string' || source.supports?.[locator] !== hashJSON(text)) throw new Error(`frozen_source_excerpt_integrity_failure:${id}:${locator}`);
      facts[locator] = { text }; supports[locator] = source.supports[locator];
    }
    sources[id] = { id, version: source.version, kind: source.kind, state: source.state, reuse_permitted: source.reuse_permitted,
      identity_sha256: source.identity_sha256, extraction_checked: source.extraction_checked, chapters: source.chapters || [],
      url: source.url || null, title: source.title || null, publisher_group: source.publisher_group || null, facts, supports };
  }
  const examples = (registry.examples || []).filter(e => priorExemplarIds.has(e.id)).sort((a,b) => a.id.localeCompare(b.id)).map(e => ({
    id: e.id, subject: e.subject, chapter: e.chapter, year: e.year || null, question_type: e.question_type, difficulty: e.difficulty || null,
    final_key_matched: e.final_key_matched === true, dropped: e.dropped === true, body: e.body || '', options: e.options || [], passage_text: e.passage_text || ''
  }));
  if (examples.length !== 95) throw new Error('frozen_format_exemplar_count_mismatch');
  const subjects = ['english','accountancy','business_studies','economics'];
  return { snapshot_version: 'study-registry-projection-v1', sources,
    exam_specs: Object.fromEntries(subjects.map(s => { if (!registry.exam_specs?.[s]) throw new Error(`exam_spec_missing:${s}`); return [s, registry.exam_specs[s]]; })),
    examples, calibration_anchor_ids: [...priorExemplarIds].sort() };
}
const liveRegistryProjection = buildRegistrySnapshot(registryOriginal);
const registrySnapshotHash = hash(JSON.stringify(liveRegistryProjection));
const registrySnapshot = mode === 'freeze' ? liveRegistryProjection : existsSync(REGISTRY_SNAPSHOT_PATH) ? read(REGISTRY_SNAPSHOT_PATH) : liveRegistryProjection;
if (hash(JSON.stringify(registrySnapshot)) !== registrySnapshotHash) throw new Error('frozen_registry_projection_mismatch');
const safeCalibrationRegistry = registrySnapshot;
const selectedValid = benchmark.fixtures.filter(f => partition === 'all' || f.case_partition === partition);
const controlsSelected = partition === 'all' ? allControls : allControls.filter(c => c.case_partition === partition);
const selected = [...selectedValid, ...controlsSelected].sort((a, b) => a.id.localeCompare(b.id)).slice(0, count ?? Infinity);
const contract = {
  study_id: STUDY_ID, runner_sha256: hash(readFileSync(fileURLToPath(import.meta.url))), frozen_fixture_hash: fixtureHash,
  registry_snapshot_hash: registrySnapshotHash, custody_inventory_hash: custodyInventoryHash, fixture_id: benchmark.id,
  verifier_source_hash: hash(readFileSync('scripts/pipeline/lib/factoryEvidenceV7.mjs')),
  transport_source_hash: hash(readFileSync('scripts/pipeline/lib/factoryTransport.mjs')),
  rubric_source_hash: hash(readFileSync('scripts/pipeline/lib/cuetFit.mjs')),
  scoring_contract_hash: hash(readFileSync('data/cuet_fit_rubric.mjs')),
  eval_schema_hash: hash(JSON.stringify({ base: evalSchemaV7, anthropic: anthropicSchema(evalSchemaV7) })),
  verifier: FACTORY_VERIFIER_VERSION_V7, cuet_fit_contract: CUET_FIT_VERSION, prompt_hash: V7_PROMPT_HASH,
  topology: 'single_direct_blind_measurement_only_no_release', providers: providers.map(p => `${p}:${MODEL_BY_PROVIDER[p]}`),
  partition, case_limit: count, effort_policy: { id: EFFORT_POLICY_ID, luna: 'effortsFor(candidate).blind', gemini: 'effortsFor(candidate).gemini', haiku: 'medium' },
  calibration_rule: 'Only the 95 previously exposed exemplars are supplied as format calibration; their answer keys and explanations are never supplied. All 78 non-exemplars are excluded from calibration context.',
  key_blinding_rule: 'Remove every final_key reference before blindView/context. Proposed key and oracle key remain scoring-only. Official key is read only after the provider response is returned.',
  control_manifest_hash: hash(JSON.stringify(allControls.map(c => ({ id: c.id, base_fixture_id: c.base_fixture_id, source_family_id: c.source_family_id, category: c.category, mutation: c.control })))),
  cap_usd: DEFAULT_CAP_USD, publication: false, claims: '173 authenticated 2024 prior-paper calibration roots across four paper families, not a fresh/source-independent release set; controls are linked authored mutations.'
};
const contractHash = hash(JSON.stringify(contract));

function validFreeze() {
  if (!existsSync(FREEZE_PATH) || !existsSync(REGISTRY_SNAPSHOT_PATH)) throw new Error('study_policy_or_registry_snapshot_not_frozen_run_--freeze_first');
  const frozen = read(FREEZE_PATH);
  if (hash(JSON.stringify(frozen.contract)) !== frozen.contract_hash || frozen.registry_snapshot_hash !== registrySnapshotHash) throw new Error('study_freeze_integrity_mismatch');
  if (frozen.contract_hash !== contractHash || JSON.stringify(frozen.contract) !== JSON.stringify(contract)) {
    const compatibility = existsSync(INFRA_RESUME_PATH) ? read(INFRA_RESUME_PATH) : null;
    const semantic = value => { const { runner_sha256, transport_source_hash, ...rest } = value; return rest; };
    const compatible = compatibility?.schema === 'study-infrastructure-resume-v1' &&
      compatibility.study_id === STUDY_ID && compatibility.from_freeze_hash === frozen.contract_hash &&
      compatibility.from_runner_sha256 === frozen.contract.runner_sha256 && compatibility.from_transport_source_hash === frozen.contract.transport_source_hash &&
      compatibility.to_runner_sha256 === contract.runner_sha256 && compatibility.to_transport_source_hash === contract.transport_source_hash &&
      compatibility.semantic_contract_sha256 === hash(JSON.stringify(semantic(frozen.contract))) &&
      compatibility.semantic_contract_sha256 === hash(JSON.stringify(semantic(contract))) &&
      compatibility.preserved_outcomes === true && compatibility.paid_calls_authorized === false;
    if (!compatible) throw new Error('study_freeze_contract_mismatch');
  }
  return frozen;
}
function buildInfraResumeContract(frozen) {
  const semantic = value => { const { runner_sha256, transport_source_hash, ...rest } = value; return rest; };
  if (frozen.contract_hash !== hash(JSON.stringify(frozen.contract)) || hash(JSON.stringify(semantic(frozen.contract))) !== hash(JSON.stringify(semantic(contract)))) throw new Error('infra_resume_semantic_contract_changed');
  return { schema: 'study-infrastructure-resume-v1', study_id: STUDY_ID, from_freeze_hash: frozen.contract_hash,
    from_runner_sha256: frozen.contract.runner_sha256, from_transport_source_hash: frozen.contract.transport_source_hash,
    to_runner_sha256: contract.runner_sha256, to_transport_source_hash: contract.transport_source_hash,
    semantic_contract_sha256: hash(JSON.stringify(semantic(contract))),
    permitted_infrastructure_changes: ['cooperative stop-file check between provider judgments', 'study-only candidate attribution and cost accounting'],
    preserved_outcomes: true, paid_calls_authorized: false, created_at: new Date().toISOString() };
}
const shouldPauseBetweenPairs = stopFilePresent => stopFilePresent === true;
function assertResumeFreeze(run, frozen, currentCap) {
  const expectedProviders = frozen.contract.providers.map(p => p.split(':')[0]);
  if (run.freeze_hash !== frozen.contract_hash || run.cap_usd !== currentCap || JSON.stringify(run.providers) !== JSON.stringify(expectedProviders) ||
      JSON.stringify(run.provider_models) !== JSON.stringify(frozen.contract.providers)) throw new Error('resume_contract_or_cap_mismatch');
}
const effortsForCandidate = candidate => ({ ...measuredEffortsFor(candidate), haiku: 'medium' });
const progressKey = (fixture, provider) => `${fixture.id}:${provider}:${provider === 'gemini' ? geminiModel : MODEL_BY_PROVIDER[provider]}`;

function sourceRefsWithoutKey(fixture) {
  return (fixture.candidate.source_refs || []).filter(ref => registrySnapshot.sources?.[ref.id]?.kind !== 'final_key');
}
function academicExcerptCount(fixture) {
  return sourceRefsWithoutKey(fixture).filter(ref => {
    const source = registrySnapshot.sources?.[ref.id];
    return source?.kind === 'reference' && source.state === 'active' && source.reuse_permitted === true && source.extraction_checked === true &&
      source.version === ref.version && Boolean(ref.support_hash) && source.supports?.[ref.locator] === ref.support_hash && typeof source.facts?.[ref.locator]?.text === 'string';
  }).length;
}

const isStudyCandidateId = candidateId => typeof candidateId === 'string' && candidateId.startsWith(`${STUDY_ID}:`);
const requestCommittedMicro = row => row.state === 'settled' ? (row.actual || 0) : Math.max(row.reserved || 0, row.actual || 0);
function filterStudyRequests(rows, candidateId = null) {
  return rows.filter(r => isStudyCandidateId(r.candidate_id) && (!candidateId || r.candidate_id === candidateId));
}
function attributedCommittedMicro(rows) {
  return filterStudyRequests(rows).reduce((total, row) => total + (Number.isSafeInteger(row.committed_micro) ? row.committed_micro : requestCommittedMicro(row)), 0);
}
function studyRequestRows(ledger, candidateId = null) {
  const rows = ledger.db.prepare(`SELECT r.id,r.model,r.reserved,r.actual,r.state,r.created_at,r.receipt_json,p.request_json
    FROM requests r JOIN provider_requests p ON p.reservation_id=r.id ORDER BY r.created_at,r.id`).all().flatMap(r => {
      try { const saved = JSON.parse(r.request_json); return [{ ...r, candidate_id: saved.config?.candidate_id || null }]; } catch { return []; }
    });
  return filterStudyRequests(rows, candidateId).map(r => {
    let receipt = null; try { receipt = r.receipt_json ? JSON.parse(r.receipt_json) : null; } catch { /* preserve state without unsafe raw fields */ }
    return { id: r.id, candidate_id: r.candidate_id, model: r.model, reserved_micro: r.reserved, actual_micro: r.actual, committed_micro: requestCommittedMicro(r), state: r.state, created_at: r.created_at,
      receipt: receipt ? Object.fromEntries(['provider','model','stage','purpose','usage','provider_request_id','http_status','error','billing_basis'].filter(k => receipt[k] !== undefined).map(k => [k, receipt[k]])) : null };
  });
}
const studySpendMicro = ledger => attributedCommittedMicro(studyRequestRows(ledger));
const studyPendingCount = ledger => studyRequestRows(ledger).filter(r => r.state !== 'settled').length;

function wilson95(successes, n) {
  if (!n) return null;
  const z = 1.959963984540054, p = successes / n, den = 1 + z * z / n;
  const center = (p + z * z / (2 * n)) / den;
  const half = z * Math.sqrt((p * (1 - p) + z * z / (4 * n)) / n) / den;
  return [Math.max(0, center - half), Math.min(1, center + half)];
}

function summarize(progress, run) {
  const rows = Object.values(progress.results || {}), expected = run.expected_results || [];
  const byProvider = {};
  for (const provider of run.providers || PROVIDERS) {
    const providerExpected = expected.filter(r => r.provider === provider);
    const providerRows = providerExpected.map(e => ({ expected: e, result: progress.results[e.result_id] || null }));
    const judged = providerRows.filter(x => x.result?.status === 'judged').map(x => x.result);
    const validExpected = providerRows.filter(x => x.expected.case_type === 'authentic_pyq');
    const valid = validExpected.flatMap(x => x.result?.status === 'judged' ? [x.result] : []);
    const controlsExpected = providerRows.filter(x => x.expected.case_type === 'authored_control');
    const controls = controlsExpected.flatMap(x => x.result?.status === 'judged' ? [x.result] : []);
    const errorCount = providerRows.filter(x => x.result?.status === 'error').length;
    const missingCount = providerRows.filter(x => !x.result).length;
    const subjects = {};
    for (const subject of ['english','accountancy','business_studies','economics']) {
      const expectedSubject = validExpected.filter(x => x.expected.subject === subject);
      const sr = valid.filter(r => r.subject === subject);
      const agreements = sr.filter(r => r.key_agrees === true).length;
      const expectedErrors = expectedSubject.filter(x => x.result?.status === 'error').length;
      const expectedMissing = expectedSubject.filter(x => !x.result).length;
      const expectedN = expectedSubject.length;
      subjects[subject] = { expected_n: expectedN, scored_n: sr.length, errors: expectedErrors, missing: expectedMissing, official_key_agreement_count: agreements,
        key_agreement_rate_scored_only: sr.length ? agreements / sr.length : null, coverage_adjusted_agreement_rate: expectedN ? agreements / expectedN : null,
        naive_binomial_wilson_95_ci_scored_only: wilson95(agreements, sr.length),
        abstentions: sr.filter(r => r.abstained).length, false_rejection_cuet_fit_count: sr.filter(r => r.cuet_fit_pass === false).length,
        false_rejection_cuet_fit_rate_of_expected: expectedN ? sr.filter(r => r.cuet_fit_pass === false).length / expectedN : null,
        nonunique_flagged: sr.filter(r => r.single_defensible_answer === false).length };
    }
    const agreements = valid.filter(r => r.key_agrees === true).length, validExpectedN = validExpected.length;
    byProvider[provider] = { model: provider === 'gemini' ? geminiModel : MODEL_BY_PROVIDER[provider], expected_valid_pyq_n: validExpectedN, scored_valid_pyq_n: valid.length,
      errors: errorCount, missing: missingCount, subjects,
      official_key_accuracy: { expected_denominator: validExpectedN, scored: valid.length, errors: validExpected.filter(x => x.result?.status === 'error').length,
        missing: validExpected.filter(x => !x.result).length, agreements, rate_among_scored: valid.length ? agreements / valid.length : null,
        coverage_adjusted_agreement_rate: validExpectedN ? agreements / validExpectedN : null, naive_binomial_wilson_95_ci_scored_only: wilson95(agreements, valid.length) },
      abstentions: valid.filter(r => r.abstained).length, false_rejection_cuet_fit_count: valid.filter(r => r.cuet_fit_pass === false).length,
      false_rejection_cuet_fit_rate_of_expected: validExpectedN ? valid.filter(r => r.cuet_fit_pass === false).length / validExpectedN : null,
      source_support_false: valid.filter(r => r.source_support === false).length, source_support_true: valid.filter(r => r.source_support === true).length,
      cases_with_no_academic_excerpt: valid.filter(r => r.academic_reference_excerpt_count === 0).length,
      cases_with_any_academic_excerpt: valid.filter(r => r.academic_reference_excerpt_count > 0).length,
      controls: { expected_n: controlsExpected.length, scored_n: controls.length,
        option_overlap_expected: controlsExpected.filter(x => x.expected.control_kind === 'option_overlap').length,
        option_overlap_scored: controls.filter(r => r.control_kind === 'option_overlap').length,
        option_overlap_caught: controls.filter(r => r.control_kind === 'option_overlap' && r.overlap_caught === true).length,
        wrong_key_expected: controlsExpected.filter(x => x.expected.control_kind === 'wrong_key').length,
        wrong_key_scored: controls.filter(r => r.control_kind === 'wrong_key').length,
        wrong_key_caught_by_official_solve: controls.filter(r => r.control_kind === 'wrong_key' && r.key_agrees === true).length }
    };
  }
  const uniqueRoots = new Set(rows.map(r => r.anchor_id));
  const errorCount = expected.filter(e => progress.results[e.result_id]?.status === 'error').length;
  const missingCount = expected.filter(e => !progress.results[e.result_id]).length;
  return { study_id: STUDY_ID, freeze_hash: run.freeze_hash, as_of: new Date().toISOString(), state: run.state,
    report_scope: 'Calibration/limited two-subject evaluation only; not a release qualification.', provenance: { authenticated_2024_roots: 173, prior_exemplars: 95, nonexemplars_limited_bs_economics: 42, nonexemplars_reserved_english_accountancy: 36, paper_source_families: 4,
      root_family_correlation: 'All 173 roots are nested in four 2024 Book-A paper families (one per subject); roots and controls are correlated within those paper families.',
      reused_source_limitation: 'No new-source four-subject holdout was authenticated; 2024 cases are prior-paper calibration, not fresh evidence.' },
    counts: { expected_provider_judgments: expected.length, judged: rows.filter(r => r.status === 'judged').length, errors: errorCount, missing: missingCount,
      selected_cases: new Set(expected.map(r => r.case_id)).size, unique_source_roots: uniqueRoots.size,
      valid_pyq_expected: expected.filter(r => r.case_type === 'authentic_pyq').length, authored_controls_expected: expected.filter(r => r.case_type === 'authored_control').length },
    providers: byProvider, uncertainty_interpretation: 'Wilson intervals are naive item-level binomial intervals only. They do not adjust for shared paper-family correlation; with one paper family per subject, broader population intervals cannot be estimated from this sample.',
    source_support_interpretation: 'Source-support judgments are reported separately. A false source_support decision on thin excerpts is not evidence that an official-keyed authentic PYQ is academically false.',
    limits: ['No fresh full-pipeline yield measurement.', 'No independent source-family split.', 'No four-subject fresh release evidence.', 'No publication or production release.', 'Difficulty labels are unassessed metadata.', 'Model agreement is not truth.'],
    budget: { cap_usd: run.cap_usd, study_committed_usd: run.study_committed_usd ?? null, pending_usage_receipts: run.pending_usage_receipts ?? 0 }
  };
}

if (mode === 'prepare-infra-resume') {
  if (!existsSync(FREEZE_PATH) || !existsSync(REGISTRY_SNAPSHOT_PATH)) throw new Error('study_freeze_missing');
  if (existsSync(INFRA_RESUME_PATH)) throw new Error('infra_resume_contract_already_exists_refuse_overwrite');
  const frozen = read(FREEZE_PATH), compatibility = buildInfraResumeContract(frozen);
  if (existsSync(RUN_PATH) && read(RUN_PATH).freeze_hash !== frozen.contract_hash) throw new Error('run_freeze_does_not_match_infra_resume_source');
  if (existsSync(PROGRESS_PATH) && read(PROGRESS_PATH).freeze_hash !== frozen.contract_hash) throw new Error('progress_freeze_does_not_match_infra_resume_source');
  save(INFRA_RESUME_PATH, compatibility);
  console.log(JSON.stringify({ infrastructure_resume_contract: INFRA_RESUME_PATH, schema: compatibility.schema, from_freeze_hash: compatibility.from_freeze_hash,
    semantic_contract_sha256: compatibility.semantic_contract_sha256, preserved_outcomes: true, paid_calls_authorized: false }));
} else if (mode === 'plan') {
  const partitions = Object.fromEntries(['existing_regression','limited_heldout','reserved_nonexemplar'].map(p => [p, { valid_pyq: benchmark.fixtures.filter(f => f.case_partition === p).length, controls: allControls.filter(c => c.case_partition === p).length }]));
  let frozenMatches = false;
  try { validFreeze(); frozenMatches = hash(JSON.stringify(read(REGISTRY_SNAPSHOT_PATH))) === registrySnapshotHash; } catch { /* plan reports an unprepared freeze without failing */ }
  console.log(JSON.stringify({ mode, study_id: STUDY_ID, fixture_hash: fixtureHash, contract_hash: contractHash, verifier: contract.verifier, cuet_fit_contract: contract.cuet_fit_contract,
    providers: contract.providers, partition, selected_case_count: selected.length, provider_judgments_if_run: selected.length * providers.length, partitions, controls_total: allControls.length,
    cap_usd: capUsd, frozen: frozenMatches, infrastructure_resume_contract: existsSync(INFRA_RESUME_PATH) ? 'present' : null, cooperative_stop_file: STOP_FILE_PATH, paid_calls: false, publication: false,
    command_after_parent_approval: 'node --use-system-ca scripts/pipeline/tools/runOfficialCuetReadinessStudy.mjs --execute --approved --partition limited_heldout --cap-usd 6' }, null, 2));
} else if (mode === 'self-test') {
  const frozen = validFreeze();
  const authenticCases = ['existing_regression','limited_heldout','reserved_nonexemplar'].map(p => benchmark.fixtures.find(f => f.case_partition === p));
  const leakageCases = [...authenticCases, ...allControls];
  const forbiddenFields = new Set(['correct_answer','proposed_answer','proposed_key','proposed_key_label','oracle','answer_key','authenticated_anchor_key','key_quote']);
  const hasForbiddenField = value => {
    if (Array.isArray(value)) return value.some(hasForbiddenField);
    if (!value || typeof value !== 'object') return false;
    return Object.entries(value).some(([key, child]) => forbiddenFields.has(key) || hasForbiddenField(child));
  };
  const extractUserJSON = (provider, body) => {
    const raw = provider === 'openai' ? body.input.find(row => row.role === 'user').content : provider === 'anthropic' ? body.messages[0].content : body.contents[0].parts[0].text;
    return JSON.parse(raw);
  };
  let promptCaptures = 0;
  const commonInputs = new Map();
  for (const fixture of leakageCases) for (const provider of providers) {
    const ledger = { getCache: () => null, setCache: () => {} };
    let captured;
    const transport = { generate: async (p, body) => { captured = { provider: p, body }; throw new Error('__offline_capture_stop__'); } };
    const adapters = createFactoryEvidenceV7({ registry: safeCalibrationRegistry, ledger, transport, topology: { id: 'self_test', primary: 'openai', secondary: null, explanation: null },
      geminiModel, exemplarExclude: benchmark.fixtures.filter(f => f.case_partition !== 'existing_regression').map(f => f.anchor_id), calibrationPurpose: true,
      efforts: { ...measuredEffortsFor(fixture.candidate), haiku: 'medium' } });
    const canaryCandidate = { ...fixture.candidate, correct_answer: `PROPOSED_ANSWER_CANARY_${fixture.id}` };
    const refs = sourceRefsWithoutKey(fixture);
    try { await adapters.__evaluation(blindView({ ...canaryCandidate, source_refs: refs }, refs), provider); }
    catch (error) { if (error.message !== '__offline_capture_stop__') throw error; }
    if (!captured || captured.provider !== provider) throw new Error('self_test_failed_no_prompt_capture');
    const input = extractUserJSON(provider, captured.body), serialized = JSON.stringify(input);
    if (hasForbiddenField(input) || serialized.includes(canaryCandidate.correct_answer)) throw new Error(`self_test_failed_answer_leak:${fixture.id}:${provider}`);
    const finalKeyIds = Object.values(safeCalibrationRegistry.sources).filter(s => s.kind === 'final_key').map(s => s.id);
    if (finalKeyIds.some(id => serialized.includes(id))) throw new Error(`self_test_failed_final_key_source_leak:${fixture.id}:${provider}`);
    const expectedOptions = (canaryCandidate.options || []).map(option => typeof option === 'string' ? option : option.text);
    const visibleOptions = (input.options || []).map(option => typeof option === 'string' ? option : option.text);
    if (!Array.isArray(input.options) || JSON.stringify(visibleOptions) !== JSON.stringify(expectedOptions)) throw new Error(`self_test_failed_shared_question_body:${fixture.id}:${provider}`);
    const commonInputHash = hash(serialized), priorInputHash = commonInputs.get(fixture.id);
    if (priorInputHash && priorInputHash !== commonInputHash) throw new Error(`self_test_failed_cross_model_input_mismatch:${fixture.id}:${provider}`);
    commonInputs.set(fixture.id, commonInputHash);
    promptCaptures += 1;
  }
  const unrelatedMutation = structuredClone(registryOriginal);
  unrelatedMutation.version += 1; unrelatedMutation.examples.push({ id: 'unrelated-new-family', subject: 'other', body: 'irrelevant' });
  if (hash(JSON.stringify(buildRegistrySnapshot(unrelatedMutation))) !== registrySnapshotHash) throw new Error('self_test_failed_unrelated_registry_change_invalidated_projection');
  const testRun = { cap_usd: capUsd, providers: frozen.contract.providers.map(p => p.split(':')[0]), provider_models: frozen.contract.providers };
  let staleRejected = false;
  try { assertResumeFreeze({ ...testRun, freeze_hash: 'stale-policy-hash' }, frozen, capUsd); } catch (error) { staleRejected = error.message === 'resume_contract_or_cap_mismatch'; }
  if (!staleRejected) throw new Error('self_test_failed_stale_resume_accepted');
  assertResumeFreeze({ ...testRun, freeze_hash: frozen.contract_hash }, frozen, capUsd);
  const modelSpecificKeys = new Set(providers.map(provider => progressKey(leakageCases[0], provider)));
  if (modelSpecificKeys.size !== providers.length) throw new Error('self_test_failed_model_progress_collision');
  if (!shouldPauseBetweenPairs(true) || shouldPauseBetweenPairs(false)) throw new Error('self_test_failed_cooperative_stop_file_boundary');
  const accountingCandidate = `${STUDY_ID}:accounting-self-test:anthropic:${MODEL_BY_PROVIDER.anthropic}`;
  const accountingRows = [
    { id: 'study-settled', candidate_id: accountingCandidate, reserved: 900, actual: 37, state: 'settled' },
    { id: 'concurrent-root-settled', candidate_id: 'root-controller:cohort-100:openai', reserved: 8000000, actual: 7000000, state: 'settled' },
    { id: 'study-held', candidate_id: `${STUDY_ID}:hold-self-test:gemini:${geminiModel}`, reserved: 510, actual: 140, state: 'unresolved' }
  ];
  const accountingCost = attributedCommittedMicro(accountingRows);
  if (accountingCost !== 547 || filterStudyRequests(accountingRows, accountingCandidate).length !== 1) throw new Error('self_test_failed_study_cost_attribution_or_hold_maximum');
  const mappedReceiptRows = accountingRows.filter(row => isStudyCandidateId(row.candidate_id)).map(row => ({ candidate_id: row.candidate_id, committed_micro: requestCommittedMicro(row) }));
  if (attributedCommittedMicro(mappedReceiptRows) !== 547) throw new Error('self_test_failed_mapped_receipt_cost_attribution');
  const cachedReplayRows = [...accountingRows]; // A cache replay creates no request row and adds no attributed cost.
  if (attributedCommittedMicro(cachedReplayRows) !== accountingCost || filterStudyRequests(cachedReplayRows, accountingCandidate).length !== 1) throw new Error('self_test_failed_cached_replay_accounting');
  console.log(JSON.stringify({ self_test: 'passed', paid_calls: 0, providers_tested: providers, leakage_cases: leakageCases.length, prompt_captures: promptCaptures,
    stale_resume_rejected: staleRejected, model_specific_progress: true, unrelated_registry_addition_ignored: true,
    unrelated_concurrent_request_excluded: true, unsettled_hold_counted_at_maximum: true, cached_replay_not_double_counted: true,
    cooperative_stop_file_between_provider_pairs: true, contract_hash: frozen.contract_hash }));
} else if (mode === 'freeze') {
  if (existsSync(FREEZE_PATH) && (existsSync(RUN_PATH) || existsSync(PROGRESS_PATH))) throw new Error('study_already_started_refuse_refreeze');
  save(REGISTRY_SNAPSHOT_PATH, registrySnapshot);
  save(FREEZE_PATH, { frozen_at: new Date().toISOString(), contract_hash: contractHash, contract, registry_snapshot_hash: registrySnapshotHash, evidence: { fixture_hash: fixtureHash,
    authentic_roots: benchmark.fixtures.length, paper_families: benchmark.distinct_paper_source_families, controls: allControls.length } });
  console.log(JSON.stringify({ frozen: true, freeze_path: FREEZE_PATH, contract_hash: contractHash, fixture_hash: fixtureHash }));
} else {
  const frozen = validFreeze();
  if (mode === 'report') {
    if (!existsSync(RUN_PATH) || !existsSync(PROGRESS_PATH)) throw new Error('study_run_not_started');
    const run = read(RUN_PATH), progress = read(PROGRESS_PATH), report = summarize(progress, run);
    save(REPORT_PATH, report); console.log(JSON.stringify({ report: REPORT_PATH, judgments: report.counts.judged, errors: report.counts.errors, missing: report.counts.missing, state: report.state, providers: Object.keys(report.providers) }));
  } else {
    if (!has('--approved')) throw new Error('paid_calls_require_parent_approval_flag_and_frozen_policy');
    const existingRunBeforeLedger = existsSync(RUN_PATH) ? read(RUN_PATH) : null;
    if (existingRunBeforeLedger) assertResumeFreeze(existingRunBeforeLedger, frozen, capUsd);
    try { loadEnvFile('.env.local'); } catch { /* environment may be injected */ }
    const ledger = new BudgetLedger(process.env.CUET_BUDGET_LEDGER || 'data/pipeline-budget.sqlite');
    let stopAfterCurrent = false, interrupted = false, haltReason = null;
    process.on('SIGINT', () => { interrupted = true; stopAfterCurrent = true; console.warn('Interrupt received; finishing current provider request and saving progress.'); });
    try {
      ledger.assertHistoryReconciled();
      let run = existsSync(RUN_PATH) ? read(RUN_PATH) : null;
      let progress = existsSync(PROGRESS_PATH) ? read(PROGRESS_PATH) : null;
      if (!run) {
        const expectedResults = selected.flatMap(fixture => providers.map(provider => ({ result_id: progressKey(fixture, provider), case_id: fixture.id,
          case_type: fixture.group, subject: fixture.candidate.subject, control_kind: fixture.control?.kind || null, provider,
          model: provider === 'gemini' ? geminiModel : MODEL_BY_PROVIDER[provider] })));
        run = { study_id: STUDY_ID, freeze_hash: frozen.contract_hash, started_at: new Date().toISOString(), cap_usd: capUsd, providers, provider_models: contract.providers,
          study_committed_usd: 0, state: 'running', selected_partition: partition, requested_count: count, expected_results: expectedResults };
        progress = { study_id: STUDY_ID, freeze_hash: frozen.contract_hash, results: {}, completed_pairs: 0 };
      } else assertResumeFreeze(run, frozen, capUsd);
      if (!progress || progress.freeze_hash !== frozen.contract_hash) throw new Error('progress_contract_mismatch');
      const expectedIds = selected.flatMap(fixture => providers.map(provider => progressKey(fixture, provider))).sort();
      if (JSON.stringify(expectedIds) !== JSON.stringify(run.expected_results.map(r => r.result_id).sort())) throw new Error('resume_scope_mismatch');
      const pricing = read('data/pipeline-prices.json');
      const native = createFactoryTransport({ ledger, geminiModel, realtimeStages: ['blind_solution','independent_evaluation'] });
      const guardedTransport = { generate: async (provider, body, opts = {}) => {
        const model = provider === 'gemini' ? geminiModel : MODEL_BY_PROVIDER[provider];
        const profile = pricing.models?.[model];
        if (!profile) throw new Error(`study_model_price_missing:${model}`);
        const rates = profile;
        const outputTokens = provider === 'openai' ? body.max_output_tokens : provider === 'anthropic' ? body.max_tokens : body.generationConfig?.maxOutputTokens;
        const reserveMicro = Math.ceil(profile.max_input_tokens * Math.max(rates.input_per_million, rates.cache_write_per_million || 0) + outputTokens * rates.output_per_million);
        if (!isStudyCandidateId(opts.candidate_id)) throw new Error('study_candidate_attribution_required');
        const currentStudySpend = studySpendMicro(ledger);
        if ((currentStudySpend + reserveMicro) / 1e6 > Math.min(capUsd, run.cap_usd)) throw new Error('study_cap_preflight_exceeded');
        if (stopAfterCurrent) throw new Error('study_stopping_after_current_request');
        return native.generate(provider, body, { ...opts, batch: false, purpose: 'calibration' });
      } };
      for (const fixture of selected) {
        const scopedTransport = { generate: (provider, body, opts = {}) => {
          const model = provider === 'gemini' ? geminiModel : MODEL_BY_PROVIDER[provider];
          return guardedTransport.generate(provider, body, { ...opts, candidate_id: `${STUDY_ID}:${fixture.id}:${provider}:${model}` });
        } };
        const adapters = createFactoryEvidenceV7({ registry: safeCalibrationRegistry, ledger, transport: scopedTransport, topology: { id: 'direct_blind', primary: 'openai', secondary: null, explanation: null },
          geminiModel, exemplarExclude: [...benchmark.fixtures.filter(f => f.case_partition !== 'existing_regression').map(f => f.anchor_id)], calibrationPurpose: true, efforts: effortsForCandidate(fixture.candidate) });
        for (const provider of providers) {
          if (shouldPauseBetweenPairs(existsSync(STOP_FILE_PATH))) { haltReason = 'paused_by_stop_file_between_provider_pairs'; break; }
          const model = provider === 'gemini' ? geminiModel : MODEL_BY_PROVIDER[provider];
          const resultId = progressKey(fixture, provider);
          if (progress.results[resultId]?.status === 'judged') continue;
          if (stopAfterCurrent) break;
          const studyCandidateId = `${STUDY_ID}:${fixture.id}:${provider}:${model}`;
          let result, error = null;
          try {
            // The key source is filtered before the blind boundary. Oracle access is scoring-only below.
            const blindCandidate = { ...fixture.candidate, source_refs: sourceRefsWithoutKey(fixture) };
            const view = blindView(blindCandidate, sourceRefsWithoutKey(fixture));
            result = await adapters.__evaluation(view, provider);
          } catch (e) {
            if (e.message === 'study_cap_preflight_exceeded') { haltReason = 'study_cap_reached_incomplete'; break; }
            if (e.message === 'study_stopping_after_current_request') { stopAfterCurrent = true; break; }
            error = e.message;
          }
          const usageRows = studyRequestRows(ledger, studyCandidateId);
          const judgement = result ? {
            provider, model, study_candidate_id: studyCandidateId, status: 'judged', case_id: fixture.id, case_type: fixture.group, case_partition: fixture.case_partition, control_kind: fixture.control?.kind || null,
            subject: fixture.candidate.subject, anchor_id: fixture.anchor_id, paper_family: fixture.source_family_id, key_agrees: result.solved_key === fixture.oracle.key,
            abstained: result.solved_key === 'abstain', single_defensible_answer: result.single_defensible_answer, source_support: result.source_support,
            academic_reference_excerpt_count: academicExcerptCount(fixture),
            syllabus_entitlement: result.syllabus_entitlement, cuet_fit_pass: result.exam_fit, cuet_fit_score: result.cuet_fit_result?.score ?? null,
            cuet_fit_levels: result.cuet_fit_result?.levels ?? null, solved_key: result.solved_key, reference_quotes_valid: result.reference_quotes_valid,
            overlap_caught: fixture.control?.kind === 'option_overlap' ? result.single_defensible_answer === false || (result.defects || []).some(d => /multiple_correct_options|option_challenges/.test(d)) : null,
            usage_request_ids: usageRows.map(r => r.id), usage_requests: usageRows, judged_at: new Date().toISOString()
          } : { provider, model, study_candidate_id: studyCandidateId, status: 'error', case_id: fixture.id, case_type: fixture.group, case_partition: fixture.case_partition, control_kind: fixture.control?.kind || null,
            subject: fixture.candidate.subject, anchor_id: fixture.anchor_id, paper_family: fixture.source_family_id, error, usage_request_ids: usageRows.map(r => r.id), usage_requests: usageRows, judged_at: new Date().toISOString() };
          progress.results[resultId] = judgement;
          progress.completed_pairs = Object.values(progress.results).filter(r => r.status === 'judged').length;
          run.study_committed_usd = studySpendMicro(ledger) / 1e6;
          run.pending_usage_receipts = studyPendingCount(ledger);
          run.state = stopAfterCurrent ? 'interrupted_after_current_request' : 'running';
          save(PROGRESS_PATH, progress); save(RUN_PATH, run);
          console.log(JSON.stringify({ case_id: fixture.id, provider, status: judgement.status, study_spend_usd: run.study_committed_usd, completed_pairs: progress.completed_pairs }));
        }
        if (haltReason) break;
        if (stopAfterCurrent) break;
      }
      const errors = run.expected_results.filter(expected => progress.results[expected.result_id]?.status === 'error').length;
      const missing = run.expected_results.filter(expected => !progress.results[expected.result_id]).length;
      run.state = haltReason || (stopAfterCurrent ? 'interrupted_after_current_request' : missing ? 'incomplete_missing_judgments' : errors ? 'terminal_errors' : 'completed_selected_scope');
      run.error_count = errors; run.missing_count = missing;
      run.study_committed_usd = studySpendMicro(ledger) / 1e6;
      run.pending_usage_receipts = studyPendingCount(ledger);
      run.finished_at = stopAfterCurrent || haltReason || missing ? null : new Date().toISOString();
      save(RUN_PATH, run); save(REPORT_PATH, summarize(progress, run));
      console.log(JSON.stringify({ state: run.state, expected: run.expected_results.length, judgments: progress.completed_pairs, errors: run.error_count, missing: run.missing_count,
        study_committed_usd: run.study_committed_usd, pending_usage_receipts: run.pending_usage_receipts, report: REPORT_PATH, interrupted }));
    } finally { ledger.close(); }
  }
}
