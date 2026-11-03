import test from 'node:test';
import assert from 'node:assert/strict';
import { createFactoryEvidenceV73, FACTORY_VERIFIER_VERSION_V73, V73_PROMPT, V73_PROMPT_HASH, requiredStagesV7, interpretEvaluation as interpretV73 } from '../lib/factoryEvidenceV73.mjs';
import { evaluationCacheKeyV73, hashValidationBindingV73, PARENT_CONTRACT_V7_HASH, validationContractV73, V73_ADDITIVE_FILES, V73_POLICY_IDS } from '../lib/contractV73.mjs';
import { TOPOLOGIES, requiredStagesV7 as requiredStagesV72, interpretEvaluation as interpretV72 } from '../lib/factoryEvidenceV7.mjs';
import { hashJSON } from '../../../data/question_factory_policy.mjs';

const view = (source_kind, anchor_id = null) => ({ candidate_id: 'candidate-1', content_hash: 'a'.repeat(64), family_id: 'family-1', subject: 'business_studies',
  chapter: 'Principles of Management', body: 'Which principle is illustrated?', options: ['A', 'B', 'C', 'D'], passage: null, route: 'conceptual', question_type: 'conceptual_mcq',
  source_kind, anchor_id, references: [] });
const example = (id, extra = {}) => ({ id, year: 2024, subject: 'business_studies', chapter: 'Principles of Management', question_type: 'conceptual_mcq', route: 'conceptual',
  difficulty: 'medium', body: `Authenticated example ${id}`, options: ['one', 'two', 'three', 'four'], passage_text: '', correct_answer: 'B', final_key_source_id: 'secret-key-source',
  final_key_matched: true, source_kind: 'authentic_pyq', authentication: { independently_matched: true, option_order_checked: true }, ...extra });
const registry = examples => ({ examples, sources: {}, exam_specs: { business_studies: { state: 'verified', included_topics: ['Unit I: Nature and Significance of Management'],
  excluded_topics: [], syllabus_version: 'syllabus-v1', pattern_version: 'pattern-v1', pattern_rules: {}, exam_rule_version: 'rule-v1' } } });
const makeAdapters = examples => createFactoryEvidenceV73({ registry: registry(examples), ledger: { getCache() { return null; }, setCache() {} }, transport: {}, topology: TOPOLOGIES.single_luna });

test('original practice builds full context with no matched global comparator and explicitly annotates the gap', () => {
  const context = makeAdapters([]).__context(view('original_practice'));
  assert.deepEqual(context.calibration_exemplars, []);
  assert.equal(context.exemplar_selection.required, false);
  assert.equal(context.exemplar_selection.status, 'no_matching_optional_comparators');
  assert.match(context.exemplar_selection.annotation, /needs no PYQ counterpart/);
  assert.deepEqual(context.exemplar_selection.calibration_comparator_ids, []);
  assert.equal(context.exemplar_selection.authenticated_anchor_id, null);
  assert.match(V73_PROMPT, /do not require a PYQ counterpart/);
  assert.equal(typeof context.evidence_catalog, 'object');

  const criteria = Object.fromEntries(['syllabus_objective', 'format_authenticity', 'level_calibration', 'discrimination_value'].map(id => [id, { level: 3, evidence: 'CUET-fit evidence' }]));
  const interpreted = interpretV73({ solved_key: 'B', cuet_fit: { criteria, reasoning_steps: 1, estimated_difficulty: 'easy', cognitive_level: 'recall', exemplar_ids_compared: [] },
    answer_conditions: [{ condition: 'The printed question', status: 'explicit', alters_key_if_changed: false, convention_evidence_ids: [] }], evidence_ids: [],
    option_challenges: ['A', 'C', 'D'].map(option => ({ option, strongest_reading: 'Contrived alternative', correct_under_reading: false, reading_status: 'strained', convention_evidence_ids: [] })),
    blocking_defects: [], principle_applicability: 'skill_from_stem', decisive_principle_in_excerpts: false }, { ...view('original_practice'), reading_reference: context.reading_reference });
  assert.equal(interpreted.cuet_fit_result.pass, true);
  assert.equal(interpreted.exam_fit, true);
});

test('authenticated PYQ without its exact authenticated anchor fails closed', () => {
  assert.throws(() => makeAdapters([example('other-1')]).__context(view('authentic_pyq', 'missing-anchor')), /authenticated_anchor_required/);
});

test('authentic PYQ context requires exact anchor plus the existing calibration pool and strips all key data', () => {
  const anchor = example('anchor-1');
  const comparator = example('comparator-1');
  const context = makeAdapters([anchor, comparator]).__context(view('authentic_pyq', 'anchor-1'));
  assert.equal(context.exemplar_selection.status, 'exact_authenticated_anchor_matched');
  assert.deepEqual(context.exemplar_selection.calibration_comparator_ids, ['comparator-1']);
  assert.equal(context.exemplar_selection.authenticated_anchor_id, 'anchor-1');
  assert.equal(context.authenticated_anchor_example.id, 'anchor-1');
  assert.equal(context.calibration_exemplars.length, 1);
  const serialized = JSON.stringify({ calibration_exemplars: context.calibration_exemplars, authenticated_anchor_example: context.authenticated_anchor_example });
  for (const secret of ['correct_answer', 'final_key_source_id', 'secret-key-source', '"B"']) assert.equal(serialized.includes(secret), false, secret);
});

