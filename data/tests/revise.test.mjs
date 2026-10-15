// Revise (feature wave F1) and "Same mistakes later" (data/revise.js, src/lib/server/revise.js; spec
// tmp/mistake-lab-v4/SPEC.md 4.8). Boxes 1, 3, 7 and 21 days in India days, 10 a day, no credits, no attempts row, and
// nothing written to the student's progress, so it is in no accuracy number.
// Fixtures: scripts/mistake-lab/build-s4-fixtures.mjs  (regenerate with: node scripts/mistake-lab/build-s4-fixtures.mjs)
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REVISE_RULES, istDate, addDays, daysBetween, dayLabel, capFrom, minutesFor, gradeCard, todaysQueue, boxCounts, planSeeds,
  whenPhrase, resultLine, endLine, reviseBody, buildLater,
} from '../revise.js';
import { getRevise, answerRevise, cardsFor, eligibleQuestion, reviseItem } from '../../src/lib/server/revise.js';
import { DELETION_STEPS } from '../../src/lib/server/accountDeletion.js';
import { fakeDb } from '../../scripts/mistake-lab/fake-db.mjs';
import { USER, REVISE_NOW, reviseWorld, labPaper, T0 } from '../../scripts/mistake-lab/build-s4-fixtures.mjs';

const card = (over = {}) => ({ user_id: USER, question_id: 'c1', box: 1, due_day: '2026-10-16', state: 'active', right_total: 0, last_recalled_day: null, updated_at: '2026-10-15T07:00:00.000Z', ...over });
const clone = (v) => JSON.parse(JSON.stringify(v));

test('the rules are F1\'s: four boxes at 1, 3, 7 and 21 days, 10 a day with 5 as a choice, 40 seconds a card', () => {
  assert.ok(Object.isFrozen(REVISE_RULES));
  assert.deepEqual(REVISE_RULES.days, { 1: 1, 2: 3, 3: 7, 4: 21 });
  assert.deepEqual([REVISE_RULES.cap, REVISE_RULES.capChoices, REVISE_RULES.seedMax, REVISE_RULES.secondsPerCard], [10, [5, 10], 200, 40]);
  assert.deepEqual([capFrom('5'), capFrom(5), capFrom('10'), capFrom('7'), capFrom(undefined), capFrom(null)], [5, 5, 10, 10, 10, 10]);
});

test('days are India days: 23:59 and 00:00 IST are different days, whatever the server clock says', () => {
  assert.equal(istDate(Date.parse('2026-10-15T18:29:59Z')), '2026-10-15'); // 23:59:59 IST
  assert.equal(istDate(Date.parse('2026-10-15T18:30:00Z')), '2026-10-16'); // 00:00:00 IST
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(addDays('2026-12-30', 3), '2027-01-02');
  assert.equal(daysBetween('2026-10-16', '2026-10-19'), 3);
  assert.equal(dayLabel('2026-10-16'), 'Fri 16 Oct');
  assert.equal(dayLabel('2026-10-19'), 'Mon 19 Oct');
});

test('a right recall moves a card up and sets its next day; a wrong recall drops it to box 1, due tomorrow; box 4 right is done', () => {
  const today = '2026-10-16';
  assert.deepEqual(gradeCard(card({ box: 1 }), true, today), { box: 2, due_day: '2026-10-19', state: 'active', right_total: 1, outcome: 'right' });
  assert.deepEqual(gradeCard(card({ box: 2, right_total: 1 }), true, today), { box: 3, due_day: '2026-10-23', state: 'active', right_total: 2, outcome: 'right' });
  assert.deepEqual(gradeCard(card({ box: 3, right_total: 2 }), true, today), { box: 4, due_day: '2026-11-06', state: 'active', right_total: 3, outcome: 'right' });
  assert.deepEqual(gradeCard(card({ box: 4, right_total: 3 }), true, today), { box: 4, due_day: '2026-11-06', state: 'retired', right_total: 4, outcome: 'done' });
  for (const box of [1, 2, 3, 4]) assert.deepEqual(gradeCard(card({ box, right_total: 2 }), false, today), { box: 1, due_day: '2026-10-17', state: 'active', right_total: 2, outcome: 'wrong' });
  assert.equal(gradeCard(card({ box: 9 }), false, today).box, 1);
  assert.equal(gradeCard(card({ box: 'x' }), true, today).box, 2, 'an unreadable box is box 1');
});

