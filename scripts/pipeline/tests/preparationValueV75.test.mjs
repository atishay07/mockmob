import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { preparationValueV75, preparationReasonsV75 } from '../lib/preparationValueV75.mjs';

// Campaign C outputs (generated under the older v7.2 validator) are REGRESSION fixtures only: they show what the new
// deterministic checks would have caught. They are not fresh evidence and not a measurement of v7.5 quality.
const FILE = 'artifacts/question-factory/cuet-readiness-cost-source-c-100-2026-10-08/all-candidates.json';
const available = existsSync(FILE);
const rows = available ? JSON.parse(readFileSync(FILE, 'utf8')) : [];
const objective = (extra = {}) => ({ syllabus_unit: 'Official syllabus unit', objective: 'Apply the stated syllabus concept to the case.', target_term: '', why_answer_requires_it: 'The student must use the concept.', ...extra });
const fixture = (id, lo = objective()) => ({ ...rows.find(r => r.id === id).candidate, learning_objective: lo });
const codes = value => value.findings.map(f => f.code).sort();
const find = (value, code) => value.findings.find(f => f.code === code);
const skip = available ? false : 'campaign C candidate file is not present';

test('regression: vocabulary item that never uses the target word is blocked (f1d2a614)', { skip }, () => {
  const absent = preparationValueV75(fixture('f1d2a614a08057702839bbab5cf72b1b', objective({ target_term: 'sceptical' })));
  assert.equal(absent.blocking, true);
  assert.equal(find(absent, 'vocabulary_target_absent')?.blocking, true);
  assert.equal(find(absent, 'difficulty_label_overstated')?.blocking, true, 'hard label with a finding');
  const unstated = preparationValueV75(fixture('f1d2a614a08057702839bbab5cf72b1b'));
  assert.equal(find(unstated, 'vocabulary_target_unstated')?.blocking, true);
});

test('regression: ordering solvable from linking words is blocked (21becfa4)', { skip }, () => {
  const value = preparationValueV75(fixture('21becfa473f5c0f8b609fe3769c2becc'));
  assert.equal(find(value, 'ordering_cohesion_cue')?.blocking, true);
  assert.match(find(value, 'ordering_cohesion_cue').basis, /3 steps/);
  assert.equal(find(value, 'ordering_printed_order_key')?.blocking, false, 'the A-B-C-D key is only a cue');
  assert.equal(find(value, 'difficulty_label_overstated')?.blocking, true);
});

test('regression: stem that states the keyed statements is blocked (31f50e51)', { skip }, () => {
  const value = preparationValueV75(fixture('31f50e5123b09da55650472d1a55d36c'));
  assert.equal(value.blocking, true);
  assert.equal(find(value, 'stem_discloses_key')?.blocking, true);
  assert.deepEqual(preparationReasonsV75(value), ['stem_discloses_key']);
});

test('regression: hard label with conspicuous absolute distractors is blocked (e47679b2)', { skip }, () => {
  const value = preparationValueV75(fixture('e47679b2c01f3777ef9b29d7b124f52c'));
  assert.equal(find(value, 'absolute_distractors')?.blocking, true);
  assert.equal(find(value, 'difficulty_label_overstated')?.blocking, true);
});

test('negative controls: sound numericals and legitimate passage questions have no blocking finding', { skip }, () => {
  for (const id of ['41bdeb67f4f7ef1bed646c7637804117', 'b7be101284d349b74625e1f006c7644c', '1e8d77c5ca2b35b652cf04eff792992e',
    'c284cb76871a532af1edb5400c3e1284', 'a56ed0d2f5b0218a08612316bd5e8c05', '41f6b92473273d735f965b911b837acc']) {
    const value = preparationValueV75(fixture(id), { reasoningSteps: 2 });
    assert.equal(value.blocking, false, `${id}: ${JSON.stringify(value.findings)}`);
    assert.deepEqual(value.findings, [], id);
  }
});

test('learning objective is required, must be key-free, and diagnostics can switch the objective rules off', () => {
  const base = { subject: 'accountancy', chapter: 'Debentures', question_type: 'conceptual_mcq', body: 'Which statement about debentures is correct?', difficulty: 'easy',
    options: ['A debenture acknowledges a debt of the company.', 'A debenture gives ownership of the company.', 'A debenture carries a dividend.', 'A debenture has no fixed term.'], correct_answer: 'A', passage_text: '' };
  for (const lo of [undefined, null, 'text', [], {}, { objective: 'x' }, { syllabus_unit: 'u', objective: '  ' }]) {
    assert.equal(find(preparationValueV75({ ...base, learning_objective: lo }), 'learning_objective_missing')?.blocking, true, JSON.stringify(lo));
  }
  assert.equal(preparationValueV75({ ...base, learning_objective: objective() }).blocking, false);
  const reveals = preparationValueV75({ ...base, learning_objective: objective({ objective: 'Recognise that a debenture acknowledges a debt of the company.' }) });
  assert.equal(find(reveals, 'learning_objective_reveals_key')?.blocking, true);
  const short = preparationValueV75({ ...base, options: ['Debt', ...base.options.slice(1)], learning_objective: objective({ objective: 'Understand debt.' }) });
  assert.equal(find(short, 'learning_objective_reveals_key'), undefined, 'keyed options under three words are never matched');
  const skipped = preparationValueV75(base, { objectiveRules: false });
  assert.equal(skipped.findings.length, 0);
  assert.deepEqual(skipped.not_applicable, ['learning_objective_missing', 'learning_objective_reveals_key', 'vocabulary_target_unstated', 'vocabulary_target_absent']);
});

