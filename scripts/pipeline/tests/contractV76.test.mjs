import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { hashJSON } from '../../../data/question_factory_policy.mjs';
import { validationContractV74 } from '../lib/contractV74.mjs';
import { FACTORY_VERIFIER_VERSION_V76, PARENT_CONTRACT_V74_HASH, V76_ADDITIVE_FILES, validationContractV76 } from '../lib/contractV76.mjs';
import { V74_PROMPT } from '../lib/factoryEvidenceV74.mjs';
import { V76_PROMPT, V76_PROMPT_HASH, V76_FIT_INSTRUCTIONS, V76_OPTION_INSTRUCTIONS, V76_EXPLANATION_INSTRUCTIONS, adaptEvaluationRequestV76, TOPOLOGIES, applyPreparationValueV76, blindViewV76, createFactoryEvidenceV76, reasoningStepsV76 } from '../lib/factoryEvidenceV76.mjs';
import { verifyCandidateV76 } from '../lib/verifyV76.mjs';
import { expectedReleaseBindingV76 } from '../lib/releaseEvidenceV76.mjs';
import { expectedReleaseBindingV74 } from '../lib/releaseEvidenceV74.mjs';
import { ORIGINAL_AUTHOR_POLICY_V76, OriginalAuthorAbstentionV74, PreparationValueBlockedV76, adaptOriginalAuthorRequestV76, authorOriginalV76, createOriginalAuthorPolicyTransportV76 } from '../lib/originalAuthorPolicyV76.mjs';
import { createFactoryEvidenceV74 } from '../lib/factoryEvidenceV74.mjs';
import { createFactoryEvidenceV75 } from '../lib/factoryEvidenceV75.mjs';
import { preparationValueV76 } from '../lib/preparationValueV76.mjs';
import { ORIGINAL_AUTHOR_POLICY_V74 } from '../lib/originalAuthorPolicyV74.mjs';

const stemCanary = 'STEM_CANARY: Which management principle is shown?';
const sourceCanary = 'SOURCE_CANARY: The supplied source states the relevant management principle.';
const hiddenKeyCanary = 'HIDDEN_KEY_CANARY_DO_NOT_SEND';
const hiddenExplanationCanary = 'HIDDEN_EXPLANATION_CANARY_DO_NOT_SEND';
const hiddenAnalysisCanary = 'HIDDEN_OPTION_ANALYSIS_CANARY_DO_NOT_SEND';
const hiddenRationaleCanary = 'HIDDEN_WHY_ANSWER_REQUIRES_IT_CANARY_DO_NOT_SEND';
const objectiveText = 'Identify the management principle shown by the case.';

function fixture(body = stemCanary, extra = {}) {
  const supportHash = hashJSON(sourceCanary);
  const candidate = {
    id: 'v76-offline-candidate', subject: 'business_studies', chapter: 'Principles of Management',
    family_id: 'v76-offline-family', route: 'conceptual', question_type: 'conceptual_mcq', difficulty: 'easy',
    body, options: ['One', 'Two', 'Three', 'Four'], correct_answer: hiddenKeyCanary,
    explanation: hiddenExplanationCanary, option_analysis: [hiddenAnalysisCanary, 'b', 'c', 'd'],
    learning_objective: { syllabus_unit: 'Principles of Management', objective: objectiveText, target_term: '', why_answer_requires_it: hiddenRationaleCanary },
    provenance: { kind: 'original_practice', anchor_id: null, adaptation_family: 'v76-offline-family', syllabus_version: 'test-syllabus', pattern_version: 'test-pattern', source_pack_id: 'v76-offline-pack', source_pack_version: 1 },
    source_refs: [{ id: 'v76-offline-source', version: 1, locator: 'p1', support_hash: supportHash }], ...extra,
  };
  const registry = {
    examples: [], packs: { 'v76-offline-pack': { state: 'active', version: 1, subject: 'business_studies' } }, families: { 'v76-offline-family': { state: 'active', version: 1 } },
    exam_specs: { business_studies: { state: 'verified', included_topics: ['Unit I: Nature and Significance of Management'],
      excluded_topics: [], syllabus_version: 'test-syllabus', pattern_version: 'test-pattern', pattern_rules: {}, exam_rule_version: 'test-rule' } },
    sources: { 'v76-offline-source': { state: 'active', reuse_permitted: true, identity_sha256: 'a'.repeat(64), extraction_checked: true,
      version: 1, supports: { p1: supportHash }, facts: { p1: { text: sourceCanary } }, chapters: ['Principles of Management'],
      kind: 'textbook', title: 'Offline fixture', url: 'https://ncert.nic.in/offline-fixture' } },
  };
  return { candidate, view: blindViewV76(candidate, candidate.source_refs), registry };
}

