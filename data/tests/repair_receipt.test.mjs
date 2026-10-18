// The after-the-mock receipt (release 8; FEATURE-ADOPTION-2026-10-17 item 5, owner W-064 and F18): "Of the 6 mistakes you repaired,
// ..." said from the repair record and this paper only, with the rule it counts by in the sentence itself.
// Run: node --test data/tests/repair_receipt.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_LIMIT, repairReceipt, repairedBefore } from '../repair_receipt.mjs';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const PAPER_AT = Date.parse('2026-10-17T16:00:00Z');
const DAY = 86400000;
const ago = (days) => new Date(PAPER_AT - days * DAY).toISOString();

// One paper of 12 questions: Partnership (4: 3 right, 1 blank), Goodwill (4: 2 right, 2 wrong), Ratios (4: 1 right, 3 blank).
const SPEC = [
  ['q1', 'Partnership Fundamentals', true], ['q2', 'Partnership Fundamentals', true], ['q3', 'Partnership Fundamentals', true], ['q4', 'Partnership Fundamentals', null],
  ['q5', 'Goodwill', true], ['q6', 'Goodwill', true], ['q7', 'Goodwill', false], ['q8', 'Goodwill', false],
  ['q9', 'Ratios', true], ['q10', 'Ratios', null], ['q11', 'Ratios', null], ['q12', 'Ratios', null],
];
const attempt = (o = {}) => ({
  id: 'now1', subject: 'accountancy', completedAt: PAPER_AT,
  questionsSnapshot: SPEC.map(([id, chapter]) => ({ id, chapter })),
  details: SPEC.map(([qid, , isCorrect]) => ({ qid, isCorrect })),
  ...o,
});
// A repair row as GET /api/me/repair-record sends it.
const row = (questionId, chapter, daysAgo = 3, o = {}) => ({ attemptId: 'old1', questionId, chapter, subject: 'accountancy', foundAt: ago(daysAgo + 1), repairedAt: ago(daysAgo), checkedState: 'not_available', retriedAt: null, ...o });

test('the same chapter: the repaired mistakes that sit in a chapter where this paper had nothing wrong', () => {
  // Six repaired mistakes: 3 in Partnership (clean: 3 right, 1 blank), 2 in Goodwill (two wrong here), 1 in Cash flow (not asked).
  const rows = [row('x1', 'Partnership Fundamentals'), row('x2', 'Partnership Fundamentals'), row('x3', 'Partnership Fundamentals'), row('x4', 'Goodwill'), row('x5', 'Goodwill'), row('x6', 'Cash flow statement')];
  const r = repairReceipt({ attempt: attempt(), repairs: rows });
  assert.equal(r.kind, 'chapter');
  assert.equal(r.repaired, 6);
  assert.equal(r.count, 3);
  assert.equal(r.text, 'Of the 6 mistakes you repaired, 3 are in chapters where you got nothing wrong on this paper.');
  assert.equal(`${r.lead} ${r.strong}`, r.text);
  assert.equal(r.lead, 'Of the 6 mistakes you repaired,');
});

test('the same chapter: one, all, and a single repaired mistake read as sentences', () => {
  const one = repairReceipt({ attempt: attempt(), repairs: [row('x1', 'Partnership Fundamentals'), row('x2', 'Goodwill'), row('x3', 'Goodwill')] });
  assert.equal(one.text, 'Of the 3 mistakes you repaired, 1 is in a chapter where you got nothing wrong on this paper.');
  const all = repairReceipt({ attempt: attempt(), repairs: [row('x1', 'Partnership Fundamentals'), row('x2', 'Partnership Fundamentals')] });
  assert.equal(all.text, 'All 2 mistakes you repaired are in chapters where you got nothing wrong on this paper.');
  const single = repairReceipt({ attempt: attempt(), repairs: [row('x1', 'Partnership Fundamentals')] });
  assert.equal(single.text, 'The mistake you repaired is in a chapter where you got nothing wrong on this paper.');
});

test('a clean chapter needs an answer: a chapter left blank, or not asked, is never counted as clean or as not', () => {
  // Ratios: 1 right, 3 blank, none wrong: one answer, so not clean. Cash flow: not asked. Make a chapter that is all blank.
  const blankPaper = attempt({ questionsSnapshot: [{ id: 'b1', chapter: 'Ratios' }, { id: 'b2', chapter: 'Ratios' }], details: [{ qid: 'b1', isCorrect: null }, { qid: 'b2', isCorrect: null }] });
  assert.equal(repairReceipt({ attempt: blankPaper, repairs: [row('x1', 'Ratios')] }), null, 'only blanks: nothing was answered, so nothing can be said');
  assert.equal(repairReceipt({ attempt: attempt(), repairs: [row('x1', 'Cash flow statement')] }), null, 'the paper did not ask about that chapter');
  assert.equal(repairReceipt({ attempt: attempt(), repairs: [row('x1', 'Goodwill'), row('x2', 'Goodwill')] }), null, 'every repaired chapter had wrong answers: no good news, no line');
  // Ratios: one right and three blank. A single answer is not evidence of a chapter, so it is not counted (MIN_ANSWERED is two).
  assert.equal(repairReceipt({ attempt: attempt(), repairs: [row('x1', 'Ratios')] }), null, 'one answer in the chapter is too thin to say anything');
});

