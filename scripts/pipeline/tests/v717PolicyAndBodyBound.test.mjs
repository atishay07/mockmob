import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { contentHash } from '../../../data/content_evidence.js';
import { hashJSON } from '../../../data/question_factory_policy.mjs';
import { deriveScorecardV717, BLIND_SCORE_IDS_V717, ISSUE_CATEGORIES_V717, scorecardFormatIssuesV717 } from '../lib/scorecardPolicyV717.mjs';
import { createScorecardReviewV717 } from '../lib/scorecardReviewV717.mjs';
import { FACTORY_VERIFIER_VERSION_V717, validationContractV717 } from '../lib/contractV717.mjs';
import { scorecardPromptHashV717 } from '../lib/scorecardReviewV717.mjs';
import { assertQualifiedPilotV717 } from '../lib/qualifiedPilotV717.mjs';
import { publicationUnitKeyV717, publishUnitV717 } from '../lib/publicationBridgeV717.mjs';
import { buildExecutionFreezeV717, assertExecutionFreezeV717 } from '../lib/executionFreezeV717.mjs';
import { assertRegistrationV717, openCampaignSessionV717 } from '../lib/campaignSessionV717.mjs';
import { SCORECARD_OUTPUT_CAPS_V717 } from '../lib/scorecardReviewV717.mjs';
import { maximumRequestMicro } from '../lib/campaignExecutionV7.mjs';

const SRC = 'E1.1';
const candidate = (overrides = {}) => ({
  id: 'v717-local-policy-case', subject: 'accountancy', chapter: 'Cash Flow Statement', family_id: 'family-v717',
  route: 'conceptual', question_type: 'conceptual_mcq', difficulty: 'medium',
  body: 'A retailer receives cash from customers for goods sold. How should the receipt be classified?',
  options: ['Operating activity.', 'Investing activity.', 'Financing activity.', 'No cash flow.'].map((text, i) => ({ key: 'ABCD'[i], text })),
  correct_answer: 'A', explanation: 'Cash received from customers for goods sold is an operating activity.',
  learning_objective: { syllabus_unit: 'Cash Flow Statement', objective: 'Classify cash receipts from sales.', target_term: '' },
  provenance: { kind: 'original_practice', adaptation_family: 'family-v717', syllabus_version: 'offline', pattern_version: 'offline', source_pack_id: 'pack-v717', source_pack_version: 1 },
  source_refs: [{ id: 'source-v717', version: 1, locator: 'excerpt', support_hash: hashJSON('Cash received from customers for goods sold is an operating cash flow.') }],
  ...overrides,
});
const scores = n => Object.fromEntries(BLIND_SCORE_IDS_V717.map(id => [id, { score: n, note: `Evaluated parameter ${id}.` }]));
const academic = { syllabus_entitlement: 'supported', source_support: 'supported', decisive_assumptions: 'not_applicable', numerical_accuracy: 'not_applicable',
  boundary_cases: 'not_applicable', passage_answerability: 'not_applicable', completeness: 'supported', format_valid: 'supported', presentation_readable: 'supported' };
