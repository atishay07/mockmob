import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  RUN_COPY, runSegments, canGoTo, segmentLabel, stepIndex, swipeIntent, arrowIntent,
  sourceLabel, buildMissedBefore, earlierMisses, missedCount, dayMonth, earlierMissLine,
  endingModel, retryIds, endingFact, nothingLine, tonightOrToday, finishFor, endingAct, repairAct,
  createOnceGate, createTapCycle, tapAct, REPAIR_MOBI_MOOD, TAP_CYCLE, TAP_VISIT_CAP, TAP_IDLE_RESET_MS,
} from '../../src/components/recovery/repairRun.js';
import { repairMood } from '../repair_presentation.mjs';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const ids = ['a', 'b', 'c', 'd'];
const numbers = { a: 2, b: 5, c: 7, d: 9 };

test('the run track is drawn only from real outcomes', () => {
  const seg = runSegments({ ids, numbers, outcomes: { a: 'explained', b: 'held_for_recheck', c: 'not_explained' }, reached: new Set(['a', 'b', 'c']), current: 'c' });
  assert.deepEqual(seg.map((s) => s.state), ['done', 'setAside', 'current', 'upcoming']);
  assert.deepEqual(seg.map((s) => s.number), [2, 5, 7, 9]);
  // A stored (reopened) repair is done too; a failed call leaves a reached mistake "seen", never done.
  const later = runSegments({ ids, numbers, outcomes: { a: 'stored' }, reached: new Set(['a', 'b']), current: 'a' });
  assert.deepEqual(later.map((s) => s.state), ['done', 'seen', 'upcoming', 'upcoming']);
  assert.equal(later[0].current, true, 'a repaired mistake on screen is both done and current');
  assert.equal(runSegments({ ids, numbers, outcomes: { a: 'error' }, reached: new Set(['a']), current: null })[0].state, 'seen');
});

test('only reached segments can be shown again, and stepping skips what is ahead', () => {
  const seg = runSegments({ ids, numbers, outcomes: { a: 'explained', c: 'explained' }, reached: new Set(['a', 'b', 'c']), current: 'b' });
  assert.deepEqual(seg.map((_, i) => canGoTo(seg, i)), [true, true, true, false]);
  assert.equal(stepIndex(seg, 1, -1), 0);
  assert.equal(stepIndex(seg, 1, 1), 2);
  assert.equal(stepIndex(seg, 2, 1), -1, 'the next one has not been reached');
  assert.equal(stepIndex(seg, 0, -1), -1);
  assert.equal(segmentLabel(seg, 0), 'Mistake 1 of 4, repaired');
  assert.equal(segmentLabel(seg, 1), 'Mistake 2 of 4, on screen');
  assert.equal(segmentLabel(seg, 3), 'Mistake 4 of 4, not reached yet');
  assert.equal(segmentLabel(runSegments({ ids, numbers, outcomes: { a: 'explained' }, reached: new Set(['a']), current: 'a' }), 0), 'Mistake 1 of 4, repaired, on screen');
  assert.equal(RUN_COPY.progress(1, 1), '1 of 1 mistake');
  assert.equal(RUN_COPY.progress(2, 5), '2 of 5 mistakes');
});

test('a swipe needs distance, speed and a mostly sideways path; arrows ignore fields and modifiers', () => {
  assert.equal(swipeIntent({ dx: 120, dy: 10, ms: 200 }), 'prev');
  assert.equal(swipeIntent({ dx: -120, dy: 10, ms: 200 }), 'next');
  assert.equal(swipeIntent({ dx: 30, dy: 0, ms: 50 }), null, 'too short');
  assert.equal(swipeIntent({ dx: 100, dy: 0, ms: 900 }), null, 'too slow');
  assert.equal(swipeIntent({ dx: 100, dy: 90, ms: 200 }), null, 'mostly vertical is a scroll');
  assert.equal(arrowIntent({ key: 'ArrowLeft', target: { tagName: 'BUTTON' } }), 'prev');
  assert.equal(arrowIntent({ key: 'ArrowRight', target: { tagName: 'DIV' } }), 'next');
  assert.equal(arrowIntent({ key: 'ArrowRight', target: { tagName: 'TEXTAREA' } }), null);
  assert.equal(arrowIntent({ key: 'ArrowRight', shiftKey: true, target: { tagName: 'DIV' } }), null);
  assert.equal(arrowIntent({ key: 'ArrowDown', target: { tagName: 'DIV' } }), null);
});

