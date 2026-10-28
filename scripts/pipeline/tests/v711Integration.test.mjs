import test from 'node:test';
import assert from 'node:assert/strict';
import { hashJSON } from '../../../data/question_factory_policy.mjs';
import { evaluateEvidenceV7 } from '../../../data/cuet_fit_evidence.mjs';
import { createFactoryEvidenceV711, TOPOLOGIES } from '../lib/factoryEvidenceV711.mjs';
import { FACTORY_VERIFIER_VERSION_V711, validationContractV711 } from '../lib/contractV711.mjs';
import { validationContractV78 } from '../lib/contractV78.mjs';
import { validationContractV79 } from '../lib/contractV79.mjs';
import { verifyCandidateV711 } from '../lib/verifyV711.mjs';
import { containsAnchoredV711, validateOptionResolutionV711 } from '../lib/optionResolutionV711.mjs';

// Synthetic regression inputs through the REAL V7.9 adapter seam (V7.3 -> V7.6 -> V7.9 request adaptation, both blind
// derivations, freezing, and the existing explanation call). In-memory transport: no network, no budget ledger.
const SECRET = 'offline-v79-regression-secret';
const rule = 'Cash receipts from the sale of goods and the rendering of services are examples of cash flows from operating activities.';
const sourceText = `${rule}\nCash payments to acquire fixed assets are investing activities.\nCash proceeds from issuing shares are financing activities.`;
const statement = 'A garment retailer receives cash from customers for garments it sells.';

