// Revise as one queue (LEARN-REVIEW-1017 5.8, packet P-LR2): src/components/revise/reviseQueue.js (pure) and the merged due list in
// src/lib/server/revise.js. Acceptance 9: with 5 wrong answers due, 1 repaired mistake due again, 1 pending Check it held and 2 due
// cards Revise says "9 due today" and plays nine cards; a question due in two sources plays once; Review's count equals the run's.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CARD_CAP, advance, answeredCount, filterSource, footLine, headLine, isFinished, itemKey, kindLine, mergeQueue, mixLine, nextWhen, positionLine,
  recordAnswer, remaining, skipItem, startRun, summary,
} from '../../src/components/revise/reviseQueue.js';
import { getRevise, answerRevise } from '../../src/lib/server/revise.js';
import { reviseDue } from '../review_input.mjs';
import { fakeDb } from '../../scripts/mistake-lab/fake-db.mjs';
import { USER, REVISE_NOW, reviseWorld } from '../../scripts/mistake-lab/build-s4-fixtures.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name) => JSON.parse(readFileSync(resolve(here, `fixtures/review/${name}.json`), 'utf8'));
const due = (id, dueDay = '2026-10-16', box = 1, extra = {}) => ({ questionId: id, dueDay, box, question: `Stem ${id}`, options: ['a', 'b', 'c', 'd'], ...extra });
const check = (attemptId, questionId, number = 1) => ({ attemptId, questionId, number, paper: 'Mock 2', chapter: 'Cash flow statement' });

test('one card per question per day: a question due as a wrong answer and as a repaired mistake plays once, as the repaired one', () => {
  const q = mergeQueue({ questions: [due('a'), due('b'), due('c')], again: [due('b', '2026-10-16', 2)], checks: [], cards: 0 });
  assert.equal(q.items.length, 3);
  assert.deepEqual(q.items.map((i) => [i.questionId, i.kind]).sort(), [['a', 'question'], ['b', 'again'], ['c', 'question']]);
  assert.equal(q.items.find((i) => i.questionId === 'b').box, 2, 'the repaired mistake keeps its own card fields');
  assert.deepEqual(q.counts, { questions: 2, again: 1, checks: 0, cards: 0, back: 3 });
  assert.equal(q.total, 3);
});

test('a question twice in one source is one card too', () => {
  const q = mergeQueue({ questions: [due('a'), due('a')], again: [due('z'), due('z')] });
  assert.deepEqual(q.items.map((i) => i.questionId).sort(), ['a', 'z']);
});

test('the daily cap holds the questions and the repaired mistakes, not the checks; cards add at most five', () => {
  const many = Array.from({ length: 14 }, (_, i) => due(`m${String(i).padStart(2, '0')}`, '2026-10-10'));
  const q = mergeQueue({ questions: many, checks: [check('p1', 'x'), check('p1', 'y')], cards: 9, cap: 10 });
  assert.equal(q.counts.back, 10);
  assert.equal(q.dropped, 4, 'the rest wait for tomorrow');
  assert.equal(q.counts.checks, 2, 'a Check it held is always included');
  assert.equal(q.counts.cards, CARD_CAP);
  assert.equal(q.total, 10 + 2 + CARD_CAP);
  const five = mergeQueue({ questions: many, cap: 5 });
  assert.equal(five.counts.back, 5);
  const used = mergeQueue({ questions: many, cap: 10, answered: 7 });
  assert.equal(used.counts.back, 3, 'what was answered today uses the cap up');
  assert.equal(mergeQueue({ questions: many, cap: 10, answered: 12 }).counts.back, 0);
  assert.equal(mergeQueue({ questions: many, cap: 7 }).counts.back, 10, 'a cap that is not 5 or 10 is 10');
});

