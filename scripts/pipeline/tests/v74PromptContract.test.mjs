import test from 'node:test';
import assert from 'node:assert/strict';
import { blindView } from '../lib/evidencePipeline.mjs';
import { createFactoryEvidenceV74, FACTORY_VERIFIER_VERSION_V74, TOPOLOGIES, V74_PROMPT_HASH, requiredStagesV7 } from '../lib/factoryEvidenceV74.mjs';
import { validationContractV74 } from '../lib/contractV74.mjs';
import { evaluationCacheKeyV73, validationContractV73 } from '../lib/contractV73.mjs';
import { V73_PROMPT_HASH } from '../lib/factoryEvidenceV73.mjs';
import { FACTORY_POLICY, hashJSON } from '../../../data/question_factory_policy.mjs';

const stemCanary = 'STEM_CANARY: Which management principle is shown?';
const sourceCanary = 'SOURCE_CANARY: The supplied source states the relevant management principle.';
const hiddenKeyCanary = 'HIDDEN_KEY_CANARY_DO_NOT_SEND';
const hiddenExplanationCanary = 'HIDDEN_EXPLANATION_CANARY_DO_NOT_SEND';

function fixture(body = stemCanary) {
  const supportHash = hashJSON(sourceCanary);
  const candidate = {
    id: 'v74-offline-candidate', subject: 'business_studies', chapter: 'Principles of Management',
    family_id: 'v74-offline-family', route: 'conceptual', question_type: 'conceptual_mcq',
    body, options: ['One', 'Two', 'Three', 'Four'], correct_answer: hiddenKeyCanary,
    explanation: hiddenExplanationCanary,
    provenance: { kind: 'original_practice', anchor_id: null },
    source_refs: [{ id: 'v74-offline-source', version: 1, locator: 'p1', support_hash: supportHash }],
  };
  const view = blindView(candidate, candidate.source_refs);
  const registry = {
    examples: [],
    exam_specs: { business_studies: { state: 'verified', included_topics: ['Unit I: Nature and Significance of Management'],
      excluded_topics: [], syllabus_version: 'test-syllabus', pattern_version: 'test-pattern', pattern_rules: {}, exam_rule_version: 'test-rule' } },
    sources: { 'v74-offline-source': { state: 'active', reuse_permitted: true, identity_sha256: 'a'.repeat(64), extraction_checked: true,
      version: 1, supports: { p1: supportHash }, facts: { p1: { text: sourceCanary } }, chapters: ['Principles of Management'],
      kind: 'textbook', title: 'Offline fixture', url: 'https://ncert.nic.in/offline-fixture' } },
  };
  return { candidate, view, registry };
}

const resolvedInput = (provider, body) => {
  if (provider === 'openai') return JSON.parse(body.input[1].content);
  if (provider === 'gemini') return JSON.parse(body.contents[0].parts[0].text);
  return JSON.parse(body.messages[0].content);
};
const systemPrompt = (provider, body) => provider === 'openai' ? body.input[0].content : provider === 'gemini' ? body.systemInstruction.parts[0].text : body.system;
const responseSchema = (provider, body) => provider === 'openai' ? body.text.format.schema : provider === 'gemini' ? body.generationConfig.responseFormat.text.schema : body.output_config.format.schema;

function judgment(input, { condition = { condition: 'Printed stem fact', status: 'explicit', alters_key_if_changed: false, convention_evidence_ids: [] } } = {}) {
  return {
    candidate_id: input.candidate_id, content_hash: input.content_hash, solved_key: 'B',
    single_defensible_answer: true, source_support: true, numeric_solution: true, boundary_cases: true,
    passage_integrity: true, passage_answerability: true, meaningfully_distinct: true,
    evidence_ids: ['E1.1'], reasons: ['The key follows from the supplied source and printed stem.'],
    syllabus_chapter: 'Principles of Management', syllabus_topic: 'Management principles', syllabus_entitlement: true,
    presentation_ready: true, question_type_match: true, principle_applicability: 'excerpt_required', decisive_principle_in_excerpts: true,
    answer_conditions: [condition],
    option_challenges: ['A', 'C', 'D'].map(option => ({ option, strongest_reading: 'No supported alternative.', correct_under_reading: false,
      reading_status: 'strained', convention_evidence_ids: [] })),
    blocking_defects: [], style_notes: [],
    cuet_fit: { criteria: Object.fromEntries(['syllabus_objective', 'format_authenticity', 'level_calibration', 'discrimination_value']
      .map(id => [id, { level: 3, evidence: 'Offline software fixture.' }])), reasoning_steps: 1, estimated_difficulty: 'easy', cognitive_level: 'application', exemplar_ids_compared: [] },
  };
}