const attempt = (id, subject, mode, at, wrong = [], right = []) => ({
  id, subject, completedAt: at, selectionMeta: { mode },
  details: [...wrong.map((qid) => ({ qid, isCorrect: false, givenIndex: 1 })), ...right.map((qid) => ({ qid, isCorrect: true, givenIndex: 0 })), { qid: 'blank', isCorrect: null }],
});
const D = (day) => Date.UTC(2026, 9, day, 6, 0, 0);

test('"missed before" is built only from other attempts where the same question was answered wrong', () => {
  const all = [
    attempt('m1', 'accountancy', 'full', D(1), ['q1', 'q2']),
    attempt('p1', 'accountancy', 'quick', D(3), ['q1'], ['q2']),
    attempt('m2', 'accountancy', 'nta', D(8), ['q1', 'q3']),
    attempt('m3', 'economics', 'full', D(9), ['q1']),
  ];
  const out = buildMissedBefore(all, 'm2');
  assert.deepEqual(Object.keys(out), ['q1'], 'q3 was missed once, a blank is never a mistake');
  assert.deepEqual(out.q1.map((m) => [m.attemptId, m.source]), [['m3', 'Mock 1'], ['p1', 'Quick practice'], ['m1', 'Mock 1']]);
  assert.equal(sourceLabel(all, all[2]), 'Mock 2', 'the second accountancy mock; economics has its own count');
  assert.deepEqual(buildMissedBefore(all, 'nope'), {});
  assert.deepEqual(buildMissedBefore([attempt('only', 'a', 'full', D(1), ['x'])], 'only'), {});
});

test('the client trusts only well-formed records, newest first, and says nothing without them', () => {
  const a = { missedBefore: { q1: [
    { attemptId: 'old', source: 'Mock 1', completedAt: D(1) },
    { attemptId: 'bad', source: '', completedAt: D(2) },
    { attemptId: '', source: 'Mock 9', completedAt: D(2) },
    { attemptId: 'new', source: 'Quick practice', completedAt: D(7) },
    { attemptId: 'nan', source: 'Mock 3', completedAt: 'soon' },
    null,
  ] } };
  assert.deepEqual(earlierMisses(a, 'q1').map((m) => m.attemptId), ['new', 'old']);
  assert.equal(missedCount(a, 'q1'), 3);
  assert.deepEqual(earlierMisses(a, 'q2'), []);
  assert.deepEqual(earlierMisses({}, 'q1'), []);
  assert.deepEqual(earlierMisses({ missedBefore: { q1: 'x' } }, 'q1'), []);
  assert.equal(missedCount({}, 'q1'), 1);
  assert.equal(dayMonth(Date.UTC(2026, 9, 12, 6)), '12 October');
  assert.equal(earlierMissLine({ source: 'Mock 3', completedAt: Date.UTC(2026, 9, 12, 6) }), 'You also missed this question in Mock 3 on 12 October.');
  assert.equal(earlierMissLine(null), null);
  assert.equal(RUN_COPY.missedTimes(2), 'Missed twice');
  assert.equal(RUN_COPY.missedTimes(3), 'Missed 3 times');
});

