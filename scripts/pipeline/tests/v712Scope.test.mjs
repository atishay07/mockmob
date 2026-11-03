import test from 'node:test';
import assert from 'node:assert/strict';
import { hashJSON } from '../../../data/question_factory_policy.mjs';
import { createFactoryEvidenceV712, TOPOLOGIES } from '../lib/factoryEvidenceV712.mjs';
import { verifyCandidateV712 } from '../lib/verifyV712.mjs';
import { readingTaskV712, illustrationTaskV712 } from '../lib/questionScopeV712.mjs';

// V7.12 provenance and scope fixes exercised through the REAL adapter seam: both hidden-key blind requests (V7.3 -> V7.6 -> V7.12 request
// adaptation), resolution freezing, the existing explanation/resolution audit call and the verifier. In-memory transport only.
const SECRET = 'offline-v712-scope-secret';

function scenario({ subject, chapter, body, options, key = 'A', passage = '', question_type = 'conceptual_mcq', route = 'conceptual', sourceText, rows, audit = {}, explanation }) {
  const sourceId = 'v712-src', familyId = 'v712-family', packId = 'v712-pack';
  const candidate = { id: 'v712-local', subject, chapter, family_id: familyId, route, question_type, difficulty: 'easy', body, options, correct_answer: key,
    ...(passage ? { passage_text: passage } : {}), explanation: explanation || 'The printed material establishes the key and contradicts each other option.',
    learning_objective: { syllabus_unit: chapter, objective: `Apply ${chapter} concepts to the printed situation.`, target_term: '' },
    provenance: { kind: 'original_practice', adaptation_family: familyId, syllabus_version: 'offline-syllabus', pattern_version: 'offline-pattern', source_pack_id: packId, source_pack_version: 1 },
    source_refs: [{ id: sourceId, version: 1, locator: 'excerpt', support_hash: hashJSON(sourceText) }] };
  const registry = { version: 'offline-v712', examples: [], packs: { [packId]: { state: 'active', version: 1, subject } }, families: { [familyId]: { state: 'active', version: 1 } },
    exam_specs: { [subject]: { state: 'verified', included_topics: [chapter], excluded_topics: [], syllabus_version: 'offline-syllabus', pattern_version: 'offline-pattern', pattern_rules: {}, exam_rule_version: 'offline-rule' } },
    sources: { [sourceId]: { state: 'active', reuse_permitted: true, identity_sha256: 'c'.repeat(64), extraction_checked: true, version: 1,
      supports: { excerpt: hashJSON(sourceText) }, facts: { excerpt: { text: sourceText } }, chapters: [chapter], kind: 'textbook', title: 'Synthetic source', url: 'https://ncert.nic.in/offline-fixture' } } };
  const cache = new Map(), requests = [];
  const ledger = { getCache: k => cache.get(k) ?? null, setCache: (k, v) => cache.set(k, structuredClone(v)) };
  const transport = { async generate(provider, requestBody, requestOptions = {}) {
    requests.push({ provider, body: structuredClone(requestBody), options: { ...requestOptions } });
    const input = JSON.parse(provider === 'openai' ? requestBody.input.find(r => r.role === 'user').content : requestBody.contents.find(r => r.role === 'user').parts[0].text);
    if (requestOptions.stage === 'explanation_support') {
      const solved = input.option_resolutions[0].solved_key;
      const distractors = ['A', 'B', 'C', 'D'].filter(k => k !== solved).map(option => ({ option, decisively_wrong: true, basis: audit.basis || 'direct_contradiction', reason: 'Contradicted.' }));
      return { output_text: JSON.stringify({ candidate_id: input.candidate_id, content_hash: input.content_hash, claims: [{ claim: candidate.explanation, basis: 'excerpt' }], passed: true,
        reasons: ['Offline.'], evidence_ids: ['E1.1'], resolution_audit: { key: solved, key_fully_supported: true, key_reason: 'Established.', unexcluded_rival_conditions: audit.rivals || [], distractors } }) };
    }
    const value = { candidate_id: input.candidate_id, content_hash: input.content_hash, solved_key: key, single_defensible_answer: true, source_support: true, numeric_solution: true,
      boundary_cases: true, passage_integrity: true, passage_answerability: true, meaningfully_distinct: true, evidence_ids: ['E1.1'], reasons: ['Decided by the printed material.'],
      syllabus_chapter: chapter, syllabus_topic: chapter, syllabus_entitlement: true, presentation_ready: true, question_type_match: true, principle_applicability: 'excerpt_required',
      decisive_principle_in_excerpts: true, answer_conditions: [], option_challenges: input.options.filter(o => o.key !== key).map(o => ({ option: o.key,
        strongest_reading: 'This alternative is not what the printed material establishes.', correct_under_reading: false, reading_status: 'strained', convention_evidence_ids: [] })),
      option_resolution: rows(provider, input), blocking_defects: [], style_notes: [],
      cuet_fit: { criteria: Object.fromEntries(['syllabus_objective', 'format_authenticity', 'level_calibration', 'discrimination_value'].map(id => [id, { level: 3, evidence: 'Requires the stated objective.' }])),
        reasoning_steps: 1, estimated_difficulty: 'easy', cognitive_level: 'comprehension', exemplar_ids_compared: [] } };
    return { output_text: JSON.stringify(value) };
  } };
  const adapters = createFactoryEvidenceV712({ registry, ledger, transport, topology: TOPOLOGIES.dual_blind });
  return { requests, run: () => verifyCandidateV712(candidate, { registry, ledger, adapters, topology: TOPOLOGIES.dual_blind, secret: SECRET }) };
}
const row = (option, status, premise_source, premise_quote, false_part = '', evidence_id = '') => ({ option, status, false_part, premise_source, evidence_id, premise_quote, reason: 'Printed material decides it.' });
const reasonsOf = r => JSON.stringify([r.reasons, r.failure_details]);

