// node --test src/components/landing/askMobiSample.test.mjs
// "Ask Mobi" on the sample result (13 Nov 2026): one step for tonight from the five answers only. Pure, word for word.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ASK_BUTTON, ASK_CLOSING, ASK_FIRST, askPlan } from './askMobiSample.mjs';

const miss = (n, chapter) => ({ n, chapter });
const AFTER_REPLY = 'Take a full mock. The Mistake Lab then shows where every mark went, by chapter, by minute and by changed answer, and I pick your next step from that.';

test('fixed words', () => {
  assert.equal(ASK_FIRST, 'What should I do tonight?');
  assert.equal(ASK_BUTTON, 'Ask Mobi what to do tonight');
  assert.equal(ASK_CLOSING, 'That is Ask Mobi with five answers to go on. After a mock he reads your whole record.');
});

test('no misses: one full mock, and only the "after" follow-up', () => {
  const plan = askPlan({ missed: [] });
  assert.equal(plan.step, 'Take one full mock: 50 questions in 60 minutes.');
  assert.deepEqual(plan.lines, ['Nothing slipped in these five, so start with the subject you trust least.']);
  assert.deepEqual(plan.followUps, [{ id: 'after', ask: 'And after that?', reply: AFTER_REPLY }]);
});

test('one miss', () => {
  const plan = askPlan({ missed: [miss(3, 'Money and banking')] });
  assert.equal(plan.step, 'Practise 10 on Money and banking.');
  assert.deepEqual(plan.lines, ['It is the one question you missed (Q3).', 'Read the reason after each answer before you move on.']);
  assert.deepEqual(plan.followUps.map((f) => f.id), ['why', 'after']);
  assert.equal(plan.followUps[0].ask, 'Why that one?');
  assert.equal(plan.followUps[0].reply, 'It is the only thing these five flagged. One chapter, fixed properly, is a full night’s work.');
  assert.equal(plan.followUps[1].reply, AFTER_REPLY);
});

test('two misses in the same chapter: every miss was in it', () => {
  const plan = askPlan({ missed: [miss(2, 'Accounting equation'), miss(4, 'Accounting equation')] });
  assert.equal(plan.step, 'Practise 10 on Accounting equation.');
  assert.equal(plan.lines[0], 'It caught you two times in these five (Q2 and Q4).');
  assert.equal(plan.followUps[0].reply, 'Every miss here was in it. One chapter, fixed properly, is tonight’s whole job.');
});

test('three misses, two in one chapter and one in another', () => {
  const plan = askPlan({ missed: [miss(1, 'A'), miss(2, 'B'), miss(5, 'A')] });
  assert.equal(plan.step, 'Practise 10 on A.');
  assert.equal(plan.lines[0], 'It caught you two times in these five (Q1 and Q5).');
  assert.equal(plan.followUps[0].reply, 'It is where the most marks went: two of your three misses. One chapter fixed properly beats skimming two.');
});

test('three misses, all in one chapter lists three numbers', () => {
  const plan = askPlan({ missed: [miss(1, 'A'), miss(2, 'A'), miss(5, 'A')] });
  assert.equal(plan.lines[0], 'It caught you three times in these five (Q1, Q2 and Q5).');
  assert.equal(plan.followUps[0].reply, 'Every miss here was in it. One chapter, fixed properly, is tonight’s whole job.');
});

test('three misses, all different chapters: start with the first', () => {
  const plan = askPlan({ missed: [miss(2, 'A'), miss(3, 'B'), miss(5, 'C')] });
  assert.equal(plan.step, 'Practise 10 on A.');
  assert.equal(plan.lines[0], 'Each miss was in a different chapter, so start with the first (Q2).');
  assert.equal(plan.followUps[0].reply, 'With one miss in each of three chapters, none stands out yet. A full mock has 50 questions, enough to show which one really costs you.');
});

test('a tie goes to the chapter seen first', () => {
  const plan = askPlan({ missed: [miss(1, 'First'), miss(2, 'Second'), miss(3, 'Second'), miss(4, 'First')] });
  assert.equal(plan.step, 'Practise 10 on First.');
  assert.equal(plan.lines[0], 'It caught you two times in these five (Q1 and Q4).');
  assert.equal(plan.followUps[0].reply, 'It is where the most marks went: two of your four misses. One chapter fixed properly beats skimming two.');
});

test('four and five misses use number words', () => {
  const four = askPlan({ missed: [miss(1, 'A'), miss(2, 'A'), miss(3, 'A'), miss(4, 'A')] });
  assert.equal(four.lines[0], 'It caught you four times in these five (Q1, Q2, Q3 and Q4).');
  const five = askPlan({ missed: [1, 2, 3, 4, 5].map((n) => miss(n, 'A')) });
  assert.equal(five.lines[0], 'It caught you five times in these five (Q1, Q2, Q3, Q4 and Q5).');
});

test('no exclamation, em dash or the word AI anywhere in the words', () => {
  const plans = [
    askPlan({ missed: [] }),
    askPlan({ missed: [miss(1, 'A')] }),
    askPlan({ missed: [miss(1, 'A'), miss(2, 'A')] }),
    askPlan({ missed: [miss(1, 'A'), miss(2, 'B'), miss(3, 'A')] }),
    askPlan({ missed: [miss(1, 'A'), miss(2, 'B'), miss(3, 'C')] }),
  ];
  const strings = [ASK_FIRST, ASK_BUTTON, ASK_CLOSING];
  for (const plan of plans) strings.push(plan.step, ...plan.lines, ...plan.followUps.flatMap((f) => [f.ask, f.reply]));
  for (const text of strings) {
    assert.doesNotMatch(text, /!/, text);
    assert.doesNotMatch(text, /—/, text);
    assert.doesNotMatch(text, /\bAI\b/, text);
    assert.doesNotMatch(text, /\p{Extended_Pictographic}/u, text);
  }
});
