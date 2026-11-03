import test from 'node:test';
import assert from 'node:assert/strict';
import { hashJSON } from '../../../data/question_factory_policy.mjs';
import { cuetFitReleased, evaluateEvidenceV7 } from '../../../data/cuet_fit_evidence.mjs';
import { createFactoryEvidenceV78, TOPOLOGIES, V78_PROMPT_HASH } from '../lib/factoryEvidenceV78.mjs';
import { FACTORY_VERIFIER_VERSION_V78, validationContractV78, PARENT_CONTRACT_V77_HASH } from '../lib/contractV78.mjs';
import { validationContractV77 } from '../lib/contractV77.mjs';
import { verifyCandidateV78 } from '../lib/verifyV78.mjs';

// Synthetic regression inputs, never qualification cases or provider answers.
// The transport is deliberately in-memory: there is no network or persistent budget ledger.
const SECRET = 'offline-v78-regression-secret';
const rule = 'Cash receipts from the sale of goods and the rendering of services are examples of cash flows from operating activities.';
const sourceText = `${rule}\nCash payments to acquire fixed assets are investing activities.\nCash proceeds from issuing shares are financing activities.\nCash repayment of amounts borrowed is a financing activity.`;
const origin = (kind, ids = []) => ({ kind, evidence_ids: ids, option: null });
const statement = 'A garment retailer receives cash from customers for garments it sells.';

