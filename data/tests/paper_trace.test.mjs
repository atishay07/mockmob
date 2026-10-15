// The paper trace, the one time calculator (data/paper_trace.js; spec tmp/mistake-lab-v4/SPEC.md 4.6, 6, 7 slice 2).
// It must: give old records exactly the numbers Time and decisions gave before slice 2; subtract time away; run the last
// question to the end event; skip 30-minute gaps only without away data; and make every reader of time agree.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readTrace, paperTrace, dwellOf, questionTraceLines, TRACE_RULES } from '../paper_trace.js';
import { buildTimeDecisions } from '../time_decisions.js';
import { dwellByQuestion as sessionDwell, analyseSession } from '../session_recovery.js';
import { dwellByQuestion as preposDwell } from '../prepos_insights.js';
import { paperDwell } from '../attempt_ledger.js';
import { scoreSession } from '../recovery.js';
import { FIXTURE_DIR } from '../../scripts/mistake-lab/build-fixtures.mjs';

const load = (name) => JSON.parse(readFileSync(join(FIXTURE_DIR, `${name}.json`), 'utf8'));
const OLD = ['full_mock_input', 'quick_set_input', 'no_missed_input', 'nta_shuffled_input'];
const NEW = ['replay_full_input', 'replay_time_up_input', 'replay_nta_input'];
const S = 1000;

// Time and decisions' own rule as it was before slice 2 (data/time_decisions.js at eeeaca20), frozen here.
function oldRule(timeline) {
  const events = timeline.filter((e) => e && e.qid && Number.isFinite(e.at) && e.type !== 'mark').sort((a, b) => a.at - b.at || (a.seq ?? 0) - (b.seq ?? 0));
  const dwell = new Map(); const visits = new Map(); const breaks = new Set(); let last = null;
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.qid !== last) { visits.set(e.qid, (visits.get(e.qid) || 0) + 1); last = e.qid; }
    const next = events[i + 1];
    if (!next) continue;
    const gap = next.at - e.at;
    if (gap >= 0 && gap <= 30 * 60 * 1000) dwell.set(e.qid, (dwell.get(e.qid) || 0) + gap);
    else if (gap > 30 * 60 * 1000) breaks.add(e.qid);
  }
  return { dwell, visits, breaks, lastQid: events.at(-1)?.qid ?? null };
}

const qs = ['q1', 'q2', 'q3'].map((id, i) => ({ id, correctIndex: i, options: ['a', 'b', 'c', 'd'].map((x) => `${id} ${x}`) }));
function paper(events, { answers = null, minutes = 60 } = {}) {
  const given = answers ?? Object.fromEntries(events.filter((e) => e.type === 'answer').map((e) => [e.qid, e.answer]));
  for (const k of Object.keys(given)) if (given[k] === null) delete given[k];
  const s = scoreSession(qs, given, events, minutes * 60 * S);
  return { questionsSnapshot: qs, details: s.details, selectionMeta: { mode: 'nta', durationMinutes: minutes, scoringVersion: 'server_snapshot_v1', recovery: s.recovery } };
}
let seq = 0;
const e = (qid, at, type, extra = {}) => ({ seq: ++seq, qid, at, type, ...extra });

test('old records: every number is exactly what Time and decisions gave before slice 2', () => {
  for (const name of OLD) {
    const rec = load(name).attempt.selectionMeta.recovery;
    const now = readTrace(rec);
    const before = oldRule(rec.timeline);
    assert.deepEqual([...now.dwell].sort(), [...before.dwell].sort(), name);
    assert.deepEqual([...now.visits].sort(), [...before.visits].sort(), name);
    assert.deepEqual([...now.breaks].sort(), [...before.breaks].sort(), name);
    assert.equal(now.lastQid, before.lastQid, name);
    assert.equal(now.openTail, true, name);
    assert.equal(now.awayKnown, false, name);
  }
});

test('old records get none of the 4.6 lines; a record that only kept marks gets the mark line', () => {
  const quick = load('quick_set_input').attempt;
  const t = paperTrace(quick);
  assert.equal(t.captured, false);
  for (const q of quick.questionsSnapshot) assert.deepEqual(questionTraceLines(t, q.id), []);
  const full = load('full_mock_input').attempt; // its mark on Q28 is kept since slice 2
  const ft = paperTrace(full);
  assert.equal(ft.captured, true);
  assert.deepEqual(questionTraceLines(ft, 'q28'), ['You marked it for review at 25:54. It was still marked at the end of the record.']);
});

