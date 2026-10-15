// "From your record" lines (data/mistake_insights.js): server-built sentences from stored records only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreSession } from '../recovery.js';
import { buildMissedBefore } from '../../src/components/recovery/repairRun.js';
import { buildMistakeInsights, INSIGHT_COPY } from '../mistake_insights.js';

const at = (d) => Date.UTC(2026, 9, d, 4, 30);

// qs: [{ id, chapter, key, final, first?, secs?, options? }]; final is an index or null.
function make({ id, mode = 'full', day = 15, qs, telemetry = true, version = 'server_snapshot_v1', order = null }) {
  const questions = qs.map((q) => {
    const texts = ['alpha', 'beta', 'gamma', 'delta'].map((w) => `${w} for ${q.base ?? q.id}`);
    const shown = order?.[q.id] ? order[q.id].map((i) => texts[i]) : texts;
    return { id: q.id, chapter: q.chapter ?? 'Share Capital', options: shown.map((text) => ({ text })), correctIndex: q.key ?? 0 };
  });
  const answers = Object.fromEntries(qs.filter((q) => q.final !== null && q.final !== undefined).map((q) => [q.id, q.final]));
  const events = [];
  if (telemetry) {
    let t = 0; let seq = 0;
    for (const q of qs) {
      events.push({ seq: ++seq, qid: q.id, at: t, type: 'visit' });
      if (Number.isInteger(q.first)) events.push({ seq: ++seq, qid: q.id, at: t + 300, type: 'answer', answer: q.first });
      if (answers[q.id] !== undefined) events.push({ seq: ++seq, qid: q.id, at: t + (q.secs ?? 30) * 1000 - 100, type: 'answer', answer: answers[q.id] });
      t += (q.secs ?? 30) * 1000;
    }
  }
  const s = scoreSession(questions, answers, events);
  if (!telemetry) { s.recovery.telemetry = 'invalid'; s.recovery.timeline = []; }
  return { id, subject: 'accountancy', total: s.total, correct: s.correct, wrong: s.wrong, details: s.details, questionsSnapshot: questions,
    completedAt: at(day), mode, selectionMeta: { mode, scoringVersion: version, recovery: s.recovery } };
}

const fill = (prefix, k, extra = {}) => Array.from({ length: k }, (_, i) => ({ id: `${prefix}${i}`, final: 0, secs: 40 + i, ...extra }));

test('only wrong answers get an entry, with evidence nulls where a value is not known', () => {
  const a = make({ id: 'a', telemetry: false, qs: [{ id: 'w', final: 1 }, { id: 'r', final: 0 }, { id: 'b', final: null }] });
  const out = buildMistakeInsights({ attempt: a, allAttempts: [a] });
  assert.deepEqual(Object.keys(out), ['w']);
  assert.deepEqual(out.w, { lines: [], evidence: { firstIndex: null, finalIndex: 1, seconds: null, medianSeconds: null, timed: null, chapter: { right: 1, answered: 2, papers: 1 } } });
});

test('answer change lines: from the key, from another option, and none when the first pick is the final one', () => {
  const a = make({ id: 'a', qs: [{ id: 'k', key: 3, first: 3, final: 1 }, { id: 'o', key: 3, first: 0, final: 1 }, { id: 'same', key: 3, first: 1, final: 1 }] });
  const out = buildMistakeInsights({ attempt: a, allAttempts: [a] });
  assert.deepEqual(out.k.lines[0], { kind: 'change', text: 'Your first answer here was D, the key. You changed it to B.' });
  assert.deepEqual(out.o.lines[0], { kind: 'change', text: 'You first chose A here, then changed to B.' });
  assert.equal(out.o.evidence.firstIndex, 0);
  assert.ok(!out.same.lines.some((l) => l.kind === 'change'));
  const noTel = { ...a, selectionMeta: { ...a.selectionMeta, recovery: { ...a.selectionMeta.recovery, telemetry: 'inconsistent' } } };
  assert.ok(!buildMistakeInsights({ attempt: noTel, allAttempts: [noTel] }).k.lines.some((l) => l.kind === 'change'));
});

test('time line: reliable timing, 10 timed questions, and 2 s or more on this one', () => {
  const a = make({ id: 'a', qs: [{ id: 'w', final: 1, secs: 41 }, ...fill('f', 9)] });
  const out = buildMistakeInsights({ attempt: a, allAttempts: [a] });
  assert.deepEqual(out.w.lines.find((l) => l.kind === 'time'), { kind: 'time', text: INSIGHT_COPY.time('41s', '44s', 10) });
  assert.equal(out.w.lines.find((l) => l.kind === 'time').text, '41s on this question. Your median in this paper was 44s over 10 timed questions.');
  assert.deepEqual([out.w.evidence.seconds, out.w.evidence.medianSeconds, out.w.evidence.timed], [41, 44, 10]);
  const few = make({ id: 'b', qs: [{ id: 'w', final: 1, secs: 41 }, ...fill('f', 8)] });
  assert.ok(!buildMistakeInsights({ attempt: few, allAttempts: [few] }).w.lines.some((l) => l.kind === 'time'));
  const long = make({ id: 'c', qs: [{ id: 'w', final: 1, secs: 125 }, ...fill('f', 9)] });
  assert.match(buildMistakeInsights({ attempt: long, allAttempts: [long] }).w.lines.find((l) => l.kind === 'time').text, /^2m 05s on this question\./);
  const flick = make({ id: 'd', qs: [{ id: 'w', final: 1, secs: 1 }, ...fill('f', 10)] });
  assert.ok(!buildMistakeInsights({ attempt: flick, allAttempts: [flick] }).w.lines.some((l) => l.kind === 'time'));
});

