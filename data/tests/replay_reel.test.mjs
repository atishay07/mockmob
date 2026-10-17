// "Play your paper back" (owner D29) and the replay's events (D17) are ONE engine (data/replay.js): the reel is a pure function
// of the attempt record (its rows, its answer changes, the replay read from its trace, the costliest chapter, the next move).
// These tests run it on the committed 50-question paper and on a 10-question paper and the 58-second paper (the cut case).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { analyseSession } from '../session_recovery.js';
import { costliestLine } from '../result_next_move.mjs';
import { REEL_RULES, eventCaption, reelFrameAt, reelKeyFrames, reelMoments, reelScript, reelSeconds, replayView } from '../replay.js';

const load = (name) => JSON.parse(readFileSync(new URL(`./fixtures/mistake_lab/${name}.json`, import.meta.url), 'utf8'));
const NEXT = { kind: 'repair', label: 'Repair Q42', target: { number: 42 } };

// paper50: the committed 50-question replay paper, with its real trace and answer changes.
const input = load('replay_full_input');
const contract = load('contract_replay_v1');
const attempt50 = input.attempt;
const analysis50 = analyseSession(attempt50);
const changes50 = attempt50.selectionMeta.recovery.observed.answerChanges;
const view50 = replayView(contract.replay, { total: analysis50.rows.length });
const finding50 = costliestLine(analysis50, {});
const script50 = reelScript({ rows: analysis50.rows, changes: changes50, view: view50, paceSec: 72, finding: finding50, next: NEXT });

// paper10 and paper58s: built inline, 10 questions, from rows the result page would hold.
const row = (n, verdict, chapter = 'Goodwill', key = 2) => ({ number: n, verdict, chapter, q: { id: `p${n}`, correctIndex: key } });
const rows10 = [row(1, 'wrong'), row(2, 'correct'), row(3, 'wrong'), row(4, 'correct'), row(5, 'correct'), row(6, 'wrong'), row(7, 'correct'), row(8, 'wrong'), row(9, 'correct'), row(10, 'wrong', 'Admission of a Partner')];
const finding10 = { line: 'Goodwill cost 24 of the 30 marks you missed.', detail: '4 wrong, of 9 questions.', chapter: 'Goodwill' };
const replay58 = {
  rowSec: 600, recordSec: 58, durationSec: 600, total: 10, end: { at: 58, reason: 'submit' }, opened: [], facts: [],
  rows: [{ bars: rows10.map((r, i) => ({ n: r.number, from: i * 5, to: i * 5 + 5, result: r.verdict === 'correct' ? 'right' : 'wrong', picks: [{ at: i * 5 + 4, option: r.verdict === 'correct' ? 2 : 0, change: false }], away: [] })) }],
};

test('the reel is a pure function of the record: the same inputs give the same frames', () => {
  const again = reelScript({ rows: analysis50.rows, changes: changes50, view: view50, paceSec: 72, finding: finding50, next: NEXT });
  assert.deepEqual(again, script50);
});

test('paper50: one light frame a question, in paper order, and the score counts to the paper\'s own score', () => {
  const lights = script50.frames.filter((f) => f.kind === 'light');
  assert.equal(lights.length, 50);
  assert.deepEqual(lights.map((f) => f.n), Array.from({ length: 50 }, (_, i) => i + 1));
  assert.deepEqual(lights.map((f) => f.lit), Array.from({ length: 50 }, (_, i) => i + 1));
  assert.equal(lights.at(-1).marks, analysis50.marks.scored);
  assert.equal(script50.score, analysis50.marks.scored);
  assert.equal(script50.max, 250);
  // Every step of the running score is one question's marks: +5, -1 or 0.
  lights.reduce((prev, f) => { assert.ok([5, -1, 0].includes(f.marks - prev)); return f.marks; }, 0);
  // Clock order, no two frames at once.
  script50.frames.reduce((prev, f) => { assert.ok(f.t > prev, `frame at ${f.t} after ${prev}`); return f.t; }, -1);
});