function makeScenario({ arithmetic = false, mixed = false, lineWrap = false, passage = false, failure = null } = {}) {
  const text = arithmetic ? 'Net operating cash equals operating cash receipts minus operating cash payments.' : sourceText;
  const body = arithmetic
    ? 'An entity received 120 units in operating cash and paid 50 units in operating cash. Calculate its net operating cash.'
    : `${statement} Classify this cash flow.`;
  const options = arithmetic ? ['70 units.', '170 units.', '50 units.', '120 units.'] : ['Operating activity.', 'Investing activity.', 'Financing activity.', 'No cash flow.'];
  const sourceId = 'v78-regression-source', familyId = 'v78-regression-family', packId = 'v78-regression-pack';
  const candidate = { id: 'v78-local-integration', subject: 'accountancy', chapter: 'Cash Flow Statement', family_id: familyId,
    route: arithmetic ? 'numerical' : passage ? 'passage' : 'conceptual', question_type: arithmetic ? 'numerical_mcq' : 'conceptual_mcq', difficulty: 'easy', body, options,
    ...(passage ? { passage_text: `${statement} These are cash receipts from the retailer's sale of goods.` } : {}),
    correct_answer: 'A', explanation: arithmetic ? 'Subtract operating cash payments of 50 from receipts of 120 to get net operating cash of 70 units.'
      : 'Cash received from customers for goods sold is an operating activity.',
    learning_objective: { syllabus_unit: 'Cash Flow Statement', objective: arithmetic ? 'Calculate net operating cash from receipts and payments.' : 'Classify operating cash receipts from sales of goods.', target_term: 'operating cash' },
    provenance: { kind: 'original_practice', adaptation_family: familyId, syllabus_version: 'offline-syllabus', pattern_version: 'offline-pattern', source_pack_id: packId, source_pack_version: 1 },
    source_refs: [{ id: sourceId, version: 1, locator: 'excerpt', support_hash: hashJSON(text) }] };
  const registry = { version: 'offline-v78', examples: [], packs: { [packId]: { state: 'active', version: 1, subject: 'accountancy' } },
    families: { [familyId]: { state: 'active', version: 1 } },
    exam_specs: { accountancy: { state: 'verified', included_topics: ['Cash Flow Statement'], excluded_topics: [], syllabus_version: 'offline-syllabus', pattern_version: 'offline-pattern', pattern_rules: {}, exam_rule_version: 'offline-rule' } },
    sources: { [sourceId]: { state: 'active', reuse_permitted: true, identity_sha256: 'b'.repeat(64), extraction_checked: true, version: 1,
      supports: { excerpt: hashJSON(text) }, facts: { excerpt: { text } }, chapters: ['Cash Flow Statement'], kind: 'textbook', title: 'Synthetic regression source', url: 'https://ncert.nic.in/offline-fixture' } } };
  const cache = new Map(), requests = [];
  const ledger = { getCache: key => cache.get(key) ?? null, setCache: (key, value) => cache.set(key, structuredClone(value)) };
  function premises(input, provider) {
    if (arithmetic) return { premises: ['An entity received 120 units in operating cash and paid 50 units in operating cash.'], premise_origins: [origin('stem')], evidence_ids: [], basis: 'arithmetic' };
    const actualRule = lineWrap ? rule.replace('and the rendering', 'and\n  the rendering') : rule;
    const caseMixed = mixed && provider === 'openai';
    return { premises: caseMixed ? [statement, actualRule] : [actualRule],
      premise_origins: caseMixed ? [origin('stem'), origin('excerpt', ['E1.1'])] : [origin('excerpt', ['E1.1'])], evidence_ids: ['E1.1'], basis: 'excerpt' };
  }
  function matrix(input, provider) {
    const p = premises(input, provider);
    return input.options.map(option => ({ option: option.key, exact_option_text: option.text, clauses: [{ clause: option.text,
      status: option.key === 'A' ? 'support' : 'contradiction',
      // The context is intentionally a paraphrase, never a substitute for anchored premises.
      decisive_context: arithmetic ? 'Receipts less payments gives net cash.' : 'The receipt arises from the retailer selling its goods.',
      rationale: arithmetic ? '120 minus 50 equals 70, so all other printed amounts are false.' : 'The source classifies receipts from selling goods as operating; the printed cash receipt has exactly that cause.',
      contradiction_basis: option.key === 'A' ? 'none' : arithmetic ? 'arithmetic_result' : 'source_contradiction', ...structuredClone(p) }] }));
  }
  const transport = { async generate(provider, requestBody, requestOptions = {}) {
    requests.push({ provider, body: structuredClone(requestBody), options: { ...requestOptions } });
    const raw = provider === 'openai' ? requestBody.input.find(row => row.role === 'user').content : requestBody.contents.find(row => row.role === 'user').parts[0].text;
    const input = JSON.parse(raw);
    if (requestOptions.stage === 'explanation_support') {
      const audits = input.option_resolution_matrices.flatMap(entry => entry.matrix.map(row => {
        const p = premises(input, entry.solver), expected = row.option === 'A' ? 'support' : 'contradiction';
        const a = { candidate_id: entry.candidate_id, content_hash: entry.content_hash, solver: entry.solver, option: row.option, exact_option_text: row.exact_option_text,
          claimed_whole_status: expected, audited_whole_status: expected, whole_claim_audit: 'entailed', basis_audit: arithmetic ? 'arithmetic' : 'excerpt_direct',
          rationale: 'The complete option is independently checked against the printed cash event and its decisive rule.', evidence_ids: p.evidence_ids, premises: p.premises, premise_origins: p.premise_origins,
          clauses: row.clauses.map(clause => ({ clause: clause.clause, claimed_status: clause.status, audited_status: clause.status, claim_audit: 'entailed',
            basis_audit: arithmetic ? 'arithmetic' : 'excerpt_direct', rationale: 'The anchored case and source decide this complete claim.', evidence_ids: p.evidence_ids, premises: p.premises, premise_origins: p.premise_origins })) };
        if (failure === 'category-only' && row.option === 'B') { a.basis_audit = 'category_only'; a.audited_whole_status = 'unresolved'; a.whole_claim_audit = 'not_entailed'; }
        if (failure === 'audit-quote' && row.option === 'B') a.clauses[0].premises[0] = 'Invented premise.';
        if (failure === 'audit-status' && entry.solver === 'gemini' && row.option === 'C') a.clauses[0].audited_status = 'support';
        return a;
      }));
      if (failure === 'audit-missing-solver') audits.splice(4);
      if (failure === 'audit-duplicate') audits[4] = structuredClone(audits[0]);
      if (failure === 'audit-substitute') audits[4].solver = 'invented-solver';
      return { output_text: JSON.stringify({ candidate_id: input.candidate_id, content_hash: input.content_hash, claims: [{ claim: candidate.explanation, basis: arithmetic ? 'arithmetic' : 'excerpt' }],
        passed: failure !== 'explanation-false', reasons: ['Offline explanation result.'], evidence_ids: ['E1.1'], option_resolution_audits: audits }) };
    }
    const m = matrix(input, provider);
    if (failure === 'missing-origin') delete m[0].clauses[0].premise_origins;
    if (failure === 'changed-source-number') m[0].clauses[0].premises[0] = 'Changed source rule.';
    if (failure === 'source-id') m[0].clauses[0].premise_origins[0].evidence_ids = ['unknown-id'];
    if (failure === 'unresolved') { m[1].clauses[0].status = 'unresolved'; m[1].clauses[0].contradiction_basis = 'none'; }
    if (failure === 'two-answers') { m[1].clauses[0].status = 'support'; m[1].clauses[0].contradiction_basis = 'none'; }
    if (failure === 'wrong-independent-key' && provider === 'gemini') {
      m[0].clauses[0].status = 'contradiction'; m[0].clauses[0].contradiction_basis = arithmetic ? 'arithmetic_result' : 'source_contradiction';
      m[1].clauses[0].status = 'support'; m[1].clauses[0].contradiction_basis = 'none';
    }
    const solved = failure === 'wrong-independent-key' && provider === 'gemini' ? 'B' : 'A';
    const value = { candidate_id: input.candidate_id, content_hash: input.content_hash, solved_key: solved, single_defensible_answer: failure !== 'single-answer-false',
      source_support: failure !== 'source-false', numeric_solution: failure !== 'numeric-false', boundary_cases: failure !== 'boundary-false',
      passage_integrity: failure !== 'passage-integrity-false', passage_answerability: failure !== 'passage-answerability-false', meaningfully_distinct: failure !== 'novelty-false',
      evidence_ids: ['E1.1'], reasons: ['The printed facts decide the key under the explicit source rule.'], syllabus_chapter: 'Cash Flow Statement', syllabus_topic: 'Operating activities',
      syllabus_entitlement: failure !== 'syllabus-false', presentation_ready: true, question_type_match: true, principle_applicability: 'excerpt_required', decisive_principle_in_excerpts: true,
      answer_conditions: failure === 'unstated-assumption' ? [{ condition: 'The entity is a bank.', status: 'missing', alters_key_if_changed: true, convention_evidence_ids: [] }] : [],
      option_challenges: input.options.filter(option => option.key !== solved).map(option => ({ option: option.key, strongest_reading: 'This full alternative does not follow from the explicit cash event and rule.',
        correct_under_reading: false, reading_status: 'strained', convention_evidence_ids: [] })), option_resolution_matrix: m, blocking_defects: [], style_notes: [],
      cuet_fit: { criteria: Object.fromEntries(['syllabus_objective', 'format_authenticity', 'level_calibration', 'discrimination_value'].map(id => [id, { level: 3, evidence: 'The cash event requires the named source-backed accounting skill.' }])),
        reasoning_steps: 1, estimated_difficulty: 'easy', cognitive_level: arithmetic ? 'application' : 'comprehension', exemplar_ids_compared: [] } };
    return { output_text: JSON.stringify(value) };
  } };
  const adapters = createFactoryEvidenceV78({ registry, ledger, transport, topology: TOPOLOGIES.dual_blind });
  const run = (customAdapters = adapters) => verifyCandidateV78(candidate, { registry, ledger, adapters: customAdapters, topology: TOPOLOGIES.dual_blind, secret: SECRET });
  return { candidate, registry, cache, requests, ledger, adapters, run };
}
const checksOf = result => result.checks || result.question?.evidence?.record?.checks;

