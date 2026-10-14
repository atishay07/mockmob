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

// ---- Reliability fixes (14 October 2026 audit) ----

// An NTA paper serves each question's options in a seeded order and remaps the key to that order
// (data/nta_item_checks.js ntaServedRow). The attempt snapshot holds the SERVED order; the live
// question row still holds the STORED order. order[i] = the stored option shown at served position i.
const storedOptions = ['Debit the asset', 'Credit the asset', 'Debit the capital', 'Credit the capital'];
const order = [2, 0, 3, 1];
const servedOptions = order.map(i => storedOptions[i]);
const storedKey = 1; // "Credit the asset", letter B in the live row
const servedKey = order.indexOf(storedKey); // 3
const ntaSnapshot = { id: 'n1', chapter: 'Journal', question: 'Which entry records the purchase?', options: servedOptions.map((text, i) => ({ key: 'ABCD'[i], text })), correctIndex: servedKey, correctAnswer: 'ABCD'[servedKey], optionOrder: order, optionsShuffled: true };
const ntaAttempt = { id: 'a9', userId: 'u1', subject: 'accountancy', questionsSnapshot: [ntaSnapshot], details: [{ qid: 'n1', isCorrect: false, givenIndex: 0 }] };
const ntaLive = { id: 'n1', status: 'live', verification_state: 'verified', options: storedOptions.map((text, i) => ({ key: 'ABCD'[i], text })), correct_answer: 'ABCD'[storedKey] };
const eligible = (current, attemptOverride = ntaAttempt) => repairEligibility({ attempt: attemptOverride, questionId: 'n1', userId: 'u1', current });

test('NTA shuffled options: a mistake is eligible when the live key is the same option, wherever it sits', () => {
  assert.notEqual(servedKey, storedKey, 'the fixture really is shuffled');
  const result = eligible(ntaLive);
  assert.equal(result.ok, true, 'was refused as key_changed before this fix');
  assert.equal(result.keyIndex, servedKey, 'letters stay as the student saw them');
  assert.equal(result.chosenIndex, 0);
});

test('NTA shuffled options: the live row may carry the stored letter prefixes the served text dropped', () => {
  const prefixed = { ...ntaLive, options: storedOptions.map((text, i) => ({ key: 'ABCD'[i], text: `${'ABCD'[i]}. ${text}` })) };
  assert.equal(eligible(prefixed).ok, true);
});

test('NTA shuffled options: a truly changed key is still refused', () => {
  // The live row now keys "Debit the asset" (stored index 0): a different option than the one scored.
  assert.equal(eligible({ ...ntaLive, correct_answer: 'A' }).code, 'key_changed');
  // The same letter in the live row, but the options moved so it points at another option.
  const reshuffled = { ...ntaLive, options: [storedOptions[1], storedOptions[0], storedOptions[2], storedOptions[3]].map((text, i) => ({ key: 'ABCD'[i], text })), correct_answer: 'B' };
  assert.equal(eligible(reshuffled).code, 'key_changed');
});

test('NTA shuffled options: option ids, when both sides carry them, decide identity before text', () => {
  const withIds = (list, ids) => list.map((o, i) => ({ ...o, id: ids[i] }));
  const snap = { ...ntaSnapshot, options: withIds(ntaSnapshot.options, order.map(i => `opt-${i}`)) };
  const attempt = { ...ntaAttempt, questionsSnapshot: [snap] };
  // Same ids and same key option, but the live text of that option was reworded: identity still matches.
  const live = { ...ntaLive, options: withIds(ntaLive.options.map((o, i) => (i === storedKey ? { ...o, text: 'Credit the asset account' } : o)), [0, 1, 2, 3].map(i => `opt-${i}`)) };
  assert.equal(eligible(live, attempt).ok, true);
  // Keyed option id changed: refused.
  assert.equal(eligible({ ...live, correct_answer: 'C' }, attempt).code, 'key_changed');
});

test('an edited (not merely reordered) option list keeps the old positional rule', () => {
  const edited = { ...live, options: [{ key: 'A', text: '3:2' }, { key: 'B', text: '1:1' }, { key: 'C', text: '1:3 (new wording)' }, { key: 'D', text: '2:3' }] };
  assert.equal(repairEligibility({ attempt, questionId: 'q1', userId: 'u1', current: edited }).ok, true);
  assert.equal(repairEligibility({ attempt, questionId: 'q1', userId: 'u1', current: { ...edited, correct_answer: 'B' } }).code, 'key_changed');
});