test('lexical English items must name and test the target word, allowing inflection', () => {
  const lexical = { subject: 'english', chapter: 'Vocabulary', question_type: 'synonym', difficulty: 'easy', passage_text: '',
    body: 'Choose the word closest in meaning to "benevolent".', options: ['kind', 'cruel', 'idle', 'rigid'], correct_answer: 'A' };
  assert.equal(find(preparationValueV75({ ...lexical, learning_objective: objective({ target_term: '' }) }), 'vocabulary_target_unstated')?.blocking, true);
  assert.equal(find(preparationValueV75({ ...lexical, learning_objective: objective({ target_term: 'generous' }) }), 'vocabulary_target_absent')?.blocking, true);
  assert.equal(preparationValueV75({ ...lexical, learning_objective: objective({ target_term: 'benevolent' }) }).blocking, false);
  assert.equal(preparationValueV75({ ...lexical, body: 'Choose the word closest in meaning to "benevolence".', learning_objective: objective({ target_term: 'benevolent' }) }).blocking, false, 'inflected form');
  assert.equal(preparationValueV75({ ...lexical, chapter: 'Correct Word Usage', question_type: 'correct_word_usage', learning_objective: objective({ target_term: 'BENEVOLENT' }) }).blocking, false, 'case-insensitive');
  const other = { ...lexical, subject: 'business_studies', chapter: 'Planning', question_type: 'conceptual_mcq' };
  assert.equal(find(preparationValueV75({ ...other, learning_objective: objective() }), 'vocabulary_target_unstated'), undefined, 'only English lexical items');
});

test('ordering cohesion applies to Commerce subjects, not English Para Jumbles; one cue is non-blocking', () => {
  const steps = lines => `Arrange the steps in order.\n${lines.map((s, i) => `(${'ABCD'[i]}) ${s}`).join('\n')}\nChoose the correct sequence.`;
  const options = ['B-A-C-D', 'A-B-C-D', 'A-C-B-D', 'D-C-B-A'];
  const base = { chapter: 'Planning', question_type: 'sequence_ordering', difficulty: 'easy', options, correct_answer: 'A', passage_text: '', learning_objective: objective() };
  const plain = ['Set objectives.', 'Develop premises.', 'Identify alternatives.', 'Select the best plan.'];
  const one = preparationValueV75({ ...base, subject: 'business_studies', body: steps([plain[0], 'Then develop premises.', plain[2], plain[3]]) });
  assert.equal(find(one, 'ordering_cohesion_cue')?.blocking, false);
  const two = preparationValueV75({ ...base, subject: 'economics', body: steps([plain[0], 'Then develop premises.', 'Next identify alternatives.', plain[3]]) });
  assert.equal(find(two, 'ordering_cohesion_cue')?.blocking, true);
  const english = preparationValueV75({ ...base, subject: 'english', chapter: 'Para Jumbles', body: steps([plain[0], 'This develops premises.', 'Then identify alternatives.', plain[3]]) });
  assert.equal(find(english, 'ordering_cohesion_cue'), undefined);
  assert.equal(find(preparationValueV75({ ...base, subject: 'accountancy', body: steps(plain) }), 'ordering_printed_order_key'), undefined, 'keyed order B-A-C-D is not the printed order');
  assert.equal(find(preparationValueV75({ ...base, subject: 'accountancy', correct_answer: 'B', body: steps(plain) }), 'ordering_printed_order_key')?.blocking, false);
});

test('single-option stems that state the answer are blocked; numeric keys and passages are exempt', () => {
  const base = { subject: 'business_studies', chapter: 'Planning', question_type: 'conceptual_mcq', difficulty: 'easy', passage_text: '', learning_objective: objective(),
    body: 'Planning is the process of deciding in advance the objectives and the course of action before work begins. What does planning involve?',
    options: ['Deciding in advance the objectives and course of action', 'Controlling results after completion', 'Recruiting skilled employees', 'Motivating the workforce'], correct_answer: 'A' };
  assert.equal(find(preparationValueV75(base), 'stem_discloses_key')?.blocking, true);
  assert.equal(find(preparationValueV75({ ...base, passage_text: 'Planning is the process of deciding in advance what to do.' }), 'stem_discloses_key'), undefined);
  assert.equal(find(preparationValueV75({ ...base, question_type: 'reading_comprehension' }), 'stem_discloses_key'), undefined);
  const numeric = { ...base, body: 'A firm sells 40 units at Rs 25. What does it receive in total?', options: ['Rs 1,000', 'Rs 65', 'Rs 640', 'Rs 100'] };
  assert.equal(find(preparationValueV75(numeric), 'stem_discloses_key'), undefined);
  const hidden = { ...base, body: 'Which activity belongs to the first managerial function?' };
  assert.equal(find(preparationValueV75(hidden), 'stem_discloses_key'), undefined, 'a stem that does not state the key is fine');
});

