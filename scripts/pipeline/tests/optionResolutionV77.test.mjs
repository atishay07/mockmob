import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hashJSON } from '../../../data/question_factory_policy.mjs';
import { contentHash } from '../../../data/content_evidence.js';
import { adaptEvaluationRequestV77, createFactoryEvidenceV77, blindViewV77, TOPOLOGIES } from '../lib/factoryEvidenceV77.mjs';
import { verifyCandidateV77 } from '../lib/verifyV77.mjs';
import { validateOptionResolutionV77, applyOptionResolutionV77 } from '../lib/optionResolutionV77.mjs';
import { validationContractV76 } from '../lib/contractV76.mjs';
import { validationContractV77, PARENT_CONTRACT_V76_HASH } from '../lib/contractV77.mjs';

const options = [
  { key: 'A', text: 'The method reduces cost.' },
  { key: 'B', text: 'The method reduces cost and increases cost.' },
  { key: 'C', text: 'The method leaves cost unchanged.' },
  { key: 'D', text: 'The method raises cost.' },
];
const reference = { id: 'source-1', locator: 'excerpt', kind: 'textbook', text: 'The method reduces cost and avoids extra units.' };
const view = { candidate_id: 'candidate-1', content_hash: 'hash-1', body: 'Which statement follows from the excerpt?', options, passage: '', references: [reference] };
const premise = 'The method reduces cost';
const trustedEvidence = [{ id: 'E1.1', source_id: reference.id, locator: reference.locator, quote: reference.text, start: 0, end: reference.text.length }];
const makeClause = (status, clause, contradictionBasis = 'none') => ({ clause, status,
  decisive_context: premise, rationale: status === 'contradiction' ? 'The cited premise states the opposite of this clause.' : 'The cited premise directly supports this clause.',
  basis: 'excerpt', contradiction_basis: contradictionBasis, evidence_ids: ['E1.1'], premises: [premise] });
const makeResult = (matrix = null) => ({ candidate_id: 'candidate-1', content_hash: 'hash-1', solved_key: 'A', evidence_ids: ['E1.1'], evidence_selection_valid: true,
  supporting_spans: [{ source_id: reference.id, locator: reference.locator, quote: reference.text, start: 0, end: reference.text.length }],
  ...(matrix ? { option_resolution_matrix: matrix } : {}) });
const validate = (result, target = view, catalog = trustedEvidence) => validateOptionResolutionV77(result, target, { evidenceCatalog: catalog });
function fullMatrix() {
  return options.map(o => ({ option: o.key, exact_option_text: o.text, clauses: [makeClause(o.key === 'A' ? 'support' : 'contradiction', o.text,
    o.key === 'A' ? 'none' : 'source_contradiction')] }));
}

test('rejects a V76-style false challenge with no clause proof', () => {
  const legacy = { solved_key: 'A', evidence_ids: ['E1.1'], evidence_selection_valid: true,
    option_challenges: [{ option: 'B', correct_under_reading: false, reading_status: 'contradicts_stem', strongest_reading: 'The method is a different category.' }] };
  legacy.supporting_spans = makeResult().supporting_spans;
  assert.equal(validate(legacy).reason, 'resolution_input_identity_mismatch');
});

test('rejects the preserved V76 accepted disputed judgment under the V77 gate', () => {
  const path = new URL('../../../artifacts/question-factory/cuet-readiness-2026-10-09/execution/v76-diagnostic-full-claims.jsonl', import.meta.url);
  const saved = readFileSync(path, 'utf8').split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line)).find(row => row.id === 'v75f-825e60a00f');
  assert.ok(saved?.evaluations?.openai?.option_challenges?.length);
  assert.equal(saved.evaluations.openai.solved_key, 'D');
  const savedView = { candidate_id: saved.id, body: saved.body, options: saved.options, references: [], passage: '' };
  assert.equal(validateOptionResolutionV77(saved.evaluations.openai, savedView, { evidenceCatalog: [] }).ok, false);
});

test('requires exact coverage of all four printed options and the selected key', () => {
  const matrix = fullMatrix();
  assert.equal(validate(makeResult(matrix)).ok, true);
  assert.match(validate(makeResult(matrix.slice(0, 3))).reason, /all_four/);
  matrix[0].exact_option_text = 'paraphrased selected option';
  assert.match(validate(makeResult(matrix)).reason, /text_mismatch/);
  matrix[0].exact_option_text = options[0].text;
  matrix[0].clauses = [{ ...matrix[0].clauses[0], clause: 'cropped' }];
  assert.match(validate(makeResult(matrix)).reason, /clause_coverage/);
});

