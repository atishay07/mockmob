// Review's shared input (LEARN-REVIEW-1017 packet P-LR0): data/review_input.mjs on the one student of section 9
// (data/tests/fixtures/review/student.json, copied unchanged from tmp/design-1017/learn-review/fixture.json) and its variants.
// The numbers below are the design's own (tmp/design-1017/learn-review/check.mjs derives them from the same file); the
// generated pin file (expected.json) only holds the rest. App port: review_input_test.dart reads the same JSON.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  chapterRows, itemViews, isOpenItem, mistakesHead, receipt, reviewBody, reviewCounts, reviewInput, reviewMove, reviewState, reviseDue,
  shortDate, shortTime, stampWhen, uidOf, paperViews,
} from '../review_input.mjs';
import { dayLabel } from '../revise.js';

const here = dirname(fileURLToPath(import.meta.url));
const dir = resolve(here, 'fixtures/review');
const load = (name) => JSON.parse(readFileSync(resolve(dir, `${name}.json`), 'utf8'));
const copy = (v) => JSON.parse(JSON.stringify(v));
const student = load('student');
const pinned = JSON.parse(readFileSync(resolve(dir, 'expected.json'), 'utf8')).cases;
const NAMES = ['student', 'check_pending', 'zero_credits', 'all_held', 'one_paper', 'revise_dedupe', 'empty', 'record_down', 'nothing_missed'];

test('the fixture is the design student, unchanged: three papers, 30 wrong answers, 8 blanks, 220 marks lost', () => {
  const m3 = student.papers.find((p) => p.id === 'm3');
  assert.deepEqual([m3.right, m3.wrong, m3.blank, m3.score, m3.of], [34, 12, 4, 158, 250]);
  assert.equal(student.papers.reduce((s, p) => s + (p.of - p.score), 0), 220);
  assert.equal(student.items.length, 38);
  assert.equal(student.wallet.aiCredits, 40);
  assert.equal(reviewState(student), 'ready');
});

test('counts agree: 22 open mistakes, 8 blanks, 172 marks across 3 papers (22 x 6 + 8 x 5), and the head says so', () => {
  const c = reviewCounts(student);
  assert.deepEqual([c.found, c.open, c.blanks, c.marks, c.openPapers, c.papers, c.lost], [30, 22, 8, 172, 3, 3, 220]);
  assert.equal(c.marks, c.open * 6 + c.blanks * 5);
  assert.deepEqual(mistakesHead(student), { title: '22 open mistakes', sub: 'With 8 left blank, they cost you 172 marks across 3 papers. A wrong answer costs 6 marks, a blank 5.' });
});

test('chapters: priced on the open items across papers, costliest first, and they add up to the head', () => {
  const rows = chapterRows(student);
  assert.deepEqual(rows.map((r) => [r.name, r.marks]), [
    ['Admission of a partner', 35], ['Retirement and death of a partner', 29], ['Issue of shares', 28], ['Cash flow statement', 23],
    ['Dissolution of a partnership firm', 22], ['Principles of management', 18], ['Accounting ratios', 17],
  ]);
  assert.equal(rows.reduce((s, r) => s + r.marks, 0), reviewCounts(student).marks);
  const adm = rows[0];
  assert.equal(adm.source, '5 wrong, 1 left blank. Accountancy, Mock 3 and Mock 2');
  assert.equal(adm.progress, '2 of 7 repaired, 1 slipped');
  assert.deepEqual([adm.openWrong, adm.blank, adm.wrong, adm.repaired, adm.slipped, adm.held], [5, 1, 7, 2, 1, 2]);
  assert.equal(rows.find((r) => r.name === 'Accounting ratios').progress, '2 of 4 repaired');
  assert.equal(rows.find((r) => r.name === 'Principles of management').source, '3 wrong. Business Studies, Quick practice');
});

test('every item of a chapter is listed, none disappears; repairable first in server order, then slipped, blanks, repaired and held', () => {
  const rows = chapterRows(student);
  const all = rows.flatMap((r) => r.itemIds);
  assert.equal(all.length, student.items.length);
  assert.equal(new Set(all).size, student.items.length);
  assert.deepEqual(rows[0].itemIds, ['m3:42', 'm3:38', 'm3:45', 'm2:11', 'm2:17', 'm3:47', 'm2:6', 'm2:21']);
});