// ---- 1. Quotation provenance through the adapter --------------------------------------------------------------------------
const cfRule = 'Cash receipts from the sale of goods are cash flows from operat-\ning activities.';
const cfText = `${cfRule}\nThe officer is now here today. The officer will re-sign tomorrow.`;
const cfBase = { subject: 'accountancy', chapter: 'Cash Flow Statement', body: 'A garment retailer receives cash from customers for garments it sells. Classify this cash flow.',
  options: ['Operating activity', 'Investing activity', 'Financing activity', 'No cash flow'].map((text, i) => ({ key: 'ABCD'[i], text })), sourceText: cfText };
const cfRows = override => () => [row('A', 'supported', 'excerpt', 'Cash receipts from the sale of goods are cash flows from operating activities', '', 'E1.1'),
  row('B', 'contradicted', 'excerpt', override?.B || 'Cash receipts from the sale of goods are cash flows from operating activities', 'Investing', 'E1.1'),
  row('C', 'contradicted', 'excerpt', override?.C || 'Cash receipts from the sale of goods are cash flows from operating activities', 'Financing', 'E1.1'),
  row('D', 'contradicted', 'stem', 'receives cash from customers', 'No cash flow')];

test('V712 adapter: a genuine line-end hyphen in the registered source still binds ("operat-\\ning" = "operating")', async () => {
  const r = await scenario({ ...cfBase, rows: cfRows() }).run();
  assert.equal(r.state, 'eligible', reasonsOf(r));
});
test('V712 adapter: "nowhere" never binds to source "now here"', async () => {
  const r = await scenario({ ...cfBase, rows: cfRows({ B: 'The officer is nowhere today' }) }).run();
  assert.equal(r.state, 'quarantined'); assert.match(reasonsOf(r), /v712_excerpt_quote_unbound:B/);
});
test('V712 adapter: "resign" never binds to source "re-sign"', async () => {
  const r = await scenario({ ...cfBase, rows: cfRows({ C: 'The officer will resign tomorrow' }) }).run();
  assert.equal(r.state, 'quarantined'); assert.match(reasonsOf(r), /v712_excerpt_quote_unbound:C/);
});