test('quarantines category-only unresolved and multiple fully supported alternatives', () => {
  const matrix = fullMatrix();
  matrix[1].clauses = [{ ...makeClause('unresolved', options[1].text), rationale: 'It is attributed to another textbook category.' }];
  assert.match(validate(makeResult(matrix)).reason, /unresolved_alternative:B/);
  matrix[1].clauses = [makeClause('support', options[1].text)];
  assert.match(validate(makeResult(matrix)).reason, /multiple_full_options:B/);
});

test('a complete conjunction with one supported and one contradicted proposition is rejected as a full option', () => {
  const matrix = fullMatrix();
  matrix[1].clauses = [makeClause('support', 'The method reduces cost and '), makeClause('contradiction', 'increases cost.', 'source_contradiction')];
  matrix[1].clauses[1].premises = [premise];
  matrix[1].clauses[1].decisive_context = premise;
  assert.equal(validate(makeResult(matrix)).ok, true);
  matrix[1].clauses[1].evidence_ids = ['invented'];
  assert.match(validate(makeResult(matrix)).reason, /support_spans_mismatch|citation_invalid/);
});

test('rejects forged model-returned spans that do not match trusted source text', () => {
  const forged = makeResult(fullMatrix());
  forged.supporting_spans[0] = { ...forged.supporting_spans[0], quote: 'fabricated evidence quote' };
  assert.equal(validate(forged).reason, 'resolution_support_spans_mismatch');
});

test('requires candidate and content identity on every option matrix', () => {
  const missingId = makeResult(fullMatrix()); delete missingId.candidate_id;
  const missingHash = makeResult(fullMatrix()); delete missingHash.content_hash;
  assert.equal(validate(missingId).reason, 'resolution_input_identity_mismatch');
  assert.equal(validate(missingHash).reason, 'resolution_input_identity_mismatch');
});

test('verifier rejects cache-hit identity omissions and mock records before stamping', async () => {
  const sourceText = 'Source text for a locally cached candidate.';
  const sourceHash = hashJSON(sourceText), candidate = { id: 'v77-cache-identity', subject: 'business_studies', chapter: 'Principles of Management',
    family_id: 'v77-cache-family', route: 'conceptual', question_type: 'conceptual_mcq', body: 'Which statement follows?', options: ['A', 'B', 'C', 'D'],
    correct_answer: 'A', explanation: 'A follows.', learning_objective: { syllabus_unit: 'Principles of Management', objective: 'Identify the principle.', target_term: '' },
    provenance: { kind: 'original_practice', adaptation_family: 'v77-cache-family', syllabus_version: 'test-syllabus', pattern_version: 'test-pattern', source_pack_id: 'v77-cache-pack', source_pack_version: 1 },
    source_refs: [{ id: 'v77-cache-source', version: 1, locator: 'p1', support_hash: sourceHash }] };
  const registry = { packs: { 'v77-cache-pack': { state: 'active', version: 1, subject: 'business_studies' } },
    exam_specs: { business_studies: { state: 'verified', syllabus_version: 'test-syllabus', pattern_version: 'test-pattern' } },
    families: { 'v77-cache-family': { state: 'active', version: 1 } }, sources: { 'v77-cache-source': { state: 'active', reuse_permitted: true,
      identity_sha256: 'c'.repeat(64), extraction_checked: true, kind: 'textbook', title: 'Cache test source', url: 'https://ncert.nic.in/test',
      version: 1, supports: { p1: sourceHash }, facts: { p1: { text: sourceText } }, chapters: ['Principles of Management'] } } };
  const view = blindViewV77(candidate, candidate.source_refs), id = candidate.id, digest = contentHash(candidate);
  for (const cached of [{ passed: true, content_hash: digest }, { candidate_id: id, passed: true }, { candidate_id: id, content_hash: digest, mock: true, passed: true }]) {
    const ledger = { getCache: () => cached, setCache() { throw new Error('cache hit must not be rewritten'); } };
    const out = await verifyCandidateV77(candidate, { registry, ledger, adapters: { source_support: async () => { throw new Error('cache hit must bypass adapter'); } }, secret: 'cache-secret' });
    assert.equal(out.reasons[0], 'unmatched_verdict:source_support');
    assert.equal(out.checks.source_support, undefined, 'invalid cache values are rejected before stamping');
  }
  let cacheWrites = 0;
  const malformed = await verifyCandidateV77(candidate, { registry, ledger: { getCache: () => null, setCache() { cacheWrites++; } },
    adapters: { source_support: async () => ({ candidate_id: 'wrong-candidate', content_hash: digest, passed: true }) }, secret: 'cache-secret' });
  assert.equal(malformed.reasons[0], 'unmatched_verdict:source_support');
  assert.equal(cacheWrites, 0, 'an invalid fresh adapter result is rejected before entering stage cache');
  assert.equal(view.candidate_id, id);
});

