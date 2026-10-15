// IA2: the learning plan's output is unchanged except for the intended steps (web IA plan, IA2 accept).
// data/fixtures/learning_plan/golden.json holds the plan the engine produced before this change (production
// 4d006fb9) for each case in cases.json. Two things changed on purpose: the recovery caveat no longer ends the
// ordinary practice reason, and "Review your mistakes" is offered only when the record holds a wrong answer.
// Everything else, API hrefs included, must stay byte for byte the same.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { learningPlan } from '../learning_engine.js';

const read = (name) => JSON.parse(readFileSync(new URL(`../fixtures/learning_plan/${name}.json`, import.meta.url), 'utf8'));
const CASES = read('cases');
const GOLDEN = read('golden');

const CAVEAT = /\s(No supported concept has been missed twice yet, so this is ordinary practice\.|Recovery content is awaiting source and calibration checks, so this is ordinary practice\.)$/;
const mistakesIn = (input) => (input.attempts || []).reduce((n, a) => n + (a.details || []).filter((d) => d.isCorrect === false).length, 0);
const withoutIntended = (plan, { reasonOf }) => ({
  ...plan,
  primary: { ...plan.primary, reason: reasonOf(plan.primary) },
  alternatives: plan.alternatives.filter((a) => a.kind !== 'review'),
});

test('golden covers every case', () => {
  assert.equal(GOLDEN.length, CASES.length);
  for (const [i, g] of GOLDEN.entries()) assert.equal(g.name, CASES[i].name);
});

for (const [i, c] of CASES.entries()) {
  test(`plan output unchanged except the intended steps: ${c.name}`, () => {
    const now = learningPlan(c.input);
    const old = GOLDEN[i].output;
    // Same plan once the caveat and the review entry are set aside.
    assert.deepEqual(
      withoutIntended(now, { reasonOf: (p) => p.reason }),
      withoutIntended(old, { reasonOf: (p) => (p.kind === 'ordinary_practice' ? p.reason.replace(CAVEAT, '') : p.reason) }),
    );
    // Only ordinary practice carried the caveat, and it is gone from every student-visible reason.
    for (const reason of [now.primary.reason, ...now.alternatives.map((a) => a.reason)]) assert.doesNotMatch(reason, /awaiting|calibration|release checks|being prepared/i);
    // The review entry: only with a mistake to review, and then the same step with a true reason.
    const review = now.alternatives.find((a) => a.kind === 'review');
    const oldReview = old.alternatives.find((a) => a.kind === 'review');
    const mistakes = mistakesIn(c.input);
    if (mistakes === 0) assert.equal(review, undefined, 'no "Review your mistakes" when there are no mistakes');
    else {
      assert.ok(review, 'a mistake to review keeps the entry');
      assert.deepEqual({ ...review, reason: null }, { ...oldReview, reason: null });
      assert.equal(review.reason, `${mistakes} wrong ${mistakes === 1 ? 'answer' : 'answers'} in ${c.input.attempts.length} saved ${c.input.attempts.length === 1 ? 'attempt' : 'attempts'}.`);
    }
  });
}

test('the ordinary practice reason says the session and nothing about recovery content', () => {
  assert.equal(learningPlan({ minutes: 10 }).primary.reason, '10 questions, about 10 minutes.');
  assert.equal(learningPlan({ minutes: 30 }).primary.reason, '20 questions, about 20 minutes, then 10 minutes reviewing your mistakes.');
});
