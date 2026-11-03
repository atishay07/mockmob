import test from 'node:test';
import assert from 'node:assert/strict';
import { preparationValueV76, preparationReasonsV76 } from '../lib/preparationValueV76.mjs';
import { applyPreparationValueV76 } from '../lib/factoryEvidenceV76.mjs';

// These are deterministic software controls, not qualification cases or academic measurement.
const objective = extra => ({ syllabus_unit: 'Unit', objective: 'Apply the syllabus concept to the printed case.', target_term: '', ...extra });
const item = extra => ({ subject: 'business_studies', chapter: 'Planning', question_type: 'conceptual_mcq', difficulty: 'easy', passage_text: '',
  body: 'Which function is illustrated by the printed case?', options: ['Planning', 'Organising', 'Staffing', 'Controlling'], correct_answer: 'A', learning_objective: objective(), ...extra });
const finding = (value, code) => value.findings.find(f => f.code === code);

test('missing or blank objective/unit is a genuine deterministic blocker', () => {
  for (const lo of [undefined, null, [], {}, 'string', { objective: 'x' }, { syllabus_unit: 'u', objective: ' ' }]) {
    const value = preparationValueV76(item({ learning_objective: lo }));
    assert.equal(value.blocking, true);
    assert.deepEqual(preparationReasonsV76(value), ['learning_objective_missing']);
  }
  assert.equal(preparationValueV76(item()).blocking, false);
});

test('lexical target must genuinely occur, avoiding v75 arbitrary common-prefix matches', () => {
  const lexical = item({ subject: 'english', chapter: 'Vocabulary', question_type: 'synonym', body: 'Choose the synonym of pleasant.', options: ['agreeable', 'harsh', 'rigid', 'idle'] });
  for (const target of ['', 'pleasure', 'generous']) {
    const value = preparationValueV76({ ...lexical, learning_objective: objective({ target_term: target }) });
    assert.equal(value.blocking, true, target);
    assert.ok(preparationReasonsV76(value).includes(target ? 'vocabulary_target_absent' : 'vocabulary_target_unstated'));
  }
  assert.equal(preparationValueV76({ ...lexical, learning_objective: objective({ target_term: 'PLEASANT' }) }).blocking, false);
  assert.equal(preparationValueV76(item()).findings.some(f => f.code.startsWith('vocabulary')), false);
});

test('concept-name overlap is legitimate; copying a full keyed factual proposition reveals the key', () => {
  const concept = item({ options: ['Balance of Payments', 'Budget Deficit', 'National Income', 'Money Supply'], learning_objective: objective({ objective: 'Understand Balance of Payments.' }) });
  assert.equal(finding(preparationValueV76(concept), 'learning_objective_reveals_key'), undefined);
  const proposition = 'A debenture acknowledges a debt of the company';
  const leaked = item({ options: [proposition, 'Equity', 'Dividend', 'Tax'], learning_objective: objective({ objective: `Recognise that ${proposition}.` }) });
  assert.equal(finding(preparationValueV76(leaked), 'learning_objective_reveals_key')?.blocking, true);
  assert.equal(finding(preparationValueV76(item({ learning_objective: objective({ objective: 'The correct answer is A.' }) })), 'learning_objective_reveals_key')?.blocking, true);
});

test('all absolute distractors and hard labels remain contextual diagnostics without automatic rejection', () => {
  const value = preparationValueV76(item({ difficulty: 'hard', options: ['A liability is recorded.', 'It always confers ownership.', 'It never creates a debt.', 'Only equity is recorded.'] }), { reasoningSteps: 1 });
  assert.equal(finding(value, 'absolute_distractors')?.blocking, false);
  assert.equal(finding(value, 'difficulty_label_overstated')?.blocking, false);
  assert.equal(value.blocking, false);
  assert.deepEqual(preparationReasonsV76(value), []);
});

test('linking phrases and printed-order keys cannot become blocking through label aggregation', () => {
  const value = preparationValueV76(item({ question_type: 'sequence_ordering', difficulty: 'hard',
    body: 'Arrange the operations.\n(A) Set objectives.\n(B) Then develop premises.\n(C) Following this evaluate alternatives.\n(D) Select the plan.',
    options: ['A-B-C-D', 'B-A-C-D', 'C-B-A-D', 'D-C-B-A'] }), { reasoningSteps: 1 });
  assert.equal(finding(value, 'ordering_cohesion_cue')?.blocking, false);
  assert.equal(finding(value, 'ordering_printed_order_key')?.blocking, false);
  assert.equal(value.blocking, false);
});

test('overlap is diagnostic; a passage can legitimately supply the tested information', () => {
  const repeated = item({ body: 'Planning is deciding in advance the objectives and course of action. What does planning involve?',
    options: ['Deciding in advance the objectives and course of action', 'Monitoring results after completion', 'Recruiting employees', 'Motivating employees'] });
  assert.equal(finding(preparationValueV76(repeated), 'stem_discloses_key')?.blocking, false);
  const supplied = { ...repeated, passage_text: 'Planning is deciding in advance the objectives and course of action.' };
  assert.equal(finding(preparationValueV76(supplied), 'stem_discloses_key'), undefined);
  assert.equal(preparationValueV76(supplied).blocking, false);
});

test('cue-only findings cannot turn a correctness failure into a pass or independently fail fit', () => {
  const cued = item({ difficulty: 'hard', options: ['Liability', 'Always equity', 'Never debt', 'Only capital'] });
  const out = applyPreparationValueV76(cued, { passed: false, source_support: false, reasons: ['wrong_claim'] },
    { checks: { blind_solution: { cuet_fit_result: { reasoning_steps: 1 } } } });
  assert.equal(out.result.passed, false);
  assert.equal(out.result.source_support, false);
  assert.deepEqual(out.result.reasons, ['wrong_claim']);
  assert.equal(out.value.blocking, false);
  assert.equal(applyPreparationValueV76({ ...cued, difficulty: 'easy' }, { passed: true }).result.passed, true);
});