const resolvedInput = (provider, body) => provider === 'openai' ? JSON.parse(body.input[1].content) : provider === 'gemini' ? JSON.parse(body.contents[0].parts[0].text) : JSON.parse(body.messages[0].content);
const systemPrompt = (provider, body) => provider === 'openai' ? body.input[0].content : provider === 'gemini' ? body.systemInstruction.parts[0].text : body.system;

function judgment(input, { steps = 1 } = {}) {
  return {
    candidate_id: input.candidate_id, content_hash: input.content_hash, solved_key: 'B',
    single_defensible_answer: true, source_support: true, numeric_solution: true, boundary_cases: true,
    passage_integrity: true, passage_answerability: true, meaningfully_distinct: true,
    evidence_ids: ['E1.1'], reasons: ['The key follows from the supplied source and printed stem.'],
    syllabus_chapter: 'Principles of Management', syllabus_topic: 'Management principles', syllabus_entitlement: true,
    presentation_ready: true, question_type_match: true, principle_applicability: 'excerpt_required', decisive_principle_in_excerpts: true,
    answer_conditions: [{ condition: 'Printed stem fact', status: 'explicit', alters_key_if_changed: false, convention_evidence_ids: [] }],
    option_challenges: ['A', 'C', 'D'].map(option => ({ option, strongest_reading: 'No supported alternative.', correct_under_reading: false, reading_status: 'strained', convention_evidence_ids: [] })),
    blocking_defects: [], style_notes: [],
    cuet_fit: { criteria: Object.fromEntries(['syllabus_objective', 'format_authenticity', 'level_calibration', 'discrimination_value'].map(id => [id, { level: 3, evidence: 'Offline software fixture.' }])),
      reasoning_steps: steps, estimated_difficulty: 'easy', cognitive_level: 'application', exemplar_ids_compared: [] },
  };
}

function rig({ topology = TOPOLOGIES.dual_blind, steps = 1, mutate = value => value } = {}) {
  const cache = new Map(), requests = [];
  const ledger = { getCache: key => cache.get(key) ?? null, setCache: (key, value) => cache.set(key, value) };
  const transport = { async generate(provider, body, options = {}) {
    requests.push({ provider, body: structuredClone(body), options: { ...options } });
    const input = resolvedInput(provider, body);
    const value = options.stage === 'explanation_support'
      ? { candidate_id: input.candidate_id, content_hash: input.content_hash, claims: [{ claim: 'Supported.', basis: 'excerpt' }], passed: true, reasons: ['Offline.'], evidence_ids: ['E1.1'] }
      : judgment(input, { steps });
    return { output_text: JSON.stringify(mutate(value, options.stage, provider)) };
  } };
  const { candidate, view, registry } = fixture();
  return { adapters: createFactoryEvidenceV76({ registry, ledger, transport, topology }), cache, requests, ledger, transport, registry, view, candidate };
}

