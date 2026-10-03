import test from 'node:test';
import assert from 'node:assert/strict';
import { repairEligibility, buildRepairPrompt, buildBlindSolvePrompt, interpretRepair, practiceHref, correctIndexOf, MISTAKE_REPAIR_SCHEMA } from '../mistake_repair.js';
import { CAPABILITIES, RELEASE_GATES } from '../capabilities.js';

const q = { id: 'q1', chapter: 'Admission of a Partner', question: 'A and B share 3:2...', options: ['3:2', '1:1', '1:3', '2:3'], correctIndex: 2 };
const attempt = { id: 'a1', userId: 'u1', subject: 'accountancy', questionsSnapshot: [q, { ...q, id: 'q2' }], details: [{ qid: 'q1', isCorrect: false, givenIndex: 0 }, { qid: 'q2', isCorrect: true, givenIndex: 2 }] };
const live = { id: 'q1', status: 'live', options: q.options.map((text, i) => ({ key: 'ABCD'[i], text })), correct_answer: 'C' };
const good = { solved_index: 2, agrees_with_key: true, why_tempting: 'The old ratio is the first thing you see.', why_wrong: 'A new ratio is stated, so shares fall unequally.', key_idea: 'Sacrifice is old share minus new share for each partner.', next_step: 'Redo it with shares over ten.' };

test('eligibility: only the owner, only a wrong answer, only while the key is unchanged and live', () => {
  assert.equal(repairEligibility({ attempt, questionId: 'q1', userId: 'u1', current: live }).ok, true);
  assert.equal(repairEligibility({ attempt, questionId: 'q1', userId: 'intruder', current: live }).code, 'not_found');
  assert.equal(repairEligibility({ attempt, questionId: 'q2', userId: 'u1', current: live }).code, 'not_a_mistake');
  assert.equal(repairEligibility({ attempt, questionId: 'q1', userId: 'u1', current: null }).code, 'question_withdrawn');
  assert.equal(repairEligibility({ attempt, questionId: 'q1', userId: 'u1', current: { ...live, verification_state: 'disputed' } }).code, 'question_under_review');
  assert.equal(repairEligibility({ attempt, questionId: 'q1', userId: 'u1', current: { ...live, status: 'pending' } }).code, 'question_under_review');
  assert.equal(repairEligibility({ attempt, questionId: 'q1', userId: 'u1', current: { ...live, correct_answer: 'B' } }).code, 'key_changed');
  const skipped = { ...attempt, details: [{ qid: 'q1', isCorrect: null, givenIndex: null }] };
  assert.equal(repairEligibility({ attempt: skipped, questionId: 'q1', userId: 'u1', current: live }).code, 'not_a_mistake');
  assert.equal(correctIndexOf({ options: [{ key: 'A' }, { key: 'B' }], correct_answer: 'B' }), 1);
});

test('the model must solve first and match the key before any explanation is shown', () => {
  assert.equal(interpretRepair(good, { keyIndex: 2, optionCount: 4 }).kind, 'explained');
  assert.deepEqual(interpretRepair({ ...good, solved_index: 1 }, { keyIndex: 2, optionCount: 4 }), { kind: 'disputed', solvedIndex: 1 });
  assert.equal(interpretRepair({ ...good, agrees_with_key: false }, { keyIndex: 2, optionCount: 4 }).kind, 'disputed');
  assert.equal(interpretRepair({ ...good, solved_index: 7 }, { keyIndex: 2, optionCount: 4 }).kind, 'unusable');
  assert.equal(interpretRepair({ ...good, solved_index: '2' }, { keyIndex: 2, optionCount: 4 }).kind, 'unusable');
  assert.equal(interpretRepair({ ...good, key_idea: '' }, { keyIndex: 2, optionCount: 4 }).kind, 'unusable');
  assert.equal(interpretRepair(null, { keyIndex: 2, optionCount: 4 }).kind, 'unusable');
});

test('no score, rank or admission promises survive; long text is capped', () => {
  for (const claim of ['You will gain 5 marks next time.', 'This guarantees a better rank.', 'Your percentile improves.'])
    assert.equal(interpretRepair({ ...good, next_step: claim }, { keyIndex: 2, optionCount: 4 }).kind, 'unusable', claim);
  const long = interpretRepair({ ...good, why_wrong: 'x '.repeat(400) }, { keyIndex: 2, optionCount: 4 });
  assert.ok(long.repair.why_wrong.length <= 320);
});

test('prompts give the key only to the explainer, never to the blind second opinion', () => {
  const p = buildRepairPrompt({ question: q, chosenIndex: 0, keyIndex: 2, subject: 'accountancy' });
  assert.match(p.system, /answer key is index 2/); assert.match(p.system, /Solve the question yourself/); assert.match(p.system, /JSON/);
  assert.match(p.user, /Student chose index 0/);
  const blind = buildBlindSolvePrompt({ question: q, subject: 'accountancy' });
  assert.doesNotMatch(`${blind.system}\n${blind.user}`, /answer key|index 2 is|correctIndex/);
  assert.deepEqual(MISTAKE_REPAIR_SCHEMA.required.slice(0, 2), ['solved_index', 'agrees_with_key']);
});

test('fresh practice reuses the recovery replay route; AI gates are split from AI purchases', () => {
  assert.equal(practiceHref({ subject: 'accountancy', chapter: 'Admission of a Partner', attemptId: 'a1' }), '/test?subject=accountancy&mode=quick&count=5&chapter=Admission+of+a+Partner&recoveryFrom=a1');
  assert.equal(RELEASE_GATES.runtimeAi, true);
  assert.equal(CAPABILITIES.optionalAi.state, 'available');
  assert.equal(CAPABILITIES.aiTopUps.state, 'paused', 'top-up checkout and charged Rival battles stay closed');
});