const passage = 'Maya read the notice twice before she signed. The clause on late fees was printed in the smallest type on the page.';
const readingQuestion = { id: 'r1', chapter: 'Reading', question: 'Why did Maya read the notice twice?', options: ['It was long', 'The clause was hard to see', 'She disliked it', 'She was late'], correctIndex: 1 };

test('the passage reaches the repair prompt and the blind prompt, from a snapshot (passageText) or a raw row (passage_text)', () => {
  for (const shape of [{ passageText: passage, passageTitle: 'The Notice' }, { passage_text: passage, passage_title: 'The Notice' }]) {
    const question = { ...readingQuestion, ...shape };
    const main = buildRepairPrompt({ question, chosenIndex: 0, keyIndex: 1, subject: 'english' });
    const blind = buildBlindSolvePrompt({ question, subject: 'english' });
    for (const prompt of [main, blind]) {
      assert.match(prompt.user, /Maya read the notice twice/, 'passage text is sent');
      assert.match(prompt.user, /The Notice/, 'passage title is sent');
    }
    assert.ok(main.user.indexOf('Maya read') < main.user.indexOf('Why did Maya'), 'the passage comes before the question it belongs to');
  }
  const none = buildRepairPrompt({ question: readingQuestion, chosenIndex: 0, keyIndex: 1, subject: 'english' });
  assert.doesNotMatch(none.user, /Passage/, 'no passage, no Passage line');
  assert.doesNotMatch(buildBlindSolvePrompt({ question: readingQuestion, subject: 'english' }).user, /Passage/);
});

test('the blind prompt still never carries the key when a passage is added', () => {
  const blind = buildBlindSolvePrompt({ question: { ...readingQuestion, passageText: passage }, subject: 'english' });
  assert.doesNotMatch(`${blind.system}\n${blind.user}`, /answer key|index 1 is|correctIndex|Student chose/);
});

test('the response filter lets normal teaching text through', () => {
  const teach = text => interpretRepair({ ...good, key_idea: text }, { keyIndex: 2, optionCount: 4 });
  for (const text of [
    'Spearman’s rank correlation compares the order of two lists, not their values.',
    'Rank the three bonds by how close their maturity is, then compare the coupons.',
    'A percentile tells you the share of values below one score in a distribution.',
    'The Constitution guarantees equality before the law, which is why Article 14 applies here.',
    'Substitute and you will get x = 3, so the second option fits.',
    'Once the ratio is fixed you will get the sacrificing ratio directly.',
    'The cut-off point for the break-even run is where contribution meets fixed cost.',
    'The warranty guarantees repair of defects, so provision is created at the sale.',
  ]) assert.equal(teach(text).kind, 'explained', text);
});

test('the response filter still blocks real claims: predicted marks, scores, ranks, percentiles, cutoffs, admission, guaranteed gains', () => {
  const teach = text => interpretRepair({ ...good, next_step: text }, { keyIndex: 2, optionCount: 4 });
  for (const claim of [
    'You will gain 5 marks next time.',
    'You will score higher after this.',
    'You’ll score 20 more marks if you remember this.',
    'You will get 5 more marks on the next paper.',
    'This guarantees a better rank.',
    'It guaranteed marks in the last paper.',
    'Guaranteed selection if you practise daily.',
    'Your percentile improves.',
    'Your rank will go up.',
    'This raises your expected score by ten marks.',
    'Marks you will gain from this chapter are high.',
    'That improves your admission chance.',
    'You will clear the cut-off you need.',
    'You will beat the cutoff for your college.',
  ]) assert.equal(teach(claim).kind, 'unusable', claim);
});

test('NTA shuffled options with a distractor reworded after the session: the recorded shuffle order maps the live key', () => {
  // "Debit the capital" (stored index 2) had a typo fixed, so the option lists are no longer the same set.
  const live = { ...ntaLive, options: ntaLive.options.map((o, i) => (i === 2 ? { ...o, text: 'Debit the capital account' } : o)) };
  assert.equal(eligible(live).ok, true, 'stored key B is still the option served at position 3');
  assert.equal(eligible({ ...live, correct_answer: 'A' }).code, 'key_changed', 'a key that moved to another stored option is still refused');
  // Without the recorded order there is nothing to map through, so the old positional rule decides.
  const noOrder = { ...ntaAttempt, questionsSnapshot: [{ ...ntaSnapshot, optionOrder: undefined }] };
  assert.equal(eligible(live, noOrder).code, 'key_changed');
  // An order that is not a permutation of the options is ignored rather than trusted.
  const broken = { ...ntaAttempt, questionsSnapshot: [{ ...ntaSnapshot, optionOrder: [0, 0, 1, 2] }] };
  assert.equal(eligible(live, broken).code, 'key_changed');
});