test('v76 pins v74 and binds each academic additive file without inheriting the v75 policy', () => {
  assert.equal(validationContractV74(), PARENT_CONTRACT_V74_HASH);
  assert.equal(FACTORY_VERIFIER_VERSION_V76, 'cuet-fit-validator-v7.6');
  assert.match(validationContractV76(), /^[a-f0-9]{64}$/);
  assert.equal(validationContractV76(), validationContractV76());
  assert.equal(V76_ADDITIVE_FILES.length, 7);
  assert.ok(Object.isFrozen(V76_ADDITIVE_FILES));
  const binding = expectedReleaseBindingV76();
  assert.equal(binding.validation_contract_hash, validationContractV76());
  assert.equal(binding.prompt_hash, V76_PROMPT_HASH);
  assert.notEqual(binding.prompt_hash, expectedReleaseBindingV74().prompt_hash);
  assert.match(V76_PROMPT, /V7\.4 prerequisite classification/);
  assert.ok(V76_PROMPT.endsWith(V76_FIT_INSTRUCTIONS));
  assert.equal(V76_PROMPT.includes('V7.5 preparation-value'), false);
  assert.equal(V76_PROMPT.includes('syllabus_objective: score 0 or 1'), false);
  assert.match(V76_OPTION_INSTRUCTIONS, /partial truth alone does not make a full conjunction correct/);
  assert.match(V76_OPTION_INSTRUCTIONS, /A category label is not a contradiction/);
  assert.match(V76_EXPLANATION_INSTRUCTIONS, /including negatives/);
  assert.match(V76_EXPLANATION_INSTRUCTIONS, /Logical deductions are legitimate/);
});

test('a changed parent hash fails closed', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'v76-pin-')), here = new URL('../lib/', import.meta.url);
  const source = readFileSync(new URL('contractV76.mjs', here), 'utf8')
    .replace("'./contractV74.mjs'", JSON.stringify(new URL('contractV74.mjs', here).href))
    .replace("'../../../data/question_factory_policy.mjs'", JSON.stringify(new URL('../../../data/question_factory_policy.mjs', here).href))
    .replace(PARENT_CONTRACT_V74_HASH, 'f'.repeat(64));
  const copy = join(dir, 'contractV76.mjs'); writeFileSync(copy, source);
  assert.throws((await import(pathToFileURL(copy).href)).validationContractV76, /v76_parent_contract_changed/);
});

test('every provider receives the contextual instructions and key-free objective only', async () => {
  const { adapters, requests, view } = rig();
  for (const provider of ['openai', 'gemini', 'anthropic']) await adapters.__evaluation(view, provider);
  for (const { provider, body } of requests) {
    const payload = resolvedInput(provider, body), prompt = systemPrompt(provider, body), raw = JSON.stringify(payload);
    assert.deepEqual(payload.learning_objective, { syllabus_unit: 'Principles of Management', objective: objectiveText, target_term: '' });
    assert.equal(payload.body, stemCanary);
    assert.ok(raw.includes(sourceCanary), 'exact source evidence remains in the evidence catalogue');
    for (const canary of [hiddenKeyCanary, hiddenExplanationCanary, hiddenAnalysisCanary, hiddenRationaleCanary]) assert.equal(raw.includes(canary), false);
    for (const field of ['correct_answer', 'explanation', 'option_analysis', 'why_answer_requires_it', 'proposed_explanation']) assert.equal(raw.includes(`"${field}"`), false);
    assert.match(prompt, /V7\.4 prerequisite classification/);
    assert.match(prompt, /V7\.6 whole-option semantic adjudication/);
    assert.match(prompt, /V7\.6 contextual preparation value/);
    assert.equal(prompt.includes('V7.5 preparation-value'), false);
    assert.equal(prompt.includes('a distractor that is true or partly true'), false);
  }
  assert.equal(JSON.stringify(view).includes(hiddenRationaleCanary), false);
  assert.deepEqual(Object.keys(view.learning_objective).sort(), ['objective', 'syllabus_unit', 'target_term']);
});

