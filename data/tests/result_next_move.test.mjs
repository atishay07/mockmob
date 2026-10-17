// The result screen's next-move rules (docs/design-decisions/pass-1017/RESULT-1017.md 4.2 to 4.4) on the shared
// fixtures (data/tests/fixtures/result_next_move, generated from data/result_papers.mjs; the app port reads the same).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  analysisFromRows, nextMove, costliestLine, costliest, receiptLine, lateLine, repairValueLine, repairCostLine, mistakesHead, attemptMode, paperKind,
} from '../result_next_move.mjs';
import { paperRows, paperRepairOrder } from '../result_papers.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const dir = resolve(here, 'fixtures/result_next_move');
const fixtures = readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(resolve(dir, f), 'utf8')));
const read = (p) => readFileSync(resolve(here, '../..', p), 'utf8');

test('every shared fixture gives its expected costliest line and next move', () => {
  assert.ok(fixtures.length >= 10);
  for (const { name, input, expected } of fixtures) {
    const analysis = analysisFromRows(input.rows);
    const head = costliestLine(analysis, { answerReviews: input.answerReviews });
    assert.deepEqual({ line: head.line, detail: head.detail }, expected.costliest, name);
    const move = nextMove({ ...input, analysis, repaired: new Set(input.repaired) });
    const got = { kind: move.kind, rule: move.rule, label: move.label, why: move.why, value: move.value, cost: move.cost, late: move.late, alt: move.alt ? { kind: move.alt.kind, label: move.alt.label } : null, note: move.note, target: move.target };
    assert.deepEqual(got, expected.move, name);
  }
});

test('the three papers add up as the design says', () => {
  const sum = (name) => { const a = analysisFromRows(paperRows(name)); return [a.marks.right, a.marks.wrong, a.marks.blank, a.marks.scored, a.marks.gap]; };
  assert.deepEqual(sum('weak'), [8, 22, 20, 18, 232]);
  assert.deepEqual(sum('avg'), [28, 12, 10, 128, 122]);
  assert.deepEqual(sum('strong'), [44, 4, 2, 216, 34]);
  assert.deepEqual(sum('practice5'), [3, 1, 1, 14, 11]);
});

test('acceptance check 6: weak practises, average and strong repair, perfect goes harder, 0 AI credits practises, all repaired checks', () => {
  const by = Object.fromEntries(fixtures.map((f) => [f.name, f.expected.move]));
  assert.equal(by.weak.label, 'Practise 10 on Share Capital');
  assert.equal(by.avg.label, 'Repair Q42');
  assert.equal(by.strong.label, 'Repair Q31');
  assert.equal(by.strong.note, 'All 4 repairs take about 15 minutes.');
  assert.equal(by.perfect.label, 'Take another full mock', 'a free student is not promised a set level');
  assert.equal(by.zero_credits.label, 'Practise 10 on Share Capital');
  assert.equal(by.zero_credits.why, 'Repairs use AI credits. You have 0.');
  assert.equal(by.all_repaired.label, 'Check Q42 held');
  assert.equal(by.blank.label, 'Practise 10 in Accountancy');
  assert.equal(by.held.label, 'Repair Q43', 'a key under re-check is never the repair, and leaves the chapter count');
  assert.equal(by.late_night.late, 'It is late. One repair is enough for tonight.');
});

test('a key under re-check leaves the costliest count; ties go to more wrong answers, then the earlier chapter', () => {
  const rows = [
    ...['a1', 'a2', 'a3', 'a4', 'a5', 'a6'].map((qid) => ({ qid, chapter: 'A', verdict: 'skipped' })),
    ...['b1', 'b2', 'b3', 'b4', 'b5'].map((qid) => ({ qid, chapter: 'B', verdict: 'wrong', givenIndex: 1 })),
  ];
  // A: 6 blanks = 30. B: 5 wrong = 30. Tie: B has more wrong answers.
  assert.equal(costliest(analysisFromRows(rows)).chapter, 'B');
  assert.equal(costliest(analysisFromRows(rows), { answerReviews: { b1: { state: 'under_review' } } }).chapter, 'A');
});