test('V78 real adapter flow accepts source-backed case application and audits both frozen blind matrices', async () => {
  const s = makeScenario({ mixed: true, lineWrap: true }), result = await s.run();
  assert.equal(result.state, 'eligible', JSON.stringify(result));
  const record = result.question.evidence.record;
  assert.equal(record.verifier_version, FACTORY_VERIFIER_VERSION_V78);
  assert.equal(record.validation_contract_hash, validationContractV78());
  assert.equal(record.option_resolution.version, 'full-option-clause-explicit-origin-v2');
  assert.equal(record.criteria.length, 21);
  assert.equal(record.checks.explanation_support.option_resolution_audit.passed, true);
  assert.equal(s.requests.length, 3, 'two blind derivations plus the existing explanation audit; no fourth request');
  assert.deepEqual(s.requests.map(r => [r.provider, r.options.stage]), [['openai', 'blind_solution'], ['gemini', 'independent_evaluation'], ['openai', 'explanation_support']]);
  const blindInputs = s.requests.slice(0, 2).map(r => JSON.parse(r.provider === 'openai' ? r.body.input.find(x => x.role === 'user').content : r.body.contents[0].parts[0].text));
  for (const input of blindInputs) {
    assert.equal('proposed_explanation' in input, false); assert.equal('correct_answer' in input, false); assert.equal('correct_key' in input, false);
    assert.equal('option_resolution_matrices' in input, false); assert.equal(JSON.stringify(input).includes(s.candidate.explanation), false);
  }
  const audit = JSON.parse(s.requests[2].body.input.find(x => x.role === 'user').content);
  assert.deepEqual(audit.option_resolution_matrices.map(m => m.solver), ['openai', 'gemini']);
  assert.notDeepEqual(audit.option_resolution_matrices[0].matrix, audit.option_resolution_matrices[1].matrix, 'audit receives distinct actual derivations, not a duplicated primary matrix');
  assert.equal(audit.proposed_explanation, s.candidate.explanation);
  for (const r of s.requests.slice(0, 2)) {
    const system = r.provider === 'openai' ? r.body.input.find(x => x.role === 'system').content : r.body.systemInstruction.parts[0].text;
    assert.equal(system.split('V7.8 clause-level option resolution').length - 1, 1);
    assert.equal(system.split('V7.6 whole-option semantic adjudication').length - 1, 1);
    const schema = r.provider === 'openai' ? r.body.text.format.schema : r.body.generationConfig.responseFormat.text.schema;
    assert.ok(schema.required.includes('option_resolution_matrix'));
    assert.ok(schema.properties.option_resolution_matrix.items.properties.clauses.items.required.includes('premise_origins'));
  }
  assert.equal(s.requests[2].body.text.format.schema.properties.option_resolution_audits.minItems, 8);
  assert.equal(evaluateEvidenceV7(result.question, { ...s.registry, secret: SECRET }).eligible, true);
});