test('paper50: about 20 seconds, ending on the costliest chapter and then the one next move', () => {
  assert.ok(script50.durationMs >= 14000 && script50.durationMs <= 24000, String(script50.durationMs));
  assert.equal(reelSeconds(script50) % 5, 0);
  const kinds = script50.frames.map((f) => f.kind);
  assert.equal(kinds[0], 'start');
  assert.equal(kinds.at(-1), 'next');
  assert.equal(kinds.at(-2), 'chapter');
  const chapter = script50.frames.at(-2);
  assert.equal(chapter.caption.text, finding50.line);
  assert.equal(chapter.chapter.name, 'Share Capital');
  // The chapter's bubbles are the questions of that chapter that lost marks.
  assert.deepEqual(chapter.chapter.numbers, analysis50.rows.filter((r) => r.chapter === 'Share Capital' && r.verdict !== 'correct').map((r) => r.number));
  assert.deepEqual(script50.frames.at(-1).next, NEXT);
});

test('paper50: every pause is a real moment the record shows, at most three', () => {
  assert.ok(script50.moments.length >= 1 && script50.moments.length <= REEL_RULES.maxMoments);
  const byQid = new Map();
  for (const c of changes50) byQid.set(c.qid, [...(byQid.get(c.qid) || []), c]);
  for (const m of script50.moments) {
    const r = analysis50.rows[m.n - 1];
    const list = byQid.get(r.q.id);
    assert.ok(list?.length, `Q${m.n} has a recorded change`);
    if (m.kind === 'lost') {
      assert.equal(r.verdict, 'wrong');
      assert.equal(list[0].before, r.q.correctIndex, 'the first answer was the key');
      assert.match(m.text, new RegExp(`^Q${m.n}: you changed a right answer to wrong\\. It cost 6 marks\\.$`));
    }
    if (m.kind === 'won') { assert.equal(r.verdict, 'correct'); assert.notEqual(list[0].before, r.q.correctIndex); }
  }
  // The same moments are in the replay's own events: a 'lost' moment is a real change event leaving the key.
  const events = view50.events;
  for (const m of script50.moments.filter((x) => x.kind === 'lost')) {
    const e = events.find((x) => x.n === m.n && x.kind === 'change');
    assert.ok(e, `the replay has Q${m.n}'s change`);
    assert.equal(e.from, analysis50.rows[m.n - 1].q.correctIndex);
    assert.match(eventCaption(e, { key: e.from }).text, /a right answer made wrong\.$/);
  }
  // Each moment pauses the sheet: a moment frame follows its question's light frame, and holds for momentMs.
  for (const m of script50.moments) {
    const i = script50.frames.findIndex((f) => f.kind === 'moment' && f.n === m.n);
    assert.ok(i > 0 && script50.frames[i - 1].kind === 'light' && script50.frames[i - 1].n === m.n);
    assert.equal(script50.frames[i + 1].t - script50.frames[i].t, REEL_RULES.momentMs);
    assert.equal(script50.frames[i].caption.text, m.text);
  }
});

test('the owner\'s example caption: "Q22 changed D to A, a right answer made wrong" at 20:40', () => {
  const c = eventCaption({ at: 1240, n: 22, kind: 'change', from: 3, to: 0 }, { key: 3 });
  assert.deepEqual(c, { at: '20:40', text: 'Q22 changed D to A, a right answer made wrong.' });
  assert.equal(eventCaption({ at: 100, n: 5, kind: 'change', from: 1, to: 2 }, { key: 2 }).text, 'Q5 changed B to C, a wrong answer made right.');
  assert.equal(eventCaption({ at: 100, n: 5, kind: 'change', from: 0, to: 1 }, { key: 2 }).text, 'Q5 changed A to B.');
  assert.equal(eventCaption({ at: 100, n: 5, kind: 'pick', to: 2 }).text, 'Q5 picked C.');
  assert.equal(eventCaption({ at: 100, n: 5, kind: 'back' }).text, 'Back to Q5.');
  assert.equal(eventCaption({ at: 100, n: 5, kind: 'clear' }).text, 'Q5 answer cleared.');
  assert.equal(eventCaption({ at: 3106, n: null, kind: 'end' }).text, 'Submitted.');
  assert.equal(eventCaption(null), null);
});

test('paper10: the reel is sized to the paper, 10 lights, a few seconds, no invented moment', () => {
  const view = replayView(replay58, { total: 10 });
  const script = reelScript({ rows: rows10, changes: [], view, paceSec: 60, finding: finding10, next: { kind: 'repair', label: 'Repair Q1' } });
  assert.equal(script.frames.filter((f) => f.kind === 'light').length, 10);
  assert.equal(script.moments.length, 0);
  assert.equal(script.frames.filter((f) => f.kind === 'moment').length, 0);
  assert.equal(script.score, 5 * 5 - 5, '5 right, 5 wrong');
  assert.ok(script.durationMs < script50.durationMs, 'a 10-question paper plays shorter than a mock');
  assert.ok(reelSeconds(script) <= 15);
});