test('the receipt is one line, 12-hour, with the day when it is not today', () => {
  const at = Date.parse('2026-10-17T16:11:00.000Z'); // 9:41 PM in India
  assert.equal(receiptLine({ subjectName: 'Accountancy', mode: 'full', completedAt: at, durationMs: 2_796_000, now: at + 60_000, timeZone: 'Asia/Kolkata' }), 'Accountancy full mock. Recorded 9:41 PM, 46m 36s.');
  assert.equal(receiptLine({ subjectName: 'Business Studies', mode: 'quick', completedAt: at, durationMs: 156_000, now: at, timeZone: 'Asia/Kolkata' }), 'Business Studies practice. Recorded 9:41 PM, 2m 36s.');
  assert.equal(receiptLine({ subjectName: 'Accountancy', mode: 'nta', completedAt: at, now: at + 3 * 86_400_000, timeZone: 'Asia/Kolkata' }), 'Accountancy NTA paper. Recorded 17 Oct, 9:41 PM.');
  assert.equal(receiptLine({ subjectName: 'Accountancy', mode: 'full', completedAt: at, now: at + 6 * 3_600_000, timeZone: 'Asia/Kolkata' }), 'Accountancy full mock. Recorded yesterday, 9:41 PM.', 'the day before is said as a relative day');
  for (const word of ['submitted', 'submission', 'saved', 'session complete', 'practice finished']) {
    assert.ok(!receiptLine({ subjectName: 'Accountancy', mode: 'quick', completedAt: at, now: at }).toLowerCase().includes(word));
  }
});

test('the mode comes from the record; a server practice record is practice', () => {
  assert.equal(attemptMode({ selectionMeta: { mode: 'nta' } }), 'nta');
  assert.equal(attemptMode({ selectionMeta: { scoringVersion: 'server_practice_v1' } }), 'quick');
  assert.equal(paperKind('smart'), 'smart practice');
});

test('late at night is one plain line, never a figure', () => {
  assert.equal(lateLine(0), 'It is late. One repair is enough for tonight.');
  assert.equal(lateLine(23), 'It is late. One repair is enough for tonight.');
  assert.equal(lateLine(4), 'It is late. One repair is enough for tonight.');
  assert.equal(lateLine(5), null);
  assert.equal(lateLine(15), null);
  assert.equal(lateLine(null), null);
});

test('repair value and cost: the four parts before paying, the balance, the no-charge promise; unknown balance has no number', () => {
  assert.equal(repairValueLine('D'), 'A repair gives you why D looked right, the trap, one rule to keep, and a new question to check it held.');
  assert.equal(repairValueLine('D', { checkReady: false }), 'A repair gives you why D looked right, the trap, and one rule to keep.');
  assert.equal(repairCostLine(68), '1 AI credit. You have 68. No charge if the repair cannot be written.');
  assert.equal(repairCostLine(null), '1 AI credit. No charge if the repair cannot be written.');
});

test('the mistakes head: marks at stake, then repaired and held counts', () => {
  assert.deepEqual(mistakesHead({ count: 12 }), { title: 'Your 12 mistakes', empty: null, side: '−72 marks' });
  assert.deepEqual(mistakesHead({ count: 12, repairedCount: 1 }), { title: 'Your 12 mistakes', empty: null, side: '1 of 12 repaired' });
  assert.deepEqual(mistakesHead({ count: 12, repairedCount: 3, heldCount: 2 }), { title: 'Your 12 mistakes', empty: null, side: '3 of 12 repaired, 2 held' });
  assert.deepEqual(mistakesHead({ count: 1 }), { title: 'Your 1 mistake', empty: null, side: '−6 marks' });
  assert.equal(mistakesHead({ count: 0 }).title, 'No mistakes to repair');
  assert.equal(mistakesHead({ count: 0, answered: 0 }).title, 'No answers to repair', 'an all-blank paper');
  assert.ok(mistakesHead({ count: 0, answered: 50 }).empty.includes('its own repair'), 'the empty state teaches what appears here');
});

test('a return visit recomputes the move: after Q42 the next repair in Share Capital is next', () => {
  const move = nextMove({ analysis: analysisFromRows(paperRows('avg')), repairOrder: paperRepairOrder('avg'), repaired: new Set(['paper-avg-q42']), aiCredits: 67, subjectName: 'Accountancy', mode: 'full' });
  assert.equal(move.label, 'Repair Q43');
});

test('Pro covers a practice set; an unknown practice balance has no number', () => {
  const analysis = analysisFromRows(paperRows('weak'));
  assert.equal(nextMove({ analysis, isPremium: true }).cost, 'Pro covers this set.');
  assert.equal(nextMove({ analysis }).cost, 'This set uses 10 practice credits.');
});

test('the result page shows no sleeping Mobi, no hero pip, no reader Mobi, and one receipt', () => {
  const page = read('src/app/(app)/result/[id]/ResultPageClient.jsx');
  assert.doesNotMatch(page, /mobiReaction\(/);
  assert.doesNotMatch(page, /<ReaderMobi/);
  assert.doesNotMatch(page, /rp-hero__pip/);
  assert.doesNotMatch(page, /Session complete/);
  assert.doesNotMatch(page, /Key at submission/);
  assert.match(page, /receiptLine\(/);
});

test('one volt per viewport: the next-move key marks itself the page primary; the SWOT keys are outline', () => {
  assert.match(read('src/components/result/NextMove.jsx'), /'data-page-primary': ''/);
  assert.doesNotMatch(read('src/components/result/swot.css'), /\.sw-plan__go\s*\{[^}]*background:\s*(#d2f000|var\(--volt\))/);
});