test('the receipt: Found 30, Repaired 9, Retested 7, Still right 6; Q17 slipped tonight and is open again', () => {
  const r = receipt(student);
  assert.deepEqual([r.found, r.repaired, r.retested, r.stillRight], [30, 9, 7, 6]);
  assert.equal(r.line, '6 of the 7 checks held. Q17 slipped tonight, so it is open again and back in Revise tomorrow, Sun 18 Oct.');
  assert.equal(r.slip.uid, 'm2:17');
  // a slipped mistake is in Repaired and Retested, not in Still right, and it is in the open count
  const q17 = itemViews(student).find((i) => i.uid === 'm2:17');
  assert.equal(q17.open, true);
  assert.equal(q17.pill, 'Slipped on a new question');
  assert.equal(q17.repairable, false, 'a slipped mistake opens its saved repair free; it is never offered a second paid repair');
});

test('the receipt line has three shapes: checks, repairs without checks, no repairs; and no percentage or claim of cause', () => {
  const noChecks = copy(student);
  for (const i of noChecks.items) if (i.state === 'held' || i.state === 'slipped') i.state = 'repaired';
  assert.equal(receipt(noChecks).line, '9 repaired. Each one comes with a Check it held.');
  const none = copy(student);
  none.items = none.items.filter((i) => i.state === 'open' || i.state === 'blank');
  const r = receipt(none);
  assert.equal(r.line, 'None repaired yet. A repair explains why your pick looked right, then checks it.');
  assert.equal(r.onlyFound, true);
  for (const line of [receipt(student).line, receipt(noChecks).line, r.line]) assert.ok(!/%|percent|improv|gains?/i.test(line), line);
  const nothingSlipped = copy(student);
  nothingSlipped.items.find((i) => i.state === 'slipped').state = 'held';
  assert.equal(receipt(nothingSlipped).line, '7 of the 7 checks held. Nothing slipped.');
  const one = copy(student);
  one.items = one.items.filter((i) => i.state !== 'held' && i.state !== 'slipped');
  one.items.push({ paper: 'm3', q: 7, ch: 'adm', state: 'held', stem: 'x', repairedAt: '2026-10-16T22:00:00+05:30' });
  assert.equal(receipt(one).line, '1 of the 1 check held. Nothing slipped.');
});

test('weekdays match their dates (18 Oct 2026 is a Sunday, 21 Oct a Wednesday) and every time is 12-hour India time', () => {
  assert.equal(dayLabel('2026-10-18'), 'Sun 18 Oct');
  assert.equal(dayLabel('2026-10-21'), 'Wed 21 Oct');
  assert.equal(dayLabel('2026-10-17'), 'Sat 17 Oct');
  assert.equal(shortDate('2026-10-16T21:40:00+05:30'), '16 Oct');
  assert.equal(shortTime('2026-10-16T21:40:00+05:30'), '9:40 PM');
  assert.equal(shortTime('2026-10-12T22:42:00+05:30'), '10:42 PM');
  assert.equal(shortTime('2026-10-17T00:05:00+05:30'), '12:05 AM');
  assert.equal(shortTime('2026-10-17T12:00:00+05:30'), '12:00 PM');
  assert.equal(stampWhen('2026-10-13T23:08:00Z'), '14 Oct, 4:38 AM', 'a UTC instant is read in India time');
  // the paper and time on every row (F17)
  const views = itemViews(student);
  assert.equal(views.find((i) => i.uid === 'm3:42').stamp, 'Mock 3, 16 Oct, 9:40 PM');
  assert.equal(views.find((i) => i.uid === 'm2:11').stamp, 'Mock 2, 12 Oct, 10:42 PM');
  assert.equal(views.find((i) => i.uid === 'bq:2').stamp, 'Quick practice, 15 Oct, 7:05 PM');
  assert.ok(views.every((i) => /, \d{1,2} [A-Z][a-z]{2}, \d{1,2}:\d{2} (AM|PM)$/.test(i.stamp)));
  assert.equal(paperViews(student)[0].stamp, 'Mock 3, 16 Oct, 9:40 PM');
});