function rig({ topology = TOPOLOGIES.dual_blind, condition, onRequest } = {}) {
  const cache = new Map(), cacheReads = [];
  const ledger = { getCache(key) { cacheReads.push(key); return cache.get(key) ?? null; }, setCache(key, value) { cache.set(key, value); } };
  const requests = [];
  const transport = { async generate(provider, body, options = {}) {
    requests.push({ provider, body: structuredClone(body), options: { ...options } });
    onRequest?.(provider, body, options);
    const input = resolvedInput(provider, body);
    let value;
    if (options.stage === 'explanation_support') {
      value = { candidate_id: input.candidate_id, content_hash: input.content_hash, claims: [{ claim: 'The explanation is supported by the excerpt.', basis: 'excerpt' }],
        passed: true, reasons: ['Offline explanation fixture.'], evidence_ids: ['E1.1'] };
    } else value = judgment(input, { condition });
    return { output_text: JSON.stringify(value) };
  } };
  const { registry, view } = fixture();
  const adapters = createFactoryEvidenceV74({ registry, ledger, transport, topology });
  return { adapters, cache, cacheReads, requests, ledger, transport, registry, view };
}

test('actual v74 provider requests append only the prerequisite instructions and preserve blind identity/source canaries', async () => {
  const { adapters, requests, view } = rig({ topology: TOPOLOGIES.haiku_gemini });
  assert.equal(view.body, stemCanary);
  assert.equal('correct_answer' in view, false);
  assert.equal('explanation' in view, false);
  for (const provider of ['openai', 'gemini', 'anthropic']) {
    const result = await adapters.__evaluation(view, provider);
    assert.equal(result.solved_key, 'B');
  }
  assert.deepEqual(requests.map(r => r.provider), ['openai', 'gemini', 'anthropic']);
  for (const { provider, body } of requests) {
    const payload = resolvedInput(provider, body);
    assert.equal(payload.body, stemCanary);
    assert.deepEqual(payload.options.map(option => option.text), ['One', 'Two', 'Three', 'Four']);
    assert.equal(payload.candidate_id, view.candidate_id);
    assert.equal(payload.content_hash, view.content_hash);
    assert.equal(payload.evidence_catalog[0].quote, sourceCanary);
    assert.equal(payload.evidence_catalog[0].source_id, 'v74-offline-source');
    assert.equal(payload.evidence_catalog[0].locator, 'p1');
    assert.equal(payload.references[0].id, 'v74-offline-source');
    assert.equal(payload.references[0].locator, 'p1');
    const schema = responseSchema(provider, body);
    assert.deepEqual(schema.properties.candidate_id.enum, [view.candidate_id]);
    assert.deepEqual(schema.properties.content_hash.enum, [view.content_hash]);
    assert.ok(schema.properties.evidence_ids.items.enum.includes('E1.1'));
    assert.equal(JSON.stringify(payload).includes(hiddenKeyCanary), false);
    assert.equal(JSON.stringify(payload).includes(hiddenExplanationCanary), false);
    assert.match(systemPrompt(provider, body), /V7\.4 prerequisite classification/);
    assert.match(systemPrompt(provider, body), /different reasonable case realizations consistent with all printed facts produce different keys/);
  }
});

