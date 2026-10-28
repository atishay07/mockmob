import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { hashJSON } from '../../../data/question_factory_policy.mjs';
import { validationContractV74 } from '../lib/contractV74.mjs';
import { FACTORY_VERIFIER_VERSION_V75, PARENT_CONTRACT_V74_HASH, V75_ADDITIVE_FILES, validationContractV75 } from '../lib/contractV75.mjs';
import { V74_PROMPT } from '../lib/factoryEvidenceV74.mjs';
import { V75_PROMPT, V75_PROMPT_HASH, V75_FIT_INSTRUCTIONS, TOPOLOGIES, applyPreparationValueV75, blindViewV75, createFactoryEvidenceV75, reasoningStepsV75 } from '../lib/factoryEvidenceV75.mjs';
import { verifyCandidateV75 } from '../lib/verifyV75.mjs';
import { expectedReleaseBindingV75 } from '../lib/releaseEvidenceV75.mjs';
import { expectedReleaseBindingV74 } from '../lib/releaseEvidenceV74.mjs';
import { ORIGINAL_AUTHOR_POLICY_V75, OriginalAuthorAbstentionV74, PreparationValueBlockedV75, adaptOriginalAuthorRequestV75, authorOriginalV75, createOriginalAuthorPolicyTransportV75 } from '../lib/originalAuthorPolicyV75.mjs';
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
    id: 'v75-offline-candidate', subject: 'business_studies', chapter: 'Principles of Management',
    family_id: 'v75-offline-family', route: 'conceptual', question_type: 'conceptual_mcq', difficulty: 'easy',
    body, options: ['One', 'Two', 'Three', 'Four'], correct_answer: hiddenKeyCanary,
    explanation: hiddenExplanationCanary, option_analysis: [hiddenAnalysisCanary, 'b', 'c', 'd'],
    learning_objective: { syllabus_unit: 'Principles of Management', objective: objectiveText, target_term: '', why_answer_requires_it: hiddenRationaleCanary },
    provenance: { kind: 'original_practice', anchor_id: null, adaptation_family: 'v75-offline-family', syllabus_version: 'test-syllabus', pattern_version: 'test-pattern', source_pack_id: 'v75-offline-pack', source_pack_version: 1 },
    source_refs: [{ id: 'v75-offline-source', version: 1, locator: 'p1', support_hash: supportHash }], ...extra,
  };
  const registry = {
    examples: [], packs: { 'v75-offline-pack': { state: 'active', version: 1, subject: 'business_studies' } }, families: { 'v75-offline-family': { state: 'active', version: 1 } },
    exam_specs: { business_studies: { state: 'verified', included_topics: ['Unit I: Nature and Significance of Management'],
      excluded_topics: [], syllabus_version: 'test-syllabus', pattern_version: 'test-pattern', pattern_rules: {}, exam_rule_version: 'test-rule' } },
    sources: { 'v75-offline-source': { state: 'active', reuse_permitted: true, identity_sha256: 'a'.repeat(64), extraction_checked: true,
      version: 1, supports: { p1: supportHash }, facts: { p1: { text: sourceCanary } }, chapters: ['Principles of Management'],
      kind: 'textbook', title: 'Offline fixture', url: 'https://ncert.nic.in/offline-fixture' } },
  };
  return { candidate, view: blindViewV75(candidate, candidate.source_refs), registry };
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

function rig({ topology = TOPOLOGIES.dual_blind, steps = 1 } = {}) {
  const cache = new Map(), requests = [];
  const ledger = { getCache: key => cache.get(key) ?? null, setCache: (key, value) => cache.set(key, value) };
  const transport = { async generate(provider, body, options = {}) {
    requests.push({ provider, body: structuredClone(body), options: { ...options } });
    const input = resolvedInput(provider, body);
    const value = options.stage === 'explanation_support'
      ? { candidate_id: input.candidate_id, content_hash: input.content_hash, claims: [{ claim: 'Supported.', basis: 'excerpt' }], passed: true, reasons: ['Offline.'], evidence_ids: ['E1.1'] }
      : judgment(input, { steps });
    return { output_text: JSON.stringify(value) };
  } };
  const { candidate, view, registry } = fixture();
  return { adapters: createFactoryEvidenceV75({ registry, ledger, transport, topology }), cache, requests, ledger, transport, registry, view, candidate };
}