function blind(item, provider, { score = 8, key = 'A', answerSet = [key], optionStatus = {}, derivation, options, issues } = {}) {
  const stage = provider === 'openai' ? 'blind_solution' : 'independent_evaluation';
  return { candidate_id: item.id, content_hash: contentHash(item), provider, model: provider === 'openai' ? 'gpt-6-luna' : 'gemini-3.8-flash', stage,
    solved_key: key, answer_set: answerSet, derivation: derivation || 'The supplied rule and transaction establish the selected classification.', source_ids: [SRC],
    options: options || ['A', 'B', 'C', 'D'].map(option => ({ option, status: optionStatus[option] || (option === key ? 'defensible' : 'not_answer'),
      basis: 'excerpt', source_ids: [SRC], reason: 'The supplied excerpt resolves this whole option.' })),
    academic: structuredClone(academic), difficulty_assessment: { level: 'medium', reason: 'Ordinary direct application.', comparison_basis: 'heuristic',
      operation: 'Classify a stated transaction by its supplied rule.', concepts_conditions: ['cash receipt', 'operating activity'], exemplar_ids: [] },
    scores: scores(score), issues: issues || [] };
}
function audit(item, { score = 8, explanationStatus = 'supported', claimStatus = 'supported', answerSet = ['A'] } = {}) {
  return { candidate_id: item.id, content_hash: contentHash(item), provider: 'openai', model: 'gpt-6-luna', stage: 'explanation_support', answer_set: answerSet,
    explanation_status: explanationStatus, options_status: 'supported', source_ids: [SRC],
    claims: [{ claim: item.explanation, basis: 'excerpt', status: claimStatus, source_ids: [SRC], reason: 'The registered source supports this claim.' }],
    scores: Object.fromEntries(['13', '14', '17', '20'].map(id => [id, { score, note: `Audited parameter ${id}.` }])), issues: [] };
}
const checks = { structure: true, presentation: true, provenance: true, syllabus_registry: true, source_integrity: true, novelty: true, numeric_required: false };
const context = { evidenceCatalog: [{ id: SRC }], calibrationExemplars: [], localChecks: checks };

test('V717 separates contradictory NOT-stem reports from coherent academic failures', () => {
  const item = candidate({ body: 'Which of the following is NOT an operating cash flow?' });
  const inverted = [blind(item, 'openai', { optionStatus: { A: 'not_answer' } }), blind(item, 'gemini')];
  const incomplete = deriveScorecardV717(item, inverted, audit(item), context);
  assert.equal(incomplete.state, 'error');
  assert.equal(incomplete.outcome, 'review_incomplete');
  assert.equal(incomplete.academic_sound, null);

  const wrongKey = [blind(item, 'openai', { key: 'B' }), blind(item, 'gemini')];
  const wrong = deriveScorecardV717(item, wrongKey, null, context);
  assert.equal(wrong.state, 'quarantined');
  assert.equal(wrong.outcome, 'academic_quarantine');
  assert.equal(wrong.academic_sound, false);

  const multiple = [blind(item, 'openai', { answerSet: ['A', 'B'], optionStatus: { B: 'defensible' } }), blind(item, 'gemini')];
  const multi = deriveScorecardV717(item, multiple, null, context);
  assert.equal(multi.outcome, 'academic_quarantine');
  assert.equal(multi.academic_sound, false);

  const rival = [blind(item, 'openai', { optionStatus: { B: 'unresolved' } }), blind(item, 'gemini')];
  const unresolved = deriveScorecardV717(item, rival, null, context);
  assert.equal(unresolved.outcome, 'academic_quarantine');
  assert.equal(unresolved.academic_sound, false);
});

test('V717 distinguishes an internally contradictory explanation audit from an actual unsupported claim', () => {
  const item = candidate();
  const reports = [blind(item, 'openai'), blind(item, 'gemini')];
  const contradiction = deriveScorecardV717(item, reports, audit(item, { claimStatus: 'unsupported' }), context);
  assert.equal(contradiction.state, 'error');
  assert.equal(contradiction.outcome, 'review_incomplete');
  assert.equal(contradiction.academic_sound, null);

  const coherentFailure = deriveScorecardV717(item, reports, audit(item, { explanationStatus: 'issue', claimStatus: 'unsupported' }), context);
  assert.equal(coherentFailure.state, 'quarantined');
  assert.equal(coherentFailure.outcome, 'academic_quarantine');
  assert.equal(coherentFailure.academic_sound, false);
});

test('V717 routes exactly six to practice and only seven or more to NTA', () => {
  const item = candidate();
  for (const [score, practice, nta] of [[6, true, false], [6.999, true, false], [7, true, true]]) {
    const result = deriveScorecardV717(item, [blind(item, 'openai', { score }), blind(item, 'gemini', { score })], audit(item, { score }), context);
    assert.equal(result.quality_score, score);
    assert.equal(result.modes.practice, practice);
    assert.equal(result.modes.nta, nta);
    assert.equal(result.route_band, nta ? 'nta_eligible' : 'practice_only');
  }
});