test('V78 retains easy stem-only numerical derivation and separate numerical/boundary gates', async () => {
  const s = makeScenario({ arithmetic: true }), result = await s.run();
  assert.equal(result.state, 'eligible', JSON.stringify(result));
  assert.equal(checksOf(result).numeric_solution.passed, true); assert.equal(checksOf(result).llm_boundary_cases.passed, true);
  assert.equal(s.requests.length, 3);
  for (const failure of ['numeric-false', 'boundary-false']) {
    const failed = await makeScenario({ arithmetic: true, failure }).run();
    assert.equal(failed.state, 'quarantined'); assert.match(failed.failed_stage, /numeric_solution|llm_boundary_cases/);
  }
});

test('V78 passage flow preserves integrity and answerability, and missing mandatory adapters fail closed', async () => {
  const good = makeScenario({ passage: true }), passed = await good.run();
  assert.equal(passed.state, 'eligible', JSON.stringify(passed));
  assert.equal(checksOf(passed).passage_integrity.passed, true);
  assert.equal(checksOf(passed).passage_answerability.passed, true);
  assert.equal(good.requests.length, 3);
  for (const failure of ['passage-integrity-false', 'passage-answerability-false']) {
    const s = makeScenario({ passage: true, failure }), result = await s.run();
    assert.equal(result.state, 'quarantined'); assert.match(result.failed_stage, /passage_integrity|passage_answerability/);
  }
  for (const stage of ['numeric_solution', 'llm_boundary_cases', 'passage_integrity', 'passage_answerability']) {
    const s = makeScenario({ arithmetic: stage.startsWith('numeric') || stage === 'llm_boundary_cases', passage: stage.startsWith('passage') });
    const adapters = { ...s.adapters }; delete adapters[stage];
    const result = await s.run(adapters); assert.equal(result.state, 'quarantined'); assert.ok(result.reasons.includes(`adapter_missing:${stage}`));
  }
});

