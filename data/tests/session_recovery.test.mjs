import test from 'node:test';
import assert from 'node:assert/strict';
import { analyseSession, dwellByQuestion, formatDuration, GAP } from '../session_recovery.js';
import { scoreSession } from '../recovery.js';

const q = (id, chapter, correctIndex = 0) => ({ id, chapter, question: `Question ${id}`, options: ['a', 'b', 'c', 'd'], correctIndex });
const questions = [q('q1', 'Ratios'), q('q2', 'Ratios'), q('q3', 'Goodwill'), q('q4', 'Ratios'), q('q5', 'Goodwill')];

function session(answers, events) {
  const s = scoreSession(questions, answers, events);
  return { id: 'a1', subject: 'accountancy', questionsSnapshot: questions, details: s.details, correct: s.correct, wrong: s.wrong, unattempted: s.unattempted, total: s.total,
    selectionMeta: { scoringVersion: 'server_practice_v1', recovery: s.recovery } };
}

test('marks gap is exact: 6 per wrong answer, 5 per blank, and adds up to the maximum', () => {
  const a = session({ q1: 0, q2: 1, q3: 2, q4: 3 }, []);
  const { marks } = analyseSession(a);
  assert.deepEqual([marks.right, marks.wrong, marks.blank], [1, 3, 1]);
  assert.equal(marks.scored, 5 - 3);
  assert.equal(marks.gapWrong, 3 * GAP.wrong);
  assert.equal(marks.gapBlank, GAP.blank);
  assert.equal(marks.scored + marks.gap, marks.max);
  assert.equal(marks.gap, marks.gapWrong + marks.gapBlank);
});

test('chapters are ranked by the marks they cost, and only chapters that cost marks appear', () => {
  const a = session({ q1: 0, q2: 1, q3: 0, q4: 1, q5: 0 }, []);
  const { chapters } = analyseSession(a);
  assert.deepEqual(chapters.map(c => [c.chapter, c.gap]), [['Ratios', 12]]);
  assert.equal(chapters[0].first, 2);
});

test('dwell time comes from the device timeline and is credited to the active question', () => {
  const dwell = dwellByQuestion([{ seq: 1, qid: 'q1', at: 0, type: 'visit' }, { seq: 2, qid: 'q1', at: 5000, type: 'answer', answer: 0 }, { seq: 3, qid: 'q2', at: 9000, type: 'visit' }, { seq: 4, qid: 'q2', at: 30000, type: 'visit' }]);
  assert.deepEqual(dwell, { q1: 9000, q2: 21000 });
  assert.equal(dwellByQuestion([{ seq: 1, qid: 'q1', at: 0 }]), null);
  assert.equal(formatDuration(9000), '9s');
  assert.equal(formatDuration(303000), '5m 03s');
});

test('observations are factual: a right answer changed to wrong, fast wrong picks, and a concentrated chapter', () => {
  const events = [
    { seq: 1, qid: 'q1', at: 0, type: 'visit' }, { seq: 2, qid: 'q1', at: 4000, type: 'answer', answer: 0 }, { seq: 3, qid: 'q1', at: 8000, type: 'answer', answer: 1 },
    { seq: 4, qid: 'q2', at: 10000, type: 'visit' }, { seq: 5, qid: 'q2', at: 15000, type: 'answer', answer: 1 },
    { seq: 6, qid: 'q3', at: 20000, type: 'visit' }, { seq: 7, qid: 'q3', at: 60000, type: 'answer', answer: 0 },
    { seq: 8, qid: 'q4', at: 70000, type: 'visit' }, { seq: 9, qid: 'q4', at: 78000, type: 'answer', answer: 2 },
    { seq: 10, qid: 'q5', at: 85000, type: 'visit' }, { seq: 11, qid: 'q5', at: 120000, type: 'visit' },
  ];
  const a = session({ q1: 1, q2: 1, q3: 0, q4: 2 }, events);
  const x = analyseSession(a);
  const ids = x.observations.map(o => o.id);
  assert.deepEqual(ids, ['changes', 'quick', 'chapter', 'blank']);
  assert.match(x.observations[0].headline, /You changed a right answer to wrong/);
  assert.deepEqual(x.observations[0].questions, [1]);
  assert.deepEqual(x.observations[1].questions, [1, 2, 4]);
  assert.equal(x.rows[0].changed, true);
  assert.equal(x.mistakes.length, 3);
  for (const o of x.observations) assert.doesNotMatch(`${o.headline} ${o.detail} ${o.tip}`, /recover(ed)? \d|will (gain|score)|guarantee|rank/i);
});

test('inconsistent or missing device events never produce behaviour claims, but marks still work', () => {
  const a = session({ q1: 1, q2: 1 }, []);
  a.selectionMeta.recovery = { ...a.selectionMeta.recovery, telemetry: 'inconsistent', observed: { answerChanges: [{ qid: 'q1', at: 1, before: 0, after: 1, markEffect: -6 }] } };
  const x = analyseSession(a);
  assert.equal(x.observations.some(o => o.id === 'changes' || o.id === 'quick'), false);
  assert.equal(x.timing, null);
  assert.equal(x.marks.wrong, 2);
  const legacy = analyseSession({ questionsSnapshot: questions, details: [{ qid: 'q1', isCorrect: true, givenIndex: 0 }] });
  assert.equal(legacy.marks.right, 1);
  assert.equal(legacy.telemetry, 'none');
});
