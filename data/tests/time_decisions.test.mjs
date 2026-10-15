import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTimeDecisions, paperPace, spentLabel, clockLabel, TIME_COPY } from '../time_decisions.js';
import { scoreSession } from '../recovery.js';

// The shared fixture: the app's test/unit/result/time_decisions_test.dart checks the same sentences.
const questions = Array.from({ length: 12 }, (_, i) => ({ id: `q${i + 1}`, chapter: i < 4 ? 'Goodwill' : 'Ratios', question: `Question ${i + 1}`, options: ['a', 'b', 'c', 'd'], correctIndex: 0 }));
function fixtureEvents() {
  const ev = [];
  let seq = 1;
  const push = (qid, at, type, answer) => ev.push({ seq: seq++, qid, at, type, ...(type === 'answer' ? { answer } : {}) });
  push('q1', 0, 'visit'); push('q1', 42000, 'answer', 1); push('q1', 115000, 'answer', 2); // B, then C (both wrong)
  push('q2', 130000, 'visit'); push('q2', 150000, 'answer', 0); push('q2', 200000, 'answer', 3); // A (key), then D
  push('q3', 210000, 'visit'); push('q3', 215000, 'answer', 1);
  push('q4', 216000, 'visit'); push('q4', 260000, 'answer', 0);
  for (let i = 5; i <= 11; i++) { const start = 270000 + (i - 5) * 50000; push(`q${i}`, start, 'visit'); push(`q${i}`, start + 30000, 'answer', 0); }
  push('q12', 620000, 'visit'); push('q12', 640000, 'answer', 2); push('q12', 650000, 'answer', null); push('q12', 700000, 'answer', 0);
  push('q1', 710000, 'visit'); push('q3', 720000, 'visit');
  return ev;
}
const answers = { q1: 2, q2: 3, q3: 1, q4: 0, q5: 0, q6: 0, q7: 0, q8: 0, q9: 0, q10: 0, q11: 0, q12: 0 };
function attempt(meta = {}, events = fixtureEvents(), given = answers) {
  const s = scoreSession(questions, given, events);
  return { id: 'a1', questionsSnapshot: questions, details: s.details, selectionMeta: { mode: 'quick', scoringVersion: 'server_practice_v1', recovery: s.recovery, ...meta } };
}

test('labels: seconds, whole minutes and the paper clock', () => {
  assert.equal(spentLabel(42), '42s');
  assert.equal(spentLabel(60), '1m');
  assert.equal(spentLabel(125), '2m 05s');
  assert.equal(clockLabel(42), '0:42');
  assert.equal(clockLabel(725), '12:05');
});

test('paper pace comes from the paper limit: NTA minutes, the fixed Full limit, quick and smart per question', () => {
  const nta = { questionsSnapshot: Array.from({ length: 50 }, (_, i) => ({ id: `n${i}` })), selectionMeta: { mode: 'nta', durationMinutes: 60 } };
  assert.deepEqual(paperPace(nta), { paperMs: 3600000, perQuestionMs: 72000, total: 50 });
  assert.equal(paperPace({ ...nta, selectionMeta: { mode: 'full' } }).perQuestionMs, 72000);
  assert.equal(paperPace(attempt()).perQuestionMs, 60000);
  const smart = { questionsSnapshot: [{ id: 's1', difficulty: 'easy' }, { id: 's2', difficulty: 'hard' }], selectionMeta: { mode: 'smart' } };
  assert.equal(paperPace(smart).paperMs, 135000);
  assert.equal(paperPace({ questionsSnapshot: [{ id: 'x' }], selectionMeta: {} }), null);
});

test('each question: time against the paper pace and the median, revisits, every pick with its clock time and the marks effect', () => {
  const td = buildTimeDecisions(attempt());
  assert.equal(td.state, 'ready');
  const row = (n) => td.rows[n - 1];
  assert.deepEqual(row(1).lines, [
    '2m 20s on this question. The paper gives 1m a question, and your median was 50s. That is 2.3 times the paper\'s pace. You opened it 2 times.',
    'Picked B at 0:42. Changed to C at 1:55, 1m 13s later.',
    'That change made no difference to your marks.',
  ]);
  assert.deepEqual(row(2).lines, [
    '1m 20s on this question. The paper gives 1m a question, and your median was 50s.',
    'Picked A at 2:30. Changed to D at 3:20, 50s later.',
    'That change cost 6 marks.',
  ]);
  assert.deepEqual(row(12).lines.slice(1), [
    'Picked C at 10:40. Cleared it at 10:50, 10s later. Picked A at 11:40, 50s later.',
    'Together these 2 changes gained 6 marks.',
  ]);
  assert.equal(row(5).lines.length, 2); // time and one pick, no effect line
  // Q3 is the last question on screen: its time is a lower bound.
  assert.equal(row(3).lines[0], 'At least 6s on this question. The paper gives 1m a question, and your median was 50s. You opened it 2 times.');
});