test('paper58s: the replay is cut (nothing to replay) but the sheet, score, chapter and next move still play, with no timing moment', () => {
  const view = replayView(replay58, { total: 10 });
  assert.deepEqual(view.cut, { reason: 'short' });
  const script = reelScript({ rows: rows10, changes: [], view, paceSec: 60, finding: finding10, next: NEXT });
  assert.ok(script);
  assert.equal(script.moments.length, 0);
  assert.equal(script.frames.at(-1).kind, 'next');
  // A cut view never yields a long-stay moment, however long a slot looks.
  const longView = { cut: { reason: 'short' }, perQuestion: [{ n: 1, sec: 400, result: 'wrong' }] };
  assert.deepEqual(reelMoments({ rows: rows10, changes: [], view: longView, paceSec: 60 }), []);
});

test('a long stay on a question that did not earn marks is a moment; a long stay on a right answer is not', () => {
  const view = { cut: null, perQuestion: rows10.map((r) => ({ n: r.number, sec: r.number === 3 ? 200 : r.number === 4 ? 300 : 30, result: r.verdict })) };
  const moments = reelMoments({ rows: rows10, changes: [], view, paceSec: 60 });
  assert.deepEqual(moments.map((m) => [m.kind, m.n]), [['long', 3]]);
  assert.equal(moments[0].text, 'Q3: 3m 20s on it, 3.3 times the even pace of 1m. It was wrong.');
});

test('a changed answer that ended right is a "won" moment; one that went back to the key is not a "lost" one', () => {
  const rows = [row(1, 'correct'), row(2, 'correct'), row(3, 'wrong')];
  const changes = [
    { qid: 'p1', at: 60000, before: 0, after: 2, markEffect: 6 }, // wrong to right
    { qid: 'p2', at: 90000, before: 2, after: 1, markEffect: -6 }, { qid: 'p2', at: 95000, before: 1, after: 2, markEffect: 6 }, // right, away, back: final right
    { qid: 'p3', at: 120000, before: 2, after: 0, markEffect: -6 }, // right to wrong, final wrong
  ];
  const moments = reelMoments({ rows, changes });
  assert.deepEqual(moments.map((m) => [m.kind, m.n, m.at]), [['won', 1, '1:00'], ['lost', 3, '2:00']]);
});

test('the three-moment cap ranks lost first, then the long stay, then a won change', () => {
  const rows = Array.from({ length: 8 }, (_, i) => row(i + 1, i < 5 ? 'wrong' : 'correct'));
  const changes = [1, 2, 3].map((n) => ({ qid: `p${n}`, at: n * 1000, before: 2, after: 0, markEffect: -6 }));
  changes.push({ qid: 'p6', at: 9000, before: 0, after: 2, markEffect: 6 });
  const view = { cut: null, perQuestion: rows.map((r) => ({ n: r.number, sec: r.number === 5 ? 240 : 30, result: r.verdict })) };
  const moments = reelMoments({ rows, changes, view, paceSec: 60 });
  assert.equal(moments.length, 3);
  assert.deepEqual(moments.map((m) => m.kind), ['lost', 'lost', 'long']);
});

test('nothing answered, or no rows: nothing to play back', () => {
  assert.equal(reelScript({ rows: [] }), null);
  assert.equal(reelScript({ rows: [row(1, 'skipped'), row(2, 'skipped')] }), null);
});

test('reelFrameAt returns the frame showing at a clock time; the key frames are the moments, the chapter and the next move', () => {
  assert.equal(reelFrameAt(script50, 0).kind, 'start');
  assert.equal(reelFrameAt(script50, -5).kind, 'start');
  const last = script50.frames.at(-1);
  assert.equal(reelFrameAt(script50, last.t + 5000), last);
  const light7 = script50.frames.find((f) => f.kind === 'light' && f.n === 7);
  assert.equal(reelFrameAt(script50, light7.t + 1).n, 7);
  const keys = reelKeyFrames(script50);
  assert.deepEqual(keys.map((f) => f.kind), [...script50.moments.map(() => 'moment'), 'chapter', 'next']);
});