test('explanation instructions adapt all providers without mutating caller bodies or other stages', () => {
  const bodies = { openai: { input: [{ role: 'system', content: 'Original audit.' }] }, gemini: { systemInstruction: { parts: [{ text: 'Original audit.' }] } }, anthropic: { system: 'Original audit.' } };
  for (const [provider, body] of Object.entries(bodies)) {
    const snapshot = JSON.stringify(body), adapted = adaptEvaluationRequestV76(provider, body, { stage: 'explanation_support' });
    assert.match(systemPrompt(provider, adapted), /V7\.6 contextual explanation claims audit/);
    assert.equal(JSON.stringify(body), snapshot);
    assert.equal(adaptEvaluationRequestV76(provider, body, { stage: 'authoring' }), body);
  }
  assert.throws(() => adaptEvaluationRequestV76('openai', {}, { stage: 'explanation_support' }), /system_prompt_required/);
});

test('v74, v75 and v76 have independent cache and provider-request identities; changed objective misses cache', async () => {
  const r = rig({ topology: TOPOLOGIES.single_luna });
  const factories = [createFactoryEvidenceV74, createFactoryEvidenceV75, createFactoryEvidenceV76];
  for (const create of factories) {
    const adapters = create({ registry: r.registry, ledger: r.ledger, transport: r.transport, topology: TOPOLOGIES.single_luna });
    await adapters.__evaluation(r.view, 'openai'); await adapters.__evaluation(r.view, 'openai');
  }
  assert.equal(r.requests.length, 3, 'one request per contract, no cross-contract cached decisions');
  assert.equal(new Set(r.requests.map(row => row.options.key)).size, 3);
  for (const prefix of ['v74:', 'v75:', 'v76:']) assert.ok([...r.cache.keys()].some(key => key.startsWith(prefix)));
  const first = await r.adapters.__evaluation(r.view, 'openai');
  assert.equal(first.prompt_version, FACTORY_VERIFIER_VERSION_V76);
  assert.equal(first.evaluation_prompt, V76_PROMPT_HASH);
  assert.equal(first.validation_contract_hash, validationContractV76());
  const changed = structuredClone(r.view); changed.learning_objective.objective = 'Another syllabus skill.';
  await r.adapters.__evaluation(changed, 'openai');
  assert.equal(r.requests.length, 4);
  await r.adapters.__evaluation(r.view, 'openai');
  assert.equal(r.requests.length, 4);
  const explanation = await r.adapters.explanation_support({ ...r.view, proposed_explanation: 'Supported local statement.' });
  assert.equal(explanation.passed, true);
  assert.match(systemPrompt('openai', r.requests.at(-1).body), /including negatives/);
});

test('mandatory academic predicates remain fail-closed in inherited structured judgments', async () => {
  const changes = [
    ['source_support', 'source_support', v => { v.source_support = false; }],
    ['single_defensible_answer', 'blind_solution', v => { v.single_defensible_answer = false; }],
    ['second_full_option', 'alternatives', v => { v.option_challenges[0] = { ...v.option_challenges[0], correct_under_reading: true, reading_status: 'stated_by_stem', strongest_reading: 'The whole alternative is true under the printed facts.' }; }],
    ['missing_decisive_input', 'blind_solution', v => { v.answer_conditions = [{ condition: 'Unstated payment status', status: 'missing', alters_key_if_changed: true, convention_evidence_ids: [] }]; }],
    ['unsupported_convention', 'blind_solution', v => { v.answer_conditions = [{ condition: 'Payment status', status: 'convention', alters_key_if_changed: true, convention_evidence_ids: [] }]; }],
    ['numeric_solution', 'numeric_solution', v => { v.numeric_solution = false; }],
    ['boundary_cases', 'llm_boundary_cases', v => { v.boundary_cases = false; }],
    ['passage_integrity', 'passage_integrity', v => { v.passage_integrity = false; }],
    ['passage_answerability', 'passage_answerability', v => { v.passage_answerability = false; }],
    ['syllabus_entitlement', 'syllabus_mapping', v => { v.syllabus_entitlement = false; }],
    ['presentation_ready', 'presentation_quality', v => { v.presentation_ready = false; }],
    ['question_type_match', 'blind_solution', v => { v.question_type_match = false; }],
    ['decisive_principle_in_excerpts', 'blind_solution', v => { v.decisive_principle_in_excerpts = false; }],
  ];
  for (const [name, stage, change] of changes) {
    const r = rig({ mutate(value, stage) { if (stage !== 'explanation_support') change(value); return value; } });
    const evaluation = await r.adapters[stage](r.view);
    assert.equal(evaluation.passed, false, name);
  }
  for (const basis of ['unsupported', 'incorrect']) {
    const r = rig({ mutate(value, stage) { if (stage === 'explanation_support') value.claims[0].basis = basis; return value; } });
    assert.equal((await r.adapters.explanation_support({ ...r.view, proposed_explanation: 'A factual negative.' })).passed, false, basis);
  }
});

