import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { hashJSON } from '../../../data/question_factory_policy.mjs';
import { contentHash } from '../../../data/content_evidence.js';
import { MODEL_RATED_IDS } from '../../../data/cuet_fit_rubric.mjs';
import { evalSchemaV7 } from '../lib/factoryEvidenceV73.mjs';
import { V76_PROMPT } from '../lib/factoryEvidenceV76.mjs';
import { containsAnchoredV715, optionResolutionSchemaV715, validateOptionResolutionV715 } from '../lib/optionResolutionV715.mjs';
import { adaptEvaluationRequestV715, createFactoryEvidenceV715, V715_PROMPT_HASH, TOPOLOGIES } from '../lib/factoryEvidenceV715.mjs';
import { FACTORY_VERIFIER_VERSION_V715, validationContractV715 } from '../lib/contractV715.mjs';
import { compactSystemV715 } from '../lib/compactValidationV715.mjs';
import { verifyCandidateV715 } from '../lib/verifyV715.mjs';

const SECRET = 'offline-v715-line-hyphen-regression-secret';
const sum = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

test('V715 binds literal printed line-hyphen quotes before trying the inherited source-line join', () => {
  const source = 'The farmer-\nbaker example is used to explain this method.';
  assert.equal(containsAnchoredV715(source, 'farmer-\nbaker'), true, 'an exact printed line break/hyphen quote binds');
  assert.equal(containsAnchoredV715(source, 'farmer-baker'), true, 'the printed hyphenated word binds');
  assert.equal(containsAnchoredV715(source, 'farmerbaker'), true, 'the existing optional line-end join remains accepted');
  assert.equal(containsAnchoredV715('The inter-\nrelationship is described.', 'inter-relationship'), true);
  assert.equal(containsAnchoredV715('The inter-\nrelationship is described.', 'interrelationship'), true);
  assert.equal(containsAnchoredV715('The interpersonal relationship is described.', 'interrelationship'), false,
    'ordinary adjacent words are never merged');
});

test('V715 preserves word, hyphen, and numeric boundaries', () => {
  assert.equal(containsAnchoredV715('The witness was nowhere near.', 'now here'), false);
  assert.equal(containsAnchoredV715('The witness was now here.', 'nowhere'), false);
  assert.equal(containsAnchoredV715('The parties must re-sign the form.', 'resign'), false);
  assert.equal(containsAnchoredV715('The parties must resign.', 're-sign'), false);
  assert.equal(containsAnchoredV715('The amount is 250.', '25'), false);
  assert.equal(containsAnchoredV715('The amount is 25.', '250'), false);
  assert.equal(containsAnchoredV715('The amount is ₹1,250.', '₹12'), false);
});

const sourceText = 'The method is defined by this formula: value added at basic prices + net product taxes = value added at market prices. In the farmer-\nbaker example, final expenditure is summed.';
const catalog = [{ id: 'E1.1', source_id: 'registered-textbook', locator: 'formula', quote: sourceText }];
const view = { candidate_id: 'v715-matrix', content_hash: 'v715-hash', body: 'A printed-source method asks which measure includes the stated value.',
  passage: '', options: [{ key: 'A', text: 'Market-price value added.' }, { key: 'B', text: 'Basic-price value added.' },
    { key: 'C', text: 'Net product taxes only.' }, { key: 'D', text: 'No value-added measure.' }] };
function excerptRows() {
  return view.options.map((option, i) => ({ option: option.key, status: i === 0 ? 'supported' : 'contradicted',
    false_part: i === 0 ? '' : option.text.replace(/\.$/, ''), premise_source: 'excerpt', evidence_id: 'E1.1',
    premise_quote: i === 0 ? 'value added at basic prices + net product taxes = value added at market prices' : 'The method is defined by this formula',
    reason: i === 0 ? 'The cited formula establishes the requested measure.' : 'The cited formula distinguishes this alternative.' }));
}
function evaluation(rows) { return { candidate_id: view.candidate_id, content_hash: view.content_hash, solved_key: 'A', passed: true, option_resolution_rows: rows }; }