function requestInput(provider, body) {
  return provider === 'openai' ? JSON.parse(body.input.find(row => row.role === 'user').content) : JSON.parse(body.contents[0].parts[0].text);
}
function registryFor(item) {
  const ref = item.source_refs[0], text = 'Cash received from customers for goods sold is an operating cash flow.';
  return { version: 'registry-v717-sizing', examples: [], packs: { 'pack-v717': { state: 'active', version: 1, subject: 'accountancy' } },
    families: { 'family-v717': { state: 'active', version: 1 } },
    exam_specs: { accountancy: { state: 'verified', included_topics: ['Cash Flow Statement'], excluded_topics: [], syllabus_version: 'offline', pattern_version: 'offline', pattern_rules: {}, exam_rule_version: 'offline' } },
    sources: { [ref.id]: { id: ref.id, state: 'active', reuse_permitted: true, identity_sha256: 'a'.repeat(64), extraction_checked: true, version: ref.version,
      supports: { [ref.locator]: ref.support_hash }, facts: { [ref.locator]: { text } }, chapters: ['Cash Flow Statement'], kind: 'textbook', title: 'Offline source', url: 'https://example.test/source' } } };
}
function longestHistoricalFields() {
  const path = resolve('artifacts/question-factory/cuet-readiness-2026-10-09/execution/final-pass-v716/qualification-fresh32b/state.json');
  const state = JSON.parse(readFileSync(path, 'utf8'));
  let longest = null;
  for (const row of Object.values(state.cases || {})) for (const report of row.checks?.reports || []) {
    const fields = { derivation: report.derivation, options: report.options, issues: report.issues };
    const bytes = Buffer.byteLength(JSON.stringify(fields), 'utf8');
    if (!longest || bytes > longest.bytes) longest = { fields, bytes };
  }
  assert.ok(longest, 'frozen V716 report fixture should be present');
  return longest;
}