test('v75 pins the exact v7.4 parent and layers its own additive files', () => {
  assert.equal(validationContractV74(), PARENT_CONTRACT_V74_HASH);
  assert.equal(FACTORY_VERIFIER_VERSION_V75, 'cuet-fit-validator-v7.5');
  assert.match(validationContractV75(), /^[0-9a-f]{64}$/);
  assert.equal(validationContractV75(), validationContractV75(), 'deterministic');
  assert.notEqual(validationContractV75(), PARENT_CONTRACT_V74_HASH);
  assert.ok(['contractV75.mjs', 'preparationValueV75.mjs', 'originalAuthorPolicyV75.mjs', 'factoryEvidenceV75.mjs', 'verifyV75.mjs', 'releaseEvidenceV75.mjs', 'factoryProfileV75.mjs'].every(f => V75_ADDITIVE_FILES.includes(f)));
  assert.ok(Object.isFrozen(V75_ADDITIVE_FILES));
  const binding = expectedReleaseBindingV75();
  assert.equal(binding.verifier_version, FACTORY_VERIFIER_VERSION_V75);
  assert.equal(binding.prompt_hash, V75_PROMPT_HASH);
  assert.equal(binding.validation_contract_hash, validationContractV75());
  assert.notEqual(binding.validation_contract_hash, expectedReleaseBindingV74().validation_contract_hash);
  assert.notEqual(binding.prompt_hash, expectedReleaseBindingV74().prompt_hash);
});

test('a changed v7.4 parent hash stops v75 until a new binding is created', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'v75-pin-')), here = new URL('../lib/', import.meta.url);
  let source = readFileSync(new URL('contractV75.mjs', here), 'utf8');
  source = source.replace("'./contractV74.mjs'", JSON.stringify(new URL('contractV74.mjs', here).href))
    .replace("'../../../data/question_factory_policy.mjs'", JSON.stringify(new URL('../../../data/question_factory_policy.mjs', here).href))
    .replace(PARENT_CONTRACT_V74_HASH, 'f'.repeat(64));
  assert.ok(source.includes('f'.repeat(64)));
  const copy = join(dir, 'contractV75.mjs');
  writeFileSync(copy, source);
  const mutated = await import(pathToFileURL(copy).href);
  assert.throws(() => mutated.validationContractV75(), /v75_parent_contract_changed_requires_new_binding/);
});

test('v75 judge instructions are appended after v7.4 on every provider and the objective reaches the evaluator without the key', async () => {
  const { adapters, requests, view } = rig({ topology: TOPOLOGIES.haiku_gemini });
  assert.deepEqual(view.learning_objective, { syllabus_unit: 'Principles of Management', objective: objectiveText, target_term: '' });
  for (const provider of ['openai', 'gemini', 'anthropic']) assert.equal((await adapters.__evaluation(view, provider)).solved_key, 'B');
  assert.deepEqual(requests.map(r => r.provider), ['openai', 'gemini', 'anthropic']);
  for (const { provider, body } of requests) {
    const payload = resolvedInput(provider, body), prompt = systemPrompt(provider, body), raw = JSON.stringify(payload);
    assert.equal(payload.body, stemCanary);
    assert.equal(payload.learning_objective.objective, objectiveText);
    for (const canary of [hiddenKeyCanary, hiddenExplanationCanary, hiddenAnalysisCanary, hiddenRationaleCanary]) assert.equal(raw.includes(canary), false, canary);
    for (const field of ['correct_answer', 'explanation', 'option_analysis', 'why_answer_requires_it', 'proposed_explanation']) assert.equal(field in payload || raw.includes(`"${field}"`), false, field);
    assert.match(prompt, /V7\.4 prerequisite classification/);
    assert.match(prompt, /V7\.5 preparation-value judging/);
    assert.ok(prompt.indexOf('V7.4 prerequisite') < prompt.indexOf('V7.5 preparation-value'));
    assert.match(prompt, /syllabus_objective: score 0 or 1/);
    assert.match(prompt, /Ignore the difficulty label/);
    assert.match(prompt, /must not be penalised/);
    assert.match(prompt, /Never inflate a score/);
  }
  assert.ok(V75_PROMPT.startsWith(V74_PROMPT) && V75_PROMPT.endsWith(V75_FIT_INSTRUCTIONS));
});

test('the blind view carries no proposed key, explanation, option analysis or author rationale', () => {
  const { view } = fixture();
  const raw = JSON.stringify(view);
  for (const canary of [hiddenKeyCanary, hiddenExplanationCanary, hiddenAnalysisCanary, hiddenRationaleCanary]) assert.equal(raw.includes(canary), false, canary);
  for (const field of ['correct_answer', 'explanation', 'option_analysis', 'evidence_quotes', 'stated_assumptions']) assert.equal(field in view, false, field);
  assert.deepEqual(Object.keys(view.learning_objective).sort(), ['objective', 'syllabus_unit', 'target_term']);
  const noObjective = blindViewV75({ ...fixture().candidate, learning_objective: undefined }, []);
  assert.equal('learning_objective' in noObjective, false);
});

