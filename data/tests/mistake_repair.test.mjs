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

// ---- Repair v3 (build spec 15 Oct 2026, sections A.2 to A.4) ----
import {
  buildRepairPromptV3, interpretRepairV3, fitSentence, cleanRepairText, claimsAboutStudent, contradictsKey, withLegacyAliases,
  repairPromptVersion, REPAIR_PROMPT_VERSION, MISTAKE_REPAIR_SCHEMA_V3, LIMITS_V3, TRAP_TYPES, REFERENCE_EXPLANATION_CAP,
} from '../mistake_repair.js';

// Today's v1 prompt, captured before v3 was added. REPAIR_PROMPT_VERSION=1 must reproduce it exactly.
const V1_PROMPT = {"system":"You are MockMob's Score Recovery tutor for CUET UG accountancy.\nA student chose a wrong option. Work in this order:\n1. Solve the question yourself from scratch. Put the 0-based index of the option you believe is correct in \"solved_index\".\n2. The platform's answer key is index 2. Set \"agrees_with_key\" to true only if your solved_index is 2.\n3. Only if you agree, explain for a 17-year-old in plain English:\n   - \"why_tempting\": why the student's option (index 0) looks right — the specific trap (max 45 words)\n   - \"why_wrong\": the exact reason that option fails (max 45 words)\n   - \"key_idea\": the rule or distinction that picks the correct answer (max 45 words)\n   - \"next_step\": one concrete thing to do in the next 10 minutes (max 30 words)\nIf you disagree with the key, set every text field to \"\".\nNever predict marks, scores, ranks, percentiles, cutoffs or admission chances for the student, and never promise a gain. Words such as rank or percentile are fine when they are part of the subject itself. Do not add facts the answer does not need.\nReturn JSON only: {\"solved_index\": number, \"agrees_with_key\": boolean, \"why_tempting\": string, \"why_wrong\": string, \"key_idea\": string, \"next_step\": string}","user":"Chapter: Admission of a Partner\nQuestion: A and B share 3:2...\nOptions:\nA (index 0). 3:2\nB (index 1). 1:1\nC (index 2). 1:3\nD (index 3). 2:3\nStudent chose index 0."};

test('v3 is the default; REPAIR_PROMPT_VERSION=1 is the rollback and the v1 prompt is unchanged to the character', () => {
  assert.equal(REPAIR_PROMPT_VERSION, 3);
  assert.equal(repairPromptVersion({}), 3);
  assert.equal(repairPromptVersion({ REPAIR_PROMPT_VERSION: '3' }), 3);
  assert.equal(repairPromptVersion({ REPAIR_PROMPT_VERSION: 'banana' }), 3);
  assert.equal(repairPromptVersion({ REPAIR_PROMPT_VERSION: '1' }), 1);
  assert.equal(repairPromptVersion({ REPAIR_PROMPT_VERSION: ' 1 ' }), 1);
  assert.deepEqual(buildRepairPrompt({ question: q, chosenIndex: 0, keyIndex: 2, subject: 'accountancy' }), V1_PROMPT);
});

const v3q = {
  id: 'q9', chapter: 'Correct Word Usage', topic: 'Commonly confused words', questionType: 'mcq', difficulty: 'hard',
  question: 'Choose the word that fits: The new rule will ___ everyone in the office.',
  options: ['effect', 'affect', 'infect', 'afflict'], correctIndex: 1,
  explanation: 'Affect is the verb meaning to influence. Effect is usually a noun meaning a result.',
  timeSpentMs: 41000, userId: 'student-7', answerChanges: [{ before: 1, after: 0 }],
};

