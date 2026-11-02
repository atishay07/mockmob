// R5 Packet A (LK44): one stable option order per question, the same on every surface, graded through the same mapping,
// with every persisted value keeping its meaning for old rows. data/option_order.js and its users.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OPTION_ORDER_VERSION, isPermutation, outOrder, servedIndexOf, servedLetterOfStored, servedOut, servedRow,
  stableOrder, storedIndexOf, storedKeyAt, storedLetterOfServed,
} from '../option_order.js';
import { feedServed, storedAnswerOf } from '../explore_served.js';
import { learnServed, storedLetter } from '../../src/lib/server/learn.js';
import { reviseItem } from '../../src/lib/server/revise.js';
import { publicQuestion } from '../../src/lib/mob/games.mjs';
import { STABLE_ORDER_FROM_WEEK, picksFromAttempt, stableOrderWeek, trapPayload } from '../../src/lib/mob/model.mjs';
import { buildCompare } from '../../src/lib/mob/compare.mjs';
import { explainedRow, offeredHashes, orderFromHashes, markCheck } from '../repair_check.js';

const LETTERS = 'ABCD';
const row = (id, over = {}) => ({
  id, subject: 'accountancy', chapter: 'Partnership', question: `Which of these is true of partnership deed number ${id}?`,
  options: ['It must be in writing', 'It may be oral or written', 'It must be registered', 'It needs a court order'],
  correct_index: 1, correct_answer: 'B', explanation: 'A deed may be oral or written; writing is advisable.', ...over,
});
const textOf = (o) => (typeof o === 'string' ? o : o?.text);
const out = (r) => ({ id: r.id, question: r.question, body: r.body, options: r.options, correctIndex: r.correct_index, correctAnswer: r.correct_answer, explanation: r.explanation });

test('stability: the same id gives the same order on every call and every surface, for every student', () => {
  for (let i = 0; i < 200; i += 1) {
    const r = row(`q-${i}`);
    const order = stableOrder(r);
    assert.ok(isPermutation(order, 4));
    for (let k = 0; k < 3; k += 1) assert.deepEqual(stableOrder({ ...r }), order, 'every call');
    const served = servedRow(r).row;
    const texts = served.options.map(textOf);
    assert.deepEqual(texts, order.map((s) => r.options[s]));
    // Learn, Explore and Saved, practice and Mob papers (questionOut shape), Revise, the Mob race, a repair check.
    assert.deepEqual(learnServed(r).options.map((o) => o.text), texts);
    assert.deepEqual(learnServed(r).order, order);
    assert.deepEqual(feedServed(r).options.map((o) => o.text), texts);
    assert.deepEqual(servedOut(out(r)).options.map(textOf), texts);
    assert.deepEqual(outOrder(out(r)), order);
    assert.deepEqual(reviseItem(r, { box: 1 }).options, texts);
    assert.deepEqual(publicQuestion(servedOut(out(r)), 0).options, texts);
    assert.deepEqual(orderFromHashes(r, offeredHashes(r)), order);
    // The key moves with its option and the letters are relabelled in served order.
    assert.equal(textOf(served.options[served.correct_index]), 'It may be oral or written');
    assert.equal(served.correct_answer, LETTERS[served.correct_index]);
    assert.equal(learnServed(r).key, served.correct_answer);
    assert.equal(feedServed(r).correct_answer, served.correct_answer);
    assert.equal(servedOut(out(r)).correctIndex, served.correct_index);
    assert.deepEqual(served.option_order, order);
    assert.equal(feedServed(r).option_order, OPTION_ORDER_VERSION);
  }
});

test('the order is seeded by the id alone: other ids give other orders, the stored keys spread to about a quarter each', () => {
  const counts = [0, 0, 0, 0];
  const orders = new Set();
  for (let i = 0; i < 2000; i += 1) {
    const r = row(`spread-${i}`, { correct_index: 0, correct_answer: 'A' }); // every stored key is A, as in the old banks
    counts[servedRow(r).row.correct_index] += 1;
    orders.add(stableOrder(r).join(''));
  }
  assert.equal(orders.size, 24, 'every permutation of four appears');
  for (const c of counts) assert.ok(c > 2000 * 0.2 && c < 2000 * 0.3, `about 25% each: ${counts}`);
});