test('the same question comes first: those that came up again, and how many were right', () => {
  const repairs = [row('q1', 'Partnership Fundamentals'), row('q5', 'Goodwill'), row('x3', 'Partnership Fundamentals'), row('x4', 'Goodwill'), row('x5', 'Goodwill'), row('x6', 'Ratios')];
  const r = repairReceipt({ attempt: attempt(), repairs });
  assert.equal(r.kind, 'question');
  assert.equal(r.repaired, 6);
  assert.equal(r.count, 2);
  assert.equal(r.right, 2);
  assert.equal(r.text, 'Of the 6 mistakes you repaired, 2 came up again on this paper. You got both right.');
  // One of two came back wrong: both numbers are said.
  const mixed = repairReceipt({ attempt: attempt(), repairs: [row('q1', 'Partnership Fundamentals'), row('q7', 'Goodwill'), row('x3', 'Ratios'), row('x4', 'Ratios')] });
  assert.equal(mixed.text, 'Of the 4 mistakes you repaired, 2 came up again on this paper. You got 1 right.');
  // A single one, and all of them.
  assert.equal(repairReceipt({ attempt: attempt(), repairs: [row('q1', 'Partnership Fundamentals'), row('x2', 'Goodwill'), row('x3', 'Goodwill')] }).text, 'Of the 3 mistakes you repaired, 1 came up again on this paper. You got it right.');
  assert.equal(repairReceipt({ attempt: attempt(), repairs: [row('q1', 'Partnership Fundamentals')] }).text, 'The mistake you repaired came up again on this paper. You got it right.');
  assert.equal(repairReceipt({ attempt: attempt(), repairs: [row('q1', 'Partnership Fundamentals'), row('q2', 'Partnership Fundamentals')] }).text, 'Of the 2 mistakes you repaired, both came up again on this paper. You got both right.');
  assert.equal(repairReceipt({ attempt: attempt(), repairs: [row('q1', 'x'), row('q2', 'x'), row('q3', 'x')] }).text, 'Of the 3 mistakes you repaired, all 3 came up again on this paper. You got all 3 right.');
});

test('once the same question has come back, the chapter is never used instead, and nothing is said when none was right', () => {
  // q7 and q8 came back wrong; Partnership is a clean chapter, but the kinder count is not swapped in.
  const bad = repairReceipt({ attempt: attempt(), repairs: [row('q7', 'Goodwill'), row('q8', 'Goodwill'), row('x1', 'Partnership Fundamentals')] });
  assert.equal(bad, null);
  // A repaired question left blank on the paper came up, but was not right.
  assert.equal(repairReceipt({ attempt: attempt(), repairs: [row('q4', 'Partnership Fundamentals'), row('x1', 'Partnership Fundamentals')] }), null);
});

test('only repairs made before the paper count, one per question, never this paper\'s own', () => {
  const rows = [
    row('x1', 'Partnership Fundamentals', 2),
    row('x2', 'Partnership Fundamentals', -1), // repaired after the paper was handed in
    row('x3', 'Partnership Fundamentals', 5, { attemptId: 'now1' }), // a mistake of this very paper
    row('x1', 'Partnership Fundamentals', 9, { attemptId: 'older' }), // the same question repaired twice is one
    { attemptId: 'a', questionId: 'x4', chapter: 'Partnership Fundamentals', subject: 'accountancy', repairedAt: 'not a date' },
    { attemptId: 'a', chapter: 'Partnership Fundamentals', subject: 'accountancy', repairedAt: ago(1) },
    null,
  ];
  assert.deepEqual(repairedBefore({ attempt: attempt(), repairs: rows }).map((r) => r.questionId), ['x1']);
  assert.equal(repairReceipt({ attempt: attempt(), repairs: rows }).text, 'The mistake you repaired is in a chapter where you got nothing wrong on this paper.');
  // The instant of the paper itself is not "before".
  assert.deepEqual(repairedBefore({ attempt: attempt(), repairs: [row('x1', 'Goodwill', 0)] }), []);
});

test('nothing to say is no line: no repair before the paper, an unread record, an unreadable paper', () => {
  assert.equal(repairReceipt({ attempt: attempt(), repairs: [] }), null, 'no repairs');
  assert.equal(repairReceipt({ attempt: attempt(), repairs: null }), null, 'the record did not load: unknown is never zero');
  assert.equal(repairReceipt({ attempt: attempt(), repairs: undefined }), null);
  assert.equal(repairReceipt({ attempt: attempt(), repairs: [row('x1', 'Partnership Fundamentals', -2)] }), null, 'every repair came after');
  assert.equal(repairReceipt({ attempt: attempt({ completedAt: undefined }), repairs: [row('x1', 'Partnership Fundamentals')] }), null);
  assert.equal(repairReceipt({ attempt: attempt({ questionsSnapshot: [] }), repairs: [row('x1', 'Partnership Fundamentals')] }), null);
  assert.equal(repairReceipt({ attempt: attempt({ details: undefined }), repairs: [row('x1', 'Partnership Fundamentals')] }), null);
  assert.equal(repairReceipt({}), null);
  assert.equal(repairReceipt(), null);
  assert.equal(repairReceipt({ attempt: null, repairs: [row('x1', 'Goodwill')] }), null);
});