test('the play order: oldest due first (then the lower box), then the checks, then the concept cards', () => {
  const q = mergeQueue({
    questions: [due('late', '2026-10-16'), due('old', '2026-10-12'), due('box2', '2026-10-16', 2)], again: [due('rep', '2026-10-14', 3)],
    checks: [check('p2', 'k')], cards: 2,
  });
  assert.deepEqual(q.items.map((i) => i.kind), ['question', 'again', 'question', 'question', 'check', 'card', 'card']);
  assert.deepEqual(q.items.slice(0, 4).map((i) => i.questionId), ['old', 'rep', 'late', 'box2']);
});

test('an unknown count of lesson cards is counted as none and named, never shown as zero cards', () => {
  const q = mergeQueue({ questions: [due('a')], cards: null });
  assert.equal(q.counts.cards, 0);
  assert.deepEqual(q.unknown, ['cards']);
  assert.deepEqual(mergeQueue({ questions: [due('a')], cards: 0 }).unknown, []);
});

test('an item with no id, and a check with no attempt, are not played', () => {
  const q = mergeQueue({ questions: [{ dueDay: '2026-10-16' }, due('a')], checks: [{ questionId: 'x' }, check('p', 'y'), check('p', 'y')] });
  assert.equal(q.items.length, 2, 'one question and one check (the repeat is the same check)');
});

test('Review, the head of the run and the badge agree: the queue counts equal reviseDue() on every shared fixture', () => {
  for (const name of ['student', 'check_pending', 'zero_credits', 'all_held', 'revise_dedupe', 'empty', 'nothing_missed']) {
    const record = fixture(name);
    if (!record.revise) continue;
    const want = reviseDue(record);
    const s = record.revise.sources;
    const toItems = (ids) => (ids || []).map((id) => due(id));
    const got = mergeQueue({
      questions: toItems(s?.questions), again: toItems(s?.again),
      checks: (s?.checks || []).map((id) => check(id.split(':')[0], id.split(':')[1])), cards: s ? s.cards : record.revise.dueToday?.cards ?? 0, cap: record.revise.cap, answered: record.revise.answeredToday || 0,
    });
    if (s) assert.deepEqual([got.counts.questions, got.counts.again, got.counts.checks, got.counts.cards, got.total, got.minutes], [want.questions, want.again, want.checks, want.cards, want.total, want.minutes], name);
  }
  const dedupe = fixture('revise_dedupe');
  const want = reviseDue(dedupe);
  assert.equal(want.head, '9 due today');
  assert.equal(headLine(want.total, want.minutes), `9 due today, about ${want.minutes} minutes.`);
  assert.equal(mixLine({ back: want.questions + want.again, checks: want.checks, cards: want.cards }), '6 questions back, 1 Check it held, 2 concept cards');
});

test('the head and the mix line: one sentence, only the parts that exist', () => {
  assert.equal(headLine(8, 10), '8 due today, about 10 minutes.');
  assert.equal(headLine(0, 0), 'Nothing due today');
  assert.equal(mixLine({ back: 5, checks: 1, cards: 2 }), '5 questions back, 1 Check it held, 2 concept cards');
  assert.equal(mixLine({ back: 1, checks: 0, cards: 1 }), '1 question back, 1 concept card');
  assert.equal(mixLine({ back: 0, checks: 0, cards: 0 }), '');
  assert.equal(positionLine(2, 8), '3 of 8');
  assert.equal(positionLine(9, 8), '8 of 8');
});

test('what a card is: the kind line says whose question it is, where it came from and, for a check, which rule', () => {
  assert.deepEqual(kindLine({ kind: 'question', source: 'Mock 2, 12 Oct, 10:42 PM', chapter: 'Cash flow statement' }), { title: 'A question you got wrong', detail: 'Mock 2, 12 Oct, 10:42 PM. Cash flow statement' });
  assert.deepEqual(kindLine({ kind: 'again', source: null, chapter: 'Issue of shares' }), { title: 'A mistake you repaired', detail: 'Issue of shares' });
  assert.deepEqual(kindLine({ kind: 'check', number: 27, paper: 'Mock 2', chapter: 'Cash flow statement' }), { title: 'Check it held: your Q27 rule', detail: 'Mock 2. Cash flow statement' });
  assert.equal(kindLine({ kind: 'card', lesson: 'Sacrificing and gaining ratios' }).title, 'A card from Sacrificing and gaining ratios');
  assert.equal(kindLine({ kind: 'question' }).detail, null);
});