// ---- 2. Illustration scope ----------------------------------------------------------------------------------------------
const pervasive = 'The activities involved in managing an enterprise are common to all organisations whether economic, social or political.';
const illus = { subject: 'business_studies', chapter: 'Nature & Significance of Management', question_type: 'case_application',
  body: 'A petrol pump owner in India and a school principal in Japan carry out the same managerial activities. Which feature of management does this situation best illustrate?',
  options: ['Management is all pervasive', 'Management is a continuous process', 'Management is a group activity', 'Management is goal-oriented'].map((text, i) => ({ key: 'ABCD'[i], text })),
  sourceText: `${pervasive}\nThe process of management is a series of continuous functions.` };
const illusRows = (src = 'case_scope') => () => [row('A', 'supported', 'excerpt', pervasive, '', 'E1.1'),
  ...['B', 'C', 'D'].map(k => row(k, 'contradicted', src, 'carry out the same managerial activities', illus.options.find(o => o.key === k).text.replace('Management is ', ''), ''))];

test('V712 detector: illustration vs classification vs reading tasks', () => {
  assert.equal(illustrationTaskV712({ subject: 'business_studies', body: illus.body }), true);
  assert.equal(illustrationTaskV712({ subject: 'economics', body: 'A government records two receipts. How should these receipts be classified?' }), false);
  assert.equal(illustrationTaskV712({ subject: 'business_studies', body: 'Which statement about staffing is correct?' }), false);
  assert.equal(readingTaskV712({ subject: 'english', question_type: 'reading_comprehension', passage: 'Text.', body: 'Why did Mira wait?' }), true);
  assert.equal(readingTaskV712({ subject: 'economics', question_type: 'case_application', passage: 'Data table.', body: 'Calculate the deficit.' }), false);
  assert.equal(readingTaskV712({ subject: 'economics', question_type: 'case_application', passage: 'Report.', body: 'According to the passage, why did prices rise?' }), true);
});
test('V712 adapter: case_scope + not_exhibited_by_case accepted for a genuine illustration item', async () => {
  const s = scenario({ ...illus, rows: illusRows(), audit: { basis: 'not_exhibited_by_case' } }), r = await s.run();
  assert.equal(r.state, 'eligible', reasonsOf(r));
  const schema = s.requests[0].body.text.format.schema;
  assert.ok(schema.properties.option_resolution.items.properties.premise_source.enum.includes('case_scope'));
});
test('V712 adapter: source silence and category labels still cannot eliminate an illustration rival', async () => {
  for (const basis of ['source_silence', 'category_only']) {
    const r = await scenario({ ...illus, rows: illusRows(), audit: { basis } }).run();
    assert.equal(r.state, 'quarantined'); assert.match(reasonsOf(r), new RegExp(`v712_audit_nondecisive_basis:B:${basis}`));
  }
});
test('V712 adapter: a second exhibited answer in an illustration item quarantines (solver and audit paths)', async () => {
  const two = () => { const rr = illusRows()(); rr[1] = row('B', 'supported', 'excerpt', pervasive, '', 'E1.1'); return rr; };
  const a = await scenario({ ...illus, rows: two, audit: { basis: 'not_exhibited_by_case' } }).run();
  assert.equal(a.state, 'quarantined'); assert.match(reasonsOf(a), /v712_multiple_supported_options:AB/);
  const b = await scenario({ ...illus, rows: illusRows(), audit: { basis: 'not_exhibited_by_case', rivals: ['B: the case also shows functions performed continuously'] } }).run();
  assert.equal(b.state, 'quarantined'); assert.match(reasonsOf(b), /v712_audit_unexcluded_rival_condition/);
});

// ---- 3. Classification items never get case scope -------------------------------------------------------------------------
const receipts = 'Revenue receipts are those receipts that do not lead to a claim on the government. Capital receipts create liabilities or reduce financial assets.';
const classify = { subject: 'economics', chapter: 'Government Budget & the Economy', question_type: 'conceptual_mcq',
  body: 'A government records a tax receipt that does not lead to any claim on the government and does not reduce its assets. How should this receipt be classified?',
  options: ['Revenue receipt', 'Capital receipt', 'Borrowing', 'Disinvestment'].map((text, i) => ({ key: 'ABCD'[i], text })), sourceText: receipts };
