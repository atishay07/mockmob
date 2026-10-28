import test from 'node:test';
import assert from 'node:assert/strict';
import { validateOptionResolutionV712, validateResolutionAuditV712 } from '../lib/optionResolutionV712.mjs';

// r2 passage-scope rule: in a reading question the passage is the universe, so "the passage neither states nor implies this"
// refutes an option, anchored to exact passage words. It never applies to subject-fact items without a passage.
const passage = 'Mira moved the map boxes to the upper shelf whenever the room felt damp. She wrote each move in a ledger so that preventive steps were recorded before any map was damaged.';
const options = ['The records help track preventive steps before damage occurs', 'The donor requires a list of damaged maps',
  'The map boxes cannot be moved without written permission', 'The paper strips are used to write the ledger'].map((text, i) => ({ key: 'ABCD'[i], text }));
// V7.12: a reading task needs the subject and item type (passage presence alone does not license passage scope).
const view = { candidate_id: 'p1', content_hash: 'h1', subject: 'english', question_type: 'reading_comprehension', body: 'Why does Mira record a box move even though no map has yet been damaged?', passage, options };
const scope = (option, false_part) => ({ option, status: 'contradicted', false_part, premise_source: 'passage_scope', evidence_id: '',
  premise_quote: 'She wrote each move in a ledger so that preventive steps were recorded before any map was damaged.', reason: 'The passage gives a preventive reason; it never mentions this.' });
const rows = () => [{ option: 'A', status: 'supported', false_part: '', premise_source: 'stem', evidence_id: '',
  premise_quote: 'so that preventive steps were recorded before any map was damaged', reason: 'Stated purpose.' },
  scope('B', 'The donor requires a list'), scope('C', 'without written permission'), scope('D', 'The paper strips are used')];
const result = r => ({ candidate_id: 'p1', content_hash: 'h1', solved_key: 'A', option_resolution: r });

test('passage_scope refutes passage-unsupported options in a reading question', () => {
  assert.deepEqual(validateOptionResolutionV712(result(rows()), view, { evidenceCatalog: [] }), { ok: true, reason: null });
});
test('passage_scope needs exact passage words, not a paraphrase', () => {
  const r = rows(); r[1].premise_quote = 'She recorded every move so preventive steps were logged.';
  assert.equal(validateOptionResolutionV712(result(r), view, { evidenceCatalog: [] }).reason, 'v712_passage_quote_unbound:B');
});
test('passage_scope may support a key from exact passage words but is unavailable without a passage', () => {
  const r = rows(); Object.assign(r[0], { premise_source: 'passage_scope' });
  assert.equal(validateOptionResolutionV712(result(r), view, { evidenceCatalog: [] }).ok, true, 'r3: a passage-anchored quote may support the key');
  const noPassage = { ...view, passage: '' }, r2 = rows();
  r2[0].premise_quote = 'Why does Mira record a box move'; // keep A anchored to the stem so the B row is what fails
  assert.equal(validateOptionResolutionV712(result(r2), noPassage, { evidenceCatalog: [] }).reason, 'v712_passage_scope_without_passage:B');
});
test('an option a fair reader could infer stays unresolved and quarantines', () => {
  const r = rows(); Object.assign(r[2], { status: 'unresolved', premise_source: 'none', premise_quote: '', false_part: '' });
  assert.equal(validateOptionResolutionV712(result(r), view, { evidenceCatalog: [] }).reason, 'v712_unresolved_alternative:C');
});
const frozen = [{ candidate_id: 'p1', content_hash: 'h1', solver: 'openai', solved_key: 'A', rows: [] }, { candidate_id: 'p1', content_hash: 'h1', solver: 'gemini', solved_key: 'A', rows: [] }];
const audit = basis => ({ candidate_id: 'p1', content_hash: 'h1', resolution_audit: { key: 'A', key_fully_supported: true, key_reason: 'Stated.', unexcluded_rival_conditions: [],
  distractors: ['B', 'C', 'D'].map(option => ({ option, decisively_wrong: true, basis, reason: 'Not stated or implied.' })) } });
