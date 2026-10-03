import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreSession } from '../recovery.js';
import { computePrepOSInsights, readout, answerFromInsights, wilson, dwellByQuestion, MIN_CHAPTER_SAMPLE } from '../prepos_insights.js';

const NOW = Date.parse('2026-10-10T10:00:00Z');
const DAY = 86_400_000;

function question(i, chapter, difficulty = 'medium') {
  return { id: `q${i}`, chapter, difficulty, correctIndex: 0, options: [{ key: 'A', text: 'a' }, { key: 'B', text: 'b' }, { key: 'C', text: 'c' }, { key: 'D', text: 'd' }] };
}
/** Build an attempt through the real scorer so details/recovery match production. */
function attempt(id, daysAgo, spec, { subject = 'accountancy' } = {}) {
  const questions = spec.map((s, i) => question(i + 1, s.chapter, s.difficulty));
  const answers = {};
  const events = [];
  let seq = 1; let at = 1000;
  spec.forEach((s, i) => {
    const qid = `q${i + 1}`;
    events.push({ seq: seq++, qid, at, type: 'visit' });
    if (s.first !== undefined) { events.push({ seq: seq++, qid, at: at + 500, type: 'answer', answer: s.first }); }
    if (s.final !== undefined && s.final !== s.first) { events.push({ seq: seq++, qid, at: at + (s.dwell ?? 30) * 1000 - 100, type: 'answer', answer: s.final }); }
    if (s.final !== undefined) answers[qid] = s.final;
    at += (s.dwell ?? 30) * 1000;
  });
  events.push({ seq: seq++, qid: `q${spec.length}`, at: at + 10, type: 'visit' });
  const result = scoreSession(questions, answers, events, at + 1000);
  return { id, userId: 'u1', subject, ...result, questionsSnapshot: questions, selectionMeta: { recovery: result.recovery }, completedAt: NOW - daysAgo * DAY };
}

const R = 0; const W = 1; // option indexes: 0 is the right answer
const session1 = attempt('a1', 1, [
  { chapter: 'Partnership', final: R }, { chapter: 'Partnership', final: W }, { chapter: 'Partnership', final: W }, { chapter: 'Partnership', first: R, final: W, dwell: 200 },
  { chapter: 'Goodwill', final: R }, { chapter: 'Goodwill' }, { chapter: 'Goodwill', final: R }, { chapter: 'Goodwill', first: W, final: R },
  { chapter: 'Ratios', final: W, difficulty: 'easy' }, { chapter: 'Ratios' },
]);

test('empty record is an explicit empty state, never zeros dressed up as insight', () => {
  assert.equal(computePrepOSInsights([], { now: NOW }).state, 'empty');
  assert.deepEqual(readout({ state: 'empty' }), []);
  assert.match(answerFromInsights('where am I losing marks', { state: 'empty' }).reply, /nothing to analyse yet/i);
});

test('ledger uses +5/-1, counts blanks separately and never calls open marks recoverable', () => {
  const i = computePrepOSInsights([session1], { now: NOW });
  assert.equal(i.state, 'ready');
  assert.equal(i.ledger.gained, 4 * 5); // Q1, Q5, Q7, Q8 right
  assert.equal(i.ledger.penalty, 4); // Q2, Q3, Q4, Q9 wrong
  assert.equal(i.ledger.net, 20 - 4);
  assert.equal(i.ledger.openSkipped, 2 * 5);
  assert.equal(JSON.stringify(i).includes('recoverable'), false);
});

test('answer changes count both directions and the net can be positive or negative', () => {
  const i = computePrepOSInsights([session1], { now: NOW });
  assert.equal(i.changes.count, 2);
  assert.equal(i.changes.gains, 1);
  assert.equal(i.changes.losses, 1);
  assert.equal(i.changes.marksGained, 6);
  assert.equal(i.changes.marksLost, 6);
  assert.equal(i.changes.net, 0);
});

test('chapters rank only with enough questions; thin chapters are listed apart, never ranked', () => {
  const i = computePrepOSInsights([session1], { now: NOW });
  const ranked = i.chapters.ranked.map((c) => c.chapter);
  assert.deepEqual(ranked, ['Partnership', 'Goodwill'].filter((c) => i.chapters.ranked.some((r) => r.chapter === c)));
  assert.equal(i.chapters.ranked.every((c) => c.n >= MIN_CHAPTER_SAMPLE), true);
  assert.equal(i.chapters.thin.map((c) => c.chapter).includes('Ratios'), true, 'two questions is too few to rank');
  assert.equal(i.chapters.ranked[0].chapter, 'Partnership');
  assert.equal(i.chapters.ranked[0].open, 3 * 5);
});

test('wilson interval keeps a small sample honest', () => {
  const small = wilson(6, 10);
  const large = wilson(60, 100);
  assert.equal(small.pct, 60);
  assert.ok(small.high - small.low > large.high - large.low, 'fewer questions, wider range');
  assert.deepEqual(wilson(0, 0), { pct: null, low: null, high: null, n: 0 });
});

test('pace comes from device events, flags the slow question and ignores sessions without a timeline', () => {
  const dw = dwellByQuestion(session1);
  assert.ok(dw.get('q4') >= 199_000, 'Q4 took about 200 seconds');
  const noTimeline = { ...session1, id: 'a0', selectionMeta: {} };
  assert.equal(dwellByQuestion(noTimeline), null);
  const i = computePrepOSInsights([session1], { now: NOW });
  assert.equal(i.pace.usable, true);
  assert.equal(i.pace.slowest[0].position, 4);
  const none = computePrepOSInsights([noTimeline], { now: NOW });
  assert.equal(none.pace.usable, false);
  assert.equal(none.pace.slowest.length, 0);
});

test('weekly digest separates this week from last and describes, without verdicts', () => {
  const old = attempt('a2', 9, Array.from({ length: 6 }, (_, k) => ({ chapter: 'Partnership', final: k < 2 ? R : W })));
  const i = computePrepOSInsights([session1, old], { now: NOW });
  assert.equal(i.week.thisWeek.sessions, 1);
  assert.equal(i.week.lastWeek.sessions, 1);
  const reply = answerFromInsights('how was my week', i).reply;
  assert.match(reply, /Last 7 days: 1 session/);
  assert.match(reply, /not a verdict/);
});

test('readout and answers carry sample sizes and avoid causal claims', () => {
  const i = computePrepOSInsights([session1], { now: NOW });
  const found = readout(i, { limit: 6 });
  assert.ok(found.length >= 1 && found.length <= 6);
  for (const f of found) assert.ok(f.n > 0, `${f.id} states its sample`);
  const text = JSON.stringify(found) + answerFromInsights('where am i losing marks', i).reply;
  assert.doesNotMatch(text, /mastered|you will|guarantee|predict|because you/i);
  assert.equal(answerFromInsights('what is the capital of France', i), null, 'unrelated questions are left to the guide');
  assert.match(answerFromInsights('am I changing answers too much', i).reply, /Both directions are counted/);
});