test('a valid option matrix cannot promote a failed inherited academic result', () => {
  const result = applyOptionResolutionV77({ ...makeResult(fullMatrix()), passed: false, reasons: ['inherited_source_gate_failed'] }, view,
    { evidenceCatalog: trustedEvidence });
  assert.equal(result.option_resolution.passed, true);
  assert.equal(result.passed, false);
  assert.ok(result.reasons.includes('inherited_source_gate_failed'));
});

test('checks parent binding and adds the required strict matrix schema to real provider body shapes', () => {
  assert.equal(validationContractV76(), PARENT_CONTRACT_V76_HASH);
  assert.match(validationContractV77(), /^[a-f0-9]{64}$/);
  const schema = { type: 'object', required: ['option_challenges'], properties: { option_challenges: { type: 'array' } } };
  const body = { input: [{ role: 'system', content: 'V7.6 whole-option semantic adjudication: judge' }, { role: 'user', content: JSON.stringify({ evidence_catalog: [{ id: 'E1.1' }] }) }],
    text: { format: { type: 'json_schema', strict: true, schema } } };
  const adapted = adaptEvaluationRequestV77('openai', body, { stage: 'blind_solution' });
  const outputSchema = adapted.text.format.schema;
  assert.ok(outputSchema.required.includes('option_resolution_matrix'));
  assert.deepEqual(outputSchema.properties.option_resolution_matrix.items.properties.clauses.items.properties.evidence_ids.items.enum, ['E1.1']);
  const userPayload = JSON.parse(adapted.input.find(x => x.role === 'user').content);
  assert.equal('correct_key' in userPayload, false);
  assert.equal('option_resolution_matrix' in userPayload, false);
  const prompt = adapted.input[0].content;
  assert.equal(prompt.split('V7.6 whole-option semantic adjudication').length - 1, 1);
  assert.equal(prompt.split('V7.7 clause-level option resolution').length - 1, 1);
  const gemini = adaptEvaluationRequestV77('gemini', { systemInstruction: { parts: [{ text: 'V7.6 whole-option semantic adjudication: judge' }] },
    contents: [{ role: 'user', parts: [{ text: JSON.stringify({ evidence_catalog: [{ id: 'E1.1' }] }) }] }],
    generationConfig: { responseFormat: { text: { schema: structuredClone(schema) } } } }, { stage: 'independent_evaluation' });
  assert.ok(gemini.generationConfig.responseFormat.text.schema.required.includes('option_resolution_matrix'));
  assert.throws(() => adaptEvaluationRequestV77('openai', { ...body, text: { format: { schema: { type: 'object', properties: {} } } } }, { stage: 'blind_solution' }), /schema_or_evidence/);
});

