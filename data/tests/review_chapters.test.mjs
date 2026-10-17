// Review led by weak chapters (REVIEW-RESULT-1018 4.2 to 4.4 and 7, packet P-RR0). The reference student is
// data/tests/fixtures/review/student-1018.json, the same student as the mocks in tmp/design-1018/review-result/data.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chapterRows, savedRepairs, savedLine, reviewLine, acrossLine, actionFor, dayStamp, chaptersBody } from '../review_chapters.mjs';
import { reviewBody } from '../review_input.mjs';
import { buildReviewRecord } from '../../src/lib/server/review.js';

const dir = resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures/review');
const load = (name) => JSON.parse(readFileSync(resolve(dir, `${name}.json`), 'utf8'));
const student = load('student-1018');
const lostOfPaper = (p) => p.wrong * 6 + p.blank * 5;

test('the chapters add up to the marks the papers lost (220), and the head line says so', () => {
  const rows = chapterRows(student);
  const lost = rows.reduce((s, r) => s + r.lost, 0);
  assert.equal(lost, student.papers.reduce((s, p) => s + lostOfPaper(p), 0));
  assert.equal(lost, 220);
  assert.equal(reviewLine(student).text, 'Your 3 papers lost 220 marks: 30 wrong answers and 8 left blank. 9 are repaired.');
  assert.equal(acrossLine(student), 'Each chapter across Mock 3, Quick practice and Mock 2.');
});

test('every chapter: lost = on offer - scored, and wrong and blank equal its rows plus its foot', () => {
  for (const r of chapterRows(student)) {
    const right = r.questions - r.wrong - r.blank;
    assert.equal(r.offer, r.questions * 5, r.name);
    assert.equal(r.scored, right * 5 - r.wrong, r.name);
    assert.equal(r.lost, r.offer - r.scored, r.name);
    assert.equal(r.wrong, r.open.length + r.repaired.length, r.name);
    assert.equal(r.blank, r.blanks.length, r.name);
  }
});

test('the lead chapter reads as the mock draws it', () => {
  const [adm, second] = chapterRows(student);
  assert.equal(adm.name, 'Admission of a partner');
  assert.equal(`${adm.line.lead}${adm.line.rest}`, 'Lost 35 of the 80 marks on offer, 16 questions in Mock 3 and Mock 2. 5 wrong, 1 left blank.');
  assert.deepEqual(adm.open.map((i) => i.number), [42, 38, 45, 11]);
  assert.equal(adm.open[0].stamp, 'Mock 3, Fri 16 Oct, 9:40 PM');
  assert.deepEqual(adm.repaired.map((i) => [i.number, i.state]), [[17, 'slipped']]);
  assert.equal(second.name, 'Dissolution of a firm');
});

test('ranking: marks lost, then more wrong answers, then the newest paper', () => {
  const rec = {
    now: '2026-10-17T21:00:00+05:30',
    papers: [{ id: 'new', name: 'Mock 2', at: '2026-10-16T20:00:00+05:30' }, { id: 'old', name: 'Mock 1', at: '2026-10-10T20:00:00+05:30' }],
    chapters: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }],
    chapterQuestions: { new: { b: 5 }, old: { a: 5, c: 5 } },
    items: [
      // A: 5 blanks = 25 (no wrong). B: 3 wrong + 1 blank = 23. C: 2 wrong + ... make A and C tie on 30 with C more wrong.
      { paper: 'old', q: 1, ch: 'a', state: 'blank' }, { paper: 'old', q: 2, ch: 'a', state: 'blank' }, { paper: 'old', q: 3, ch: 'a', state: 'open' }, { paper: 'old', q: 4, ch: 'a', state: 'open' }, { paper: 'old', q: 5, ch: 'a', state: 'blank' },
      { paper: 'old', q: 6, ch: 'c', state: 'open' }, { paper: 'old', q: 7, ch: 'c', state: 'open' }, { paper: 'old', q: 8, ch: 'c', state: 'open' }, { paper: 'old', q: 9, ch: 'c', state: 'open' }, { paper: 'old', q: 10, ch: 'c', state: 'open' },
      { paper: 'new', q: 1, ch: 'b', state: 'open' }, { paper: 'new', q: 2, ch: 'b', state: 'open' }, { paper: 'new', q: 3, ch: 'b', state: 'open' }, { paper: 'new', q: 4, ch: 'b', state: 'open' }, { paper: 'new', q: 5, ch: 'b', state: 'open' },
    ],
  };
  // A = 2*6 + 3*5 = 27; B = 30 (5 wrong, newest paper); C = 30 (5 wrong, older paper).
  assert.deepEqual(chapterRows(rec).map((r) => [r.name, r.lost]), [['B', 30], ['C', 30], ['A', 27]]);
});