test('the copy never names the old runs: no "Review again", "questions to review", "Lock in" or "check on a new question" (acceptance 3)', () => {
  const copy = JSON.stringify(JSON.parse(readFileSync(resolve(here, '../mistake_lab.copy.json'), 'utf8')).revise.run);
  for (const banned of [/review again/i, /questions to review/i, /lock in/i, /check on a new question/i, /review due/i]) assert.doesNotMatch(copy, banned);
  assert.match(copy, /Check it held/);
});

test('the line under the options is free, and says when a right answer sends the card back (the box it moves to)', () => {
  assert.equal(nextWhen(1), 'in 3 days');
  assert.equal(nextWhen(2), 'in 7 days');
  assert.equal(nextWhen(3), 'in 21 days');
  assert.equal(nextWhen(4), null, 'box 4 right finishes the card');
  assert.equal(footLine({ kind: 'question', box: 1 }, nextWhen(1)), 'Free. Not counted in your marks or accuracy. A right answer sends it back in 3 days.');
  assert.equal(footLine({ kind: 'question', box: 4 }, nextWhen(4)), 'Free. Not counted in your marks or accuracy. A right answer finishes it.');
  assert.match(footLine({ kind: 'check' }), /^Free\. Not counted in your marks or accuracy\. A new question on the same idea/);
});

test('?source= plays one source; an unknown source plays everything; cards plays everything a recall run holds', () => {
  const q = mergeQueue({ questions: [due('a'), due('b')], again: [due('r')], checks: [check('p', 'k')], cards: 2 });
  assert.equal(q.total, 6);
  assert.deepEqual(filterSource(q, 'cards').items.map((i) => i.kind), ['card', 'card']);
  assert.deepEqual(filterSource(q, 'again').items.map((i) => i.questionId), ['r']);
  assert.equal(filterSource(q, 'questions').counts.back, 2);
  assert.equal(filterSource(q, 'checks').counts.checks, 1);
  assert.equal(filterSource(q, 'nonsense'), q);
  assert.equal(filterSource(q, null), q);
  const lockIn = filterSource({ ...q, cardsAvailable: 7 }, 'cards');
  assert.equal(lockIn.total, 7, 'Today\'s "Lock in new cards" lands on the cards that a recall run would play');
  assert.equal(filterSource({ ...q, cardsAvailable: 40 }, 'cards').total, 10, 'a recall run holds at most 10');
  assert.equal(filterSource(q, 'cards').total, 2);
});

test('the run: one answer per item, a second report changes nothing, a skip is not an answer, the badge number follows the answers', () => {
  const q = mergeQueue({ questions: [due('a'), due('b')], checks: [check('p', 'k')], cards: 1 });
  let run = startRun(q.items);
  assert.equal(remaining(run), 4);
  const [a, b, k, card] = q.items;
  run = recordAnswer(run, a, { correct: true });
  const again = recordAnswer(run, a, { correct: false });
  assert.equal(again, run, 'the same item answered twice is one schedule update');
  assert.equal(answeredCount(run), 1);
  assert.equal(remaining(run), 3);
  run = advance(run);
  run = advance(recordAnswer(run, b, { correct: false }));
  run = advance(skipItem(run, k));
  assert.equal(answeredCount(run), 2, 'a skipped Check it held is still due');
  assert.equal(remaining(run), 2);
  assert.equal(isFinished(run), false);
  run = advance(recordAnswer(run, card, { correct: true }));
  assert.equal(isFinished(run), true);
  assert.deepEqual(summary(run), { recalled: 1, comeBack: 1, held: 0, slipped: 0, cards: 1, answered: 3 });
  assert.equal(itemKey(k), 'check:p:k');
  assert.equal(itemKey(card), 'card:1');
});