test('v74 cache is isolated from v73 and reuses only an identical current evaluation input', async () => {
  const { adapters, cache, cacheReads, requests, registry, view, ledger } = rig({ topology: TOPOLOGIES.single_luna });
  const input = adapters.__context(view);
  const oldV73Key = `evaluation:${evaluationCacheKeyV73({ input, provider: 'openai', model: 'gpt-6-luna', effort: 'high', output: 7500,
    promptHash: V73_PROMPT_HASH, policyVersion: FACTORY_POLICY, contractHash: validationContractV73() })}`;
  cache.set(oldV73Key, { stale_v73_cache_canary: true });

  const first = await adapters.__evaluation(view, 'openai');
  const same = await adapters.__evaluation(view, 'openai');
  assert.equal(requests.length, 1, 'identical current input reuses its v74 result');
  assert.equal(first.prompt_version, FACTORY_VERIFIER_VERSION_V74);
  assert.equal(same.prompt_version, FACTORY_VERIFIER_VERSION_V74);
  assert.equal(first.validation_contract_hash, validationContractV74());
  assert.equal(first.evaluation_prompt, V74_PROMPT_HASH);
  assert.equal(cacheReads.some(key => key === oldV73Key), false);
  assert.equal(cache.has(oldV73Key), true, 'test leaves the legacy cache entry untouched');
  const v74Entries = [...cache.entries()].filter(([key]) => key.startsWith('v74:' + validationContractV74() + ':evaluation:'));
  assert.equal(v74Entries.length, 1);
  assert.equal(v74Entries[0][1].prompt_version, FACTORY_VERIFIER_VERSION_V74);
  assert.equal(v74Entries[0][1].validation_contract_hash, validationContractV74());

  const nextFixture = fixture(`${stemCanary} New content.`);
  const nextAdapters = createFactoryEvidenceV74({ registry, ledger,
    transport: { async generate(provider, body) { requests.push({ provider, body }); const payload = resolvedInput(provider, body); return { output_text: JSON.stringify(judgment(payload)) }; } }, topology: TOPOLOGIES.single_luna });
  const changed = await nextAdapters.__evaluation(nextFixture.view, 'openai');
  assert.equal(requests.length, 2, 'changed current content receives a new judgment');
  assert.equal(changed.content_hash, nextFixture.view.content_hash);
});

test('v74 stamps stage outputs and provenance while preserving the explanation gate', async () => {
  const { adapters, view } = rig();
  assert.ok(requiredStagesV7('conceptual', false, TOPOLOGIES.dual_blind).includes('explanation_support'));
  assert.equal(typeof adapters.explanation_support, 'function');
  assert.equal(adapters.blind_solution.provenance.prompt, FACTORY_VERIFIER_VERSION_V74);
  assert.equal(adapters.blind_solution.provenance.contract_hash, validationContractV74());

  const blind = await adapters.blind_solution(view);
  assert.equal(blind.prompt_version, FACTORY_VERIFIER_VERSION_V74);
  assert.equal(blind.validation_contract_hash, validationContractV74());
  assert.equal(blind.evaluation_prompt, V74_PROMPT_HASH);
  const explanation = await adapters.explanation_support({ ...view, proposed_explanation: 'A learner-facing explanation.' });
  assert.equal(explanation.passed, true);
  assert.equal(explanation.prompt_version, FACTORY_VERIFIER_VERSION_V74);
  assert.equal(explanation.validation_contract_hash, validationContractV74());
  assert.equal(adapters.explanation_support.provenance.prompt, FACTORY_VERIFIER_VERSION_V74);
});

test('v74 keeps every key-changing inferred or missing condition quarantined despite supportive scalar fields and high fit', async () => {
  for (const status of ['inferred_fact', 'missing']) {
    const condition = { condition: `Key-changing ${status} prerequisite`, status, alters_key_if_changed: true, convention_evidence_ids: [] };
    const { adapters, view } = rig({ topology: TOPOLOGIES.single_luna, condition });
    const result = await adapters.blind_solution(view);
    assert.equal(result.solved_key, 'B');
    assert.equal(result.source_support, true);
    assert.equal(result.single_defensible_answer, true);
    assert.equal(result.cuet_fit_result.score, 10);
    assert.equal(result.missing_assumptions, true);
    assert.equal(result.conditions_ok, false);
    assert.equal(result.passed, false);
  }
});