test('audit accepts passage_unsupported only for passage questions; source_silence stays nondecisive', () => {
  assert.equal(validateResolutionAuditV712(audit('passage_unsupported'), view, { frozen }).ok, true);
  assert.equal(validateResolutionAuditV712(audit('passage_unsupported'), { ...view, passage: null }, { frozen }).reason, 'v712_audit_nondecisive_basis:B:passage_unsupported');
  assert.equal(validateResolutionAuditV712(audit('source_silence'), view, { frozen }).reason, 'v712_audit_nondecisive_basis:B:source_silence');
});
test('r3: passage_scope may cite the passage\'s own registered evidence ID; an unknown ID still fails', () => {
  const catalog = [{ id: 'E3.1', source_id: 'stimulus', locator: 'stimulus', quote: passage }];
  const r = rows(); r[1].evidence_id = 'E3.1';
  assert.equal(validateOptionResolutionV712(result(r), view, { evidenceCatalog: catalog }).ok, true);
  r[2].evidence_id = 'E9.9';
  assert.equal(validateOptionResolutionV712(result(r), view, { evidenceCatalog: catalog }).reason, 'v712_evidence_id_invalid:C');
});

// case_scope: illustration items treat the printed case as the universe (refutation only, exact stem words).
const caseView = { candidate_id: 'c1', content_hash: 'hc', subject: 'business_studies', body: 'A petrol pump owner in India and a school principal in Japan carry out the same managerial activities. Which feature of management does this best illustrate?',
  options: ['Management is a continuous process', 'Management is a group activity', 'Management is goal-oriented', 'Management is all pervasive'].map((text, i) => ({ key: 'ABCD'[i], text })) };
const caseRows = () => ['A', 'B', 'C'].map(option => ({ option, status: 'contradicted', false_part: caseView.options.find(o => o.key === option).text.replace('Management is ', ''),
  premise_source: 'case_scope', evidence_id: '', premise_quote: 'carry out the same managerial activities', reason: 'The case shows common activities across organisations, not this feature.' }))
  .concat([{ option: 'D', status: 'supported', false_part: '', premise_source: 'stem', evidence_id: '', premise_quote: 'A petrol pump owner in India and a school principal in Japan carry out the same managerial activities', reason: 'Common to all organisations.' }]);
test('case_scope refutes not-exhibited features from exact stem words; never supports and never binds paraphrase', () => {
  const ok = { candidate_id: 'c1', content_hash: 'hc', solved_key: 'D', option_resolution: caseRows() };
  assert.equal(validateOptionResolutionV712(ok, caseView, { evidenceCatalog: [] }).ok, true);
  const para = caseRows(); para[0].premise_quote = 'they perform similar management everywhere';
  assert.equal(validateOptionResolutionV712({ ...ok, option_resolution: para }, caseView, { evidenceCatalog: [] }).reason, 'v712_case_quote_unbound:A');
  const sup = caseRows(); sup[3].premise_source = 'case_scope';
  assert.equal(validateOptionResolutionV712({ ...ok, option_resolution: sup }, caseView, { evidenceCatalog: [] }).reason, 'v712_case_scope_only_refutes:D');
});
test('audit accepts not_exhibited_by_case; source_silence and category_only remain nondecisive', () => {
  const fr = [{ candidate_id: 'c1', content_hash: 'hc', solver: 'openai', solved_key: 'D', rows: [] }, { candidate_id: 'c1', content_hash: 'hc', solver: 'gemini', solved_key: 'D', rows: [] }];
  const a = basis => ({ candidate_id: 'c1', content_hash: 'hc', resolution_audit: { key: 'D', key_fully_supported: true, key_reason: 'x', unexcluded_rival_conditions: [],
    distractors: ['A', 'B', 'C'].map(option => ({ option, decisively_wrong: true, basis, reason: 'x' })) } });
  assert.equal(validateResolutionAuditV712(a('not_exhibited_by_case'), caseView, { frozen: fr }).ok, true);
  assert.equal(validateResolutionAuditV712(a('category_only'), caseView, { frozen: fr }).reason, 'v712_audit_nondecisive_basis:A:category_only');
});