test('V78 never lets high fit or valid strings override source, syllabus, uniqueness, novelty or missing assumptions', async () => {
  for (const failure of ['source-false', 'syllabus-false', 'single-answer-false', 'novelty-false', 'unstated-assumption', 'wrong-independent-key']) {
    const s = makeScenario({ failure }), result = await s.run();
    assert.equal(result.state, 'quarantined', `${failure}: ${JSON.stringify(result)}`);
    assert.ok(s.requests.length <= 2, `${failure} must not progress to a blind-dependent explanation audit`);
  }
});

test('V78 blocks malformed or unsupported resolution before semantic audit', async () => {
  for (const failure of ['missing-origin', 'changed-source-number', 'source-id', 'unresolved', 'two-answers']) {
    const s = makeScenario({ failure }), result = await s.run();
    assert.equal(result.state, 'quarantined', `${failure}: ${JSON.stringify(result)}`);
    assert.equal(result.failed_stage, 'source_support'); assert.equal(s.requests.length, 1);
  }
});

test('V78 audit rejects category reasoning, false premises, altered clauses and incomplete/substituted solver coverage', async () => {
  for (const failure of ['category-only', 'audit-quote', 'audit-status', 'audit-missing-solver', 'audit-duplicate', 'audit-substitute', 'explanation-false']) {
    const s = makeScenario({ failure }), result = await s.run();
    assert.equal(result.state, 'quarantined', `${failure}: ${JSON.stringify(result)}`);
    assert.equal(result.failed_stage, 'explanation_support'); assert.equal(s.requests.length, 3);
  }
});

test('V78 cache restores both matrices without a request; cached origin tampering cannot pass', async () => {
  const s = makeScenario({ mixed: true }), first = await s.run();
  assert.equal(first.state, 'eligible');
  assert.ok([...s.cache.keys()].some(key => key.startsWith(`v78:${validationContractV78()}:v76:`)));
  const second = await s.run(); assert.equal(second.state, 'eligible'); assert.equal(s.requests.length, 3);
  // Target every stored resolved stage, including the outer stage-result cache.
  let changed = 0;
  for (const value of s.cache.values()) if (value.option_resolution_matrix) { value.option_resolution_matrix[0].clauses[0].premise_origins = []; changed++; }
  assert.ok(changed > 0); const corrupt = await s.run();
  assert.equal(corrupt.state, 'quarantined'); assert.equal(corrupt.failed_stage, 'source_support'); assert.equal(s.requests.length, 3);
});

test('V78 refuses stale version/contract/prompt verdicts and remains unreleased', async () => {
  const s = makeScenario(), first = await s.run(); assert.equal(first.state, 'eligible');
  for (const field of ['prompt_version', 'validation_contract_hash', 'evaluation_prompt']) {
    const altered = new Map([...s.cache].map(([key, value]) => [key, structuredClone(value)]));
    for (const [key, value] of s.cache) if (!key.startsWith('v78:') && value?.candidate_id) value[field] = 'stale';
    const result = await s.run(); assert.equal(result.state, 'quarantined'); assert.match(result.reasons.join(' '), /unbound_v78_verdict/);
    s.cache.clear(); for (const [key, value] of altered) s.cache.set(key, value);
  }
  const record = first.question.evidence.record;
  assert.equal(cuetFitReleased({}, s.registry, record), false);
  assert.equal(cuetFitReleased({ cuet_fit_releases: { dual_blind: { state: 'released', verifier_version: 'cuet-fit-validator-v7.7-local-draft' } } }, s.registry, record), false);
  assert.equal(validationContractV77(), PARENT_CONTRACT_V77_HASH);
  assert.equal(record.checks.blind_solution.evaluation_prompt, V78_PROMPT_HASH);
});