test('the end of a run counts a held check and a slipped one separately from the questions', () => {
  const q = mergeQueue({ questions: [due('a')], checks: [check('p', 'k1'), check('p', 'k2')] });
  let run = startRun(q.items);
  run = recordAnswer(run, q.items[0], { correct: true });
  run = recordAnswer(run, q.items[1], { correct: true });
  run = recordAnswer(run, q.items[2], { correct: false });
  assert.deepEqual(summary(run), { recalled: 1, comeBack: 0, held: 1, slipped: 1, cards: 0, answered: 3 });
});

// ---------------------------------------------------------------- the server: the merged due list from the database

const NOW = REVISE_NOW;
const record = (over = {}) => ({
  state: 'ready',
  papers: [{ id: 'p-old', name: 'Mock 2', at: '2026-10-12T22:42:00+05:30' }, { id: 'p-new', name: 'Mock 3', at: '2026-10-16T21:40:00+05:30' }],
  chapters: [{ id: 'accountancy:Cash Flow Statement', name: 'Cash Flow Statement' }],
  items: [
    { paper: 'p-old', q: 5, qid: 'r-q1', ch: 'accountancy:Cash Flow Statement', state: 'open' },
    { paper: 'p-new', q: 9, qid: 'r-q2', ch: 'accountancy:Cash Flow Statement', state: 'repaired', repairedAt: '2026-10-13T11:00:00+05:30' },
    { paper: 'p-new', q: 12, qid: 'r-q3', ch: 'accountancy:Cash Flow Statement', state: 'held', repairedAt: '2026-10-13T11:00:00+05:30' },
    { paper: 'p-new', q: 30, qid: 'r-q9', ch: 'accountancy:Cash Flow Statement', state: 'repaired', repairedAt: '2026-10-16T20:00:00+05:30' },
  ],
  ...over,
});
const deps = (rec = record(), cards = 2) => ({ queue: { loadRecord: async () => rec, readDueCards: async () => cards } });

test('GET /api/me/revise without queue deps is the v1 body (no queue field): the contract the app reads is unchanged', async () => {
  const w = reviseWorld();
  const out = await getRevise(USER, { db: fakeDb(w), now: NOW });
  assert.equal(out.http, 200);
  assert.equal('queue' in out.body, false);
});

test('GET /api/me/revise with queue deps: the due questions, a repaired mistake as "again", the pending check, the cards, one head', async () => {
  const w = reviseWorld();
  const out = await getRevise(USER, { db: fakeDb(w), now: NOW, ...deps() });
  assert.equal(out.http, 200);
  const queue = out.body.queue;
  assert.equal(queue.version, 2);
  const kinds = Object.fromEntries(queue.items.filter((i) => i.questionId && i.kind !== 'check').map((i) => [i.questionId, i.kind]));
  assert.equal(kinds['r-q1'], 'question');
  assert.equal(kinds['r-q2'], 'again', 'the card of a repaired mistake plays with the key hidden, as the repaired one');
  assert.equal(kinds['r-q3'], 'again', 'a repaired mistake whose check was taken is still a repaired mistake');
  assert.deepEqual(queue.items.filter((i) => i.kind === 'check').map((c) => [c.attemptId, c.questionId]), [['p-new', 'r-q2']]);
  assert.equal(queue.items.filter((i) => i.kind === 'card').length, 2);
  assert.equal(queue.total, queue.items.length);
  assert.equal(queue.head, `${queue.total} due today, about ${queue.minutes} minutes.`);
  assert.equal(queue.cardsAvailable, 2);
  // the question's paper and time ride on the item, in the student's words
  const first = queue.items.find((i) => i.questionId === 'r-q1');
  assert.equal(first.source, 'Mock 2, 12 Oct, 10:42 PM');
  // the key and the explanation never leave the server
  assert.doesNotMatch(JSON.stringify(queue), /correct_index|explanation|keyIndex|key_hash/);
});