function makeScenario({ arithmetic = false, failure = null } = {}) {
  const text = arithmetic ? 'Net operating cash equals operating cash receipts minus operating cash payments.' : sourceText;
  const body = arithmetic ? 'An entity received 120 units in operating cash and paid 50 units in operating cash. Calculate its net operating cash.' : `${statement} Classify this cash flow.`;
  const options = arithmetic ? ['70 units.', '170 units.', '50 units.', '120 units.'] : ['Operating activity.', 'Investing activity.', 'Financing activity.', 'No cash flow.'];
  const sourceId = 'v79-src', familyId = 'v79-family', packId = 'v79-pack';
  const candidate = { id: 'v79-local', subject: 'accountancy', chapter: 'Cash Flow Statement', family_id: familyId,
    route: arithmetic ? 'numerical' : 'conceptual', question_type: arithmetic ? 'numerical_mcq' : 'conceptual_mcq', difficulty: 'easy', body, options, correct_answer: 'A',
    explanation: arithmetic ? 'Subtract operating cash payments of 50 from receipts of 120 to get net operating cash of 70 units.' : 'Cash received from customers for goods sold is an operating activity.',
    learning_objective: { syllabus_unit: 'Cash Flow Statement', objective: arithmetic ? 'Calculate net operating cash from receipts and payments.' : 'Classify operating cash receipts from sales of goods.', target_term: 'operating cash' },
    provenance: { kind: 'original_practice', adaptation_family: familyId, syllabus_version: 'offline-syllabus', pattern_version: 'offline-pattern', source_pack_id: packId, source_pack_version: 1 },
    source_refs: [{ id: sourceId, version: 1, locator: 'excerpt', support_hash: hashJSON(text) }] };
  const registry = { version: 'offline-v79', examples: [], packs: { [packId]: { state: 'active', version: 1, subject: 'accountancy' } }, families: { [familyId]: { state: 'active', version: 1 } },
    exam_specs: { accountancy: { state: 'verified', included_topics: ['Cash Flow Statement'], excluded_topics: [], syllabus_version: 'offline-syllabus', pattern_version: 'offline-pattern', pattern_rules: {}, exam_rule_version: 'offline-rule' } },
    sources: { [sourceId]: { state: 'active', reuse_permitted: true, identity_sha256: 'b'.repeat(64), extraction_checked: true, version: 1,
      supports: { excerpt: hashJSON(text) }, facts: { excerpt: { text } }, chapters: ['Cash Flow Statement'], kind: 'textbook', title: 'Synthetic source', url: 'https://ncert.nic.in/offline-fixture' } } };
  const cache = new Map(), requests = [];
  const ledger = { getCache: key => cache.get(key) ?? null, setCache: (key, value) => cache.set(key, structuredClone(value)) };
  const rowsFor = (input, provider, solved) => input.options.map(o => {
    if (arithmetic) return { option: o.key, status: o.key === solved ? 'supported' : 'contradicted', false_part: o.key === solved ? '' : o.text.replace('.', ''),
      premise_source: 'arithmetic', evidence_id: '', premise_quote: 'received 120 units in operating cash and paid 50 units', reason: '120 - 50 = 70.' };
    // Gemini quotes with a PDF line wrap and curly apostrophe-free text; Luna quotes the rule exactly.
    const quote = provider === 'gemini' ? rule.replace('and the rendering', 'and\n  the rendering') : rule;
    return { option: o.key, status: o.key === solved ? 'supported' : 'contradicted', false_part: o.key === solved ? '' : o.text.replace(' activity.', '').replace('.', ''),
      premise_source: 'excerpt', evidence_id: 'E1.1', premise_quote: quote, reason: 'Receipts from selling goods are operating cash flows.' };
  });
  const transport = { async generate(provider, requestBody, requestOptions = {}) {
    requests.push({ provider, body: structuredClone(requestBody), options: { ...requestOptions } });
    const input = JSON.parse(provider === 'openai' ? requestBody.input.find(r => r.role === 'user').content : requestBody.contents.find(r => r.role === 'user').parts[0].text);
    if (requestOptions.stage === 'explanation_support') {
      const key = input.option_resolutions[0].solved_key;
      const distractors = ['A', 'B', 'C', 'D'].filter(k => k !== key).map(option => ({ option, decisively_wrong: true, basis: arithmetic ? 'arithmetic' : 'direct_contradiction', reason: 'Premise contradicts it.' }));
      if (failure === 'audit-category-only') Object.assign(distractors[0], { decisively_wrong: false, basis: 'category_only' });
      if (failure === 'audit-entailed-but-silence') Object.assign(distractors[1], { basis: 'source_silence' });
      if (failure === 'audit-missing-row') distractors.pop();
      return { output_text: JSON.stringify({ candidate_id: input.candidate_id, content_hash: input.content_hash, claims: [{ claim: candidate.explanation, basis: arithmetic ? 'arithmetic' : 'excerpt' }],
        passed: failure !== 'explanation-false', reasons: ['Offline explanation result.'], evidence_ids: ['E1.1'],
        resolution_audit: { key, key_fully_supported: failure !== 'audit-key-partial', key_reason: 'Fully established.', unexcluded_rival_conditions: failure === 'audit-rival' ? ['capital receipt if it reduces assets; the stem never excludes it'] : [], distractors } }) };
    }
    const solved = failure === 'wrong-independent-key' && provider === 'gemini' ? 'B' : 'A', rows = rowsFor(input, provider, solved);
    if (failure === 'invented-quote') rows[1].premise_quote = 'Cash receipts from selling goods are always operating flows.';
    if (failure === 'ellipsis-quote') rows[1].premise_quote = 'Cash receipts from the sale of goods ... are examples of cash flows from operating activities.';
    if (failure === 'unresolved') Object.assign(rows[1], { status: 'unresolved', premise_source: 'none', premise_quote: '', false_part: '' });
    if (failure === 'two-supported') Object.assign(rows[1], { status: 'supported', false_part: '' });
    if (failure === 'false-part-elsewhere') rows[2].false_part = 'Investing';
    if (failure === 'option-proves-itself') Object.assign(rows[0], { premise_source: 'stem', evidence_id: '', premise_quote: 'Operating activity.' });
    if (failure === 'missing-row') rows.pop();
    const value = { candidate_id: input.candidate_id, content_hash: input.content_hash, solved_key: solved, single_defensible_answer: true,
      source_support: true, numeric_solution: true, boundary_cases: true, passage_integrity: true, passage_answerability: true, meaningfully_distinct: true,
      evidence_ids: ['E1.1'], reasons: ['The printed facts decide the key under the explicit source rule.'], syllabus_chapter: 'Cash Flow Statement', syllabus_topic: 'Operating activities',
      syllabus_entitlement: true, presentation_ready: true, question_type_match: true, principle_applicability: 'excerpt_required', decisive_principle_in_excerpts: true, answer_conditions: [],
      option_challenges: input.options.filter(o => o.key !== solved).map(o => ({ option: o.key, strongest_reading: 'This full alternative does not follow from the explicit cash event and rule.',
        correct_under_reading: false, reading_status: 'strained', convention_evidence_ids: [] })), option_resolution: rows, blocking_defects: [], style_notes: [],
      cuet_fit: { criteria: Object.fromEntries(['syllabus_objective', 'format_authenticity', 'level_calibration', 'discrimination_value'].map(id => [id, { level: 3, evidence: 'The cash event requires the named source-backed accounting skill.' }])),
        reasoning_steps: 1, estimated_difficulty: 'easy', cognitive_level: arithmetic ? 'application' : 'comprehension', exemplar_ids_compared: [] } };
    return { output_text: JSON.stringify(value) };
  } };
  const adapters = createFactoryEvidenceV711({ registry, ledger, transport, topology: TOPOLOGIES.dual_blind });
  const run = () => verifyCandidateV711(candidate, { registry, ledger, adapters, topology: TOPOLOGIES.dual_blind, secret: SECRET });
  return { candidate, registry, requests, run };
}