test('the whole paper: pace, median, time split, longest questions and every change with its net effect', () => {
  const td = buildTimeDecisions(attempt());
  assert.equal(td.summary.pace, 'This paper gives you 1m a question: 12 minutes for 12 questions.');
  assert.equal(td.summary.median, 'Your median was 50s a question, over 12 timed questions.');
  assert.equal(td.summary.split, 'You spent 8m 14s on 9 right answers and 3m 46s on 3 wrong answers.');
  assert.deepEqual(td.longest.map((l) => [l.number, l.time, l.ratioText]), [
    [1, '2m 20s', '2.3 times the paper\'s pace'], [12, '1m 30s', '1.5 times the paper\'s pace'], [2, '1m 20s', '1.3 times the paper\'s pace'], [4, '54s', null], [5, '50s', null],
  ]);
  assert.equal(td.changes.lead, 'You changed answers 4 times across 3 questions. Net effect on your marks: 0.');
  assert.deepEqual(td.changes.parts.map((p) => p.text), ['2 changes gained 6 marks', '1 change cost 6 marks', '1 change made no difference']);
  assert.deepEqual(td.changes.rows.map((r) => [r.number, r.net]), [[1, 0], [2, -6], [12, 6]]);
});

test('a question under re-check keeps its times but leaves the marks effect', () => {
  const td = buildTimeDecisions(attempt(), { answerReviews: { q2: { state: 'under_review' } } });
  assert.equal(td.rows[1].lines.length, 2);
  assert.equal(td.changes.lead, 'You changed answers 3 times across 2 questions. Net effect on your marks: +6.');
  assert.equal(td.changes.held, '1 question under re-check or corrected is left out of the marks effect.');
  assert.equal(td.changes.rows.find((r) => r.number === 2).net, null);
});

test('no time read without a usable record: browser-scored, mismatched and missing records each say so', () => {
  assert.deepEqual(buildTimeDecisions(attempt({ scoringVersion: undefined })), { state: 'device', message: TIME_COPY.device });
  const bad = attempt({}, fixtureEvents(), { ...answers, q1: 3 });
  assert.equal(buildTimeDecisions(bad).state, 'inconsistent');
  assert.equal(buildTimeDecisions(attempt({}, [])).state, 'none');
  assert.equal(buildTimeDecisions(attempt({}, [])).message, 'Time and answer changes were not recorded for this paper. Your score is unaffected.');
});

test('one change, unopened questions and a gap over 30 minutes', () => {
  const ev = [
    { seq: 1, qid: 'q1', at: 0, type: 'visit' }, { seq: 2, qid: 'q1', at: 30000, type: 'answer', answer: 0 }, { seq: 3, qid: 'q1', at: 45000, type: 'answer', answer: 1 },
    { seq: 4, qid: 'q2', at: 60000, type: 'visit' }, { seq: 5, qid: 'q3', at: 60000 + 31 * 60000, type: 'visit' },
  ];
  const td = buildTimeDecisions(attempt({ mode: undefined }, ev, { q1: 1 }));
  assert.equal(td.changes.lead, 'You changed one answer. Net effect on your marks: −6.');
  assert.equal(td.rows[0].lines[0], '1m on this question.');
  assert.equal(td.rows[1].lines[0], 'A break of over 30 minutes on this question is not counted.');
  assert.equal(td.rows[2].lines[0], 'The last question you opened. Time after your last tap is not recorded.');
  assert.equal(td.rows[3].lines[0], 'You did not open this question.');
  assert.equal(td.summary.pace, null);
  assert.equal(td.summary.median, null);
});

test('no answers changed says so plainly', () => {
  const ev = [{ seq: 1, qid: 'q1', at: 0, type: 'visit' }, { seq: 2, qid: 'q1', at: 9000, type: 'answer', answer: 0 }, { seq: 3, qid: 'q2', at: 12000, type: 'visit' }];
  const td = buildTimeDecisions(attempt({}, ev, { q1: 0 }));
  assert.equal(td.changes.lead, 'You did not change any answers in this paper.');
  assert.deepEqual(td.changes.parts, []);
});