test('a held key leaves the chapter: out of the marks lost and out of the marks on offer', () => {
  const rec = structuredClone(student);
  const it = rec.items.find((i) => i.paper === 'm3' && i.q === 42);
  it.keyState = 'under_review';
  const adm = chapterRows(rec).find((r) => r.id === 'adm');
  assert.equal(adm.lost, 29);
  assert.equal(adm.offer, 75);
  assert.equal(adm.keyHeld, 1);
});

test('without chapterQuestions (an older server) the line states the marks lost alone', () => {
  const rec = { ...student, chapterQuestions: undefined };
  const adm = chapterRows(rec)[0];
  assert.equal(adm.offer, null);
  assert.equal(`${adm.line.lead}${adm.line.rest}`, 'Lost 35 marks in Mock 3 and Mock 2. 5 wrong, 1 left blank.');
});

test('Saved repairs: slipped, then waiting, then held; each opens free with one action', () => {
  const saved = savedRepairs(student);
  assert.equal(saved.length, 9);
  assert.deepEqual(saved.slice(0, 4).map((s) => [s.number, s.state, s.action]), [[17, 'slipped', 'See repair'], [29, 'repaired', 'Check it held'], [27, 'repaired', 'Check it held'], [14, 'held', 'See repair']]);
  assert.equal(saved[0].line, 'Slipped on a new question tonight, 8:55 PM. Back in Revise tomorrow.');
  assert.equal(saved[1].line, 'Repaired tonight, 8:30 PM. One new question shows whether it held.');
  assert.equal(savedLine(saved), '6 held on a new question, 1 slipped, 2 waiting for Check it held.');
});

test('one label per state, never "Repair first" (section 7)', () => {
  assert.equal(actionFor({ state: 'open' }), 'Repair');
  assert.equal(actionFor({ state: 'repaired' }), 'Check it held');
  assert.equal(actionFor({ state: 'held' }), 'See repair');
  assert.equal(actionFor({ state: 'slipped' }), 'See repair');
  assert.equal(actionFor({ state: 'blank' }), 'Try it again');
  assert.equal(actionFor({ state: 'open', keyState: 'under_review' }), null);
  const words = JSON.stringify(chaptersBody(student));
  assert.doesNotMatch(words, /Repair first|Repair in \d|Check it here/);
});

test('stamps carry the real weekday and a 12-hour clock', () => {
  assert.equal(dayStamp('2026-10-16T21:40:00+05:30'), 'Fri 16 Oct, 9:40 PM');
  assert.equal(dayStamp('2026-10-12T22:42:00+05:30'), 'Mon 12 Oct, 10:42 PM');
  assert.equal(dayStamp('2026-10-18T00:05:00+05:30'), 'Sun 18 Oct, 12:05 AM');
});

test('one paper only: the line names the paper', () => {
  const rec = { ...student, papers: student.papers.filter((p) => p.id === 'm3'), items: student.items.filter((i) => i.paper === 'm3'), chapterQuestions: { m3: student.chapterQuestions.m3 } };
  const line = reviewLine(rec);
  assert.equal(line.lost, lostOfPaper(rec.papers[0]));
  assert.match(line.text, /^Mock 3 lost 92 marks: 12 wrong answers and 4 left blank\./);
  assert.equal(acrossLine(rec), 'Each chapter in Mock 3.');
  assert.match(`${chapterRows(rec)[0].line.rest}`, /in Mock 3\./);
});

test('GET /api/me/review carries the 1018 part, from the same record', () => {
  const body = reviewBody(student);
  assert.equal(body.lose.line.text, reviewLine(student).text);
  assert.equal(body.lose.rows.length, 10);
  assert.equal(body.lose.saved.length, 9);
  assert.deepEqual(body.chapterQuestions, student.chapterQuestions);
});

test('the server counts every question of a chapter on a paper with a miss, right answers included', () => {
  const snapshot = [
    { id: 'q1', chapter: 'Goodwill', question: 'One' }, { id: 'q2', chapter: 'Goodwill', question: 'Two' },
    { id: 'q3', chapter: 'Ratios', question: 'Three' },
  ];
  const record = buildReviewRecord({
    userId: 'u1', now: Date.parse('2026-10-17T21:00:00+05:30'),
    slim: [{ id: 'a1', subject: 'accountancy', correct: 2, wrong: 1, unattempted: 0, total: 3, completed_at: '2026-10-16T21:40:00+05:30' }],
    heavy: new Map([['a1', { questions_snapshot: snapshot, details: [{ qid: 'q1', isCorrect: true, givenIndex: 0 }, { qid: 'q2', isCorrect: false, givenIndex: 1 }, { qid: 'q3', isCorrect: true, givenIndex: 2 }] }]]),
    keyRows: new Map([['q2', { status: 'published', is_deleted: false }]]),
  });
  assert.deepEqual(record.chapterQuestions, { a1: { 'accountancy:Goodwill': 2, 'accountancy:Ratios': 1 } });
  const [row] = chapterRows(record);
  assert.equal(row.name, 'Goodwill');
  assert.deepEqual([row.lost, row.offer, row.scored], [6, 10, 4]);
});