test('a card is done only after four right recalls, so its first two are always at least 3 days apart', () => {
  let state = card({ box: 1 });
  let day = '2026-10-16';
  const days = [];
  for (let i = 0; i < 4; i++) {
    const next = gradeCard(state, true, day);
    days.push(day);
    state = { ...state, ...next };
    if (next.state === 'retired') break;
    day = next.due_day;
  }
  assert.equal(state.state, 'retired');
  assert.deepEqual(days, ['2026-10-16', '2026-10-19', '2026-10-26', '2026-11-16'].slice(0, 4).map((d, i) => days[i]));
  assert.ok(daysBetween(days[0], days[1]) >= 3);
  assert.deepEqual(days.slice(1).map((d, i) => daysBetween(days[i], d)), [3, 7, 21]);
});

test('today\'s queue: the oldest due first, the cap counts what was answered today, 5 is a choice, later cards wait', () => {
  const cards = [
    card({ question_id: 'a', due_day: '2026-10-15' }), card({ question_id: 'b', due_day: '2026-10-16', box: 2 }), card({ question_id: 'c', due_day: '2026-10-16', box: 1 }),
    card({ question_id: 'd', due_day: '2026-10-17' }), card({ question_id: 'e', state: 'retired', due_day: '2026-10-10' }), card({ question_id: 'f', due_day: '2026-10-18', last_recalled_day: '2026-10-16' }),
  ];
  const q = todaysQueue({ cards, today: '2026-10-16', cap: 10 });
  assert.deepEqual(q.items.map((c) => c.question_id), ['a', 'c', 'b'], 'older due date, then the lower box');
  assert.equal(q.nextDay, '2026-10-17');
  assert.equal(q.answered, 1, 'f was answered today');
  assert.equal(todaysQueue({ cards, today: '2026-10-16', cap: 3 }).items.length, 2, 'the cap leaves room for what is left of 3');
  assert.equal(todaysQueue({ cards, today: '2026-10-16', cap: 1 }).items.length, 0);
  const many = Array.from({ length: 25 }, (_, i) => card({ question_id: `m${String(i).padStart(2, '0')}`, due_day: '2026-10-10' }));
  assert.equal(todaysQueue({ cards: many, today: '2026-10-16' }).items.length, 10);
  assert.equal(todaysQueue({ cards: many, today: '2026-10-16', cap: 5 }).items.length, 5);
  assert.equal(todaysQueue({ cards: many, today: '2026-10-16' }).due.length, 25, 'the rest wait for tomorrow');
  assert.deepEqual(boxCounts([...cards, card({ question_id: 'g', box: 4 })]), [4, 1, 0, 1], 'active cards only: the retired one is not counted');
});

test('minutes: 40 seconds a card, rounded up to the next 5 minutes', () => {
  assert.deepEqual([0, 1, 7, 8, 9, 10, 15, 16].map(minutesFor), [0, 5, 5, 10, 10, 10, 10, 15]);
});

test('seeding: a new wrong answer becomes a box 1 card due the next India day; blanks, right answers and a question under re-check are left out', () => {
  const at = (iso) => iso;
  const progress = [
    { question_id: 'w1', last_correct: false, last_selected_key: 'A', last_attempted_at: at('2026-10-15T18:00:00Z') }, // 23:30 IST on the 15th: due the 16th
    { question_id: 'w2', last_correct: false, last_selected_key: 'C', last_attempted_at: at('2026-10-15T19:00:00Z') }, // 00:30 IST on the 16th: due the 17th
    { question_id: 'blank', last_correct: false, last_selected_key: null, last_attempted_at: at('2026-10-15T10:00:00Z') },
    { question_id: 'right', last_correct: true, last_selected_key: 'B', last_attempted_at: at('2026-10-15T10:00:00Z') },
    { question_id: 'shuffled', last_correct: false, last_selected_key: 'B', last_attempted_at: at('2026-10-15T09:00:00Z') }, // a position in a shuffled paper that happens to be the stored key's letter
    { question_id: 'held', last_correct: false, last_selected_key: 'A', last_attempted_at: at('2026-10-15T10:00:00Z') },
  ];
  const plan = planSeeds({ progress, cards: [], usable: (id) => id !== 'held', keyHashOf: (id) => `h-${id}` });
  assert.deepEqual(plan.map((p) => [p.question_id, p.box, p.due_day, p.state, p.right_total, p.key_hash]), [['w2', 1, '2026-10-17', 'active', 0, 'h-w2'], ['w1', 1, '2026-10-16', 'active', 0, 'h-w1'], ['shuffled', 1, '2026-10-16', 'active', 0, 'h-shuffled']], 'newest wrong answer first; a picked letter equal to the stored key letter is no reason to drop a card, because a shuffled paper serves its own letters');
});

