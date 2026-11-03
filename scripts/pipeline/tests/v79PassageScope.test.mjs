import test from 'node:test';
import assert from 'node:assert/strict';
import { validateOptionResolutionV79, validateResolutionAuditV79 } from '../lib/optionResolutionV79.mjs';

// r2 passage-scope rule: in a reading question the passage is the universe, so "the passage neither states nor implies this"
// refutes an option, anchored to exact passage words. It never applies to subject-fact items without a passage.
const passage = 'Mira moved the map boxes to the upper shelf whenever the room felt damp. She wrote each move in a ledger so that preventive steps were recorded before any map was damaged.';
const options = ['The records help track preventive steps before damage occurs', 'The donor requires a list of damaged maps',
  'The map boxes cannot be moved without written permission', 'The paper strips are used to write the ledger'].map((text, i) => ({ key: 'ABCD'[i], text }));
const view = { candidate_id: 'p1', content_hash: 'h1', body: 'Why does Mira record a box move even though no map has yet been damaged?', passage, options };
const scope = (option, false_part) => ({ option, status: 'contradicted', false_part, premise_source: 'passage_scope', evidence_id: '',
  premise_quote: 'She wrote each move in a ledger so that preventive steps were recorded before any map was damaged.', reason: 'The passage gives a preventive reason; it never mentions this.' });
const rows = () => [{ option: 'A', status: 'supported', false_part: '', premise_source: 'stem', evidence_id: '',
  premise_quote: 'so that preventive steps were recorded before any map was damaged', reason: 'Stated purpose.' },
  scope('B', 'The donor requires a list'), scope('C', 'without written permission'), scope('D', 'The paper strips are used')];
const result = r => ({ candidate_id: 'p1', content_hash: 'h1', solved_key: 'A', option_resolution: r });

test('passage_scope refutes passage-unsupported options in a reading question', () => {
  assert.deepEqual(validateOptionResolutionV79(result(rows()), view, { evidenceCatalog: [] }), { ok: true, reason: null });
});
test('passage_scope needs exact passage words, not a paraphrase', () => {
  const r = rows(); r[1].premise_quote = 'She recorded every move so preventive steps were logged.';
  assert.equal(validateOptionResolutionV79(result(r), view, { evidenceCatalog: [] }).reason, 'v79_passage_quote_unbound:B');
});
test('passage_scope may support a key from exact passage words but is unavailable without a passage', () => {
  const r = rows(); Object.assign(r[0], { premise_source: 'passage_scope' });
  assert.equal(validateOptionResolutionV79(result(r), view, { evidenceCatalog: [] }).ok, true, 'r3: a passage-anchored quote may support the key');
  const noPassage = { ...view, passage: '' }, r2 = rows();
  r2[0].premise_quote = 'Why does Mira record a box move'; // keep A anchored to the stem so the B row is what fails
  assert.equal(validateOptionResolutionV79(result(r2), noPassage, { evidenceCatalog: [] }).reason, 'v79_passage_scope_without_passage:B');
});
test('an option a fair reader could infer stays unresolved and quarantines', () => {
  const r = rows(); Object.assign(r[2], { status: 'unresolved', premise_source: 'none', premise_quote: '', false_part: '' });
  assert.equal(validateOptionResolutionV79(result(r), view, { evidenceCatalog: [] }).reason, 'v79_unresolved_alternative:C');
});
const frozen = [{ candidate_id: 'p1', content_hash: 'h1', solver: 'openai', solved_key: 'A', rows: [] }, { candidate_id: 'p1', content_hash: 'h1', solver: 'gemini', solved_key: 'A', rows: [] }];
const audit = basis => ({ candidate_id: 'p1', content_hash: 'h1', resolution_audit: { key: 'A', key_fully_supported: true, key_reason: 'Stated.', unexcluded_rival_conditions: [],
  distractors: ['B', 'C', 'D'].map(option => ({ option, decisively_wrong: true, basis, reason: 'Not stated or implied.' })) } });
test('audit accepts passage_unsupported only for passage questions; source_silence stays nondecisive', () => {
  assert.equal(validateResolutionAuditV79(audit('passage_unsupported'), view, { frozen }).ok, true);
  assert.equal(validateResolutionAuditV79(audit('passage_unsupported'), { ...view, passage: null }, { frozen }).reason, 'v79_audit_nondecisive_basis:B:passage_unsupported');
  assert.equal(validateResolutionAuditV79(audit('source_silence'), view, { frozen }).reason, 'v79_audit_nondecisive_basis:B:source_silence');
});
test('r3: passage_scope may cite the passage\'s own registered evidence ID; an unknown ID still fails', () => {
  const catalog = [{ id: 'E3.1', source_id: 'stimulus', locator: 'stimulus', quote: passage }];
  const r = rows(); r[1].evidence_id = 'E3.1';
  assert.equal(validateOptionResolutionV79(result(r), view, { evidenceCatalog: catalog }).ok, true);
  r[2].evidence_id = 'E9.9';
  assert.equal(validateOptionResolutionV79(result(r), view, { evidenceCatalog: catalog }).reason, 'v79_evidence_id_invalid:C');
});