test('matching is by subject and chapter, tolerant of case and spacing, and a repair with no chapter is only in the denominator', () => {
  const r = repairReceipt({ attempt: attempt(), repairs: [row('x1', '  partnership   FUNDAMENTALS '), row('x2', null), row('x3', 'Goodwill', 3, { subject: 'economics' })] });
  assert.equal(r.repaired, 3);
  assert.equal(r.count, 1);
  assert.equal(r.text, 'Of the 3 mistakes you repaired, 1 is in a chapter where you got nothing wrong on this paper.');
  // The same chapter name in another subject is not this chapter.
  assert.equal(repairReceipt({ attempt: attempt(), repairs: [row('x1', 'Partnership Fundamentals', 3, { subject: 'economics' })] }), null);
  // A repair row with no subject takes the paper's.
  assert.equal(repairReceipt({ attempt: attempt(), repairs: [row('x1', 'Partnership Fundamentals', 3, { subject: null })] }).count, 1);
  // A question carrying its own subject (a mixed paper) is matched on it.
  const mixed = attempt({ questionsSnapshot: [{ id: 'm1', chapter: 'Money', subject: 'economics' }, { id: 'm2', chapter: 'Money', subject: 'economics' }], details: [{ qid: 'm1', isCorrect: true }, { qid: 'm2', isCorrect: true }] });
  assert.equal(repairReceipt({ attempt: mixed, repairs: [row('x1', 'Money', 3, { subject: 'economics' })] }).count, 1);
  assert.equal(repairReceipt({ attempt: mixed, repairs: [row('x1', 'Money', 3, { subject: 'accountancy' })] }), null);
});

test('a full page of rows may hide older repairs, so the line says "most recently"', () => {
  const rows = Array.from({ length: DEFAULT_LIMIT }, (_, i) => row(`z${i}`, i < 60 ? 'Partnership Fundamentals' : 'Cash flow statement'));
  const r = repairReceipt({ attempt: attempt(), repairs: rows });
  assert.equal(r.repaired, 100);
  assert.equal(r.text, 'Of the 100 mistakes you repaired most recently, 60 are in chapters where you got nothing wrong on this paper.');
  assert.equal(repairReceipt({ attempt: attempt(), repairs: rows.slice(0, 99) }).text, 'Of the 99 mistakes you repaired, 60 are in chapters where you got nothing wrong on this paper.');
  assert.equal(repairReceipt({ attempt: attempt(), repairs: rows, limit: 200 }).text, 'Of the 100 mistakes you repaired, 60 are in chapters where you got nothing wrong on this paper.');
});

test('the copy claims no cause and no marks, and carries no exclamation mark, arrow or filler', () => {
  const lines = [
    repairReceipt({ attempt: attempt(), repairs: [row('x1', 'Partnership Fundamentals'), row('x2', 'Goodwill')] }),
    repairReceipt({ attempt: attempt(), repairs: [row('q1', 'Partnership Fundamentals'), row('x2', 'Goodwill')] }),
  ].map((r) => r.text);
  for (const text of lines) {
    assert.doesNotMatch(text, /!|→|->|because|thanks to|improv|gain(ed|s)?|saved you|earned|marks|score|should|great|well done/i, text);
    assert.match(text, /on this paper\./);
  }
});

test('wired: the result page reads the record once and draws the line in the hero; Today\'s Last paper draws it from the paper it already reads', () => {
  const page = read('src/app/(app)/result/[id]/ResultPageClient.jsx');
  assert.match(page, /import \{ repairReceipt \} from '@\/\.\.\/data\/repair_receipt\.mjs'/);
  assert.match(page, /apiGet\('\/api\/me\/repair-record\?limit=100'\)/, 'the same read Today makes');
  assert.match(page, /repairReceipt\(\{ attempt, repairs \}\)/);
  assert.match(page, /receipt=\{receipt\}|repairReceipt=\{/, 'handed to the hero');
  const hero = read('src/components/result/ResultHero.jsx');
  assert.match(hero, /className="rh-receipt"/);
  assert.match(hero, /<b>\{repairReceipt\.strong\}<\/b>/);
  const paper = read('src/components/today/TodayPaper.jsx');
  assert.match(paper, /import \{ repairReceipt \} from '@\/\.\.\/data\/repair_receipt\.mjs'/);
  assert.match(paper, /repairReceipt\(\{ attempt: leak\.attempt, repairs: repairRows \}\)/, 'the one read of the paper serves the leak and the receipt');
  assert.match(paper, /className="tpp__receipt"/);
  assert.match(read('src/app/(app)/today/page.jsx'), /<TodayPaper[^>]*repairRows=\{data\.repairRows\}/);
});