test('repeat_same: the same option text in the newest earlier miss, shuffles included', () => {
  const earlier = make({ id: 'm1', day: 9, telemetry: false, qs: [{ id: 'x', key: 0, final: 2 }, { id: 'y', key: 0, final: 1 }], order: { x: [0, 1, 2, 3] } });
  // This paper shows x's options in another order: "gamma" (index 2 before) is now index 1.
  const cur = make({ id: 'm2', day: 15, telemetry: false, qs: [{ id: 'x', key: 0, final: 1 }, { id: 'y', key: 0, final: 2 }], order: { x: [0, 2, 1, 3] } });
  const all = [cur, earlier];
  const out = buildMistakeInsights({ attempt: cur, allAttempts: all, missedBefore: buildMissedBefore(all, cur.id) });
  assert.deepEqual(out.x.lines.find((l) => l.kind === 'repeat_same'), { kind: 'repeat_same', text: 'You chose the same option when you missed this in Mock 1 on 9 Oct.' });
  assert.ok(!out.y.lines.some((l) => l.kind === 'repeat_same'));
  const practice = { ...earlier, mode: 'quick', selectionMeta: { ...earlier.selectionMeta, mode: 'quick' } };
  const p = buildMistakeInsights({ attempt: cur, allAttempts: [cur, practice], missedBefore: buildMissedBefore([cur, practice], cur.id) });
  assert.equal(p.x.lines.find((l) => l.kind === 'repeat_same').text, 'You chose the same option when you missed this in a practice set on 9 Oct.');
  const later = { ...earlier, completedAt: at(20) };
  const l = buildMistakeInsights({ attempt: cur, allAttempts: [cur, later], missedBefore: buildMissedBefore([cur, later], cur.id) });
  assert.ok(!l.x.lines.some((line) => line.kind === 'repeat_same'));
});

test('chapter line: 4 answered across 2 papers, this paper counted, never for an unmapped chapter', () => {
  const old = make({ id: 'old', day: 3, telemetry: false, qs: [{ id: 'o1', final: 0 }, { id: 'o2', final: 0 }, { id: 'o3', final: 1 }] });
  const cur = make({ id: 'cur', day: 15, telemetry: false, qs: [{ id: 'w', final: 1 }, { id: 'u', chapter: '', final: 1 }] });
  const out = buildMistakeInsights({ attempt: cur, allAttempts: [cur, old] });
  assert.deepEqual(out.w.lines, [{ kind: 'chapter', text: 'Share Capital so far: 2 right of 4 answered across 2 papers, this one included.' }]);
  assert.deepEqual(out.u.lines, []);
  assert.equal(out.u.evidence.chapter, null);
  const thin = buildMistakeInsights({ attempt: cur, allAttempts: [cur] });
  assert.deepEqual(thin.w.lines, []);
  const held = buildMistakeInsights({ attempt: cur, allAttempts: [cur, old], answerReviews: { w: { state: 'under_review' } } });
  assert.deepEqual(held.w.lines, []); // this paper no longer counts in the chapter, so "this one included" would be false
});

test('lines come in order and never name a cause', () => {
  const old = make({ id: 'old', day: 3, telemetry: false, qs: [{ id: 'w', key: 3, final: 1 }, { id: 'o2', final: 0 }, { id: 'o3', final: 0 }] });
  const cur = make({ id: 'cur', day: 15, qs: [{ id: 'w', key: 3, first: 3, final: 1, secs: 20 }, ...fill('f', 10)] });
  const all = [cur, old];
  const out = buildMistakeInsights({ attempt: cur, allAttempts: all, missedBefore: buildMissedBefore(all, cur.id) });
  assert.deepEqual(out.w.lines.map((l) => l.kind), ['change', 'time', 'repeat_same', 'chapter']);
  for (const l of out.w.lines) assert.ok(!/\b(?:rushed|careless|guessed|panicked)\b|[!—·]/i.test(l.text), l.text);
});

test('a question under re-check or corrected shows no record line, not even the answer change', () => {
  const cur = make({ id: 'cur', day: 15, qs: [{ id: 'w', key: 3, first: 3, final: 1, secs: 20 }, ...fill('f', 10)] });
  const open = buildMistakeInsights({ attempt: cur, allAttempts: [cur] });
  assert.ok(open.w.lines.some((l) => l.kind === 'change'));
  for (const state of ['under_review', 'corrected', 'key_changed_unverified', 'withdrawn', 'content_changed']) {
    const held = buildMistakeInsights({ attempt: cur, allAttempts: [cur], answerReviews: { w: { state } } });
    assert.deepEqual(held.w.lines, [], state);
  }
});