test('grading round trip: every served letter maps to its stored option and back; only the key is right', () => {
  for (let i = 0; i < 100; i += 1) {
    const r = row(`rt-${i}`);
    const order = stableOrder(r);
    const servedKey = servedRow(r).row.correct_answer;
    for (let s = 0; s < 4; s += 1) {
      const letter = LETTERS[s];
      const stored = storedLetterOfServed(r, letter);
      assert.equal(stored, LETTERS[order[s]]);
      assert.equal(servedLetterOfStored(r, stored), letter);
      assert.equal(servedIndexOf(order, storedIndexOf(order, s)), s);
      assert.equal(storedLetter(r, order, letter), stored, 'Learn persists the stored letter');
      // Explore and Saved: the posted served letter is graded and kept as the stored one.
      const answer = storedAnswerOf(r, { selected_key: letter });
      assert.deepEqual(answer, { selectedKey: stored, correct: letter === servedKey });
      // Mob race and Revise: a served index goes back to the stored index the stored key is compared with.
      assert.equal(storedIndexOf(order, s) === r.correct_index, letter === servedKey);
    }
  }
});

test('items that must keep their order keep it (the NTA engine rules), the rest have their explanation letters rewritten', () => {
  const kept = [
    row('k-all', { options: ['Only P', 'Only Q', 'Both P and Q', 'All of the above'], correct_index: 3, correct_answer: 'D' }),
    row('k-both', { options: ['Profit', 'Loss', 'Both A and B', 'Neither A nor B'], correct_index: 2, correct_answer: 'C' }),
    row('k-none', { options: ['10%', '12%', '15%', 'None of these'], correct_index: 3, correct_answer: 'D' }),
    row('k-noerror', { options: ['He go', 'to school', 'every day', 'No error'], correct_index: 0, correct_answer: 'A' }),
    row('k-stem', { question: 'Which is correct? Note that option A is a trap.' }),
    row('k-unresolved', { correct_index: null, correct_answer: null }),
  ];
  for (const r of kept) {
    const s = servedRow(r);
    assert.equal(s.shuffled, false, r.id);
    assert.deepEqual(s.order, [0, 1, 2, 3], r.id);
    assert.ok(s.reasons.length > 0, r.id);
    assert.deepEqual(learnServed(r).options.map((o) => o.text), r.options, r.id);
  }
  // An explanation that names the key by letter is rewritten to the served letter.
  for (let i = 0; i < 40; i += 1) {
    const r = row(`expl-${i}`, { explanation: 'Option B is correct: a deed may be oral or written.' });
    const s = servedRow(r);
    if (!s.shuffled) continue;
    assert.equal(s.row.explanation, `Option ${s.row.correct_answer} is correct: a deed may be oral or written.`);
    assert.equal(learnServed(r).explanation, s.row.explanation);
    assert.equal(feedServed(r).explanation, s.row.explanation);
  }
});

test('stored letters: a stored option keeps its own key; object options and self-letter prefixes are served plain', () => {
  const r = row('obj-1', { options: ['A. It must be in writing', 'B. It may be oral or written', 'C. It must be registered', 'D. It needs a court order'] });
  const served = servedRow(r).row;
  assert.ok(served.options.every((o) => !/^[A-D]\. /.test(textOf(o))), 'prefixes removed');
  const keyed = row('obj-2', { options: LETTERS.split('').map((k, i) => ({ key: k, text: ['w', 'x', 'y', 'z'][i] })) });
  const s = servedRow(keyed).row;
  assert.deepEqual(s.options.map((o) => o.key), ['A', 'B', 'C', 'D'], 'relabelled in served order');
  assert.equal(storedKeyAt(keyed.options, 2), 'C');
  assert.equal(storedKeyAt(['x', 'y'], 1), 'B');
});