test('seeding is idempotent, resets a card only when the question was answered wrong again, and reads at most 200 newest', () => {
  const progress = [{ question_id: 'w1', last_correct: false, last_selected_key: 'A', last_attempted_at: '2026-10-14T10:00:00Z' }];
  const have = [card({ question_id: 'w1', box: 3, right_total: 2, updated_at: '2026-10-15T07:00:00.000Z' })];
  assert.deepEqual(planSeeds({ progress, cards: have }), [], 'already carded and not answered since');
  const again = [{ ...progress[0], last_attempted_at: '2026-10-16T05:00:00Z' }];
  const reset = planSeeds({ progress: again, cards: have });
  assert.deepEqual([reset[0].box, reset[0].due_day, reset[0].right_total], [1, '2026-10-17', 2], 'back to box 1, the count of right recalls kept');
  const lots = Array.from({ length: 260 }, (_, i) => ({ question_id: `x${i}`, last_correct: false, last_selected_key: 'A', last_attempted_at: new Date(Date.UTC(2026, 9, 1) + i * 60000).toISOString() }));
  const out = planSeeds({ progress: lots, cards: [] });
  assert.equal(out.length, 200);
  assert.equal(out[0].question_id, 'x259', 'the newest first');
  assert.equal(planSeeds({ progress: [{ question_id: 'bad', last_correct: false, last_selected_key: 'A', last_attempted_at: 'not a date' }], cards: [] }).length, 0);
});

test('the lines: when a card comes back, what a recall says, and the end of a run', () => {
  assert.equal(whenPhrase('2026-10-19', '2026-10-16'), 'in 3 days');
  assert.equal(whenPhrase('2026-10-23', '2026-10-16'), 'in 7 days');
  assert.equal(whenPhrase('2026-11-06', '2026-10-16'), 'in 21 days');
  assert.equal(whenPhrase('2026-10-21', '2026-10-16'), 'on Wed 21 Oct', 'an overdue card that was late moves on from today, so a day count that is not 3, 7 or 21 says the date');
  assert.equal(resultLine('right', '2026-10-19', '2026-10-16'), 'Right. It comes back in 3 days.');
  assert.equal(resultLine('wrong', '2026-10-17', '2026-10-16'), 'Not this time. It comes back tomorrow.');
  assert.equal(resultLine('done', null, '2026-10-16'), 'Right again. This one is done.');
  assert.equal(endLine({ right: 8, wrong: 2 }), '8 recalled, 2 come back tomorrow');
  assert.equal(endLine({ right: 3 }), '3 recalled');
  assert.equal(endLine({ wrong: 2 }), '2 come back tomorrow');
  assert.equal(endLine({}), null);
});

// ---------- The server ----------
const sizes = (db) => Object.fromEntries(Object.entries(db.tables).map(([k, v]) => [k, v.length]));