test('the ending counts only what the server acknowledged and names the misses', () => {
  const m = endingModel({ ids, outcomes: { a: 'explained', b: 'stored', c: 'not_explained' }, reached: new Set(['a', 'b', 'c']) });
  assert.deepEqual([m.repaired, m.repairedNow, m.repairedEarlier, m.missed, m.untouched, m.left, m.nothing], [1, ['a'], ['b'], ['c'], ['d'], 2, false]);
  assert.deepEqual(retryIds(m), ['c'], 'with something repaired, only the misses come back');
  const none = endingModel({ ids, outcomes: { a: 'held_for_recheck' }, reached: new Set(['a', 'b']) });
  assert.equal(none.nothing, true);
  assert.deepEqual(none.setAside, ['a']);
  assert.deepEqual(retryIds(none), ['b', 'c', 'd'], 'with nothing repaired, every open mistake of the run');
  // A started repair with no settled outcome (a failed call) is a miss, never a repair.
  assert.deepEqual(endingModel({ ids, outcomes: {}, reached: new Set(['a']) }).missed, ['a']);
  assert.equal(endingAct(m), 'proud');
  assert.equal(endingAct(none), 'encourage');
});

test('the ending says what is left and what is set aside, plainly', () => {
  assert.equal(endingFact({ left: 0, setAside: 0 }), 'Nothing left from this paper.');
  assert.equal(endingFact({ left: 2, setAside: 1 }), '2 left from this paper. 1 set aside while its key is checked.');
  assert.equal(endingFact({ left: 0, setAside: 3 }), 'Nothing left from this paper. 3 set aside while their keys are checked.');
  assert.equal(nothingLine({ setAside: 0 }), 'Your mistakes stay in Review.');
  assert.equal(nothingLine({ setAside: 2 }), '2 set aside. They stay in Review.');
  assert.equal(RUN_COPY.endingUnit(1), 'mistake repaired');
  assert.equal(RUN_COPY.endingUnit(3), 'mistakes repaired');
  assert.equal(tonightOrToday(new Date(2026, 9, 15, 15, 59)), 'today');
  assert.equal(tonightOrToday(new Date(2026, 9, 15, 16, 0)), 'tonight');
  assert.equal(tonightOrToday(new Date(2026, 9, 15, 4, 59)), 'tonight');
  assert.equal(tonightOrToday(new Date(2026, 9, 15, 5, 0)), 'today');
  assert.equal(finishFor(new Date(2026, 9, 15, 21, 0)), 'Finish for tonight');
});

test('Mobi: the act follows the real state, success once per mistake, mood as in the app', () => {
  assert.equal(repairAct(repairMood('explained')), 'correct');
  assert.equal(repairAct(repairMood('explained'), { cheered: true }), 'idle', 'a return never celebrates again');
  assert.equal(repairAct(repairMood('stored')), 'hello');
  assert.equal(repairAct(repairMood('idle')), null);
  const gate = createOnceGate();
  assert.deepEqual([gate.claim('a/q1'), gate.claim('a/q1'), gate.claim('a/q2'), gate.has('a/q1')], [true, false, true, true]);
  for (const mood of ['think', 'loading', 'correct', 'hello', 'oops', 'encourage', 'rest']) assert.ok(REPAIR_MOBI_MOOD[mood], mood);
  assert.equal(REPAIR_MOBI_MOOD.correct, 'happy');
  assert.equal(REPAIR_MOBI_MOOD.oops, 'concerned');
  // A tap is a nod; three quick taps cheer only for a repair the server acknowledged.
  assert.equal(tapAct({ taps: 1 }), 'nod');
  assert.equal(tapAct({ taps: 3, acknowledged: true }), 'cheer');
  assert.equal(tapAct({ taps: 3, acknowledged: false }), 'tilt');
});

test('the ending tap cycle: in order, never the same twice, resets after 8 s, six a visit, no repair claim when nothing was repaired', () => {
  let t = 0;
  const cycle = createTapCycle({ now: () => t });
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(() => cycle.tap()), ['hello', 'tilt', 'correct', 'startle', 'hello', 'tilt']);
  assert.equal(cycle.tap(), null, 'the cap');
  assert.equal(TAP_VISIT_CAP, 6);
  t += TAP_IDLE_RESET_MS + 1;
  const fresh = createTapCycle({ now: () => t });
  fresh.tap(); fresh.tap();
  t += TAP_IDLE_RESET_MS + 1;
  assert.equal(fresh.tap(), 'hello', 'starts over after 8 s without a tap');
  const missing = createTapCycle({ has: (a) => a !== 'startle' });
  assert.deepEqual([1, 2, 3, 4].map(() => missing.tap()), ['hello', 'tilt', 'correct', 'hello'], 'acts the site lacks are skipped');
  const nothing = createTapCycle({ repaired: false });
  const seen = Array.from({ length: 6 }, () => nothing.tap());
  assert.ok(!seen.includes('correct') && !seen.includes('cheer'));
  for (let i = 1; i < seen.length; i++) assert.notEqual(seen[i], seen[i - 1]);
  assert.deepEqual([...TAP_CYCLE], ['hello', 'tilt', 'correct', 'startle']);
});