test('verification preserves every required stage and immediately quarantines failures and key contradictions', async () => {
  const { candidate, registry } = fixture(stemCanary, { correct_answer: 'B' });
  const stages = ['source_support', 'syllabus_mapping', 'presentation_quality', 'numeric_solution', 'llm_boundary_cases', 'passage_integrity', 'passage_answerability', 'blind_solution', 'alternatives', 'independent_evaluation', 'explanation_support', 'exam_fit'];
  for (const failed of [...stages, 'wrong_blind_key', 'wrong_independent_key']) {
    const called = [], adapters = Object.fromEntries(stages.map(stage => [stage, async view => {
      called.push(stage);
      return { candidate_id: view.candidate_id, content_hash: view.content_hash, passed: stage !== failed,
        solved_key: (failed === 'wrong_blind_key' && stage === 'blind_solution') || (failed === 'wrong_independent_key' && stage === 'independent_evaluation') ? 'A' : 'B', reasons: ['Offline mechanical failure control.'] };
    }]));
    const route = ['numeric_solution', 'llm_boundary_cases'].includes(failed) ? 'numerical' : ['passage_integrity', 'passage_answerability'].includes(failed) ? 'passage' : 'conceptual';
    const out = await verifyCandidateV76({ ...candidate, route, passage_text: route === 'passage' ? 'An offline stimulus supplies the complete printed situation.' : '' }, { registry, adapters, secret: 'offline-secret' });
    assert.equal(out.state, 'quarantined', failed);
    const expectedStage = failed === 'wrong_blind_key' ? 'blind_solution' : failed === 'wrong_independent_key' ? 'independent_evaluation' : failed;
    assert.equal(called.at(-1), expectedStage, failed);
    assert.equal(out.reasons[0], failed === 'wrong_blind_key' ? 'blind_key_contradiction' : failed === 'wrong_independent_key' ? 'independent_key_contradiction' : `failed:${failed}`);
  }
});

test('missing objective quarantines before any model adapter; authenticated originals retain parent duties', async () => {
  const { candidate, registry } = fixture(stemCanary, { correct_answer: 'B', learning_objective: undefined });
  let calls = 0;
  const adapters = new Proxy({}, { get() { return async () => { calls++; throw new Error('should not call'); }; } });
  const out = await verifyCandidateV76(candidate, { registry, adapters, secret: 'offline-secret' });
  assert.equal(calls, 0);
  assert.deepEqual(out.reasons, ['failed:preparation_value', 'learning_objective_missing']);
  const official = applyPreparationValueV76({ ...candidate, provenance: { kind: 'authentic_pyq' } }, { passed: false });
  assert.equal(official.result.passed, false);
  assert.equal(official.value.applicable, false);
});