test('time away is not counted, from the away to the next event of any kind', () => {
  seq = 0;
  const t = readTrace(paper([e('q1', 0, 'visit'), e('q1', 10 * S, 'away'), e('q1', 80 * S, 'back'), e('q1', 100 * S, 'answer', { answer: 0 }), e('q2', 120 * S, 'visit'), e('q2', 130 * S, 'end', { reason: 'submit' })]).selectionMeta.recovery);
  assert.equal(t.dwell.get('q1'), 50 * S); // 120 s on screen, 70 s away
  assert.equal(t.dwell.get('q2'), 10 * S); // the last question runs to the end event
  assert.deepEqual(t.awaySpans, [{ qid: 'q1', from: 10 * S, to: 80 * S }]);
  assert.equal(t.openTail, false);
  // An away closed by a visit (the app wrote a visit on resume before its back) ends at that visit.
  seq = 0;
  const u = readTrace(paper([e('q1', 0, 'visit'), e('q1', 10 * S, 'away'), e('q1', 40 * S, 'visit', { via: 'resume' }), e('q1', 41 * S, 'back'), e('q1', 50 * S, 'answer', { answer: 0 })]).selectionMeta.recovery);
  assert.equal(u.dwell.get('q1'), 20 * S);
  assert.equal(u.visits.get('q1'), 1, 'a resume visit on the same question is not a new visit');
});

test('a lone back and a repeated away change nothing; an away still open at the end runs to the end', () => {
  seq = 0;
  const t = readTrace(paper([e('q1', 0, 'back'), e('q1', 0, 'visit'), e('q1', 10 * S, 'away'), e('q1', 20 * S, 'away'), e('q1', 50 * S, 'back'), e('q2', 60 * S, 'visit'), e('q2', 70 * S, 'away'), e('q2', 90 * S, 'end', { reason: 'nta_strikes' })]).selectionMeta.recovery);
  assert.equal(t.dwell.get('q1'), 20 * S); // 0 to 10 and 50 to 60
  assert.equal(t.dwell.get('q2'), 10 * S); // 60 to 70; away from 70 to the end
  assert.deepEqual(t.awaySpans.map((a) => [a.qid, a.from, a.to]), [['q1', 10 * S, 50 * S], ['q2', 70 * S, 90 * S]]);
  // A trailing away with no end is open: no time is claimed for it.
  seq = 0;
  const open = readTrace(paper([e('q1', 0, 'visit'), e('q1', 30 * S, 'answer', { answer: 0 }), e('q1', 40 * S, 'away')]).selectionMeta.recovery);
  assert.equal(open.dwell.get('q1'), 40 * S);
  assert.deepEqual(open.awaySpans, []);
});

test('the 30-minute break applies only to records without away data', () => {
  seq = 0;
  const gap = TRACE_RULES.maxGapMs + 60 * S;
  const old = readTrace([{ seq: 1, qid: 'q1', at: 0, type: 'visit' }, { seq: 2, qid: 'q2', at: gap, type: 'visit' }, { seq: 3, qid: 'q2', at: gap + 5 * S, type: 'answer', answer: 1 }]);
  assert.equal(old.dwell.has('q1'), false);
  assert.ok(old.breaks.has('q1'));
  const withAway = readTrace({ timeline: old.timeline, presence: [{ seq: 4, qid: 'q2', at: gap + 6 * S, type: 'away' }] });
  assert.equal(withAway.dwell.get('q1'), gap, 'the device said when the student left, so nothing is guessed');
  assert.equal(withAway.breaks.size, 0);
});