test('reserved benchmark anchors are excluded before optional selection', () => {
  const context = createFactoryEvidenceV73({ registry: registry([example('reserved-1')]), ledger: { getCache() {}, setCache() {} }, transport: {},
    topology: TOPOLOGIES.single_luna, exemplarExclude: ['reserved-1'] }).__context(view('original_practice'));
  assert.deepEqual(context.exemplar_selection.calibration_comparator_ids, []);
  assert.equal(context.exemplar_selection.authenticated_anchor_id, null);
  assert.equal(context.exemplar_selection.status, 'no_matching_optional_comparators');
});

test('v7.3 binds every parent and additive file and isolates prompt/cache identity from v7.2', () => {
  const contractHash = validationContractV73();
  assert.equal(PARENT_CONTRACT_V7_HASH, '6f27a61131688db75be6686159b77894ee083f0c8abcca47d812a9a0eb20692c');
  assert.match(contractHash, /^[a-f0-9]{64}$/);
  assert.notEqual(contractHash, PARENT_CONTRACT_V7_HASH);
  assert.equal(FACTORY_VERIFIER_VERSION_V73, 'cuet-fit-validator-v7.3');
  assert.equal(V73_PROMPT_HASH, hashJSON({ prompt: V73_PROMPT, contract: contractHash }));
  assert.ok(V73_POLICY_IDS.sourceViews.length >= 2);
  assert.ok(V73_ADDITIVE_FILES.includes('contractV73.mjs'));
  const descriptor = [{ path: 'contractV73.mjs', sha256: hashJSON('source bytes v1') }];
  const changedDescriptor = [{ path: 'contractV73.mjs', sha256: hashJSON('source bytes v2') }];
  const bindingInput = { parentContractHash: PARENT_CONTRACT_V7_HASH, parentFiles: [{ path: 'parent', sha256: 'p' }], policyIds: V73_POLICY_IDS };
  assert.notEqual(hashValidationBindingV73({ ...bindingInput, additiveFiles: descriptor }), hashValidationBindingV73({ ...bindingInput, additiveFiles: changedDescriptor }));
  assert.notEqual(hashValidationBindingV73({ parentContractHash: PARENT_CONTRACT_V7_HASH, parentFiles: ['parent-file-hash'], additiveFiles: ['new-file-hash'] }),
    hashValidationBindingV73({ parentContractHash: PARENT_CONTRACT_V7_HASH, parentFiles: ['parent-file-hash'], additiveFiles: ['new-file-hash'], policyIds: { ...V73_POLICY_IDS, exemplar: 'changed-policy' } }));
  const common = { input: { candidate_id: 'c1' }, provider: 'openai', model: 'gpt-6-luna', effort: 'high', output: 7500, promptHash: V73_PROMPT_HASH, policyVersion: 'cuet-llm-v3' };
  const oldKey = evaluationCacheKeyV73({ ...common, contractHash: 'a'.repeat(64) });
  const newKey = evaluationCacheKeyV73({ ...common, contractHash: 'b'.repeat(64) });
  assert.notEqual(oldKey, newKey);
  const cache = new Map([[oldKey, { judgment: 'old' }]]);
  assert.equal(cache.get(newKey), undefined);
});

test('v7.3 preserves all v7.2 stage requirements, including numeric checks', () => {
  for (const route of ['numerical', 'conceptual', 'passage']) for (const numeric of [false, true]) {
    assert.deepEqual(requiredStagesV7(route, numeric, TOPOLOGIES.dual_blind), requiredStagesV72(route, numeric, TOPOLOGIES.dual_blind));
  }
  assert.ok(requiredStagesV7('conceptual', true, TOPOLOGIES.dual_blind).includes('numeric_solution'));
  assert.ok(requiredStagesV7('numerical', false, TOPOLOGIES.dual_blind).includes('llm_boundary_cases'));
});

test('v7.3 retains the existing CUET/key/condition/alternative hard verdicts verbatim', () => {
  const criteria = Object.fromEntries(['syllabus_objective', 'format_authenticity', 'level_calibration', 'discrimination_value'].map(id => [id, { level: 3, evidence: 'fixture' }]));
  const view = { body: 'Choose the result from the information shown.', options: ['A', 'B', 'C', 'D'], passage: null, reading_reference: { status: 'subject_format_sample', observed_max_words: 60, sample_size: 10 } };
  const challenges = ['A', 'C', 'D'].map(option => ({ option, strongest_reading: 'Contrived interpretation', correct_under_reading: false, reading_status: 'strained', convention_evidence_ids: [] }));
  const result = { solved_key: 'B', cuet_fit: { criteria, reasoning_steps: 1, estimated_difficulty: 'easy', cognitive_level: 'recall', exemplar_ids_compared: ['auth-1'] },
    answer_conditions: [{ condition: 'The printed result', status: 'explicit', alters_key_if_changed: false, convention_evidence_ids: [] }], evidence_ids: [], option_challenges: challenges,
    blocking_defects: [], principle_applicability: 'skill_from_stem', decisive_principle_in_excerpts: false };
  assert.deepEqual(interpretV73(result, view), interpretV72(result, view));
  const defect = { ...result, option_challenges: challenges.map(c => c.option === 'D' ? { ...c, correct_under_reading: true, reading_status: 'reasonable_unstated', strongest_reading: 'An omitted condition changes the answer' } : c) };
  assert.deepEqual(interpretV73(defect, view), interpretV72(defect, view));
  assert.equal(interpretV73(defect, view).missing_assumptions, true);
});