test('absolute distractors: two are a cue, all are blocking, and "only" in a letter combination is ignored', () => {
  const base = { subject: 'accountancy', chapter: 'Debentures', question_type: 'conceptual_mcq', difficulty: 'easy', passage_text: '', learning_objective: objective(), body: 'Which statement is correct?', correct_answer: 'A' };
  const two = preparationValueV75({ ...base, options: ['It records a liability.', 'It always changes ownership.', 'It never involves interest.', 'It may carry interest.'] });
  assert.equal(find(two, 'absolute_distractors')?.blocking, false);
  const all = preparationValueV75({ ...base, options: ['It records a liability.', 'It always changes ownership.', 'It never involves interest.', 'It is solely a share.'] });
  assert.equal(find(all, 'absolute_distractors')?.blocking, true);
  const keyAbsolute = preparationValueV75({ ...base, options: ['It never changes ownership.', 'It always changes ownership.', 'It never involves interest.', 'It is solely a share.'] });
  assert.equal(find(keyAbsolute, 'absolute_distractors'), undefined, 'absolutes in the key remove the cue');
  const combos = preparationValueV75({ ...base, body: 'Statements:\n(A) It records a liability.\n(B) It changes ownership.\n(C) It has interest.\n(D) It is equity.\nChoose.', options: ['(A) and (C) only', '(A) and (B) only', '(B) and (D) only', '(C) and (D) only'] });
  assert.equal(find(combos, 'absolute_distractors'), undefined);
});

test('generic economics arithmetic is a non-blocking cue only for economics numericals', () => {
  const base = { subject: 'economics', chapter: 'Money & Banking', question_type: 'numerical_calculation', difficulty: 'easy', passage_text: '', learning_objective: objective(), correct_answer: 'A' };
  const generic = preparationValueV75({ ...base, body: 'A number is 40 and another is 25. What is their sum?', options: ['65', '15', '1,000', '45'] });
  assert.equal(find(generic, 'generic_economics_arithmetic')?.blocking, false);
  const concept = preparationValueV75({ ...base, body: 'If the marginal propensity to consume is 0.8, what is the investment multiplier?', options: ['5', '4', '8', '0.8'] });
  assert.equal(find(concept, 'generic_economics_arithmetic'), undefined);
  assert.equal(find(preparationValueV75({ ...base, subject: 'accountancy', body: 'A number is 40 and another is 25. What is their sum?', options: ['65', '15', '1,000', '45'] }), 'generic_economics_arithmetic'), undefined);
});

test('difficulty label: hard needs three reasoning steps and no findings; medium tolerates one cue; easy is never flagged', () => {
  const base = { subject: 'accountancy', chapter: 'Debentures', question_type: 'numerical_calculation', passage_text: '', learning_objective: objective(), correct_answer: 'A',
    body: 'A company issues 100 debentures of Rs 100 at 10% premium. What total is received?', options: ['Rs 11,000', 'Rs 10,000', 'Rs 1,000', 'Rs 9,000'] };
  assert.equal(find(preparationValueV75({ ...base, difficulty: 'hard' }), 'difficulty_label_overstated'), undefined, 'steps unknown and no findings');
  assert.equal(find(preparationValueV75({ ...base, difficulty: 'hard' }, { reasoningSteps: 2 }), 'difficulty_label_overstated')?.blocking, true);
  assert.equal(find(preparationValueV75({ ...base, difficulty: 'hard' }, { reasoningSteps: 3 }), 'difficulty_label_overstated'), undefined);
  assert.equal(preparationValueV75({ ...base, difficulty: 'easy' }, { reasoningSteps: 1 }).blocking, false);
  const cued = { subject: 'business_studies', chapter: 'Planning', question_type: 'sequence_ordering', passage_text: '', learning_objective: objective(), correct_answer: 'B',
    body: 'Arrange.\n(A) Set objectives.\n(B) Then develop premises.\n(C) Identify alternatives.\n(D) Select the plan.\nChoose.', options: ['B-A-C-D', 'A-B-C-D', 'A-C-B-D', 'D-C-B-A'] };
  const medium = preparationValueV75({ ...cued, difficulty: 'medium' });
  assert.deepEqual(codes(medium), ['difficulty_label_overstated', 'ordering_cohesion_cue', 'ordering_printed_order_key'], 'two non-blocking cues overstate a medium label');
  assert.equal(preparationValueV75({ ...cued, difficulty: 'easy' }).blocking, false, 'cues alone never block an easy item');
  assert.equal(find(preparationValueV75({ ...cued, difficulty: 'hard' }, { reasoningSteps: 5 }), 'difficulty_label_overstated')?.blocking, true, 'hard with any finding');
});