test('V711 contract is additive over the frozen V78, V79 and V710 contracts', () => {
  assert.equal(validationContractV79(), '67cbdd05da43334b89b1320559b23cc19be28f7170977910d0ff67f9ff025f4d');
  assert.equal(validationContractV78(), 'e4be26f3e6dcb651edcf736049f872a736abaed1ed4db5b6299d6aaccb613d58');
  assert.match(validationContractV711(), /^[0-9a-f]{64}$/);
});

test('V711 real adapter flow: two hidden-key blind derivations, one explanation audit with both frozen resolutions', async () => {
  const s = makeScenario(), result = await s.run();
  assert.equal(result.state, 'eligible', JSON.stringify(result.reasons || result));
  const record = result.question.evidence.record;
  assert.equal(record.verifier_version, FACTORY_VERIFIER_VERSION_V711);
  assert.equal(record.option_resolution.version, 'compact-option-resolution-v711');
  assert.equal(record.criteria.length, 21);
  assert.deepEqual(s.requests.map(r => [r.provider, r.options.stage]), [['openai', 'blind_solution'], ['gemini', 'independent_evaluation'], ['openai', 'explanation_support']]);
  for (const r of s.requests.slice(0, 2)) {
    const raw = r.provider === 'openai' ? r.body.input.find(x => x.role === 'user').content : r.body.contents[0].parts[0].text, input = JSON.parse(raw);
    assert.equal('proposed_explanation' in input, false); assert.equal('correct_answer' in input, false); assert.equal('option_resolutions' in input, false);
    assert.equal(raw.includes(s.candidate.explanation), false);
    const system = r.provider === 'openai' ? r.body.input.find(x => x.role === 'system').content : r.body.systemInstruction.parts[0].text;
    assert.equal(system.split('V7.11 option resolution').length - 1, 1); assert.equal(system.split('V7.6 whole-option semantic adjudication').length - 1, 1);
    assert.equal(system.includes('V7.8'), false); assert.equal(system.includes('V7.9 '), false);
  }
  assert.equal(s.requests[0].body.max_output_tokens, 16000);
  assert.equal(s.requests[1].body.generationConfig.maxOutputTokens, 6000);
  const audit = JSON.parse(s.requests[2].body.input.find(x => x.role === 'user').content);
  assert.deepEqual(audit.option_resolutions.map(m => m.solver), ['openai', 'gemini']);
  assert.notDeepEqual(audit.option_resolutions[0].rows, audit.option_resolutions[1].rows);
  assert.equal(audit.proposed_explanation, s.candidate.explanation);
  assert.ok(s.requests[2].body.text.format.schema.required.includes('resolution_audit'));
  assert.equal(evaluateEvidenceV7(result.question, { ...s.registry, secret: SECRET }).eligible, true);
});

test('V711 keeps legitimate stem-only arithmetic', async () => {
  const result = await makeScenario({ arithmetic: true }).run();
  assert.equal(result.state, 'eligible', JSON.stringify(result.reasons || result));
});

for (const [failure, expected] of [
  ['invented-quote', /v711_excerpt_quote_unbound:B/], ['ellipsis-quote', /v711_excerpt_quote_unbound:B/], ['unresolved', /v711_unresolved_alternative:B/],
  ['two-supported', /v711_multiple_supported_options:AB/], ['false-part-elsewhere', /v711_false_part_not_in_option:C/], ['option-proves-itself', /v711_stem_quote_unbound:A/],
  ['missing-row', /v711_all_four_options_required/], ['wrong-independent-key', /v711_|independent_key_contradiction|failed:independent_evaluation/],
  ['audit-category-only', /v711_audit_not_decisively_wrong:B:category_only/], ['audit-entailed-but-silence', /v711_audit_nondecisive_basis:C:source_silence/],
  ['audit-missing-row', /v711_audit_all_distractors_required/], ['audit-rival', /v711_audit_unexcluded_rival_condition:capital receipt/], ['audit-key-partial', /v711_audit_key_not_fully_supported/], ['explanation-false', /failed:explanation_support/]]) {
  test(`V711 quarantines ${failure}`, async () => {
    const result = await makeScenario({ failure }).run();
    assert.equal(result.state, 'quarantined');
    assert.match(JSON.stringify([result.reasons, result.failure_details]), expected);
  });
}