test('the v3 prompt carries the subject name, chapter, topic, question type and the reference explanation, and nothing about the student', () => {
  const p = buildRepairPromptV3({ question: v3q, chosenIndex: 0, keyIndex: 1, subjectName: 'English' });
  assert.match(p.system, /^You are MockMob's tutor for CUET UG English\. A student chose option A \(index 0\)\./);
  assert.match(p.system, /The platform's answer key is option B \(index 1\)\. Set "agrees_with_key" to true only if solved_index is 1\./);
  assert.match(p.system, /Return JSON only with exactly these keys: solved_index, agrees_with_key, trap_type, trap, why_wrong, why_right, contrast, others, rule, memory_hook, another_way\./);
  for (const type of TRAP_TYPES) assert.ok(p.system.includes(type), type);
  assert.match(p.user, /^Subject: English\nChapter: Correct Word Usage\nTopic: Commonly confused words\nQuestion type: mcq\nQuestion: Choose the word/);
  assert.match(p.user, /\nOptions:\nA \(index 0\)\. effect\nB \(index 1\)\. affect\nC \(index 2\)\. infect\nD \(index 3\)\. afflict\nStudent chose option A \(index 0\)\./);
  assert.match(p.user, /Reference explanation from the question bank \(may be brief\):\nAffect is the verb meaning to influence\./);
  const both = `${p.system}\n${p.user}`;
  for (const personal of ['student-7', '41', 'hard', 'difficulty', 'answerChanges', 'seconds', 'Mock ', 'earlier', 'accuracy'])
    assert.ok(!both.includes(personal), `the prompt must not carry ${personal}`);
  assert.doesNotMatch(both, /[—–]/, 'the v3 prompt itself uses no dashes between clauses');
});

test('the v3 prompt leaves out a topic equal to the chapter, a missing type and a missing explanation, and keeps a passage before the question', () => {
  const plain = buildRepairPromptV3({ question: { ...v3q, topic: 'correct word usage', questionType: null, explanation: '' }, chosenIndex: 0, keyIndex: 1, subjectName: 'English' });
  assert.doesNotMatch(plain.user, /Topic:|Question type:|Reference explanation/);
  const reading = buildRepairPromptV3({ question: { ...readingQuestion, passageText: passage, passageTitle: 'The Notice' }, chosenIndex: 0, keyIndex: 1, subjectName: 'English' });
  assert.match(reading.user, /Passage \(The Notice\):\nMaya read the notice twice/);
  assert.ok(reading.user.indexOf('Maya read') < reading.user.indexOf('Why did Maya'));
  assert.match(buildRepairPromptV3({ question: v3q, chosenIndex: 0, keyIndex: 1, subjectName: '' }).system, /CUET UG practice\./);
});

test('a long reference explanation is cut at a sentence end within 1,200 characters', () => {
  const sentence = 'Affect is a verb that means to influence something. ';
  const long = sentence.repeat(40);
  const p = buildRepairPromptV3({ question: { ...v3q, explanation: long }, chosenIndex: 0, keyIndex: 1, subjectName: 'English' });
  const sent = p.user.split('Reference explanation from the question bank (may be brief):\n')[1];
  assert.ok(sent.length <= REFERENCE_EXPLANATION_CAP, `${sent.length} characters`);
  assert.ok(sent.endsWith('something.'), 'ends on a full sentence');
  assert.ok(sent.length > REFERENCE_EXPLANATION_CAP - sentence.length);
});

const goodV3 = {
  solved_index: 1, agrees_with_key: true, trap_type: 'look_alike_term',
  trap: 'Option A sounds the same as the key and is a common word in this sense.',
  why_wrong: 'Effect is a noun for a result, so it cannot follow "will" as a verb here.',
  why_right: 'Affect is the verb meaning to influence, which is what the rule does to everyone.',
  contrast: 'If the sentence said "will have an ___ on everyone", option A would fit. It says "will ___ everyone", so option B.',
  others: [{ index: 3, why: 'Afflict means to cause pain or trouble, too strong for a rule.' }, { index: 2, why: 'Infect is about spreading disease, not influence.' }],
  rule: 'After "will", use the verb form: affect, not effect.',
  memory_hook: 'Affect is the Action, Effect is the End result.',
  another_way: 'Think of affect as the push and effect as what the push leaves behind. Rain can affect a match; the effect is a wet pitch.',
};
const ctx = { keyIndex: 1, chosenIndex: 0, optionCount: 4 };

test('a full v3 answer is explained with every field, the other options in served order', () => {
  const out = interpretRepairV3(goodV3, ctx);
  assert.equal(out.kind, 'explained');
  assert.deepEqual(out.dropped, []);
  assert.equal(out.repair.trap_type, 'look_alike_term');
  assert.deepEqual(out.repair.others.map((o) => o.index), [2, 3], 'sorted into the order the student saw');
  for (const field of ['trap', 'why_wrong', 'why_right', 'contrast', 'rule', 'memory_hook', 'another_way']) assert.equal(typeof out.repair[field], 'string', field);
  assert.ok(!('why_tempting' in out.repair) && !('key_idea' in out.repair), 'no aliases in what is stored');
  assert.deepEqual(MISTAKE_REPAIR_SCHEMA_V3.required.slice(0, 2), ['solved_index', 'agrees_with_key']);
});

test('step 1 and 2: unusable output and disagreement with the key', () => {
  assert.deepEqual(interpretRepairV3(null, ctx), { kind: 'unusable', reason: 'not_an_object' });
  assert.equal(interpretRepairV3([], ctx).kind, 'unusable');
  assert.equal(interpretRepairV3({ ...goodV3, solved_index: 9 }, ctx).kind, 'unusable');
  assert.equal(interpretRepairV3({ ...goodV3, solved_index: '1' }, ctx).kind, 'unusable');
  assert.deepEqual(interpretRepairV3({ ...goodV3, solved_index: 3 }, ctx), { kind: 'disputed', solvedIndex: 3 });
  assert.deepEqual(interpretRepairV3({ ...goodV3, agrees_with_key: 'true' }, ctx), { kind: 'disputed', solvedIndex: 1 });
});

test('step 3: whitespace collapses, dashes between words become commas, "!" becomes ".", a leading label goes', () => {
  assert.equal(cleanRepairText('  Effect   is a noun —  a result.  '), 'Effect is a noun, a result.');
  assert.equal(cleanRepairText('Effect—a noun–not a verb.'), 'Effect, a noun, not a verb.');
  assert.equal(cleanRepairText('Pages 10–12 cover it.'), 'Pages 10-12 cover it.', 'a number range stays a range');
  assert.equal(cleanRepairText('That is the trap!'), 'That is the trap.');
  assert.equal(cleanRepairText('Watch out!! It reverses.'), 'Watch out. It reverses.');
  assert.equal(cleanRepairText('5! is 120 and x != y.'), '5! is 120 and x != y.', 'a factorial and != are maths, not exclamations');
  assert.equal(cleanRepairText('Answer: Affect is the verb.'), 'Affect is the verb.');
  assert.equal(cleanRepairText('Rule: Use the verb after will.'), 'Use the verb after will.');
  const out = interpretRepairV3({ ...goodV3, trap: 'Trap: Option A sounds right — it is a real word!' }, ctx);
  assert.equal(out.repair.trap, 'Option A sounds right, it is a real word.');
});

test('step 3: a number before "!" at a sentence end is an exclamation; a factorial is kept only when it is clearly maths', () => {
  // Exclamations, a number before them included.
  for (const [input, expected] of [
    ['42!', '42.'],
    ['The answer is 42!', 'The answer is 42.'],
    ['It is 42! Then divide by 6.', 'It is 42. Then divide by 6.'],
    ['That leaves 5!', 'That leaves 5.'],
    ['Great! now check the sign.', 'Great. now check the sign.'],
    ['Wow! That works.', 'Wow. That works.'],
    ['Watch out!! It reverses.', 'Watch out. It reverses.'],
    ['It is 7!!', 'It is 7.'],
  ]) assert.equal(cleanRepairText(input), expected, input);
  // Maths: an operator, "=", a digit or a bracket after it, or a sentence that goes on.
  for (const text of [
    '5! = 120, so the count is 120.',
    '5!=120',
    '5! + 3 is 123.',
    '3! × 2 is 12.',
    'nCr is n!/(r!(n-r)!) for these choices.',
    'The count is (5!) here.',
    '5! is 120 and x != y.',
    'There are 4! ways to seat them.',
    'n! grows fast.',
    'Compare 4!, 5! and 6 first.',
    'x! = 6 gives x = 3.',
  ]) assert.equal(cleanRepairText(text), text, text);
});

test('step 4: fitSentence keeps text at the cap, cuts after a sentence end past 60%, never mid-sentence and never with an ellipsis', () => {
  assert.equal(fitSentence('a'.repeat(100), 100), 'a'.repeat(100), 'exactly at the cap is kept');
  const two = `${'x'.repeat(70)}. ${'y'.repeat(40)}.`;
  assert.equal(fitSentence(two, 100), `${'x'.repeat(70)}.`);
  const early = `${'x'.repeat(40)}. ${'y'.repeat(80)}.`;
  assert.equal(fitSentence(early, 100), null, 'the only break is before 60% of the cap');
  assert.equal(fitSentence('z'.repeat(120), 100), null, 'no sentence end: the field fails');
  assert.equal(fitSentence(`${'x'.repeat(65)}; ${'y'.repeat(60)}`, 100), `${'x'.repeat(65)}.`, 'a semicolon break ends as a full stop');
  assert.equal(fitSentence(`${'x'.repeat(65)}? ${'y'.repeat(60)}`, 100), `${'x'.repeat(65)}?`);
  // Through the interpreter: a required field over its cap with no break is unusable, an optional one is dropped.
  assert.deepEqual(interpretRepairV3({ ...goodV3, why_right: 'w'.repeat(LIMITS_V3.why_right + 5) }, ctx), { kind: 'unusable', reason: 'why_right' });
  const longWay = interpretRepairV3({ ...goodV3, another_way: 'v'.repeat(LIMITS_V3.another_way + 5) }, ctx);
  assert.equal(longWay.kind, 'explained'); assert.ok(!('another_way' in longWay.repair)); assert.deepEqual(longWay.dropped, ['another_way']);
  const cut = interpretRepairV3({ ...goodV3, why_wrong: `${'Effect is a noun. '.repeat(16)}And more words here` }, ctx);
  assert.ok(cut.repair.why_wrong.length <= LIMITS_V3.why_wrong && cut.repair.why_wrong.endsWith('noun.'));
  assert.doesNotMatch(cut.repair.why_wrong, /…|\.\.\./);
});

test('step 5: required fields must exist and be long enough', () => {
  for (const field of ['trap', 'why_wrong', 'why_right', 'rule'])
    assert.deepEqual(interpretRepairV3({ ...goodV3, [field]: '' }, ctx), { kind: 'unusable', reason: field }, field);
  assert.equal(interpretRepairV3({ ...goodV3, trap: 'Too short.' }, ctx).kind, 'unusable', 'trap needs 12 characters');
  assert.equal(interpretRepairV3({ ...goodV3, rule: 'Use it.' }, ctx).kind, 'unusable', 'rule needs 8 characters');
  assert.equal(interpretRepairV3({ ...goodV3, rule: 'Use verbs.' }, ctx).kind, 'explained');
});

test('step 6: a score, rank or admission claim makes a required field unusable and drops an optional one', () => {
  assert.equal(interpretRepairV3({ ...goodV3, rule: 'Learn this and you will gain 5 marks.' }, ctx).kind, 'unusable');
  const out = interpretRepairV3({ ...goodV3, another_way: 'This guarantees a better rank in the exam.' }, ctx);
  assert.equal(out.kind, 'explained'); assert.ok(!('another_way' in out.repair)); assert.deepEqual(out.dropped, ['another_way']);
});

test('step 7: each claim about the student is caught, and teaching text is not', () => {
  for (const text of [
    'You rushed past the verb.', 'You probably guessed between the two.', 'You may have misread the blank.', 'You might have overthought it.',
    'You panicked and picked the familiar word.', 'You skimmed the sentence.',
    "You're careless with homophones.", 'You are confused by these words.', 'You were rushing at the end.', 'You were tired.',
    "You didn't read the whole sentence.", 'You did not check the tense.', 'You didnt notice the article.', 'You did not think about it.',
    // A cause stated about the student (review, 15 Oct): confused, forgot, overlooked, missed, misread, ignored, rushed, assumed.
    'You confused affect with effect.', 'You may have confused the two ratios.', 'You might have mixed up the partners.',
    'You forgot the minus sign.', 'You probably forgot to divide by 2.', 'You overlooked the word NOT.', 'You missed the word except.',
    'You misread the question.', 'You ignored the passage.', "You've ignored the base year.", 'You assumed the rate was simple.',
    'You must have assumed it was annual.', 'If you assumed simple interest, you get option B.',
    // "you were ..." and "your mistake was ..."
    'You were thinking of the old ratio.', 'You were in a hurry.', 'Here you were looking at the wrong year.', "You were 'tired' by then.",
    'Your mistake was reading the ratio backwards.', 'Your main error is the sign.', 'The mistake you made is a common one.',
  ]) assert.equal(claimsAboutStudent(text), true, text);
  for (const text of [
    'This option borrows a true fact.', 'When you read "will", expect a verb.', 'Read the sentence to the end before choosing.', 'If you checked the tense, B fits.',
    // Teaching text in maths and economics explanations: an instruction or a hypothetical, never a claim.
    'If you add 3 to both sides, x = 5.', 'If you multiply both sides by 2, you get 10.', 'When you subtract the sacrifice, the gain remains.',
    'Assume you have 100 shares.', 'If you assume x is positive, the root is 3.', 'If you forget the NOT, option B looks right.',
    'Suppose you were to double the price, demand falls.', 'If you were the buyer, you would pay less.', 'You were asked to find the new ratio.',
    'You were given two statements.',
    // Option or passage text in quotation marks is quoted, not said about the student.
    'Option D uses "you were", which agrees with the subject.', "Option B says 'you missed the bus', a past event.", 'The passage line “you forgot your keys” is literal.',
    // The server's own record facts about an earlier miss are not causes.
    'You chose the same option when you missed this in Mock 1 on 5 Oct.', 'You also missed this question in Mock 2 on 9 Oct.',
  ]) assert.equal(claimsAboutStudent(text), false, text);
  assert.equal(interpretRepairV3({ ...goodV3, why_wrong: 'You confused affect with effect, so the noun went in.' }, ctx).kind, 'unusable');
  const another = interpretRepairV3({ ...goodV3, another_way: 'Your mistake was treating the noun as a verb.' }, ctx);
  assert.equal(another.kind, 'explained'); assert.ok(!('another_way' in another.repair)); assert.deepEqual(another.dropped, ['another_way']);
  assert.equal(interpretRepairV3({ ...goodV3, another_way: 'If you add a helper verb, as in "will affect", the verb stays.' }, ctx).repair.another_way,
    'If you add a helper verb, as in "will affect", the verb stays.', 'teaching text is kept');
  assert.equal(interpretRepairV3({ ...goodV3, trap: 'You rushed and picked the familiar spelling here.' }, ctx).kind, 'unusable');
  const hook = interpretRepairV3({ ...goodV3, memory_hook: 'You were careless, so slow down.' }, ctx);
  assert.ok(!('memory_hook' in hook.repair)); assert.deepEqual(hook.dropped, ['memory_hook']);
});

test('step 8: naming another option as correct is caught; statement labels, the key and conditionals are not', () => {
  const letters = ['A', 'B', 'C', 'D'];
  assert.equal(contradictsKey('So option C is correct here.', 'B', letters), true);
  assert.equal(contradictsKey('Option (A) is the right answer.', 'B', letters), true);
  assert.equal(contradictsKey('The correct answer is option D.', 'B', letters), true);
  assert.equal(contradictsKey('The right answer is A.', 'B', letters), true);
  assert.equal(contradictsKey('Statement (A) is correct, but it is not the reason.', 'B', letters), false, 'a statement label is not an option');
  assert.equal(contradictsKey('Option B is correct because affect is a verb.', 'B', letters), false, 'the key itself');
  assert.equal(contradictsKey('The right answer is a verb.', 'B', letters), false, 'a lower-case word is not an option name');
  assert.equal(contradictsKey('Option A is correct only if a noun is needed.', 'B', letters), false, 'a conditional');
  assert.equal(contradictsKey('Option E is correct.', 'B', letters), false, 'not a listed letter');
  for (const t of ['Option A is also correct.', 'Option C is actually the right answer.', 'Option D is in fact correct.', 'Option A is the only correct option.'])
    assert.equal(contradictsKey(t, 'B', letters), true, t);
  assert.equal(contradictsKey('Option B is also correct in every case.', 'B', letters), false, 'the key itself');
  assert.equal(contradictsKey('Option A is not correct.', 'B', letters), false);
  assert.equal(interpretRepairV3({ ...goodV3, why_right: 'Option C is the correct answer since it fits the verb slot.' }, ctx).kind, 'unusable');
  const contrast = interpretRepairV3({ ...goodV3, contrast: 'The correct answer is option A, since effect names a result.' }, ctx);
  assert.equal(contrast.kind, 'explained'); assert.ok(!('contrast' in contrast.repair));
});

test('step 9: the other options are all or nothing', () => {
  const rows = goodV3.others;
  const run = (others) => { const out = interpretRepairV3({ ...goodV3, others }, ctx); assert.equal(out.kind, 'explained'); return out; };
  for (const [name, others] of [
    ['one missing', [rows[0]]],
    ['a duplicate', [rows[0], rows[0]]],
    ['the key included', [rows[0], { index: 1, why: 'Affect is wrong here for some reason.' }]],
    ['the chosen option included', [rows[0], { index: 0, why: 'Effect is a noun, not a verb.' }]],
    ['an index that is not an integer', [rows[0], { index: '2', why: 'Infect is about disease.' }]],
    ['an empty reason', [rows[0], { index: 2, why: '' }]],
    ['a claim about the student', [rows[0], { index: 2, why: 'You rushed past this one.' }]],
    ['an extra row', [...rows, { index: 2, why: 'Infect is about disease again.' }]],
  ]) {
    const out = run(others);
    assert.deepEqual(out.repair.others, [], name);
    assert.deepEqual(out.dropped, ['others'], name);
  }
  assert.deepEqual(run([]).dropped, [], 'absent is not a drop');
  const twoOptions = interpretRepairV3({ ...goodV3, others: [] }, { keyIndex: 1, chosenIndex: 0, optionCount: 2 });
  assert.deepEqual(twoOptions.repair.others, []); assert.deepEqual(twoOptions.dropped, []);
  assert.deepEqual(interpretRepairV3({ ...goodV3, others: rows }, { keyIndex: 1, chosenIndex: 0, optionCount: 2 }).dropped, ['others'], 'a 2-option question expects none');
});

test('step 10 and 11: a hook that repeats the rule is dropped; empty optional fields are simply absent; unknown trap types read as other', () => {
  for (const hook of ['After "will", use the verb form: affect, not effect.', 'after will use the verb form affect not effect', 'Use the verb form', 'Remember: after "will", use the verb form: affect, not effect, always.']) {
    const out = interpretRepairV3({ ...goodV3, memory_hook: hook }, ctx);
    assert.ok(!('memory_hook' in out.repair), hook); assert.deepEqual(out.dropped, ['memory_hook'], hook);
  }
  const bare = interpretRepairV3({ ...goodV3, contrast: '', memory_hook: '', another_way: '   ', others: [] }, ctx);
  assert.equal(bare.kind, 'explained'); assert.deepEqual(bare.dropped, []);
  for (const f of ['contrast', 'memory_hook', 'another_way']) assert.ok(!(f in bare.repair), f);
  const missing = { ...goodV3 }; delete missing.contrast; delete missing.memory_hook; delete missing.another_way; delete missing.others;
  assert.equal(interpretRepairV3(missing, ctx).kind, 'explained');
  for (const t of ['made_up', '', null, 42, '__proto__']) assert.equal(interpretRepairV3({ ...goodV3, trap_type: t }, ctx).repair.trap_type, 'other', String(t));
});

test('legacy aliases are added on the way out for v3 only, never invented for older payloads', () => {
  const out = withLegacyAliases({ version: 3, trap: 'T', why_right: 'R', rule: 'Rule' });
  assert.equal(out.why_tempting, 'T'); assert.equal(out.key_idea, 'Rule');
  const v1 = { why_tempting: 'a', why_wrong: 'b', key_idea: 'c', next_step: 'd' };
  assert.equal(withLegacyAliases(v1), v1);
  assert.equal(withLegacyAliases(null), null);
});