test('V715 accepts a complete four-option source matrix with a verbatim line-hyphen excerpt quote', () => {
  const rows = excerptRows();
  rows[0].premise_quote = 'In the farmer-\nbaker example, final expenditure is summed.';
  const result = validateOptionResolutionV715(evaluation(rows), view, { evidenceCatalog: catalog });
  assert.deepEqual(result, { ok: true, reason: null });
  assert.equal(rows.length, 4);
  assert.deepEqual(rows.map(row => row.option), ['A', 'B', 'C', 'D']);
});

test('V715 keeps arithmetic tied to printed givens and rejects arithmetic rows with a source ID', () => {
  const numericView = { candidate_id: 'v715-arithmetic', content_hash: 'numeric-hash', body: 'Farmers produce ₹150. Bakers make bread worth ₹240 after using ₹60 of wheat.',
    passage: '', options: [{ key: 'A', text: '₹330' }, { key: 'B', text: '₹390' }, { key: 'C', text: '₹240' }, { key: 'D', text: '₹150' }] };
  const rows = numericView.options.map((option, i) => ({ option: option.key, status: i === 0 ? 'supported' : 'contradicted',
    false_part: i === 0 ? '' : option.text, premise_source: 'arithmetic', evidence_id: '',
    premise_quote: numericView.body, reason: i === 0 ? '150 + (240 - 60) = 330.' : 'This printed-input calculation does not give the proposed answer.' }));
  const result = validateOptionResolutionV715({ candidate_id: numericView.candidate_id, content_hash: numericView.content_hash,
    solved_key: 'A', passed: true, option_resolution_rows: rows }, numericView, { evidenceCatalog: catalog });
  assert.deepEqual(result, { ok: true, reason: null });
  const bad = structuredClone(rows); bad[0].evidence_id = 'E1.1';
  const rejected = validateOptionResolutionV715({ candidate_id: numericView.candidate_id, content_hash: numericView.content_hash,
    solved_key: 'A', passed: true, option_resolution_rows: bad }, numericView, { evidenceCatalog: catalog });
  assert.equal(rejected.reason, 'v715_stem_premise_with_evidence_id:A');
  const schema = optionResolutionSchemaV715(['E1.1']);
  assert.match(schema.items.properties.premise_source.description, /excerpt for a cited rule\/formula/i);
  assert.match(schema.items.properties.premise_source.description, /arithmetic for calculation from printed givens/i);
  assert.match(schema.items.properties.evidence_id.description, /Empty for stem\/arithmetic; catalogue ID for excerpt/i);
});

function baseRequest(provider, stage = 'blind_solution') {
  const input = { candidate_id: 'v715-prompt', content_hash: 'prompt-hash', body: 'Check a formula in a source.', options: view.options,
    evidence_catalog: catalog, references: [{ id: 'registered-textbook', locator: 'formula' }] };
  if (provider === 'openai') return { input: [{ role: 'system', content: V76_PROMPT }, { role: 'user', content: JSON.stringify(input) }],
    max_output_tokens: stage === 'explanation_support' ? 5000 : 7500, text: { format: { type: 'json_schema', schema: structuredClone(evalSchemaV7) } } };
  return { systemInstruction: { parts: [{ text: V76_PROMPT }] }, contents: [{ role: 'user', parts: [{ text: JSON.stringify(input) }] }],
    generationConfig: { maxOutputTokens: 4500, responseFormat: { text: { schema: structuredClone(evalSchemaV7) } } } };
}
function userOf(provider, body) { return JSON.parse(provider === 'openai' ? body.input.find(row => row.role === 'user').content : body.contents[0].parts[0].text); }
function systemOf(provider, body) { return provider === 'openai' ? body.input.find(row => row.role === 'system').content : body.systemInstruction.parts[0].text; }