test('a repaired mistake a day later is a pending check; one repaired tonight is not (it is offered on its row)', async () => {
  const w = reviseWorld();
  const out = await getRevise(USER, { db: fakeDb(w), now: NOW, ...deps(record({ items: record().items.map((i) => ({ ...i })) })) });
  const checks = out.body.queue.items.filter((i) => i.kind === 'check');
  assert.deepEqual(checks.map((c) => c.questionId), ['r-q2'], 'r-q2 was repaired on 13 Oct; r-q9 tonight (16 Oct) joins tomorrow');
  assert.equal(checks[0].number, 9);
  assert.equal(checks[0].paper, 'Mock 3');
});

test('a failed Review record or lesson-card read degrades one part: the questions still play, the cards are unknown, never zero', async () => {
  const w = reviseWorld();
  const out = await getRevise(USER, { db: fakeDb(w), now: NOW, queue: { loadRecord: async () => { throw new Error('boom'); }, readDueCards: async () => null } });
  assert.equal(out.http, 200);
  const q = out.body.queue;
  assert.ok(q.counts.questions > 0);
  assert.equal(q.counts.checks, 0);
  assert.equal(q.counts.again, 0);
  assert.deepEqual(q.unknown, ['cards']);
  assert.equal(q.items.find((i) => i.kind === 'question').source, null, 'no paper label without the record');
});

test('a question due as a wrong answer and answered once moves one card once: a second answer is 409 not_due and nothing changes', async () => {
  const w = reviseWorld();
  const db = fakeDb(w);
  const first = await answerRevise(USER, { questionId: 'r-q1', choice: 1 }, { db, now: NOW });
  assert.equal(first.http, 200);
  const stored = structuredClone(db.tables.revise_cards.find((c) => c.question_id === 'r-q1'));
  const second = await answerRevise(USER, { questionId: 'r-q1', choice: 0 }, { db, now: NOW });
  assert.equal(second.http, 409);
  assert.equal(second.body.error, 'not_due');
  assert.deepEqual(db.tables.revise_cards.find((c) => c.question_id === 'r-q1'), stored);
});

test('the repaired mistake is promoted to mode "again" on the card when the column exists, and the read works when it does not', async () => {
  const w = reviseWorld();
  w.cards = w.cards.map((c) => ({ ...c, mode: 'question' }));
  const db = fakeDb(w);
  const out = await getRevise(USER, { db, now: NOW, ...deps() });
  assert.equal(out.http, 200);
  assert.equal(db.tables.revise_cards.find((c) => c.question_id === 'r-q2').mode, 'again');
  assert.equal(db.tables.revise_cards.find((c) => c.question_id === 'r-q1').mode, 'question');
  // no mode column: the cards carry no `mode` key at all, nothing is written, and the split is still right
  const w2 = reviseWorld();
  const db2 = fakeDb(w2);
  const out2 = await getRevise(USER, { db: db2, now: NOW, ...deps() });
  assert.equal(out2.body.queue.items.find((i) => i.questionId === 'r-q2').kind, 'again');
  assert.ok(!db2.tables.revise_cards.some((c) => 'mode' in c));
});

// ---------------------------------------------------------------- the badge number

test('the due count the badge reads: set when Revise has read it, counted down on each confirmed answer, null is unknown (never zero)', async () => {
  const { setReviseDue, getReviseDue } = await import('../../src/lib/reviseDue.js');
  assert.equal(getReviseDue(), undefined, 'nothing has read it yet: the badge asks /api/me/review');
  setReviseDue(8);
  assert.equal(getReviseDue(), 8);
  const q = mergeQueue({ questions: [due('a'), due('b')], checks: [check('p', 'k')], cards: 5 });
  let run = startRun(q.items);
  run = recordAnswer(run, q.items[0], { correct: true });
  run = recordAnswer(run, q.items[1], { correct: false });
  setReviseDue(Math.max(0, q.total - answeredCount(run)));
  assert.equal(getReviseDue(), 6, '8 cards, two confirmed: the badge reads 6');
  setReviseDue(-3);
  assert.equal(getReviseDue(), 0, 'never below zero');
  setReviseDue(null);
  assert.equal(getReviseDue(), null, 'unknown is kept as unknown');
  setReviseDue('x');
  assert.equal(getReviseDue(), undefined, 'garbage is not a number');
});

