import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { evalSchemaV7, interpretEvaluation } from '../lib/factoryEvidenceV73.mjs';
import { V76_PROMPT } from '../lib/factoryEvidenceV76.mjs';
import { adaptEvaluationRequestV714, V714_PROMPT_HASH } from '../lib/factoryEvidenceV714.mjs';
import { createFactoryEvidenceV714, TOPOLOGIES as V714_TOPOLOGIES, blindViewV714 } from '../lib/factoryEvidenceV714.mjs';
import { annotateValidationSchemaV714, withValidationDiagnosticsV714 } from '../lib/validatorDiagnosticsV714.mjs';
import { compactSystemV714 } from '../lib/compactValidationV714.mjs';
import { validationContractV713 } from '../lib/contractV713.mjs';
import { validationContractV714, V714_ADDITIVE_FILES, PARENT_CONTRACT_V713_HASH } from '../lib/contractV714.mjs';
import { MODEL_RATED_IDS } from '../../../data/cuet_fit_rubric.mjs';
import { hashJSON } from '../../../data/question_factory_policy.mjs';

const sha = value => createHash('sha256').update(value).digest('hex');
const input = () => ({
  candidate_id: 'local-fixture', content_hash: 'local-content-hash', subject: 'Accountancy',
  body: 'A short, locally constructed practice question.', options: ['one', 'two', 'three', 'four'],
  evidence_catalog: [{ id: 'source-1', text: 'A supplied textbook definition.' }],
  canonical_chapters: ['Financial Statements'], exam_spec: { canonical_chapters: ['Financial Statements'] }
});

function request(provider, stage = 'blind_solution') {
  const schema = structuredClone(evalSchemaV7);
  if (provider === 'openai') return {
    input: [{ role: 'system', content: V76_PROMPT }, { role: 'user', content: JSON.stringify(input()) }],
    max_output_tokens: stage === 'explanation_support' ? 5000 : 7500,
    text: { format: { type: 'json_schema', schema } }
  };
  if (provider === 'gemini') return {
    systemInstruction: { parts: [{ text: V76_PROMPT }] },
    contents: [{ role: 'user', parts: [{ text: JSON.stringify(input()) }] }],
    generationConfig: { maxOutputTokens: 4500, responseFormat: { text: { schema } } }
  };
  throw new Error('unsupported test provider');
}

function getSystem(body, provider) {
  return provider === 'openai' ? body.input.find(x => x.role === 'system').content
    : body.systemInstruction.parts[0].text;
}
function getUser(body, provider) {
  const value = provider === 'openai' ? body.input.find(x => x.role === 'user').content
    : body.contents.find(x => x.role === 'user').parts[0].text;
  return JSON.parse(value);
}
function getSchema(body, provider) {
  return provider === 'openai' ? body.text.format.schema : body.generationConfig.responseFormat.text.schema;
}

test('V714 OpenAI and Gemini blind requests restore canonical fit and non-key challenge instructions', () => {
  for (const provider of ['openai', 'gemini']) {
    const out = adaptEvaluationRequestV714(provider, request(provider), { stage: 'blind_solution' });
    const system = getSystem(out, provider), user = getUser(out, provider), schema = getSchema(out, provider);
    assert.ok(system.includes('Rate each criterion in cuet_fit.criteria as an integer 0 to 3 using ONLY these anchors'));
    assert.ok(system.includes('exactly three entries, one for each option you did NOT choose'));
    assert.ok(system.includes('FOUR rows covering A/B/C/D'));
    assert.match(schema.properties.option_challenges.description, /exactly three distinct non-chosen options/i);
    assert.match(schema.properties.option_challenges.description, /four-row option_resolution/i);
    assert.match(schema.properties.cuet_fit.properties.criteria.properties.syllabus_objective.properties.level.description, /canonical 0-3 anchors/i);
    assert.equal(user.candidate_id, 'local-fixture');
    for (const forbidden of ['correct_answer', 'expected_valid', 'oracle', 'regression_role']) assert.equal(JSON.stringify(user).includes(forbidden), false);
    assert.equal(provider === 'openai' ? out.max_output_tokens : out.generationConfig.maxOutputTokens, 16000);
  }
});