test('V715 adapter binds its current schema and instructions for both providers', () => {
  for (const provider of ['openai', 'gemini']) {
    const adapted = adaptEvaluationRequestV715(provider, baseRequest(provider), { stage: 'blind_solution' });
    const user = userOf(provider, adapted);
    const schema = provider === 'openai' ? adapted.text.format.schema : adapted.generationConfig.responseFormat.text.schema;
    assert.equal(user.candidate_id, 'v715-prompt');
    assert.match(schema.properties.option_resolution.items.properties.premise_source.description, /excerpt for a cited rule\/formula/i);
    assert.match(systemOf(provider, adapted), /Never label an excerpt quote arithmetic/i);
    assert.match(systemOf(provider, adapted), /Rate each criterion in cuet_fit\.criteria as an integer 0 to 3 using ONLY these anchors/i);
    assert.equal(FACTORY_VERIFIER_VERSION_V715, 'cuet-fit-validator-v7.15-printed-source-binding');
  }
  assert.match(compactSystemV715('blind_solution'), /Never label an excerpt quote arithmetic/i);
  assert.match(V715_PROMPT_HASH, /^[a-f0-9]{64}$/);
  assert.match(validationContractV715(), /^[a-f0-9]{64}$/);
});

function verifierScenario() {
  const rule = 'Cash receipts from the sale of goods and the rendering of services are examples of cash flows from operating activities.';
  const fullSource = `${rule}\nCash payments to acquire fixed assets are investing activities.\nCash proceeds from issuing shares are financing activities.`;
  const candidate = { id: 'v715-full-matrix', subject: 'accountancy', chapter: 'Cash Flow Statement', family_id: 'family-v715',
    route: 'conceptual', question_type: 'conceptual_mcq', difficulty: 'medium',
    body: 'A garment retailer receives cash from customers for garments it sells. Classify this cash flow.',
    options: ['Operating activity.', 'Investing activity.', 'Financing activity.', 'No cash flow.'], correct_answer: 'A',
    explanation: 'Cash received from customers for goods sold is an operating activity.',
    learning_objective: { syllabus_unit: 'Cash Flow Statement', objective: 'Classify operating cash receipts from sales of goods.', target_term: '' },
    provenance: { kind: 'original_practice', adaptation_family: 'family-v715', syllabus_version: 'offline', pattern_version: 'offline', source_pack_id: 'pack-v715', source_pack_version: 1 },
    source_refs: [{ id: 'source-v715', version: 1, locator: 'excerpt', support_hash: hashJSON(fullSource) }], evidence_quotes: [rule] };
  const registry = { version: 'offline-v715', examples: [], packs: { 'pack-v715': { state: 'active', version: 1, subject: 'accountancy' },
    }, families: { 'family-v715': { state: 'active', version: 1 } },
    exam_specs: { accountancy: { state: 'verified', included_topics: ['Cash Flow Statement'], excluded_topics: [], syllabus_version: 'offline', pattern_version: 'offline', pattern_rules: {}, exam_rule_version: 'offline' } },
    sources: { 'source-v715': { id: 'source-v715', state: 'active', reuse_permitted: true, identity_sha256: 'd'.repeat(64), extraction_checked: true,
      version: 1, supports: { excerpt: hashJSON(fullSource) }, facts: { excerpt: { text: fullSource } }, chapters: ['Cash Flow Statement'], kind: 'textbook', title: 'Offline evidence', url: 'https://example.test/v715' } } };
  const requests = [], cache = new Map(), ledger = { getCache: key => cache.get(key) ?? null, setCache: (key, value) => cache.set(key, structuredClone(value)) };
  const transport = { async generate(provider, body, options = {}) {
    requests.push({ provider, stage: options.stage, body: structuredClone(body) });
    const raw = provider === 'openai' ? body.input.find(row => row.role === 'user').content : body.contents[0].parts[0].text;
    const input = JSON.parse(raw), evidence = input.evidence_catalog[0]?.id;
    if (options.stage === 'explanation_support') {
      const key = input.option_resolutions[0].solved_key;
      return { output_text: JSON.stringify({ candidate_id: input.candidate_id, content_hash: input.content_hash,
        claims: [{ claim: candidate.explanation, basis: 'excerpt' }], passed: true, reasons: [], evidence_ids: [evidence],
        resolution_audit: { key, key_fully_supported: true, key_reason: 'The source supports the answer.', unexcluded_rival_conditions: [],
          distractors: ['A', 'B', 'C', 'D'].filter(item => item !== key).map(option => ({ option, decisively_wrong: true,
            basis: 'direct_contradiction', reason: 'The registered rule distinguishes this alternative.' })) } }) };
    }
    const key = 'A';
    const rows = input.options.map(option => ({ option: option.key, status: option.key === key ? 'supported' : 'contradicted',
      false_part: option.key === key ? '' : option.text, premise_source: 'excerpt', evidence_id: evidence, premise_quote: rule,
      reason: option.key === key ? 'The excerpt supports this classification.' : 'The rule contradicts this alternative.' }));
    const result = { candidate_id: input.candidate_id, content_hash: input.content_hash, solved_key: key, single_defensible_answer: true,
      source_support: true, numeric_solution: true, boundary_cases: true, passage_integrity: true, passage_answerability: true,
      meaningfully_distinct: true, evidence_ids: [evidence], reasons: [], syllabus_chapter: 'Cash Flow Statement', syllabus_topic: 'Operating cash receipts',
      syllabus_entitlement: true, presentation_ready: true, question_type_match: true, principle_applicability: 'excerpt_required',
      decisive_principle_in_excerpts: true, answer_conditions: [], option_resolution: rows,
      option_challenges: input.options.filter(option => option.key !== key).map(option => ({ option: option.key, strongest_reading: 'A different category.',
        correct_under_reading: false, reading_status: 'contradicts_stem', convention_evidence_ids: [] })), blocking_defects: [], style_notes: [],
      cuet_fit: { criteria: Object.fromEntries(MODEL_RATED_IDS.map(id => [id, { level: 3, evidence: 'The question tests the named syllabus skill.' }])),
        reasoning_steps: 1, estimated_difficulty: 'medium', cognitive_level: 'application', exemplar_ids_compared: [] } };
    if (['blind_solution', 'independent_evaluation'].includes(options.stage)) result.difficulty_assessment = { level: 'medium',
      reason: 'Normal source-backed CUET application demand.', comparison_basis: 'heuristic' };
    return { output_text: JSON.stringify(result) };
  } };
  const adapters = createFactoryEvidenceV715({ registry, ledger, transport, topology: TOPOLOGIES.dual_blind });
  return { candidate, registry, ledger, adapters, requests,
    run: () => verifyCandidateV715(candidate, { registry, ledger, adapters, topology: TOPOLOGIES.dual_blind, secret: SECRET }) };
}