test('GET seeds the cards once, skips a question under re-check, and sends today\'s questions with no key', async () => {
  const world = reviseWorld();
  const db = fakeDb({ questions: world.questions, progress: world.progress, cards: world.cards });
  const first = await getRevise(USER, { db, now: REVISE_NOW });
  assert.equal(first.http, 200);
  const body = first.body;
  assert.deepEqual(body.items.map((i) => i.questionId), ['r-q5', 'r-q1', 'r-q2', 'r-q3'], 'r-q5 was seeded; r-q6 is held and skipped; r-q7 is due tomorrow');
  assert.equal(db.tables.revise_cards.length, 7, 'r-q5 was seeded, nothing else was');
  const seeded = db.tables.revise_cards.find((c) => c.question_id === 'r-q5');
  assert.deepEqual([seeded.box, seeded.due_day, seeded.state, seeded.user_id], [1, '2026-10-15', 'active', USER]);
  // The key never leaves before the answer: no key field in any item, nor the explanation, nor the correct letter.
  for (const item of body.items) {
    assert.deepEqual(Object.keys(item).sort(), ['box', 'chapter', 'options', 'passage', 'question', 'questionId', 'subject']);
    assert.equal(item.options.length, 4);
  }
  const text = JSON.stringify(body);
  assert.doesNotMatch(text, /correct|keyIndex|explanation|Illustrative stored/);
  // Idempotent: a second read changes nothing.
  const before = clone(db.tables.revise_cards);
  const second = await getRevise(USER, { db, now: REVISE_NOW });
  assert.deepEqual(db.tables.revise_cards, before);
  assert.deepEqual(second.body, body);
  assert.deepEqual([body.due, body.shown, body.minutes, body.cards, body.boxes], [4, 4, 5, 7, [4, 1, 1, 1]]);
});

test('Revise writes nothing but cards: no attempts row, nothing in user_question_progress, no credits', async () => {
  const world = reviseWorld();
  const db = fakeDb({ questions: world.questions, progress: world.progress, cards: world.cards });
  db.tables.attempts = [];
  const progressBefore = clone(db.tables.user_question_progress);
  const questionsBefore = clone(db.tables.questions);
  await getRevise(USER, { db, now: REVISE_NOW });
  await answerRevise(USER, { questionId: 'r-q1', choice: 1 }, { db, now: REVISE_NOW });
  await answerRevise(USER, { questionId: 'r-q2', choice: 0 }, { db, now: REVISE_NOW });
  assert.deepEqual(db.tables.user_question_progress, progressBefore, 'the student\'s record is untouched');
  assert.deepEqual(db.tables.questions, questionsBefore);
  assert.deepEqual(db.tables.attempts, []);
  const writes = db.calls.filter((c) => c.op === 'update' || c.op === 'upsert' || c.rpc).map((c) => c.table ?? c.rpc);
  assert.ok(writes.length > 0 && writes.every((t) => t === 'revise_cards'), `only revise_cards is written, saw ${[...new Set(writes)]}`);
  assert.ok(!db.calls.some((c) => c.rpc), 'no credit or wallet call');
});

test('a recall is graded on the server and answers with the key, the stored explanation and the card\'s next day', async () => {
  const world = reviseWorld();
  const db = fakeDb({ questions: world.questions, progress: [], cards: world.cards });
  const right = (await answerRevise(USER, { questionId: 'r-q1', choice: 1 }, { db, now: REVISE_NOW })).body;
  assert.deepEqual([right.ok, right.correct, right.keyIndex, right.box, right.dueDay, right.outcome], [true, true, 1, 2, '2026-10-19', 'right']);
  assert.equal(right.explanation, 'Illustrative stored explanation 1.');
  const wrong = (await answerRevise(USER, { questionId: 'r-q2', choice: 3 }, { db, now: REVISE_NOW })).body;
  assert.deepEqual([wrong.correct, wrong.keyIndex, wrong.box, wrong.dueDay], [false, 1, 1, '2026-10-17']);
  const done = (await answerRevise(USER, { questionId: 'r-q3', choice: 1 }, { db, now: REVISE_NOW })).body;
  assert.deepEqual([done.retired, done.dueDay, done.outcome], [true, null, 'done']);
  const stored = db.tables.revise_cards.find((c) => c.question_id === 'r-q1');
  assert.deepEqual([stored.box, stored.due_day, stored.last_recalled_day, stored.right_total], [2, '2026-10-19', '2026-10-16', 1]);
  assert.equal(db.tables.revise_cards.find((c) => c.question_id === 'r-q3').state, 'retired');
});