test('the next move is the shared function on the open set: Repair Q42 (Mock 3), 40 credits, rule 3', () => {
  const move = reviewMove(student);
  assert.equal(move.kind, 'repair');
  assert.equal(move.rule, 3);
  assert.equal(move.label, 'Repair Q42');
  assert.deepEqual({ qid: move.target.qid, number: move.target.number, chapter: move.target.chapter, attemptId: move.target.attemptId, paper: move.target.paper }, { qid: 'm3:42', number: 42, chapter: 'Admission of a partner', attemptId: 'm3', paper: 'Mock 3' });
  assert.equal(move.value, 'A repair gives you why D looked right, the trap, one rule to keep, and a new question to check it held.');
  assert.equal(move.cost, '1 credit. You have 40. No charge if the repair cannot be written.');
  assert.equal(move.alt.label, 'Practise 10 on Admission of a partner instead');
  assert.deepEqual(move.panel, { title: 'Admission of a partner', line: 'Your costliest chapter: 35 marks lost in Mock 3 and Mock 2. Q42 comes first.' });
});

test('a slipped mistake is never the repair target, and a key under re-check is left out of repairs and out of the chapter marks', () => {
  const r = copy(student);
  for (const i of r.items) if (i.paper === 'm3' && i.ch === 'adm' && i.state === 'open') i.keyState = 'under_review';
  // Q42, Q38 and Q45 are under re-check: the chapter loses their 18 marks, so Retirement (29) is now the costliest and its first
  // repairable mistake is the move; within Admission the next one would be Mock 2 Q11
  const move = reviewMove(r);
  assert.equal(move.label, 'Repair Q40');
  assert.equal(move.target.chapter, 'Retirement and death of a partner');
  assert.equal(chapterRows(r).find((c) => c.name === 'Admission of a partner').marks, 35 - 18);
  assert.equal(chapterRows(r)[0].name, 'Retirement and death of a partner');
  assert.equal(reviewCounts(r).open, 22 - 3);
  assert.ok(!isOpenItem({ state: 'open', keyState: 'under_review' }));
  const view = itemViews(r).find((i) => i.uid === 'm3:42');
  assert.equal(view.pill, 'Key being re-checked');
  assert.equal(view.repairable, false);
});

test('0 credits: practise the costliest chapter and say when the credits renew (rule 5)', () => {
  const z = load('zero_credits');
  const move = reviewMove(z);
  assert.equal(move.kind, 'practise');
  assert.equal(move.rule, 5);
  assert.equal(move.label, 'Practise 10 on Admission of a partner');
  assert.equal(move.panel.line, 'Repairs use credits. You have 0. They renew on 1 Nov.');
  assert.equal(move.alt.label, 'See your credits');
  // an unknown balance has no number and is not zero: the repair stays the move
  const unknown = copy(student);
  unknown.wallet.aiCredits = null;
  assert.equal(reviewMove(unknown).label, 'Repair Q42');
  assert.match(reviewMove(unknown).cost, /^1 credit\. /);
  assert.ok(!/You have 0/.test(reviewMove(unknown).cost));
});

test('every wrong answer repaired, a check not taken: Check Q{n} held, free (rule 4)', () => {
  const c = load('check_pending');
  const move = reviewMove(c);
  assert.equal(move.kind, 'check');
  assert.equal(move.rule, 4);
  assert.equal(move.label, 'Check Q42 held');
  assert.equal(move.cost, 'No extra credit.');
  assert.equal(move.target.attemptId, 'm3');
});

test('every wrong answer held and only blanks left: practise (rule 5); nothing missed on any paper: harder (rule 1)', () => {
  const held = reviewMove(load('all_held'));
  assert.equal(held.kind, 'practise');
  assert.equal(held.label, 'Practise 10 on Issue of shares', 'the chapter with the most blanks open');
  assert.ok(!/on this paper/.test(held.panel.line), 'Review speaks across papers');
  const fresh = reviewMove(load('nothing_missed'));
  assert.equal(fresh.rule, 1);
  assert.equal(fresh.kind, 'harder');
  assert.equal(fresh.panel.title, 'Every question right');
});

