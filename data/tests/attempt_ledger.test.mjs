// The shared attempt ledger (data/attempt_ledger.js): this paper, the record and comparable mocks.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLedger, comparableMocks, recordAttempts, telemetryRecorded, paperDwell, questionList, istDayMonth, formatSeconds,
  excludedQuestions, chapterOf, UNMAPPED_CHAPTER, RECORD_ATTEMPTS,
} from '../attempt_ledger.js';

const at = (d, h = 4) => Date.UTC(2026, 9, d, h, 30);
let seq = 0;
// rows: [chapter, 'RWB...'] blocks. Right answers pick the key (0), wrong ones pick 1.
function att({ id = `a${++seq}`, subject = 'accountancy', mode = 'full', day = 10, blocks, version = 'server_snapshot_v1', ids = null, recovery = null }) {
  const questionsSnapshot = []; const details = [];
  let n = 0;
  for (const [chapter, pattern] of blocks) for (const o of pattern) {
    const qid = ids?.[n] ?? `${id}-q${n}`; n++;
    questionsSnapshot.push({ id: qid, chapter, options: ['w', 'x', 'y', 'z'], correctIndex: 0 });
    details.push({ qid, givenIndex: o === 'R' ? 0 : o === 'W' ? 1 : null, isCorrect: o === 'R' ? true : o === 'W' ? false : null });
  }
  return { id, subject, total: n, details, questionsSnapshot, completedAt: at(day), mode, selectionMeta: { mode, scoringVersion: version, ...(recovery ? { recovery } : {}) } };
}

test('this paper: per chapter n, right, wrong, blank, answered, lost and 1-based question numbers', () => {
  const a = att({ blocks: [['Share Capital', 'RWB'], ['Debentures', 'RRWW']] });
  const l = buildLedger(a, [a]);
  assert.deepEqual(l.paper.get('Share Capital'), { chapter: 'Share Capital', n: 3, right: 1, wrong: 1, blank: 1, answered: 2, lost: 11, qs: [2, 3] });
  assert.deepEqual(l.paper.get('Debentures'), { chapter: 'Debentures', n: 4, right: 2, wrong: 2, blank: 0, answered: 4, lost: 12, qs: [6, 7] });
  assert.deepEqual(l.totals, { n: 7, right: 3, wrong: 3, blank: 1, answered: 6, lost: 23 });
  assert.equal(l.earlierPapers, 0);
  assert.deepEqual(l.record.get('Debentures'), { right: 2, answered: 4, papers: 1 });
});

test('held, withdrawn and corrected questions leave this paper only', () => {
  const a = att({ id: 'cur', blocks: [['Share Capital', 'RWWB']] });
  const reviews = { 'cur-q1': { state: 'under_review' }, 'cur-q2': { state: 'corrected' }, 'cur-q3': { state: 'something_else' } };
  assert.deepEqual([...excludedQuestions(reviews)].sort(), ['cur-q1', 'cur-q2']);
  const l = buildLedger(a, [a], { answerReviews: reviews });
  assert.equal(l.counted, 2);
  assert.equal(l.held, 2);
  assert.deepEqual(l.paper.get('Share Capital'), { chapter: 'Share Capital', n: 2, right: 1, wrong: 0, blank: 1, answered: 1, lost: 5, qs: [4] });
});

test('the record: same subject, server scored, at or before, any mode, no retakes, 59 earlier at most', () => {
  const cur = att({ id: 'cur', day: 20, blocks: [['Share Capital', 'RRWW']] });
  const quick = att({ id: 'quick', mode: 'quick', day: 5, blocks: [['Share Capital', 'RRRB']], version: 'server_practice_v1' });
  const device = att({ id: 'device', day: 6, blocks: [['Share Capital', 'RRRR']], version: 'legacy' });
  const other = att({ id: 'other', subject: 'economics', day: 7, blocks: [['Share Capital', 'RRRR']] });
  const after = att({ id: 'after', day: 21, blocks: [['Share Capital', 'RRRR']] });
  const retake = att({ id: 'retake', day: 8, blocks: [['Share Capital', 'WWWW']], ids: ['cur-q0', 'cur-q1', 'cur-q2', 'cur-q3'] });
  const l = buildLedger(cur, [cur, quick, device, other, after, retake]);
  assert.deepEqual(l.earlierAttempts.map((x) => x.id), ['quick']);
  assert.deepEqual(l.record.get('Share Capital'), { right: 5, answered: 7, papers: 2 });
  assert.deepEqual(l.earlier.get('Share Capital'), { right: 3, answered: 3, papers: 1 });
  assert.equal(l.earlierAnswers, 3);
  const many = Array.from({ length: 70 }, (_, i) => att({ id: `m${String(i).padStart(2, '0')}`, mode: 'quick', day: 1, blocks: [['Debentures', 'R']] }));
  assert.equal(recordAttempts(cur, [cur, ...many]).length, RECORD_ATTEMPTS - 1);
});

