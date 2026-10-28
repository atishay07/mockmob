import test from 'node:test';
import assert from 'node:assert/strict';
import { guardRepairRoute, normalizeStatementSelectionOptions, parseStatementSelectionOption } from '../lib/candidateFormatVNext.mjs';

const failureExamples = [
  {
    id: 'be766fde7b94898b8a08176e26b8e698',
    options: ['(A) only', '(B) and (C) only', '(B) and (D) only', '(C) and (D) only'],
    expected: ['Statement A only', 'Statements B and C only', 'Statements B and D only', 'Statements C and D only'],
    sets: [['A'], ['B', 'C'], ['B', 'D'], ['C', 'D']]
  },
  {
    id: '6a36cd09ebd9dd30606310b808c0bc18',
    options: ['(A) (B) and (D) only', '(B) (B) and (C) only', '(C) (A) only', '(D) (C) and (D) only'],
    expected: ['Statements B and D only', 'Statements B and C only', 'Statement A only', 'Statements C and D only'],
    sets: [['B', 'D'], ['B', 'C'], ['A'], ['C', 'D']]
  }
];

test('normalizes only complete statement sets and preserves semantic sets and non-option data', () => {
  for (const example of failureExamples) {
    const original = {
      candidate_id: example.id,
      question_type: 'statement_selection',
      body: 'Select the correct statements.',
      options: example.options,
      correct_answer: 'B',
      explanation: 'Evidence-backed explanation.',
      route: 'conceptual',
      source_refs: ['registered-source-1'],
      evidence_quotes: ['Exact source excerpt.'],
      stated_assumptions: ['No additional assumption.'],
      option_analysis: ['A', 'B', 'C', 'D']
    };
    const result = normalizeStatementSelectionOptions(original);
    assert.equal(result.changed, true, example.id);
    assert.deepEqual(result.candidate.options, example.expected, example.id);
    assert.deepEqual(result.candidate.options.map((option, index) => parseStatementSelectionOption(option, index).letters), example.sets);
    const { options: _oldOptions, ...originalFields } = original;
    const { options: _newOptions, ...normalizedFields } = result.candidate;
    assert.deepEqual(normalizedFields, originalFields, 'key, stem, evidence, assumptions, and other fields remain unchanged');
    assert.deepEqual(original.options, example.options, 'input object remains unchanged');
  }
});

test('does not guess when a leading label may be legitimate option meaning', () => {
  const candidate = {
    question_type: 'statement_selection',
    body: 'Choose the correct statement set.',
    options: ['(A) is the first valid proposition', '(B) and (C) only', '(B) and (D) only', '(C) and (D) only'],
    correct_answer: 'A',
    route: 'conceptual'
  };
  const result = normalizeStatementSelectionOptions(candidate);
  assert.equal(result.changed, false);
  assert.equal(result.reason, 'statement_set_parse_failed');
  assert.equal(result.candidate, candidate);
});

test('does not normalize non-target types, invalid keys, duplicate letters, or malformed combinations', () => {
  const base = { question_type: 'statement_selection', body: 'Select.', options: ['(A) only', '(B) and (C) only', '(B) and (D) only', '(C) and (D) only'], correct_answer: 'A' };
  assert.equal(normalizeStatementSelectionOptions({ ...base, question_type: 'conceptual_mcq' }).reason, 'not_statement_selection');
  assert.equal(normalizeStatementSelectionOptions({ ...base, correct_answer: 'E' }).reason, 'answer_key_invalid');
  assert.equal(parseStatementSelectionOption('(A) and (A) only', 0), null);
  const malformed = { ...base, options: ['(A) with an explanation', '(B) and (C) only', '(B) and (D) only', '(C) and (D) only'] };
  const result = normalizeStatementSelectionOptions(malformed);
  assert.equal(result.changed, false);
  assert.equal(result.reason, 'statement_set_parse_failed');
});

test('repair route guard rejects route changes rather than rewriting routes or assumptions', () => {
  const original = { route: 'conceptual', passage_text: '', stated_assumptions: ['fixed'] };
  const proposed = { route: 'passage', passage_text: '', stated_assumptions: [] };
  assert.deepEqual(guardRepairRoute(original, proposed), { allowed: false, reason: 'repair_route_change_requires_rebuild' });
  assert.deepEqual(original, { route: 'conceptual', passage_text: '', stated_assumptions: ['fixed'] });
  assert.deepEqual(proposed, { route: 'passage', passage_text: '', stated_assumptions: [] });
});

test('repair route guard blocks orphan passage and passage-text invention/change', () => {
  const orphan = { route: 'passage', passage_text: '' };
  assert.deepEqual(guardRepairRoute(orphan, orphan), { allowed: false, reason: 'orphan_passage_route_without_source_passage' });
  const sourced = { route: 'passage', passage_text: 'Registered source passage.' };
  assert.deepEqual(guardRepairRoute(sourced, { ...sourced, passage_text: 'Invented replacement passage.' }), {
    allowed: false, reason: 'repair_passage_text_change_requires_rebuild'
  });
  assert.deepEqual(guardRepairRoute(orphan, { ...orphan, passage_text: 'Invented passage.' }), {
    allowed: false, reason: 'orphan_passage_route_without_source_passage'
  });
});

test('unchanged standalone non-passage and grouped passage routes are allowed', () => {
  assert.deepEqual(guardRepairRoute({ route: 'numerical', passage_text: '' }, { route: 'numerical', passage_text: '' }), { allowed: true, reason: null });
  const groupItem = { route: 'passage', passage_text: '' };
  assert.deepEqual(guardRepairRoute(groupItem, { ...groupItem }, { passageGroupId: 'registered-group' }), { allowed: true, reason: null });
});