test('every reader of time agrees: the trace, Time and decisions, the session read, PrepOS and the ledger', () => {
  for (const name of [...OLD, ...NEW]) {
    const { attempt } = load(name);
    const trace = paperTrace(attempt);
    const td = buildTimeDecisions(attempt);
    const prepos = preposDwell(attempt);
    const session = sessionDwell(attempt.selectionMeta.recovery);
    const ledger = paperDwell(attempt);
    const analysis = analyseSession(attempt);
    for (const row of td.rows) {
      const ms = trace.dwell.get(row.qid);
      if (row.opened) assert.equal(row.ms, ms || 0, `${name} ${row.qid} time and decisions`);
      assert.equal(prepos.get(row.qid), ms, `${name} ${row.qid} prepos`);
      if (ms > 0) assert.equal(session[row.qid], ms, `${name} ${row.qid} session read`);
      if (ledger) assert.equal(ledger.get(row.qid), ms, `${name} ${row.qid} ledger`);
      assert.equal(analysis.rows.find((r) => r.q.id === row.qid).ms, ms > 0 ? ms : null, `${name} ${row.qid} analysis`);
    }
  }
});

test("with an end event, a question's visits less its time away add up to its time", () => {
  for (const name of NEW) {
    const t = paperTrace(load(name).attempt);
    const onScreen = new Map();
    for (const s of t.spans) onScreen.set(s.qid, (onScreen.get(s.qid) || 0) + (s.to - s.from));
    for (const a of t.awaySpans) onScreen.set(a.qid, onScreen.get(a.qid) - (a.to - a.from));
    for (const [qid, ms] of onScreen) assert.equal(t.dwell.get(qid) || 0, ms, `${name} ${qid}`);
  }
});

test('the dwell wrappers keep their old shapes: an object or a Map, null when unusable', () => {
  assert.equal(sessionDwell([{ seq: 1, qid: 'q1', at: 0 }]), null);
  const d = sessionDwell([{ seq: 1, qid: 'q1', at: 0, type: 'visit' }, { seq: 2, qid: 'q2', at: 9000, type: 'visit' }, { seq: 3, qid: 'q2', at: 9000, type: 'answer', answer: 1 }]);
  assert.deepEqual(d, { q1: 9000 }, 'questions with no time are left out, as before');
  assert.equal(preposDwell({ selectionMeta: { recovery: { telemetry: 'self_reported', timeline: [] } } }), null);
  assert.ok(dwellOf([]) instanceof Map);
});

test('the session read now skips a break of over 30 minutes, as every other screen does (a legitimate change)', () => {
  const tl = [{ seq: 1, qid: 'q1', at: 0, type: 'visit' }, { seq: 2, qid: 'q1', at: 40 * 60 * S, type: 'answer', answer: 0 }, { seq: 3, qid: 'q2', at: 41 * 60 * S, type: 'visit' }];
  assert.deepEqual(sessionDwell(tl), { q1: 60 * S }); // before slice 2 this read gave q1 41 minutes
});

test('trace lines: later visit or without leaving, marks by how the paper ended, strike-outs, time away, the end', () => {
  seq = 0;
  const events = [
    e('q1', 0, 'visit'), e('q1', 5 * S, 'strike', { option: 0, on: true }), e('q1', 8 * S, 'strike', { option: 2, on: true }),
    e('q1', 12 * S, 'strike', { option: 0, on: false }), e('q1', 20 * S, 'answer', { answer: 1 }), e('q1', 30 * S, 'answer', { answer: 3 }),
    e('q1', 31 * S, 'mark', { marked: true }), e('q2', 40 * S, 'visit', { via: 'next' }), e('q2', 45 * S, 'away'), e('q2', 115 * S, 'back'),
    e('q2', 120 * S, 'answer', { answer: 1 }), e('q2', 121 * S, 'mark', { marked: true }), e('q2', 122 * S, 'mark', { marked: false }),
    e('q1', 130 * S, 'visit', { via: 'palette' }), e('q1', 140 * S, 'answer', { answer: 0 }), e('q3', 150 * S, 'visit', { via: 'next' }),
    e('q3', 155 * S, 'strike', { option: 2, on: true }), e('q3', 160 * S, 'answer', { answer: 0 }), e('q3', 200 * S, 'end', { reason: 'time_up' }),
  ];
  const a = paper(events);
  const td = buildTimeDecisions(a);
  const lines = (qid) => td.rows.find((r) => r.qid === qid).lines;
  assert.deepEqual(lines('q1').slice(1), [
    'Picked B at 0:20. Changed to D at 0:30, 10s later, without leaving the question. Changed to A at 2:20, 1m 50s later, on a later visit.',
    'Together these 2 changes gained 6 marks.',
    'You crossed out A, the key, at 0:05 and restored it at 0:12.',
    'You crossed out C at 0:08.',
    'You marked it for review at 0:31. It was still marked when time ran out.',
  ]);
  assert.deepEqual(lines('q2').slice(1), [
    'Picked B at 2:00.',
    'You marked it for review at 2:01 and removed the mark at 2:02.',
    'Away from the paper for 1m 10s while this question was open. Not counted.',
  ]);
  assert.deepEqual(lines('q3'), [
    '50s on this question. The paper gives 20m a question.',
    'Picked A at 2:40.',
    'You crossed out C, the key, at 2:35.',
    'Time ran out at 3:20 with this question open.',
  ]);
  assert.equal(td.end.reason, 'time_up');
  assert.equal(td.captured, true);
});