test('V711 anchoring folds whitespace and quote glyphs only', () => {
  assert.ok(containsAnchoredV711('the firm’s “capital” —\n  rises', "the firm's \"capital\" - rises"));
  assert.ok(!containsAnchoredV711('the firm’s capital rises', 'the firm capital rises'));
  assert.ok(!containsAnchoredV711('capital rises by 10', 'capital rises by 1'));
  assert.ok(!containsAnchoredV711('is not allowed', 'is allowed'));
  const view = { candidate_id: 'x', content_hash: 'h', body: 'Stem.', options: ['A', 'B', 'C', 'D'].map(key => ({ key, text: key })) };
  assert.equal(validateOptionResolutionV711({ candidate_id: 'x', content_hash: 'h', option_resolution: [] }, view, { evidenceCatalog: [] }).reason, 'v711_all_four_options_required');
});

test('V711 anchoring binds PDF word splits and line-break hyphens but nothing that changes words, numbers or negation', () => {
  assert.ok(containsAnchoredV711('the goal of a retail stor e may be to increase sales', 'the goal of a retail store may be to increase sales'));
  assert.ok(containsAnchoredV711('Different organ - isations have different goals.', 'Different organisations have different goals'));
  assert.ok(containsAnchoredV711('the nature of their inter ­ relationship. This clarifies', 'the nature of their interrelationship'));
  assert.ok(!containsAnchoredV711('the goal of a retail stor e may be to increase sales', 'the goal of a retail store must be to increase sales'));
  assert.ok(!containsAnchoredV711('interest at a rate not exceeding 10% p.a.', 'interest at a rate not exceeding 12% p.a.'));
  assert.ok(!containsAnchoredV711('the librarian did not grade the notes', 'the librarian did grade the notes'));
  assert.ok(!containsAnchoredV711('Different organ - isations have different goals.', 'organisations have the same goals'));
});

test('V711 explanation call carries the deduction clarification; blind calls scope the rival check to classification items', async () => {
  const s = makeScenario(); await s.run();
  const sys = r => r.provider === 'openai' ? r.body.input.find(x => x.role === 'system').content : r.body.systemInstruction.parts[0].text;
  assert.ok(sys(s.requests[2]).includes('V7.11 explanation claims'));
  assert.ok(!sys(s.requests[0]).includes('V7.11 explanation claims'));
  assert.ok(sys(s.requests[0]).includes('(b) Illustration items'));
});

test('V711 compact anchoring never binds a number inside a longer number', () => {
  assert.ok(!containsAnchoredV711('the reserve ratio rises by 10 per cent each year', 'the reserve ratio rises by 1'));
  assert.ok(!containsAnchoredV711('deposits of Rs 1,500 crore were supported', 'deposits of Rs 500 crore were supported'));
  assert.ok(containsAnchoredV711('deposits of Rs 1,5 00 crore were supported', 'deposits of Rs 1,500 crore were supported'));
});

test('V711 non-passage items do not offer passage-only enum values to either solver or the audit', async () => {
  const s = makeScenario(); await s.run();
  const schemaOf = r => r.provider === 'openai' ? r.body.text.format.schema : r.body.generationConfig.responseFormat.text.schema;
  for (const r of s.requests.slice(0, 2)) assert.ok(!schemaOf(r).properties.option_resolution.items.properties.premise_source.enum.includes('passage_scope'));
  assert.ok(!schemaOf(s.requests[2]).properties.resolution_audit.properties.distractors.items.properties.basis.enum.includes('passage_unsupported'));
  assert.ok(schemaOf(s.requests[2]).properties.resolution_audit.properties.distractors.items.properties.basis.enum.includes('not_exhibited_by_case'));
});

test('V711 anchoring is case-insensitive but still word-, number- and negation-exact', () => {
  assert.ok(containsAnchoredV711('The minutes stated that buying new equipment is always wasteful for a club.', 'the minutes stated that buying new equipment is always wasteful'));
  assert.ok(!containsAnchoredV711('The minutes did not state that buying new equipment is wasteful.', 'the minutes stated that buying new equipment is wasteful'));
  assert.ok(!containsAnchoredV711('Interest at 10% p.a. is charged.', 'interest at 12% p.a. is charged'));
});