test('structural request-only factory capture adds each version once and isolates request/cache identity', async () => {
  const sourceText = 'The supplied excerpt supports the stated management principle.';
  const sourceHash = hashJSON(sourceText), candidate = {
    id: 'v77-pipeline-candidate', subject: 'business_studies', chapter: 'Principles of Management', family_id: 'v77-family',
    route: 'conceptual', question_type: 'conceptual_mcq', difficulty: 'easy', body: 'Which statement follows from the source?',
    options: ['A choice', 'B choice', 'C choice', 'D choice'], correct_answer: 'HIDDEN_V77_KEY_CANARY', explanation: 'HIDDEN_V77_EXPLANATION_CANARY',
    provenance: { kind: 'original_practice', adaptation_family: 'v77-family', syllabus_version: 'test-syllabus', pattern_version: 'test-pattern', source_pack_id: 'v77-pack', source_pack_version: 1 },
    source_refs: [{ id: 'v77-source', version: 1, locator: 'p1', support_hash: sourceHash }],
    learning_objective: { syllabus_unit: 'Principles of Management', objective: 'Identify the stated principle.', target_term: '' },
  };
  const registry = { examples: [], packs: { 'v77-pack': { state: 'active', version: 1, subject: 'business_studies' } },
    families: { 'v77-family': { state: 'active', version: 1 } },
    exam_specs: { business_studies: { state: 'verified', included_topics: ['Unit I: Nature and Significance of Management'], excluded_topics: [], syllabus_version: 'test-syllabus', pattern_version: 'test-pattern', pattern_rules: {}, exam_rule_version: 'test-rule' } },
    sources: { 'v77-source': { state: 'active', reuse_permitted: true, identity_sha256: 'a'.repeat(64), extraction_checked: true,
      version: 1, supports: { p1: sourceHash }, facts: { p1: { text: sourceText } }, chapters: ['Principles of Management'], kind: 'textbook', title: 'Offline source', url: 'https://ncert.nic.in/offline-fixture' } } };
  const cache = new Map(), requests = [];
  const ledger = { getCache: key => cache.get(key) ?? null, setCache: (key, value) => cache.set(key, value) };
  const transport = { async generate(provider, body, options = {}) {
    requests.push({ provider, body: structuredClone(body), options: { ...options } });
    const raw = provider === 'openai' ? body.input.find(row => row.role === 'user').content : body.contents.find(row => row.role === 'user').parts[0].text;
    const input = JSON.parse(raw), quote = input.evidence_catalog[0].quote;
    const matrix = input.options.map(option => ({ option: option.key, exact_option_text: option.text, clauses: [{ clause: option.text,
      status: option.key === 'B' ? 'support' : 'contradiction', decisive_context: quote, rationale: 'The supplied excerpt resolves this option.',
      basis: 'excerpt', contradiction_basis: option.key === 'B' ? 'none' : 'source_contradiction', evidence_ids: ['E1.1'], premises: [quote] }] }));
    const criteria = Object.fromEntries(['syllabus_objective', 'format_authenticity', 'level_calibration', 'discrimination_value'].map(id => [id, { level: 3, evidence: 'Direct source-based item.' }]));
    return { output_text: JSON.stringify({ candidate_id: input.candidate_id, content_hash: input.content_hash, solved_key: 'B', single_defensible_answer: true,
      source_support: true, numeric_solution: true, boundary_cases: true, passage_integrity: true, passage_answerability: true, meaningfully_distinct: true,
      evidence_ids: ['E1.1'], reasons: ['Offline fixture.'], syllabus_chapter: 'Principles of Management', syllabus_topic: 'Management principles',
      syllabus_entitlement: true, presentation_ready: true, question_type_match: true, principle_applicability: 'excerpt_required', decisive_principle_in_excerpts: true,
      answer_conditions: [], option_challenges: ['A', 'C', 'D'].map(option => ({ option, strongest_reading: 'No defensible alternative.', correct_under_reading: false,
        reading_status: 'strained', convention_evidence_ids: [] })), option_resolution_matrix: matrix, blocking_defects: [], style_notes: [],
      cuet_fit: { criteria, reasoning_steps: 1, estimated_difficulty: 'easy', cognitive_level: 'recall', exemplar_ids_compared: [] } }) };
  } };
  const adapters = createFactoryEvidenceV77({ registry, ledger, transport, topology: TOPOLOGIES.dual_blind });
  const view = blindViewV77(candidate, candidate.source_refs);
  const blind = await adapters.blind_solution(view), independent = await adapters.independent_evaluation(view);
  assert.equal(blind.option_resolution.passed, true); assert.equal(independent.option_resolution.passed, true);
  const rawResult = await adapters.__evaluation(view, 'openai');
  assert.equal(rawResult.option_resolution.passed, true);
  assert.equal(Object.hasOwn(rawResult, 'passed'), false, 'raw evaluation exposes the check without laundering all stages into pass');
  assert.equal(rawResult.prompt_version, 'cuet-fit-validator-v7.7-local-draft');
  assert.equal(rawResult.validation_contract_hash, validationContractV77());
  assert.equal(requests.length, 2);
  for (const request of requests) {
    const prompt = request.provider === 'openai' ? request.body.input.find(row => row.role === 'system').content : request.body.systemInstruction.parts[0].text;
    assert.equal(prompt.split('V7.6 whole-option semantic adjudication').length - 1, 1);
    assert.equal(prompt.split('V7.7 clause-level option resolution').length - 1, 1);
    const schema = request.provider === 'openai' ? request.body.text.format.schema : request.body.generationConfig.responseFormat.text.schema;
    assert.ok(schema.required.includes('option_resolution_matrix'));
    const rawInput = request.provider === 'openai' ? request.body.input.find(row => row.role === 'user').content : request.body.contents.find(row => row.role === 'user').parts[0].text;
    for (const secret of [candidate.explanation, candidate.correct_answer]) assert.equal(rawInput.includes(secret), false);
  }
  assert.ok([...cache.keys()].some(key => key.startsWith(`v77:${validationContractV77()}:v76:`)));
  assert.ok(requests.every(request => request.options.key));
  for (const request of requests) {
    const rawInput = request.provider === 'openai' ? request.body.input.find(row => row.role === 'user').content : request.body.contents.find(row => row.role === 'user').parts[0].text;
    const payload = JSON.parse(rawInput);
    assert.equal('option_resolution_matrix' in payload, false, 'blind requests do not receive another solver matrix');
    assert.equal('option_resolution_matrices' in payload, false, 'independent requests do not receive the primary matrix');
  }
});