test('answering twice, answering a card that is not due, a bad request, a held question and a changed key are all refused without moving the card', async () => {
  const world = reviseWorld();
  const db = fakeDb({ questions: world.questions, progress: [], cards: world.cards });
  const opts = { db, now: REVISE_NOW };
  assert.equal((await answerRevise(USER, { questionId: 'r-q1', choice: 1 }, opts)).http, 200);
  const again = await answerRevise(USER, { questionId: 'r-q1', choice: 1 }, opts);
  assert.deepEqual([again.http, again.body.error], [409, 'not_due']);
  assert.equal((await answerRevise(USER, { questionId: 'r-q4', choice: 1 }, opts)).body.error, 'not_due', 'box 3, due on the 19th');
  assert.equal((await answerRevise(USER, { questionId: 'nope', choice: 1 }, opts)).body.error, 'not_due');
  for (const bad of [{}, { questionId: 'r-q2' }, { questionId: 'r-q2', choice: '1' }, { questionId: 'r-q2', choice: -1 }, { questionId: 'r-q2', choice: 1.5 }, { questionId: 7, choice: 1 }]) {
    assert.equal((await answerRevise(USER, bad, opts)).http, 422, JSON.stringify(bad));
  }
  assert.equal((await answerRevise(USER, { questionId: 'r-q2', choice: 4 }, opts)).body.error, 'question_unavailable', 'a choice past the options');
  assert.equal((await answerRevise(USER, { questionId: 'r-q6', choice: 1 }, opts)).body.error, 'question_unavailable', 'under re-check');
  assert.equal(db.tables.revise_cards.find((c) => c.question_id === 'r-q2').box, 2, 'nothing moved');
  // A card seeded against another key is retired, not graded.
  const changed = fakeDb({ questions: reviseWorld().questions, progress: [], cards: [card({ question_id: 'r-q1', key_hash: 'someotherhash0000' })] });
  const out = await answerRevise(USER, { questionId: 'r-q1', choice: 1 }, { db: changed, now: REVISE_NOW });
  assert.deepEqual([out.http, out.body.error], [409, 'key_changed']);
  assert.equal(changed.tables.revise_cards[0].state, 'retired');
});

test('the daily cap is kept on the server: 10 a day, 5 when chosen, and the rest wait', async () => {
  const questions = Array.from({ length: 14 }, (_, i) => ({ ...reviseWorld().questions[0], id: `c-q${i}` }));
  const cards = questions.map((x, i) => card({ question_id: x.id, due_day: '2026-10-10', user_id: USER, box: 1 + (i % 2) }));
  const pristine = clone(cards);
  const db = fakeDb({ questions, progress: [], cards });
  const got = await getRevise(USER, { db, now: REVISE_NOW });
  assert.deepEqual([got.body.shown, got.body.due, got.body.cap], [10, 14, 10]);
  let answered = 0;
  for (const item of got.body.items) { const r = await answerRevise(USER, { questionId: item.questionId, choice: 1 }, { db, now: REVISE_NOW }); if (r.http === 200) answered += 1; }
  assert.equal(answered, 10);
  const over = await answerRevise(USER, { questionId: 'c-q13', choice: 1 }, { db, now: REVISE_NOW });
  assert.deepEqual([over.http, over.body.error], [409, 'cap_reached']);
  const after = await getRevise(USER, { db, now: REVISE_NOW });
  assert.equal(after.body.shown, 0);
  assert.equal(after.body.head, 'Nothing to revise today');
  const five = await getRevise(USER, { db: fakeDb({ questions, progress: [], cards: pristine }), now: REVISE_NOW, cap: 5 });
  assert.deepEqual([five.body.shown, five.body.cap], [5, 5]);
  const tomorrow = await getRevise(USER, { db, now: REVISE_NOW + 86_400_000 });
  assert.equal(tomorrow.body.shown, 4, 'tomorrow: the 4 that waited (the 10 answered today are due again in 3 and 1 days)');
});

test('with no table the answer is state unavailable, and with no cards the state is empty', async () => {
  const world = reviseWorld();
  const missing = fakeDb({ questions: world.questions, progress: [], cards: [], failures: { 'revise_cards:select': { code: '42P01', message: 'relation "public.revise_cards" does not exist' } } });
  const out = await getRevise(USER, { db: missing, now: REVISE_NOW });
  assert.deepEqual([out.http, out.body.state, out.body.items], [503, 'unavailable', []]);
  assert.equal((await answerRevise(USER, { questionId: 'r-q1', choice: 1 }, { db: missing, now: REVISE_NOW })).body.state, 'unavailable');
  const empty = (await getRevise(USER, { db: fakeDb({ questions: world.questions, progress: [], cards: [] }), now: REVISE_NOW })).body;
  assert.deepEqual([empty.state, empty.shown, empty.head, empty.summary, empty.next], ['empty', 0, 'Nothing to revise today', null, 'Questions you get wrong in a paper or a practice set come back here after 1, 3, 7 and 21 days.']);
  // A failed progress read keeps the cards already stored.
  const flaky = fakeDb({ questions: world.questions, progress: world.progress, cards: world.cards, failures: { 'user_question_progress:select': { message: 'boom' } } });
  assert.equal((await getRevise(USER, { db: flaky, now: REVISE_NOW })).body.shown, 3);
});