test('V712 adapter: case_scope is refused on a classification item, and the audit may not use not_exhibited_by_case there', async () => {
  const caseRows = () => [row('A', 'supported', 'excerpt', 'Revenue receipts are those receipts that do not lead to a claim on the government', '', 'E1.1'),
    ...['B', 'C', 'D'].map(k => row(k, 'contradicted', 'case_scope', 'does not reduce its assets', classify.options.find(o => o.key === k).text))];
  const s = scenario({ ...classify, rows: caseRows }), r = await s.run();
  assert.equal(r.state, 'quarantined'); assert.match(reasonsOf(r), /v712_case_scope_not_illustration_task:B/);
  assert.ok(!s.requests[0].body.text.format.schema.properties.option_resolution.items.properties.premise_source.enum.includes('case_scope'));
  const goodRows = () => [row('A', 'supported', 'excerpt', 'Revenue receipts are those receipts that do not lead to a claim on the government', '', 'E1.1'),
    ...['B', 'C', 'D'].map(k => row(k, 'contradicted', 'stem', 'does not lead to any claim on the government and does not reduce its assets', classify.options.find(o => o.key === k).text))];
  const t = await scenario({ ...classify, rows: goodRows, audit: { basis: 'not_exhibited_by_case' } }).run();
  assert.equal(t.state, 'quarantined'); assert.match(reasonsOf(t), /v712_audit_nondecisive_basis:B:not_exhibited_by_case/);
});

// ---- 4. Passage scope needs a reading task --------------------------------------------------------------------------------
const report = 'Exports were Rs 120 crore and imports were Rs 150 crore in the year.';
test('V712 adapter: a passage present in a calculation item does not license passage_scope refutations', async () => {
  const eco = { subject: 'economics', chapter: 'Balance of Payments', question_type: 'numerical_calculation', route: 'passage', passage: report,
    body: 'Using the data, what is the trade balance?', options: ['Deficit of Rs 30 crore', 'Surplus of Rs 30 crore', 'Deficit of Rs 270 crore', 'Surplus of Rs 270 crore'].map((text, i) => ({ key: 'ABCD'[i], text })),
    sourceText: 'Net exports equal exports minus imports; negative net exports imply a trade deficit.' };
  const rows = () => [row('A', 'supported', 'arithmetic', 'Exports were Rs 120 crore and imports were Rs 150 crore'),
    ...['B', 'C', 'D'].map(k => row(k, 'contradicted', 'passage_scope', 'Exports were Rs 120 crore and imports were Rs 150 crore', eco.options.find(o => o.key === k).text))];
  const r = await scenario({ ...eco, rows }).run();
  assert.equal(r.state, 'quarantined'); assert.match(reasonsOf(r), /v712_passage_scope_not_reading_task:B/);
});
test('V712 adapter: a reading item with an implicit (inferred) key and passage-scope refutations is accepted', async () => {
  const passage = 'Each Friday the students returned at least one book and wrote a short note about it. The librarian recorded returns but did not grade the notes.';
  const eng = { subject: 'english', chapter: 'Factual Passage', question_type: 'reading_comprehension', route: 'passage', passage, sourceText: passage,
    body: 'What can be inferred about the students\' notes?', options: ['They were not graded', 'They decided who could borrow', 'They were read aloud', 'They replaced the records'].map((text, i) => ({ key: 'ABCD'[i], text })) };
  const rows = () => [row('A', 'supported', 'passage_scope', 'did not grade the notes'),
    row('B', 'contradicted', 'passage_scope', 'The librarian recorded returns but did not grade the notes', 'decided who could borrow'),
    row('C', 'contradicted', 'passage_scope', 'wrote a short note about it', 'were read aloud'),
    row('D', 'contradicted', 'passage_scope', 'The librarian recorded returns', 'replaced the records')];
  const r = await scenario({ ...eng, rows, audit: { basis: 'passage_unsupported' } }).run();
  assert.equal(r.state, 'eligible', reasonsOf(r));
});