test('v75 scopes cache and stamps results with the v7.5 version, prompt hash and contract', async () => {
  const { adapters, cache, requests, view } = rig({ topology: TOPOLOGIES.single_luna });
  const first = await adapters.__evaluation(view, 'openai'), same = await adapters.__evaluation(view, 'openai');
  assert.equal(requests.length, 1, 'identical v7.5 input reuses its own result');
  for (const result of [first, same]) {
    assert.equal(result.prompt_version, FACTORY_VERIFIER_VERSION_V75);
    assert.equal(result.evaluation_prompt, V75_PROMPT_HASH);
    assert.equal(result.validation_contract_hash, validationContractV75());
  }
  assert.ok([...cache.keys()].every(key => key.startsWith(`v75:${validationContractV75()}:`)));
  const blind = await adapters.blind_solution(view);
  assert.equal(blind.prompt_version, FACTORY_VERIFIER_VERSION_V75);
  assert.equal(adapters.blind_solution.provenance.prompt, FACTORY_VERIFIER_VERSION_V75);
  assert.equal(adapters.blind_solution.provenance.contract_hash, validationContractV75());
  const explanation = await adapters.explanation_support({ ...view, proposed_explanation: 'A learner-facing explanation.' });
  assert.equal(explanation.passed, true);
  assert.equal(explanation.validation_contract_hash, validationContractV75());
  // A different objective is different model input and must not reuse the cached judgment.
  const before = requests.length;
  const changed = structuredClone(view); changed.learning_objective.objective = 'A different objective.';
  await adapters.__evaluation(changed, 'openai');
  assert.equal(requests.length, before + 1, 'changed objective sends a new request');
  await adapters.__evaluation(view, 'openai');
  assert.equal(requests.length, before + 1, 'the original input is still cached');
});

test('preparation value gates the CUET-fit stage only and keeps correctness results untouched', async () => {
  const { adapters, view, candidate } = rig({ steps: 2 });
  const checks = { blind_solution: await adapters.blind_solution(view), independent_evaluation: await adapters.independent_evaluation(view) };
  assert.equal(reasoningStepsV75(checks), 2);
  const sound = applyPreparationValueV75(candidate, { passed: true, reasons: ['ok'] }, { checks });
  assert.equal(sound.result.passed, true);
  assert.equal(sound.value.blocking, false);
  const hard = applyPreparationValueV75({ ...candidate, difficulty: 'hard' }, { passed: true, reasons: ['ok'] }, { checks });
  assert.equal(hard.result.passed, false);
  assert.equal(hard.result.exam_fit, false);
  assert.ok(hard.result.reasons.includes('difficulty_label_overstated'));
  const missing = applyPreparationValueV75({ ...candidate, learning_objective: undefined }, { passed: true }, { checks });
  assert.ok(missing.result.reasons.includes('learning_objective_missing'));
  const official = applyPreparationValueV75({ ...candidate, learning_objective: undefined, provenance: { kind: 'authentic_pyq' } }, { passed: true }, { checks });
  assert.equal(official.result.passed, true, 'reproduced official questions carry no authoring duties');
  assert.equal(reasoningStepsV75({}), undefined);
});

test('verification quarantines a candidate without a learning objective before any paid stage', async () => {
  const { candidate, registry } = fixture(stemCanary, { learning_objective: undefined });
  candidate.correct_answer = 'B';
  let called = 0;
  const trap = new Proxy({}, { get: () => () => { called += 1; throw new Error('paid_stage_must_not_run'); } });
  const result = await verifyCandidateV75(candidate, { registry, ledger: null, adapters: trap, topology: TOPOLOGIES.dual_blind, secret: 'offline-secret', seen: new Set() });
  assert.equal(called, 0);
  assert.equal(result.state, 'quarantined');
  assert.equal(result.failed_stage, 'preparation_value');
  assert.deepEqual(result.reasons, ['failed:preparation_value', 'learning_objective_missing']);
});

function authorRequest(job) {
  return { model: 'gpt-6-luna', store: false,
    text: { format: { type: 'json_schema', schema: { type: 'object', additionalProperties: false, required: ['body'], properties: { body: { type: 'string' } } } } },
    input: [{ role: 'system', content: 'Existing setter instructions.' },
      { role: 'user', content: JSON.stringify({ job_id: job.id, subject: job.subject, chapter: job.chapter, references: [{ id: 'r', locator: 'l', text: 'Decisive excerpt.' }] }) }] };
}
const job = Object.freeze({ id: 'original-candidate-075', subject: 'economics', chapter: 'Money & Banking' });