test('V714 explanation request carries only the two frozen resolutions and adds audit schema', () => {
  const provider = 'openai';
  const frozenRows = [
    { solver: 'blind-a', solved_key: 'B', rows: [{ option: 'A', status: 'contradicted' }] },
    { solver: 'blind-b', solved_key: 'B', rows: [{ option: 'A', status: 'contradicted' }] }
  ];
  const out = adaptEvaluationRequestV714(provider, request(provider, 'explanation_support'),
    { stage: 'explanation_support' }, () => frozenRows);
  const user = getUser(out, provider), schema = getSchema(out, provider);
  assert.deepEqual(user.option_resolutions, frozenRows);
  assert.ok(schema.required.includes('resolution_audit'));
  assert.ok(schema.properties.resolution_audit);
  for (const forbidden of ['correct_answer', 'expected_valid', 'oracle', 'regression_role']) assert.equal(JSON.stringify(user).includes(forbidden), false);
  assert.equal(out.max_output_tokens, 8000);
});

test('V714 keeps the actual A/B/C challenge omission and zero-fit Luna regressions fail closed', () => {
  const view = { body: 'A short question asks for one answer.', options: ['A', 'B', 'C', 'D'] };
  const challenged = ['A', 'B', 'C'].map(option => ({ option, strongest_reading: 'A rival reading.',
    correct_under_reading: false, reading_status: 'contradicts_stem', convention_evidence_ids: [] }));
  const highFit = { criteria: Object.fromEntries(MODEL_RATED_IDS.map(id => [id, { level: 3, evidence: 'supported task evidence' }])),
    reasoning_steps: 1, estimated_difficulty: 'easy', cognitive_level: 'recall', exemplar_ids_compared: [] };
  const actualChallengeShape = { solved_key: 'A', evidence_ids: ['source-1'], answer_conditions: [], option_challenges: challenged,
    blocking_defects: [], principle_applicability: 'excerpt_required', decisive_principle_in_excerpts: true, cuet_fit: highFit };
  const interpreted = interpretEvaluation(actualChallengeShape, view);
  assert.equal(interpreted.challenges_ok, false);
  assert.equal(interpreted.challenge_reason, 'option_challenges_incomplete');
  assert.equal(interpreted.exam_fit, true, 'the high-fit regression isolates the challenge failure');
  const rejected = withValidationDiagnosticsV714({ ...actualChallengeShape, ...interpreted, passed: false, reasons: ['legacy evaluation rejected'] });
  assert.equal(rejected.passed, false);
  assert.ok(rejected.reasons.includes('option_challenges_incomplete'));
  assert.equal(withValidationDiagnosticsV714(rejected).passed, false, 'diagnostics must be idempotent and cannot create a pass');

  const blankFit = { ...highFit, criteria: Object.fromEntries(MODEL_RATED_IDS.map(id => [id, { level: 0, evidence: '' }])) };
  const blankResult = interpretEvaluation({ ...actualChallengeShape, cuet_fit: blankFit }, view);
  assert.equal(blankResult.cuet_fit_result.pass, false);
  const blankRejected = withValidationDiagnosticsV714({ ...blankResult, passed: false, reasons: ['legacy evaluation rejected'] });
  assert.equal(blankRejected.passed, false);
  assert.equal(blankRejected.cuet_fit_result.pass, false);
});

test('V714 schema annotations preserve a complete rival set and contract/cache namespace is distinct', () => {
  const schema = structuredClone(evalSchemaV7);
  annotateValidationSchemaV714(schema);
  assert.equal(schema.properties.option_challenges.minItems, 3);
  assert.equal(schema.properties.option_challenges.maxItems, 3);
  assert.notEqual(validationContractV714(), validationContractV713());
  assert.equal(validationContractV713(), PARENT_CONTRACT_V713_HASH);
  assert.notEqual(V714_PROMPT_HASH, '');
  assert.match(compactSystemV714('blind_solution'), /Rate each criterion in cuet_fit\.criteria as an integer 0 to 3 using ONLY these anchors/i);
});