test('the words are plain: no exclamation marks, no dashes', () => {
  const lines = [];
  const walk = (v) => {
    if (typeof v === 'string') lines.push(v);
    else if (typeof v === 'function') lines.push(v(2, 5, 'x'), v('Mock 3', '12 October'), v(1));
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(RUN_COPY);
  lines.push(endingFact({ left: 1, setAside: 1 }), nothingLine({ setAside: 1 }), finishFor(new Date()));
  for (const line of lines.filter(Boolean)) {
    assert.doesNotMatch(String(line), /[!—–]/, `no exclamation mark or dash in: ${line}`);
  }
});

test('the run is wired in: the repair panel takes the run props, Mobi goes through MobiReact, and the track is 44 px', () => {
  const panel = read('src/components/recovery/MistakeRepair.jsx');
  assert.match(panel, /const mobi = nta \? null : <RepairMobi/);
  assert.match(panel, /onStart\?\.\(questionId\)/);
  assert.match(panel, /swipeIntent/);
  assert.match(panel, /arrowIntent/);
  const mobi = read('src/components/recovery/RepairMobi.jsx');
  assert.match(mobi, /import MobiReact from '@\/components\/brand\/MobiReact'/);
  assert.doesNotMatch(mobi, /Mascot/, 'no private copy of the art');
  assert.match(mobi, /cheerGate/);
  assert.match(mobi, /celebrations === 'off'/);
  const page = read('src/app/(app)/result/[id]/ResultPageClient.jsx');
  assert.match(page, /<RunTrack/);
  assert.match(page, /<RepairEnding/);
  assert.match(page, /isNtaAttempt/);
  const css = read('src/components/recovery/repair-run.css');
  assert.match(css, /\.rt__seg \{[^}]*height: 44px/, 'track targets are 44 px');
  assert.match(css, /rt-in-a 160ms/, 'the hand-over is 160 ms');
});

test('the four steps are the app words (ReviewCopy in flutter_app copy.dart) and say plainly that the last two are not ready', () => {
  assert.deepEqual([...RUN_COPY.stages], ['Found', 'Repaired', 'Retested', 'Still right']);
  assert.equal(RUN_COPY.stagesLabel, `Steps: ${RUN_COPY.stages.join(', ')}`);
  assert.equal(RUN_COPY.laterSteps, 'The last two steps test you with new questions on the same idea. They are not ready yet.');
  const ending = read('src/components/recovery/RepairEnding.jsx');
  assert.match(ending, /aria-label=\{RUN_COPY\.stagesLabel\}/);
  assert.match(ending, /\{RUN_COPY\.laterSteps\}/);
  for (const old of ['>Checked<', '>Holds<', 'Checked comes later']) assert.ok(!ending.includes(old), `no "${old}" on the ending`);
});

test('Mobi always stands beside a line in the repair, never in a row of his own (the app does the same)', () => {
  const panel = read('src/components/recovery/MistakeRepair.jsx');
  const all = panel.match(/(?<!=)\{mobi\}/g) || []; // where he is placed, not the mobi={mobi} prop
  const besideTop = panel.match(/<div className="mr-top">\s*\{mobi\}/g) || [];
  const besideHead = panel.match(/<header className="mr-head"[^>]*>\s*\{mobi\}/g) || [];
  assert.ok(all.length > 0);
  assert.equal(besideTop.length + besideHead.length, all.length, 'every Mobi shares his row with the wait line, a note or the heading');
});