test('rule 2 reads the newest paper: under 40 percent right there sends the student to a chapter set, whatever the older papers say', () => {
  const r = copy(student);
  const m3 = r.papers.find((p) => p.id === 'm3');
  Object.assign(m3, { right: 6, wrong: 12, blank: 32, score: 18 }); // 6 of 18 answered right: 33 percent
  const move = reviewMove(r);
  assert.equal(move.rule, 2);
  assert.equal(move.label, 'Practise 10 on Admission of a partner');
  assert.equal(move.alt.label, 'Or repair Q42, 1 credit');
  // the same record with an older weak paper and a strong newest one still repairs
  const old = copy(student);
  Object.assign(old.papers.find((p) => p.id === 'm2'), { right: 5, wrong: 15, blank: 30 });
  assert.equal(reviewMove(old).rule, 3);
});

test('ties go to more wrong answers, then the newest paper, then the earlier chapter in it', () => {
  const rec = {
    now: '2026-10-17T21:41:00+05:30', wallet: { aiCredits: 5, practiceCredits: 50 },
    papers: [
      { id: 'new', name: 'Mock 2', subject: 'A', kind: 'full mock', at: '2026-10-16T20:00:00+05:30', questions: 10, right: 6, wrong: 2, blank: 2, score: 28, of: 50 },
      { id: 'old', name: 'Mock 1', subject: 'A', kind: 'full mock', at: '2026-10-10T20:00:00+05:30', questions: 10, right: 6, wrong: 2, blank: 2, score: 28, of: 50 },
    ],
    chapters: [{ id: 'x', name: 'X', subject: 'A' }, { id: 'y', name: 'Y', subject: 'A' }, { id: 'z', name: 'Z', subject: 'A' }],
    items: [
      // X: 6 blanks... no: X 30 = 5 wrong; Y 30 = 6 blanks; Z 30 = 5 wrong in the older paper only
      ...[1, 2, 3, 4, 5].map((q) => ({ paper: 'old', q, ch: 'z', state: 'open', stem: 's' })),
      ...[1, 2, 3, 4, 5].map((q) => ({ paper: 'new', q: q + 10, ch: 'y', state: 'open', stem: 's' })),
      ...[1, 2, 3, 4, 5, 6].map((q) => ({ paper: 'new', q: q + 20, ch: 'x', state: 'blank', stem: 's' })),
    ],
  };
  // Y and Z tie at 30 with 5 wrong each; X has 6 blanks (30) and fewer wrong answers: it is last. Y is in the newest paper: first.
  assert.deepEqual(chapterRows(rec).map((c) => [c.name, c.marks]), [['Y', 30], ['Z', 30], ['X', 30]]);
  assert.equal(reviewMove(rec).target.chapter, 'Y');
});

test('Revise today: 5 questions back + 1 Check it held + 2 concept cards = 8 (the design student); the daily cap and the unknown', () => {
  const due = reviseDue(student);
  assert.deepEqual([due.questions, due.again, due.checks, due.cards, due.total], [5, 0, 1, 2, 8]);
  assert.equal(due.mix, '5 questions back, 1 Check it held, 2 concept cards');
  assert.equal(due.head, '8 due today');
  assert.deepEqual(due.unknown, []);
  // the pending Check it held in Revise is the one repaired before today (Q27, 14 Oct), not the one repaired tonight (Q29)
  const pending = student.items.filter((i) => i.state === 'repaired');
  assert.deepEqual(pending.map(uidOf), ['m3:29', 'm2:27']);
  assert.deepEqual(student.revise.checksDue, ['m2:27']);
  // the cap holds sources 1 and 2, a Check it held always counts, cards add at most 5
  const big = copy(student);
  big.revise.dueToday = { questions: 14, again: 3, checks: 2, cards: 9 };
  const capped = reviseDue(big);
  assert.deepEqual([capped.questions, capped.again, capped.checks, capped.cards, capped.total], [7, 3, 2, 5, 17]);
  assert.deepEqual(reviseDue(big, { cap: 5 }).total, 3 + 2 + 2 + 5);
  assert.equal(reviseDue(Object.assign(copy(big), { revise: { ...big.revise, answeredToday: 4 } })).questions, 3, 'answered cards count against the cap');
  // unknown is never zero
  const unknown = copy(student);
  unknown.revise.dueToday.cards = null;
  assert.deepEqual(reviseDue(unknown).unknown, ['cards']);
  assert.equal(reviseDue(unknown).total, 6);
});

