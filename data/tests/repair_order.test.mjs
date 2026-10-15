// Repair order by what other students answered (data/repair_order.js; spec tmp/mistake-lab-v4/SPEC.md 4.7, first part).
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRepairOrder, mostRight, commonTrap } from '../repair_order.js';
import { buildMistakeLab } from '../mistake_lab.js';
import { wilson } from '../prepos_insights.js';
import { buildAll } from '../../scripts/mistake-lab/build-fixtures.mjs';

const { inputs, fullCohort } = buildAll();
const FULL = inputs.full_mock_input;
const LAB = buildMistakeLab({ attempt: FULL.attempt, answerReviews: FULL.answerReviews, cohort: fullCohort });
const ORDER = buildRepairOrder({ lab: LAB, attempt: FULL.attempt, answerReviews: FULL.answerReviews });

test('most other students got it right first (by share), then common traps, then paper order', () => {
  const wrong = FULL.attempt.details.filter((d) => d.isCorrect === false && FULL.answerReviews[d.qid]?.state !== 'under_review').map((d) => d.qid);
  assert.deepEqual([...ORDER.qids].sort(), [...wrong].sort(), 'every wrong answer that is not held, once');
  assert.ok(!ORDER.qids.includes('q14'), 'the held question is not in the queue');
  const reasons = ORDER.items.map((x) => x.reason);
  assert.deepEqual(reasons, [...reasons].sort((a, b) => ['most_right', 'common_trap', 'paper'].indexOf(a) - ['most_right', 'common_trap', 'paper'].indexOf(b)));
  const most = ORDER.items.filter((x) => x.reason === 'most_right');
  const share = (qid) => LAB.byQuestion[qid].others.right / LAB.byQuestion[qid].others.n;
  for (let i = 1; i < most.length; i++) assert.ok(share(most[i - 1].qid) >= share(most[i].qid));
  const paper = ORDER.items.filter((x) => x.reason === 'paper').map((x) => x.number);
  assert.deepEqual(paper, [...paper].sort((a, b) => a - b));
  assert.equal(ORDER.state, 'cohort');
});

test('the hero key and line use the numbers the opened answer shows', () => {
  for (const item of ORDER.items) {
    const others = LAB.byQuestion[item.qid]?.others;
    if (item.reason === 'most_right') {
      assert.equal(item.key, `Repair Q${item.number} first`);
      assert.equal(item.line, `${others.right} of ${others.n} other students got it right.`);
      assert.ok(others.line.startsWith(`${others.n} other students answered this. ${others.right} got it right.`));
    } else if (item.reason === 'common_trap') {
      assert.ok(others.line.endsWith(item.line.replace(/^/, ' ')), 'the same trap sentence as How others answered');
    } else {
      assert.deepEqual([item.key, item.line], [null, null]);
    }
  }
});

test('the gates: 20 students and a Wilson low bound above 50%; the trap needs 5 picks, half of wrong, no tie', () => {
  assert.equal(mostRight({ n: 19, right: 19 }), false, 'under 20 students');
  // Find the smallest right count out of 20 whose Wilson low bound passes 50%.
  const pass = Array.from({ length: 21 }, (_, r) => r).find((r) => wilson(r, 20).low > 50);
  assert.equal(mostRight({ n: 20, right: pass }), true);
  assert.equal(mostRight({ n: 20, right: pass - 1 }), false);
  assert.equal(mostRight(null), false);
  const read = { n: 30, right: 18, keyIndex: 0, counts: [18, 6, 4, 2] };
  assert.deepEqual(commonTrap(read, 1), { c: 6, w: 12, L: 'B' });
  assert.equal(commonTrap({ ...read, counts: [18, 4, 4, 4] }, 1), null, '4 picks');
  assert.equal(commonTrap({ ...read, counts: [18, 5, 5, 2] }, 1), null, 'a tie with another wrong option');
  assert.equal(commonTrap(read, 0), null, 'the key is no trap');
});

test('without a cohort read the order is today\'s: paper order, and no key line', () => {
  const plain = buildMistakeLab({ attempt: FULL.attempt, answerReviews: FULL.answerReviews, cohort: null });
  const order = buildRepairOrder({ lab: plain, attempt: FULL.attempt, answerReviews: FULL.answerReviews });
  assert.equal(order.state, 'paper');
  assert.deepEqual(order.items.map((x) => x.number), [...order.items.map((x) => x.number)].sort((a, b) => a - b));
  assert.ok(order.items.every((x) => x.key === null && x.line === null));
  const none = inputs.no_missed_input;
  assert.equal(buildRepairOrder({ lab: buildMistakeLab({ attempt: none.attempt }), attempt: none.attempt }), null);
});