test('full offline verification audits semantic and valid uncertainty cases', async () => {
  async function run({ categoryOnly = false, falseConjUnknown = false, unresolvedAlternative = false, arithmetic = false }) {
    const variant = categoryOnly ? 'category' : falseConjUnknown ? 'false-conj-unknown' : unresolvedAlternative ? 'unresolved-alt' : arithmetic ? 'arithmetic' : 'sound';
    const sourceText = arithmetic
      ? 'The operations department processes 12 forms per hour. Total processed equals the hourly rate multiplied by the number of hours.'
      : 'Functional heads do not get training for top-management positions because they cannot gather experience in diverse areas. Ensuring that different functions get due attention is an advantage. Under divisional structure, managers may gain power, assert independence and ignore organisational interests.';
    const sourceHash = hashJSON(sourceText), sourceId = `v77-semantic-source-${variant}`;
    const familyId = `v77-semantic-family-${variant}`;
    const packId = `v77-semantic-pack-${variant}`;
    const choices = arithmetic ? [
      '36 forms.', '15 forms.', '9 forms.', '4 forms.',
    ] : [
      'Functional heads receive training for top-management positions.',
      categoryOnly ? 'Managers may gain power, assert independence and ignore organisational interests.' : unresolvedAlternative
        ? 'The office has a blue filing cabinet.' : falseConjUnknown
        ? 'Functional heads receive training for top-management roles and the office is on the east side.'
        : 'Functional heads gather broad experience across diverse areas.',
      'It ensures that different functions get due attention.',
      'Functional heads do not get training for top-management positions.',
    ];
    const candidate = { id: `v77-semantic-candidate-${variant}`, subject: 'business_studies', chapter: 'Organising',
      family_id: familyId, route: 'conceptual', question_type: 'conceptual_mcq', difficulty: 'easy',
      body: arithmetic ? 'An operations department processes 12 forms per hour for 3 hours. How many forms does it process?' : 'A company uses a functional structure. Which of the following is a disadvantage of this structure?', options: choices,
      correct_answer: arithmetic ? 'A' : 'D', explanation: arithmetic ? 'Multiply 12 forms per hour by 3 hours to get 36 forms.' : 'Functional heads do not get training for top-management positions because they cannot gather experience in diverse areas.',
      learning_objective: { syllabus_unit: 'Organising', objective: arithmetic ? 'Calculate total processed output from a rate and duration.' : 'Identify a disadvantage of functional structure.', target_term: arithmetic ? 'operations department' : 'functional structure' },
      provenance: { kind: 'original_practice', adaptation_family: familyId, syllabus_version: 'test-syllabus', pattern_version: 'test-pattern', source_pack_id: packId, source_pack_version: 1 },
      source_refs: [{ id: sourceId, version: 1, locator: 'excerpt', support_hash: sourceHash }] };
    const registry = { examples: [], packs: { [packId]: { state: 'active', version: 1, subject: 'business_studies' } }, families: { [familyId]: { state: 'active', version: 1 } },
      exam_specs: { business_studies: { state: 'verified', included_topics: ['Unit II: Principles and Functions of Management', 'Unit V: Business Finance'], excluded_topics: [],
        syllabus_version: 'test-syllabus', pattern_version: 'test-pattern', pattern_rules: {}, exam_rule_version: 'test-rule' } },
      sources: { [sourceId]: { state: 'active', reuse_permitted: true, identity_sha256: 'b'.repeat(64), extraction_checked: true, version: 1,
        supports: { excerpt: sourceHash }, facts: { excerpt: { text: sourceText } }, chapters: ['Organising'], kind: 'textbook', title: 'Offline academic excerpt', url: 'https://ncert.nic.in/offline-fixture' } } };
    const cache = new Map(), requests = [];
    const ledger = { getCache: key => cache.get(key) ?? null, setCache: (key, value) => cache.set(key, value) };
    const transport = { async generate(provider, body, options = {}) {
      requests.push({ provider, stage: options.stage, body: structuredClone(body), key: options.key });
      const userRaw = provider === 'openai' ? body.input.find(row => row.role === 'user').content
        : provider === 'gemini' ? body.contents.find(row => row.role === 'user').parts[0].text : body.messages.find(row => row.role === 'user').content;
      const input = JSON.parse(userRaw), catalogQuote = input.evidence_catalog[0].quote;
      if (options.stage === 'explanation_support') {
        const audits = input.option_resolution_matrices.flatMap(entry => entry.matrix.map(row => {
          const expected = row.clauses.some(clause => clause.status === 'contradiction') ? 'contradiction' : row.clauses.every(clause => clause.status === 'support') ? 'support' : 'unresolved';
          const disputed = categoryOnly && row.option === 'B';
          const audited = disputed ? 'unresolved' : expected;
          const rowBasis = arithmetic ? 'arithmetic' : disputed ? 'category_only' : 'excerpt_direct';
          const rowEvidence = arithmetic ? [] : ['E1.1'];
          const rowPremises = arithmetic ? ['An operations department processes 12 forms per hour for 3 hours.'] : [catalogQuote];
          const audit = { candidate_id: entry.candidate_id, content_hash: entry.content_hash, solver: entry.solver, option: row.option,
            exact_option_text: row.exact_option_text, claimed_whole_status: expected, audited_whole_status: audited,
            whole_claim_audit: disputed ? 'not_entailed' : 'entailed', basis_audit: disputed ? 'category_only' : rowBasis,
            rationale: disputed ? 'The cited passage only attributes this manager claim to a different textbook category.' : 'The cited source premise decides the answer in the printed task.',
            evidence_ids: rowEvidence, premises: rowPremises,
            clauses: row.clauses.map(clause => {
              const unresolved = falseConjUnknown && row.option === 'B' && clause.status === 'unresolved';
              return { clause: clause.clause, claimed_status: clause.status, audited_status: disputed ? 'unresolved' : clause.status,
                claim_audit: disputed ? 'not_entailed' : unresolved ? 'uncertain' : 'entailed', basis_audit: disputed ? 'category_only' : unresolved ? 'source_silence' : rowBasis,
                rationale: disputed ? 'Category attribution alone does not refute this full clause.' : unresolved ? 'The source-backed contradictory clause disproves the conjunction, while the location clause remains unaddressed.' : 'The stated premises decide this clause in the asked task.',
                evidence_ids: unresolved ? ['E1.1'] : rowEvidence, premises: unresolved ? [] : rowPremises };
            }) };
          return audit;
        }));
        return { output_text: JSON.stringify({ candidate_id: input.candidate_id, content_hash: input.content_hash, claims: [
          { claim: candidate.explanation, basis: 'excerpt' }], passed: true, reasons: ['Offline explanation audit.'], evidence_ids: ['E1.1'], option_resolution_audits: audits }) };
      }
      const matrix = input.options.map(option => {
        if (arithmetic) return { option: option.key, exact_option_text: option.text, clauses: [{ clause: option.text,
          status: option.key === 'A' ? 'support' : 'contradiction', decisive_context: 'An operations department processes 12 forms per hour for 3 hours.',
          rationale: option.key === 'A' ? '12 forms per hour multiplied by 3 hours equals 36 forms.' : 'The explicit multiplication yields 36, not this value.', basis: 'arithmetic',
          contradiction_basis: option.key === 'A' ? 'none' : 'arithmetic_result', evidence_ids: [], premises: ['An operations department processes 12 forms per hour for 3 hours.'] }] };
        if (unresolvedAlternative && option.key === 'B') return { option: option.key, exact_option_text: option.text, clauses: [{ clause: option.text,
          status: 'unresolved', decisive_context: catalogQuote, rationale: 'The excerpt does not address office furniture.', basis: 'excerpt',
          contradiction_basis: 'none', evidence_ids: ['E1.1'], premises: [catalogQuote] }] };
        if (falseConjUnknown && option.key === 'B') return { option: option.key, exact_option_text: option.text, clauses: [
          { clause: 'Functional heads receive training for top-management roles', status: 'contradiction', decisive_context: catalogQuote,
            rationale: 'The passage explicitly says functional heads do not receive this training.', basis: 'excerpt', contradiction_basis: 'source_contradiction', evidence_ids: ['E1.1'], premises: ['Functional heads do not get training for top-management positions'] },
          { clause: ' and the office is on the east side.', status: 'unresolved', decisive_context: catalogQuote,
            rationale: 'The source does not state the office location; this clause is nondecisive because the first clause is contradicted.', basis: 'excerpt', contradiction_basis: 'none', evidence_ids: ['E1.1'], premises: [catalogQuote] },
        ] };
        return { option: option.key, exact_option_text: option.text, clauses: [{ clause: option.text,
          status: option.key === 'D' ? 'support' : 'contradiction', decisive_context: catalogQuote,
          rationale: option.key === 'B' && categoryOnly ? 'Managers may have this feature under divisional structure, not the named functional structure.' : 'The excerpt resolves this option in the asked context.',
          basis: 'excerpt', contradiction_basis: option.key === 'D' ? 'none' : 'source_contradiction', evidence_ids: ['E1.1'], premises: [catalogQuote] }] };
      });
      return { output_text: JSON.stringify({ candidate_id: input.candidate_id, content_hash: input.content_hash, solved_key: arithmetic ? 'A' : 'D', single_defensible_answer: true,
        source_support: true, numeric_solution: true, boundary_cases: true, passage_integrity: true, passage_answerability: true, meaningfully_distinct: true,
        evidence_ids: ['E1.1'], reasons: ['The source and stem support D.'], syllabus_chapter: 'Organising', syllabus_topic: 'Functional structure', syllabus_entitlement: true,
        presentation_ready: true, question_type_match: true, principle_applicability: 'excerpt_required', decisive_principle_in_excerpts: true,
        answer_conditions: [], option_challenges: (arithmetic ? ['B', 'C', 'D'] : ['A', 'B', 'C']).map(option => ({ option, strongest_reading: 'No full alternative answer.', correct_under_reading: false,
          reading_status: 'strained', convention_evidence_ids: [] })), option_resolution_matrix: matrix, blocking_defects: [], style_notes: [],
        cuet_fit: { criteria: Object.fromEntries(['syllabus_objective', 'format_authenticity', 'level_calibration', 'discrimination_value'].map(id => [id, { level: 3, evidence: 'Source and stem.' }])),
          reasoning_steps: 1, estimated_difficulty: 'easy', cognitive_level: 'comprehension', exemplar_ids_compared: [] } }) };
    } };
    const adapters = createFactoryEvidenceV77({ registry, ledger, transport, topology: TOPOLOGIES.dual_blind });
    const result = await verifyCandidateV77(candidate, { registry, ledger, adapters, topology: TOPOLOGIES.dual_blind, secret: 'local-v77-test-secret' });
    return { result, requests };
  }
  const rejected = await run({ categoryOnly: true });
  assert.ok(rejected.result.checks, JSON.stringify(rejected.result));
  assert.ok(rejected.result.checks.explanation_support, JSON.stringify(rejected.result));
  assert.equal(rejected.result.state, 'quarantined', JSON.stringify(rejected.result));
  assert.equal(rejected.result.checks.explanation_support.option_resolution_audit.passed, false);
  assert.equal(rejected.result.failed_stage, 'explanation_support');
  assert.equal(rejected.requests.filter(row => row.stage === 'explanation_support').length, 1, 'the existing explanation call performs the audit');
  const auditRequest = rejected.requests.find(row => row.stage === 'explanation_support');
  assert.equal(auditRequest.body.text.format.schema.required.includes('option_resolution_audits'), true);
  const sound = await run({ categoryOnly: false });
  const soundChecks = sound.result.checks || sound.result.question?.evidence?.record?.checks;
  assert.equal(soundChecks.explanation_support.option_resolution_audit.passed, true);
  assert.equal(sound.result.state, 'eligible');
  assert.equal(sound.requests.filter(row => row.stage === 'explanation_support').length, 1);
  const unresolvedAlternative = await run({ unresolvedAlternative: true });
  assert.equal(unresolvedAlternative.result.state, 'quarantined');
  assert.equal(unresolvedAlternative.result.failed_stage, 'source_support');
  assert.match(unresolvedAlternative.result.failure_details.join(' '), /unresolved_alternative:B/);
  const falseConjUnknown = await run({ falseConjUnknown: true });
  assert.equal(falseConjUnknown.result.state, 'eligible', JSON.stringify(falseConjUnknown.result));
  const falseConjChecks = falseConjUnknown.result.checks || falseConjUnknown.result.question?.evidence?.record?.checks;
  assert.ok(falseConjChecks?.explanation_support, JSON.stringify(falseConjUnknown.result));
  assert.equal(falseConjChecks.explanation_support.option_resolution_audit.passed, true, JSON.stringify(falseConjUnknown.result));
  assert.equal(falseConjUnknown.result.state, 'eligible', JSON.stringify(falseConjUnknown.result));
  const arithmetic = await run({ arithmetic: true });
  const arithmeticChecks = arithmetic.result.checks || arithmetic.result.question?.evidence?.record?.checks;
  assert.ok(arithmeticChecks?.explanation_support, JSON.stringify(arithmetic.result));
  assert.equal(arithmeticChecks.explanation_support.option_resolution_audit.passed, true, JSON.stringify(arithmetic.result));
  assert.equal(arithmetic.result.state, 'eligible', JSON.stringify(arithmetic.result));
  assert.equal(arithmetic.requests.filter(row => row.stage === 'explanation_support').length, 1);
});