test('before the mode migration is applied (production today) the read falls back to the old columns and Revise still plays', async () => {
  const w = reviseWorld();
  const db = fakeDb(w);
  const selects = [];
  const from = db.from.bind(db);
  db.from = (table) => {
    const q = from(table);
    const select = q.select.bind(q);
    const run = q.run.bind(q);
    q.select = (cols) => { q.cols = cols; return select(cols); };
    q.run = () => {
      if (table === 'revise_cards' && q.op === 'select') selects.push(q.cols);
      if (table === 'revise_cards' && q.op === 'select' && /(^|,)mode(,|$)/.test(q.cols || '')) return { data: null, error: { code: '42703', message: 'column revise_cards.mode does not exist' } };
      return run();
    };
    return q;
  };
  const out = await getRevise(USER, { db, now: NOW, ...deps() });
  assert.equal(out.http, 200);
  assert.ok(selects.some((s) => /,mode$/.test(s)), 'it asks for mode first');
  assert.ok(selects.some((s) => !/mode/.test(s)), 'and reads again without it');
  assert.ok(out.body.queue.items.length > 0);
  assert.equal(out.body.queue.items.find((i) => i.questionId === 'r-q2' && i.kind !== 'check').kind, 'again', 'the split comes from the repairs, not the column');
});

test('acceptance 9 as written: 5 wrong answers, 1 repaired mistake due again, 1 pending Check it held and 2 cards say "9 due today" and play nine', () => {
  const five = ['w1', 'w2', 'w3', 'w4', 'w5'].map((id) => due(id));
  const q = mergeQueue({ questions: five, again: [due('r1', '2026-10-15', 2)], checks: [check('p1', 'c1', 27)], cards: 2, cap: 10 });
  assert.equal(q.total, 9);
  assert.match(headLine(q.total, q.minutes), /^9 due today, about \d+ minutes\.$/);
  assert.equal(mixLine(q.counts), '6 questions back, 1 Check it held, 2 concept cards');
  let run = startRun(q.items);
  for (const item of q.items) run = advance(recordAnswer(run, item, { correct: true }));
  assert.equal(answeredCount(run), 9);
  assert.ok(isFinished(run));
  // The same wrong answer also due as the repaired mistake plays once.
  const twice = mergeQueue({ questions: [...five, due('r1')], again: [due('r1', '2026-10-15', 2)], checks: [check('p1', 'c1', 27)], cards: 2, cap: 10 });
  assert.equal(twice.total, 9);
});

test('the empty state teaches: what comes back, a sample marked Example, one key to 10 questions; done today says what was done', () => {
  const run = JSON.parse(readFileSync(resolve(here, '../mistake_lab.copy.json'), 'utf8')).revise.run;
  assert.equal(run.empty.title, 'Nothing to revise yet');
  assert.equal(run.empty.body, 'Questions you get wrong come back here after 1, 3, 7 and 21 days.');
  assert.equal(run.empty.key, 'Start 10 questions');
  assert.equal(run.empty.example, 'Example');
  assert.match(run.empty.sampleSource, /^Mock \d, \d{1,2} [A-Z][a-z]{2}, \d{1,2}:\d{2} (AM|PM)\. /, 'the sample carries a paper and a 12-hour time');
  assert.equal(run.empty.time.replace('{subject}', 'Accountancy'), 'About 10 minutes, Accountancy.');
  assert.equal(run.end.doneToday.replace('{n}', '8'), '8 answered today.');
  assert.match(run.failed.body, /Your schedule is safe/);
});