test('author schema requires learning_objective and the prompt carries the v7.4 and v7.5 contracts', async () => {
  let received;
  const wrapped = createOriginalAuthorPolicyTransportV75({ async generate(provider, body, options) { received = { provider, body, options }; return { output_text: JSON.stringify({ abstain: false, abstention_reason: '' }) }; } }, job);
  const original = authorRequest(job);
  await wrapped.generate('openai', original, { stage: 'authoring', key: 'legacy-key', candidate_id: job.id });
  const schema = received.body.text.format.schema;
  assert.ok(schema.required.includes('learning_objective'));
  assert.deepEqual(schema.properties.learning_objective.required, ['syllabus_unit', 'objective', 'target_term', 'why_answer_requires_it']);
  assert.equal(schema.properties.learning_objective.additionalProperties, false);
  assert.ok(schema.required.includes('abstain') && schema.required.includes('abstention_reason'));
  const system = received.body.input[0].content, policy = JSON.parse(received.body.input[1].content).authoring_policy;
  assert.match(system, /Never include page, column, locator/, 'v7.4 contract retained');
  assert.match(system, /Preparation-value contract \(v7\.5\)/);
  for (const phrase of [/target_term/, /Do not state the tested fact in the stem/, /linking words that reveal the order/, /plausible misconception or calculation error/, /one recall or recognition step/, /three or more linked reasoning steps/, /Economics numericals must require an economics concept/, /Abstain/]) assert.match(system, phrase);
  assert.equal(policy.contract, ORIGINAL_AUTHOR_POLICY_V75);
  assert.equal(policy.parent_contract, ORIGINAL_AUTHOR_POLICY_V74);
  assert.equal(policy.learning_objective_required, true);
  assert.notEqual(received.options.key, 'legacy-key');
  assert.equal(original.text.format.schema.required.includes('learning_objective'), false, 'the caller body is never mutated');
  assert.equal(original.input[0].content, 'Existing setter instructions.');
  let passthrough;
  const stage = { stage: 'validation', key: 'validation-key' }, other = authorRequest(job);
  await createOriginalAuthorPolicyTransportV75({ async generate(provider, body, options) { passthrough = { body, options }; return 'x'; } }, job).generate('openai', other, stage);
  assert.equal(passthrough.body, other);
  assert.deepEqual(passthrough.options, stage);
  assert.throws(() => adaptOriginalAuthorRequestV75({ input: [] }, job));
  assert.throws(() => adaptOriginalAuthorRequestV75(authorRequest(job), {}), /job_identity_required/);
});

test('author gate: blocking preparation findings throw a typed error, abstention keeps its v7.4 type', async () => {
  const sound = { id: job.id, subject: 'economics', chapter: 'Money & Banking', question_type: 'conceptual_mcq', difficulty: 'easy', passage_text: '', body: 'Which statement about the repo rate is correct?',
    options: ['It is the rate at which the central bank lends to banks.', 'It is a tax on deposits.', 'It sets share prices.', 'It fixes wages.'], correct_answer: 'A',
    learning_objective: { syllabus_unit: 'Money and Banking', objective: 'Recall the role of the policy rate.', target_term: '', why_answer_requires_it: 'Needs the definition.' } };
  const call = candidate => authorOriginalV75(async (j, { transport }) => { await transport.generate('openai', authorRequest(j), { stage: 'authoring', key: 'k' }); return candidate; }, job,
    { registry: {}, transport: { async generate() { return { output_text: JSON.stringify({ abstain: false, abstention_reason: '' }) }; } } });
  assert.equal(await call(sound), sound);
  await assert.rejects(() => call({ ...sound, learning_objective: undefined }), error => error instanceof PreparationValueBlockedV75
    && error.code === 'preparation_value_blocked' && error.candidate_id === job.id && error.reasons.join() === 'learning_objective_missing' && error.candidate.id === job.id);
  await assert.rejects(() => call({ ...sound, learning_objective: undefined, difficulty: 'hard' }), error => error.reasons.includes('difficulty_label_overstated'));
  await assert.rejects(() => authorOriginalV75(async (j, { transport }) => transport.generate('openai', authorRequest(j), { stage: 'authoring', key: 'k' }), job,
    { transport: { async generate() { return { output_text: JSON.stringify({ abstain: true, abstention_reason: 'No genuine item.' }) }; } } }),
  error => error instanceof OriginalAuthorAbstentionV74 && /No genuine item/.test(error.message));
});