test('a question may be asked only when live, not under re-check, with a readable key; the item carries no key', () => {
  const ok = reviseWorld().questions[0];
  assert.equal(eligibleQuestion(ok), true);
  for (const bad of [{ status: 'pending' }, { is_deleted: true }, { verification_state: 'disputed' }, { options: ['only one'] }, { correct_answer: 'Z' }, { options: null }]) assert.equal(eligibleQuestion({ ...ok, ...bad }), false, JSON.stringify(bad));
  assert.equal(eligibleQuestion(null), false);
  const item = reviseItem({ ...ok, passage_text: ' A passage. ' }, { box: 2 });
  assert.deepEqual(item.passage, { text: 'A passage.' });
  assert.deepEqual(item.options, ['Illustrative option 1a', 'Illustrative option 1b', 'Illustrative option 1c', 'Illustrative option 1d']);
  assert.equal(item.box, 2);
});

test('cards for a paper\'s questions are read without seeding, and a failed read is null', async () => {
  const world = reviseWorld();
  const db = fakeDb({ questions: world.questions, progress: world.progress, cards: world.cards });
  const map = await cardsFor(USER, ['r-q1', 'r-q2', 'r-q5', 'r-q1', null], { db });
  assert.deepEqual([...map.keys()].sort(), ['r-q1', 'r-q2', 'r-q5']);
  assert.deepEqual(map.get('r-q5'), { question_id: 'r-q5', box: 1, due_day: '2026-10-15', state: 'active' }, 'the card Revise will seed: the day after the wrong answer');
  assert.equal(db.tables.revise_cards.length, 6, 'r-q5 was not seeded by this read');
  assert.deepEqual(await cardsFor(USER, [], { db }), new Map());
  assert.equal(await cardsFor(USER, ['r-q1'], { db: fakeDb({ cards: [], failures: { 'revise_cards:select': { message: 'x' } } }) }), null);
});

test('cards for a paper say what the next read of Revise will hold: a re-wrong card is reset, a question answered right since comes back no more', async () => {
  const card = (id, over) => ({ user_id: USER, question_id: id, box: 3, due_day: '2026-10-30', state: 'active', right_total: 2, last_recalled_day: '2026-10-09', key_hash: null, wrong_at: null, created_at: '2026-10-09T07:00:00.000Z', updated_at: '2026-10-09T07:00:00.000Z', ...over });
  const prog = (id, correct, at) => ({ user_id: USER, question_id: id, last_correct: correct, last_selected_key: 'B', last_attempted_at: at });
  const db = fakeDb({
    cards: [card('again'), card('kept'), card('done', { state: 'retired', box: 4 }), card('rightSince')],
    progress: [
      prog('again', false, '2026-10-15T09:00:00.000Z'), // wrong again after the card last changed
      prog('kept', false, '2026-10-08T09:00:00.000Z'), // the card is newer than this wrong answer
      prog('done', false, '2026-10-15T09:00:00.000Z'), // wrong again after its card was done
      prog('rightSince', true, '2026-10-15T09:00:00.000Z'), // answered right since, in practice
      prog('fresh', false, '2026-10-15T09:00:00.000Z'), // no card yet
      prog('rightNew', true, '2026-10-15T09:00:00.000Z'),
    ],
  });
  const map = await cardsFor(USER, ['again', 'kept', 'done', 'rightSince', 'fresh', 'rightNew', 'neverSeen'], { db });
  const brief = (id) => { const c = map.get(id); return [c.state, c.box, c.due_day]; };
  assert.deepEqual(brief('again'), ['active', 1, '2026-10-16'], 'reset to box 1, due the day after the new wrong answer');
  assert.deepEqual(brief('kept'), ['active', 3, '2026-10-30'], 'the stored card stands');
  assert.deepEqual(brief('done'), ['active', 1, '2026-10-16'], 'a done card that was answered wrong again comes back');
  assert.deepEqual(brief('rightSince'), ['active', 3, '2026-10-30'], 'its card is still there and still due');
  assert.deepEqual(brief('fresh'), ['active', 1, '2026-10-16']);
  assert.equal(map.get('rightNew').state, 'none');
  assert.equal(map.get('neverSeen').state, 'none');
  assert.equal(db.tables.revise_cards.find((c) => c.question_id === 'again').box, 3, 'nothing was written');
  // The Lab line follows it: only the questions that will really come back are promised.
  const paper = { id: 'pp', completedAt: Date.UTC(2026, 9, 15, 6, 30), questionsSnapshot: ['again', 'fresh', 'rightNew', 'neverSeen'].map((id) => ({ id, options: ['a', 'b', 'c', 'd'], correctIndex: 0 })), details: ['again', 'fresh', 'rightNew', 'neverSeen'].map((id) => ({ qid: id, givenIndex: 1, isCorrect: false })) };
  const line = buildLater({ attempt: paper, allAttempts: [paper], cards: map, now: Date.UTC(2026, 9, 15, 7, 0) });
  assert.deepEqual([line.count, line.total, line.when, line.line], [2, 2, 'tomorrow', '2 of these come back tomorrow, Fri 16 Oct.'], 'the two questions the student answered right since are not promised');
  // A failed progress read leaves only the stored cards.
  const noProgress = fakeDb({ cards: [card('kept')], progress: [prog('x', false, '2026-10-15T09:00:00.000Z')], failures: { 'user_question_progress:select': { message: 'x' } } });
  assert.deepEqual([...(await cardsFor(USER, ['kept', 'x'], { db: noProgress })).keys()], ['kept']);
});