test('V717 body sizing exercises real adapter retries with longest observed V716 blind fields', async () => {
  const item = candidate(), observed = longestHistoricalFields(), cache = new Map(), captured = [], attempts = new Map();
  const rawFields = observed.fields;
  const oldOptions = rawFields.options.map((row, index) => ({ option: 'ABCD'[index], status: index === 0 ? 'defensible' : 'not_answer', basis: ['stem', 'excerpt', 'calculation', 'passage_scope', 'case_scope', 'unknown'].includes(row.basis) ? row.basis : 'excerpt',
    source_ids: [SRC], reason: row.reason || 'Observed V716 option assessment.' }));
  const oldIssues = (rawFields.issues || []).map(issue => ({ category: ISSUE_CATEGORIES_V717.includes(issue.category) ? issue.category : 'craft_suggestion', detail: issue.detail || 'Observed V716 review note.' }));
  const transport = { async generate(provider, body, options) {
    const bytes = Buffer.byteLength(JSON.stringify(body), 'utf8');
    const input = requestInput(provider, body), attempt = (attempts.get(options.stage) || 0) + 1;
    attempts.set(options.stage, attempt);
    captured.push({ provider, stage: options.stage, key: options.key, bytes, cap: provider === 'openai' ? body.max_output_tokens : body.generationConfig.maxOutputTokens,
      input, bodyHash: createHash('sha256').update(JSON.stringify(body)).digest('hex') });
    if (attempt === 1) throw new Error('invalid_provider_json'); // Exercise the real, bounded completion retry for every stage.
    let raw;
    if (options.stage === 'explanation_support') raw = audit(item, { answerSet: ['A'] });
    else raw = blind(item, provider, { derivation: rawFields.derivation, options: oldOptions, issues: oldIssues });
    raw.candidate_id = input.candidate_id; raw.content_hash = input.content_hash; raw.source_ids = [input.evidence_catalog[0].id];
    if (options.stage !== 'explanation_support') raw.options = raw.options.map(row => ({ ...row, source_ids: [input.evidence_catalog[0].id] }));
    else raw.claims = raw.claims.map(claim => ({ ...claim, source_ids: [input.evidence_catalog[0].id] }));
    return { output_text: JSON.stringify(raw) };
  } };
  const reviewer = createScorecardReviewV717({ registry: registryFor(item), ledger: { getCache: key => cache.get(key) ?? null, setCache: (key, value) => cache.set(key, structuredClone(value)) }, transport });
  let blindFrozen = false;
  const result = await reviewer.review(item, { onBlindFrozen: async proof => {
    blindFrozen = true;
    assert.equal(proof.reports.length, 2);
    assert.equal(proof.sha256, hashJSON(proof.reports));
  } });
  assert.ok(result.audit, `captured reports should remain schema-valid so the actual audit body is constructed: ${scorecardFormatIssuesV717(item,result.reports,null,{blindOnly:true})}`);
  assert.equal(blindFrozen, true);
  assert.equal(captured.length, 6);
  for (const row of captured.filter(row => row.stage !== 'explanation_support')) {
    for (const field of ['correct_answer', 'correct_index', 'answer', 'key', 'explanation', 'proposed_explanation', 'proposed_key']) assert.equal(Object.hasOwn(row.input, field), false,
      `hidden answer field ${field} leaked in ${row.stage}`);
  }
  assert.ok(captured.filter(row => row.stage === 'explanation_support').every(row => row.input.proposed_key === 'A' && row.input.proposed_explanation === item.explanation));
  for (const stage of ['blind_solution', 'independent_evaluation', 'explanation_support']) {
    const pair = captured.filter(row => row.stage === stage);
    assert.equal(pair.length, 2, `${stage} must include base and actual retry bodies`);
    assert.notEqual(pair[0].key, pair[1].key, `${stage} retry must use a distinct durable key`);
    assert.equal(pair[1].cap, pair[0].cap * 2, `${stage} retry must double the inherited output cap`);
    assert.ok(pair.every(row => row.bytes <= 33024), `${stage} request exceeds hard input bound`);
  }
  const auditBase = captured.find(row => row.stage === 'explanation_support');
  assert.equal(Buffer.byteLength(JSON.stringify({ derivation: rawFields.derivation, options: rawFields.options, issues: rawFields.issues }), 'utf8'), observed.bytes);
  assert.deepEqual(auditBase.input.demand_anchors, reviewer.context(item).demand_anchors);
  assert.equal(auditBase.input.frozen_reports.length, 2);
  const max = Math.max(...captured.map(row => row.bytes));
  const artifact = { test: 'V717 actual adapter/retry request sizing; no provider calls', historical_fixture: 'V716 qualification-fresh32b stored blind report fields',
    historical_fields_sha256: createHash('sha256').update(JSON.stringify(rawFields)).digest('hex'), historical_group_bytes: observed.bytes,
    requests: captured.map(({ provider, stage, key, bytes, cap, bodyHash }) => ({ provider, stage, key, request_bytes: bytes, output_cap: cap, body_sha256: bodyHash })),
    max_request_bytes: max, hard_bound_bytes: 33024, headroom_bytes: 33024 - max, pass: max <= 33024 };
  const out = resolve('artifacts/question-factory/cuet-readiness-2026-10-09/execution/final-pass-v717/verification/v717-body-sizing.json');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(artifact, null, 2) + '\n', { flag: 'w' });
  assert.ok(artifact.pass);
});