test('old persisted rows keep their meaning', () => {
  // A Mob sitting of a paper served in the stored order (no optionOrders): picks are the stored indices already.
  const ids = ['q1', 'q2', 'q3'];
  const old = { details: [{ qid: 'q1', givenIndex: 2 }, { qid: 'q2', givenIndex: null }, { qid: 'q3', givenIndex: 0 }], selectionMeta: { mobPaper: { mobId: 'm' } } };
  assert.deepEqual(picksFromAttempt(ids, old), [2, -1, 0]);
  // A paper served in the stable order: each served pick goes back through the order kept on the attempt.
  const fresh = { ...old, selectionMeta: { mobPaper: { mobId: 'm', optionOrders: { q1: [3, 0, 2, 1], q3: [1, 2, 3, 0] } } } };
  assert.deepEqual(picksFromAttempt(ids, fresh), [2, -1, 1]);
  // Mob weeks before the change keep the stored order (and their letters); weeks from it serve the stable order.
  assert.equal(stableOrderWeek('2026-11-02'), false);
  assert.equal(stableOrderWeek(STABLE_ORDER_FROM_WEEK), true);
  assert.equal(stableOrderWeek('2026-11-16T00:00:00Z'), true);
  // The trap and the side-by-side name a stored pick by the letter the paper served it under; no order: the stored letter.
  const raw = { questionIndex: 0, questionNumber: 1, optionIndex: 3, count: 3, of: 4 };
  assert.equal(trapPayload(raw, { questionId: 'q1' }).option, 'D');
  assert.equal(trapPayload(raw, { questionId: 'q1', order: [3, 0, 2, 1] }).option, 'A');
  const members = [{ user_id: 'u1', show_score: true, joined_at: '2026-11-09T00:00:00Z' }];
  const sittings = [{ user_id: 'u1', picks: [3], detail: null }];
  const base = { members, sittings, ids: ['q1'], userId: 'u1', memberIdFor: (u) => u, access: 'full', week: '2026-11-09' };
  assert.equal(buildCompare({ ...base, questions: [{ id: 'q1', stem: 'S', correctIndex: 1 }] }).questions[0].you.picked, 'D');
  const shuffled = buildCompare({ ...base, questions: [{ id: 'q1', stem: 'S', correctIndex: 1, order: [3, 0, 2, 1] }] }).questions[0];
  assert.deepEqual([shuffled.you.picked, shuffled.key, shuffled.you.right], ['A', 'D', false]);
});

test('a repair check is offered in the stable order and marked by the option picked; its explanation names the served letter', () => {
  let marks = 0;
  for (let i = 0; i < 30; i += 1) {
    const r = { ...row(`chk-${i}`, { explanation: 'The key is B: a deed may be oral or written.' }), status: 'live', is_deleted: false, verification_state: 'verified' };
    const order = orderFromHashes(r, offeredHashes(r));
    assert.deepEqual(order, stableOrder(r));
    const keyShown = order.indexOf(1);
    const marked = markCheck({ row: r, order, pick: keyShown });
    if (!marked.ok) continue; // a fixture the integrity check refuses is not marked at all
    marks += 1;
    assert.equal(marked.right, true);
    assert.equal(marked.keyDisplay, keyShown);
    const said = explainedRow(r, order).explanation;
    if (servedRow(r).shuffled) assert.equal(said, `The key is ${LETTERS[keyShown]}: a deed may be oral or written.`);
    // An order that is not the stable one (the bank reordered its options after the offer) keeps the bank's words.
    assert.equal(explainedRow(r, [0, 1, 2, 3]).explanation, servedRow(r).shuffled && stableOrder(r).join('') === '0123' ? said : r.explanation);
  }
  assert.ok(marks > 0, 'some checks were marked');
});