test('accepts sound, easy stem deduction when all printed option text is covered', () => {
  const stemView = { candidate_id: 'candidate-1', content_hash: 'hash-1',
    body: 'A box contains one red token and no tokens of any other color. Which color token is present?',
    options: [{ key: 'A', text: 'Red token.' }, { key: 'B', text: 'Blue token.' }, { key: 'C', text: 'Green token.' }, { key: 'D', text: 'Yellow token.' }],
    passage: '', references: [reference] };
  const mat = stemView.options.map(o => {
    const selected = o.key === 'A', clause = o.text;
    const premiseText = selected ? 'one red token' : 'no tokens of any other color';
    return { option: o.key, exact_option_text: o.text, clauses: [{ clause, status: selected ? 'support' : 'contradiction',
      decisive_context: premiseText, rationale: selected ? 'The stem directly says the box contains a red token.' : 'The stem explicitly excludes every other color.', basis: 'stem',
      contradiction_basis: selected ? 'none' : 'explicit_stem_negation', evidence_ids: [], premises: [premiseText] }] };
  });
  assert.equal(validate(makeResult(mat), stemView).ok, true);
});

test('accepts arithmetic reasoning when each stated input is cited as a premise', () => {
  const arithmeticView = { ...view, body: 'A pack has 12 items at 3 credits each. What is the total?',
    options: [{ key: 'A', text: '36 credits.' }, { key: 'B', text: '15 credits.' }, { key: 'C', text: '9 credits.' }, { key: 'D', text: '4 credits.' }] };
  const arithmeticMatrix = arithmeticView.options.map(o => ({ option: o.key, exact_option_text: o.text, clauses: [{ clause: o.text,
    status: o.key === 'A' ? 'support' : 'contradiction', decisive_context: 'A pack has 12 items at 3 credits each',
    rationale: 'Multiplying the two stated values gives 36 credits.', basis: 'arithmetic',
    contradiction_basis: o.key === 'A' ? 'none' : 'arithmetic_result', evidence_ids: [],
    premises: ['A pack has 12 items at 3 credits each'] }] }));
  assert.equal(validate(makeResult(arithmeticMatrix), arithmeticView).ok, true);
});