test('V717 pilot proof gate requires the exact completed passing qualification artifacts', () => {
  const directory = mkdtempSync(join(tmpdir(), 'v717-pilot-proof-'));
  try {
    const registration = { id: 'v717-qualification-proof-fixture', profile: FACTORY_VERIFIER_VERSION_V717, qualification: true,
      contract_hash: validationContractV717(), prompt_hash: scorecardPromptHashV717(), jobs: [{ id: 'case-1' }, { id: 'case-2' }] };
    const subjectRows = Object.fromEntries(['accountancy', 'business_studies', 'economics', 'english'].map(subject => [subject, { ok: 3, n: 4 }]));
    const summary = { id: registration.id, kind: 'qualification', profile: FACTORY_VERIFIER_VERSION_V717, decision: 'passed', denominator: 2, terminal: 2,
      receipt_complete: true, held_usd: 0, review_incomplete: [], controlled_defects: 1, controlled_false_accepts: [], valid_total: 16, valid_eligible: 14,
      valid_by_subject: subjectRows };
    const writeBound = (name, value) => {
      const path = join(directory, name), bytes = Buffer.from(JSON.stringify(value));
      writeFileSync(path, bytes);
      return { path, sha256: createHash('sha256').update(bytes).digest('hex') };
    };
    const binding = { summary: writeBound('summary.json', summary), registration: writeBound('registration.json', registration) };
    assert.equal(assertQualifiedPilotV717(binding).summary.decision, 'passed');
    for (const [label, mutate] of [
      ['incomplete run', value => { value.decision = 'incomplete'; value.review_incomplete = ['case-2']; }],
      ['failed survival', value => { value.valid_eligible = 13; }],
      ['subject survival below floor', value => { value.valid_by_subject.english.ok = 2; }],
      ['controlled false accept', value => { value.controlled_false_accepts = ['case-2']; }],
      ['unsettled hold', value => { value.held_usd = 0.01; }],
    ]) {
      const bad = structuredClone(summary); mutate(bad);
      const badBinding = { summary: writeBound(`${label.replaceAll(' ', '-')}.json`, bad), registration: binding.registration };
      assert.throws(() => assertQualifiedPilotV717(badBinding), /v717_pilot_requires_passed_current_qualification/, label);
    }
    const tampered = join(directory, 'summary.json'); writeFileSync(tampered, JSON.stringify({ ...summary, decision: 'failed' }));
    assert.throws(() => assertQualifiedPilotV717(binding), /v717_pilot_qualification_artifact_changed/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('V717 qualification registration pins execution freeze, sealed cases, custody, and full retry bodies', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'v717-registration-freeze-'));
  try {
    const prices = JSON.parse(readFileSync('data/pipeline-prices.json', 'utf8'));
    const registry = { version: 'offline-v717-registration', families: {}, sources: {}, exam_specs: {} };
    const item = candidate({ id: 'v717-frozen-case' });
    const createdAt = '2026-10-10T00:00:00.000Z';
    const freeze = buildExecutionFreezeV717({ createdAt, decisionRule: 'test-only bounded routing rule' });
    const freezePath = join(directory, 'freeze.json'), freezeBytes = Buffer.from(JSON.stringify(freeze)); writeFileSync(freezePath, freezeBytes);
    const cases = { schema: 'fixture-cases', created_at: new Date().toISOString(), cases: [{ id: item.id, candidate: item }] };
    const custody = { schema: 'fixture-custody', created_at: new Date().toISOString(), answers: [{ id: item.id, correct_key: item.correct_answer }] };
    const casesPath = join(directory, 'cases.json'), custodyPath = join(directory, 'custody.json');
    const caseBytes = Buffer.from(JSON.stringify(cases)), custodyBytes = Buffer.from(JSON.stringify(custody)); writeFileSync(casesPath, caseBytes); writeFileSync(custodyPath, custodyBytes);
    const jobs = [{ id: item.id, subject: item.subject, candidate_hash: hashJSON(item) }];
    const id = 'v717-qualification-registration-fixture';
    const binding = { contract_hash: validationContractV717(), prompt_hash: scorecardPromptHashV717(), campaign_sha256: hashJSON({ id, jobs: jobs.map(j => ({ id: j.id, subject: j.subject })) }),
      registry_sha256: hashJSON(registry), runner_sha256: createHash('sha256').update(readFileSync('scripts/pipeline/tools/runQualificationV717.mjs')).digest('hex'),
      engine_sha256: createHash('sha256').update(readFileSync('scripts/pipeline/lib/verifyV717.mjs')).digest('hex') };
    const requests = [];
    for (const stage of ['blind_solution', 'independent_evaluation', 'explanation_support']) for (const variant of ['base', 'completion_retry']) {
      const provider = stage === 'independent_evaluation' ? 'gemini' : 'openai', cap = SCORECARD_OUTPUT_CAPS_V717[stage] * (variant === 'completion_retry' ? 2 : 1);
      const body = provider === 'openai' ? { model: 'gpt-6-luna', max_output_tokens: cap, input: [{ role: 'user', content: JSON.stringify({ candidate_id: item.id }) }] } :
        { model: 'gemini-3.8-flash', generationConfig: { maxOutputTokens: cap }, contents: [{ role: 'user', parts: [{ text: JSON.stringify({ candidate_id: item.id }) }] }] };
      const serialized = JSON.stringify(body);
      requests.push({ candidate_id: item.id, stage, provider, variant, request_key: hashJSON({ id, stage, variant }), output_cap: cap, input_bound_bytes: 33024,
        request_bytes: Buffer.byteLength(serialized), body_sha256: createHash('sha256').update(serialized).digest('hex'), body });
    }
    const preflight = { schema: 'cuet-v717-full-body-preflight-v1', passed: true, coverage: 'all-five-stages-and-retries', ...binding,
      pricing_hash: hashJSON(prices), requests };
    const standard = requests.reduce((sum, row) => sum + maximumRequestMicro(row.provider, row.body, prices), 0) / 1e6;
    const registration = { id, profile: FACTORY_VERIFIER_VERSION_V717, qualification: true, kind: 'qualification', ...binding, registry_hash: binding.registry_sha256,
      pricing_hash: hashJSON(prices), cost_profile: { pricing_hash: hashJSON(prices), input_byte_bounds: { 'gpt-6-luna': 33024, 'gemini-3.8-flash': 33024 } },
      jobs, cap_usd: 1, publication: 'never', max_repairs: 0, standard_full_bound_usd: standard, budget_stop_possible: true, input_byte_bound: 33024,
      full_retry_bounds: true, preflight_hash: hashJSON(preflight), unseen_at_freeze: true,
      independent_answer_custody_hash: createHash('sha256').update(custodyBytes).digest('hex'), execution_freeze: { path: freezePath, sha256: createHash('sha256').update(freezeBytes).digest('hex') },
      cases: { path: casesPath, sha256: createHash('sha256').update(caseBytes).digest('hex') }, custody: { path: custodyPath } };
    assert.equal(assertRegistrationV717(registration, registry, prices, preflight), undefined);
    assertExecutionFreezeV717(freezePath, registration.execution_freeze.sha256);
    const statePath = join(directory, 'state.json');
    const state = { registration_hash: hashJSON(registration), request_keys: [], cases: {} }; writeFileSync(statePath, JSON.stringify(state));
    const order = [], fakeLedger = { db: { prepare: () => ({ get: () => null, all: () => [] }) }, assertHistoryReconciled() { order.push('ledger_ready'); },
      getCache: () => null, setCache() {}, close() { order.push('ledger_close'); } };
    const fakeStore = { claim() { order.push('store_claim'); }, release() { order.push('store_release'); } };
    await assert.rejects(() => openCampaignSessionV717({ registration, registry, prices, preflight, statePath, inventory: [], secret: 'offline-secret',
      network: async () => { order.push('network'); throw Error('offline_probe_failed'); }, ledgerFactory: () => { order.push('ledger_factory'); return fakeLedger; },
      storeFactory: () => fakeStore, nativeFactory: () => ({ generate: async () => null }) }), /offline_probe_failed/);
    assert.deepEqual(order, ['network'], 'network preflight must precede any writable ledger/store construction');

    order.length = 0;
    let finishFlush;
    const session = await openCampaignSessionV717({ registration, registry, prices, preflight, statePath, inventory: [], secret: 'offline-secret',
      network: async () => { order.push('network'); }, ledgerFactory: () => { order.push('ledger_factory'); return fakeLedger; },
      storeFactory: () => fakeStore, nativeFactory: () => ({ generate: async () => null, flush: () => new Promise(resolve => { finishFlush = resolve; }) }),
      save: (path, value) => writeFileSync(path, JSON.stringify(value)) });
    assert.deepEqual(order.slice(0, 3), ['network', 'ledger_factory', 'ledger_ready']);
    const flushing = session.flush();
    await new Promise(resolve => setImmediate(resolve));
    assert.throws(() => session.close(), /v717_drain_active_operations_before_close/);
    finishFlush(); await flushing;
    session.stop(); await session.recover();
    await assert.rejects(() => session.flush(), /v717_session_closed_or_stopped/);
    session.close();
    assert.ok(order.includes('store_release')); assert.ok(order.includes('ledger_close'));

    const damagedCustody = Buffer.from(JSON.stringify({ ...custody, answers: [{ id: item.id, correct_key: 'D' }] })); writeFileSync(custodyPath, damagedCustody);
    assert.throws(() => assertRegistrationV717(registration, registry, prices, preflight), /v717_independent_custody_changed/);
    writeFileSync(custodyPath, custodyBytes);
    const damagedFreeze = Buffer.from(JSON.stringify({ ...freeze, file_count: freeze.file_count + 1 })); writeFileSync(freezePath, damagedFreeze);
    assert.throws(() => assertExecutionFreezeV717(freezePath, registration.execution_freeze.sha256), /v717_execution_freeze_changed/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('V717 publication replay is receipt-only for committed/uncertain writes and refuses changed content', async () => {
  const questions = [{ id: 'persisted-v717-row', evidence: { record: { content_hash: 'signed-content-hash' } } }];
  const unit = publicationUnitKeyV717({ questions, target: 'local' }), content_hash = hashJSON(questions);
  let reads = 0, writes = 0, receipts = 0, storedState;
  const adapter = {
    async getWriteState(key) { assert.equal(key, unit); return storedState; },
    async readReceipt(key) { receipts++; assert.equal(key, unit); return { committed: true, unit_key: unit, content_hash }; },
    async inventoryVersion() { reads++; throw Error('must_not_read_inventory_before_receipt_recovery'); },
    async readInventory() { reads++; return []; }, async readFamilyHolds() { reads++; return []; },
    async saveWriteState() { writes++; }, async writeAtomic() { writes++; throw Error('must_not_rewrite_committed_unit'); },
  };
  storedState = { state: 'committed', unit_key: unit, content_hash };
  const recovered = await publishUnitV717({ questions, target: 'local', adapter });
  assert.equal(recovered.state, 'published'); assert.equal(recovered.recovered, true);
  assert.equal(receipts, 1); assert.equal(reads, 0); assert.equal(writes, 0);

  storedState = { state: 'uncertain', unit_key: unit, content_hash };
  adapter.readReceipt = async key => { receipts++; assert.equal(key, unit); return { committed: false, definitive_absent: false, unit_key: unit }; };
  const uncertain = await publishUnitV717({ questions, target: 'local', adapter });
  assert.equal(uncertain.state, 'uncertain'); assert.equal(uncertain.recovery, 'receipt_only');
  assert.equal(reads, 0); assert.equal(writes, 0);

  storedState = { state: 'committed', unit_key: unit, content_hash: 'different-content' };
  await assert.rejects(() => publishUnitV717({ questions, target: 'local', adapter }), /v717_publication_identity_changed/);
  assert.equal(reads, 0); assert.equal(writes, 0);
});

test('V717 manual controller delegates only to the bounded current qualification report route', () => {
  const directory = mkdtempSync(join(tmpdir(), 'v717-controller-report-'));
  try {
    writeFileSync(join(directory, 'study.json'), JSON.stringify({ id: 'report-only-fixture', schema: 'cuet-v717-study-v1', kind: 'qualification', publication: 'never' }));
    writeFileSync(join(directory, 'cases.json'), JSON.stringify({ schema: 'cuet-v717-cases-v1', study_id: 'report-only-fixture', cases: [{ id: 'case-1' }] }));
    const script = resolve('scripts/pipeline/controllerV717.mjs');
    const result = spawnSync(process.execPath, ['--use-system-ca', script, 'qualification', 'report', directory], { encoding: 'utf8', windowsHide: true });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /"prepared"\s*:\s*false/);
    assert.equal(/paid_calls?[^\n]*[1-9]/i.test(result.stdout), false);
    writeFileSync(join(directory, 'registration.json'), '{}');
    const rejected = spawnSync(process.execPath, ['--use-system-ca', script, 'qualification', 'execute', directory], { encoding: 'utf8', windowsHide: true });
    assert.notEqual(rejected.status, 0, 'execute must reject without explicit approval');
    assert.match(rejected.stderr, /explicit_paid_execution_required/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