test('account deletion removes Revise cards before the user row', () => {
  const tables = DELETION_STEPS.map((s) => s.table);
  assert.equal(DELETION_STEPS.find((s) => s.table === 'revise_cards').action, 'delete');
  assert.ok(tables.indexOf('revise_cards') < tables.indexOf('users'));
});

// ---------- Same mistakes later ----------
const PAPER = labPaper();
const HELD = { 'p1-q7': { state: 'under_review' } };

test('Same mistakes later: this paper\'s clean wrong answers, tomorrow, with the spec\'s line', () => {
  const later = buildLater({ attempt: PAPER, allAttempts: [PAPER], answerReviews: HELD, cards: null, now: T0 + 3_600_000 });
  assert.equal(later.line, '7 of these come back tomorrow, Fri 16 Oct.');
  assert.equal(later.note, 'Same questions, so this checks memory. Fresh questions check the idea.');
  assert.deepEqual([later.state, later.count, later.when, later.dueDay, later.href], ['scheduled', 7, 'tomorrow', '2026-10-16', '/review/revise']);
  assert.match(later.fine, /10 questions a day at most/);
  assert.match(later.fine, /not counted in any accuracy number/);
});

test('later: held questions, blanks, right answers and questions answered again since are left out', () => {
  const noHold = buildLater({ attempt: PAPER, allAttempts: [PAPER], answerReviews: {}, cards: null, now: T0 });
  assert.equal(noHold.count, 8);
  const again = { id: 'later-paper', completedAt: T0 + 3600_000, questionsSnapshot: PAPER.questionsSnapshot, details: [{ qid: 'p1-q1', givenIndex: 0, isCorrect: true }, { qid: 'p1-q2', givenIndex: 3, isCorrect: false }] };
  const out = buildLater({ attempt: PAPER, allAttempts: [PAPER, again], answerReviews: HELD, cards: null, now: T0 });
  assert.equal(out.count, 5, 'q1 and q2 were answered again later, so their next card is the later answer\'s');
  const oneWrong = { ...PAPER, details: PAPER.details.map((d) => (d.qid === 'p1-q1' ? d : { ...d, isCorrect: true, givenIndex: 0 })) };
  assert.equal(buildLater({ attempt: oneWrong, allAttempts: [oneWrong], cards: null, now: T0 }).line, '1 of these comes back tomorrow, Fri 16 Oct.');
  const none = { ...PAPER, details: PAPER.details.map((d) => ({ ...d, isCorrect: true, givenIndex: 0 })) };
  assert.equal(buildLater({ attempt: none, allAttempts: [none], cards: null, now: T0 }), null);
  assert.equal(buildLater({ attempt: { id: 'x', completedAt: T0, questionsSnapshot: [], details: [] }, cards: null, now: T0 }), null);
  assert.equal(buildLater({}), null);
});