test('a submit closes the last question: its time is no longer "at least" and says when the student submitted', () => {
  const base = () => { seq = 0; return [e('q1', 0, 'visit'), e('q1', 10 * S, 'answer', { answer: 0 }), e('q2', 20 * S, 'visit'), e('q2', 30 * S, 'answer', { answer: 1 })]; };
  const open = buildTimeDecisions(paper(base()));
  assert.match(open.rows[1].lines[0], /^At least 10s on this question\./);
  const closed = buildTimeDecisions(paper([...base(), e('q2', 95 * S, 'end', { reason: 'submit' })]));
  assert.equal(closed.rows[1].lines[0], '1m 15s on this question, until you submitted at 1:35. The paper gives 20m a question.');
  const nta = buildTimeDecisions(paper([...base(), e('q2', 40 * S, 'away'), e('q2', 55 * S, 'end', { reason: 'nta_strikes' })]));
  assert.deepEqual(nta.rows[1].lines.slice(-2), ['Away from the paper for 15s while this question was open. Not counted.', 'Your answers were submitted at 0:55, after the third warning, with this question open.']);
});

test('a mark or a strike on another question of a passage page never moves time off the question on screen', () => {
  // The web runner shows a passage set on one page: one visit for the set, and a mark or a strike names the
  // sub-question it was made on. The time stays with the question the last visit or answer named, so the Replay's
  // bars, Time and decisions and the time away all describe the same span.
  seq = 0;
  const t = readTrace(paper([
    e('q1', 0, 'visit'), e('q1', 30 * S, 'answer', { answer: 0 }), e('q3', 40 * S, 'mark', { marked: true }),
    e('q3', 45 * S, 'strike', { option: 1, on: true }), e('q3', 50 * S, 'away'), e('q3', 70 * S, 'back'),
    e('q2', 90 * S, 'answer', { answer: 1 }), e('q2', 100 * S, 'end', { reason: 'submit' }),
  ]).selectionMeta.recovery);
  assert.equal(t.dwell.get('q1'), 70 * S); // 0 to 90, less 20 s away
  assert.equal(t.dwell.has('q3'), false);
  assert.deepEqual(t.awaySpans, [{ qid: 'q1', from: 50 * S, to: 70 * S }]);
  const onScreen = new Map();
  for (const s of t.spans) onScreen.set(s.qid, (onScreen.get(s.qid) || 0) + (s.to - s.from));
  for (const a of t.awaySpans) onScreen.set(a.qid, onScreen.get(a.qid) - (a.to - a.from));
  for (const [qid, ms] of onScreen) assert.equal(t.dwell.get(qid) || 0, ms, qid);
  assert.deepEqual(questionTraceLines(t, 'q3'), ['You crossed out B at 0:45.', 'You marked it for review at 0:40. It was still marked when you submitted.']);
  assert.deepEqual(questionTraceLines(t, 'q1'), ['Away from the paper for 20s while this question was open. Not counted.']);
});

test('time away under half a second is not counted and gets no words (the third NTA warning submits at once)', () => {
  seq = 0;
  const a = paper([e('q1', 0, 'visit'), e('q1', 10 * S, 'answer', { answer: 0 }), e('q1', 20 * S, 'away'), e('q1', 20 * S + 200, 'end', { reason: 'nta_strikes' })]);
  const t = paperTrace(a);
  assert.equal(t.dwell.get('q1'), 20 * S);
  assert.equal(t.awaySpans.length, 1);
  assert.deepEqual(questionTraceLines(t, 'q1'), ['Your answers were submitted at 0:20, after the third warning, with this question open.']);
});