test('Revise plays a question once even when it is due as a wrong answer and as Review again; "due today" counts it once', () => {
  const d = load('revise_dedupe');
  const due = reviseDue(d);
  // 5 wrong answers due + 2 repaired mistakes due again, one of them the same question: 6 distinct, + 1 check + 2 cards
  assert.deepEqual([due.questions, due.again, due.checks, due.cards, due.total], [4, 2, 1, 2, 9]);
  assert.equal(due.mix, '6 questions back, 1 Check it held, 2 concept cards');
  assert.equal(due.row, '6 questions back, 1 Check it held, 2 concept cards. About 10 minutes, free.');
});

test('empty and failed are different states: a read that failed with papers on record is never the empty state (L12)', () => {
  assert.equal(reviewState(load('empty')), 'empty');
  assert.equal(reviewState(load('record_down')), 'unavailable');
  assert.equal(reviewState(null), 'unavailable');
  assert.equal(reviewMove(load('empty')), null);
  assert.equal(reviewMove(load('record_down')), null);
  assert.equal(reviewBody(load('record_down')).state, 'unavailable');
  assert.equal(reviewBody(load('empty')).state, 'empty');
  assert.deepEqual(reviewBody(load('empty')).items, []);
});

test('the API body is a record: reviewMove, receipt and counts computed from the body equal those from the record', () => {
  for (const name of ['student', 'zero_credits', 'check_pending', 'all_held', 'one_paper', 'revise_dedupe', 'nothing_missed']) {
    const record = load(name);
    const body = reviewBody(record);
    assert.equal(body.state, 'ready', name);
    const a = reviewMove(record);
    const b = reviewMove(body);
    assert.deepEqual({ kind: b.kind, rule: b.rule, label: b.label, target: b.target, panel: b.panel, cost: b.cost }, { kind: a.kind, rule: a.rule, label: a.label, target: a.target, panel: a.panel, cost: a.cost }, name);
    assert.deepEqual(receipt(body), receipt(record), name);
    assert.deepEqual(reviewCounts(body), reviewCounts(record), name);
    assert.deepEqual(chapterRows(body).map((c) => [c.name, c.marks, c.itemIds.length]), chapterRows(record).map((c) => [c.name, c.marks, c.itemIds.length]), name);
    assert.deepEqual(body.reviseDue, reviseDue(record), name);
    assert.deepEqual(reviseDue(body), body.reviseDue, name);
  }
});

test('the body carries no key, option or explanation and none of Revise\'s id lists', () => {
  const text = JSON.stringify(reviewBody(load('revise_dedupe')));
  assert.ok(!/"key"|"options"|explanation|"correct|sources/i.test(text), text.slice(0, 200));
});

test('every pinned expectation holds (expected.json is generated from these rules: rerun scripts/gen_review_fixtures.mjs after a deliberate change)', () => {
  for (const name of NAMES) {
    const record = name === 'student' ? student : load(name);
    const want = pinned[name];
    assert.ok(want, name);
    assert.equal(reviewState(record), want.state, name);
    if (want.state !== 'ready') continue;
    const move = reviewMove(record);
    assert.deepEqual({ kind: move.kind, rule: move.rule, label: move.label, why: move.why, cost: move.cost, late: move.late, alt: move.alt ? { kind: move.alt.kind, label: move.alt.label } : null, note: move.note, target: move.target, panel: move.panel }, want.move, name);
    assert.equal(receipt(record).line, want.receipt.line, name);
    assert.deepEqual(reviewCounts(record), want.counts, name);
    assert.deepEqual(reviseDue(record), want.reviseDue, name);
  }
});

test('reviewInput is the shared function\'s input and nothing else: no second move builder in the file', () => {
  const src = readFileSync(resolve(here, '../review_input.mjs'), 'utf8');
  assert.match(src, /import \{ NEXT_MOVE_RULES, nextMove \} from '\.\/result_next_move\.mjs'/);
  assert.ok(!/review_next_move/.test(src));
  const input = reviewInput(student);
  assert.deepEqual(Object.keys(input).sort(), ['aiCredits', 'analysis', 'answerReviews', 'checks', 'hour', 'isPremium', 'labReady', 'mode', 'practiceCredits', 'repairOrder', 'repaired', 'subject', 'subjectName']);
  assert.equal(input.hour, 21);
  assert.equal(input.mode, 'full');
  assert.equal(input.analysis.marks.right, 34, 'rules 1 and 2 read the newest paper');
  assert.equal(input.analysis.marks.gap, 220, 'and "nothing missed" reads every paper');
});