test('later: the day follows the real cards when they are known, and an old paper with no card read says nothing', () => {
  const day = 86_400_000;
  const cards = new Map([
    ['p1-q1', { question_id: 'p1-q1', box: 2, due_day: '2026-10-19', state: 'active' }],
    ['p1-q2', { question_id: 'p1-q2', box: 4, due_day: '2026-11-06', state: 'retired' }],
  ]);
  const two = buildLater({ attempt: PAPER, allAttempts: [PAPER], answerReviews: HELD, cards, now: T0 + 3_600_000 });
  assert.deepEqual([two.count, two.when, two.dueDay], [5, 'tomorrow', '2026-10-16'], 'q2 is done; q3 to q6 and q10 are due tomorrow; q1 on the 19th');
  const onlyLater = buildLater({ attempt: PAPER, allAttempts: [PAPER], answerReviews: HELD, cards: new Map(['p1-q1', 'p1-q2', 'p1-q3', 'p1-q4', 'p1-q5', 'p1-q6', 'p1-q10'].map((id) => [id, { question_id: id, box: 2, due_day: '2026-10-19', state: 'active' }])), now: T0 + 3_600_000 });
  assert.deepEqual([onlyLater.when, onlyLater.line], ['day', '7 of these come back on Mon 19 Oct.']);
  const due = buildLater({ attempt: PAPER, allAttempts: [PAPER], answerReviews: HELD, cards: new Map(), now: T0 + 3 * day });
  assert.deepEqual([due.when, due.count, due.line], ['now', 7, '7 of these are ready to revise now.']);
  assert.equal(buildLater({ attempt: PAPER, allAttempts: [PAPER], answerReviews: HELD, cards: null, now: T0 + 3 * day }), null, 'not known, so not said');
  assert.equal(buildLater({ attempt: PAPER, allAttempts: [PAPER], answerReviews: HELD, cards: null, now: T0 + day }).when, 'now', 'on the day it is due, nothing has been revised yet for an unseen card');
});

test('reviseBody is finished for the clients: head, summary, minutes and the next day', () => {
  const cards = [card({ question_id: 'a' }), card({ question_id: 'b', due_day: '2026-10-20', right_total: 2 })];
  const body = reviseBody({ cards, items: [{ questionId: 'a' }], today: '2026-10-16', cap: 10 });
  assert.deepEqual([body.head, body.summary, body.next, body.minutes, body.state], ['1 question to revise today', '1 due today. 2 cards, 1 recalled twice.', 'The next ones are due on Tue 20 Oct.', 5, 'ready']);
  assert.equal(reviseBody({ cards, items: [], today: '2026-10-16' }).head, 'Nothing to revise today');
  assert.equal(reviseBody({ cards: [card({ question_id: 'a' })], items: [{ questionId: 'a' }], today: '2026-10-16' }).summary, '1 due today. 1 card, 0 recalled twice.', 'one card is "1 card", never "1 cards"');
});

test('later: a paper with more wrong answers than the day\'s cap says 10 come back and when the rest follow', () => {
  const wrongPaper = (n) => ({
    id: 'big', completedAt: T0, questionsSnapshot: Array.from({ length: n }, (_, i) => ({ id: `big${i}`, options: ['a', 'b', 'c', 'd'], correctIndex: 0 })),
    details: Array.from({ length: n }, (_, i) => ({ qid: `big${i}`, givenIndex: 1, isCorrect: false })),
  });
  const twelve = buildLater({ attempt: wrongPaper(12), cards: null, now: T0 });
  assert.equal(twelve.line, '10 of these come back tomorrow, Fri 16 Oct. The other 2 follow a day or more later.');
  assert.deepEqual([twelve.count, twelve.total], [10, 12]);
  assert.equal(buildLater({ attempt: wrongPaper(11), cards: null, now: T0 }).line, '10 of these come back tomorrow, Fri 16 Oct. The other 1 follows a day or more later.');
  assert.equal(buildLater({ attempt: wrongPaper(10), cards: null, now: T0 }).line, '10 of these come back tomorrow, Fri 16 Oct.');
});