test('a paper counts toward a chapter only with an answered question there', () => {
  const cur = att({ id: 'cur', day: 20, blocks: [['Share Capital', 'RW']] });
  const blanks = att({ id: 'blanks', day: 10, blocks: [['Share Capital', 'BBB'], ['Debentures', 'R']] });
  const l = buildLedger(cur, [cur, blanks]);
  assert.deepEqual(l.record.get('Share Capital'), { right: 1, answered: 2, papers: 1 });
  assert.equal(l.earlierPapers, 1);
});

test('comparable mocks: Full or NTA, newest first with this one, retakes skipped, at most 3', () => {
  const m = (id, day, extra = {}) => att({ id, day, blocks: [['Debentures', 'RRRR']], ...extra });
  const cur = m('cur', 20);
  const list = [cur, m('m1', 2), m('m2', 5, { mode: 'nta' }), m('m3', 9), att({ id: 'q', mode: 'quick', day: 10, blocks: [['Debentures', 'R']] }),
    m('retake', 11, { ids: ['cur-q0', 'cur-q1', 'cur-q2', 'cur-q3'] }), m('econ', 12, { subject: 'economics' }), m('later', 25)];
  assert.deepEqual(comparableMocks(cur, list, 3).map((x) => x.id), ['cur', 'm3', 'm2']);
  assert.deepEqual(comparableMocks(cur, list, 10).map((x) => x.id), ['cur', 'm3', 'm2', 'm1']);
  assert.deepEqual(comparableMocks(list[4], list, 3), []);
});

test('telemetry recorded needs self reported, 10 events and half the questions seen', () => {
  const blocks = [['Debentures', 'RRRRRRRRRR'.repeat(2)]];
  const a = att({ id: 't', blocks });
  const events = (k) => Array.from({ length: k }, (_, i) => ({ seq: i + 1, qid: `t-q${i}`, at: i * 1000, type: 'visit' }));
  const withRec = (timeline, telemetry = 'self_reported') => ({ ...a, selectionMeta: { ...a.selectionMeta, recovery: { telemetry, timeline } } });
  assert.equal(telemetryRecorded(withRec(events(10))), true);
  assert.equal(telemetryRecorded(withRec(events(9))), false);
  assert.equal(telemetryRecorded(withRec(events(12), 'inconsistent')), false);
  const sparse = Array.from({ length: 12 }, (_, i) => ({ seq: i + 1, qid: `t-q${i % 3}`, at: i * 1000, type: 'visit' }));
  assert.equal(telemetryRecorded(withRec(sparse)), false);
  assert.equal(paperDwell(withRec(events(10))), null); // not every question has an event, so no timing
});

test('formats: question list, IST day and month, durations, chapter names', () => {
  assert.equal(questionList([47]), 'Q47');
  assert.equal(questionList([47, 48, 49, 50]), 'Q47, Q48, Q49 and Q50');
  assert.equal(questionList([3, 8, 12, 20, 33, 40, 41, 42, 43]), 'Q3, Q8, Q12, Q20, Q33 and 4 more');
  assert.equal(istDayMonth(Date.UTC(2026, 9, 8, 19, 0)), '9 Oct'); // 00:30 IST on 9 Oct
  assert.equal(istDayMonth(Date.UTC(2026, 9, 9, 18, 0)), '9 Oct'); // 23:30 IST
  assert.equal(formatSeconds(41), '41s');
  assert.equal(formatSeconds(125), '2m 05s');
  assert.equal(chapterOf({ chapter: { name: 'Share Capital' } }), 'Share Capital');
  assert.equal(chapterOf({}), UNMAPPED_CHAPTER);
});