test('V714 evaluation uses its own contract-prefixed cache and request identity', async () => {
  const excerpt = 'Cash received from customers for goods sold is an operating activity.';
  const candidate = { id: 'offline-v714-cache', subject: 'accountancy', chapter: 'Cash Flow Statement',
    family_id: 'offline-family', route: 'conceptual', question_type: 'conceptual_mcq', difficulty: 'easy',
    body: 'A retailer receives cash from customers for goods sold. Classify the cash flow.',
    options: ['Operating activity.', 'Investing activity.', 'Financing activity.', 'No cash flow.'],
    correct_answer: 'A', explanation: 'Cash received for goods sold is operating.',
    learning_objective: { syllabus_unit: 'Cash Flow Statement', objective: 'Classify operating receipts.', target_term: '' },
    provenance: { kind: 'original_practice' } };
  const sourceHash = hashJSON(excerpt);
  const registry = { examples: [], exam_specs: { accountancy: { state: 'verified', included_topics: ['Cash Flow Statement'],
    excluded_topics: [], syllabus_version: 'offline', pattern_version: 'offline', pattern_rules: {}, exam_rule_version: 'offline' } },
    sources: { source: { id: 'source', state: 'active', reuse_permitted: true, version: 1, kind: 'textbook',
      identity_sha256: 'a'.repeat(64), extraction_checked: true,
      title: 'Offline evidence', url: 'https://example.test/source', chapters: ['Cash Flow Statement'],
      facts: { excerpt: { text: excerpt } }, supports: { excerpt: sourceHash } } } };
  const calls = [], rawCache = new Map(); let transportCalls = 0;
  const ledger = { getCache(key) { calls.push(['get', key]); return rawCache.get(key) ?? null; },
    setCache(key, value) { calls.push(['set', key]); rawCache.set(key, structuredClone(value)); } };
  const transport = { async generate(provider, body, options) {
    transportCalls += 1;
    const raw = provider === 'openai' ? body.input.find(x => x.role === 'user').content : body.contents.find(x => x.role === 'user').parts[0].text;
    const supplied = JSON.parse(raw), evidence = supplied.evidence_catalog[0]?.id;
    const result = { candidate_id: supplied.candidate_id, content_hash: supplied.content_hash, solved_key: 'A',
      single_defensible_answer: true, source_support: true, numeric_solution: true, boundary_cases: true,
      passage_integrity: true, passage_answerability: true, meaningfully_distinct: true,
      evidence_ids: evidence ? [evidence] : [], reasons: [], syllabus_chapter: 'Cash Flow Statement',
      syllabus_topic: 'Operating cash receipts', syllabus_entitlement: true, presentation_ready: true,
      question_type_match: true, principle_applicability: 'excerpt_required', decisive_principle_in_excerpts: true,
      answer_conditions: [], option_challenges: supplied.options.filter(o => o.key !== 'A').map(o => ({ option: o.key,
        strongest_reading: 'This rival is not supported by the stated transaction.', correct_under_reading: false,
        reading_status: 'contradicts_stem', convention_evidence_ids: [] })), blocking_defects: [], style_notes: [],
      cuet_fit: { criteria: Object.fromEntries(MODEL_RATED_IDS.map(id => [id, { level: 3, evidence: 'The item tests the named syllabus skill.' }])),
        reasoning_steps: 1, estimated_difficulty: 'easy', cognitive_level: 'comprehension', exemplar_ids_compared: [] } };
    return { output_text: JSON.stringify(result) };
  } };
  const adapters = createFactoryEvidenceV714({ registry, ledger, transport, topology: V714_TOPOLOGIES.single_luna });
  const refs = [{ id: 'source', version: 1, locator: 'excerpt', support_hash: sourceHash }];
  const view = blindViewV714(candidate, refs);
  await adapters.__evaluation(view, 'openai');
  await adapters.__evaluation(view, 'openai');
  assert.equal(transportCalls, 1, 'the second identical evaluation is served from the local cache');
  const cacheKeys = calls.map(([, key]) => key);
  assert.ok(cacheKeys.length > 0);
  assert.ok(cacheKeys.every(key => key.startsWith(`v714:${validationContractV714()}:`)));
  assert.ok(calls.every(([kind]) => ['get', 'set'].includes(kind)));
});

test('captured V714 reconstruction covers every saved row, code binding, and request byte bound', () => {
  const base = 'artifacts/question-factory/cuet-readiness-2026-10-09/execution/final-pass-v713';
  const capturePath = `${base}/qualification-fresh31-regression6/diagnosis/V714-LOCAL-222-BODY-CAPTURE-20261010.json`;
  const capture = JSON.parse(readFileSync(capturePath, 'utf8'));
  assert.equal(capture.provider_calls, 0);
  assert.equal(capture.request_count, 222);
  assert.equal(capture.rows.length, 222);
  assert.equal(capture.within_limit_count, 222);
  assert.ok(capture.rows.every(row => row.reconstructed_v714_bytes <= row.limit_bytes));
  assert.ok(capture.max_reconstructed_bytes <= 33024);
  assert.equal(capture.binding.parent_v713_contract_hash, PARENT_CONTRACT_V713_HASH);
  assert.equal(capture.binding.v714_contract_hash, validationContractV714());
  for (const file of capture.binding.additive_files) {
    assert.ok(V714_ADDITIVE_FILES.some(name => file.path.endsWith(name)));
    assert.equal(sha(readFileSync(file.path)), file.sha256);
  }
});