test('V715 verifier stamps the current profile and audits both full frozen source matrices', async () => {
  const s = verifierScenario(), result = await s.run();
  assert.equal(result.state, 'eligible', JSON.stringify(result.reasons || result));
  const record = result.question.evidence.record;
  assert.equal(record.verifier_version, FACTORY_VERIFIER_VERSION_V715);
  assert.equal(record.validation_contract_hash, validationContractV715());
  assert.equal(record.checks.blind_solution.evaluation_prompt, V715_PROMPT_HASH);
  assert.deepEqual(record.option_resolution.matrices.map(item => item.stage), ['blind_solution', 'independent_evaluation']);
  assert.ok(record.option_resolution.matrices.every(item => item.matrix.length === 4));
  assert.equal(record.checks.explanation_support.option_resolution_audit.passed, true);
  const auditRequest = s.requests.find(row => row.stage === 'explanation_support');
  const auditInput = JSON.parse(auditRequest.body.input.find(row => row.role === 'user').content);
  assert.deepEqual(auditInput.option_resolutions.map(item => item.solver), ['openai', 'gemini']);
  assert.ok(auditInput.option_resolutions.every(item => item.rows.length === 4));
});

test('V715 verifier rejects a stale-profile verdict before eligibility', async () => {
  const s = verifierScenario(), current = s.adapters.source_support;
  s.adapters.source_support = async view => ({ ...await current(view), evaluation_prompt: 'stale-v714-prompt' });
  const result = await s.run();
  assert.equal(result.state, 'quarantined');
  assert.ok(result.reasons.includes('unbound_v715_verdict:source_support'));
  assert.notEqual(result.state, 'eligible');
});

test('V715 verifier fails closed when the independent resolution audit hook is absent', async () => {
  const s = verifierScenario();
  delete s.adapters.__auditResolution;
  const result = await s.run();
  assert.equal(result.state, 'quarantined');
  assert.ok(result.reasons.includes('option_resolution_audit_adapter_missing'));
  assert.notEqual(result.state, 'eligible');
});
